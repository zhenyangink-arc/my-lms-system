-- ISOLATED CONTRACT FIXTURE ONLY. Not a migration or an origin reconstruction.
-- Models VERIFIED HISTORICAL PRECONDITION; original grant event remains UNKNOWN.
-- The partial 34b schema has already loaded the exact 130002 function body.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO postgres, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.review_chapter_practice_binding(uuid,uuid,integer,jsonb,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_chapter_practice_binding(uuid,uuid,integer,jsonb,boolean)
  TO authenticated, service_role;
