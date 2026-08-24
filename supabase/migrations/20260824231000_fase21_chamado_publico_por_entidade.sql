-- Fase 21: o formulário público passa a escolher a empresa, em vez de cair
-- sempre na mesma.
--
-- A política tickets_insert_public valida nome, e-mail, título e status, mas
-- não olha entity_id. Como a coluna tem default fixo apontando para a
-- Compliance, todo chamado de fora caía lá. Com uma empresa só isso passava
-- despercebido; com duas, qualquer pessoa na internet poderia inserir chamado
-- na fila de qualquer cliente, bastando informar o entity_id na requisição.
--
-- Em vez de fixar a Compliance no código, que apenas adiaria o problema, cada
-- entidade passa a declarar se aceita chamado de fora. Uma empresa que atenda
-- só internamente fica com a porta fechada.
--
-- A verificação vai numa função SECURITY DEFINER porque a política roda com as
-- permissões de quem chama: um subselect direto em entities esbarraria na RLS
-- da própria tabela para o papel anon, devolveria falso e bloquearia tudo.

alter table public.entities
  add column if not exists accepts_public_tickets boolean not null default false;

comment on column public.entities.accepts_public_tickets is
  'Se verdadeiro, o formulário público pode abrir chamado nesta entidade.';

-- A Compliance já recebe chamado de fora hoje; manter o comportamento atual.
update public.entities
   set accepts_public_tickets = true
 where id = '6a8327c7-a229-4168-ac46-77f58aac2c2b';

create or replace function public.entidade_aceita_chamado_publico(_entity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select coalesce(
    (select e.accepts_public_tickets from public.entities e where e.id = _entity_id),
    false
  );
$fn$;

revoke all on function public.entidade_aceita_chamado_publico(uuid) from public;
grant execute on function public.entidade_aceita_chamado_publico(uuid) to anon, authenticated;

drop policy if exists tickets_anon_entidade_guard on public.tickets;

create policy tickets_anon_entidade_guard on public.tickets
  as restrictive
  for insert
  to anon
  with check (public.entidade_aceita_chamado_publico(entity_id));
