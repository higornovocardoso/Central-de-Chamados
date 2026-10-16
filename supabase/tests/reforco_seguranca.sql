-- Teste do reforço de segurança (fase 31).
--
-- Cada cenário tenta pela API o que a tela não oferece e confere que o banco
-- segura. Monta duas empresas, um administrador em cada, um solicitante e um
-- gestor de pessoas na A, e apaga tudo ao final, inclusive quando um passo
-- falha no meio.
--
--   select * from public.teste_reforco_seguranca();
--
-- Todas as linhas precisam vir com passou = true.

create or replace function public.teste_reforco_seguranca()
returns table(cenario text, esperado text, obtido text, passou boolean)
language plpgsql
-- SECURITY INVOKER, como o teste de isolamento: precisa trocar de papel.
set search_path = public
as $teste$
declare
  ent_a     uuid := '00000000-0000-4000-a000-0000000000c1';
  ent_b     uuid := '00000000-0000-4000-a000-0000000000c2';
  admin_a   uuid := '00000000-0000-4000-b000-0000000000c1';
  admin_b   uuid := '00000000-0000-4000-b000-0000000000c2';
  solic_a   uuid := '00000000-0000-4000-b000-0000000000c3';
  gestor_a  uuid := '00000000-0000-4000-b000-0000000000c4';
  perfil_gestor uuid := '00000000-0000-4000-c000-0000000000c1';
  perfil_minimo uuid := '00000000-0000-4000-c000-0000000000c2';
  chamado_a uuid := '00000000-0000-4000-d000-0000000000c1';
  chamado_b uuid := '00000000-0000-4000-d000-0000000000c2';
  super_admin uuid;
  self_service uuid;
  comentario uuid;
  solucao uuid;
  n int;
  t record;
  papel_original text := current_user;
begin
  -- Limpeza de uma execução anterior que tenha morrido no meio.
  perform set_config('role', papel_original, true);
  delete from public.tickets             where entity_id in (ent_a, ent_b);
  delete from public.entity_email_domains where entity_id in (ent_a, ent_b);
  delete from public.user_authorizations where user_id in (admin_a, admin_b, solic_a, gestor_a);
  delete from public.profiles            where id in (admin_a, admin_b, solic_a, gestor_a);
  delete from auth.users                 where id in (admin_a, admin_b, solic_a, gestor_a);
  delete from public.access_profiles     where id in (perfil_gestor, perfil_minimo);
  delete from public.entities            where id in (ent_a, ent_b);

  select id into super_admin  from public.access_profiles where name = 'Super-Admin';
  select id into self_service from public.access_profiles where name = 'Self-Service';

  insert into public.entities (id, name, parent_id, level, path, accepts_public_tickets) values
    (ent_a, 'TESTE Reforço A', null, 0, '/' || ent_a || '/', true),
    (ent_b, 'TESTE Reforço B', null, 0, '/' || ent_b || '/', true);
  insert into public.entity_email_domains (entity_id, domain) values (ent_a, 'teste-reforco-a.invalid');

  insert into public.access_profiles (id, name) values
    (perfil_gestor, 'TESTE Gestor de pessoas'),
    (perfil_minimo, 'TESTE Perfil mínimo');
  insert into public.profile_rights (profile_id, object_key, can_read, can_create, can_update, can_delete) values
    (perfil_gestor, 'user', true, true, true, true),
    (perfil_minimo, 'user', true, false, false, false);

  insert into auth.users (id, email, raw_user_meta_data) values
    (admin_a,  'admin-a@reforco.invalid',  '{"full_name":"TESTE Admin A"}'),
    (admin_b,  'admin-b@reforco.invalid',  '{"full_name":"TESTE Admin B"}'),
    (solic_a,  'solic-a@reforco.invalid',  '{"full_name":"TESTE Solicitante A"}'),
    (gestor_a, 'gestor-a@reforco.invalid', '{"full_name":"TESTE Gestor A"}');
  delete from public.user_authorizations where user_id in (admin_a, admin_b, solic_a, gestor_a);
  insert into public.user_authorizations (user_id, profile_id, entity_id, is_recursive) values
    (admin_a,  super_admin,   ent_a, true),
    (admin_b,  super_admin,   ent_b, true),
    (solic_a,  self_service,  ent_a, true),
    (gestor_a, perfil_gestor, ent_a, true);

  insert into public.tickets (id, entity_id, title, requester_id) values
    (chamado_a, ent_a, 'TESTE chamado da A', solic_a),
    (chamado_b, ent_b, 'TESTE chamado da B', null);

  -- Visitante do formulário público -------------------------------------------
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', null, true);

  insert into public.tickets (entity_id, title, reporter_name, reporter_email, status,
                              created_at, assignee_id, priority_manual, closed_at, first_response_at)
  values (ent_a, 'TESTE campos forjados', 'Fulano', 'forjado@teste-reforco-a.invalid', 'aberto',
          '2020-01-01', admin_a, true, now(), now());

  perform set_config('role', papel_original, true);
  select * into t from public.tickets where title = 'TESTE campos forjados';
  cenario := 'publico forjando data, tecnico, prioridade travada e fechamento';
  esperado := 'tudo zerado pelo banco';
  passou := t.created_at > now() - interval '1 minute' and t.assignee_id is null
            and not t.priority_manual and t.closed_at is null and t.first_response_at is null;
  obtido := case when passou then esperado else 'aceitou campo forjado' end;
  return next;

  perform set_config('role', 'anon', true);
  begin
    insert into public.tickets (entity_id, title, description, reporter_name, reporter_email, status)
    values (ent_a, 'TESTE texto gigante', repeat('x', 5000), 'Fulano', 'grande@teste-reforco-a.invalid', 'aberto');
    obtido := 'gravou'; passou := false;
  exception when string_data_right_truncation then
    obtido := 'bloqueado'; passou := true;
  end;
  cenario := 'publico com descricao de 5000 caracteres';
  esperado := 'bloqueado'; return next;

  for n in 1..5 loop
    insert into public.tickets (entity_id, title, reporter_name, reporter_email, status)
    values (ent_a, 'TESTE rajada ' || n, 'Fulano', 'rajada@teste-reforco-a.invalid', 'aberto');
  end loop;
  begin
    insert into public.tickets (entity_id, title, reporter_name, reporter_email, status)
    values (ent_a, 'TESTE rajada 6', 'Fulano', 'rajada@teste-reforco-a.invalid', 'aberto');
    obtido := 'gravou'; passou := false;
  exception when raise_exception then
    obtido := 'bloqueado'; passou := true;
  end;
  cenario := 'sexto chamado do mesmo e-mail em 10 minutos';
  esperado := 'bloqueado'; return next;

  -- Solicitante logado na A ---------------------------------------------------
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', solic_a, 'role', 'authenticated')::text, true);

  insert into public.tickets (entity_id, title, requester_id, assignee_id, created_at)
  values (ent_a, 'TESTE solicitante forjando', solic_a, admin_a, '2020-01-01');
  perform set_config('role', papel_original, true);
  select * into t from public.tickets where title = 'TESTE solicitante forjando';
  cenario := 'solicitante abrindo chamado ja atribuido e com data antiga';
  esperado := 'sem tecnico e com data de agora';
  passou := t.assignee_id is null and t.created_at > now() - interval '1 minute';
  obtido := case when passou then esperado else 'aceitou campo forjado' end;
  return next;

  perform set_config('role', 'authenticated', true);
  begin
    insert into public.ticket_solutions (ticket_id, content, author_id) values (chamado_a, 'TESTE', solic_a);
    obtido := 'gravou'; passou := false;
  exception when insufficient_privilege then
    obtido := 'bloqueado'; passou := true;
  end;
  cenario := 'solicitante registrando solucao no proprio chamado';
  esperado := 'bloqueado'; return next;

  begin
    insert into public.ticket_validations (ticket_id, requested_by, approver_user_id, state)
    values (chamado_a, solic_a, solic_a, 'aprovado');
    obtido := 'gravou'; passou := false;
  exception when insufficient_privilege then
    obtido := 'bloqueado'; passou := true;
  end;
  cenario := 'solicitante criando aprovacao em que ele mesmo aprova';
  esperado := 'bloqueado'; return next;

  insert into public.ticket_comments (ticket_id, author_id, body) values (chamado_a, solic_a, 'TESTE')
  returning id into comentario;
  begin
    update public.ticket_comments set ticket_id = chamado_b where id = comentario;
    obtido := 'moveu'; passou := false;
  exception when raise_exception then
    obtido := 'bloqueado'; passou := true;
  end;
  cenario := 'solicitante movendo acompanhamento para chamado de outra empresa';
  esperado := 'bloqueado'; return next;

  select count(*) into n from public.profiles where id = admin_b;
  cenario := 'solicitante da A lendo o cadastro de pessoa da B';
  esperado := '0'; obtido := n::text; passou := (n = 0); return next;

  select count(*) into n from public.profiles where id = admin_a;
  cenario := 'solicitante da A lendo pessoa da mesma empresa';
  esperado := '1'; obtido := n::text; passou := (n = 1); return next;

  -- Administrador da A registra solução; o solicitante só responde ------------
  perform set_config('request.jwt.claims', json_build_object('sub', admin_a, 'role', 'authenticated')::text, true);
  insert into public.ticket_solutions (ticket_id, content, author_id) values (chamado_a, 'TESTE solução', admin_a)
  returning id into solucao;

  perform set_config('request.jwt.claims', json_build_object('sub', solic_a, 'role', 'authenticated')::text, true);
  begin
    update public.ticket_solutions set content = 'TESTE reescrita' where id = solucao;
    obtido := 'reescreveu'; passou := false;
  exception when raise_exception then
    obtido := 'bloqueado'; passou := true;
  end;
  cenario := 'solicitante reescrevendo a solucao do tecnico';
  esperado := 'bloqueado'; return next;

  begin
    update public.ticket_solutions
       set state = 'aprovada', answered_by = solic_a, answered_at = now(), answer_comment = 'ok'
     where id = solucao;
    get diagnostics n = row_count;
    obtido := case when n = 1 then 'aprovou' else 'nao achou' end; passou := (n = 1);
  exception when others then
    obtido := 'bloqueado'; passou := false;
  end;
  cenario := 'solicitante aprovando a solucao';
  esperado := 'aprovou'; return next;

  -- Técnico da B, com perfil de equipe, olhando a A ---------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', admin_b, 'role', 'authenticated')::text, true);
  cenario := 'equipe da B consultando solucoes de chamado da A';
  select count(*) into n from public.ticket_solutions where ticket_id = chamado_a;
  esperado := '0'; obtido := n::text; passou := (n = 0); return next;

  -- Gestor de pessoas da A -----------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', gestor_a, 'role', 'authenticated')::text, true);

  cenario := 'gestor de pessoas mexendo na conta do administrador';
  esperado := 'false';
  obtido := public.pode_gerenciar_usuario(admin_a, 'update')::text;
  passou := obtido = 'false'; return next;

  cenario := 'gestor de pessoas mexendo em conta de outra empresa';
  esperado := 'false';
  obtido := public.pode_gerenciar_usuario(admin_b, 'update')::text;
  passou := obtido = 'false'; return next;

  cenario := 'gestor de pessoas criando alguem como Super-Admin';
  esperado := 'false';
  obtido := public.pode_conceder_perfil(super_admin, ent_a)::text;
  passou := obtido = 'false'; return next;

  cenario := 'gestor de pessoas criando alguem com perfil menor que o dele';
  esperado := 'true';
  obtido := public.pode_conceder_perfil(perfil_minimo, ent_a)::text;
  passou := obtido = 'true'; return next;

  begin
    insert into public.user_authorizations (user_id, profile_id, entity_id, is_recursive)
    values (gestor_a, super_admin, ent_a, true);
    obtido := 'gravou'; passou := false;
  exception when insufficient_privilege then
    obtido := 'bloqueado'; passou := true;
  end;
  cenario := 'gestor de pessoas se promovendo a Super-Admin';
  esperado := 'bloqueado'; return next;

  -- Limpeza ---------------------------------------------------------------------
  perform set_config('role', papel_original, true);
  perform set_config('request.jwt.claims', null, true);
  delete from public.tickets             where entity_id in (ent_a, ent_b);
  delete from public.entity_email_domains where entity_id in (ent_a, ent_b);
  delete from public.user_authorizations where user_id in (admin_a, admin_b, solic_a, gestor_a);
  delete from public.profiles            where id in (admin_a, admin_b, solic_a, gestor_a);
  delete from auth.users                 where id in (admin_a, admin_b, solic_a, gestor_a);
  delete from public.access_profiles     where id in (perfil_gestor, perfil_minimo);
  delete from public.entities            where id in (ent_a, ent_b);
end;
$teste$;

revoke all on function public.teste_reforco_seguranca() from public, anon, authenticated;
