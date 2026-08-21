-- ============================================================================
-- FASE 12 — Remove o direito de importação em massa
-- A tela de importação por CSV saiu: o GLPI não tem esse objeto. Lá o
-- inventário em massa vem do agente instalado nas máquinas, que não temos
-- como replicar. O direito correspondente sai junto, e o CASCADE leva as
-- linhas de profile_rights.
-- ============================================================================

DELETE FROM public.right_definitions WHERE key = 'import';
