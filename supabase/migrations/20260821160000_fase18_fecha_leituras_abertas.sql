-- Achados pela varredura de segurança do Lovable, conferidos um a um contra as
-- políticas reais. Só entrou aqui o que se confirmou.
--
-- FALSO POSITIVO, não mexido: "Public Can Execute SECURITY DEFINER Function"
-- apontava rls_auto_enable(), que retorna event_trigger. O Postgres não deixa
-- chamar função desse tipo diretamente e o PostgREST não a expõe. Ainda assim
-- o EXECUTE foi revogado (o gatilho segue funcionando: testado criando tabela
-- depois de revogar, e o RLS ligou sozinho), só para calar o alerta.
--
-- POR DESENHO, não mexido: as ~20 tabelas de lista suspensa (categorias,
-- locais, fabricantes, prioridades, calendários) continuam legíveis por
-- qualquer logado. É o comportamento do GLPI, e sem elas os formulários não
-- montam.

REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated, PUBLIC;

-- 1) Histórico de escalonamento vazava entre entidades: a política era
--    literalmente "true". Passa a seguir a visibilidade do chamado.
DROP POLICY IF EXISTS elog_select ON public.escalation_log;
CREATE POLICY elog_select ON public.escalation_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tickets t
       WHERE t.id = escalation_log.ticket_id
         AND t.entity_id IN (SELECT public.visible_entity_ids(auth.uid()))
    )
  );

-- 2) Fornecedores eram legíveis por qualquer logado. No GLPI isso pede o
--    direito de leitura do objeto, como já acontecia em contatos.
DROP POLICY IF EXISTS suppliers_select ON public.suppliers;
CREATE POLICY suppliers_select ON public.suppliers
  FOR SELECT TO authenticated
  USING (public.has_right(auth.uid(), 'supplier', 'read'));

-- 3) Documento excluído continuava visível. Hoje nada marca is_deleted em
--    documento — só chamado tem exclusão suave de fato —, então isto não muda
--    nada agora; é a trava para o dia em que a lixeira de documentos existir.
DROP POLICY IF EXISTS documents_select ON public.documents;
CREATE POLICY documents_select ON public.documents
  FOR SELECT TO authenticated
  USING (
    entity_id IN (SELECT public.visible_entity_ids(auth.uid()))
    AND is_deleted = false
  );
