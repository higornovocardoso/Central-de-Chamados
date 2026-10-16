-- ============================================================================
-- FASE 5 — Inventário completo
-- Os 16 tipos de ativo do GLPI, com campos próprios por tipo, componentes,
-- conexões, portas de rede e IP, volumes, sistemas operacionais, softwares
-- com versões e licenças, cartuchos e consumíveis com alerta de estoque,
-- aba financeira com garantia e depreciação, e bloqueio de campos.
--
-- Nota de projeto: o GLPI usa uma tabela por tipo de ativo. Aqui a tabela
-- assets guarda os campos comuns e cada tipo ganha uma tabela de extensão
-- com o que é só dele. O resultado é o mesmo conjunto de campos, sem
-- repetir dezesseis vezes a mesma estrutura — e mantém o vínculo do
-- chamado com o ativo em uma chave só.
-- ============================================================================

-- Os tipos que faltavam. Não podem ser usados como literal nesta transação.
ALTER TYPE public.asset_kind ADD VALUE IF NOT EXISTS 'periferico';
ALTER TYPE public.asset_kind ADD VALUE IF NOT EXISTS 'cartucho';
ALTER TYPE public.asset_kind ADD VALUE IF NOT EXISTS 'consumivel';
ALTER TYPE public.asset_kind ADD VALUE IF NOT EXISTS 'rack';
ALTER TYPE public.asset_kind ADD VALUE IF NOT EXISTS 'gabinete';
ALTER TYPE public.asset_kind ADD VALUE IF NOT EXISTS 'pdu';
ALTER TYPE public.asset_kind ADD VALUE IF NOT EXISTS 'passivo';
ALTER TYPE public.asset_kind ADD VALUE IF NOT EXISTS 'nao_gerenciado';
ALTER TYPE public.asset_kind ADD VALUE IF NOT EXISTS 'cabo';
ALTER TYPE public.asset_kind ADD VALUE IF NOT EXISTS 'sim_card';
ALTER TYPE public.asset_kind ADD VALUE IF NOT EXISTS 'software';

-- ---------------------------------------------------------------------------
-- CADASTROS DE APOIO  (as listas suspensas do GLPI)
-- ---------------------------------------------------------------------------

CREATE TABLE public.manufacturers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  comment text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.asset_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind public.asset_kind NOT NULL DEFAULT 'outro',
  comment text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name, kind)
);

CREATE TABLE public.asset_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind public.asset_kind NOT NULL DEFAULT 'outro',
  manufacturer_id uuid REFERENCES public.manufacturers(id) ON DELETE SET NULL,
  product_number text NOT NULL DEFAULT '',
  comment text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.asset_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  color text NOT NULL DEFAULT '',
  is_visible_inventory boolean NOT NULL DEFAULT true,
  comment text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.asset_states (name) VALUES
  ('Em uso'), ('Em estoque'), ('Em manutenção'), ('Descartado'), ('Emprestado'), ('Reservado');

INSERT INTO public.manufacturers (name) VALUES
  ('Dell'), ('HP'), ('Lenovo'), ('Samsung'), ('LG'), ('Positivo'), ('Intelbras'),
  ('Epson'), ('Brother'), ('Apple'), ('Microsoft'), ('Outros');

-- ---------------------------------------------------------------------------
-- REDE
-- ---------------------------------------------------------------------------

CREATE TABLE public.vlans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  tag integer,
  comment text NOT NULL DEFAULT '',
  entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE
);

CREATE TABLE public.ip_networks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text NOT NULL DEFAULT '',
  netmask text NOT NULL DEFAULT '',
  gateway text NOT NULL DEFAULT '',
  vlan_id uuid REFERENCES public.vlans(id) ON DELETE SET NULL,
  entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  comment text NOT NULL DEFAULT ''
);

CREATE TABLE public.sockets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  comment text NOT NULL DEFAULT ''
);

CREATE TYPE public.network_port_type AS ENUM
  ('ethernet','wifi','loopback','alias','agregado','fibra');

CREATE TABLE public.network_ports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  port_number integer,
  port_type public.network_port_type NOT NULL DEFAULT 'ethernet',
  mac text NOT NULL DEFAULT '',
  speed integer,
  socket_id uuid REFERENCES public.sockets(id) ON DELETE SET NULL,
  vlan_id uuid REFERENCES public.vlans(id) ON DELETE SET NULL,
  network_name text NOT NULL DEFAULT '',
  comment text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_network_ports_asset ON public.network_ports(asset_id);

CREATE TABLE public.ip_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  port_id uuid NOT NULL REFERENCES public.network_ports(id) ON DELETE CASCADE,
  address text NOT NULL,
  version smallint NOT NULL DEFAULT 4,
  network_id uuid REFERENCES public.ip_networks(id) ON DELETE SET NULL
);

-- ---------------------------------------------------------------------------
-- COMPONENTES
-- ---------------------------------------------------------------------------

CREATE TYPE public.component_kind AS ENUM
  ('processador','memoria','disco','placa_rede','placa_video','placa_som',
   'controladora','bateria','fonte','bios','gabinete_componente','outro');

CREATE TABLE public.components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind public.component_kind NOT NULL DEFAULT 'outro',
  manufacturer_id uuid REFERENCES public.manufacturers(id) ON DELETE SET NULL,
  specification text NOT NULL DEFAULT '',
  comment text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.asset_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  component_id uuid NOT NULL REFERENCES public.components(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1,
  serial_number text NOT NULL DEFAULT '',
  size text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_asset_components_asset ON public.asset_components(asset_id);

-- ---------------------------------------------------------------------------
-- CONEXÕES, VOLUMES E SISTEMA OPERACIONAL
-- ---------------------------------------------------------------------------

-- Monitor, impressora, telefone e periférico ligados a um computador.
CREATE TABLE public.asset_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  computer_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  peripheral_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (computer_id, peripheral_id),
  CHECK (computer_id <> peripheral_id)
);

CREATE TABLE public.asset_volumes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  device text NOT NULL DEFAULT '',
  mount_point text NOT NULL DEFAULT '',
  filesystem text NOT NULL DEFAULT '',
  total_mb bigint NOT NULL DEFAULT 0,
  free_mb bigint NOT NULL DEFAULT 0,
  is_encrypted boolean NOT NULL DEFAULT false
);

CREATE INDEX idx_asset_volumes_asset ON public.asset_volumes(asset_id);

CREATE TABLE public.operating_systems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  comment text NOT NULL DEFAULT ''
);

INSERT INTO public.operating_systems (name) VALUES
  ('Windows 11'), ('Windows 10'), ('Windows Server 2022'), ('Windows Server 2019'),
  ('Ubuntu'), ('Debian'), ('macOS'), ('Android'), ('iOS'), ('Outro');

CREATE TABLE public.asset_operating_systems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE UNIQUE,
  os_id uuid REFERENCES public.operating_systems(id) ON DELETE SET NULL,
  version text NOT NULL DEFAULT '',
  architecture text NOT NULL DEFAULT '',
  kernel_version text NOT NULL DEFAULT '',
  service_pack text NOT NULL DEFAULT '',
  license_number text NOT NULL DEFAULT '',
  product_id text NOT NULL DEFAULT '',
  installation_date date
);

-- ---------------------------------------------------------------------------
-- SOFTWARES, VERSÕES, LICENÇAS E INSTALAÇÕES
-- ---------------------------------------------------------------------------

CREATE TABLE public.software_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  comment text NOT NULL DEFAULT ''
);

INSERT INTO public.software_categories (name) VALUES
  ('Sistema operacional'), ('Escritório'), ('Contabilidade'), ('Fiscal'),
  ('Segurança'), ('Navegador'), ('Comunicação'), ('Utilitário'), ('Outros');

CREATE TABLE public.software (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  manufacturer_id uuid REFERENCES public.manufacturers(id) ON DELETE SET NULL,
  category_id uuid REFERENCES public.software_categories(id) ON DELETE SET NULL,
  entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  is_helpdesk_visible boolean NOT NULL DEFAULT true,
  is_deleted boolean NOT NULL DEFAULT false,
  comment text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.software_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  software_id uuid NOT NULL REFERENCES public.software(id) ON DELETE CASCADE,
  name text NOT NULL,
  os_id uuid REFERENCES public.operating_systems(id) ON DELETE SET NULL,
  state_id uuid REFERENCES public.asset_states(id) ON DELETE SET NULL,
  comment text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_software_versions_software ON public.software_versions(software_id);

CREATE TABLE public.software_licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  software_id uuid NOT NULL REFERENCES public.software(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.software_licenses(id) ON DELETE SET NULL,
  name text NOT NULL,
  license_type text NOT NULL DEFAULT '',
  serial_number text NOT NULL DEFAULT '',
  other_serial text NOT NULL DEFAULT '',
  -- 0 significa ilimitada, como no GLPI
  quantity integer NOT NULL DEFAULT 1,
  allow_overquota boolean NOT NULL DEFAULT false,
  expire_date date,
  version_buy_id uuid REFERENCES public.software_versions(id) ON DELETE SET NULL,
  version_use_id uuid REFERENCES public.software_versions(id) ON DELETE SET NULL,
  entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  comment text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.software_installations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  version_id uuid NOT NULL REFERENCES public.software_versions(id) ON DELETE CASCADE,
  license_id uuid REFERENCES public.software_licenses(id) ON DELETE SET NULL,
  install_date date DEFAULT current_date,
  UNIQUE (asset_id, version_id)
);

CREATE INDEX idx_software_installations_asset ON public.software_installations(asset_id);

/** Quantas instalações uma licença já consumiu. */
CREATE OR REPLACE FUNCTION public.license_usage(_license_id uuid)
RETURNS integer LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT count(*)::integer FROM public.software_installations WHERE license_id = _license_id;
$$;

-- ---------------------------------------------------------------------------
-- CARTUCHOS E CONSUMÍVEIS
-- ---------------------------------------------------------------------------

CREATE TABLE public.cartridge_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  reference text NOT NULL DEFAULT '',
  manufacturer_id uuid REFERENCES public.manufacturers(id) ON DELETE SET NULL,
  alarm_threshold integer NOT NULL DEFAULT 3,
  entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  comment text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Quais modelos de impressora aceitam este cartucho.
CREATE TABLE public.cartridge_item_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cartridge_item_id uuid NOT NULL REFERENCES public.cartridge_items(id) ON DELETE CASCADE,
  model_id uuid NOT NULL REFERENCES public.asset_models(id) ON DELETE CASCADE,
  UNIQUE (cartridge_item_id, model_id)
);

CREATE TABLE public.cartridges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cartridge_item_id uuid NOT NULL REFERENCES public.cartridge_items(id) ON DELETE CASCADE,
  printer_id uuid REFERENCES public.assets(id) ON DELETE SET NULL,
  date_in date NOT NULL DEFAULT current_date,
  date_use date,
  date_out date,
  pages_counter integer NOT NULL DEFAULT 0
);

CREATE INDEX idx_cartridges_item ON public.cartridges(cartridge_item_id);

CREATE TABLE public.consumable_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  reference text NOT NULL DEFAULT '',
  manufacturer_id uuid REFERENCES public.manufacturers(id) ON DELETE SET NULL,
  alarm_threshold integer NOT NULL DEFAULT 5,
  entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  comment text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.consumables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consumable_item_id uuid NOT NULL REFERENCES public.consumable_items(id) ON DELETE CASCADE,
  date_in date NOT NULL DEFAULT current_date,
  date_out date,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

/** Estoque disponível: o que entrou e ainda não saiu. */
CREATE OR REPLACE FUNCTION public.cartridge_stock(_item_id uuid)
RETURNS integer LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT count(*)::integer FROM public.cartridges
   WHERE cartridge_item_id = _item_id AND date_out IS NULL AND date_use IS NULL;
$$;

CREATE OR REPLACE FUNCTION public.consumable_stock(_item_id uuid)
RETURNS integer LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT count(*)::integer FROM public.consumables
   WHERE consumable_item_id = _item_id AND date_out IS NULL;
$$;

-- ---------------------------------------------------------------------------
-- CAMPOS COMUNS E EXTENSÕES POR TIPO
-- ---------------------------------------------------------------------------

ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS manufacturer_id uuid REFERENCES public.manufacturers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS model_id uuid REFERENCES public.asset_models(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS type_id uuid REFERENCES public.asset_types(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS state_id uuid REFERENCES public.asset_states(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS technician_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.user_groups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS user_group_id uuid REFERENCES public.user_groups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS alternate_username text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS alternate_username_number text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS uuid_field text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS network_id uuid REFERENCES public.ip_networks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS update_source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_assets_deleted ON public.assets(is_deleted);

-- Computador e notebook
CREATE TABLE public.asset_computers (
  asset_id uuid PRIMARY KEY REFERENCES public.assets(id) ON DELETE CASCADE,
  is_virtual boolean NOT NULL DEFAULT false,
  host_asset_id uuid REFERENCES public.assets(id) ON DELETE SET NULL,
  remote_management text NOT NULL DEFAULT '',
  antivirus_name text NOT NULL DEFAULT '',
  antivirus_updated boolean NOT NULL DEFAULT true,
  last_inventory_at timestamptz
);

-- Monitor
CREATE TABLE public.asset_monitors (
  asset_id uuid PRIMARY KEY REFERENCES public.assets(id) ON DELETE CASCADE,
  size_inches numeric(5,1),
  has_hdmi boolean NOT NULL DEFAULT true,
  has_displayport boolean NOT NULL DEFAULT false,
  has_vga boolean NOT NULL DEFAULT false,
  has_dvi boolean NOT NULL DEFAULT false,
  has_usb boolean NOT NULL DEFAULT false
);

-- Impressora, com os contadores de página
CREATE TABLE public.asset_printers (
  asset_id uuid PRIMARY KEY REFERENCES public.assets(id) ON DELETE CASCADE,
  initial_pages integer NOT NULL DEFAULT 0,
  last_pages_counter integer NOT NULL DEFAULT 0,
  counter_updated_at timestamptz,
  memory_size integer,
  has_serial boolean NOT NULL DEFAULT false,
  has_parallel boolean NOT NULL DEFAULT false,
  has_usb boolean NOT NULL DEFAULT true,
  has_wifi boolean NOT NULL DEFAULT false,
  has_ethernet boolean NOT NULL DEFAULT true
);

-- Equipamento de rede
CREATE TABLE public.asset_network_equipments (
  asset_id uuid PRIMARY KEY REFERENCES public.assets(id) ON DELETE CASCADE,
  ports_count integer NOT NULL DEFAULT 0,
  mac text NOT NULL DEFAULT '',
  ram_size integer,
  firmware text NOT NULL DEFAULT ''
);

-- Telefone
CREATE TABLE public.asset_phones (
  asset_id uuid PRIMARY KEY REFERENCES public.assets(id) ON DELETE CASCADE,
  phone_number text NOT NULL DEFAULT '',
  extension text NOT NULL DEFAULT '',
  imei text NOT NULL DEFAULT '',
  has_camera boolean NOT NULL DEFAULT true
);

-- Cartão SIM
CREATE TABLE public.asset_sims (
  asset_id uuid PRIMARY KEY REFERENCES public.assets(id) ON DELETE CASCADE,
  iccid text NOT NULL DEFAULT '',
  msisdn text NOT NULL DEFAULT '',
  pin text NOT NULL DEFAULT '',
  puk text NOT NULL DEFAULT '',
  carrier text NOT NULL DEFAULT ''
);

-- Rack e o que está montado nele
CREATE TABLE public.asset_racks (
  asset_id uuid PRIMARY KEY REFERENCES public.assets(id) ON DELETE CASCADE,
  units integer NOT NULL DEFAULT 42,
  width_mm integer,
  depth_mm integer,
  max_weight_kg integer,
  room text NOT NULL DEFAULT ''
);

CREATE TABLE public.rack_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rack_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  item_asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 1,
  units integer NOT NULL DEFAULT 1,
  is_front boolean NOT NULL DEFAULT true,
  UNIQUE (rack_id, item_asset_id)
);

-- Cabo, com as duas pontas
CREATE TABLE public.asset_cables (
  asset_id uuid PRIMARY KEY REFERENCES public.assets(id) ON DELETE CASCADE,
  cable_type text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT '',
  length_m numeric(6,2),
  endpoint_a_id uuid REFERENCES public.assets(id) ON DELETE SET NULL,
  endpoint_b_id uuid REFERENCES public.assets(id) ON DELETE SET NULL,
  socket_a_id uuid REFERENCES public.sockets(id) ON DELETE SET NULL,
  socket_b_id uuid REFERENCES public.sockets(id) ON DELETE SET NULL
);

-- Gabinete, PDU e dispositivo passivo compartilham a mesma estrutura simples
CREATE TABLE public.asset_enclosures (
  asset_id uuid PRIMARY KEY REFERENCES public.assets(id) ON DELETE CASCADE,
  slots integer NOT NULL DEFAULT 0,
  power_supplies integer NOT NULL DEFAULT 0
);

CREATE TABLE public.asset_pdus (
  asset_id uuid PRIMARY KEY REFERENCES public.assets(id) ON DELETE CASCADE,
  outlets integer NOT NULL DEFAULT 0,
  max_power_w integer,
  is_managed boolean NOT NULL DEFAULT false
);

-- ---------------------------------------------------------------------------
-- ABA GERENCIAMENTO: informação financeira e administrativa
-- ---------------------------------------------------------------------------

CREATE TYPE public.depreciation_type AS ENUM ('linear','decrescente','nenhuma');

CREATE TABLE public.asset_infocoms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE UNIQUE,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  order_number text NOT NULL DEFAULT '',
  delivery_number text NOT NULL DEFAULT '',
  invoice_number text NOT NULL DEFAULT '',
  order_date date,
  buy_date date,
  delivery_date date,
  use_date date,
  warranty_start date,
  warranty_months integer NOT NULL DEFAULT 12,
  warranty_info text NOT NULL DEFAULT '',
  value numeric(14,2) NOT NULL DEFAULT 0,
  warranty_value numeric(14,2) NOT NULL DEFAULT 0,
  depreciation public.depreciation_type NOT NULL DEFAULT 'linear',
  depreciation_months integer NOT NULL DEFAULT 60,
  depreciation_coefficient numeric(6,3) NOT NULL DEFAULT 1,
  business_criticity text NOT NULL DEFAULT '',
  comment text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

/** Fim da garantia, a partir do início e da duração em meses. */
CREATE OR REPLACE FUNCTION public.warranty_end_date(_asset_id uuid)
RETURNS date LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT (warranty_start + make_interval(months => warranty_months))::date
    FROM public.asset_infocoms WHERE asset_id = _asset_id AND warranty_start IS NOT NULL;
$$;

/** Valor residual pela depreciação linear, como o GLPI calcula. */
CREATE OR REPLACE FUNCTION public.asset_residual_value(_asset_id uuid)
RETURNS numeric LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE
  ic public.asset_infocoms%ROWTYPE;
  months_used integer;
BEGIN
  SELECT * INTO ic FROM public.asset_infocoms WHERE asset_id = _asset_id;
  IF NOT FOUND OR ic.depreciation = 'nenhuma' OR ic.buy_date IS NULL
     OR ic.depreciation_months <= 0 THEN
    RETURN COALESCE(ic.value, 0);
  END IF;

  months_used := GREATEST(0, (EXTRACT(YEAR FROM age(current_date, ic.buy_date)) * 12
                              + EXTRACT(MONTH FROM age(current_date, ic.buy_date)))::integer);
  IF months_used >= ic.depreciation_months THEN
    RETURN 0;
  END IF;

  RETURN round(ic.value * (1 - months_used::numeric / ic.depreciation_months), 2);
END; $$;

-- Migra a garantia que já existia na tabela de ativos.
INSERT INTO public.asset_infocoms (asset_id, buy_date, warranty_start, warranty_months)
SELECT a.id, a.purchase_date, a.purchase_date,
       CASE
         WHEN a.purchase_date IS NOT NULL AND a.warranty_end IS NOT NULL
           THEN GREATEST(0, (EXTRACT(YEAR FROM age(a.warranty_end, a.purchase_date)) * 12
                             + EXTRACT(MONTH FROM age(a.warranty_end, a.purchase_date)))::integer)
         ELSE 12
       END
FROM public.assets a
WHERE a.purchase_date IS NOT NULL
ON CONFLICT (asset_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- BLOQUEIO DE CAMPOS
-- ---------------------------------------------------------------------------

-- Campo travado não é sobrescrito por importação nem por inventário automático.
CREATE TABLE public.field_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_type text NOT NULL DEFAULT 'asset',
  item_id uuid NOT NULL,
  field text NOT NULL,
  locked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (item_type, item_id, field)
);

-- ---------------------------------------------------------------------------
-- ALERTAS DE ESTOQUE E GARANTIA
-- ---------------------------------------------------------------------------

/** Cartuchos e consumíveis abaixo do limiar, e garantias vencendo. */
CREATE OR REPLACE FUNCTION public.run_inventory_alerts()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  item record;
  alerts integer := 0;
BEGIN
  FOR item IN
    SELECT ci.id, ci.name, ci.alarm_threshold, public.cartridge_stock(ci.id) AS stock
      FROM public.cartridge_items ci
  LOOP
    IF item.stock <= item.alarm_threshold THEN
      alerts := alerts + 1;
    END IF;
  END LOOP;

  FOR item IN
    SELECT ci.id, ci.name, ci.alarm_threshold, public.consumable_stock(ci.id) AS stock
      FROM public.consumable_items ci
  LOOP
    IF item.stock <= item.alarm_threshold THEN
      alerts := alerts + 1;
    END IF;
  END LOOP;

  RETURN alerts;
END; $$;

INSERT INTO public.automatic_actions (code, name, description, frequency_minutes) VALUES
  ('alertas_inventario','Alertas de inventário',
   'Cartuchos e consumíveis abaixo do estoque mínimo e garantias vencendo', 1440)
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- DIREITOS NOVOS
-- ---------------------------------------------------------------------------

INSERT INTO public.right_definitions (key, label, category, sort) VALUES
  ('component','Componentes','ativos',180),
  ('network_port','Portas de rede','ativos',190),
  ('import','Importação em massa','administracao',95)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.profile_rights
  (profile_id, object_key, can_read, can_update, can_create, can_delete, can_purge)
SELECT p.id, r.key,
       p.name IN ('Super-Admin','Admin','Supervisor','Técnico','Observador'),
       p.name IN ('Super-Admin','Admin','Técnico'),
       p.name IN ('Super-Admin','Admin','Técnico'),
       p.name IN ('Super-Admin','Admin'),
       p.name IN ('Super-Admin')
FROM public.access_profiles p
CROSS JOIN (VALUES ('component'),('network_port'),('import')) AS r(key)
ON CONFLICT (profile_id, object_key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

DO $rls$
DECLARE
  t text;
  -- Cadastros de apoio: leitura para todo autenticado, escrita por direito.
  catalogs text[] := ARRAY[
    'manufacturers','asset_types','asset_models','asset_states','vlans','ip_networks',
    'sockets','components','operating_systems','software_categories'
  ];
  -- Dados de ativo: seguem o direito de computador (o objeto guarda-chuva).
  asset_data text[] := ARRAY[
    'network_ports','ip_addresses','asset_components','asset_connections','asset_volumes',
    'asset_operating_systems','asset_computers','asset_monitors','asset_printers',
    'asset_network_equipments','asset_phones','asset_sims','asset_racks','rack_items',
    'asset_cables','asset_enclosures','asset_pdus','field_locks'
  ];
  software_data text[] := ARRAY[
    'software','software_versions','software_licenses','software_installations'
  ];
  stock_data text[] := ARRAY[
    'cartridge_items','cartridge_item_models','cartridges','consumable_items','consumables'
  ];
BEGIN
  FOREACH t IN ARRAY catalogs || asset_data || software_data || stock_data || ARRAY['asset_infocoms'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;

  FOREACH t IN ARRAY catalogs LOOP
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)', t || '_select', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated
         USING (public.has_right(auth.uid(),''dropdown'',''update''))
         WITH CHECK (public.has_right(auth.uid(),''dropdown'',''update''))',
      t || '_write', t);
  END LOOP;

  FOREACH t IN ARRAY asset_data LOOP
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated
         USING (public.has_right(auth.uid(),''computer'',''read''))', t || '_select', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated
         USING (public.has_right(auth.uid(),''computer'',''update''))
         WITH CHECK (public.has_right(auth.uid(),''computer'',''update''))',
      t || '_write', t);
  END LOOP;

  FOREACH t IN ARRAY software_data LOOP
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated
         USING (public.has_right(auth.uid(),''software'',''read''))', t || '_select', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated
         USING (public.has_right(auth.uid(),''software'',''update''))
         WITH CHECK (public.has_right(auth.uid(),''software'',''update''))',
      t || '_write', t);
  END LOOP;

  FOREACH t IN ARRAY stock_data LOOP
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated
         USING (public.has_right(auth.uid(),''cartridge'',''read'')
                OR public.has_right(auth.uid(),''consumable'',''read''))', t || '_select', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated
         USING (public.has_right(auth.uid(),''cartridge'',''update'')
                OR public.has_right(auth.uid(),''consumable'',''update''))
         WITH CHECK (public.has_right(auth.uid(),''cartridge'',''update'')
                     OR public.has_right(auth.uid(),''consumable'',''update''))',
      t || '_write', t);
  END LOOP;
END $rls$;

-- A aba financeira tem direito próprio, como no GLPI.
CREATE POLICY infocoms_select ON public.asset_infocoms FOR SELECT TO authenticated
  USING (public.has_right(auth.uid(),'financial_info','read'));
CREATE POLICY infocoms_write ON public.asset_infocoms FOR ALL TO authenticated
  USING (public.has_right(auth.uid(),'financial_info','update'))
  WITH CHECK (public.has_right(auth.uid(),'financial_info','update'));

-- Ativo na lixeira some das listas.
DROP POLICY IF EXISTS "assets_select" ON public.assets;
CREATE POLICY "assets_select" ON public.assets FOR SELECT TO authenticated
  USING (entity_id IN (SELECT public.visible_entity_ids(auth.uid())));

-- ---------------------------------------------------------------------------
-- CARIMBO
-- ---------------------------------------------------------------------------

CREATE TRIGGER software_touch BEFORE UPDATE ON public.software
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER infocoms_touch BEFORE UPDATE ON public.asset_infocoms
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
