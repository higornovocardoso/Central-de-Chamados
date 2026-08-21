-- ============================================================================
-- FASE 15 — Mudanças recorrentes
-- O GLPI tem RecurrentChange ao lado de TicketRecurrent, no mesmo setor de
-- Assistência. A tabela espelha recurrent_tickets, trocando o alvo para
-- changes, e a criação fica a cargo de uma ação automática de hora em hora.
-- ============================================================================

CREATE TABLE public.recurrent_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  category_id uuid REFERENCES public.itil_categories(id) ON DELETE SET NULL,
  urgency smallint NOT NULL DEFAULT 3 CHECK (urgency BETWEEN 1 AND 5),
  impact smallint NOT NULL DEFAULT 3 CHECK (impact BETWEEN 1 AND 5),
  assignee_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  periodicity_minutes integer NOT NULL DEFAULT 43200,
  anticipation_minutes integer NOT NULL DEFAULT 0,
  start_date timestamptz NOT NULL DEFAULT now(),
  end_date timestamptz,
  calendar_id uuid REFERENCES public.calendars(id) ON DELETE SET NULL,
  last_created_at timestamptz,
  next_run_at timestamptz,
  comment text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER recurrent_changes_touch BEFORE UPDATE ON public.recurrent_changes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.recurrent_changes ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurrent_changes TO authenticated;
GRANT ALL ON public.recurrent_changes TO service_role;

CREATE POLICY rc_changes_select ON public.recurrent_changes FOR SELECT TO authenticated
  USING (public.has_right(auth.uid(), 'change', 'read'));
CREATE POLICY rc_changes_write ON public.recurrent_changes FOR ALL TO authenticated
  USING (public.has_right(auth.uid(), 'change', 'update'))
  WITH CHECK (public.has_right(auth.uid(), 'change', 'update'));

CREATE OR REPLACE FUNCTION public.run_recurrent_changes()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record;
  created integer := 0;
BEGIN
  FOR r IN
    SELECT * FROM public.recurrent_changes
     WHERE is_active
       AND start_date <= now()
       AND (end_date IS NULL OR end_date >= now())
       AND (next_run_at IS NULL OR next_run_at <= now() + make_interval(mins => anticipation_minutes))
  LOOP
    INSERT INTO public.changes
      (title, description, urgency, impact, category_id, entity_id, assignee_id, status)
    VALUES
      (r.title, r.description, r.urgency, r.impact, r.category_id, r.entity_id,
       r.assignee_id, 'nova');

    UPDATE public.recurrent_changes
       SET last_created_at = now(),
           next_run_at = COALESCE(next_run_at, now()) + make_interval(mins => r.periodicity_minutes)
     WHERE id = r.id;

    created := created + 1;
  END LOOP;
  RETURN created;
END; $$;

REVOKE EXECUTE ON FUNCTION public.run_recurrent_changes() FROM PUBLIC, anon, authenticated;

INSERT INTO public.automatic_actions (code, name, description, frequency_minutes) VALUES
  ('mudancas_recorrentes','Mudanças recorrentes','Cria as mudanças programadas',60)
ON CONFLICT (code) DO NOTHING;

-- Entra no agendamento de hora em hora, junto dos chamados recorrentes.
DO $cron$
BEGIN
  PERFORM cron.unschedule('glpi_horario');
EXCEPTION WHEN OTHERS THEN NULL;
END $cron$;

SELECT cron.schedule(
  'glpi_horario',
  '0 * * * *',
  $job$
    SELECT public.run_auto_close();
    SELECT public.run_recurrent_tickets();
    SELECT public.run_recurrent_changes();
  $job$
);
