-- Fase 22: usuário novo não entra mais numa empresa por conta própria.
--
-- handle_new_user concedia a todo usuário recém-criado uma autorização na
-- primeira entidade raiz, com is_recursive = true. Com uma empresa só isso era
-- conveniente. Com várias, significa que ao cadastrar o técnico da Empresa B
-- ele ganharia acesso à Compliance de brinde — um furo no cadastro, não nas
-- políticas, e portanto invisível para o guarda de entidade da fase 20.
--
-- O vínculo automático continua valendo apenas para o primeiro usuário do
-- sistema, que precisa dele para conseguir entrar e configurar o resto. A
-- partir do segundo, quem concede acesso é um administrador, pela tela de
-- usuários — que já envia perfil e entidade explicitamente.
--
-- Não há autocadastro na tela de login: usuários nascem apenas pela tela de
-- administração. Por isso a mudança não deixa ninguém sem acesso por engano.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  primeiro_usuario boolean;
  entidade_raiz uuid;
  perfil_alvo uuid;
begin
  insert into public.profiles (id, full_name, email)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'full_name',
                   new.raw_user_meta_data->>'name',
                   split_part(new.email, '@', 1)),
          coalesce(new.email, ''))
  on conflict (id) do nothing;

  select not exists (select 1 from public.user_authorizations) into primeiro_usuario;

  insert into public.user_roles (user_id, role)
  values (new.id, case when primeiro_usuario then 'admin'::public.app_role
                       else 'usuario'::public.app_role end)
  on conflict do nothing;

  -- Só o primeiro usuário recebe entidade automaticamente. Sem isto não
  -- haveria como entrar no sistema recém-instalado. Do segundo em diante o
  -- acesso é concedido por um administrador, para a empresa certa.
  if primeiro_usuario then
    select id into entidade_raiz
      from public.entities where parent_id is null order by created_at limit 1;
    select id into perfil_alvo
      from public.access_profiles where name = 'Super-Admin';

    if entidade_raiz is not null and perfil_alvo is not null then
      insert into public.user_authorizations (user_id, profile_id, entity_id, is_recursive)
      values (new.id, perfil_alvo, entidade_raiz, true)
      on conflict do nothing;
    end if;
  end if;

  return new;
end;
$function$;
