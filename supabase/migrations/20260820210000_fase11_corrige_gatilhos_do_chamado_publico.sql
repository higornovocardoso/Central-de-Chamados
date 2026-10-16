-- ============================================================================
-- FASE 11 — Correções encontradas ao abrir chamado no papel do anon
--
-- Descoberto testando a rota pública /abrir-chamado contra o banco real:
--
-- 1) apply_service_levels e apply_business_rules eram SECURITY INVOKER e
--    liam sla_policies e business_rules, que o anon não enxerga por RLS.
--    O SELECT voltava vazio, o IF FOUND dava falso e as funções não faziam
--    nada. Resultado: todo chamado aberto pelo formulário público nascia
--    sem prazo de SLA e sem passar por regra de negócio alguma — sem erro,
--    sem aviso. Chamado aberto por usuário logado funcionava, o que
--    escondia o problema.
--
-- 2) Nada criava linha em ticket_actors para chamado novo. A fase 3 apenas
--    migrou os chamados que já existiam; daí em diante a aba Atores ficava
--    vazia para sempre.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.apply_service_levels()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  base timestamptz := COALESCE(NEW.created_at, now());
  sl record;
  pol public.sla_policies%ROWTYPE;
BEGIN
  IF NEW.sla_tto_id IS NOT NULL THEN
    SELECT * INTO sl FROM public.service_levels WHERE id = NEW.sla_tto_id;
    NEW.response_due_at := public.add_working_time(
      base, public.service_level_minutes(NEW.sla_tto_id), sl.calendar_id);
  END IF;

  IF NEW.sla_ttr_id IS NOT NULL THEN
    SELECT * INTO sl FROM public.service_levels WHERE id = NEW.sla_ttr_id;
    NEW.resolution_due_at := public.add_working_time(
      base, public.service_level_minutes(NEW.sla_ttr_id), sl.calendar_id);
  END IF;

  IF NEW.ola_tto_id IS NOT NULL THEN
    SELECT * INTO sl FROM public.service_levels WHERE id = NEW.ola_tto_id;
    NEW.internal_response_due_at := public.add_working_time(
      base, public.service_level_minutes(NEW.ola_tto_id), sl.calendar_id);
  END IF;

  IF NEW.ola_ttr_id IS NOT NULL THEN
    SELECT * INTO sl FROM public.service_levels WHERE id = NEW.ola_ttr_id;
    NEW.internal_resolution_due_at := public.add_working_time(
      base, public.service_level_minutes(NEW.ola_ttr_id), sl.calendar_id);
  END IF;

  IF NEW.sla_ttr_id IS NULL AND NEW.resolution_due_at IS NULL THEN
    SELECT * INTO pol FROM public.sla_policies WHERE priority = NEW.priority;
    IF FOUND THEN
      NEW.response_due_at := base + make_interval(mins => pol.response_minutes);
      NEW.resolution_due_at := base + make_interval(mins => pol.resolution_minutes);
    END IF;
  END IF;

  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.apply_business_rules()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  rec jsonb := to_jsonb(NEW);
  rule record;
  crit record;
  act record;
  field_value text;
  matched boolean;
  any_matched boolean;
  recalc boolean := false;
BEGIN
  FOR rule IN
    SELECT * FROM public.business_rules
     WHERE is_active
       AND ((TG_OP = 'INSERT' AND run_on_add) OR (TG_OP = 'UPDATE' AND run_on_update))
     ORDER BY sort, created_at
  LOOP
    matched := true;
    any_matched := false;

    FOR crit IN SELECT * FROM public.rule_criteria WHERE rule_id = rule.id LOOP
      field_value := COALESCE(rec ->> crit.field, '');

      IF (CASE crit.operator
           WHEN 'contem' THEN field_value ILIKE '%' || crit.value || '%'
           WHEN 'nao_contem' THEN field_value NOT ILIKE '%' || crit.value || '%'
           WHEN 'igual' THEN field_value = crit.value
           WHEN 'diferente' THEN field_value <> crit.value
           WHEN 'comeca_com' THEN field_value ILIKE crit.value || '%'
           WHEN 'termina_com' THEN field_value ILIKE '%' || crit.value
           WHEN 'regex' THEN field_value ~ crit.value
           WHEN 'nao_regex' THEN field_value !~ crit.value
           ELSE false
         END)
      THEN
        any_matched := true;
      ELSE
        matched := false;
      END IF;
    END LOOP;

    IF rule.match_mode = 'or' THEN
      matched := any_matched;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.rule_criteria WHERE rule_id = rule.id) THEN
      matched := false;
    END IF;

    IF matched THEN
      FOR act IN SELECT * FROM public.rule_actions WHERE rule_id = rule.id LOOP
        IF act.field = 'recalcular_prioridade' THEN
          recalc := true;
        ELSIF act.value = '' THEN
          rec := jsonb_set(rec, ARRAY[act.field], 'null'::jsonb);
        ELSE
          rec := jsonb_set(rec, ARRAY[act.field], to_jsonb(act.value));
        END IF;
      END LOOP;
    END IF;
  END LOOP;

  NEW := jsonb_populate_record(NEW, rec);

  IF recalc THEN
    NEW.priority_manual := false;
    NEW.priority_level := public.compute_priority(NEW.urgency, NEW.impact);
  END IF;

  RETURN NEW;
END; $$;

-- O requerente e o responsável entram na aba Atores sozinhos, como no GLPI.
CREATE OR REPLACE FUNCTION public.sync_ticket_actors()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.requester_id IS NOT NULL THEN
    INSERT INTO public.ticket_actors (ticket_id, role, user_id)
    SELECT NEW.id, 'requerente', NEW.requester_id
     WHERE NOT EXISTS (
       SELECT 1 FROM public.ticket_actors a
        WHERE a.ticket_id = NEW.id AND a.role = 'requerente'
          AND a.user_id = NEW.requester_id);

  ELSIF length(trim(COALESCE(NEW.reporter_email, ''))) > 0 THEN
    INSERT INTO public.ticket_actors (ticket_id, role, alternative_email)
    SELECT NEW.id, 'requerente', NEW.reporter_email
     WHERE NOT EXISTS (
       SELECT 1 FROM public.ticket_actors a
        WHERE a.ticket_id = NEW.id AND a.role = 'requerente'
          AND a.alternative_email = NEW.reporter_email);
  END IF;

  IF NEW.assignee_id IS NOT NULL THEN
    INSERT INTO public.ticket_actors (ticket_id, role, user_id)
    SELECT NEW.id, 'atribuido', NEW.assignee_id
     WHERE NOT EXISTS (
       SELECT 1 FROM public.ticket_actors a
        WHERE a.ticket_id = NEW.id AND a.role = 'atribuido'
          AND a.user_id = NEW.assignee_id);
  END IF;

  -- Ao trocar de responsável, o anterior deixa de ser ator.
  IF TG_OP = 'UPDATE'
     AND OLD.assignee_id IS NOT NULL
     AND OLD.assignee_id IS DISTINCT FROM NEW.assignee_id THEN
    DELETE FROM public.ticket_actors
     WHERE ticket_id = NEW.id AND role = 'atribuido' AND user_id = OLD.assignee_id;
  END IF;

  RETURN NULL;
END; $$;

CREATE TRIGGER tickets_sync_actors
AFTER INSERT OR UPDATE OF requester_id, assignee_id, reporter_email ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.sync_ticket_actors();

-- Função de gatilho não precisa de EXECUTE, e SECURITY DEFINER exposta por
-- RPC foi exatamente o problema que a fase 9 fechou.
REVOKE EXECUTE ON FUNCTION public.apply_service_levels() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_business_rules() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_ticket_actors() FROM PUBLIC, anon, authenticated;
