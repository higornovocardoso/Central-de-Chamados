DROP POLICY IF EXISTS kb_categories_public ON public.kb_categories;
CREATE POLICY kb_categories_public ON public.kb_categories
FOR SELECT TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.kb_articles a
    WHERE a.kb_category_id = kb_categories.id
      AND a.is_faq AND a.published AND NOT a.is_deleted
  )
);

DROP POLICY IF EXISTS locations_select_public ON public.locations;
REVOKE SELECT ON public.locations FROM anon;

DROP POLICY IF EXISTS documentos_read ON storage.objects;
CREATE POLICY documentos_read ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'documentos'
  AND (
    owner = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.storage_path = storage.objects.name
        AND NOT d.is_deleted
        AND (
          d.uploaded_by = auth.uid()
          OR d.entity_id IN (SELECT public.visible_entity_ids(auth.uid()))
        )
    )
  )
);

REVOKE EXECUTE ON FUNCTION public.run_automatic_action(text) FROM PUBLIC, anon, authenticated;