DROP POLICY IF EXISTS "roles_select_own_or_staff" ON public.user_roles;
CREATE POLICY "roles_select_own_or_staff" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));