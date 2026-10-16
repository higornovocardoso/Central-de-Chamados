-- log_system é SECURITY DEFINER e insere em system_logs com o user_id de quem
-- chama. Estava com EXECUTE para authenticated (concedido na fase 8 e, por
-- engano, reconcedido na fase 9, que era justamente a de trancar funções).
--
-- Ninguém chama log_system: nem o frontend, nem nenhum gatilho ou função do
-- banco. Exposta por RPC, ela só serve para um usuário logado forjar ou
-- poluir o log do sistema. Fica só para postgres e service_role.

REVOKE EXECUTE ON FUNCTION public.log_system(text, text, uuid, text, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.log_system(text, text, uuid, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_system(text, text, uuid, text, text) FROM public;
