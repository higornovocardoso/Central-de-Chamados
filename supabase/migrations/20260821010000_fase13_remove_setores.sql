-- ============================================================================
-- FASE 13 — Remove Setores
-- "Setor" não existe no GLPI; o mais próximo é Local ou Entidade. Sai a
-- tabela e as chaves que apontavam para ela. Nenhum dado perdido: havia
-- 0 setores cadastrados, 0 chamados e 0 ativos referenciando.
--
-- tickets.reporter_sector FICA. É texto livre preenchido pelo formulário
-- público /abrir-chamado, que não é a mesma coisa e segue em uso — a regra
-- de negócio "Setor informado" aponta para ele.
-- ============================================================================

ALTER TABLE public.tickets DROP COLUMN IF EXISTS sector_id;
ALTER TABLE public.assets  DROP COLUMN IF EXISTS sector_id;

DROP TABLE IF EXISTS public.sectors CASCADE;

-- O gatilho de histórico do chamado listava o campo removido.
CREATE OR REPLACE FUNCTION public.log_ticket_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  watched text[] := ARRAY['title','description','status','type','category','urgency','impact',
                          'priority_level','assignee_id','requester_id','entity_id','asset_id',
                          'location_id','validation_state','is_deleted'];
  before_row jsonb := to_jsonb(OLD);
  after_row jsonb := to_jsonb(NEW);
  f text;
  old_v text;
  new_v text;
BEGIN
  FOREACH f IN ARRAY watched LOOP
    old_v := before_row ->> f;
    new_v := after_row ->> f;
    IF old_v IS DISTINCT FROM new_v THEN
      INSERT INTO public.item_history (item_type, item_id, user_id, field, old_value, new_value)
      VALUES ('ticket', NEW.id, auth.uid(), f, COALESCE(old_v,''), COALESCE(new_v,''));
    END IF;
  END LOOP;
  RETURN NEW;
END; $$;

REVOKE EXECUTE ON FUNCTION public.log_ticket_changes() FROM PUBLIC, anon, authenticated;
