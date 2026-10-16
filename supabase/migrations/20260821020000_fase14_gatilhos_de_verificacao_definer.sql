-- ============================================================================
-- FASE 14 — Gatilhos de verificação passam a SECURITY DEFINER
--
-- check_asset_unicity era SECURITY INVOKER e grava em item_history, onde o
-- usuário autenticado só tem SELECT. Cadastrar um ativo com número de série
-- repetido morria com "new row violates row-level security policy for table
-- item_history" em vez de apenas avisar, que é o que a regra manda.
-- Também lia public.assets sob RLS, então só enxergava duplicata dentro do
-- que o usuário já podia ver; como DEFINER a verificação vale para o parque
-- inteiro, que é o comportamento esperado de uma regra de unicidade.
--
-- check_reservation_overlap tem a mesma natureza: lia public.reservations sob
-- RLS, então um perfil que pudesse criar reserva sem poder lê-las passaria
-- por cima da checagem de conflito.
--
-- Mesma família do defeito da fase 11. Auditoria feita: eram os dois últimos
-- gatilhos INVOKER que escrevem ou leem tabela protegida.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_asset_unicity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  rule record;
  field text;
  value text;
  duplicated boolean;
  rec jsonb := to_jsonb(NEW);
BEGIN
  FOR rule IN SELECT * FROM public.field_unicity WHERE is_active AND item_type = 'asset' LOOP
    FOREACH field IN ARRAY rule.fields LOOP
      value := rec ->> field;
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

CREATE OR REPLACE FUNCTION public.check_reservation_overlap()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

REVOKE EXECUTE ON FUNCTION public.check_asset_unicity() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_reservation_overlap() FROM PUBLIC, anon, authenticated;
