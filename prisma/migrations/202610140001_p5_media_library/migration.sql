BEGIN;
CREATE TABLE media_library_batches (
 id uuid PRIMARY KEY,stable_code text NOT NULL,version_code text NOT NULL,
 manifest_checksum text NOT NULL CHECK(manifest_checksum~'^[a-f0-9]{64}$'),
 authorization_checksum text NOT NULL CHECK(authorization_checksum~'^[a-f0-9]{64}$'),
 source_revision text NOT NULL CHECK(source_revision~'^[a-f0-9]{40}$'),
 expected_assets integer NOT NULL CHECK(expected_assets BETWEEN 1 AND 10000),
 metadata jsonb NOT NULL CHECK(jsonb_typeof(metadata)='object'),
 created_by uuid NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(stable_code,version_code)
);
CREATE FUNCTION p5_library_batch_authority() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NOT (p2_has_role(NEW.created_by,'content_editor') OR p2_has_role(NEW.created_by,'administrator')) THEN RAISE EXCEPTION 'media author required' USING ERRCODE='42501'; END IF;
 IF NEW.metadata->>'id' IS DISTINCT FROM NEW.id::text OR NEW.metadata->>'stable_code' IS DISTINCT FROM NEW.stable_code OR NEW.metadata->>'version_code' IS DISTINCT FROM NEW.version_code OR
 NEW.metadata->>'manifest_checksum' IS DISTINCT FROM NEW.manifest_checksum OR NEW.metadata->>'authorization_checksum' IS DISTINCT FROM NEW.authorization_checksum OR
 NEW.metadata->>'source_revision' IS DISTINCT FROM NEW.source_revision OR (NEW.metadata->>'expected_assets')::integer IS DISTINCT FROM NEW.expected_assets THEN RAISE EXCEPTION 'library metadata mismatch' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER library_batch_authority BEFORE INSERT ON media_library_batches FOR EACH ROW EXECUTE FUNCTION p5_library_batch_authority();
CREATE TRIGGER library_batch_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON media_library_batches FOR EACH STATEMENT EXECUTE FUNCTION p2_append_only();
ALTER TABLE media_requirements ALTER COLUMN target_content_version_id DROP NOT NULL;
ALTER TABLE media_requirements ALTER COLUMN item_id DROP NOT NULL;
ALTER TABLE media_requirements ADD COLUMN library_batch_id uuid REFERENCES media_library_batches(id);
ALTER TABLE media_requirements ADD CONSTRAINT media_requirement_one_target CHECK(
 (library_batch_id IS NULL AND target_content_version_id IS NOT NULL AND item_id IS NOT NULL) OR
 (library_batch_id IS NOT NULL AND target_content_version_id IS NULL AND item_id IS NULL));
CREATE UNIQUE INDEX media_library_requirement_role ON media_requirements(library_batch_id,language_id,role) WHERE library_batch_id IS NOT NULL;
DROP TRIGGER media_authority ON media_requirements;
CREATE FUNCTION p5_media_requirement_authority() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE cv content_versions; batch media_library_batches;
BEGIN
 IF NOT (p2_has_role(NEW.created_by,'content_editor') OR p2_has_role(NEW.created_by,'administrator')) THEN RAISE EXCEPTION 'media author required' USING ERRCODE='42501'; END IF;
 IF NEW.library_batch_id IS NULL THEN
  SELECT * INTO cv FROM content_versions WHERE id=NEW.target_content_version_id FOR UPDATE;
  IF NOT FOUND OR cv.status='published' OR NOT EXISTS(SELECT 1 FROM activity_items WHERE id=NEW.item_id AND lesson_id=cv.entity_id AND language_id=NEW.language_id) THEN RAISE EXCEPTION 'editable lesson item required' USING ERRCODE='23514'; END IF;
 ELSE
  SELECT * INTO batch FROM media_library_batches WHERE id=NEW.library_batch_id FOR UPDATE;
  IF NOT FOUND OR batch.created_by<>NEW.created_by THEN RAISE EXCEPTION 'library ownership mismatch' USING ERRCODE='23514'; END IF;
  IF (SELECT count(*) FROM media_requirements WHERE library_batch_id=NEW.library_batch_id)>=batch.expected_assets THEN RAISE EXCEPTION 'library inventory exceeded' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER media_authority BEFORE INSERT ON media_requirements FOR EACH ROW EXECUTE FUNCTION p5_media_requirement_authority();
ALTER TABLE media_jobs ADD COLUMN job_kind text NOT NULL DEFAULT 'generation' CHECK(job_kind IN ('generation','library_import'));
CREATE FUNCTION p5_library_import_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE req media_requirements; batch media_library_batches;
BEGIN
 SELECT * INTO req FROM media_requirements WHERE id=NEW.requirement_id;
 IF req.library_batch_id IS NOT NULL AND NEW.job_kind<>'library_import' THEN RAISE EXCEPTION 'library import does not start synthesis' USING ERRCODE='23514'; END IF;
 IF NEW.job_kind='library_import' THEN
  SELECT * INTO batch FROM media_library_batches WHERE id=req.library_batch_id;
  IF req.library_batch_id IS NULL OR batch.created_by IS DISTINCT FROM NEW.created_by OR NEW.provider_adapter_code<>'approved_media_import' THEN RAISE EXCEPTION 'owned library batch required' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER media_library_import_guard BEFORE INSERT ON media_jobs FOR EACH ROW EXECUTE FUNCTION p5_library_import_guard();
CREATE FUNCTION p5_acoustic_candidate_scope() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.provider_code='local_acoustic_ipa' AND NOT NEW.test_only THEN RAISE EXCEPTION 'candidate calibration must be test-only' USING ERRCODE='23514'; END IF; RETURN NEW;
END $$;
CREATE TRIGGER acoustic_candidate_scope BEFORE INSERT ON speech_policies FOR EACH ROW EXECUTE FUNCTION p5_acoustic_candidate_scope();
COMMIT;
