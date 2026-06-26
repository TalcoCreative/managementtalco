
-- Public can delete comments (they will provide name and we log it)
CREATE POLICY "Anyone can delete comments" ON public.ep_comments
  FOR DELETE TO public USING (true);
GRANT DELETE ON public.ep_comments TO anon;

-- Public can update non-internal slide_blocks (brief/copywriting/caption editable from client view)
CREATE POLICY "Anyone can update non-internal blocks" ON public.slide_blocks
  FOR UPDATE TO public USING (is_internal = false) WITH CHECK (is_internal = false);
GRANT UPDATE ON public.slide_blocks TO anon;

-- Public can update editorial_slides (e.g. publish_date)
CREATE POLICY "Anyone can update slides" ON public.editorial_slides
  FOR UPDATE TO public USING (true) WITH CHECK (true);
GRANT UPDATE ON public.editorial_slides TO anon;
