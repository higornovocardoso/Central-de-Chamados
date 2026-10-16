-- ============================================================================
-- FASE 3 — Chamado ITIL completo
-- Tipo incidente/requisição, urgência x impacto x prioridade pela matriz,
-- categorias ITIL em árvore, atores múltiplos, acompanhamentos públicos e
-- privados, tarefas, soluções, aprovações, vínculos, itens, custos,
-- documentos, histórico campo a campo e lixeira.
-- ============================================================================

-- O sexto status do GLPI. Precisa vir antes de tudo e não pode ser usado
-- como literal de enum nesta mesma transação — só como texto.
ALTER TYPE public.ticket_status ADD VALUE IF NOT EXISTS 'planejado';

-- ---------------------------------------------------------------------------
-- TIPOS
-- ---------------------------------------------------------------------------

CREATE TYPE public.ticket_type AS ENUM ('incidente','requisicao');
CREATE TYPE public.validation_state AS ENUM ('nao_sujeito','aguardando','aprovado','recusado');
CREATE TYPE public.task_state AS ENUM ('informacao','a_fazer','concluida');
CREATE TYPE public.ticket_link_type AS ENUM ('ligado','duplicado','filho','pai');
CREATE TYPE public.solution_state AS ENUM ('aguardando','aprovada','recusada');

-- ---------------------------------------------------------------------------
-- MATRIZ DE PRIORIDADE  (urgência x impacto, 5 níveis cada)
-- ---------------------------------------------------------------------------

CREATE TABLE public.priority_matrix (
  urgency smallint NOT NULL CHECK (urgency BETWEEN 1 AND 5),
  impact smallint NOT NULL CHECK (impact BETWEEN 1 AND 5),
  priority smallint NOT NULL CHECK (priority BETWEEN 1 AND 5),
  PRIMARY KEY (urgency, impact)
);

-- Níveis que ficam disponíveis no formulário; o nível 3 (Média) não desliga.
CREATE TABLE public.priority_levels (
  level smallint PRIMARY KEY CHECK (level BETWEEN 1 AND 6),
  label text NOT NULL,
  urgency_enabled boolean NOT NULL DEFAULT true,
  impact_enabled boolean NOT NULL DEFAULT true
);

INSERT INTO public.priority_levels (level, label) VALUES
  (1,'Muito baixa'), (2,'Baixa'), (3,'Média'), (4,'Alta'), (5,'Muito alta');
INSERT INTO public.priority_levels (level, label, urgency_enabled, impact_enabled)
  VALUES (6,'Maior', false, false);

-- Matriz padrão do GLPI: a média arredondada para baixo, com os extremos puxando.
INSERT INTO public.priority_matrix (urgency, impact, priority)
SELECT u.n, i.n,
       GREATEST(1, LEAST(5, CASE
         WHEN u.n = 5 AND i.n >= 4 THEN 5
         WHEN i.n = 5 AND u.n >= 4 THEN 5
         WHEN u.n = 1 AND i.n <= 2 THEN 1
         WHEN i.n = 1 AND u.n <= 2 THEN 1
         ELSE ((u.n + i.n) / 2)::smallint
       END))
FROM generate_series(1,5) AS u(n)
CROSS JOIN generate_series(1,5) AS i(n);

CREATE OR REPLACE FUNCTION public.compute_priority(_urgency smallint, _impact smallint)
RETURNS smallint LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT priority FROM public.priority_matrix WHERE urgency = _urgency AND impact = _impact),
    3::smallint
  );
$$;

-- ---------------------------------------------------------------------------
-- LISTAS SUSPENSAS DE ASSISTÊNCIA
-- ---------------------------------------------------------------------------

CREATE TABLE public.itil_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  parent_id uuid REFERENCES public.itil_categories(id) ON DELETE RESTRICT,
  path text NOT NULL DEFAULT '',
  level integer NOT NULL DEFAULT 0,
  entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  is_recursive boolean NOT NULL DEFAULT true,
  -- responsável e grupo técnico usados na atribuição automática
  technician_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  group_id uuid REFERENCES public.user_groups(id) ON DELETE SET NULL,
  kb_category text NOT NULL DEFAULT '',
  visible_incident boolean NOT NULL DEFAULT true,
  visible_request boolean NOT NULL DEFAULT true,
  visible_problem boolean NOT NULL DEFAULT true,
  visible_change boolean NOT NULL DEFAULT true,
  visible_helpdesk boolean NOT NULL DEFAULT true,
  comment text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_itil_categories_parent ON public.itil_categories(parent_id);

CREATE OR REPLACE FUNCTION public.itil_categories_set_path()
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
      FROM public.itil_categories c WHERE c.id = NEW.parent_id;
    IF parent_path IS NULL THEN
      RAISE EXCEPTION 'Categoria pai inexistente';
    END IF;
    NEW.path := parent_path || NEW.id::text || '/';
    NEW.level := parent_level + 1;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END; $$;

CREATE TRIGGER itil_categories_path_biu
BEFORE INSERT OR UPDATE OF parent_id ON public.itil_categories
FOR EACH ROW EXECUTE FUNCTION public.itil_categories_set_path();

CREATE TABLE public.task_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  comment text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.solution_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.request_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Sementes com as categorias que já eram usadas como texto solto no chamado.
DO $$
DECLARE
  root_entity uuid;
BEGIN
  SELECT id INTO root_entity FROM public.entities WHERE parent_id IS NULL ORDER BY created_at LIMIT 1;

  INSERT INTO public.itil_categories (name, entity_id)
  SELECT c, root_entity FROM unnest(ARRAY[
    'Hardware','Software','Rede / Internet','Acesso e senhas','E-mail',
    'Impressora','Sistema interno','Outros'
  ]) AS c;

  INSERT INTO public.task_categories (name, entity_id)
  SELECT c, root_entity FROM unnest(ARRAY[
    'Atendimento remoto','Atendimento presencial','Substituição de equipamento',
    'Configuração','Diagnóstico','Acompanhamento com fornecedor'
  ]) AS c;

  INSERT INTO public.solution_types (name, entity_id)
  SELECT c, root_entity FROM unnest(ARRAY[
    'Correção aplicada','Orientação ao usuário','Substituição de equipamento',
    'Configuração ajustada','Sem necessidade de ação','Encaminhado ao fornecedor'
  ]) AS c;
END $$;

INSERT INTO public.request_sources (name, is_default) VALUES
  ('Formulário', true), ('Telefone', false), ('E-mail', false),
  ('Presencial', false), ('WhatsApp', false), ('Monitoramento', false);

-- ---------------------------------------------------------------------------
-- CAMPOS NOVOS DO CHAMADO
-- ---------------------------------------------------------------------------

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS type public.ticket_type NOT NULL DEFAULT 'incidente',
  ADD COLUMN IF NOT EXISTS urgency smallint NOT NULL DEFAULT 3 CHECK (urgency BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS impact smallint NOT NULL DEFAULT 3 CHECK (impact BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS priority_level smallint NOT NULL DEFAULT 3 CHECK (priority_level BETWEEN 1 AND 6),
  ADD COLUMN IF NOT EXISTS priority_manual boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.itil_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS request_source_id uuid REFERENCES public.request_sources(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS validation_state public.validation_state NOT NULL DEFAULT 'nao_sujeito',
  ADD COLUMN IF NOT EXISTS validation_percent smallint NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS taken_into_account_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS external_id text NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_tickets_category ON public.tickets(category_id);
CREATE INDEX IF NOT EXISTS idx_tickets_deleted ON public.tickets(is_deleted);

-- Converte a prioridade antiga (4 níveis, enum) para os 5 níveis do GLPI e
-- amarra a categoria em texto à nova categoria em árvore.
UPDATE public.tickets t SET
  priority_level = CASE t.priority
    WHEN 'baixa' THEN 2 WHEN 'media' THEN 3 WHEN 'alta' THEN 4 WHEN 'critica' THEN 5 ELSE 3 END,
  urgency = CASE t.priority
    WHEN 'baixa' THEN 2 WHEN 'media' THEN 3 WHEN 'alta' THEN 4 WHEN 'critica' THEN 5 ELSE 3 END,
  impact = 3,
  category_id = (SELECT c.id FROM public.itil_categories c WHERE c.name = t.category LIMIT 1),
  request_source_id = (SELECT s.id FROM public.request_sources s WHERE s.is_default LIMIT 1);

-- A coluna antiga continua existindo e sincronizada, para que as políticas e
-- as telas ainda não migradas sigam funcionando.
CREATE OR REPLACE FUNCTION public.sync_priority()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NOT NEW.priority_manual THEN
    NEW.priority_level := public.compute_priority(NEW.urgency, NEW.impact);
  END IF;

  NEW.priority := CASE
    WHEN NEW.priority_level <= 2 THEN 'baixa'::public.ticket_priority
    WHEN NEW.priority_level = 3 THEN 'media'::public.ticket_priority
    WHEN NEW.priority_level = 4 THEN 'alta'::public.ticket_priority
    ELSE 'critica'::public.ticket_priority
  END;

  -- A categoria em texto acompanha a categoria em árvore.
  IF NEW.category_id IS NOT NULL THEN
    NEW.category := COALESCE(
      (SELECT name FROM public.itil_categories WHERE id = NEW.category_id), NEW.category);
  END IF;

  RETURN NEW;
END; $$;

CREATE TRIGGER tickets_sync_priority
BEFORE INSERT OR UPDATE ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.sync_priority();

-- ---------------------------------------------------------------------------
-- ATORES
-- ---------------------------------------------------------------------------

CREATE TYPE public.actor_role AS ENUM ('requerente','observador','atribuido');

CREATE TABLE public.ticket_actors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  role public.actor_role NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id uuid REFERENCES public.user_groups(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE CASCADE,
  alternative_email text NOT NULL DEFAULT '',
  use_notification boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- exatamente um dos três, ou apenas um e-mail avulso
  CHECK (
    (user_id IS NOT NULL)::int + (group_id IS NOT NULL)::int + (supplier_id IS NOT NULL)::int
    + (CASE WHEN length(trim(alternative_email)) > 0 THEN 1 ELSE 0 END) >= 1
  )
);

CREATE INDEX idx_ticket_actors_ticket ON public.ticket_actors(ticket_id);
CREATE INDEX idx_ticket_actors_user ON public.ticket_actors(user_id);

-- Traz os atores que hoje vivem em colunas do chamado.
INSERT INTO public.ticket_actors (ticket_id, role, user_id)
SELECT id, 'requerente', requester_id FROM public.tickets WHERE requester_id IS NOT NULL;
INSERT INTO public.ticket_actors (ticket_id, role, user_id)
SELECT id, 'atribuido', assignee_id FROM public.tickets WHERE assignee_id IS NOT NULL;
INSERT INTO public.ticket_actors (ticket_id, role, alternative_email)
SELECT id, 'requerente', reporter_email
  FROM public.tickets
 WHERE requester_id IS NULL AND length(trim(reporter_email)) > 0;

-- ---------------------------------------------------------------------------
-- ACOMPANHAMENTOS: público x privado
-- ---------------------------------------------------------------------------

ALTER TABLE public.ticket_comments
  ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS source_id uuid REFERENCES public.request_sources(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP POLICY IF EXISTS "comments_select" ON public.ticket_comments;
CREATE POLICY "comments_select" ON public.ticket_comments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tickets t
       WHERE t.id = ticket_id
         AND (t.requester_id = auth.uid() OR t.assignee_id = auth.uid() OR public.is_staff(auth.uid()))
    )
    AND (NOT is_private OR public.has_flag(auth.uid(), 'followup_see_private') OR author_id = auth.uid())
  );

GRANT UPDATE, DELETE ON public.ticket_comments TO authenticated;

CREATE POLICY "comments_update" ON public.ticket_comments FOR UPDATE TO authenticated
  USING (author_id = auth.uid() OR public.has_right(auth.uid(), 'followup', 'update'))
  WITH CHECK (author_id = auth.uid() OR public.has_right(auth.uid(), 'followup', 'update'));

CREATE POLICY "comments_delete" ON public.ticket_comments FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.has_right(auth.uid(), 'followup', 'delete'));

-- ---------------------------------------------------------------------------
-- TAREFAS
-- ---------------------------------------------------------------------------

CREATE TABLE public.ticket_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.task_categories(id) ON DELETE SET NULL,
  content text NOT NULL DEFAULT '',
  state public.task_state NOT NULL DEFAULT 'a_fazer',
  is_private boolean NOT NULL DEFAULT false,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_group_id uuid REFERENCES public.user_groups(id) ON DELETE SET NULL,
  planned_start timestamptz,
  planned_end timestamptz,
  duration_minutes integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ticket_tasks_ticket ON public.ticket_tasks(ticket_id);

-- Tarefa planejada leva o chamado para "Em atendimento (planejado)", como no GLPI.
CREATE OR REPLACE FUNCTION public.task_plans_ticket()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.planned_start IS NOT NULL THEN
    UPDATE public.tickets
       SET status = 'planejado'
     WHERE id = NEW.ticket_id
       AND status IN ('aberto','em_andamento');
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER ticket_tasks_plan_aiu
AFTER INSERT OR UPDATE OF planned_start ON public.ticket_tasks
FOR EACH ROW EXECUTE FUNCTION public.task_plans_ticket();

-- ---------------------------------------------------------------------------
-- SOLUÇÕES
-- ---------------------------------------------------------------------------

CREATE TABLE public.ticket_solutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  solution_type_id uuid REFERENCES public.solution_types(id) ON DELETE SET NULL,
  content text NOT NULL DEFAULT '',
  state public.solution_state NOT NULL DEFAULT 'aguardando',
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  answer_comment text NOT NULL DEFAULT '',
  answered_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  answered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ticket_solutions_ticket ON public.ticket_solutions(ticket_id);

-- Registrar solução resolve o chamado; aprovar a solução fecha.
CREATE OR REPLACE FUNCTION public.solution_moves_ticket()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.tickets SET status = 'resolvido' WHERE id = NEW.ticket_id;
  ELSIF NEW.state = 'aprovada' AND OLD.state <> 'aprovada' THEN
    UPDATE public.tickets SET status = 'fechado', closed_at = now() WHERE id = NEW.ticket_id;
  ELSIF NEW.state = 'recusada' AND OLD.state <> 'recusada' THEN
    UPDATE public.tickets SET status = 'em_andamento' WHERE id = NEW.ticket_id;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER ticket_solutions_aiu
AFTER INSERT OR UPDATE OF state ON public.ticket_solutions
FOR EACH ROW EXECUTE FUNCTION public.solution_moves_ticket();

-- ---------------------------------------------------------------------------
-- APROVAÇÕES
-- ---------------------------------------------------------------------------

CREATE TABLE public.ticket_validations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approver_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  approver_group_id uuid REFERENCES public.user_groups(id) ON DELETE CASCADE,
  state public.validation_state NOT NULL DEFAULT 'aguardando',
  request_comment text NOT NULL DEFAULT '',
  answer_comment text NOT NULL DEFAULT '',
  requested_at timestamptz NOT NULL DEFAULT now(),
  answered_at timestamptz,
  CHECK (approver_user_id IS NOT NULL OR approver_group_id IS NOT NULL)
);

CREATE INDEX idx_ticket_validations_ticket ON public.ticket_validations(ticket_id);
CREATE INDEX idx_ticket_validations_approver ON public.ticket_validations(approver_user_id);

-- O estado geral do chamado segue o mínimo exigido: 0%, 50% ou 100%.
CREATE OR REPLACE FUNCTION public.recompute_validation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  target uuid := COALESCE(NEW.ticket_id, OLD.ticket_id);
  required smallint;
  total integer;
  granted integer;
  refused integer;
BEGIN
  SELECT validation_percent INTO required FROM public.tickets WHERE id = target;
  SELECT count(*),
         count(*) FILTER (WHERE state = 'aprovado'),
         count(*) FILTER (WHERE state = 'recusado')
    INTO total, granted, refused
    FROM public.ticket_validations WHERE ticket_id = target;

  IF total = 0 THEN
    UPDATE public.tickets SET validation_state = 'nao_sujeito' WHERE id = target;
  ELSIF required = 0 THEN
    UPDATE public.tickets SET validation_state = 'aprovado' WHERE id = target;
  ELSIF granted * 100 >= required * total THEN
    UPDATE public.tickets SET validation_state = 'aprovado' WHERE id = target;
  ELSIF refused > 0 AND (total - refused) * 100 < required * total THEN
    UPDATE public.tickets SET validation_state = 'recusado' WHERE id = target;
  ELSE
    UPDATE public.tickets SET validation_state = 'aguardando' WHERE id = target;
  END IF;

  RETURN NULL;
END; $$;

CREATE TRIGGER ticket_validations_recompute
AFTER INSERT OR UPDATE OR DELETE ON public.ticket_validations
FOR EACH ROW EXECUTE FUNCTION public.recompute_validation();

-- ---------------------------------------------------------------------------
-- VÍNCULOS, ITENS E CUSTOS
-- ---------------------------------------------------------------------------

CREATE TABLE public.ticket_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  linked_ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  link_type public.ticket_link_type NOT NULL DEFAULT 'ligado',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ticket_id, linked_ticket_id),
  CHECK (ticket_id <> linked_ticket_id)
);

CREATE TABLE public.ticket_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ticket_id, asset_id)
);

-- Traz o ativo único que o chamado já apontava.
INSERT INTO public.ticket_items (ticket_id, asset_id)
SELECT id, asset_id FROM public.tickets WHERE asset_id IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE TABLE public.ticket_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  begin_date date,
  end_date date,
  duration_minutes integer NOT NULL DEFAULT 0,
  cost_time numeric(12,2) NOT NULL DEFAULT 0,
  cost_fixed numeric(12,2) NOT NULL DEFAULT 0,
  cost_material numeric(12,2) NOT NULL DEFAULT 0,
  comment text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ticket_costs_ticket ON public.ticket_costs(ticket_id);

-- ---------------------------------------------------------------------------
-- DOCUMENTOS
-- ---------------------------------------------------------------------------

CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  filename text NOT NULL DEFAULT '',
  mime_type text NOT NULL DEFAULT '',
  size_bytes bigint NOT NULL DEFAULT 0,
  storage_path text NOT NULL,
  entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.document_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  UNIQUE (document_id, ticket_id)
);

DO $storage$
BEGIN
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('documentos', 'documentos', false)
  ON CONFLICT (id) DO NOTHING;

  EXECUTE $p$CREATE POLICY "documentos_read" ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'documentos')$p$;
  EXECUTE $p$CREATE POLICY "documentos_insert" ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'documentos' AND owner = auth.uid())$p$;
  EXECUTE $p$CREATE POLICY "documentos_delete" ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'documentos'
           AND (owner = auth.uid() OR public.has_right(auth.uid(),'document','delete')))$p$;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Bucket de documentos precisa ser criado a mao no painel: %', SQLERRM;
END $storage$;

-- ---------------------------------------------------------------------------
-- HISTÓRICO CAMPO A CAMPO
-- ---------------------------------------------------------------------------

CREATE TABLE public.item_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_type text NOT NULL,
  item_id uuid NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  field text NOT NULL,
  old_value text NOT NULL DEFAULT '',
  new_value text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_item_history_item ON public.item_history(item_type, item_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.log_ticket_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  watched text[] := ARRAY['title','description','status','type','category','urgency','impact',
                          'priority_level','assignee_id','requester_id','entity_id','asset_id',
                          'location_id','sector_id','validation_state','is_deleted'];
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

CREATE TRIGGER tickets_history_au
AFTER UPDATE ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.log_ticket_changes();

-- ---------------------------------------------------------------------------
-- LIXEIRA
-- ---------------------------------------------------------------------------

-- Excluir manda para a lixeira; purgar apaga de verdade.
DROP POLICY IF EXISTS "tickets_delete_admin" ON public.tickets;
CREATE POLICY "tickets_purge" ON public.tickets FOR DELETE TO authenticated
  USING (public.has_right_in_entity(auth.uid(), 'ticket', 'purge', entity_id));

-- ---------------------------------------------------------------------------
-- PERMISSÕES E RLS DAS TABELAS NOVAS
-- ---------------------------------------------------------------------------

ALTER TABLE public.priority_matrix ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.priority_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itil_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solution_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_actors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_solutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_validations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_history ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.priority_matrix, public.priority_levels TO authenticated, anon;
GRANT SELECT ON public.itil_categories, public.request_sources TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.itil_categories, public.task_categories, public.solution_types, public.request_sources,
  public.ticket_actors, public.ticket_tasks, public.ticket_solutions, public.ticket_validations,
  public.ticket_links, public.ticket_items, public.ticket_costs, public.documents,
  public.document_tickets TO authenticated;
GRANT UPDATE ON public.priority_matrix, public.priority_levels TO authenticated;
GRANT SELECT ON public.item_history TO authenticated;
GRANT ALL ON
  public.priority_matrix, public.priority_levels, public.itil_categories, public.task_categories,
  public.solution_types, public.request_sources, public.ticket_actors, public.ticket_tasks,
  public.ticket_solutions, public.ticket_validations, public.ticket_links, public.ticket_items,
  public.ticket_costs, public.documents, public.document_tickets, public.item_history TO service_role;

-- Catálogos: todo mundo lê, quem tem direito de lista suspensa escreve.
CREATE POLICY matrix_select ON public.priority_matrix FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY matrix_write ON public.priority_matrix FOR UPDATE TO authenticated
  USING (public.has_right(auth.uid(),'config','update'))
  WITH CHECK (public.has_right(auth.uid(),'config','update'));
CREATE POLICY levels_select ON public.priority_levels FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY levels_write ON public.priority_levels FOR UPDATE TO authenticated
  USING (public.has_right(auth.uid(),'config','update'))
  WITH CHECK (public.has_right(auth.uid(),'config','update'));

CREATE POLICY itil_categories_select ON public.itil_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY itil_categories_public ON public.itil_categories FOR SELECT TO anon USING (visible_helpdesk);
CREATE POLICY itil_categories_write ON public.itil_categories FOR ALL TO authenticated
  USING (public.has_right(auth.uid(),'dropdown','update'))
  WITH CHECK (public.has_right(auth.uid(),'dropdown','update'));

CREATE POLICY task_categories_select ON public.task_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY task_categories_write ON public.task_categories FOR ALL TO authenticated
  USING (public.has_right(auth.uid(),'dropdown','update'))
  WITH CHECK (public.has_right(auth.uid(),'dropdown','update'));

CREATE POLICY solution_types_select ON public.solution_types FOR SELECT TO authenticated USING (true);
CREATE POLICY solution_types_write ON public.solution_types FOR ALL TO authenticated
  USING (public.has_right(auth.uid(),'dropdown','update'))
  WITH CHECK (public.has_right(auth.uid(),'dropdown','update'));

CREATE POLICY request_sources_select ON public.request_sources FOR SELECT TO authenticated USING (true);
CREATE POLICY request_sources_public ON public.request_sources FOR SELECT TO anon USING (true);
CREATE POLICY request_sources_write ON public.request_sources FOR ALL TO authenticated
  USING (public.has_right(auth.uid(),'dropdown','update'))
  WITH CHECK (public.has_right(auth.uid(),'dropdown','update'));

-- Quem enxerga o chamado enxerga o que está pendurado nele.
CREATE OR REPLACE FUNCTION public.can_see_ticket(_ticket_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tickets t
     WHERE t.id = _ticket_id
       AND (t.requester_id = auth.uid() OR t.assignee_id = auth.uid() OR public.is_staff(auth.uid()))
  );
$$;
GRANT EXECUTE ON FUNCTION public.can_see_ticket(uuid) TO authenticated;

CREATE POLICY actors_select ON public.ticket_actors FOR SELECT TO authenticated
  USING (public.can_see_ticket(ticket_id));
CREATE POLICY actors_write ON public.ticket_actors FOR ALL TO authenticated
  USING (public.has_right(auth.uid(),'ticket','update'))
  WITH CHECK (public.has_right(auth.uid(),'ticket','update'));

CREATE POLICY tasks_select ON public.ticket_tasks FOR SELECT TO authenticated
  USING (
    public.can_see_ticket(ticket_id)
    AND (NOT is_private OR public.has_flag(auth.uid(),'followup_see_private') OR author_id = auth.uid())
  );
CREATE POLICY tasks_write ON public.ticket_tasks FOR ALL TO authenticated
  USING (public.has_right(auth.uid(),'task','update') OR author_id = auth.uid())
  WITH CHECK (public.has_right(auth.uid(),'task','create') OR author_id = auth.uid());

CREATE POLICY solutions_select ON public.ticket_solutions FOR SELECT TO authenticated
  USING (public.can_see_ticket(ticket_id));
CREATE POLICY solutions_write ON public.ticket_solutions FOR ALL TO authenticated
  USING (public.has_right(auth.uid(),'solution','update') OR public.can_see_ticket(ticket_id))
  WITH CHECK (public.has_right(auth.uid(),'solution','create') OR public.can_see_ticket(ticket_id));

CREATE POLICY validations_select ON public.ticket_validations FOR SELECT TO authenticated
  USING (public.can_see_ticket(ticket_id) OR approver_user_id = auth.uid());
CREATE POLICY validations_write ON public.ticket_validations FOR ALL TO authenticated
  USING (
    approver_user_id = auth.uid()
    OR public.has_flag(auth.uid(),'validation_request')
    OR public.has_right(auth.uid(),'validation','update')
  )
  WITH CHECK (
    approver_user_id = auth.uid()
    OR public.has_flag(auth.uid(),'validation_request')
    OR public.has_right(auth.uid(),'validation','create')
  );

CREATE POLICY links_select ON public.ticket_links FOR SELECT TO authenticated
  USING (public.can_see_ticket(ticket_id));
CREATE POLICY links_write ON public.ticket_links FOR ALL TO authenticated
  USING (public.has_right(auth.uid(),'ticket','update'))
  WITH CHECK (public.has_right(auth.uid(),'ticket','update'));

CREATE POLICY items_select ON public.ticket_items FOR SELECT TO authenticated
  USING (public.can_see_ticket(ticket_id));
CREATE POLICY items_write ON public.ticket_items FOR ALL TO authenticated
  USING (public.has_right(auth.uid(),'ticket','update'))
  WITH CHECK (public.has_right(auth.uid(),'ticket','update'));

CREATE POLICY costs_select ON public.ticket_costs FOR SELECT TO authenticated
  USING (public.can_see_ticket(ticket_id) AND public.has_right(auth.uid(),'financial_info','read'));
CREATE POLICY costs_write ON public.ticket_costs FOR ALL TO authenticated
  USING (public.has_right(auth.uid(),'financial_info','update'))
  WITH CHECK (public.has_right(auth.uid(),'financial_info','update'));

CREATE POLICY documents_select ON public.documents FOR SELECT TO authenticated
  USING (entity_id IN (SELECT public.visible_entity_ids(auth.uid())));
CREATE POLICY documents_write ON public.documents FOR ALL TO authenticated
  USING (uploaded_by = auth.uid() OR public.has_right(auth.uid(),'document','update'))
  WITH CHECK (uploaded_by = auth.uid() OR public.has_right(auth.uid(),'document','create'));

CREATE POLICY document_tickets_select ON public.document_tickets FOR SELECT TO authenticated
  USING (public.can_see_ticket(ticket_id));
CREATE POLICY document_tickets_write ON public.document_tickets FOR ALL TO authenticated
  USING (public.can_see_ticket(ticket_id))
  WITH CHECK (public.can_see_ticket(ticket_id));

CREATE POLICY history_select ON public.item_history FOR SELECT TO authenticated
  USING (item_type <> 'ticket' OR public.can_see_ticket(item_id));

-- ---------------------------------------------------------------------------
-- CARIMBO
-- ---------------------------------------------------------------------------

CREATE TRIGGER itil_categories_touch BEFORE UPDATE ON public.itil_categories
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER ticket_tasks_touch BEFORE UPDATE ON public.ticket_tasks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER ticket_comments_touch BEFORE UPDATE ON public.ticket_comments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
