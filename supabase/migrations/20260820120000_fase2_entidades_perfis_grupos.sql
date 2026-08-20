-- ============================================================================
-- FASE 2 — Entidades, perfis de acesso, grupos e autorizações
-- Reproduz o modelo do GLPI: árvore de entidades com herança, perfis com
-- matriz de direitos por objeto, matriz de ciclo de vida por perfil, grupos
-- e autorizações do usuário (perfil x entidade x recursividade).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- ENTIDADES
-- ---------------------------------------------------------------------------

CREATE TABLE public.entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  parent_id uuid REFERENCES public.entities(id) ON DELETE RESTRICT,
  -- caminho materializado '/raiz/filha/' usado para achar descendentes
  path text NOT NULL DEFAULT '',
  level integer NOT NULL DEFAULT 0,
  comment text NOT NULL DEFAULT '',
  -- aba Endereço do GLPI
  phone text NOT NULL DEFAULT '',
  administrative_number text NOT NULL DEFAULT '',
  fax text NOT NULL DEFAULT '',
  website text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  postal_code text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  state text NOT NULL DEFAULT '',
  country text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_entities_parent ON public.entities(parent_id);
CREATE INDEX idx_entities_path ON public.entities(path text_pattern_ops);

-- Mantém path e level coerentes com o pai, e propaga para os descendentes.
CREATE OR REPLACE FUNCTION public.entities_set_path()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  parent_path text;
  parent_level integer;
BEGIN
  IF NEW.parent_id IS NULL THEN
    NEW.path := '/' || NEW.id::text || '/';
    NEW.level := 0;
  ELSE
    SELECT e.path, e.level INTO parent_path, parent_level FROM public.entities e WHERE e.id = NEW.parent_id;
    IF parent_path IS NULL THEN
      RAISE EXCEPTION 'Entidade pai inexistente';
    END IF;
    IF NEW.id::text = ANY (string_to_array(trim(both '/' from parent_path), '/')) THEN
      RAISE EXCEPTION 'Uma entidade não pode ser filha de si mesma';
    END IF;
    NEW.path := parent_path || NEW.id::text || '/';
    NEW.level := parent_level + 1;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END; $$;

CREATE TRIGGER entities_path_biu
BEFORE INSERT OR UPDATE OF parent_id ON public.entities
FOR EACH ROW EXECUTE FUNCTION public.entities_set_path();

CREATE OR REPLACE FUNCTION public.entities_reparent_children()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.path IS DISTINCT FROM OLD.path THEN
    UPDATE public.entities
       SET path = NEW.path || substring(path from length(OLD.path) + 1),
           level = NEW.level + (level - OLD.level)
     WHERE path LIKE OLD.path || '_%';
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER entities_reparent_aiu
AFTER UPDATE ON public.entities
FOR EACH ROW
WHEN (NEW.path IS DISTINCT FROM OLD.path AND pg_trigger_depth() = 1)
EXECUTE FUNCTION public.entities_reparent_children();

INSERT INTO public.entities (name, comment) VALUES ('Entidade raiz', 'Entidade principal da instalação');

-- ---------------------------------------------------------------------------
-- CATÁLOGO DE DIREITOS
-- ---------------------------------------------------------------------------

CREATE TABLE public.right_definitions (
  key text PRIMARY KEY,
  label text NOT NULL,
  category text NOT NULL,
  sort integer NOT NULL DEFAULT 0,
  has_notes boolean NOT NULL DEFAULT true
);

INSERT INTO public.right_definitions (key, label, category, sort) VALUES
  ('computer','Computadores','ativos',10),
  ('monitor','Monitores','ativos',20),
  ('software','Softwares','ativos',30),
  ('networkequipment','Equipamentos de rede','ativos',40),
  ('peripheral','Periféricos','ativos',50),
  ('printer','Impressoras','ativos',60),
  ('cartridge','Cartuchos','ativos',70),
  ('consumable','Consumíveis','ativos',80),
  ('phone','Telefones','ativos',90),
  ('rack','Racks','ativos',100),
  ('enclosure','Gabinetes','ativos',110),
  ('pdu','PDUs','ativos',120),
  ('passivedevice','Dispositivos passivos','ativos',130),
  ('unmanaged','Ativos não gerenciados','ativos',140),
  ('cable','Cabos','ativos',150),
  ('sim','Cartões SIM','ativos',160),
  ('internet','Internet','ativos',170),

  ('ticket','Chamados','assistencia',10),
  ('followup','Acompanhamentos','assistencia',20),
  ('task','Tarefas','assistencia',30),
  ('validation','Aprovações','assistencia',40),
  ('solution','Soluções','assistencia',50),
  ('problem','Problemas','assistencia',60),
  ('change','Mudanças','assistencia',70),
  ('recurrent_ticket','Chamados recorrentes','assistencia',80),
  ('ticket_template','Modelos de chamado','assistencia',90),
  ('planning','Planejamento','assistencia',100),
  ('statistics','Estatísticas','assistencia',110),

  ('contract','Contratos','gestao',10),
  ('supplier','Fornecedores','gestao',20),
  ('contact','Contatos','gestao',30),
  ('license','Licenças','gestao',40),
  ('budget','Orçamentos','gestao',50),
  ('document','Documentos','gestao',60),
  ('certificate','Certificados','gestao',70),
  ('line','Linhas telefônicas','gestao',80),
  ('datacenter','Datacenters','gestao',90),
  ('cluster','Clusters','gestao',100),
  ('domain','Domínios','gestao',110),
  ('appliance','Appliances','gestao',120),
  ('database','Bancos de dados','gestao',130),
  ('financial_info','Informação financeira','gestao',140),

  ('knowledgebase','Base de conhecimento','ferramentas',10),
  ('faq','FAQ pública','ferramentas',20),
  ('project','Projetos','ferramentas',30),
  ('projecttask','Tarefas de projeto','ferramentas',40),
  ('reservation','Reservas','ferramentas',50),
  ('reminder','Lembretes','ferramentas',60),
  ('rssfeed','Feeds RSS','ferramentas',70),
  ('report','Relatórios','ferramentas',80),
  ('public_bookmark','Buscas salvas públicas','ferramentas',90),

  ('user','Usuários','administracao',10),
  ('group','Grupos','administracao',20),
  ('entity','Entidades','administracao',30),
  ('profile','Perfis','administracao',40),
  ('rule','Regras','administracao',50),
  ('dictionary','Dicionários','administracao',60),
  ('mailqueue','Fila de e-mails','administracao',70),
  ('log','Logs','administracao',80),
  ('form','Formulários','administracao',90),

  ('config','Configuração geral','configuracao',10),
  ('notification','Notificações','configuracao',20),
  ('sla','Níveis de serviço','configuracao',30),
  ('calendar','Calendários','configuracao',40),
  ('dropdown','Listas suspensas','configuracao',50),
  ('automatic_action','Ações automáticas','configuracao',60),
  ('external_link','Links externos','configuracao',70),
  ('field_unicity','Unicidade de campos','configuracao',80),
  ('asset_definition','Definições de ativo','configuracao',90),
  ('plugin','Plugins','configuracao',100);

-- Direitos granulares de assistência (as caixas extras do GLPI)
CREATE TABLE public.flag_definitions (
  key text PRIMARY KEY,
  label text NOT NULL,
  category text NOT NULL,
  sort integer NOT NULL DEFAULT 0
);

INSERT INTO public.flag_definitions (key, label, category, sort) VALUES
  ('ticket_see_all','Ver todos os chamados','assistencia',10),
  ('ticket_see_group','Ver os chamados do meu grupo','assistencia',20),
  ('ticket_assign','Atribuir um chamado','assistencia',30),
  ('ticket_steal','Roubar um chamado','assistencia',40),
  ('ticket_be_assigned','Poder ser atribuído a um chamado','assistencia',50),
  ('ticket_change_priority','Alterar a prioridade','assistencia',60),
  ('ticket_major_priority','Usar a prioridade Maior','assistencia',70),
  ('followup_see_private','Ver acompanhamentos e tarefas privados','assistencia',80),
  ('followup_add_all','Adicionar acompanhamento em qualquer chamado','assistencia',90),
  ('task_add_all','Adicionar tarefa em qualquer chamado','assistencia',100),
  ('validation_request','Solicitar aprovação','assistencia',110),
  ('validation_answer','Responder a uma aprovação','assistencia',120),
  ('ticket_delegate','Abrir chamado por delegação','assistencia',130);

-- ---------------------------------------------------------------------------
-- PERFIS DE ACESSO
-- ---------------------------------------------------------------------------

CREATE TYPE public.glpi_interface AS ENUM ('standard','simplified');

CREATE TABLE public.access_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  interface public.glpi_interface NOT NULL DEFAULT 'standard',
  is_default boolean NOT NULL DEFAULT false,
  -- perfis internos não podem ser apagados, para não trancar o sistema
  is_system boolean NOT NULL DEFAULT false,
  comment text NOT NULL DEFAULT '',
  sort integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.access_profiles (name, interface, is_default, is_system, sort, comment) VALUES
  ('Super-Admin','standard',false,true,10,'Todos os direitos, sem exceção'),
  ('Admin','standard',false,true,20,'Administra o sistema, com restrições em regras e entidades'),
  ('Supervisor','standard',false,true,30,'Técnico com gestão da equipe e distribuição de chamados'),
  ('Técnico','standard',false,true,40,'Trata chamados e consulta o inventário'),
  ('Hotliner','standard',false,true,50,'Abre e acompanha chamados, sem assumir o atendimento'),
  ('Observador','standard',false,true,60,'Leitura do inventário e da gestão'),
  ('Self-Service','simplified',true,true,70,'Colaborador: abre chamado, acompanha e consulta a FAQ');

CREATE TABLE public.profile_rights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.access_profiles(id) ON DELETE CASCADE,
  object_key text NOT NULL REFERENCES public.right_definitions(key) ON DELETE CASCADE,
  can_read boolean NOT NULL DEFAULT false,
  can_update boolean NOT NULL DEFAULT false,
  can_create boolean NOT NULL DEFAULT false,
  can_delete boolean NOT NULL DEFAULT false,
  can_purge boolean NOT NULL DEFAULT false,
  can_read_notes boolean NOT NULL DEFAULT false,
  can_update_notes boolean NOT NULL DEFAULT false,
  UNIQUE (profile_id, object_key)
);

CREATE INDEX idx_profile_rights_profile ON public.profile_rights(profile_id);

CREATE TABLE public.profile_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.access_profiles(id) ON DELETE CASCADE,
  flag_key text NOT NULL REFERENCES public.flag_definitions(key) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  UNIQUE (profile_id, flag_key)
);

-- Matriz de ciclo de vida: quais transições de status cada perfil pode fazer.
CREATE TABLE public.profile_lifecycle (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.access_profiles(id) ON DELETE CASCADE,
  object_type text NOT NULL DEFAULT 'ticket',
  from_status text NOT NULL,
  to_status text NOT NULL,
  allowed boolean NOT NULL DEFAULT true,
  UNIQUE (profile_id, object_type, from_status, to_status)
);

-- ---------------------------------------------------------------------------
-- SEMEADURA DOS DIREITOS DOS 7 PERFIS
-- ---------------------------------------------------------------------------

INSERT INTO public.profile_rights
  (profile_id, object_key, can_read, can_update, can_create, can_delete, can_purge, can_read_notes, can_update_notes)
SELECT
  p.id,
  r.key,
  -- LEITURA
  CASE p.name
    WHEN 'Super-Admin' THEN true
    WHEN 'Admin' THEN true
    WHEN 'Supervisor' THEN r.category IN ('ativos','assistencia','gestao','ferramentas')
                          OR r.key IN ('user','group')
    WHEN 'Técnico' THEN r.category IN ('ativos','assistencia')
                        OR r.key IN ('contract','supplier','document','license','knowledgebase','faq','reservation','reminder','project','report')
    WHEN 'Hotliner' THEN r.key IN ('ticket','followup','task','validation','solution','knowledgebase','faq','reminder','reservation','planning')
                         OR r.category = 'ativos'
    WHEN 'Observador' THEN r.category IN ('ativos','gestao')
                           OR r.key IN ('ticket','followup','solution','knowledgebase','faq','reminder','reservation','project','report','statistics')
    WHEN 'Self-Service' THEN r.key IN ('ticket','followup','solution','faq','reservation','reminder')
    ELSE false
  END,
  -- ATUALIZAÇÃO
  CASE p.name
    WHEN 'Super-Admin' THEN true
    WHEN 'Admin' THEN true
    WHEN 'Supervisor' THEN r.category = 'assistencia' OR r.key IN ('knowledgebase','faq','project','projecttask','reservation','reminder')
    WHEN 'Técnico' THEN r.category = 'ativos'
                        OR r.key IN ('ticket','followup','task','solution','knowledgebase','reservation','reminder')
    WHEN 'Hotliner' THEN r.key IN ('ticket','followup','reminder')
    WHEN 'Observador' THEN false
    WHEN 'Self-Service' THEN r.key IN ('reminder')
    ELSE false
  END,
  -- CRIAÇÃO
  CASE p.name
    WHEN 'Super-Admin' THEN true
    WHEN 'Admin' THEN true
    WHEN 'Supervisor' THEN r.category = 'assistencia' OR r.key IN ('knowledgebase','project','projecttask','reservation','reminder','document')
    WHEN 'Técnico' THEN r.category = 'ativos'
                        OR r.key IN ('ticket','followup','task','solution','knowledgebase','reservation','reminder','document')
    WHEN 'Hotliner' THEN r.key IN ('ticket','followup','reminder','document')
    WHEN 'Observador' THEN r.key IN ('ticket','followup','reminder')
    WHEN 'Self-Service' THEN r.key IN ('ticket','followup','reservation','reminder')
    ELSE false
  END,
  -- EXCLUSÃO (lixeira)
  CASE p.name
    WHEN 'Super-Admin' THEN true
    WHEN 'Admin' THEN r.key NOT IN ('entity','rule','profile')
    WHEN 'Supervisor' THEN r.key IN ('ticket','followup','task','knowledgebase','reminder','project','projecttask')
    WHEN 'Técnico' THEN r.key IN ('followup','task','reminder')
    ELSE false
  END,
  -- PURGA
  CASE p.name
    WHEN 'Super-Admin' THEN true
    WHEN 'Admin' THEN r.key NOT IN ('entity','rule','profile','financial_info')
    WHEN 'Supervisor' THEN r.key IN ('followup','task','reminder')
    ELSE false
  END,
  -- LER NOTAS
  CASE p.name
    WHEN 'Super-Admin' THEN true
    WHEN 'Admin' THEN true
    WHEN 'Supervisor' THEN r.category IN ('ativos','assistencia','gestao')
    WHEN 'Técnico' THEN r.category IN ('ativos','assistencia')
    WHEN 'Observador' THEN r.category IN ('ativos','gestao')
    ELSE false
  END,
  -- ATUALIZAR NOTAS
  CASE p.name
    WHEN 'Super-Admin' THEN true
    WHEN 'Admin' THEN true
    WHEN 'Supervisor' THEN r.category = 'assistencia'
    WHEN 'Técnico' THEN r.category IN ('ativos','assistencia')
    ELSE false
  END
FROM public.access_profiles p
CROSS JOIN public.right_definitions r;

INSERT INTO public.profile_flags (profile_id, flag_key, enabled)
SELECT
  p.id,
  f.key,
  CASE p.name
    WHEN 'Super-Admin' THEN true
    WHEN 'Admin' THEN true
    WHEN 'Supervisor' THEN true
    WHEN 'Técnico' THEN f.key IN ('ticket_see_group','ticket_be_assigned','ticket_change_priority',
                                  'followup_see_private','followup_add_all','task_add_all',
                                  'validation_request','validation_answer')
    WHEN 'Hotliner' THEN f.key IN ('ticket_see_group','followup_add_all','validation_request','ticket_delegate')
    WHEN 'Observador' THEN f.key IN ('ticket_see_group','validation_answer')
    WHEN 'Self-Service' THEN f.key IN ('ticket_delegate','validation_answer')
    ELSE false
  END
FROM public.access_profiles p
CROSS JOIN public.flag_definitions f;

-- Ciclo de vida dos chamados: por padrão tudo liberado para quem trata
-- chamados; o colaborador não muda status, e ninguém volta de Fechado.
INSERT INTO public.profile_lifecycle (profile_id, object_type, from_status, to_status, allowed)
SELECT
  p.id,
  'ticket',
  f.status,
  t.status,
  CASE
    WHEN f.status = t.status THEN true
    WHEN p.name = 'Super-Admin' THEN true
    WHEN p.name IN ('Observador','Self-Service') THEN false
    WHEN f.status = 'fechado' THEN p.name IN ('Admin')
    WHEN f.status = 'aberto' AND t.status = 'aguardando' THEN false
    ELSE true
  END
FROM public.access_profiles p
CROSS JOIN (VALUES ('aberto'),('em_andamento'),('aguardando'),('resolvido'),('fechado')) AS f(status)
CROSS JOIN (VALUES ('aberto'),('em_andamento'),('aguardando'),('resolvido'),('fechado')) AS t(status);

-- ---------------------------------------------------------------------------
-- GRUPOS
-- ---------------------------------------------------------------------------

CREATE TABLE public.user_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  parent_id uuid REFERENCES public.user_groups(id) ON DELETE RESTRICT,
  entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  is_recursive boolean NOT NULL DEFAULT false,
  -- as caixas de característica do grupo no GLPI
  visible_in_ticket boolean NOT NULL DEFAULT true,
  can_be_notified boolean NOT NULL DEFAULT true,
  can_be_manager boolean NOT NULL DEFAULT false,
  contains_assets boolean NOT NULL DEFAULT false,
  contains_users boolean NOT NULL DEFAULT true,
  comment text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_groups_entity ON public.user_groups(entity_id);
CREATE INDEX idx_user_groups_parent ON public.user_groups(parent_id);

CREATE TABLE public.group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.user_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_manager boolean NOT NULL DEFAULT false,
  is_delegate boolean NOT NULL DEFAULT false,
  UNIQUE (group_id, user_id)
);

CREATE INDEX idx_group_members_user ON public.group_members(user_id);

-- ---------------------------------------------------------------------------
-- AUTORIZAÇÕES DO USUÁRIO  (perfil x entidade x recursividade)
-- ---------------------------------------------------------------------------

CREATE TABLE public.user_authorizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.access_profiles(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  is_recursive boolean NOT NULL DEFAULT true,
  -- 'D' do GLPI: autorização criada por regra, não à mão
  is_dynamic boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, profile_id, entity_id)
);

CREATE INDEX idx_user_authorizations_user ON public.user_authorizations(user_id);

-- Substitutos autorizados (respondem pelas aprovações na ausência)
CREATE TABLE public.user_substitutes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  substitute_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_date date,
  end_date date,
  UNIQUE (user_id, substitute_id),
  CHECK (user_id <> substitute_id)
);

-- ---------------------------------------------------------------------------
-- FUNÇÕES DE AUTORIZAÇÃO
-- ---------------------------------------------------------------------------

-- Entidades que o usuário enxerga: as das suas autorizações e, quando a
-- autorização é recursiva, todas as descendentes.
CREATE OR REPLACE FUNCTION public.visible_entity_ids(_user_id uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT e.id
    FROM public.user_authorizations ua
    JOIN public.entities ae ON ae.id = ua.entity_id
    JOIN public.entities e
      ON e.id = ae.id
      OR (ua.is_recursive AND e.path LIKE ae.path || '%')
   WHERE ua.user_id = _user_id;
$$;

-- O usuário tem determinada ação sobre determinado objeto, em qualquer entidade?
CREATE OR REPLACE FUNCTION public.has_right(_user_id uuid, _object text, _action text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.user_authorizations ua
      JOIN public.profile_rights pr ON pr.profile_id = ua.profile_id
     WHERE ua.user_id = _user_id
       AND pr.object_key = _object
       AND CASE _action
             WHEN 'read' THEN pr.can_read
             WHEN 'update' THEN pr.can_update
             WHEN 'create' THEN pr.can_create
             WHEN 'delete' THEN pr.can_delete
             WHEN 'purge' THEN pr.can_purge
             WHEN 'read_notes' THEN pr.can_read_notes
             WHEN 'update_notes' THEN pr.can_update_notes
             ELSE false
           END
  );
$$;

-- Mesma pergunta, restrita a uma entidade: a autorização que concede o
-- direito precisa cobrir aquela entidade.
CREATE OR REPLACE FUNCTION public.has_right_in_entity(_user_id uuid, _object text, _action text, _entity_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.user_authorizations ua
      JOIN public.profile_rights pr ON pr.profile_id = ua.profile_id
      JOIN public.entities ae ON ae.id = ua.entity_id
      JOIN public.entities target ON target.id = _entity_id
     WHERE ua.user_id = _user_id
       AND pr.object_key = _object
       AND (target.id = ae.id OR (ua.is_recursive AND target.path LIKE ae.path || '%'))
       AND CASE _action
             WHEN 'read' THEN pr.can_read
             WHEN 'update' THEN pr.can_update
             WHEN 'create' THEN pr.can_create
             WHEN 'delete' THEN pr.can_delete
             WHEN 'purge' THEN pr.can_purge
             ELSE false
           END
  );
$$;

CREATE OR REPLACE FUNCTION public.has_flag(_user_id uuid, _flag text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.user_authorizations ua
      JOIN public.profile_flags pf ON pf.profile_id = ua.profile_id
     WHERE ua.user_id = _user_id AND pf.flag_key = _flag AND pf.enabled
  );
$$;

CREATE OR REPLACE FUNCTION public.has_profile(_user_id uuid, _profile_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.user_authorizations ua
      JOIN public.access_profiles p ON p.id = ua.profile_id
     WHERE ua.user_id = _user_id AND p.name = _profile_name
  );
$$;

-- ---------------------------------------------------------------------------
-- MIGRAÇÃO DOS PAPÉIS ANTIGOS  (user_roles -> user_authorizations)
-- ---------------------------------------------------------------------------

INSERT INTO public.user_authorizations (user_id, profile_id, entity_id, is_recursive)
SELECT DISTINCT
  ur.user_id,
  (SELECT id FROM public.access_profiles WHERE name = CASE ur.role
      WHEN 'admin' THEN 'Super-Admin'
      WHEN 'tecnico' THEN 'Técnico'
      ELSE 'Self-Service'
   END),
  (SELECT id FROM public.entities WHERE parent_id IS NULL ORDER BY created_at LIMIT 1),
  true
FROM public.user_roles ur
ON CONFLICT DO NOTHING;

-- As funções antigas passam a ler o modelo novo, para que nenhuma política
-- existente quebre. has_role continua respondendo pelos três papéis antigos.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE _role
    WHEN 'admin' THEN public.has_profile(_user_id, 'Super-Admin') OR public.has_profile(_user_id, 'Admin')
    WHEN 'tecnico' THEN public.has_right(_user_id, 'ticket', 'update')
    ELSE EXISTS (SELECT 1 FROM public.user_authorizations WHERE user_id = _user_id)
  END;
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_right(_user_id, 'ticket', 'update');
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.visible_entity_ids(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_right(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_right_in_entity(uuid, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_flag(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_profile(uuid, text) TO authenticated;

-- Novo usuário: primeiro vira Super-Admin, os demais entram como Self-Service
-- na entidade raiz. Mantém o user_roles preenchido para compatibilidade.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  first_user boolean;
  root_entity uuid;
  target_profile uuid;
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id,
          COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),
          COALESCE(NEW.email,''))
  ON CONFLICT (id) DO NOTHING;

  SELECT NOT EXISTS (SELECT 1 FROM public.user_authorizations) INTO first_user;
  SELECT id INTO root_entity FROM public.entities WHERE parent_id IS NULL ORDER BY created_at LIMIT 1;
  SELECT id INTO target_profile FROM public.access_profiles
   WHERE name = CASE WHEN first_user THEN 'Super-Admin' ELSE 'Self-Service' END;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN first_user THEN 'admin'::public.app_role ELSE 'usuario'::public.app_role END)
  ON CONFLICT DO NOTHING;

  IF root_entity IS NOT NULL AND target_profile IS NOT NULL THEN
    INSERT INTO public.user_authorizations (user_id, profile_id, entity_id, is_recursive)
    VALUES (NEW.id, target_profile, root_entity, true)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END; $$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- VÍNCULO DAS TABELAS EXISTENTES COM A ENTIDADE
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  root_entity uuid;
BEGIN
  SELECT id INTO root_entity FROM public.entities WHERE parent_id IS NULL ORDER BY created_at LIMIT 1;

  ALTER TABLE public.tickets     ADD COLUMN IF NOT EXISTS entity_id uuid REFERENCES public.entities(id) ON DELETE RESTRICT;
  ALTER TABLE public.assets      ADD COLUMN IF NOT EXISTS entity_id uuid REFERENCES public.entities(id) ON DELETE RESTRICT;
  ALTER TABLE public.locations   ADD COLUMN IF NOT EXISTS entity_id uuid REFERENCES public.entities(id) ON DELETE RESTRICT;
  ALTER TABLE public.sectors     ADD COLUMN IF NOT EXISTS entity_id uuid REFERENCES public.entities(id) ON DELETE RESTRICT;
  ALTER TABLE public.suppliers   ADD COLUMN IF NOT EXISTS entity_id uuid REFERENCES public.entities(id) ON DELETE RESTRICT;
  ALTER TABLE public.kb_articles ADD COLUMN IF NOT EXISTS entity_id uuid REFERENCES public.entities(id) ON DELETE RESTRICT;

  EXECUTE format('UPDATE public.tickets     SET entity_id = %L WHERE entity_id IS NULL', root_entity);
  EXECUTE format('UPDATE public.assets      SET entity_id = %L WHERE entity_id IS NULL', root_entity);
  EXECUTE format('UPDATE public.locations   SET entity_id = %L WHERE entity_id IS NULL', root_entity);
  EXECUTE format('UPDATE public.sectors     SET entity_id = %L WHERE entity_id IS NULL', root_entity);
  EXECUTE format('UPDATE public.suppliers   SET entity_id = %L WHERE entity_id IS NULL', root_entity);
  EXECUTE format('UPDATE public.kb_articles SET entity_id = %L WHERE entity_id IS NULL', root_entity);

  EXECUTE format('ALTER TABLE public.tickets     ALTER COLUMN entity_id SET DEFAULT %L', root_entity);
  EXECUTE format('ALTER TABLE public.assets      ALTER COLUMN entity_id SET DEFAULT %L', root_entity);
  EXECUTE format('ALTER TABLE public.locations   ALTER COLUMN entity_id SET DEFAULT %L', root_entity);
  EXECUTE format('ALTER TABLE public.sectors     ALTER COLUMN entity_id SET DEFAULT %L', root_entity);
  EXECUTE format('ALTER TABLE public.suppliers   ALTER COLUMN entity_id SET DEFAULT %L', root_entity);
  EXECUTE format('ALTER TABLE public.kb_articles ALTER COLUMN entity_id SET DEFAULT %L', root_entity);
END $$;

ALTER TABLE public.tickets     ALTER COLUMN entity_id SET NOT NULL;
ALTER TABLE public.assets      ALTER COLUMN entity_id SET NOT NULL;
ALTER TABLE public.locations   ALTER COLUMN entity_id SET NOT NULL;
ALTER TABLE public.sectors     ALTER COLUMN entity_id SET NOT NULL;
ALTER TABLE public.suppliers   ALTER COLUMN entity_id SET NOT NULL;
ALTER TABLE public.kb_articles ALTER COLUMN entity_id SET NOT NULL;

CREATE INDEX idx_tickets_entity ON public.tickets(entity_id);
CREATE INDEX idx_assets_entity ON public.assets(entity_id);

-- Chamados passam a respeitar a entidade, mantendo a regra antiga de quem vê o quê.
DROP POLICY IF EXISTS "tickets_select" ON public.tickets;
CREATE POLICY "tickets_select" ON public.tickets FOR SELECT TO authenticated
  USING (
    entity_id IN (SELECT public.visible_entity_ids(auth.uid()))
    AND (
      requester_id = auth.uid()
      OR assignee_id = auth.uid()
      OR public.has_flag(auth.uid(), 'ticket_see_all')
      OR public.is_staff(auth.uid())
    )
  );

DROP POLICY IF EXISTS "tickets_update_staff" ON public.tickets;
CREATE POLICY "tickets_update_staff" ON public.tickets FOR UPDATE TO authenticated
  USING (public.has_right_in_entity(auth.uid(), 'ticket', 'update', entity_id))
  WITH CHECK (public.has_right_in_entity(auth.uid(), 'ticket', 'update', entity_id));

DROP POLICY IF EXISTS "assets_select" ON public.assets;
CREATE POLICY "assets_select" ON public.assets FOR SELECT TO authenticated
  USING (entity_id IN (SELECT public.visible_entity_ids(auth.uid())));

-- ---------------------------------------------------------------------------
-- RLS DAS TABELAS NOVAS
-- ---------------------------------------------------------------------------

ALTER TABLE public.entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.right_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flag_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_rights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_lifecycle ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_authorizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_substitutes ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.entities, public.access_profiles, public.profile_rights, public.profile_flags,
  public.profile_lifecycle, public.user_groups, public.group_members,
  public.user_authorizations, public.user_substitutes TO authenticated;
GRANT SELECT ON public.right_definitions, public.flag_definitions TO authenticated;
GRANT ALL ON
  public.entities, public.access_profiles, public.right_definitions, public.flag_definitions,
  public.profile_rights, public.profile_flags, public.profile_lifecycle, public.user_groups,
  public.group_members, public.user_authorizations, public.user_substitutes TO service_role;

-- Catálogos: leitura para qualquer autenticado (a interface precisa deles).
CREATE POLICY rights_def_select ON public.right_definitions FOR SELECT TO authenticated USING (true);
CREATE POLICY flags_def_select ON public.flag_definitions FOR SELECT TO authenticated USING (true);

-- Entidades: vê as suas; só administra quem tem o direito.
CREATE POLICY entities_select ON public.entities FOR SELECT TO authenticated
  USING (id IN (SELECT public.visible_entity_ids(auth.uid())));
CREATE POLICY entities_insert ON public.entities FOR INSERT TO authenticated
  WITH CHECK (public.has_right(auth.uid(), 'entity', 'create'));
CREATE POLICY entities_update ON public.entities FOR UPDATE TO authenticated
  USING (public.has_right(auth.uid(), 'entity', 'update'))
  WITH CHECK (public.has_right(auth.uid(), 'entity', 'update'));
CREATE POLICY entities_delete ON public.entities FOR DELETE TO authenticated
  USING (public.has_right(auth.uid(), 'entity', 'delete') AND parent_id IS NOT NULL);

-- Perfis e seus direitos.
CREATE POLICY profiles_select ON public.access_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY profiles_write ON public.access_profiles FOR ALL TO authenticated
  USING (public.has_right(auth.uid(), 'profile', 'update'))
  WITH CHECK (public.has_right(auth.uid(), 'profile', 'update'));

CREATE POLICY profile_rights_select ON public.profile_rights FOR SELECT TO authenticated USING (true);
CREATE POLICY profile_rights_write ON public.profile_rights FOR ALL TO authenticated
  USING (public.has_right(auth.uid(), 'profile', 'update'))
  WITH CHECK (public.has_right(auth.uid(), 'profile', 'update'));

CREATE POLICY profile_flags_select ON public.profile_flags FOR SELECT TO authenticated USING (true);
CREATE POLICY profile_flags_write ON public.profile_flags FOR ALL TO authenticated
  USING (public.has_right(auth.uid(), 'profile', 'update'))
  WITH CHECK (public.has_right(auth.uid(), 'profile', 'update'));

CREATE POLICY profile_lifecycle_select ON public.profile_lifecycle FOR SELECT TO authenticated USING (true);
CREATE POLICY profile_lifecycle_write ON public.profile_lifecycle FOR ALL TO authenticated
  USING (public.has_right(auth.uid(), 'profile', 'update'))
  WITH CHECK (public.has_right(auth.uid(), 'profile', 'update'));

-- Grupos.
CREATE POLICY groups_select ON public.user_groups FOR SELECT TO authenticated
  USING (entity_id IN (SELECT public.visible_entity_ids(auth.uid())));
CREATE POLICY groups_write ON public.user_groups FOR ALL TO authenticated
  USING (public.has_right(auth.uid(), 'group', 'update'))
  WITH CHECK (public.has_right(auth.uid(), 'group', 'update'));

CREATE POLICY group_members_select ON public.group_members FOR SELECT TO authenticated USING (true);
CREATE POLICY group_members_write ON public.group_members FOR ALL TO authenticated
  USING (public.has_right(auth.uid(), 'group', 'update'))
  WITH CHECK (public.has_right(auth.uid(), 'group', 'update'));

-- Autorizações: cada um vê as suas; administra quem tem direito sobre usuários.
CREATE POLICY authorizations_select ON public.user_authorizations FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_right(auth.uid(), 'user', 'read'));
CREATE POLICY authorizations_write ON public.user_authorizations FOR ALL TO authenticated
  USING (public.has_right(auth.uid(), 'user', 'update'))
  WITH CHECK (public.has_right(auth.uid(), 'user', 'update'));

CREATE POLICY substitutes_select ON public.user_substitutes FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR substitute_id = auth.uid() OR public.has_right(auth.uid(), 'user', 'read'));
CREATE POLICY substitutes_write ON public.user_substitutes FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.has_right(auth.uid(), 'user', 'update'))
  WITH CHECK (user_id = auth.uid() OR public.has_right(auth.uid(), 'user', 'update'));

-- ---------------------------------------------------------------------------
-- RESUMO DAS PERMISSÕES PARA A INTERFACE
-- ---------------------------------------------------------------------------

-- Uma chamada só devolve tudo que a tela precisa saber sobre o usuário atual.
CREATE OR REPLACE FUNCTION public.my_permissions()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'profiles', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.name, 'interface', p.interface,
        'entity_id', ua.entity_id, 'entity_name', e.name, 'is_recursive', ua.is_recursive
      ) ORDER BY p.sort)
      FROM public.user_authorizations ua
      JOIN public.access_profiles p ON p.id = ua.profile_id
      JOIN public.entities e ON e.id = ua.entity_id
      WHERE ua.user_id = auth.uid()
    ), '[]'::jsonb),
    'rights', COALESCE((
      SELECT jsonb_object_agg(t.object_key, jsonb_build_object(
        'read', t.can_read, 'update', t.can_update, 'create', t.can_create,
        'delete', t.can_delete, 'purge', t.can_purge
      ))
      FROM (
        SELECT pr.object_key,
               bool_or(pr.can_read) AS can_read,
               bool_or(pr.can_update) AS can_update,
               bool_or(pr.can_create) AS can_create,
               bool_or(pr.can_delete) AS can_delete,
               bool_or(pr.can_purge) AS can_purge
          FROM public.user_authorizations ua
          JOIN public.profile_rights pr ON pr.profile_id = ua.profile_id
         WHERE ua.user_id = auth.uid()
         GROUP BY pr.object_key
      ) t
    ), '{}'::jsonb),
    'flags', COALESCE((
      SELECT jsonb_agg(DISTINCT pf.flag_key)
        FROM public.user_authorizations ua
        JOIN public.profile_flags pf ON pf.profile_id = ua.profile_id
       WHERE ua.user_id = auth.uid() AND pf.enabled
    ), '[]'::jsonb),
    'entities', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', e.id, 'name', e.name, 'level', e.level, 'path', e.path)
             ORDER BY e.path)
        FROM public.entities e
       WHERE e.id IN (SELECT public.visible_entity_ids(auth.uid()))
    ), '[]'::jsonb)
  );
$$;

REVOKE ALL ON FUNCTION public.my_permissions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_permissions() TO authenticated;

-- ---------------------------------------------------------------------------
-- CARIMBO DE ATUALIZAÇÃO
-- ---------------------------------------------------------------------------

CREATE TRIGGER entities_touch BEFORE UPDATE ON public.entities
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER access_profiles_touch BEFORE UPDATE ON public.access_profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER user_groups_touch BEFORE UPDATE ON public.user_groups
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
