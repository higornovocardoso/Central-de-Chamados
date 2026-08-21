-- Trocar o requerente deixava o antigo pendurado em ticket_actors: o gatilho
-- removia o responsável anterior, mas não o requerente anterior. O chamado
-- ficava com dois "Requerente" na lista de atores.
--
-- Também passa a trocar o ator quando o chamado sai de pessoa com conta para
-- pessoa sem conta (e vice-versa): quem veio pelo formulário público entra
-- por alternative_email, quem tem conta entra por user_id.

CREATE OR REPLACE FUNCTION public.sync_ticket_actors()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Requerente mudou: o anterior deixa de ser ator, seja ele conta ou e-mail.
  IF TG_OP = 'UPDATE'
     AND (OLD.requester_id IS DISTINCT FROM NEW.requester_id
          OR COALESCE(OLD.reporter_email,'') IS DISTINCT FROM COALESCE(NEW.reporter_email,'')) THEN
    DELETE FROM public.ticket_actors
     WHERE ticket_id = NEW.id
       AND role = 'requerente'
       AND (
         (OLD.requester_id IS NOT NULL AND user_id = OLD.requester_id)
         OR (COALESCE(OLD.reporter_email,'') <> ''
             AND alternative_email = OLD.reporter_email)
       );
  END IF;

  IF NEW.requester_id IS NOT NULL THEN
    INSERT INTO public.ticket_actors (ticket_id, role, user_id)
    SELECT NEW.id, 'requerente', NEW.requester_id
     WHERE NOT EXISTS (
       SELECT 1 FROM public.ticket_actors a
        WHERE a.ticket_id = NEW.id AND a.role = 'requerente'
          AND a.user_id = NEW.requester_id);

  ELSIF length(trim(COALESCE(NEW.reporter_email, ''))) > 0 THEN
    INSERT INTO public.ticket_actors (ticket_id, role, alternative_email)
    SELECT NEW.id, 'requerente', NEW.reporter_email
     WHERE NOT EXISTS (
       SELECT 1 FROM public.ticket_actors a
        WHERE a.ticket_id = NEW.id AND a.role = 'requerente'
          AND a.alternative_email = NEW.reporter_email);
  END IF;

  IF NEW.assignee_id IS NOT NULL THEN
    INSERT INTO public.ticket_actors (ticket_id, role, user_id)
    SELECT NEW.id, 'atribuido', NEW.assignee_id
     WHERE NOT EXISTS (
       SELECT 1 FROM public.ticket_actors a
        WHERE a.ticket_id = NEW.id AND a.role = 'atribuido'
          AND a.user_id = NEW.assignee_id);
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.assignee_id IS NOT NULL
     AND OLD.assignee_id IS DISTINCT FROM NEW.assignee_id THEN
    DELETE FROM public.ticket_actors
     WHERE ticket_id = NEW.id AND role = 'atribuido' AND user_id = OLD.assignee_id;
  END IF;

  RETURN NULL;
END; $function$;
