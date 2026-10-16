-- ============================================================================
-- FASE 4 — SLA, calendários, regras de negócio, notificações e automação
-- Calendários com expediente e feriados, SLA e OLA com TTO/TTR e níveis de
-- escalonamento, congelamento em Pendente, motor de regras de negócio,
-- notificações com modelos e fila, coletor de e-mail, chamados recorrentes,
-- pesquisa de satisfação e ações automáticas.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- CALENDÁRIOS
-- ---------------------------------------------------------------------------

CREATE TABLE public.calendars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  is_recursive boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  comment text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Faixas de expediente. weekday segue o extract(dow): 0 = domingo.
CREATE TABLE public.calendar_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_id uuid NOT NULL REFERENCES public.calendars(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  begin_time time NOT NULL,
  end_time time NOT NULL,
  CHECK (end_time > begin_time)
);

CREATE INDEX idx_calendar_segments_calendar ON public.calendar_segments(calendar_id);

-- Períodos de fechamento. Recorrente ignora o ano, para feriados fixos.
CREATE TABLE public.calendar_holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_id uuid REFERENCES public.calendars(id) ON DELETE CASCADE,
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_recurring boolean NOT NULL DEFAULT false,
  CHECK (end_date >= start_date)
);

CREATE INDEX idx_calendar_holidays_calendar ON public.calendar_holidays(calendar_id);

-- Calendário comercial padrão, 8h às 18h de segunda a sexta.
DO $$
DECLARE
  root_entity uuid;
  cal uuid;
BEGIN
  SELECT id INTO root_entity FROM public.entities WHERE parent_id IS NULL ORDER BY created_at LIMIT 1;

  INSERT INTO public.calendars (name, entity_id, is_default, comment)
  VALUES ('Comercial (8h-18h)', root_entity, true, 'Segunda a sexta, das 8h às 18h')
  RETURNING id INTO cal;

  INSERT INTO public.calendar_segments (calendar_id, weekday, begin_time, end_time)
  SELECT cal, d, '08:00'::time, '12:00'::time FROM generate_series(1,5) AS d;
  INSERT INTO public.calendar_segments (calendar_id, weekday, begin_time, end_time)
  SELECT cal, d, '13:00'::time, '18:00'::time FROM generate_series(1,5) AS d;

  INSERT INTO public.calendar_holidays (calendar_id, name, start_date, end_date, is_recurring) VALUES
    (cal, 'Confraternização Universal', '2026-01-01', '2026-01-01', true),
    (cal, 'Tiradentes', '2026-04-21', '2026-04-21', true),
    (cal, 'Dia do Trabalho', '2026-05-01', '2026-05-01', true),
    (cal, 'Independência', '2026-09-07', '2026-09-07', true),
    (cal, 'Nossa Senhora Aparecida', '2026-10-12', '2026-10-12', true),
    (cal, 'Finados', '2026-11-02', '2026-11-02', true),
    (cal, 'Proclamação da República', '2026-11-15', '2026-11-15', true),
    (cal, 'Natal', '2026-12-25', '2026-12-25', true);
END $$;

/**
 * Soma minutos úteis a uma data, respeitando as faixas de expediente e os
 * feriados do calendário. Sem calendário, a conta é corrida (24x7), que é
 * exatamente o comportamento do GLPI quando nenhum calendário é associado.
 */
CREATE OR REPLACE FUNCTION public.add_working_time(
  _start timestamptz,
  _minutes integer,
  _calendar uuid
) RETURNS timestamptz
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE
  tz constant text := 'America/Sao_Paulo';
  remaining integer := _minutes;
  cursor_local timestamp := (_start AT TIME ZONE tz);
  day_cursor date;
  seg record;
  seg_begin timestamp;
  seg_end timestamp;
  available integer;
  guard integer := 0;
BEGIN
  IF _calendar IS NULL OR _minutes IS NULL OR _minutes <= 0 THEN
    RETURN _start + make_interval(mins => COALESCE(_minutes, 0));
  END IF;

  day_cursor := cursor_local::date;

  WHILE remaining > 0 LOOP
    guard := guard + 1;
    IF guard > 400 THEN
      -- Calendário sem expediente algum: devolve a conta corrida.
      RETURN _start + make_interval(mins => _minutes);
    END IF;

    -- Feriado ou fechamento pula o dia inteiro.
    IF EXISTS (
      SELECT 1 FROM public.calendar_holidays h
       WHERE h.calendar_id = _calendar
         AND (
           (NOT h.is_recurring AND day_cursor BETWEEN h.start_date AND h.end_date)
           OR (h.is_recurring
               AND to_char(day_cursor,'MM-DD') BETWEEN to_char(h.start_date,'MM-DD')
                                                   AND to_char(h.end_date,'MM-DD'))
         )
    ) THEN
      day_cursor := day_cursor + 1;
      cursor_local := day_cursor::timestamp;
      CONTINUE;
    END IF;

    FOR seg IN
      SELECT begin_time, end_time
        FROM public.calendar_segments
       WHERE calendar_id = _calendar
         AND weekday = extract(dow FROM day_cursor)::smallint
       ORDER BY begin_time
    LOOP
      seg_begin := day_cursor + seg.begin_time;
      seg_end := day_cursor + seg.end_time;

      IF cursor_local > seg_end THEN
        CONTINUE;
      END IF;
      IF cursor_local < seg_begin THEN
        cursor_local := seg_begin;
      END IF;

      available := EXTRACT(EPOCH FROM (seg_end - cursor_local))::integer / 60;
      IF available >= remaining THEN
        RETURN (cursor_local + make_interval(mins => remaining)) AT TIME ZONE tz;
      END IF;

      remaining := remaining - available;
      cursor_local := seg_end;
    END LOOP;

    day_cursor := day_cursor + 1;
    cursor_local := day_cursor::timestamp;
  END LOOP;

  RETURN cursor_local AT TIME ZONE tz;
END; $$;

-- ---------------------------------------------------------------------------
-- NÍVEIS DE SERVIÇO: SLA e OLA
-- ---------------------------------------------------------------------------

CREATE TYPE public.service_level_kind AS ENUM ('sla','ola');
CREATE TYPE public.service_level_target AS ENUM ('tto','ttr');
CREATE TYPE public.duration_unit AS ENUM ('minuto','hora','dia');

CREATE TABLE public.service_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind public.service_level_kind NOT NULL DEFAULT 'sla',
  target public.service_level_target NOT NULL DEFAULT 'ttr',
  duration_value integer NOT NULL DEFAULT 4,
  duration_unit public.duration_unit NOT NULL DEFAULT 'hora',
  end_of_working_day boolean NOT NULL DEFAULT false,
  calendar_id uuid REFERENCES public.calendars(id) ON DELETE SET NULL,
  entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  is_recursive boolean NOT NULL DEFAULT true,
  comment text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.service_level_minutes(_id uuid)
RETURNS integer LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT CASE duration_unit
           WHEN 'minuto' THEN duration_value
           WHEN 'hora' THEN duration_value * 60
           ELSE duration_value * 24 * 60
         END
    FROM public.service_levels WHERE id = _id;
$$;

CREATE TABLE public.escalation_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_level_id uuid NOT NULL REFERENCES public.service_levels(id) ON DELETE CASCADE,
  name text NOT NULL,
  -- negativo dispara antes do vencimento, positivo depois
  offset_minutes integer NOT NULL DEFAULT -60,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.escalation_criteria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level_id uuid NOT NULL REFERENCES public.escalation_levels(id) ON DELETE CASCADE,
  field text NOT NULL,
  operator text NOT NULL DEFAULT 'igual',
  value text NOT NULL DEFAULT ''
);

CREATE TABLE public.escalation_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level_id uuid NOT NULL REFERENCES public.escalation_levels(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  field text NOT NULL DEFAULT '',
  value text NOT NULL DEFAULT ''
);

-- Registra o que já foi disparado, para não repetir.
CREATE TABLE public.escalation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  level_id uuid NOT NULL REFERENCES public.escalation_levels(id) ON DELETE CASCADE,
  executed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ticket_id, level_id)
);

-- Níveis padrão a partir das políticas por prioridade da fase 1.
DO $$
DECLARE
  root_entity uuid;
  cal uuid;
BEGIN
  SELECT id INTO root_entity FROM public.entities WHERE parent_id IS NULL ORDER BY created_at LIMIT 1;
  SELECT id INTO cal FROM public.calendars WHERE is_default ORDER BY created_at LIMIT 1;

  INSERT INTO public.service_levels (name, kind, target, duration_value, duration_unit, calendar_id, entity_id, comment)
  VALUES
    ('Resposta em 1 hora', 'sla', 'tto', 1, 'hora', cal, root_entity, 'Prazo padrão de atendimento'),
    ('Solução em 8 horas', 'sla', 'ttr', 8, 'hora', cal, root_entity, 'Prazo padrão de solução'),
    ('Solução urgente em 4 horas', 'sla', 'ttr', 4, 'hora', cal, root_entity, 'Para chamados de prioridade alta'),
    ('Repasse interno em 30 minutos', 'ola', 'tto', 30, 'minuto', cal, root_entity, 'Acordo entre times internos');
END $$;

-- ---------------------------------------------------------------------------
-- O CHAMADO E O SLA
-- ---------------------------------------------------------------------------

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS sla_tto_id uuid REFERENCES public.service_levels(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sla_ttr_id uuid REFERENCES public.service_levels(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ola_tto_id uuid REFERENCES public.service_levels(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ola_ttr_id uuid REFERENCES public.service_levels(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS internal_response_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS internal_resolution_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS waiting_seconds integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pending_since timestamptz;

/**
 * Recalcula os prazos a partir dos níveis de serviço associados.
 * Sem nível associado, mantém o comportamento antigo por prioridade.
 */
CREATE OR REPLACE FUNCTION public.apply_service_levels()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
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

  -- Sem SLA associado, o prazo antigo por prioridade continua valendo.
  IF NEW.sla_ttr_id IS NULL AND NEW.resolution_due_at IS NULL THEN
    SELECT * INTO pol FROM public.sla_policies WHERE priority = NEW.priority;
    IF FOUND THEN
      NEW.response_due_at := base + make_interval(mins => pol.response_minutes);
      NEW.resolution_due_at := base + make_interval(mins => pol.resolution_minutes);
    END IF;
  END IF;

  RETURN NEW;
END; $$;

-- Substitui os gatilhos da fase 1, que só sabiam de prioridade.
DROP TRIGGER IF EXISTS tickets_apply_sla_insert ON public.tickets;
DROP TRIGGER IF EXISTS tickets_apply_sla_update ON public.tickets;

CREATE TRIGGER tickets_apply_service_levels
BEFORE INSERT OR UPDATE OF sla_tto_id, sla_ttr_id, ola_tto_id, ola_ttr_id, priority
ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.apply_service_levels();

/**
 * Pendente congela o SLA: ao sair de Pendente, o tempo parado é somado aos
 * prazos, como o GLPI faz.
 */
CREATE OR REPLACE FUNCTION public.freeze_sla_on_pending()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  frozen integer;
BEGIN
  IF NEW.status = 'aguardando' AND OLD.status <> 'aguardando' THEN
    NEW.pending_since := now();

  ELSIF OLD.status = 'aguardando' AND NEW.status <> 'aguardando' AND OLD.pending_since IS NOT NULL THEN
    frozen := GREATEST(0, EXTRACT(EPOCH FROM (now() - OLD.pending_since))::integer);
    NEW.waiting_seconds := COALESCE(OLD.waiting_seconds, 0) + frozen;
    NEW.pending_since := NULL;

    IF NEW.response_due_at IS NOT NULL AND NEW.first_response_at IS NULL THEN
      NEW.response_due_at := NEW.response_due_at + make_interval(secs => frozen);
    END IF;
    IF NEW.resolution_due_at IS NOT NULL THEN
      NEW.resolution_due_at := NEW.resolution_due_at + make_interval(secs => frozen);
    END IF;
    IF NEW.internal_resolution_due_at IS NOT NULL THEN
      NEW.internal_resolution_due_at := NEW.internal_resolution_due_at + make_interval(secs => frozen);
    END IF;
  END IF;

  RETURN NEW;
END; $$;

CREATE TRIGGER tickets_freeze_sla
BEFORE UPDATE OF status ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.freeze_sla_on_pending();

-- ---------------------------------------------------------------------------
-- REGRAS DE NEGÓCIO
-- ---------------------------------------------------------------------------

CREATE TABLE public.business_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  is_recursive boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  match_mode text NOT NULL DEFAULT 'and' CHECK (match_mode IN ('and','or')),
  run_on_add boolean NOT NULL DEFAULT true,
  run_on_update boolean NOT NULL DEFAULT false,
  sort integer NOT NULL DEFAULT 100,
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.rule_criteria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL REFERENCES public.business_rules(id) ON DELETE CASCADE,
  field text NOT NULL,
  operator text NOT NULL DEFAULT 'contem',
  value text NOT NULL DEFAULT ''
);

CREATE TABLE public.rule_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL REFERENCES public.business_rules(id) ON DELETE CASCADE,
  field text NOT NULL,
  value text NOT NULL DEFAULT ''
);

CREATE INDEX idx_rule_criteria_rule ON public.rule_criteria(rule_id);
CREATE INDEX idx_rule_actions_rule ON public.rule_actions(rule_id);

/**
 * Motor de regras. Roda na abertura e, quando marcado, na alteração.
 * O resultado de uma regra entra na avaliação da próxima, como no GLPI.
 */
CREATE OR REPLACE FUNCTION public.apply_business_rules()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
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

-- Roda antes do gatilho de prioridade, para que o recálculo pegue o resultado.
CREATE TRIGGER tickets_business_rules
BEFORE INSERT OR UPDATE ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.apply_business_rules();

-- ---------------------------------------------------------------------------
-- NOTIFICAÇÕES
-- ---------------------------------------------------------------------------

CREATE TABLE public.notification_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subject text NOT NULL DEFAULT '',
  body_text text NOT NULL DEFAULT '',
  body_html text NOT NULL DEFAULT '',
  comment text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  item_type text NOT NULL DEFAULT 'ticket',
  event text NOT NULL,
  template_id uuid REFERENCES public.notification_templates(id) ON DELETE SET NULL,
  entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.notification_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  -- requerente, observador, atribuido, grupo_atribuido, administrador,
  -- redator, aprovador, perfil, usuario
  recipient_type text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id uuid REFERENCES public.user_groups(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES public.access_profiles(id) ON DELETE CASCADE
);

CREATE TYPE public.queue_state AS ENUM ('pendente','enviado','erro');

CREATE TABLE public.notification_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid REFERENCES public.notifications(id) ON DELETE SET NULL,
  ticket_id uuid REFERENCES public.tickets(id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  recipient_name text NOT NULL DEFAULT '',
  subject text NOT NULL,
  body_text text NOT NULL DEFAULT '',
  body_html text NOT NULL DEFAULT '',
  state public.queue_state NOT NULL DEFAULT 'pendente',
  error text NOT NULL DEFAULT '',
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

CREATE INDEX idx_notification_queue_state ON public.notification_queue(state, created_at);

-- Configuração de notificação por entidade.
ALTER TABLE public.entities
  ADD COLUMN IF NOT EXISTS admin_email text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS admin_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS sender_email text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS sender_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS reply_to text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS notification_prefix text NOT NULL DEFAULT '[Helpdesk]',
  ADD COLUMN IF NOT EXISTS email_signature text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS notifications_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS calendar_id uuid REFERENCES public.calendars(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS default_ticket_type public.ticket_type NOT NULL DEFAULT 'incidente',
  ADD COLUMN IF NOT EXISTS auto_assign_mode text NOT NULL DEFAULT 'nenhum',
  ADD COLUMN IF NOT EXISTS auto_close_days integer NOT NULL DEFAULT -1,
  ADD COLUMN IF NOT EXISTS auto_purge_days integer NOT NULL DEFAULT -1,
  ADD COLUMN IF NOT EXISTS survey_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS survey_delay_days integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS survey_rate integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS survey_max_score integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS survey_comment_below integer NOT NULL DEFAULT 3;

-- Modelos e notificações padrão.
DO $$
DECLARE
  root_entity uuid;
  t_new uuid;
  t_followup uuid;
  t_solved uuid;
  t_validation uuid;
  n uuid;
BEGIN
  SELECT id INTO root_entity FROM public.entities WHERE parent_id IS NULL ORDER BY created_at LIMIT 1;

  INSERT INTO public.notification_templates (name, subject, body_text) VALUES
    ('Chamado aberto', '##prefixo## Chamado ##numero## aberto: ##titulo##',
     E'Olá ##destinatario##,\n\nO chamado ##numero## foi aberto.\n\nTítulo: ##titulo##\nTipo: ##tipo##\nPrioridade: ##prioridade##\nRequerente: ##requerente##\nPrazo de solução: ##prazo##\n\nDescrição:\n##descricao##\n\n##assinatura##')
    RETURNING id INTO t_new;

  INSERT INTO public.notification_templates (name, subject, body_text) VALUES
    ('Novo acompanhamento', '##prefixo## Chamado ##numero##: novo acompanhamento',
     E'Olá ##destinatario##,\n\nO chamado ##numero## (##titulo##) recebeu um acompanhamento.\n\n##conteudo##\n\n##assinatura##')
    RETURNING id INTO t_followup;

  INSERT INTO public.notification_templates (name, subject, body_text) VALUES
    ('Chamado solucionado', '##prefixo## Chamado ##numero## solucionado',
     E'Olá ##destinatario##,\n\nO chamado ##numero## (##titulo##) foi marcado como solucionado.\n\nSolução:\n##conteudo##\n\nSe a solução resolveu, aprove no sistema para fechar o chamado.\n\n##assinatura##')
    RETURNING id INTO t_solved;

  INSERT INTO public.notification_templates (name, subject, body_text) VALUES
    ('Pedido de aprovação', '##prefixo## Aprovação pendente no chamado ##numero##',
     E'Olá ##destinatario##,\n\nSua aprovação foi solicitada no chamado ##numero## (##titulo##).\n\n##conteudo##\n\n##assinatura##')
    RETURNING id INTO t_validation;

  INSERT INTO public.notifications (name, event, template_id, entity_id)
  VALUES ('Chamado aberto', 'ticket_criado', t_new, root_entity) RETURNING id INTO n;
  INSERT INTO public.notification_recipients (notification_id, recipient_type)
  VALUES (n, 'requerente'), (n, 'atribuido'), (n, 'administrador');

  INSERT INTO public.notifications (name, event, template_id, entity_id)
  VALUES ('Novo acompanhamento', 'acompanhamento_adicionado', t_followup, root_entity) RETURNING id INTO n;
  INSERT INTO public.notification_recipients (notification_id, recipient_type)
  VALUES (n, 'requerente'), (n, 'atribuido'), (n, 'observador');

  INSERT INTO public.notifications (name, event, template_id, entity_id)
  VALUES ('Chamado solucionado', 'ticket_solucionado', t_solved, root_entity) RETURNING id INTO n;
  INSERT INTO public.notification_recipients (notification_id, recipient_type)
  VALUES (n, 'requerente');

  INSERT INTO public.notifications (name, event, template_id, entity_id)
  VALUES ('Pedido de aprovação', 'aprovacao_solicitada', t_validation, root_entity) RETURNING id INTO n;
  INSERT INTO public.notification_recipients (notification_id, recipient_type)
  VALUES (n, 'aprovador');
END $$;

/**
 * Monta e enfileira as mensagens de um evento. As etiquetas ##campo## são
 * trocadas aqui; quem envia de verdade é a edge function send-notifications.
 */
CREATE OR REPLACE FUNCTION public.enqueue_notification(
  _event text,
  _ticket_id uuid,
  _content text DEFAULT ''
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t record;
  ent record;
  notif record;
  tpl record;
  rcpt record;
  target record;
  subject text;
  body text;
BEGIN
  SELECT * INTO t FROM public.tickets WHERE id = _ticket_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT * INTO ent FROM public.entities WHERE id = t.entity_id;
  IF NOT FOUND OR NOT ent.notifications_enabled THEN RETURN; END IF;

  FOR notif IN
    SELECT * FROM public.notifications
     WHERE is_active AND event = _event AND item_type = 'ticket'
  LOOP
    SELECT * INTO tpl FROM public.notification_templates WHERE id = notif.template_id;
    IF NOT FOUND THEN CONTINUE; END IF;

    FOR rcpt IN SELECT * FROM public.notification_recipients WHERE notification_id = notif.id LOOP
      FOR target IN
        SELECT DISTINCT email, name FROM (
          -- requerente registrado ou o e-mail do formulário público
          SELECT p.email, p.full_name AS name
            FROM public.profiles p
           WHERE rcpt.recipient_type = 'requerente' AND p.id = t.requester_id
          UNION ALL
          SELECT t.reporter_email, t.reporter_name
           WHERE rcpt.recipient_type = 'requerente'
             AND t.requester_id IS NULL
             AND length(trim(t.reporter_email)) > 0
          UNION ALL
          SELECT p.email, p.full_name
            FROM public.profiles p
           WHERE rcpt.recipient_type = 'atribuido' AND p.id = t.assignee_id
          UNION ALL
          SELECT p.email, p.full_name
            FROM public.ticket_actors a
            JOIN public.profiles p ON p.id = a.user_id
           WHERE rcpt.recipient_type = 'observador'
             AND a.ticket_id = t.id AND a.role = 'observador'
          UNION ALL
          SELECT p.email, p.full_name
            FROM public.ticket_validations v
            JOIN public.profiles p ON p.id = v.approver_user_id
           WHERE rcpt.recipient_type = 'aprovador'
             AND v.ticket_id = t.id AND v.state = 'aguardando'
          UNION ALL
          SELECT p.email, p.full_name
            FROM public.group_members gm
            JOIN public.profiles p ON p.id = gm.user_id
           WHERE rcpt.recipient_type = 'grupo' AND gm.group_id = rcpt.group_id
          UNION ALL
          SELECT p.email, p.full_name
            FROM public.user_authorizations ua
            JOIN public.profiles p ON p.id = ua.user_id
           WHERE rcpt.recipient_type = 'perfil' AND ua.profile_id = rcpt.profile_id
          UNION ALL
          SELECT p.email, p.full_name
            FROM public.profiles p
           WHERE rcpt.recipient_type = 'usuario' AND p.id = rcpt.user_id
          UNION ALL
          SELECT ent.admin_email, ent.admin_name
           WHERE rcpt.recipient_type = 'administrador' AND length(trim(ent.admin_email)) > 0
        ) AS r(email, name)
        WHERE length(trim(COALESCE(email,''))) > 0
      LOOP
        subject := tpl.subject;
        body := tpl.body_text;

        subject := replace(subject, '##prefixo##', ent.notification_prefix);
        subject := replace(subject, '##numero##', '#' || upper(left(t.id::text, 8)));
        subject := replace(subject, '##titulo##', t.title);

        body := replace(body, '##destinatario##', COALESCE(target.name, ''));
        body := replace(body, '##prefixo##', ent.notification_prefix);
        body := replace(body, '##numero##', '#' || upper(left(t.id::text, 8)));
        body := replace(body, '##titulo##', t.title);
        body := replace(body, '##descricao##', COALESCE(t.description, ''));
        body := replace(body, '##tipo##', t.type::text);
        body := replace(body, '##prioridade##', COALESCE(t.priority_level::text, ''));
        body := replace(body, '##requerente##',
                        COALESCE((SELECT full_name FROM public.profiles WHERE id = t.requester_id),
                                 t.reporter_name, ''));
        body := replace(body, '##prazo##', COALESCE(to_char(t.resolution_due_at, 'DD/MM/YYYY HH24:MI'), '—'));
        body := replace(body, '##conteudo##', COALESCE(_content, ''));
        body := replace(body, '##assinatura##', ent.email_signature);

        INSERT INTO public.notification_queue
          (notification_id, ticket_id, recipient_email, recipient_name, subject, body_text)
        VALUES (notif.id, t.id, target.email, COALESCE(target.name,''), subject, body);
      END LOOP;
    END LOOP;
  END LOOP;
END; $$;

-- Gatilhos que disparam os eventos.
CREATE OR REPLACE FUNCTION public.notify_ticket_events()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.enqueue_notification('ticket_criado', NEW.id, '');
  ELSIF NEW.status = 'resolvido' AND OLD.status <> 'resolvido' THEN
    PERFORM public.enqueue_notification('ticket_solucionado', NEW.id, '');
  ELSIF NEW.status = 'fechado' AND OLD.status <> 'fechado' THEN
    PERFORM public.enqueue_notification('ticket_fechado', NEW.id, '');
  END IF;
  RETURN NULL;
END; $$;

CREATE TRIGGER tickets_notify
AFTER INSERT OR UPDATE OF status ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.notify_ticket_events();

CREATE OR REPLACE FUNCTION public.notify_followup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT NEW.is_private THEN
    PERFORM public.enqueue_notification('acompanhamento_adicionado', NEW.ticket_id, NEW.body);
  END IF;
  RETURN NULL;
END; $$;

CREATE TRIGGER comments_notify
AFTER INSERT ON public.ticket_comments
FOR EACH ROW EXECUTE FUNCTION public.notify_followup();

CREATE OR REPLACE FUNCTION public.notify_validation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.enqueue_notification('aprovacao_solicitada', NEW.ticket_id, NEW.request_comment);
  RETURN NULL;
END; $$;

CREATE TRIGGER validations_notify
AFTER INSERT ON public.ticket_validations
FOR EACH ROW EXECUTE FUNCTION public.notify_validation();

-- ---------------------------------------------------------------------------
-- COLETOR DE E-MAIL
-- ---------------------------------------------------------------------------

CREATE TABLE public.mail_collectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  inbound_address text NOT NULL DEFAULT '',
  secret_token text NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  default_type public.ticket_type NOT NULL DEFAULT 'incidente',
  default_category_id uuid REFERENCES public.itil_categories(id) ON DELETE SET NULL,
  default_source_id uuid REFERENCES public.request_sources(id) ON DELETE SET NULL,
  comment text NOT NULL DEFAULT '',
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.collector_blacklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'email',
  value text NOT NULL,
  comment text NOT NULL DEFAULT ''
);

-- ---------------------------------------------------------------------------
-- CHAMADOS RECORRENTES
-- ---------------------------------------------------------------------------

CREATE TABLE public.recurrent_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  type public.ticket_type NOT NULL DEFAULT 'incidente',
  category_id uuid REFERENCES public.itil_categories(id) ON DELETE SET NULL,
  urgency smallint NOT NULL DEFAULT 3,
  impact smallint NOT NULL DEFAULT 3,
  assignee_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  periodicity_minutes integer NOT NULL DEFAULT 10080,
  anticipation_minutes integer NOT NULL DEFAULT 0,
  start_date timestamptz NOT NULL DEFAULT now(),
  end_date timestamptz,
  calendar_id uuid REFERENCES public.calendars(id) ON DELETE SET NULL,
  last_created_at timestamptz,
  next_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- PESQUISA DE SATISFAÇÃO
-- ---------------------------------------------------------------------------

CREATE TABLE public.satisfaction_surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE UNIQUE,
  score smallint CHECK (score BETWEEN 0 AND 10),
  comment text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  answered_at timestamptz
);

-- ---------------------------------------------------------------------------
-- AÇÕES AUTOMÁTICAS
-- ---------------------------------------------------------------------------

CREATE TABLE public.automatic_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  frequency_minutes integer NOT NULL DEFAULT 60,
  is_active boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  last_result text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.automatic_actions (code, name, description, frequency_minutes) VALUES
  ('fechar_chamados','Fechamento automático','Leva de Solucionado para Fechado depois do prazo da entidade',60),
  ('purgar_chamados','Purga da lixeira','Apaga em definitivo os chamados fechados depois do prazo',1440),
  ('alertar_nao_resolvidos','Alerta de chamados parados','Avisa sobre chamados sem solução há muito tempo',1440),
  ('chamados_recorrentes','Chamados recorrentes','Cria os chamados programados',60),
  ('pesquisa_satisfacao','Pesquisa de satisfação','Gera a pesquisa depois do fechamento',1440),
  ('escalonamento_sla','Escalonamento de SLA','Dispara os níveis de escalonamento no prazo',15),
  ('enviar_fila','Envio da fila de e-mails','Entrega as notificações pendentes',5);

/** Fechamento administrativo: de Solucionado para Fechado. */
CREATE OR REPLACE FUNCTION public.run_auto_close()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  affected integer := 0;
BEGIN
  WITH alvo AS (
    SELECT t.id
      FROM public.tickets t
      JOIN public.entities e ON e.id = t.entity_id
     WHERE t.status = 'resolvido'
       AND e.auto_close_days >= 0
       AND t.resolved_at IS NOT NULL
       AND t.resolved_at + make_interval(days => e.auto_close_days) <= now()
  )
  UPDATE public.tickets SET status = 'fechado', closed_at = now()
   WHERE id IN (SELECT id FROM alvo);
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END; $$;

/** Cria os chamados programados que já venceram. */
CREATE OR REPLACE FUNCTION public.run_recurrent_tickets()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record;
  created integer := 0;
BEGIN
  FOR r IN
    SELECT * FROM public.recurrent_tickets
     WHERE is_active
       AND start_date <= now()
       AND (end_date IS NULL OR end_date >= now())
       AND (next_run_at IS NULL OR next_run_at <= now() + make_interval(mins => anticipation_minutes))
  LOOP
    INSERT INTO public.tickets
      (title, description, type, urgency, impact, category_id, entity_id, assignee_id, status)
    VALUES
      (r.title, r.description, r.type, r.urgency, r.impact, r.category_id, r.entity_id,
       r.assignee_id, 'aberto');

    UPDATE public.recurrent_tickets
       SET last_created_at = now(),
           next_run_at = COALESCE(next_run_at, now()) + make_interval(mins => r.periodicity_minutes)
     WHERE id = r.id;

    created := created + 1;
  END LOOP;
  RETURN created;
END; $$;

/** Gera a pesquisa de satisfação dos chamados fechados. */
CREATE OR REPLACE FUNCTION public.run_satisfaction()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  created integer := 0;
BEGIN
  WITH alvo AS (
    SELECT t.id
      FROM public.tickets t
      JOIN public.entities e ON e.id = t.entity_id
     WHERE t.status = 'fechado'
       AND e.survey_enabled
       AND t.closed_at IS NOT NULL
       AND t.closed_at + make_interval(days => e.survey_delay_days) <= now()
       AND NOT EXISTS (SELECT 1 FROM public.satisfaction_surveys s WHERE s.ticket_id = t.id)
       -- sorteio pelo percentual configurado na entidade
       AND (abs(hashtext(t.id::text)) % 100) < e.survey_rate
  )
  INSERT INTO public.satisfaction_surveys (ticket_id)
  SELECT id FROM alvo;
  GET DIAGNOSTICS created = ROW_COUNT;
  RETURN created;
END; $$;

/** Dispara os níveis de escalonamento cujo prazo chegou. */
CREATE OR REPLACE FUNCTION public.run_escalations()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  lvl record;
  t record;
  act record;
  crit record;
  ok boolean;
  fired integer := 0;
  rec jsonb;
BEGIN
  FOR lvl IN
    SELECT el.*, sl.target
      FROM public.escalation_levels el
      JOIN public.service_levels sl ON sl.id = el.service_level_id
     WHERE el.is_active
  LOOP
    FOR t IN
      SELECT * FROM public.tickets
       WHERE status NOT IN ('resolvido','fechado')
         AND NOT is_deleted
         AND (
           (lvl.target = 'ttr' AND resolution_due_at IS NOT NULL
            AND now() >= resolution_due_at + make_interval(mins => lvl.offset_minutes))
           OR
           (lvl.target = 'tto' AND response_due_at IS NOT NULL
            AND now() >= response_due_at + make_interval(mins => lvl.offset_minutes))
         )
         AND NOT EXISTS (
           SELECT 1 FROM public.escalation_log l
            WHERE l.ticket_id = tickets.id AND l.level_id = lvl.id
         )
    LOOP
      rec := to_jsonb(t);
      ok := true;
      FOR crit IN SELECT * FROM public.escalation_criteria WHERE level_id = lvl.id LOOP
        IF COALESCE(rec ->> crit.field, '') <> crit.value THEN
          ok := false;
        END IF;
      END LOOP;

      IF ok THEN
        FOR act IN SELECT * FROM public.escalation_actions WHERE level_id = lvl.id LOOP
          IF act.action_type = 'campo' THEN
            EXECUTE format('UPDATE public.tickets SET %I = %L WHERE id = %L',
                           act.field, act.value, t.id);
          ELSIF act.action_type = 'notificar' THEN
            PERFORM public.enqueue_notification('escalonamento', t.id, lvl.name);
          END IF;
        END LOOP;

        INSERT INTO public.escalation_log (ticket_id, level_id) VALUES (t.id, lvl.id)
        ON CONFLICT DO NOTHING;
        fired := fired + 1;
      END IF;
    END LOOP;
  END LOOP;
  RETURN fired;
END; $$;

/** Executa uma ação automática pelo código e registra o resultado. */
CREATE OR REPLACE FUNCTION public.run_automatic_action(_code text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  result text;
  n integer;
BEGIN
  IF NOT public.has_right(auth.uid(), 'automatic_action', 'update')
     AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Sem permissão para executar ações automáticas';
  END IF;

  CASE _code
    WHEN 'fechar_chamados' THEN
      n := public.run_auto_close();
      result := n || ' chamado(s) fechado(s)';
    WHEN 'chamados_recorrentes' THEN
      n := public.run_recurrent_tickets();
      result := n || ' chamado(s) criado(s)';
    WHEN 'pesquisa_satisfacao' THEN
      n := public.run_satisfaction();
      result := n || ' pesquisa(s) gerada(s)';
    WHEN 'escalonamento_sla' THEN
      n := public.run_escalations();
      result := n || ' escalonamento(s) disparado(s)';
    ELSE
      result := 'Ação sem execução direta no banco';
  END CASE;

  UPDATE public.automatic_actions
     SET last_run_at = now(), last_result = result
   WHERE code = _code;

  RETURN result;
END; $$;

GRANT EXECUTE ON FUNCTION public.run_automatic_action(text) TO authenticated;

-- Agendamento pelo pg_cron, quando a extensão estiver disponível.
DO $cron$
BEGIN
  PERFORM cron.schedule('glpi_acoes_automaticas', '*/15 * * * *', $job$
    SELECT public.run_auto_close();
    SELECT public.run_recurrent_tickets();
    SELECT public.run_satisfaction();
    SELECT public.run_escalations();
  $job$);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron indisponível; use o botão Executar agora na tela de ações automáticas: %', SQLERRM;
END $cron$;

-- ---------------------------------------------------------------------------
-- DIREITOS NOVOS
-- ---------------------------------------------------------------------------

INSERT INTO public.right_definitions (key, label, category, sort) VALUES
  ('business_rule','Regras de negócio','administracao',55),
  ('recurrent','Chamados recorrentes','assistencia',85),
  ('collector','Coletores de e-mail','configuracao',65),
  ('satisfaction','Pesquisa de satisfação','assistencia',115)
ON CONFLICT (key) DO NOTHING;

-- Quem já podia mexer em regra/config herda os direitos equivalentes.
INSERT INTO public.profile_rights
  (profile_id, object_key, can_read, can_update, can_create, can_delete, can_purge)
SELECT p.id, r.key,
       p.name IN ('Super-Admin','Admin','Supervisor'),
       p.name IN ('Super-Admin','Admin'),
       p.name IN ('Super-Admin','Admin'),
       p.name IN ('Super-Admin'),
       p.name IN ('Super-Admin')
FROM public.access_profiles p
CROSS JOIN (VALUES ('business_rule'),('recurrent'),('collector'),('satisfaction')) AS r(key)
ON CONFLICT (profile_id, object_key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escalation_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escalation_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escalation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escalation_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rule_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rule_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mail_collectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collector_blacklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurrent_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.satisfaction_surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automatic_actions ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.calendars, public.calendar_segments, public.calendar_holidays,
  public.service_levels, public.escalation_levels, public.escalation_criteria,
  public.escalation_actions, public.business_rules, public.rule_criteria,
  public.rule_actions, public.notification_templates, public.notifications,
  public.notification_recipients, public.mail_collectors, public.collector_blacklist,
  public.recurrent_tickets, public.satisfaction_surveys TO authenticated;
GRANT SELECT, UPDATE ON public.notification_queue, public.automatic_actions TO authenticated;
GRANT SELECT ON public.escalation_log TO authenticated;
GRANT ALL ON
  public.calendars, public.calendar_segments, public.calendar_holidays,
  public.service_levels, public.escalation_levels, public.escalation_criteria,
  public.escalation_actions, public.escalation_log, public.business_rules,
  public.rule_criteria, public.rule_actions, public.notification_templates,
  public.notifications, public.notification_recipients, public.notification_queue,
  public.mail_collectors, public.collector_blacklist, public.recurrent_tickets,
  public.satisfaction_surveys, public.automatic_actions TO service_role;

-- Leitura para autenticados, escrita para quem tem o direito correspondente.
CREATE POLICY calendars_select ON public.calendars FOR SELECT TO authenticated USING (true);
CREATE POLICY calendars_write ON public.calendars FOR ALL TO authenticated
  USING (public.has_right(auth.uid(),'calendar','update'))
  WITH CHECK (public.has_right(auth.uid(),'calendar','update'));
CREATE POLICY segments_select ON public.calendar_segments FOR SELECT TO authenticated USING (true);
CREATE POLICY segments_write ON public.calendar_segments FOR ALL TO authenticated
  USING (public.has_right(auth.uid(),'calendar','update'))
  WITH CHECK (public.has_right(auth.uid(),'calendar','update'));
CREATE POLICY holidays_select ON public.calendar_holidays FOR SELECT TO authenticated USING (true);
CREATE POLICY holidays_write ON public.calendar_holidays FOR ALL TO authenticated
  USING (public.has_right(auth.uid(),'calendar','update'))
  WITH CHECK (public.has_right(auth.uid(),'calendar','update'));

CREATE POLICY sl_select ON public.service_levels FOR SELECT TO authenticated USING (true);
CREATE POLICY sl_write ON public.service_levels FOR ALL TO authenticated
  USING (public.has_right(auth.uid(),'sla','update'))
  WITH CHECK (public.has_right(auth.uid(),'sla','update'));
CREATE POLICY el_select ON public.escalation_levels FOR SELECT TO authenticated USING (true);
CREATE POLICY el_write ON public.escalation_levels FOR ALL TO authenticated
  USING (public.has_right(auth.uid(),'sla','update'))
  WITH CHECK (public.has_right(auth.uid(),'sla','update'));
CREATE POLICY ec_select ON public.escalation_criteria FOR SELECT TO authenticated USING (true);
CREATE POLICY ec_write ON public.escalation_criteria FOR ALL TO authenticated
  USING (public.has_right(auth.uid(),'sla','update'))
  WITH CHECK (public.has_right(auth.uid(),'sla','update'));
CREATE POLICY ea_select ON public.escalation_actions FOR SELECT TO authenticated USING (true);
CREATE POLICY ea_write ON public.escalation_actions FOR ALL TO authenticated
  USING (public.has_right(auth.uid(),'sla','update'))
  WITH CHECK (public.has_right(auth.uid(),'sla','update'));
CREATE POLICY elog_select ON public.escalation_log FOR SELECT TO authenticated USING (true);

CREATE POLICY br_select ON public.business_rules FOR SELECT TO authenticated
  USING (public.has_right(auth.uid(),'business_rule','read'));
CREATE POLICY br_write ON public.business_rules FOR ALL TO authenticated
  USING (public.has_right(auth.uid(),'business_rule','update'))
  WITH CHECK (public.has_right(auth.uid(),'business_rule','update'));
CREATE POLICY rc_select ON public.rule_criteria FOR SELECT TO authenticated
  USING (public.has_right(auth.uid(),'business_rule','read'));
CREATE POLICY rc_write ON public.rule_criteria FOR ALL TO authenticated
  USING (public.has_right(auth.uid(),'business_rule','update'))
  WITH CHECK (public.has_right(auth.uid(),'business_rule','update'));
CREATE POLICY ra_select ON public.rule_actions FOR SELECT TO authenticated
  USING (public.has_right(auth.uid(),'business_rule','read'));
CREATE POLICY ra_write ON public.rule_actions FOR ALL TO authenticated
  USING (public.has_right(auth.uid(),'business_rule','update'))
  WITH CHECK (public.has_right(auth.uid(),'business_rule','update'));

CREATE POLICY nt_select ON public.notification_templates FOR SELECT TO authenticated
  USING (public.has_right(auth.uid(),'notification','read'));
CREATE POLICY nt_write ON public.notification_templates FOR ALL TO authenticated
  USING (public.has_right(auth.uid(),'notification','update'))
  WITH CHECK (public.has_right(auth.uid(),'notification','update'));
CREATE POLICY n_select ON public.notifications FOR SELECT TO authenticated
  USING (public.has_right(auth.uid(),'notification','read'));
CREATE POLICY n_write ON public.notifications FOR ALL TO authenticated
  USING (public.has_right(auth.uid(),'notification','update'))
  WITH CHECK (public.has_right(auth.uid(),'notification','update'));
CREATE POLICY nr_select ON public.notification_recipients FOR SELECT TO authenticated
  USING (public.has_right(auth.uid(),'notification','read'));
CREATE POLICY nr_write ON public.notification_recipients FOR ALL TO authenticated
  USING (public.has_right(auth.uid(),'notification','update'))
  WITH CHECK (public.has_right(auth.uid(),'notification','update'));
CREATE POLICY nq_select ON public.notification_queue FOR SELECT TO authenticated
  USING (public.has_right(auth.uid(),'mailqueue','read'));
CREATE POLICY nq_update ON public.notification_queue FOR UPDATE TO authenticated
  USING (public.has_right(auth.uid(),'mailqueue','update'))
  WITH CHECK (public.has_right(auth.uid(),'mailqueue','update'));

CREATE POLICY mc_select ON public.mail_collectors FOR SELECT TO authenticated
  USING (public.has_right(auth.uid(),'collector','read'));
CREATE POLICY mc_write ON public.mail_collectors FOR ALL TO authenticated
  USING (public.has_right(auth.uid(),'collector','update'))
  WITH CHECK (public.has_right(auth.uid(),'collector','update'));
CREATE POLICY cb_select ON public.collector_blacklist FOR SELECT TO authenticated
  USING (public.has_right(auth.uid(),'collector','read'));
CREATE POLICY cb_write ON public.collector_blacklist FOR ALL TO authenticated
  USING (public.has_right(auth.uid(),'collector','update'))
  WITH CHECK (public.has_right(auth.uid(),'collector','update'));

CREATE POLICY rt_select ON public.recurrent_tickets FOR SELECT TO authenticated
  USING (public.has_right(auth.uid(),'recurrent','read'));
CREATE POLICY rt_write ON public.recurrent_tickets FOR ALL TO authenticated
  USING (public.has_right(auth.uid(),'recurrent','update'))
  WITH CHECK (public.has_right(auth.uid(),'recurrent','update'));

CREATE POLICY ss_select ON public.satisfaction_surveys FOR SELECT TO authenticated
  USING (public.can_see_ticket(ticket_id));
CREATE POLICY ss_write ON public.satisfaction_surveys FOR UPDATE TO authenticated
  USING (public.can_see_ticket(ticket_id))
  WITH CHECK (public.can_see_ticket(ticket_id));

CREATE POLICY aa_select ON public.automatic_actions FOR SELECT TO authenticated USING (true);
CREATE POLICY aa_write ON public.automatic_actions FOR UPDATE TO authenticated
  USING (public.has_right(auth.uid(),'config','update'))
  WITH CHECK (public.has_right(auth.uid(),'config','update'));

-- ---------------------------------------------------------------------------
-- CARIMBO
-- ---------------------------------------------------------------------------

CREATE TRIGGER calendars_touch BEFORE UPDATE ON public.calendars
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER service_levels_touch BEFORE UPDATE ON public.service_levels
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER business_rules_touch BEFORE UPDATE ON public.business_rules
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER notifications_touch BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER notification_templates_touch BEFORE UPDATE ON public.notification_templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER recurrent_tickets_touch BEFORE UPDATE ON public.recurrent_tickets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
