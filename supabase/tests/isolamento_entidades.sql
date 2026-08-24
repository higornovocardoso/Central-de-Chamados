-- Teste de isolamento entre empresas.
--
-- Monta duas empresas de mentira com um usuário cada, põe um chamado e um
-- ativo, e verifica que nenhum dos dois enxerga ou grava no dado do outro.
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
-- O cenário mais forte é "lendo TODOS os chamados do sistema": ele consulta a
-- tabela inteira, sem filtro, e exige que o usuário da empresa de teste veja
-- apenas o próprio. Isso prova o isolamento contra os dados reais que já estão
-- no banco, não só contra os dois registros que o teste criou.
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
  delete from public.assets               where entity_id in (ent_a, ent_b);
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

  insert into public.entities (id, name, parent_id, level, path) values
    (ent_a, 'TESTE Empresa A', null, 0, '/' || ent_a || '/'),
    (ent_b, 'TESTE Empresa B', null, 0, '/' || ent_b || '/');

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

  insert into public.assets (entity_id, name) values (ent_a, 'TESTE ativo da A');

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

  select count(*) into n from public.assets where entity_id = ent_a;
  cenario := 'usuario da B lendo ativo da A';
  esperado := '0'; obtido := n::text; passou := (n = 0); return next;

  perform set_config('role', papel_original, true);
  perform set_config('request.jwt.claims', null, true);

  delete from public.assets               where entity_id in (ent_a, ent_b);
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
  delete from public.assets               where entity_id in (ent_a, ent_b);
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
