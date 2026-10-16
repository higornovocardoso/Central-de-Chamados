-- Envio de e-mail adiado. As telas de Notificações, Coletores e Fila de
-- e-mails saíram do menu para "em breve", e a ação automática que esvazia a
-- fila fica desligada — ela só chamaria a edge function send-notifications,
-- que sem RESEND_API_KEY responde que o envio está desligado.
--
-- Os gatilhos continuam enfileirando em notification_queue de propósito: no
-- dia em que o e-mail for ligado, o histórico está lá. Antes de ligar, vale
-- limpar a fila, para meses de mensagens velhas não saírem de uma vez.
--
-- As ações alertas_inventario e alertas_gestao seguem ativas: elas só contam
-- e devolvem o número, não dependem de e-mail para rodar.

UPDATE public.automatic_actions
   SET is_active = false,
       last_result = 'Desligada: envio de e-mail ainda não configurado'
 WHERE code = 'enviar_fila';
