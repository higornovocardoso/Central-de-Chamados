-- Limpeza do que sobrou dos módulos que saíram do sistema.
--
-- As telas de inventário, gestão, projetos, problemas, mudanças, reservas e
-- afins saíram antes; as tabelas, funções e rotinas noturnas ficaram no banco
-- (a rotina diária ainda gerava alertas de inventário e de gestão). O sistema
-- agora é só a central de chamados, e o banco passa a ser só ela também.
--
-- Ficam as tabelas que as telas usam, mais as de apoio delas: cabeçalhos de
-- documento, categorias e revisões da base de conhecimento, tipos de
-- fornecedor, matriz e níveis de prioridade, ações automáticas.

-- 1) Rotinas agendadas: a diária só fazia coisa de módulo removido (e a
--    pesquisa de satisfação, que não tinha onde ser respondida).
select cron.unschedule('glpi_diario')
 where exists (select 1 from cron.job where jobname = 'glpi_diario');

select cron.schedule('glpi_horario', '0 * * * *', $$
  select public.run_auto_close();
  select public.run_recurrent_tickets();
$$);

delete from public.automatic_actions
 where code not in ('fechar_chamados', 'chamados_recorrentes');

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
    else
      result := 'Ação sem execução direta no banco';
  end case;

  update public.automatic_actions
     set last_run_at = now(), last_result = result
   where code = _code;

  return result;
end;
$$;

-- 2) Funções dos módulos removidos.
drop function if exists public.run_satisfaction();
drop function if exists public.run_inventory_alerts();
drop function if exists public.run_management_alerts();
drop function if exists public.run_recurrent_changes();
drop function if exists public.apply_dictionary(text, text);
drop function if exists public.asset_residual_value(uuid);
drop function if exists public.budget_spent(uuid);
drop function if exists public.cartridge_stock(uuid);
drop function if exists public.consumable_stock(uuid);
drop function if exists public.contract_end_date(uuid);
drop function if exists public.license_usage(uuid);
drop function if exists public.warranty_end_date(uuid);

-- 3) Colunas que apontavam para eles.
alter table public.tickets
  drop column if exists asset_id,
  drop column if exists contract_id;

alter table public.ticket_costs drop column if exists budget_id;

-- Configurações da empresa sem efeito: fica só o fechamento automático.
alter table public.entities
  drop column if exists calendar_id,
  drop column if exists default_ticket_type,
  drop column if exists auto_assign_mode,
  drop column if exists auto_purge_days,
  drop column if exists survey_enabled,
  drop column if exists survey_delay_days,
  drop column if exists survey_rate,
  drop column if exists survey_max_score,
  drop column if exists survey_comment_below;

-- O histórico do chamado acompanhava o ativo.
create or replace function public.log_ticket_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  watched text[] := array['title','description','status','type','category','urgency','impact',
                          'priority_level','assignee_id','requester_id','entity_id',
                          'location_id','validation_state','is_deleted'];
  before_row jsonb := to_jsonb(old);
  after_row jsonb := to_jsonb(new);
  f text;
  old_v text;
  new_v text;
begin
  foreach f in array watched loop
    old_v := before_row ->> f;
    new_v := after_row ->> f;
    if old_v is distinct from new_v then
      insert into public.item_history (item_type, item_id, user_id, field, old_value, new_value)
      values ('ticket', new.id, auth.uid(), f, coalesce(old_v, ''), coalesce(new_v, ''));
    end if;
  end loop;
  return new;
end;
$$;

-- 4) As tabelas. CASCADE só leva as ligações entre elas mesmas: nenhuma
--    tabela que fica tem chave, política ou função apontando para estas
--    (conferido antes de escrever esta migração).
drop table if exists
  public.appliance_environments, public.appliance_items, public.appliance_types, public.appliances,
  public.asset_cables, public.asset_components, public.asset_computers, public.asset_connections,
  public.asset_enclosures, public.asset_infocoms, public.asset_models, public.asset_monitors,
  public.asset_network_equipments, public.asset_operating_systems, public.asset_pdus,
  public.asset_phones, public.asset_printers, public.asset_racks, public.asset_sims,
  public.asset_states, public.asset_types, public.asset_volumes, public.assets,
  public.budgets, public.cartridge_item_models, public.cartridge_items, public.cartridges,
  public.certificate_items, public.certificate_types, public.certificates, public.changes,
  public.cluster_items, public.clusters, public.components, public.consumable_items,
  public.consumables, public.contact_suppliers, public.contact_types, public.contacts,
  public.contract_costs, public.contract_items, public.contract_suppliers, public.contract_types,
  public.contracts, public.dashboards, public.database_instances, public.databases,
  public.datacenters, public.dictionaries, public.dictionary_entries, public.document_items,
  public.domain_items, public.domain_record_types, public.domain_records, public.domain_types,
  public.domains, public.field_locks, public.field_unicity, public.ip_addresses,
  public.ip_networks, public.itil_assets, public.itil_costs, public.itil_followups,
  public.itil_relations, public.itil_tasks, public.kb_comments, public.kb_targets,
  public.line_items, public.line_types, public.manufacturers, public.network_ports,
  public.operating_systems, public.phone_lines, public.problems, public.project_costs,
  public.project_items, public.project_states, public.project_task_types, public.project_tasks,
  public.project_teams, public.project_types, public.projects, public.rack_items,
  public.recurrent_changes, public.reminder_targets, public.reminders, public.reservation_items,
  public.reservations, public.rss_feeds, public.satisfaction_surveys, public.server_rooms,
  public.sockets, public.software, public.software_categories, public.software_installations,
  public.software_licenses, public.software_versions, public.ticket_items, public.user_substitutes,
  public.vlans
  cascade;

-- Funções de gatilho que só serviam às tabelas acima.
drop function if exists public.sync_itil_priority();
drop function if exists public.check_asset_unicity();
drop function if exists public.check_reservation_overlap();
drop function if exists public.refresh_project_progress();

-- 5) Direitos de acesso que não protegem mais nada. Fica o direito que alguma
--    tela confere ou que alguma política ou função do banco ainda usa.
do $$
declare
  usados text[];
  das_telas constant text[] := array[
    'business_rule','calendar','config','document','dropdown','entity','financial_info',
    'group','knowledgebase','faq','log','planning','profile','recurrent','sla','solution',
    'task','ticket','user','followup','validation','supplier','automatic_action'
  ];
begin
  select coalesce(array_agg(distinct m[1]), '{}') into usados
    from (
      select coalesce(pg_get_expr(pol.polqual, pol.polrelid), '') || ' ' ||
             coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), '') as txt
        from pg_policy pol
      union all
      select pg_get_functiondef(p.oid)
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.prokind = 'f'
    ) fontes,
    regexp_matches(fontes.txt, 'has_right(?:_in_entity)?\([^,]+,\s*''([a-z_]+)''', 'g') m;

  delete from public.profile_rights
   where object_key <> all (usados) and object_key <> all (das_telas);
  delete from public.right_definitions
   where key <> all (usados) and key <> all (das_telas);
end;
$$;

-- 6) O teste de isolamento entre empresas usava a tabela de ativos; passa a
--    usar a de locais (mesmo arquivo de supabase/tests/isolamento_entidades.sql).
-- Teste de isolamento entre empresas.
--
-- Monta duas empresas de mentira, com um usuário e um domínio de e-mail cada,
-- e verifica que nenhuma enxerga ou grava no dado da outra — pelo lado de quem
-- está logado e pelo lado do formulário público.
-- Apaga tudo ao final, inclusive quando algum passo falha no meio.
--
-- Rodar depois de qualquer alteração em política de segurança, em gatilho de
-- usuário, ou antes de cadastrar uma empresa nova:
--
--   select * from public.teste_isolamento_entidades();
--
-- Todas as linhas precisam vir com passou = true. Uma linha falsa significa
-- que uma empresa consegue ver ou alterar dado de outra.
--
-- O cenário mais forte do lado logado é "lendo TODOS os chamados do sistema":
-- consulta a tabela inteira, sem filtro, e exige que o usuário da empresa de
-- teste veja apenas o próprio. Isso prova o isolamento contra os dados reais
-- que já estão no banco, não só contra os registros que o teste criou.
--
-- Os três últimos cenários cobrem o formulário público, onde o domínio do
-- e-mail decide a empresa. O mais importante é o do entity_id forjado: prova
-- que mandar na requisição o entity_id de outra empresa não adianta, porque a
-- política do banco confere o domínio de novo.
--
-- Os UUIDs são fixos e reconhecíveis para que a limpeza seja determinística:
-- se uma execução anterior morreu no meio, a próxima remove o lixo antes de
-- começar.

create or replace function public.teste_isolamento_entidades()
returns table(cenario text, esperado text, obtido text, passou boolean)
language plpgsql
-- Precisa ser SECURITY INVOKER: uma função SECURITY DEFINER não pode trocar o
-- papel da sessão, e trocar de papel é o que permite simular cada usuário.
set search_path = public
as $teste$
declare
  ent_a  uuid := '00000000-0000-4000-a000-00000000000a';
  ent_b  uuid := '00000000-0000-4000-a000-00000000000b';
  usr_a  uuid := '00000000-0000-4000-b000-00000000000a';
  usr_b  uuid := '00000000-0000-4000-b000-00000000000b';
  perfil uuid;
  papel_original text := current_user;
  n int;
  msg text;
begin
  delete from public.entity_email_domains where entity_id in (ent_a, ent_b);
  delete from public.locations            where entity_id in (ent_a, ent_b);
  delete from public.tickets              where entity_id in (ent_a, ent_b);
  delete from public.user_authorizations  where user_id   in (usr_a, usr_b);
  delete from public.user_roles           where user_id   in (usr_a, usr_b);
  delete from public.profiles             where id        in (usr_a, usr_b);
  delete from auth.users                  where id        in (usr_a, usr_b);
  delete from public.entities             where id        in (ent_a, ent_b);

  select ap.id into perfil from public.access_profiles ap where ap.name = 'Super-Admin' limit 1;
  if perfil is null then
    select ap.id into perfil from public.access_profiles ap order by ap.id limit 1;
  end if;

  insert into public.entities (id, name, parent_id, level, path, accepts_public_tickets) values
    (ent_a, 'TESTE Empresa A', null, 0, '/' || ent_a || '/', true),
    (ent_b, 'TESTE Empresa B', null, 0, '/' || ent_b || '/', true);

  insert into public.entity_email_domains (entity_id, domain) values
    (ent_a, 'teste-empresa-a.invalid'),
    (ent_b, 'teste-empresa-b.invalid');

  insert into auth.users (id, email, raw_user_meta_data) values
    (usr_a, 'teste-a@isolamento.invalid', '{"full_name":"TESTE Usuario A"}'::jsonb),
    (usr_b, 'teste-b@isolamento.invalid', '{"full_name":"TESTE Usuario B"}'::jsonb);

  -- Rede de segurança: se handle_new_user voltar a conceder entidade sozinho,
  -- este delete impede que o teste passe por acaso, com os dois usuários na
  -- mesma empresa.
  delete from public.user_authorizations where user_id in (usr_a, usr_b);

  insert into public.user_authorizations (user_id, profile_id, entity_id, is_recursive) values
    (usr_a, perfil, ent_a, true),
    (usr_b, perfil, ent_b, true);

  insert into public.tickets (entity_id, title) values
    (ent_a, 'TESTE chamado da Empresa A'),
    (ent_b, 'TESTE chamado da Empresa B');

  insert into public.locations (entity_id, name) values (ent_a, 'TESTE local da A');

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', usr_a, 'role', 'authenticated')::text, true);

  select count(*) into n from public.tickets where entity_id = ent_b;
  cenario := 'usuario da A lendo chamado da B';
  esperado := '0'; obtido := n::text; passou := (n = 0); return next;

  select count(*) into n from public.tickets where entity_id = ent_a;
  cenario := 'usuario da A lendo o proprio chamado';
  esperado := '1'; obtido := n::text; passou := (n = 1); return next;

  select count(*) into n from public.tickets;
  cenario := 'usuario da A lendo TODOS os chamados do sistema';
  esperado := '1'; obtido := n::text; passou := (n = 1); return next;

  begin
    insert into public.tickets (entity_id, title, requester_id)
    values (ent_b, 'TESTE invasao', usr_a);
    obtido := 'gravou'; passou := false;
  exception when insufficient_privilege or check_violation then
    obtido := 'bloqueado'; passou := true;
  end;
  cenario := 'usuario da A gravando na B';
  esperado := 'bloqueado'; return next;

  perform set_config('request.jwt.claims',
    json_build_object('sub', usr_b, 'role', 'authenticated')::text, true);

  select count(*) into n from public.tickets where entity_id = ent_a;
  cenario := 'usuario da B lendo chamado da A';
  esperado := '0'; obtido := n::text; passou := (n = 0); return next;

  select count(*) into n from public.locations where entity_id = ent_a;
  cenario := 'usuario da B lendo local da A';
  esperado := '0'; obtido := n::text; passou := (n = 0); return next;

  -- Formulario publico: o dominio do e-mail decide a empresa.
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', null, true);

  begin
    insert into public.tickets (entity_id, title, reporter_name, reporter_email, status)
    values (ent_a, 'TESTE publico correto', 'Fulano', 'fulano@teste-empresa-a.invalid', 'aberto');
    obtido := 'gravou'; passou := true;
  exception when others then
    obtido := 'bloqueado'; passou := false;
  end;
  cenario := 'publico com dominio da propria empresa';
  esperado := 'gravou'; return next;

  begin
    insert into public.tickets (entity_id, title, reporter_name, reporter_email, status)
    values (ent_a, 'TESTE dominio forjado', 'Invasor', 'invasor@dominio-desconhecido.invalid', 'aberto');
    obtido := 'gravou'; passou := false;
  exception when others then
    obtido := 'bloqueado'; passou := true;
  end;
  cenario := 'publico com dominio nao cadastrado';
  esperado := 'bloqueado'; return next;

  -- O ataque que importa: dominio da A, mas entity_id apontando para a B.
  begin
    insert into public.tickets (entity_id, title, reporter_name, reporter_email, status)
    values (ent_b, 'TESTE entity forjado', 'Invasor', 'fulano@teste-empresa-a.invalid', 'aberto');
    obtido := 'gravou'; passou := false;
  exception when others then
    obtido := 'bloqueado'; passou := true;
  end;
  cenario := 'publico com entity_id forjado para outra empresa';
  esperado := 'bloqueado'; return next;

  perform set_config('role', papel_original, true);
  perform set_config('request.jwt.claims', null, true);

  delete from public.entity_email_domains where entity_id in (ent_a, ent_b);
  delete from public.locations            where entity_id in (ent_a, ent_b);
  delete from public.tickets              where entity_id in (ent_a, ent_b);
  delete from public.user_authorizations  where user_id   in (usr_a, usr_b);
  delete from public.user_roles           where user_id   in (usr_a, usr_b);
  delete from public.profiles             where id        in (usr_a, usr_b);
  delete from auth.users                  where id        in (usr_a, usr_b);
  delete from public.entities             where id        in (ent_a, ent_b);
  return;

exception when others then
  get stacked diagnostics msg = message_text;
  perform set_config('role', papel_original, true);
  perform set_config('request.jwt.claims', null, true);
  delete from public.entity_email_domains where entity_id in (ent_a, ent_b);
  delete from public.locations            where entity_id in (ent_a, ent_b);
  delete from public.tickets              where entity_id in (ent_a, ent_b);
  delete from public.user_authorizations  where user_id   in (usr_a, usr_b);
  delete from public.user_roles           where user_id   in (usr_a, usr_b);
  delete from public.profiles             where id        in (usr_a, usr_b);
  delete from auth.users                  where id        in (usr_a, usr_b);
  delete from public.entities             where id        in (ent_a, ent_b);
  cenario := 'ERRO NA EXECUCAO'; esperado := 'sem erro'; obtido := msg; passou := false;
  return next;
end
$teste$;

-- Só quem administra o banco roda o teste: ele cria e apaga usuários.
revoke all on function public.teste_isolamento_entidades() from public, anon, authenticated;
