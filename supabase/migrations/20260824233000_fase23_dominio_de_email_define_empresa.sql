-- Fase 23: o domínio do e-mail decide de qual empresa é o chamado.
--
-- O formulário público não tinha como saber a que empresa o chamado pertence:
-- a coluna entity_id caía num default fixo. A alternativa seria um link por
-- empresa, que o solicitante teria que acertar. Usar o domínio do e-mail que
-- ele já é obrigado a informar resolve as duas coisas de uma vez — o destino
-- sai do próprio dado, e domínio não cadastrado nem entra.
--
-- O que esta regra faz: barra o desconhecido. Spam vindo de e-mail aleatório
-- da internet para de criar chamado.
--
-- O que ela NÃO faz: provar identidade. Digitar um endereço não prova ser o
-- dono dele, então quem souber o domínio de um cliente ainda consegue abrir
-- chamado na fila daquele cliente. Fechar isso exige confirmação por link no
-- e-mail, que hoje é impossível: o envio está desligado desde a fase 16, por
-- falta de RESEND_API_KEY. Quando o e-mail for ligado, vale criar o chamado
-- como pendente até a confirmação.
--
-- O domínio é único no sistema inteiro, de propósito: se dois clientes
-- reivindicassem o mesmo domínio, o roteamento seria ambíguo e o chamado
-- cairia numa empresa por sorteio.

create table if not exists public.entity_email_domains (
  id         uuid primary key default gen_random_uuid(),
  entity_id  uuid not null references public.entities(id) on delete cascade,
  domain     text not null,
  created_at timestamptz not null default now(),
  constraint entity_email_domains_dominio_valido
    check (domain = lower(btrim(domain)) and domain like '%.%' and domain not like '%@%')
);

comment on table public.entity_email_domains is
  'Domínios de e-mail que identificam a empresa dona do chamado público.';

create unique index if not exists entity_email_domains_domain_key
  on public.entity_email_domains (domain);

create index if not exists entity_email_domains_entity_idx
  on public.entity_email_domains (entity_id);

alter table public.entity_email_domains enable row level security;

drop policy if exists entity_email_domains_select on public.entity_email_domains;
create policy entity_email_domains_select on public.entity_email_domains
  for select to authenticated
  using (entity_id in (select public.visible_entity_ids(auth.uid())));

drop policy if exists entity_email_domains_write on public.entity_email_domains;
create policy entity_email_domains_write on public.entity_email_domains
  for all to authenticated
  using (public.has_right_in_entity(auth.uid(), 'entity', 'update', entity_id))
  with check (public.has_right_in_entity(auth.uid(), 'entity', 'update', entity_id));

-- Preserva o comportamento atual: os 13 chamados existentes vêm todos deste
-- domínio, e continuam entrando pela mesma porta.
insert into public.entity_email_domains (entity_id, domain)
values ('6a8327c7-a229-4168-ac46-77f58aac2c2b', 'compliancecontabil.com')
on conflict (domain) do nothing;

-- SECURITY DEFINER porque a política roda com as permissões de quem chama, e
-- o papel anon não enxerga entity_email_domains nem entities.
create or replace function public.entidade_por_email_publico(_email text)
returns uuid
language sql
stable
security definer
set search_path = public
as $fn$
  select d.entity_id
    from public.entity_email_domains d
    join public.entities e on e.id = d.entity_id
   where d.domain = lower(btrim(split_part(btrim(_email), '@', 2)))
     and e.accepts_public_tickets
   limit 1;
$fn$;

revoke all on function public.entidade_por_email_publico(text) from public;
grant execute on function public.entidade_por_email_publico(text) to anon, authenticated;

-- A entidade do chamado tem que ser a que o domínio do e-mail aponta. Mesmo
-- que a requisição venha com outro entity_id forjado, o banco recusa.
drop policy if exists tickets_anon_entidade_guard on public.tickets;
create policy tickets_anon_entidade_guard on public.tickets
  as restrictive
  for insert
  to anon
  with check (entity_id = public.entidade_por_email_publico(reporter_email));
