-- Enforce the existing per-use media requirement contract without changing assets or approvals.
BEGIN;
CREATE FUNCTION p5_media_requirements_fulfilled(version_id uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT EXISTS(SELECT 1 FROM content_versions WHERE id=version_id) AND NOT EXISTS(
  SELECT 1 FROM media_requirements mr JOIN content_versions cv ON cv.id=mr.target_content_version_id
  WHERE cv.id=version_id AND (
   (mr.required AND NOT EXISTS(
    SELECT 1 FROM jsonb_array_elements(coalesce(cv.payload->'activities','[]')) activity
    CROSS JOIN LATERAL jsonb_array_elements(coalesce(activity->'media_refs','[]')) ref
    WHERE activity->>'id'=mr.item_id::text AND ref->>'role'=mr.role
   )) OR EXISTS(
    SELECT 1 FROM jsonb_array_elements(coalesce(cv.payload->'activities','[]')) activity
    CROSS JOIN LATERAL jsonb_array_elements(coalesce(activity->'media_refs','[]')) ref
    LEFT JOIN asset_versions av ON av.asset_id=(ref->>'asset_id')::uuid AND av.version=(ref->>'asset_version')::integer AND av.language_id=mr.language_id
    LEFT JOIN assets a ON a.id=av.asset_id
    WHERE activity->>'id'=mr.item_id::text AND ref->>'role'=mr.role AND (
     a.kind IS DISTINCT FROM mr.kind OR a.variety IS DISTINCT FROM mr.variety OR a.stable_code IS DISTINCT FROM ref->>'asset_stable_code'
     OR av.metadata->'decorative' IS DISTINCT FROM to_jsonb(mr.accessibility_role='decorative')
    )
   )
  )
 )
$$;

CREATE FUNCTION p5_publication_accessibility_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status='published' AND EXISTS(
  SELECT 1 FROM publication_entries pe WHERE pe.publication_id=NEW.id AND NOT p5_media_requirements_fulfilled(pe.content_version_id)
 ) THEN RAISE EXCEPTION 'required media declaration is not fulfilled or accessibility role differs' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER publication_accessibility_guard BEFORE INSERT OR UPDATE ON publications FOR EACH ROW EXECUTE FUNCTION p5_publication_accessibility_guard();
COMMIT;
