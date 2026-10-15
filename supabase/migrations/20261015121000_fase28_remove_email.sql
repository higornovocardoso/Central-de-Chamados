-- Sai a função de e-mail, por inteiro.
--
-- O sistema não tem domínio próprio para enviar e-mail. O que existia era
-- uma fila que os gatilhos enchiam (chamado aberto, acompanhamento público,
-- solução, validação) e que só saía quando alguém apertava "Enviar agora",
-- mais um coletor de entrada que dependia de serviço externo. Saem:
--   * os gatilhos que enfileiravam e a função que enfileirava;
--   * a fila, os modelos, os destinatários e as notificações;
--   * os coletores e a lista de bloqueio deles;
--   * os campos de remetente, assinatura e prefixo da empresa;
--   * a ação automática de envio e os direitos das telas de e-mail.
-- O e-mail de quem abre chamado (reporter_email) fica: é contato e é o que
-- decide a empresa no formulário público.

drop trigger if exists tickets_notify on public.tickets;
drop trigger if exists comments_notify on public.ticket_comments;
drop trigger if exists validations_notify on public.ticket_validations;

drop function if exists public.notify_ticket_events();
drop function if exists public.notify_followup();
drop function if exists public.notify_validation();
drop function if exists public.enqueue_notification(text, uuid, text);

drop table if exists public.notification_queue;
drop table if exists public.notification_recipients;
drop table if exists public.notifications;
drop table if exists public.notification_templates;
drop table if exists public.collector_blacklist;
drop table if exists public.mail_collectors;

alter table public.entities
  drop column if exists admin_email,
  drop column if exists admin_name,
  drop column if exists sender_email,
  drop column if exists sender_name,
  drop column if exists reply_to,
  drop column if exists notification_prefix,
  drop column if exists email_signature,
  drop column if exists notifications_enabled;

alter table public.ticket_actors drop column if exists use_notification;

delete from public.automatic_actions where code = 'enviar_fila';

delete from public.profile_rights where object_key in ('notification', 'collector', 'mailqueue');
delete from public.right_definitions where key in ('notification', 'collector', 'mailqueue');
