-- Prazos de verdade.
--
-- Até aqui todo chamado nascia com 2 h para responder e 24 h para resolver,
-- contados de forma corrida, qualquer que fosse a prioridade:
--
--   * O gatilho do prazo (tickets_apply_service_levels) rodava antes do que
--     calcula a prioridade (tickets_sync_priority) — o Postgres dispara
--     gatilhos do mesmo momento em ordem alfabética do nome. O prazo sempre
--     via a prioridade padrão, "média".
--   * Os níveis de serviço (SLA/OLA) da tela só valiam se alguém ligasse o
--     chamado a eles, e nada no sistema ligava.
--   * O calendário (expediente e feriados) só entrava por esses níveis.
--   * Depois de dado, o prazo nunca era refeito: mudar a urgência não mexia nele.
--
-- O modelo novo é um só e cabe numa tabela: para cada faixa de prioridade,
-- em quanto tempo responder, em quanto tempo resolver e em qual calendário
-- contar (sem calendário = corrido, 24 h por dia). É a tabela sla_policies,
-- que já existia sem tela.
--
-- Os níveis de serviço (SLA/OLA) e o escalonamento saem: nenhum chamado usava
-- os níveis, nenhum escalonamento estava cadastrado, e a ação principal do
-- escalonamento era mandar e-mail, que também sai do sistema.

-- 1) Calendário de cada faixa. Começa no calendário padrão, se houver.
alter table public.sla_policies
  add column if not exists calendar_id uuid references public.calendars(id) on delete set null;

update public.sla_policies
   set calendar_id = (select id from public.calendars where is_default order by created_at limit 1)
 where calendar_id is null;

-- Escrever nos prazos segue o mesmo direito da tela (antes exigia o papel
-- admin antigo, que a tela não conferia).
drop policy if exists sla_write on public.sla_policies;
create policy sla_write on public.sla_policies
  for all to authenticated
  using (public.has_right(auth.uid(), 'sla', 'update'))
  with check (public.has_right(auth.uid(), 'sla', 'update'));

-- 2) O cálculo. Base é a abertura do chamado; o tempo em Pendente
--    (waiting_seconds) é somado por cima, como já fazia o congelamento.
create or replace function public.calcula_prazos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pol public.sla_policies%rowtype;
  base timestamptz := coalesce(new.created_at, now());
  pausa interval := make_interval(secs => coalesce(new.waiting_seconds, 0));
begin
  -- No update, só refaz quando a faixa de prioridade muda. Assim um ajuste
  -- manual de prazo (ou o congelamento do Pendente) não é desfeito à toa.
  if tg_op = 'UPDATE' and new.priority is not distinct from old.priority then
    return new;
  end if;

  select * into pol from public.sla_policies where priority = new.priority;
  if not found then
    return new;
  end if;

  new.response_due_at :=
    public.add_working_time(base, pol.response_minutes, pol.calendar_id) + pausa;
  new.resolution_due_at :=
    public.add_working_time(base, pol.resolution_minutes, pol.calendar_id) + pausa;
  return new;
end;
$$;

revoke execute on function public.calcula_prazos() from public, anon, authenticated;

-- 3) Ordem dos gatilhos. Mesmo momento (BEFORE) dispara em ordem alfabética,
--    então os nomes levam número: regras do sistema, depois a prioridade,
--    depois o prazo, por último o congelamento do Pendente.
drop trigger if exists tickets_apply_service_levels on public.tickets;
alter trigger tickets_business_rules on public.tickets rename to tickets_1_regras;
alter trigger tickets_sync_priority  on public.tickets rename to tickets_2_prioridade;
create trigger tickets_3_prazos
  before insert or update on public.tickets
  for each row execute function public.calcula_prazos();
alter trigger tickets_freeze_sla on public.tickets rename to tickets_4_pausa;

-- 4) Saem os níveis de serviço, os prazos internos (OLA) e o escalonamento.
select cron.unschedule('glpi_escalonamento')
 where exists (select 1 from cron.job where jobname = 'glpi_escalonamento');

drop function if exists public.run_escalations();
drop function if exists public.apply_service_levels();
drop function if exists public.apply_sla();
drop function if exists public.apply_sla_on_update();
drop function if exists public.service_level_minutes(uuid);

-- Regra de atribuição que apontava para um nível de serviço não tem mais alvo.
delete from public.rule_actions where field in ('sla_tto_id', 'sla_ttr_id', 'ola_tto_id', 'ola_ttr_id');

alter table public.tickets
  drop column if exists sla_tto_id,
  drop column if exists sla_ttr_id,
  drop column if exists ola_tto_id,
  drop column if exists ola_ttr_id,
  drop column if exists internal_response_due_at,
  drop column if exists internal_resolution_due_at;

-- O congelamento do Pendente também empurrava o prazo interno (OLA).
create or replace function public.freeze_sla_on_pending()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  frozen integer;
begin
  if new.status = 'aguardando' and old.status <> 'aguardando' then
    new.pending_since := now();

  elsif old.status = 'aguardando' and new.status <> 'aguardando' and old.pending_since is not null then
    frozen := greatest(0, extract(epoch from (now() - old.pending_since))::integer);
    new.waiting_seconds := coalesce(old.waiting_seconds, 0) + frozen;
    new.pending_since := null;

    if new.response_due_at is not null and new.first_response_at is null then
      new.response_due_at := new.response_due_at + make_interval(secs => frozen);
    end if;
    if new.resolution_due_at is not null then
      new.resolution_due_at := new.resolution_due_at + make_interval(secs => frozen);
    end if;
  end if;

  return new;
end;
$$;

-- O executor manual de ações automáticas chamava o escalonamento.
delete from public.automatic_actions where code = 'escalonamento_sla';

create or replace function public.run_automatic_action(_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  result text;
  n integer;
begin
  if not (
    current_user in ('postgres', 'service_role', 'supabase_admin')
    or (auth.uid() is not null and public.has_right(auth.uid(), 'automatic_action', 'update'))
  ) then
    raise exception 'Sem permissão para executar ações automáticas';
  end if;

  case _code
    when 'fechar_chamados' then
      n := public.run_auto_close();
      result := n || ' chamado(s) fechado(s)';
    when 'chamados_recorrentes' then
      n := public.run_recurrent_tickets();
      result := n || ' chamado(s) criado(s)';
    when 'pesquisa_satisfacao' then
      n := public.run_satisfaction();
      result := n || ' pesquisa(s) gerada(s)';
    when 'alertas_inventario' then
      n := public.run_inventory_alerts();
      result := n || ' alerta(s) de inventário';
    when 'alertas_gestao' then
      n := public.run_management_alerts();
      result := n || ' alerta(s) de gestão';
    else
      result := 'Ação sem execução direta no banco';
  end case;

  update public.automatic_actions
     set last_run_at = now(), last_result = result
   where code = _code;

  return result;
end;
$$;

drop table if exists public.escalation_log;
drop table if exists public.escalation_actions;
drop table if exists public.escalation_criteria;
drop table if exists public.escalation_levels;
drop table if exists public.service_levels;

-- 5) Refaz o prazo dos chamados em aberto com a regra nova. Os encerrados
--    ficam como estão: o prazo deles é registro do que foi combinado.
--    O carimbo de "atualizado em" fica parado: ninguém mexeu no chamado.
alter table public.tickets disable trigger tickets_updated_at;

update public.tickets t
   set response_due_at =
         public.add_working_time(t.created_at, p.response_minutes, p.calendar_id)
         + make_interval(secs => coalesce(t.waiting_seconds, 0)),
       resolution_due_at =
         public.add_working_time(t.created_at, p.resolution_minutes, p.calendar_id)
         + make_interval(secs => coalesce(t.waiting_seconds, 0))
  from public.sla_policies p
 where p.priority = t.priority
   and t.status in ('aberto', 'em_andamento', 'planejado', 'aguardando');

alter table public.tickets enable trigger tickets_updated_at;
