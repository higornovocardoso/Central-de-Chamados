-- ============================================================================
-- FASE 9 — Permissão de execução das funções
-- Toda função nasce com EXECUTE para PUBLIC, e o Supabase ainda concede
-- EXECUTE a anon e a authenticated por privilégio padrão. O resultado é que
-- as 25 funções SECURITY DEFINER das fases anteriores ficaram chamáveis por
-- /rest/v1/rpc — inclusive enqueue_notification, que enfileira e-mail, e
-- run_recurrent_tickets, que cria chamado. Fecha tudo e devolve só o que a
-- aplicação usa de verdade.
--
-- Gatilho não precisa de EXECUTE: o Postgres não checa esse direito ao
-- disparar um trigger. Por isso nenhuma função de gatilho volta na lista.
-- ============================================================================

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- Chamadas de dentro das políticas de RLS. Sem estas, o usuário autenticado
-- não enxerga linha nenhuma.
GRANT EXECUTE ON FUNCTION public.has_right(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_right_in_entity(uuid, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_flag(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_profile(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.visible_entity_ids(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_see_ticket(uuid) TO authenticated;

-- Chamadas pela interface.
GRANT EXECUTE ON FUNCTION public.my_permissions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.run_automatic_action(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_system(text, text, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_dictionary(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.compute_priority(smallint, smallint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_working_time(timestamptz, integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.service_level_minutes(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.license_usage(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cartridge_stock(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consumable_stock(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.budget_spent(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.contract_end_date(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.warranty_end_date(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.asset_residual_value(uuid) TO authenticated;

-- O formulário público grava o chamado como anon, e os gatilhos BEFORE INSERT
-- rodam com o direito do próprio anon — não são SECURITY DEFINER. Estas três
-- são as funções que eles chamam.
GRANT EXECUTE ON FUNCTION public.compute_priority(smallint, smallint) TO anon;
GRANT EXECUTE ON FUNCTION public.add_working_time(timestamptz, integer, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.service_level_minutes(uuid) TO anon;

-- Edge functions e agendador continuam com tudo.
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- A guarda antiga liberava justamente quem não tinha login: com
-- "AND auth.uid() IS NOT NULL", o RAISE era pulado para o anon.
CREATE OR REPLACE FUNCTION public.run_automatic_action(_code text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  result text;
  n integer;
BEGIN
  IF NOT (
    current_user IN ('postgres','service_role','supabase_admin')
    OR (auth.uid() IS NOT NULL AND public.has_right(auth.uid(), 'automatic_action', 'update'))
  ) THEN
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
    WHEN 'alertas_inventario' THEN
      n := public.run_inventory_alerts();
      result := n || ' alerta(s) de inventário';
    WHEN 'alertas_gestao' THEN
      n := public.run_management_alerts();
      result := n || ' alerta(s) de gestão';
    ELSE
      result := 'Ação sem execução direta no banco';
  END CASE;

  UPDATE public.automatic_actions
     SET last_run_at = now(), last_result = result
   WHERE code = _code;

  RETURN result;
END; $$;

REVOKE EXECUTE ON FUNCTION public.run_automatic_action(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.run_automatic_action(text) TO authenticated;
