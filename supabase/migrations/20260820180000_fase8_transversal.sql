-- ============================================================================
-- FASE 8 — Acabamento transversal
-- Buscas salvas com contador e alerta, dicionários, unicidade de campos,
-- log de auditoria do sistema e painéis configuráveis. É o que faz o uso
-- diário parecer o GLPI: toda lista pesquisa igual, exporta igual e guarda
-- a pesquisa favorita.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- BUSCAS SALVAS
-- ---------------------------------------------------------------------------

CREATE TABLE public.saved_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  item_type text NOT NULL,
  -- os critérios no mesmo formato da barra de pesquisa: campo, operador, valor
  criteria jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_public boolean NOT NULL DEFAULT false,
  is_default boolean NOT NULL DEFAULT false,
  -- o contador do GLPI, que aparece no painel
  show_counter boolean NOT NULL DEFAULT false,
  alert_threshold integer,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_id uuid REFERENCES public.entities(id) ON DELETE CASCADE,
  sort integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_saved_searches_user ON public.saved_searches(user_id, item_type);

-- Uma busca padrão por tipo de objeto, por usuário.
CREATE UNIQUE INDEX idx_saved_searches_default
  ON public.saved_searches(user_id, item_type)
  WHERE is_default;

-- ---------------------------------------------------------------------------
-- DICIONÁRIOS
-- ---------------------------------------------------------------------------

-- Normalizam o que entra: "DELL INC." e "Dell Inc" viram "Dell".
CREATE TABLE public.dictionaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  target text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  comment text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.dictionaries (name, target, comment) VALUES
  ('Fabricantes', 'manufacturer', 'Unifica variações do nome do fabricante'),
  ('Softwares', 'software', 'Unifica nomes de software com sufixos de versão'),
  ('Modelos', 'model', 'Padroniza nomes de modelo'),
  ('Sistemas operacionais', 'operating_system', 'Padroniza a nomenclatura do SO');

CREATE TABLE public.dictionary_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dictionary_id uuid NOT NULL REFERENCES public.dictionaries(id) ON DELETE CASCADE,
  match_value text NOT NULL,
  replace_value text NOT NULL,
  is_regex boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort integer NOT NULL DEFAULT 100
);

CREATE INDEX idx_dictionary_entries_dictionary ON public.dictionary_entries(dictionary_id);

/** Aplica o dicionário a um texto e devolve o valor normalizado. */
CREATE OR REPLACE FUNCTION public.apply_dictionary(_target text, _value text)
RETURNS text LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE
  entry record;
  result text := _value;
BEGIN
  IF _value IS NULL OR length(trim(_value)) = 0 THEN
    RETURN _value;
  END IF;

  FOR entry IN
    SELECT e.*
      FROM public.dictionary_entries e
      JOIN public.dictionaries d ON d.id = e.dictionary_id
     WHERE d.target = _target AND d.is_active AND e.is_active
     ORDER BY e.sort
  LOOP
    IF entry.is_regex THEN
      IF result ~* entry.match_value THEN
        result := entry.replace_value;
        EXIT;
      END IF;
    ELSIF lower(trim(result)) = lower(trim(entry.match_value)) THEN
      result := entry.replace_value;
      EXIT;
    END IF;
  END LOOP;

  RETURN result;
END; $$;

GRANT EXECUTE ON FUNCTION public.apply_dictionary(text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- UNICIDADE DE CAMPOS
-- ---------------------------------------------------------------------------

CREATE TABLE public.field_unicity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  item_type text NOT NULL DEFAULT 'asset',
  fields text[] NOT NULL DEFAULT ARRAY[]::text[],
  is_active boolean NOT NULL DEFAULT true,
  -- bloquear recusa o registro; avisar apenas registra no log
  action text NOT NULL DEFAULT 'bloquear' CHECK (action IN ('bloquear','avisar')),
  comment text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.field_unicity (name, item_type, fields, action, comment) VALUES
  ('Número de série do ativo', 'asset', ARRAY['serial_number'], 'avisar',
   'Dois ativos com o mesmo número de série normalmente são o mesmo equipamento'),
  ('Patrimônio do ativo', 'asset', ARRAY['asset_tag'], 'bloquear',
   'O número de patrimônio não se repete');

/** Recusa ou avisa quando o valor já existe em outro ativo. */
CREATE OR REPLACE FUNCTION public.check_asset_unicity()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  rule record;
  field text;
  value text;
  duplicated boolean;
BEGIN
  FOR rule IN SELECT * FROM public.field_unicity WHERE is_active AND item_type = 'asset' LOOP
    FOREACH field IN ARRAY rule.fields LOOP
      EXECUTE format('SELECT ($1).%I::text', field) INTO value USING NEW;
      CONTINUE WHEN value IS NULL OR length(trim(value)) = 0;

      EXECUTE format(
        'SELECT EXISTS (SELECT 1 FROM public.assets WHERE %I = $1 AND id <> $2 AND NOT is_deleted)',
        field
      ) INTO duplicated USING value, NEW.id;

      IF duplicated THEN
        IF rule.action = 'bloquear' THEN
          RAISE EXCEPTION 'Já existe um ativo com % igual a "%"', field, value;
        ELSE
          INSERT INTO public.item_history (item_type, item_id, user_id, field, old_value, new_value)
          VALUES ('asset', NEW.id, auth.uid(), 'unicidade', field, value);
        END IF;
      END IF;
    END LOOP;
  END LOOP;

  RETURN NEW;
END; $$;

CREATE TRIGGER assets_unicity
BEFORE INSERT OR UPDATE OF serial_number, asset_tag ON public.assets
FOR EACH ROW EXECUTE FUNCTION public.check_asset_unicity();

-- ---------------------------------------------------------------------------
-- LOG DE AUDITORIA DO SISTEMA
-- ---------------------------------------------------------------------------

CREATE TABLE public.system_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  item_type text NOT NULL DEFAULT '',
  item_id uuid,
  detail text NOT NULL DEFAULT '',
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info','aviso','erro')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_system_logs_created ON public.system_logs(created_at DESC);

/** Registro genérico, chamado pela interface nas ações que importam. */
CREATE OR REPLACE FUNCTION public.log_system(
  _action text,
  _item_type text DEFAULT '',
  _item_id uuid DEFAULT NULL,
  _detail text DEFAULT '',
  _severity text DEFAULT 'info'
) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.system_logs (user_id, action, item_type, item_id, detail, severity)
  VALUES (auth.uid(), _action, _item_type, _item_id, _detail, _severity);
$$;

GRANT EXECUTE ON FUNCTION public.log_system(text, text, uuid, text, text) TO authenticated;

-- Alterações de perfil e de entidade entram no log automaticamente.
CREATE OR REPLACE FUNCTION public.log_sensitive_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.system_logs (user_id, action, item_type, item_id, detail, severity)
  VALUES (
    auth.uid(),
    lower(TG_OP),
    TG_TABLE_NAME,
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
    CASE WHEN TG_OP = 'DELETE' THEN 'registro removido' ELSE 'registro alterado' END,
    'aviso'
  );
  RETURN NULL;
END; $$;

CREATE TRIGGER access_profiles_log
AFTER INSERT OR UPDATE OR DELETE ON public.access_profiles
FOR EACH ROW EXECUTE FUNCTION public.log_sensitive_change();

CREATE TRIGGER user_authorizations_log
AFTER INSERT OR DELETE ON public.user_authorizations
FOR EACH ROW EXECUTE FUNCTION public.log_sensitive_change();

CREATE TRIGGER entities_log
AFTER INSERT OR UPDATE OR DELETE ON public.entities
FOR EACH ROW EXECUTE FUNCTION public.log_sensitive_change();

-- ---------------------------------------------------------------------------
-- PAINÉIS CONFIGURÁVEIS
-- ---------------------------------------------------------------------------

CREATE TABLE public.dashboards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  is_public boolean NOT NULL DEFAULT false,
  is_default boolean NOT NULL DEFAULT false,
  -- lista de blocos escolhidos, na ordem em que aparecem
  widgets jsonb NOT NULL DEFAULT '[]'::jsonb,
  entity_id uuid REFERENCES public.entities(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- DIREITOS NOVOS
-- ---------------------------------------------------------------------------

INSERT INTO public.right_definitions (key, label, category, sort) VALUES
  ('dashboard','Painéis','ferramentas',95),
  ('saved_search','Buscas salvas','ferramentas',100)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.profile_rights
  (profile_id, object_key, can_read, can_update, can_create, can_delete, can_purge)
SELECT p.id, r.key, true, true, true,
       p.name IN ('Super-Admin','Admin','Supervisor'),
       p.name IN ('Super-Admin')
FROM public.access_profiles p
CROSS JOIN (VALUES ('dashboard'),('saved_search')) AS r(key)
ON CONFLICT (profile_id, object_key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dictionaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dictionary_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.field_unicity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboards ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.saved_searches, public.dictionaries, public.dictionary_entries,
  public.field_unicity, public.dashboards TO authenticated;
GRANT SELECT ON public.system_logs TO authenticated;
GRANT ALL ON
  public.saved_searches, public.dictionaries, public.dictionary_entries,
  public.field_unicity, public.system_logs, public.dashboards TO service_role;

-- Cada um enxerga as suas buscas e as públicas.
CREATE POLICY saved_searches_select ON public.saved_searches FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_public);
CREATE POLICY saved_searches_write ON public.saved_searches FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.has_right(auth.uid(),'public_bookmark','update'))
  WITH CHECK (user_id = auth.uid() OR public.has_right(auth.uid(),'public_bookmark','update'));

CREATE POLICY dashboards_select ON public.dashboards FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_public);
CREATE POLICY dashboards_write ON public.dashboards FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY dictionaries_select ON public.dictionaries FOR SELECT TO authenticated
  USING (public.has_right(auth.uid(),'dictionary','read'));
CREATE POLICY dictionaries_write ON public.dictionaries FOR ALL TO authenticated
  USING (public.has_right(auth.uid(),'dictionary','update'))
  WITH CHECK (public.has_right(auth.uid(),'dictionary','update'));

CREATE POLICY dictionary_entries_select ON public.dictionary_entries FOR SELECT TO authenticated
  USING (public.has_right(auth.uid(),'dictionary','read'));
CREATE POLICY dictionary_entries_write ON public.dictionary_entries FOR ALL TO authenticated
  USING (public.has_right(auth.uid(),'dictionary','update'))
  WITH CHECK (public.has_right(auth.uid(),'dictionary','update'));

CREATE POLICY field_unicity_select ON public.field_unicity FOR SELECT TO authenticated
  USING (public.has_right(auth.uid(),'field_unicity','read'));
CREATE POLICY field_unicity_write ON public.field_unicity FOR ALL TO authenticated
  USING (public.has_right(auth.uid(),'field_unicity','update'))
  WITH CHECK (public.has_right(auth.uid(),'field_unicity','update'));

CREATE POLICY system_logs_select ON public.system_logs FOR SELECT TO authenticated
  USING (public.has_right(auth.uid(),'log','read'));

-- ---------------------------------------------------------------------------
-- CARIMBO
-- ---------------------------------------------------------------------------

CREATE TRIGGER saved_searches_touch BEFORE UPDATE ON public.saved_searches
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER dashboards_touch BEFORE UPDATE ON public.dashboards
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
