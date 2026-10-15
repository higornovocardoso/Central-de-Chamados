-- Primeira resposta.
--
-- first_response_at existia e aparecia na tela, mas o gatilho que o preenchia
-- saiu na fase 4 e nada o substituiu: ficava sempre vazio. Conta como primeira
-- resposta o primeiro destes sinais de que a equipe pegou o chamado:
--   * o status sai de Novo (assumir, planejar, pôr em pendente, solucionar);
--   * alguém que não é o requerente escreve um acompanhamento público.
-- Nota privada não conta: é conversa interna, quem pediu não vê.

create or replace function public.registra_primeira_resposta()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.first_response_at is null
     and old.status = 'aberto'
     and new.status <> 'aberto' then
    new.first_response_at := now();
  end if;
  return new;
end;
$$;

revoke execute on function public.registra_primeira_resposta() from public, anon, authenticated;

-- Roda depois do prazo e da pausa (ordem alfabética dos nomes, ver fase 27).
create trigger tickets_5_primeira_resposta
  before update on public.tickets
  for each row execute function public.registra_primeira_resposta();

-- SECURITY DEFINER: quem comenta pode não ter direito de alterar o chamado,
-- e o carimbo precisa ser gravado mesmo assim.
create or replace function public.registra_resposta_por_acompanhamento()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not new.is_private then
    update public.tickets
       set first_response_at = new.created_at
     where id = new.ticket_id
       and first_response_at is null
       and requester_id is distinct from new.author_id;
  end if;
  return new;
end;
$$;

revoke execute on function public.registra_resposta_por_acompanhamento() from public, anon, authenticated;

create trigger ticket_comments_primeira_resposta
  after insert on public.ticket_comments
  for each row execute function public.registra_resposta_por_acompanhamento();

-- Preenche os chamados que já existem com o que o histórico mostra: a
-- primeira saída de Novo ou o primeiro acompanhamento público da equipe.
alter table public.tickets disable trigger tickets_updated_at;

update public.tickets t
   set first_response_at = r.quando
  from (
    select t2.id, least(
             (select min(h.created_at) from public.item_history h
               where h.item_type = 'ticket' and h.item_id = t2.id
                 and h.field = 'status' and h.old_value = 'aberto'),
             (select min(c.created_at) from public.ticket_comments c
               where c.ticket_id = t2.id and not c.is_private
                 and c.author_id is distinct from t2.requester_id)
           ) as quando
      from public.tickets t2
     where t2.first_response_at is null
  ) r
 where r.id = t.id and r.quando is not null;

alter table public.tickets enable trigger tickets_updated_at;
