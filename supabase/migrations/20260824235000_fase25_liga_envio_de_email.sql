-- Fase 25: liga o envio de e-mail.
--
-- ATENÇÃO: só aplique esta migration DEPOIS de cadastrar RESEND_API_KEY nos
-- segredos das Edge Functions do Supabase. Aplicar antes não quebra nada — a
-- função responde "RESEND_API_KEY não configurada" e a fila segue parada —,
-- mas o descarte abaixo teria sido em vão, porque novas mensagens continuariam
-- se acumulando até a chave chegar.
--
-- Duas coisas acontecem aqui.
--
-- Primeiro, o acúmulo é descartado. São as mensagens enfileiradas desde 21/08,
-- de quando os gatilhos passaram a registrar mas o envio ainda não existia.
-- Enviá-las seria pior que não enviar: vários chamados têm "aberto" e
-- "solucionado" na fila ao mesmo tempo, então as pessoas receberiam as duas
-- notificações juntas, dias depois do fato. O registro fica no banco, marcado
-- como descartada, para quem quiser auditar depois.
--
-- Segundo, a ação automática enviar_fila volta a rodar. A partir daí só sai
-- e-mail de evento novo.
--
-- Antes de aplicar, vale conferir no Resend que o domínio de envio está
-- verificado. Sem isso os e-mails saem do remetente genérico de testes e há boa
-- chance de caírem em spam.

update public.notification_queue
   set state = 'descartada',
       error = 'Descartada ao ligar o envio: acúmulo anterior à configuração do e-mail.'
 where state = 'pendente';

update public.automatic_actions
   set is_active = true,
       last_result = 'Religada com o envio de e-mail configurado'
 where code = 'enviar_fila';
