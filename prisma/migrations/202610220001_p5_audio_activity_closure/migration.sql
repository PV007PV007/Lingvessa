-- Media delivery exposes only activity-local pins, so the normal source must be local too.
BEGIN;
CREATE FUNCTION p5_audio_activity_closure(refs jsonb,lang_id uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT NOT EXISTS(
  SELECT 1 FROM jsonb_array_elements(refs) slow_ref
  JOIN asset_versions slow ON slow.asset_id=(slow_ref->>'asset_id')::uuid AND slow.version=(slow_ref->>'asset_version')::integer AND slow.language_id=lang_id
  WHERE slow.metadata->>'kind'='audio' AND slow.metadata->>'speed'='slow' AND NOT EXISTS(
   SELECT 1 FROM jsonb_array_elements(refs) normal_ref
   JOIN asset_versions normal ON normal.asset_id=(normal_ref->>'asset_id')::uuid AND normal.version=(normal_ref->>'asset_version')::integer AND normal.language_id=lang_id
   WHERE normal.asset_id=(slow.metadata->>'normal_asset_id')::uuid AND normal.version=(slow.metadata->>'normal_asset_version')::integer
    AND normal.metadata->>'kind'='audio' AND normal.metadata->>'speed'='normal'
  )
 )
$$;
CREATE FUNCTION p5_content_audio_closure(version_id uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT EXISTS(SELECT 1 FROM content_versions WHERE id=version_id) AND NOT EXISTS(
  SELECT 1 FROM content_versions cv CROSS JOIN LATERAL jsonb_array_elements(coalesce(cv.payload->'activities','[]')) activity
  WHERE cv.id=version_id AND NOT p5_audio_activity_closure(coalesce(activity->'media_refs','[]'),cv.language_id)
 )
$$;
CREATE FUNCTION p5_publication_audio_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status='published' AND EXISTS(
  SELECT 1 FROM publication_entries pe WHERE pe.publication_id=NEW.id AND NOT p5_content_audio_closure(pe.content_version_id)
 ) THEN RAISE EXCEPTION 'slow audio requires its pinned normal source in the same activity' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER publication_audio_guard BEFORE INSERT OR UPDATE ON publications FOR EACH ROW EXECUTE FUNCTION p5_publication_audio_guard();
COMMIT;
