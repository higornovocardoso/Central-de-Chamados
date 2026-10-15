-- Fase 31: reforço de segurança.
--
-- Revisão das permissões com o sistema já reduzido a chamados. Tudo aqui
-- fecha caminhos que a tela não oferece, mas a API do Supabase aceitava: a
-- chave pública vai no navegador, então qualquer pessoa pode falar direto com
-- o banco, e a regra tem que estar nele, não só no formulário.
--
--   1. can_see_ticket ignorava a empresa. Como é SECURITY DEFINER, passa por
--      cima do RLS de tickets: um técnico de uma empresa enxergava soluções,
--      aprovações e anexos de chamados de outra, sabendo o id.
--   2. Abertura de chamado por quem não é da equipe (visitante do formulário
--      público ou solicitante logado) aceitava qualquer coluna: data de
--      abertura no passado, técnico já atribuído, prioridade travada, chamado
--      nascendo fechado. Agora o banco zera o que é do sistema, limita o
--      tamanho dos textos e segura rajadas de chamados de fora.
--   3. Quem escreveu um acompanhamento podia editá-lo trocando o ticket_id,
--      e assim pôr texto num chamado que não enxerga.
--   4. Soluções: quem só via o chamado (o solicitante) podia registrar,
--      reescrever ou apagar a solução do técnico. Agora registra quem tem o
--      direito de solucionar; o solicitante só responde (aprova ou recusa).
--   5. Aprovações: qualquer pessoa logada podia criar uma aprovação em
--      qualquer chamado nomeando a si mesma como aprovadora, e aprová-la.
--   6. A lista de pessoas (nome e e-mail) era aberta a qualquer conta. Agora
--      cada um vê quem divide empresa com ele e quem aparece nos chamados que
--      ele vê; a equipe e quem administra pessoas continuam vendo todos.
--   7. Quem administra pessoas podia conceder um perfil com mais direitos que
--      o seu, inclusive a si mesmo. Agora o perfil concedido tem que caber
--      nos direitos de quem concede. As funções do servidor que mexem em
--      conta (senha, e-mail, exclusão) passam a perguntar ao banco se aquela
--      pessoa pode mexer naquela conta.
--   8. sincroniza_assignee_id é função de gatilho e estava exposta na API.

-- 1. ---------------------------------------------------------------------------

create or replace function public.can_see_ticket(_ticket_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.tickets t
     where t.id = _ticket_id
       and t.entity_id in (select public.visible_entity_ids(auth.uid()))
       and (t.requester_id = auth.uid() or t.assignee_id = auth.uid() or public.is_staff(auth.uid()))
  );
$$;

-- 2. ---------------------------------------------------------------------------

-- Rajada de chamados de fora: no máximo 5 por e-mail e 60 no total a cada 10
-- minutos. Conta como "de fora" o chamado sem solicitante cadastrado.
create index if not exists tickets_publicos_recentes_idx
  on public.tickets (created_at)
  where requester_id is null;

create or replace function public.excedeu_limite_publico(_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (select count(*) from public.tickets
           where requester_id is null
             and created_at > now() - interval '10 minutes'
             and lower(reporter_email) = lower(btrim(_email))) >= 5
      or (select count(*) from public.tickets
           where requester_id is null
             and created_at > now() - interval '10 minutes') >= 60;
$$;

revoke all on function public.excedeu_limite_publico(text) from public, authenticated;
grant execute on function public.excedeu_limite_publico(text) to anon;

-- SECURITY INVOKER de propósito: current_user diz quem está gravando. Gravação
-- do próprio banco (chamados recorrentes, ações automáticas) roda como dono e
-- passa direto.
create or replace function public.protege_abertura_de_chamado()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  -- IFs aninhados: o papel anon não pode chamar has_right_in_entity, e o
  -- Postgres não garante a ordem de avaliação de um AND.
  if current_user = 'authenticated' then
    if public.has_right_in_entity(auth.uid(), 'ticket', 'update', new.entity_id) then
      return new;
    end if;
  end if;

  if length(new.title) > 160 or length(new.description) > 4000
     or length(new.category) > 160 or length(new.reporter_name) > 120
     or length(new.reporter_email) > 180 or length(new.reporter_sector) > 120 then
    raise exception 'Texto maior que o permitido.' using errcode = '22001';
  end if;

  -- O que é do sistema nasce do sistema. Prioridade sai de urgência e
  -- impacto no gatilho seguinte; impacto é julgamento de quem atende.
  new.created_at := now();
  new.updated_at := now();
  new.status := 'aberto';
  new.assignee_id := null;
  new.impact := 3;
  new.priority_manual := false;
  new.closed_at := null;
  new.resolved_at := null;
  new.first_response_at := null;
  new.taken_into_account_at := null;
  new.pending_since := null;
  new.response_due_at := null;
  new.resolution_due_at := null;
  new.waiting_seconds := 0;
  new.is_deleted := false;
  new.deleted_at := null;
  new.validation_state := 'nao_sujeito';
  new.validation_percent := 100;
  new.kb_article_id := null;
  new.external_id := '';

  if new.category_id is not null and not exists (
    select 1 from public.itil_categories c
     where c.id = new.category_id and c.visible_helpdesk
  ) then
    new.category_id := null;
  end if;

  if current_user = 'anon' then
    new.requester_id := null;
    new.location_id := null;
    if public.excedeu_limite_publico(new.reporter_email) then
      raise exception 'Muitos chamados em pouco tempo. Aguarde alguns minutos e tente de novo.'
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.protege_abertura_de_chamado() from public, anon, authenticated;

-- "0" no nome: roda antes das regras de atribuição (tickets_1_regras), que
-- continuam podendo definir técnico e grupo.
drop trigger if exists tickets_0_protege_abertura on public.tickets;
create trigger tickets_0_protege_abertura
  before insert on public.tickets
  for each row execute function public.protege_abertura_de_chamado();

-- 3. ---------------------------------------------------------------------------

create or replace function public.protege_acompanhamento()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.ticket_id is distinct from old.ticket_id
     or new.author_id is distinct from old.author_id then
    raise exception 'O acompanhamento não pode mudar de chamado nem de autor.';
  end if;
  return new;
end;
$$;

revoke execute on function public.protege_acompanhamento() from public, anon, authenticated;

drop trigger if exists ticket_comments_protege on public.ticket_comments;
create trigger ticket_comments_protege
  before update on public.ticket_comments
  for each row execute function public.protege_acompanhamento();

-- 4. ---------------------------------------------------------------------------

drop policy if exists solutions_insert_quem_soluciona on public.ticket_solutions;
create policy solutions_insert_quem_soluciona on public.ticket_solutions
  as restrictive
  for insert
  to authenticated
  with check (public.has_right(auth.uid(), 'solution', 'create') and public.can_see_ticket(ticket_id));

drop policy if exists solutions_delete_quem_soluciona on public.ticket_solutions;
create policy solutions_delete_quem_soluciona on public.ticket_solutions
  as restrictive
  for delete
  to authenticated
  using (public.has_right(auth.uid(), 'solution', 'delete'));

-- Quem não tem o direito de editar soluções só responde: aprova ou recusa uma
-- solução que ainda espera resposta, sem tocar no texto do técnico.
create or replace function public.protege_solucao()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user <> 'authenticated'
     or public.has_right(auth.uid(), 'solution', 'update') then
    return new;
  end if;

  if new.ticket_id is distinct from old.ticket_id
     or new.content is distinct from old.content
     or new.solution_type_id is distinct from old.solution_type_id
     or new.author_id is distinct from old.author_id
     or new.created_at is distinct from old.created_at
     or old.state <> 'aguardando'
     or new.answered_by is distinct from auth.uid() then
    raise exception 'Você só pode aprovar ou recusar esta solução.';
  end if;
  return new;
end;
$$;

revoke execute on function public.protege_solucao() from public, anon, authenticated;

drop trigger if exists ticket_solutions_protege on public.ticket_solutions;
create trigger ticket_solutions_protege
  before update on public.ticket_solutions
  for each row execute function public.protege_solucao();

-- 5. ---------------------------------------------------------------------------

drop policy if exists validations_insert_quem_solicita on public.ticket_validations;
create policy validations_insert_quem_solicita on public.ticket_validations
  as restrictive
  for insert
  to authenticated
  with check (
    (public.has_flag(auth.uid(), 'validation_request')
      or public.has_right(auth.uid(), 'validation', 'create'))
    and public.can_see_ticket(ticket_id)
  );

-- O aprovador responde a própria aprovação; quem não tem o direito de editar
-- aprovações não troca chamado, aprovador nem pedido.
create or replace function public.protege_aprovacao()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user <> 'authenticated'
     or public.has_right(auth.uid(), 'validation', 'update') then
    return new;
  end if;

  if new.ticket_id is distinct from old.ticket_id
     or new.approver_user_id is distinct from old.approver_user_id
     or new.approver_group_id is distinct from old.approver_group_id
     or new.requested_by is distinct from old.requested_by
     or new.request_comment is distinct from old.request_comment
     or new.requested_at is distinct from old.requested_at then
    raise exception 'Você só pode responder esta aprovação.';
  end if;
  return new;
end;
$$;

revoke execute on function public.protege_aprovacao() from public, anon, authenticated;

drop trigger if exists ticket_validations_protege on public.ticket_validations;
create trigger ticket_validations_protege
  before update on public.ticket_validations
  for each row execute function public.protege_aprovacao();

-- 6. ---------------------------------------------------------------------------

create or replace function public.perfil_visivel(_pessoa uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select _pessoa = auth.uid()
      or public.is_staff(auth.uid())
      or public.has_right(auth.uid(), 'user', 'read')
      or exists (
        select 1 from public.user_authorizations ua
         where ua.user_id = _pessoa
           and ua.entity_id in (select public.visible_entity_ids(auth.uid()))
      )
      or exists (
        select 1 from public.tickets t
         where t.requester_id = auth.uid()
           and (t.assignee_id = _pessoa
                or exists (select 1 from public.ticket_comments c
                            where c.ticket_id = t.id and c.author_id = _pessoa)
                or exists (select 1 from public.ticket_solutions s
                            where s.ticket_id = t.id and (s.author_id = _pessoa or s.answered_by = _pessoa))
                or exists (select 1 from public.ticket_validations v
                            where v.ticket_id = t.id and (v.requested_by = _pessoa or v.approver_user_id = _pessoa)))
      );
$$;

revoke all on function public.perfil_visivel(uuid) from public, anon;
grant execute on function public.perfil_visivel(uuid) to authenticated;

drop policy if exists profiles_select_all on public.profiles;
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select
  to authenticated
  using (public.perfil_visivel(id));

-- 7. ---------------------------------------------------------------------------

-- O perfil cabe nos direitos de quem está logado: nenhum direito nem opção
-- que essa pessoa não tenha.
create or replace function public.perfil_nao_excede(_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.profile_rights pr
     where pr.profile_id = _profile_id
       and (   (pr.can_read and not public.has_right(auth.uid(), pr.object_key, 'read'))
            or (pr.can_create and not public.has_right(auth.uid(), pr.object_key, 'create'))
            or (pr.can_update and not public.has_right(auth.uid(), pr.object_key, 'update'))
            or (pr.can_delete and not public.has_right(auth.uid(), pr.object_key, 'delete'))
            or (pr.can_purge and not public.has_right(auth.uid(), pr.object_key, 'purge'))
            or (pr.can_read_notes and not public.has_right(auth.uid(), pr.object_key, 'read_notes'))
            or (pr.can_update_notes and not public.has_right(auth.uid(), pr.object_key, 'update_notes')))
  )
  and not exists (
    select 1 from public.profile_flags pf
     where pf.profile_id = _profile_id
       and pf.enabled
       and not public.has_flag(auth.uid(), pf.flag_key)
  );
$$;

revoke all on function public.perfil_nao_excede(uuid) from public, anon;
grant execute on function public.perfil_nao_excede(uuid) to authenticated;

drop policy if exists user_authorizations_sem_escalada_insert on public.user_authorizations;
create policy user_authorizations_sem_escalada_insert on public.user_authorizations
  as restrictive
  for insert
  to authenticated
  with check (public.perfil_nao_excede(profile_id));

drop policy if exists user_authorizations_sem_escalada_update on public.user_authorizations;
create policy user_authorizations_sem_escalada_update on public.user_authorizations
  as restrictive
  for update
  to authenticated
  using (public.perfil_nao_excede(profile_id))
  with check (public.perfil_nao_excede(profile_id));

drop policy if exists user_authorizations_sem_escalada_delete on public.user_authorizations;
create policy user_authorizations_sem_escalada_delete on public.user_authorizations
  as restrictive
  for delete
  to authenticated
  using (public.perfil_nao_excede(profile_id));

-- Pode mexer na conta (senha, e-mail, exclusão) de alguém quem tem o direito
-- em todas as empresas dessa pessoa e todos os perfis dela cabem nos seus.
-- Assim quem cuida das pessoas de uma empresa não troca a senha de um
-- administrador nem de alguém de outra empresa.
create or replace function public.pode_gerenciar_usuario(_alvo uuid, _acao text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select _acao in ('create', 'update', 'delete')
     and public.has_right(auth.uid(), 'user', _acao)
     and not exists (
       select 1 from public.user_authorizations ua
        where ua.user_id = _alvo
          and (not public.has_right_in_entity(auth.uid(), 'user', _acao, ua.entity_id)
               or not public.perfil_nao_excede(ua.profile_id))
     );
$$;

revoke all on function public.pode_gerenciar_usuario(uuid, text) from public, anon;
grant execute on function public.pode_gerenciar_usuario(uuid, text) to authenticated;

-- Pode criar alguém já com este perfil nesta empresa.
create or replace function public.pode_conceder_perfil(_profile_id uuid, _entity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_right_in_entity(auth.uid(), 'user', 'create', _entity_id)
     and public.perfil_nao_excede(_profile_id);
$$;

revoke all on function public.pode_conceder_perfil(uuid, uuid) from public, anon;
grant execute on function public.pode_conceder_perfil(uuid, uuid) to authenticated;

-- 8. ---------------------------------------------------------------------------

revoke execute on function public.sincroniza_assignee_id() from public, anon, authenticated;

-- 9. ---------------------------------------------------------------------------
--
-- As tabelas que pendem do chamado (atores, tarefas, soluções, aprovações,
-- vínculos, custos) têm uma política de escrita "for all" baseada em direito
-- global, e "for all" vale também para leitura. Quem tinha, por exemplo, o
-- direito de editar soluções lia e alterava as soluções de qualquer empresa.
-- Uma política restritiva amarra todas ao chamado que a pessoa enxerga.

do $$
declare
  tabela text;
begin
  foreach tabela in array array['ticket_actors', 'ticket_tasks', 'ticket_solutions',
                                'ticket_links', 'ticket_costs', 'document_tickets']
  loop
    execute format('drop policy if exists %I on public.%I', tabela || '_do_chamado', tabela);
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated
         using (public.can_see_ticket(ticket_id)) with check (public.can_see_ticket(ticket_id))',
      tabela || '_do_chamado', tabela);
  end loop;
end $$;

-- O aprovador pode não ser da equipe do chamado; enxerga a própria aprovação.
drop policy if exists ticket_validations_do_chamado on public.ticket_validations;
create policy ticket_validations_do_chamado on public.ticket_validations
  as restrictive
  for all
  to authenticated
  using (public.can_see_ticket(ticket_id) or approver_user_id = auth.uid())
  with check (public.can_see_ticket(ticket_id) or approver_user_id = auth.uid());

-- Revisões de artigo e membros de grupo seguem o artigo e o grupo, que já
-- respeitam a empresa (a subconsulta roda com o RLS de quem pergunta).
drop policy if exists kb_revisions_do_artigo on public.kb_revisions;
create policy kb_revisions_do_artigo on public.kb_revisions
  as restrictive
  for all
  to authenticated
  using (exists (select 1 from public.kb_articles a where a.id = kb_revisions.article_id))
  with check (exists (select 1 from public.kb_articles a where a.id = kb_revisions.article_id));

drop policy if exists group_members_do_grupo on public.group_members;
create policy group_members_do_grupo on public.group_members
  as restrictive
  for all
  to authenticated
  using (exists (select 1 from public.user_groups g where g.id = group_members.group_id))
  with check (exists (select 1 from public.user_groups g where g.id = group_members.group_id));
