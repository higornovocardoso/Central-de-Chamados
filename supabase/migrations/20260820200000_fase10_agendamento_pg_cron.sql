-- ============================================================================
-- FASE 10 — Agendamento das ações automáticas
-- A fase 4 tentou agendar isto, mas a chamada a cron.schedule estava dentro
-- de um bloco DO com EXCEPTION WHEN OTHERS, e a extensão não estava
-- instalada: falhou em silêncio. Até aqui as ações só rodavam pelo botão
-- "Executar agora" da tela de ações automáticas.
--
-- O GLPI faz isto por cron do sistema operacional; aqui é o pg_cron, que
-- roda dentro do próprio banco.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- De 15 em 15 minutos: escalonamento de SLA, o mais sensível a atraso.
SELECT cron.schedule(
  'glpi_escalonamento',
  '*/15 * * * *',
  $job$ SELECT public.run_escalations(); $job$
);

-- De hora em hora: fechamento automático e chamados recorrentes.
SELECT cron.schedule(
  'glpi_horario',
  '0 * * * *',
  $job$
    SELECT public.run_auto_close();
    SELECT public.run_recurrent_tickets();
  $job$
);

-- Uma vez por dia, de madrugada: pesquisa de satisfação e os alertas de
-- estoque, garantia, contrato, certificado e domínio.
SELECT cron.schedule(
  'glpi_diario',
  '10 6 * * *',
  $job$
    SELECT public.run_satisfaction();
    SELECT public.run_inventory_alerts();
    SELECT public.run_management_alerts();
  $job$
);

UPDATE public.automatic_actions
   SET last_result = 'Agendada no pg_cron'
 WHERE code IN ('escalonamento_sla','fechar_chamados','chamados_recorrentes',
                'pesquisa_satisfacao','alertas_inventario','alertas_gestao');
