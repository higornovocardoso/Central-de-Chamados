-- ENTIDADES
CREATE TABLE public.locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  building text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.locations TO authenticated;
GRANT ALL ON public.locations TO service_role;
GRANT SELECT ON public.locations TO anon;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY locations_select_public ON public.locations FOR SELECT TO anon USING (true);
CREATE POLICY locations_select ON public.locations FOR SELECT TO authenticated USING (true);
CREATE POLICY locations_write ON public.locations FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.sectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  manager text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sectors TO authenticated;
GRANT ALL ON public.sectors TO service_role;
GRANT SELECT ON public.sectors TO anon;
ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;
CREATE POLICY sectors_select_public ON public.sectors FOR SELECT TO anon USING (true);
CREATE POLICY sectors_select ON public.sectors FOR SELECT TO authenticated USING (true);
CREATE POLICY sectors_write ON public.sectors FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_email text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY suppliers_select ON public.suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY suppliers_write ON public.suppliers FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- INVENTARIO
CREATE TYPE public.asset_status AS ENUM ('em_uso','estoque','manutencao','descartado');
CREATE TYPE public.asset_kind AS ENUM ('computador','notebook','monitor','impressora','rede','telefonia','licenca','outro');

CREATE TABLE public.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  asset_tag text NOT NULL DEFAULT '',
  kind public.asset_kind NOT NULL DEFAULT 'outro',
  status public.asset_status NOT NULL DEFAULT 'em_uso',
  brand text NOT NULL DEFAULT '',
  model text NOT NULL DEFAULT '',
  serial_number text NOT NULL DEFAULT '',
  purchase_date date,
  warranty_end date,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  sector_id uuid REFERENCES public.sectors(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_name text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assets TO authenticated;
GRANT ALL ON public.assets TO service_role;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY assets_select ON public.assets FOR SELECT TO authenticated USING (true);
CREATE POLICY assets_write ON public.assets FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- SLA
CREATE TABLE public.sla_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  priority public.ticket_priority NOT NULL UNIQUE,
  response_minutes integer NOT NULL DEFAULT 60,
  resolution_minutes integer NOT NULL DEFAULT 480,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sla_policies TO authenticated;
GRANT ALL ON public.sla_policies TO service_role;
GRANT SELECT ON public.sla_policies TO anon;
ALTER TABLE public.sla_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY sla_select ON public.sla_policies FOR SELECT TO authenticated USING (true);
CREATE POLICY sla_write ON public.sla_policies FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.sla_policies (priority, response_minutes, resolution_minutes) VALUES
  ('critica', 15, 240),
  ('alta', 30, 480),
  ('media', 120, 1440),
  ('baixa', 480, 4320);

-- BASE DE CONHECIMENTO
CREATE TABLE public.kb_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text NOT NULL DEFAULT 'Geral',
  summary text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  published boolean NOT NULL DEFAULT true,
  author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kb_articles TO authenticated;
GRANT ALL ON public.kb_articles TO service_role;
ALTER TABLE public.kb_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY kb_select ON public.kb_articles FOR SELECT TO authenticated USING (published OR public.is_staff(auth.uid()));
CREATE POLICY kb_write ON public.kb_articles FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- TICKETS: vinculos + SLA
ALTER TABLE public.tickets
  ADD COLUMN asset_id uuid REFERENCES public.assets(id) ON DELETE SET NULL,
  ADD COLUMN location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  ADD COLUMN sector_id uuid REFERENCES public.sectors(id) ON DELETE SET NULL,
  ADD COLUMN kb_article_id uuid REFERENCES public.kb_articles(id) ON DELETE SET NULL,
  ADD COLUMN first_response_at timestamptz,
  ADD COLUMN response_due_at timestamptz,
  ADD COLUMN resolution_due_at timestamptz;

CREATE OR REPLACE FUNCTION public.apply_sla()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  pol public.sla_policies%ROWTYPE;
BEGIN
  SELECT * INTO pol FROM public.sla_policies WHERE priority = NEW.priority;
  IF FOUND THEN
    NEW.response_due_at := COALESCE(NEW.created_at, now()) + (pol.response_minutes || ' minutes')::interval;
    NEW.resolution_due_at := COALESCE(NEW.created_at, now()) + (pol.resolution_minutes || ' minutes')::interval;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER tickets_apply_sla_insert BEFORE INSERT ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.apply_sla();

CREATE OR REPLACE FUNCTION public.apply_sla_on_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  pol public.sla_policies%ROWTYPE;
BEGIN
  IF NEW.priority IS DISTINCT FROM OLD.priority THEN
    SELECT * INTO pol FROM public.sla_policies WHERE priority = NEW.priority;
    IF FOUND THEN
      NEW.response_due_at := NEW.created_at + (pol.response_minutes || ' minutes')::interval;
      NEW.resolution_due_at := NEW.created_at + (pol.resolution_minutes || ' minutes')::interval;
    END IF;
  END IF;
  IF NEW.status <> 'aberto' AND OLD.status = 'aberto' AND NEW.first_response_at IS NULL THEN
    NEW.first_response_at := now();
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER tickets_apply_sla_update BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.apply_sla_on_update();

-- updated_at generico
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER locations_touch BEFORE UPDATE ON public.locations FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER sectors_touch BEFORE UPDATE ON public.sectors FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER suppliers_touch BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER assets_touch BEFORE UPDATE ON public.assets FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER sla_touch BEFORE UPDATE ON public.sla_policies FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER kb_touch BEFORE UPDATE ON public.kb_articles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Admin pode gerenciar papeis dos usuarios
CREATE POLICY roles_manage_admin ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
GRANT INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;