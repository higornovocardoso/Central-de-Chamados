ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS reporter_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS reporter_email text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS reporter_sector text NOT NULL DEFAULT '';

ALTER TABLE public.tickets ALTER COLUMN requester_id DROP NOT NULL;

GRANT INSERT ON public.tickets TO anon;

CREATE POLICY "tickets_insert_public" ON public.tickets
FOR INSERT TO anon
WITH CHECK (
  requester_id IS NULL
  AND assignee_id IS NULL
  AND status = 'aberto'::public.ticket_status
  AND length(trim(reporter_name)) > 1
  AND length(trim(reporter_email)) > 4
  AND length(trim(title)) > 2
);