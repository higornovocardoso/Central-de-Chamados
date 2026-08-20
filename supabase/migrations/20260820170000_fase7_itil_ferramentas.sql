-- ============================================================================
-- FASE 7 — Problemas, mudanças, projetos e o resto de Ferramentas
-- Fecha o ITIL do GLPI (problema e mudança), traz projetos com tarefas e
-- equipe, reservas de equipamento, lembretes, feeds RSS, relatórios e a
-- base de conhecimento completa, com categorias, FAQ, revisões e comentários.
--
-- Nota de projeto: chamados já têm tabelas dedicadas para acompanhamento,
-- tarefa e solução (fase 3). Problemas e mudanças compartilham tabelas
-- genéricas com item_type, para não repetir seis vezes a mesma estrutura.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- PROBLEMAS
-- ---------------------------------------------------------------------------

CREATE TYPE public.problem_status AS ENUM
  ('novo','em_analise','aguardando','solucionado','fechado');

CREATE TABLE public.problems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  status public.problem_status NOT NULL DEFAULT 'novo',
  urgency smallint NOT NULL DEFAULT 3 CHECK (urgency BETWEEN 1 AND 5),
  impact smallint NOT NULL DEFAULT 3 CHECK (impact BETWEEN 1 AND 5),
  priority_level smallint NOT NULL DEFAULT 3 CHECK (priority_level BETWEEN 1 AND 5),
  category_id uuid REFERENCES public.itil_categories(id) ON DELETE SET NULL,
  entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE RESTRICT,
  requester_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assignee_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assignee_group_id uuid REFERENCES public.user_groups(id) ON DELETE SET NULL,
  -- a aba Análise do GLPI
  impacts text NOT NULL DEFAULT '',
  causes text NOT NULL DEFAULT '',
  symptoms text NOT NULL DEFAULT '',
  solution text NOT NULL DEFAULT '',
  solution_type_id uuid REFERENCES public.solution_types(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  closed_at timestamptz,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_problems_status ON public.problems(status);

-- ---------------------------------------------------------------------------
-- MUDANÇAS
-- ---------------------------------------------------------------------------

CREATE TYPE public.change_status AS ENUM
  ('nova','avaliacao','aprovacao','aceita','planejada','em_execucao',
   'teste','qualificacao','aplicada','revisao','fechada','cancelada');

CREATE TABLE public.changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  status public.change_status NOT NULL DEFAULT 'nova',
  urgency smallint NOT NULL DEFAULT 3 CHECK (urgency BETWEEN 1 AND 5),
  impact smallint NOT NULL DEFAULT 3 CHECK (impact BETWEEN 1 AND 5),
  priority_level smallint NOT NULL DEFAULT 3 CHECK (priority_level BETWEEN 1 AND 5),
  category_id uuid REFERENCES public.itil_categories(id) ON DELETE SET NULL,
  entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE RESTRICT,
  requester_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assignee_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- aba Análise
  impacts text NOT NULL DEFAULT '',
  control_list text NOT NULL DEFAULT '',
  -- aba Planos
  deployment_plan text NOT NULL DEFAULT '',
  backup_plan text NOT NULL DEFAULT '',
  checklist text NOT NULL DEFAULT '',
  validation_state public.validation_state NOT NULL DEFAULT 'nao_sujeito',
  planned_start timestamptz,
  planned_end timestamptz,
  solution text NOT NULL DEFAULT '',
  resolved_at timestamptz,
  closed_at timestamptz,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_changes_status ON public.changes(status);

-- ---------------------------------------------------------------------------
-- SATÉLITES GENÉRICOS DE PROBLEMA E MUDANÇA
-- ---------------------------------------------------------------------------

CREATE TABLE public.itil_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_type text NOT NULL CHECK (item_type IN ('problem','change')),
  item_id uuid NOT NULL,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  body text NOT NULL,
  is_private boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_itil_followups_item ON public.itil_followups(item_type, item_id);

CREATE TABLE public.itil_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_type text NOT NULL CHECK (item_type IN ('problem','change')),
  item_id uuid NOT NULL,
  category_id uuid REFERENCES public.task_categories(id) ON DELETE SET NULL,
  content text NOT NULL DEFAULT '',
  state public.task_state NOT NULL DEFAULT 'a_fazer',
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  planned_start timestamptz,
  duration_minutes integer NOT NULL DEFAULT 0,
  is_private boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_itil_tasks_item ON public.itil_tasks(item_type, item_id);

CREATE TABLE public.itil_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_type text NOT NULL CHECK (item_type IN ('problem','change')),
  item_id uuid NOT NULL,
  name text NOT NULL DEFAULT '',
  duration_minutes integer NOT NULL DEFAULT 0,
  cost_time numeric(12,2) NOT NULL DEFAULT 0,
  cost_fixed numeric(12,2) NOT NULL DEFAULT 0,
  cost_material numeric(12,2) NOT NULL DEFAULT 0,
  budget_id uuid REFERENCES public.budgets(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Vínculos entre chamado, problema e mudança, nos dois sentidos.
CREATE TABLE public.itil_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type text NOT NULL CHECK (source_type IN ('ticket','problem','change')),
  source_id uuid NOT NULL,
  target_type text NOT NULL CHECK (target_type IN ('ticket','problem','change')),
  target_id uuid NOT NULL,
  link_type public.ticket_link_type NOT NULL DEFAULT 'ligado',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_type, source_id, target_type, target_id)
);

CREATE INDEX idx_itil_relations_source ON public.itil_relations(source_type, source_id);
CREATE INDEX idx_itil_relations_target ON public.itil_relations(target_type, target_id);

CREATE TABLE public.itil_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_type text NOT NULL CHECK (item_type IN ('problem','change')),
  item_id uuid NOT NULL,
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  UNIQUE (item_type, item_id, asset_id)
);

-- Prioridade calculada pela mesma matriz do chamado.
CREATE OR REPLACE FUNCTION public.sync_itil_priority()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.priority_level := public.compute_priority(NEW.urgency, NEW.impact);
  NEW.updated_at := now();
  RETURN NEW;
END; $$;

CREATE TRIGGER problems_priority BEFORE INSERT OR UPDATE ON public.problems
  FOR EACH ROW EXECUTE FUNCTION public.sync_itil_priority();
CREATE TRIGGER changes_priority BEFORE INSERT OR UPDATE ON public.changes
  FOR EACH ROW EXECUTE FUNCTION public.sync_itil_priority();

-- ---------------------------------------------------------------------------
-- PROJETOS
-- ---------------------------------------------------------------------------

CREATE TABLE public.project_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  color text NOT NULL DEFAULT '',
  is_finished boolean NOT NULL DEFAULT false
);

INSERT INTO public.project_states (name, is_finished) VALUES
  ('Novo', false), ('Em andamento', false), ('Suspenso', false),
  ('Concluído', true), ('Cancelado', true);

CREATE TABLE public.project_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE
);

INSERT INTO public.project_types (name) VALUES
  ('Implantação'), ('Migração'), ('Atualização'), ('Melhoria'), ('Auditoria');

CREATE TABLE public.project_task_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE
);

INSERT INTO public.project_task_types (name) VALUES
  ('Análise'), ('Execução'), ('Testes'), ('Documentação'), ('Homologação');

CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL DEFAULT '',
  parent_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  state_id uuid REFERENCES public.project_states(id) ON DELETE SET NULL,
  project_type_id uuid REFERENCES public.project_types(id) ON DELETE SET NULL,
  priority_level smallint NOT NULL DEFAULT 3 CHECK (priority_level BETWEEN 1 AND 5),
  percent_done smallint NOT NULL DEFAULT 0 CHECK (percent_done BETWEEN 0 AND 100),
  start_date date,
  end_date date,
  manager_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  manager_group_id uuid REFERENCES public.user_groups(id) ON DELETE SET NULL,
  entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  description text NOT NULL DEFAULT '',
  comment text NOT NULL DEFAULT '',
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.project_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.project_tasks(id) ON DELETE SET NULL,
  name text NOT NULL,
  state_id uuid REFERENCES public.project_states(id) ON DELETE SET NULL,
  task_type_id uuid REFERENCES public.project_task_types(id) ON DELETE SET NULL,
  percent_done smallint NOT NULL DEFAULT 0 CHECK (percent_done BETWEEN 0 AND 100),
  planned_start date,
  planned_end date,
  real_start date,
  real_end date,
  planned_hours numeric(8,2) NOT NULL DEFAULT 0,
  effective_hours numeric(8,2) NOT NULL DEFAULT 0,
  assigned_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_project_tasks_project ON public.project_tasks(project_id);

CREATE TABLE public.project_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id uuid REFERENCES public.user_groups(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT '',
  CHECK (user_id IS NOT NULL OR group_id IS NOT NULL)
);

CREATE TABLE public.project_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  item_type text NOT NULL CHECK (item_type IN ('ticket','problem','change')),
  item_id uuid NOT NULL,
  UNIQUE (project_id, item_type, item_id)
);

CREATE TABLE public.project_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  value numeric(14,2) NOT NULL DEFAULT 0,
  budget_id uuid REFERENCES public.budgets(id) ON DELETE SET NULL,
  begin_date date,
  end_date date
);

/** O andamento do projeto acompanha a média das suas tarefas. */
CREATE OR REPLACE FUNCTION public.refresh_project_progress()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  target uuid := COALESCE(NEW.project_id, OLD.project_id);
  average integer;
BEGIN
  SELECT COALESCE(round(avg(percent_done)), 0) INTO average
    FROM public.project_tasks WHERE project_id = target;
  UPDATE public.projects SET percent_done = average WHERE id = target;
  RETURN NULL;
END; $$;

CREATE TRIGGER project_tasks_progress
AFTER INSERT OR UPDATE OF percent_done OR DELETE ON public.project_tasks
FOR EACH ROW EXECUTE FUNCTION public.refresh_project_progress();

-- ---------------------------------------------------------------------------
-- RESERVAS
-- ---------------------------------------------------------------------------

-- Só o que estiver marcado aqui pode ser reservado, como no GLPI.
CREATE TABLE public.reservation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  comment text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_item_id uuid NOT NULL REFERENCES public.reservation_items(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  begin_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  comment text NOT NULL DEFAULT '',
  -- reservas criadas juntas por repetição compartilham o mesmo grupo
  repeat_group uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_at > begin_at)
);

CREATE INDEX idx_reservations_item ON public.reservations(reservation_item_id, begin_at);

/** Impede duas reservas do mesmo equipamento no mesmo horário. */
CREATE OR REPLACE FUNCTION public.check_reservation_overlap()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.reservations r
     WHERE r.reservation_item_id = NEW.reservation_item_id
       AND r.id <> COALESCE(NEW.id, gen_random_uuid())
       AND r.begin_at < NEW.end_at
       AND r.end_at > NEW.begin_at
  ) THEN
    RAISE EXCEPTION 'Já existe uma reserva deste equipamento nesse horário';
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER reservations_overlap
BEFORE INSERT OR UPDATE ON public.reservations
FOR EACH ROW EXECUTE FUNCTION public.check_reservation_overlap();

-- ---------------------------------------------------------------------------
-- LEMBRETES E FEEDS RSS
-- ---------------------------------------------------------------------------

CREATE TABLE public.reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  body text NOT NULL DEFAULT '',
  author_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  is_public boolean NOT NULL DEFAULT false,
  begin_at timestamptz,
  end_at timestamptz,
  entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.reminder_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reminder_id uuid NOT NULL REFERENCES public.reminders(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id uuid REFERENCES public.user_groups(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES public.access_profiles(id) ON DELETE CASCADE
);

CREATE TABLE public.rss_feeds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  url text NOT NULL,
  refresh_minutes integer NOT NULL DEFAULT 60,
  max_items integer NOT NULL DEFAULT 10,
  is_active boolean NOT NULL DEFAULT true,
  author_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  is_public boolean NOT NULL DEFAULT false,
  entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  comment text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- BASE DE CONHECIMENTO COMPLETA
-- ---------------------------------------------------------------------------

CREATE TABLE public.kb_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  parent_id uuid REFERENCES public.kb_categories(id) ON DELETE RESTRICT,
  path text NOT NULL DEFAULT '',
  level integer NOT NULL DEFAULT 0,
  entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  comment text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.kb_categories_set_path()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  parent_path text;
  parent_level integer;
BEGIN
  IF NEW.parent_id IS NULL THEN
    NEW.path := '/' || NEW.id::text || '/';
    NEW.level := 0;
  ELSE
    SELECT c.path, c.level INTO parent_path, parent_level
      FROM public.kb_categories c WHERE c.id = NEW.parent_id;
    NEW.path := COALESCE(parent_path, '/') || NEW.id::text || '/';
    NEW.level := COALESCE(parent_level, 0) + 1;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER kb_categories_path
BEFORE INSERT OR UPDATE OF parent_id ON public.kb_categories
FOR EACH ROW EXECUTE FUNCTION public.kb_categories_set_path();

-- Traz as categorias que hoje são texto solto no artigo.
DO $$
DECLARE
  root_entity uuid;
BEGIN
  SELECT id INTO root_entity FROM public.entities WHERE parent_id IS NULL ORDER BY created_at LIMIT 1;
  INSERT INTO public.kb_categories (name, entity_id)
  SELECT DISTINCT category, root_entity FROM public.kb_articles
   WHERE length(trim(category)) > 0;
END $$;

ALTER TABLE public.kb_articles
  ADD COLUMN IF NOT EXISTS kb_category_id uuid REFERENCES public.kb_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_faq boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS view_counter integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;

UPDATE public.kb_articles a
   SET kb_category_id = (SELECT c.id FROM public.kb_categories c WHERE c.name = a.category LIMIT 1)
 WHERE a.kb_category_id IS NULL;

CREATE TABLE public.kb_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES public.kb_articles(id) ON DELETE CASCADE,
  revision integer NOT NULL DEFAULT 1,
  title text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_kb_revisions_article ON public.kb_revisions(article_id, revision DESC);

CREATE TABLE public.kb_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES public.kb_articles(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.kb_comments(id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.kb_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES public.kb_articles(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id uuid REFERENCES public.user_groups(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES public.access_profiles(id) ON DELETE CASCADE,
  entity_id uuid REFERENCES public.entities(id) ON DELETE CASCADE
);

/** Guarda a versão anterior sempre que o artigo muda de texto. */
CREATE OR REPLACE FUNCTION public.kb_save_revision()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  next_revision integer;
BEGIN
  IF NEW.body IS DISTINCT FROM OLD.body OR NEW.title IS DISTINCT FROM OLD.title THEN
    SELECT COALESCE(max(revision), 0) + 1 INTO next_revision
      FROM public.kb_revisions WHERE article_id = OLD.id;
    INSERT INTO public.kb_revisions (article_id, revision, title, body, author_id)
    VALUES (OLD.id, next_revision, OLD.title, OLD.body, auth.uid());
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER kb_articles_revision
BEFORE UPDATE ON public.kb_articles
FOR EACH ROW EXECUTE FUNCTION public.kb_save_revision();

-- A FAQ é pública, como no GLPI: quem não tem login enxerga o que for FAQ.
GRANT SELECT ON public.kb_articles, public.kb_categories TO anon;

CREATE POLICY kb_public_faq ON public.kb_articles FOR SELECT TO anon
  USING (is_faq AND published AND NOT is_deleted);
CREATE POLICY kb_categories_public ON public.kb_categories FOR SELECT TO anon USING (true);

-- ---------------------------------------------------------------------------
-- DIREITOS NOVOS
-- ---------------------------------------------------------------------------

INSERT INTO public.right_definitions (key, label, category, sort) VALUES
  ('problem_task','Tarefas de problema','assistencia',65),
  ('change_task','Tarefas de mudança','assistencia',75)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.profile_rights
  (profile_id, object_key, can_read, can_update, can_create, can_delete, can_purge)
SELECT p.id, r.key,
       p.name IN ('Super-Admin','Admin','Supervisor','Técnico'),
       p.name IN ('Super-Admin','Admin','Supervisor'),
       p.name IN ('Super-Admin','Admin','Supervisor'),
       p.name IN ('Super-Admin','Admin'),
       p.name IN ('Super-Admin')
FROM public.access_profiles p
CROSS JOIN (VALUES ('problem_task'),('change_task')) AS r(key)
ON CONFLICT (profile_id, object_key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

DO $rls$
DECLARE
  t text;
  right_key text;
  tables jsonb;
  by_right jsonb := jsonb_build_object(
    'problem',     jsonb_build_array('problems'),
    'change',      jsonb_build_array('changes'),
    'project',     jsonb_build_array('projects','project_teams','project_items','project_costs',
                                     'project_states','project_types','project_task_types'),
    'projecttask', jsonb_build_array('project_tasks'),
    'reservation', jsonb_build_array('reservation_items','reservations'),
    'reminder',    jsonb_build_array('reminders','reminder_targets'),
    'rssfeed',     jsonb_build_array('rss_feeds'),
    'knowledgebase', jsonb_build_array('kb_categories','kb_revisions','kb_comments','kb_targets')
  );
BEGIN
  FOR right_key, tables IN SELECT * FROM jsonb_each(by_right) LOOP
    FOR t IN SELECT jsonb_array_elements_text(tables) LOOP
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
      EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated
           USING (public.has_right(auth.uid(), %L, ''read''))', t || '_select', t, right_key);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO authenticated
           USING (public.has_right(auth.uid(), %L, ''update''))
           WITH CHECK (public.has_right(auth.uid(), %L, ''update''))',
        t || '_write', t, right_key, right_key);
    END LOOP;
  END LOOP;
END $rls$;

-- Satélites de problema e mudança seguem o direito do objeto pai.
DO $sat$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['itil_followups','itil_tasks','itil_costs','itil_relations','itil_assets'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated
         USING (public.has_right(auth.uid(),''problem'',''read'')
                OR public.has_right(auth.uid(),''change'',''read'')
                OR public.has_right(auth.uid(),''ticket'',''read''))', t || '_select', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated
         USING (public.has_right(auth.uid(),''problem'',''update'')
                OR public.has_right(auth.uid(),''change'',''update''))
         WITH CHECK (public.has_right(auth.uid(),''problem'',''update'')
                     OR public.has_right(auth.uid(),''change'',''update''))', t || '_write', t);
  END LOOP;
END $sat$;

-- ---------------------------------------------------------------------------
-- CARIMBO
-- ---------------------------------------------------------------------------

CREATE TRIGGER projects_touch BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER project_tasks_touch BEFORE UPDATE ON public.project_tasks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER reminders_touch BEFORE UPDATE ON public.reminders
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
