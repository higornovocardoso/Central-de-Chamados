-- Fase 26: a atribuição volta a aparecer nas listas.
--
-- Havia dois lugares guardando a mesma informação, e ninguém os ligava. A tela
-- do chamado grava o responsável em ticket_actors, no modelo do GLPI, que
-- aceita vários responsáveis por chamado. Já a lista de chamados, o painel, as
-- estatísticas e os relatórios leem tickets.assignee_id — uma coluna que
-- nenhuma tela preenchia.
--
-- O efeito ia além da coluna "Atribuído a" ficar dizendo "Não atribuído": o
-- filtro "Meus chamados" não achava nada, o filtro "Não atribuídos" mostrava
-- tudo, e a carga por técnico do painel contava zero para todo mundo. Eram 15
-- atribuições salvas e invisíveis.
--
-- A escolha aqui foi manter as duas e sincronizá-las por gatilho, em vez de
-- reescrever as quatro telas para lerem ticket_actors. Assim o conserto não
-- toca em nenhuma tela, e o modelo de vários responsáveis segue valendo.
--
-- Limitação conhecida: ticket_actors também aceita atribuir a grupo ou a
-- fornecedor, e assignee_id só guarda usuário. Atribuição só a grupo deixa a
-- coluna nula, e a lista dirá "Não atribuído". Hoje não acontece — os 15
-- registros existentes são todos de usuário — mas no dia que a tela permitir
-- atribuir a grupo, a lista precisa aprender a mostrar isso.

create or replace function public.sincroniza_assignee_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  alvo uuid;
begin
  alvo := coalesce(new.ticket_id, old.ticket_id);

  -- Quando há mais de um responsável, assignee_id fica com o primeiro. É uma
  -- redução com perda, inevitável ao espremer vários numa coluna só; a lista
  -- completa continua em ticket_actors, que é a fonte de verdade.
  update public.tickets t
     set assignee_id = (
           select a.user_id
             from public.ticket_actors a
            where a.ticket_id = alvo
              and a.role = 'atribuido'
              and a.user_id is not null
            order by a.created_at, a.id
            limit 1
         )
   where t.id = alvo;

  return coalesce(new, old);
end;
$fn$;

drop trigger if exists ticket_actors_sincroniza_assignee on public.ticket_actors;

create trigger ticket_actors_sincroniza_assignee
after insert or update or delete on public.ticket_actors
for each row execute function public.sincroniza_assignee_id();

-- Corrige o que já estava gravado. Roda para todos os chamados, não só para os
-- que têm responsável, para que qualquer assignee_id órfão volte a nulo.
update public.tickets t
   set assignee_id = (
         select a.user_id
           from public.ticket_actors a
          where a.ticket_id = t.id
            and a.role = 'atribuido'
            and a.user_id is not null
          order by a.created_at, a.id
          limit 1
       )
 where t.assignee_id is distinct from (
         select a.user_id
           from public.ticket_actors a
          where a.ticket_id = t.id
            and a.role = 'atribuido'
            and a.user_id is not null
          order by a.created_at, a.id
          limit 1
       );
