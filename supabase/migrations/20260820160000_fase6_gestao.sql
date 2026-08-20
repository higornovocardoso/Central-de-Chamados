-- ============================================================================
-- FASE 6 — Gestão
-- Contratos, contatos, orçamentos, certificados, linhas telefônicas,
-- datacenters, clusters, domínios, appliances e bancos de dados — mais o
-- vínculo genérico de documentos com qualquer objeto.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- FORNECEDORES E CONTATOS
-- ---------------------------------------------------------------------------

CREATE TABLE public.supplier_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  comment text NOT NULL DEFAULT ''
);

INSERT INTO public.supplier_types (name) VALUES
  ('Revendedor'), ('Fabricante'), ('Prestador de serviço'), ('Operadora'), ('Software house');

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS supplier_type_id uuid REFERENCES public.supplier_types(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS document text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS website text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS address text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS city text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS state text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS postal_code text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;

CREATE TABLE public.contact_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE
);

INSERT INTO public.contact_types (name) VALUES
  ('Comercial'), ('Suporte técnico'), ('Financeiro'), ('Gerente de conta');

CREATE TABLE public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  first_name text NOT NULL DEFAULT '',
  contact_type_id uuid REFERENCES public.contact_types(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  phone2 text NOT NULL DEFAULT '',
  mobile text NOT NULL DEFAULT '',
  fax text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  comment text NOT NULL DEFAULT '',
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.contact_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  UNIQUE (contact_id, supplier_id)
);

-- ---------------------------------------------------------------------------
-- ORÇAMENTOS
-- ---------------------------------------------------------------------------

CREATE TABLE public.budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  value numeric(14,2) NOT NULL DEFAULT 0,
  start_date date,
  end_date date,
  entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  comment text NOT NULL DEFAULT '',
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ticket_costs
  ADD COLUMN IF NOT EXISTS budget_id uuid REFERENCES public.budgets(id) ON DELETE SET NULL;
ALTER TABLE public.asset_infocoms
  ADD COLUMN IF NOT EXISTS budget_id uuid REFERENCES public.budgets(id) ON DELETE SET NULL;

/** Quanto de um orçamento já foi consumido por chamados e por compras. */
CREATE OR REPLACE FUNCTION public.budget_spent(_budget_id uuid)
RETURNS numeric LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT sum(cost_time + cost_fixed + cost_material)
       FROM public.ticket_costs WHERE budget_id = _budget_id), 0)
    +
    COALESCE(
    (SELECT sum(value) FROM public.asset_infocoms WHERE budget_id = _budget_id), 0);
$$;

-- ---------------------------------------------------------------------------
-- CONTRATOS
-- ---------------------------------------------------------------------------

CREATE TABLE public.contract_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE
);

INSERT INTO public.contract_types (name) VALUES
  ('Suporte técnico'), ('Locação'), ('Manutenção'), ('Licenciamento'),
  ('Link de internet'), ('Telefonia'), ('Nuvem');

CREATE TYPE public.renewal_kind AS ENUM ('tacita','expressa','nenhuma');

CREATE TABLE public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  number text NOT NULL DEFAULT '',
  contract_type_id uuid REFERENCES public.contract_types(id) ON DELETE SET NULL,
  entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  start_date date,
  -- período inicial em meses; com a data de início dá a data de término
  initial_months integer NOT NULL DEFAULT 12,
  notice_months integer NOT NULL DEFAULT 1,
  account_number text NOT NULL DEFAULT '',
  renewal public.renewal_kind NOT NULL DEFAULT 'tacita',
  renewal_months integer NOT NULL DEFAULT 12,
  invoice_period_months integer NOT NULL DEFAULT 1,
  max_hours integer NOT NULL DEFAULT 0,
  alert_days integer NOT NULL DEFAULT 30,
  value numeric(14,2) NOT NULL DEFAULT 0,
  budget_id uuid REFERENCES public.budgets(id) ON DELETE SET NULL,
  comment text NOT NULL DEFAULT '',
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

/** Data de término, a partir do início e do período inicial. */
CREATE OR REPLACE FUNCTION public.contract_end_date(_contract_id uuid)
RETURNS date LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT (start_date + make_interval(months => initial_months))::date
    FROM public.contracts WHERE id = _contract_id AND start_date IS NOT NULL;
$$;

CREATE TABLE public.contract_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  UNIQUE (contract_id, supplier_id)
);

CREATE TABLE public.contract_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  asset_id uuid REFERENCES public.assets(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contract_id, asset_id)
);

CREATE TABLE public.contract_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  begin_date date,
  end_date date,
  value numeric(14,2) NOT NULL DEFAULT 0,
  budget_id uuid REFERENCES public.budgets(id) ON DELETE SET NULL,
  comment text NOT NULL DEFAULT ''
);

-- Chamado pode apontar o contrato aplicável (a aba Contratos do GLPI).
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- CERTIFICADOS
-- ---------------------------------------------------------------------------

CREATE TABLE public.certificate_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE
);

INSERT INTO public.certificate_types (name) VALUES
  ('SSL/TLS'), ('Certificado digital A1'), ('Certificado digital A3'),
  ('Assinatura de código'), ('e-CNPJ'), ('e-CPF');

CREATE TABLE public.certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  certificate_type_id uuid REFERENCES public.certificate_types(id) ON DELETE SET NULL,
  manufacturer_id uuid REFERENCES public.manufacturers(id) ON DELETE SET NULL,
  serial_number text NOT NULL DEFAULT '',
  is_self_signed boolean NOT NULL DEFAULT false,
  dns_name text NOT NULL DEFAULT '',
  dns_suffix text NOT NULL DEFAULT '',
  expire_date date,
  command_used text NOT NULL DEFAULT '',
  entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  comment text NOT NULL DEFAULT '',
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.certificate_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_id uuid NOT NULL REFERENCES public.certificates(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  UNIQUE (certificate_id, asset_id)
);

-- ---------------------------------------------------------------------------
-- LINHAS TELEFÔNICAS
-- ---------------------------------------------------------------------------

CREATE TABLE public.line_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE
);

INSERT INTO public.line_types (name) VALUES
  ('Móvel'), ('Fixa'), ('VoIP'), ('Dados'), ('0800');

CREATE TABLE public.phone_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  number text NOT NULL DEFAULT '',
  line_type_id uuid REFERENCES public.line_types(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  state_id uuid REFERENCES public.asset_states(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  caller_name text NOT NULL DEFAULT '',
  monthly_value numeric(12,2) NOT NULL DEFAULT 0,
  entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  comment text NOT NULL DEFAULT '',
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id uuid NOT NULL REFERENCES public.phone_lines(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  UNIQUE (line_id, asset_id)
);

-- ---------------------------------------------------------------------------
-- DATACENTERS E SALAS
-- ---------------------------------------------------------------------------

CREATE TABLE public.datacenters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  comment text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.server_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  datacenter_id uuid NOT NULL REFERENCES public.datacenters(id) ON DELETE CASCADE,
  rows_count integer NOT NULL DEFAULT 0,
  columns_count integer NOT NULL DEFAULT 0,
  comment text NOT NULL DEFAULT ''
);

ALTER TABLE public.asset_racks
  ADD COLUMN IF NOT EXISTS server_room_id uuid REFERENCES public.server_rooms(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- CLUSTERS, DOMÍNIOS, APPLIANCES E BANCOS
-- ---------------------------------------------------------------------------

CREATE TABLE public.clusters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  cluster_uuid text NOT NULL DEFAULT '',
  version text NOT NULL DEFAULT '',
  cluster_type text NOT NULL DEFAULT '',
  entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  comment text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.cluster_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id uuid NOT NULL REFERENCES public.clusters(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  UNIQUE (cluster_id, asset_id)
);

CREATE TABLE public.domain_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE
);

INSERT INTO public.domain_types (name) VALUES ('Interno'), ('Externo'), ('Subdomínio');

CREATE TABLE public.domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  domain_type_id uuid REFERENCES public.domain_types(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  registration_date date,
  expire_date date,
  entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  comment text NOT NULL DEFAULT '',
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.domain_record_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE
);

INSERT INTO public.domain_record_types (name) VALUES
  ('A'), ('AAAA'), ('CNAME'), ('MX'), ('TXT'), ('NS'), ('SRV'), ('PTR');

CREATE TABLE public.domain_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id uuid NOT NULL REFERENCES public.domains(id) ON DELETE CASCADE,
  name text NOT NULL,
  record_type_id uuid REFERENCES public.domain_record_types(id) ON DELETE SET NULL,
  data text NOT NULL DEFAULT '',
  ttl integer NOT NULL DEFAULT 3600,
  comment text NOT NULL DEFAULT ''
);

CREATE TABLE public.domain_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id uuid NOT NULL REFERENCES public.domains(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  UNIQUE (domain_id, asset_id)
);

CREATE TABLE public.appliance_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE
);

INSERT INTO public.appliance_types (name) VALUES
  ('Aplicação web'), ('Serviço interno'), ('Sistema contábil'), ('Sistema fiscal'), ('Integração');

CREATE TABLE public.appliance_environments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE
);

INSERT INTO public.appliance_environments (name) VALUES
  ('Produção'), ('Homologação'), ('Desenvolvimento'), ('Testes');

CREATE TABLE public.appliances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  appliance_type_id uuid REFERENCES public.appliance_types(id) ON DELETE SET NULL,
  environment_id uuid REFERENCES public.appliance_environments(id) ON DELETE SET NULL,
  technician_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  group_id uuid REFERENCES public.user_groups(id) ON DELETE SET NULL,
  entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  comment text NOT NULL DEFAULT '',
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.appliance_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appliance_id uuid NOT NULL REFERENCES public.appliances(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  UNIQUE (appliance_id, asset_id)
);

CREATE TABLE public.database_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  version text NOT NULL DEFAULT '',
  port integer,
  install_path text NOT NULL DEFAULT '',
  asset_id uuid REFERENCES public.assets(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  comment text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.databases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES public.database_instances(id) ON DELETE CASCADE,
  name text NOT NULL,
  size_mb bigint NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  is_on_backup boolean NOT NULL DEFAULT true,
  comment text NOT NULL DEFAULT ''
);

-- ---------------------------------------------------------------------------
-- DOCUMENTOS EM QUALQUER OBJETO
-- ---------------------------------------------------------------------------

CREATE TABLE public.document_headings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE
);

INSERT INTO public.document_headings (name) VALUES
  ('Nota fiscal'), ('Contrato'), ('Manual'), ('Termo de responsabilidade'),
  ('Foto'), ('Orçamento'), ('Outros');

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS heading_id uuid REFERENCES public.document_headings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;

-- O GLPI liga documento a qualquer objeto; a fase 3 só ligava a chamado.
CREATE TABLE public.document_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  item_type text NOT NULL,
  item_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, item_type, item_id)
);

CREATE INDEX idx_document_items_item ON public.document_items(item_type, item_id);

INSERT INTO public.document_items (document_id, item_type, item_id)
SELECT document_id, 'ticket', ticket_id FROM public.document_tickets
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- ALERTAS DE VENCIMENTO
-- ---------------------------------------------------------------------------

/** Contratos, certificados e domínios vencendo dentro do prazo de alerta. */
CREATE OR REPLACE FUNCTION public.run_management_alerts()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  total integer := 0;
  n integer;
BEGIN
  SELECT count(*) INTO n
    FROM public.contracts c
   WHERE NOT c.is_deleted
     AND c.start_date IS NOT NULL
     AND (c.start_date + make_interval(months => c.initial_months))
         BETWEEN current_date AND current_date + make_interval(days => c.alert_days);
  total := total + COALESCE(n, 0);

  SELECT count(*) INTO n
    FROM public.certificates
   WHERE NOT is_deleted AND expire_date IS NOT NULL
     AND expire_date BETWEEN current_date AND current_date + interval '30 days';
  total := total + COALESCE(n, 0);

  SELECT count(*) INTO n
    FROM public.domains
   WHERE NOT is_deleted AND expire_date IS NOT NULL
     AND expire_date BETWEEN current_date AND current_date + interval '30 days';
  total := total + COALESCE(n, 0);

  RETURN total;
END; $$;

INSERT INTO public.automatic_actions (code, name, description, frequency_minutes) VALUES
  ('alertas_gestao','Alertas de gestão',
   'Contratos, certificados e domínios vencendo dentro do prazo de aviso', 1440)
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

DO $rls$
DECLARE
  t text;
  -- Cada grupo segue o direito do objeto principal do GLPI.
  by_right jsonb := jsonb_build_object(
    'contact',       jsonb_build_array('contacts','contact_suppliers','contact_types'),
    'budget',        jsonb_build_array('budgets'),
    'contract',      jsonb_build_array('contracts','contract_suppliers','contract_items',
                                       'contract_costs','contract_types'),
    'certificate',   jsonb_build_array('certificates','certificate_items','certificate_types'),
    'line',          jsonb_build_array('phone_lines','line_items','line_types'),
    'datacenter',    jsonb_build_array('datacenters','server_rooms'),
    'cluster',       jsonb_build_array('clusters','cluster_items'),
    'domain',        jsonb_build_array('domains','domain_records','domain_items',
                                       'domain_types','domain_record_types'),
    'appliance',     jsonb_build_array('appliances','appliance_items','appliance_types',
                                       'appliance_environments'),
    'database',      jsonb_build_array('database_instances','databases'),
    'document',      jsonb_build_array('document_items','document_headings'),
    'supplier',      jsonb_build_array('supplier_types')
  );
  right_key text;
  tables jsonb;
BEGIN
  FOR right_key, tables IN SELECT * FROM jsonb_each(by_right) LOOP
    FOR t IN SELECT jsonb_array_elements_text(tables) LOOP
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
      EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated
           USING (public.has_right(auth.uid(), %L, ''read''))',
        t || '_select', t, right_key);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO authenticated
           USING (public.has_right(auth.uid(), %L, ''update''))
           WITH CHECK (public.has_right(auth.uid(), %L, ''update''))',
        t || '_write', t, right_key, right_key);
    END LOOP;
  END LOOP;
END $rls$;

-- ---------------------------------------------------------------------------
-- CARIMBO
-- ---------------------------------------------------------------------------

CREATE TRIGGER contacts_touch BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER budgets_touch BEFORE UPDATE ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER contracts_touch BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER certificates_touch BEFORE UPDATE ON public.certificates
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER phone_lines_touch BEFORE UPDATE ON public.phone_lines
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER domains_touch BEFORE UPDATE ON public.domains
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER appliances_touch BEFORE UPDATE ON public.appliances
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
