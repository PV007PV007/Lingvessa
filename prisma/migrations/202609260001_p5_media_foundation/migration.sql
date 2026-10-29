-- IMP-P5-001. Additive media identities, immutable bytes/metadata and publication pins.
-- P8 approval UI and production publication gates remain outside this migration.
BEGIN;
CREATE FUNCTION p5_media_scope(language_id uuid,variety text) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT EXISTS(SELECT 1 FROM languages l WHERE l.id=language_id AND
   ((l.stable_code='en' AND variety IN ('common','en-GB','en-US')) OR (l.stable_code='cs' AND variety='cs-CZ')))
$$;
CREATE TABLE voices (
 id uuid NOT NULL, version_code text NOT NULL CHECK(version_code<>'' AND version_code!~'[[:space:]*]'),
 language_id uuid NOT NULL REFERENCES languages(id), stable_code text NOT NULL CHECK(stable_code~'^[A-Za-z0-9][A-Za-z0-9_-]*$'),
 variety text NOT NULL CHECK(variety IN ('en-GB','en-US','cs-CZ')), metadata jsonb NOT NULL,
 checksum text GENERATED ALWAYS AS (p2_json_checksum(metadata)) STORED NOT NULL,
 created_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(id,version_code), UNIQUE(id,version_code,language_id), UNIQUE(language_id,stable_code,version_code),
 CHECK(p5_media_scope(language_id,variety)), CHECK(jsonb_typeof(metadata)='object')
);
CREATE TABLE characters (
 id uuid NOT NULL, version_code text NOT NULL, language_id uuid NOT NULL REFERENCES languages(id),
 stable_code text NOT NULL CHECK(stable_code~'^[A-Za-z0-9][A-Za-z0-9_-]*$'), variety text NOT NULL,
 voice_id uuid NOT NULL, voice_version_code text NOT NULL, metadata jsonb NOT NULL,
 checksum text GENERATED ALWAYS AS (p2_json_checksum(metadata)) STORED NOT NULL,
 created_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(id,version_code), UNIQUE(id,version_code,language_id), UNIQUE(language_id,stable_code,version_code),
 FOREIGN KEY(voice_id,voice_version_code,language_id) REFERENCES voices(id,version_code,language_id),
 CHECK(p5_media_scope(language_id,variety)), CHECK(jsonb_typeof(metadata)='object')
);
CREATE TABLE media_requirements (
 id uuid PRIMARY KEY, target_content_version_id uuid NOT NULL, item_id uuid NOT NULL, language_id uuid NOT NULL,
 role text NOT NULL CHECK(role~'^[A-Za-z0-9][A-Za-z0-9_-]*$'), required boolean NOT NULL,
 kind text NOT NULL CHECK(kind IN ('image','avatar','vector','audio')), variety text NOT NULL,
 specification_version text NOT NULL, specification text NOT NULL, accessibility_role text NOT NULL CHECK(accessibility_role IN ('semantic','decorative')),
 created_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(id,language_id), UNIQUE(target_content_version_id,item_id,role),
 FOREIGN KEY(target_content_version_id,language_id) REFERENCES content_versions(id,language_id),
 FOREIGN KEY(item_id,language_id) REFERENCES activity_items(id,language_id), CHECK(p5_media_scope(language_id,variety))
);
CREATE TABLE media_jobs (
 id uuid PRIMARY KEY, requirement_id uuid NOT NULL, language_id uuid NOT NULL,
 idempotency_key uuid NOT NULL, request_hash text NOT NULL CHECK(request_hash~'^[a-f0-9]{64}$'),
 state text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','processing','succeeded','failed','cancelled')),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 3),
 provider_adapter_code text NOT NULL, generator_version text NOT NULL,
 error_code text, created_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(id,language_id), UNIQUE(created_by,idempotency_key),
 FOREIGN KEY(requirement_id,language_id) REFERENCES media_requirements(id,language_id)
);
CREATE TABLE assets (
 id uuid PRIMARY KEY, language_id uuid NOT NULL REFERENCES languages(id),
 stable_code text NOT NULL CHECK(stable_code~'^[A-Za-z0-9][A-Za-z0-9_-]*$'),
 kind text NOT NULL CHECK(kind IN ('image','avatar','vector','audio')), variety text NOT NULL,
 purpose text NOT NULL CHECK(length(purpose)>0), active_version integer,
 created_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(id,language_id), UNIQUE(language_id,stable_code), CHECK(p5_media_scope(language_id,variety))
);
CREATE TABLE asset_versions (
 id uuid PRIMARY KEY, asset_id uuid NOT NULL, language_id uuid NOT NULL, version integer NOT NULL CHECK(version>0),
 version_code text NOT NULL CHECK(version_code<>'' AND version_code!~'[[:space:]*]'),
 object_key text NOT NULL UNIQUE, checksum text NOT NULL CHECK(checksum~'^[a-f0-9]{64}$'),
 byte_length integer NOT NULL CHECK(byte_length BETWEEN 1 AND 33554432), mime text NOT NULL,
 metadata jsonb NOT NULL, metadata_checksum text GENERATED ALWAYS AS (p2_json_checksum(metadata)) STORED NOT NULL,
 job_id uuid NOT NULL, created_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(asset_id,version), UNIQUE(asset_id,version,language_id), UNIQUE(asset_id,version_code),
 FOREIGN KEY(asset_id,language_id) REFERENCES assets(id,language_id), FOREIGN KEY(job_id,language_id) REFERENCES media_jobs(id,language_id),
 CHECK(object_key='assets/'||asset_id::text||'/'||version::text||'/'||checksum),
 CHECK(jsonb_typeof(metadata)='object'),
 CHECK(metadata->>'asset_id' IS NOT DISTINCT FROM asset_id::text AND (metadata->>'asset_version')::integer IS NOT DISTINCT FROM version AND metadata->>'version_code' IS NOT DISTINCT FROM version_code),
 CHECK(metadata->>'checksum' IS NOT DISTINCT FROM checksum AND (metadata->>'byte_length')::integer IS NOT DISTINCT FROM byte_length AND metadata->>'mime' IS NOT DISTINCT FROM mime),
 CHECK(mime IN ('image/svg+xml','image/png','image/jpeg','image/webp','audio/wav','audio/mpeg','audio/ogg'))
);
ALTER TABLE assets ADD CONSTRAINT asset_active_version_fk FOREIGN KEY(id,active_version) REFERENCES asset_versions(asset_id,version) DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE asset_approvals (
 id uuid PRIMARY KEY, asset_id uuid NOT NULL, asset_version integer NOT NULL, language_id uuid NOT NULL,
 target_checksum text NOT NULL, target_metadata_checksum text NOT NULL,
 gate_type text NOT NULL CHECK(gate_type IN ('semantic','linguistic','originality','accessibility','rights','technical')),
 reviewer_id uuid NOT NULL REFERENCES users(id), decision text NOT NULL CHECK(decision IN ('approved','rejected')),
 notes text NOT NULL CHECK(length(btrim(notes))>0), decided_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(asset_id,asset_version,language_id) REFERENCES asset_versions(asset_id,version,language_id)
);
CREATE TABLE content_media_bindings (
 content_version_id uuid NOT NULL, item_id uuid NOT NULL, language_id uuid NOT NULL,
 asset_id uuid NOT NULL, asset_version integer NOT NULL, role text NOT NULL,
 PRIMARY KEY(content_version_id,item_id,asset_id,asset_version,role),
 FOREIGN KEY(content_version_id,language_id) REFERENCES content_versions(id,language_id),
 FOREIGN KEY(item_id,language_id) REFERENCES activity_items(id,language_id),
 FOREIGN KEY(asset_id,asset_version,language_id) REFERENCES asset_versions(asset_id,version,language_id)
);
CREATE TABLE publication_assets (
 publication_id uuid NOT NULL, asset_id uuid NOT NULL, asset_version integer NOT NULL, language_id uuid NOT NULL,
 checksum text NOT NULL, metadata_checksum text NOT NULL,
 PRIMARY KEY(publication_id,asset_id,asset_version),
 FOREIGN KEY(publication_id,language_id) REFERENCES publications(id,language_id),
 FOREIGN KEY(asset_id,asset_version,language_id) REFERENCES asset_versions(asset_id,version,language_id)
);

CREATE FUNCTION p5_asset_approved(a uuid,v integer) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT EXISTS(SELECT 1 FROM asset_versions av WHERE av.asset_id=a AND av.version=v) AND NOT EXISTS(
  SELECT 1 FROM unnest(ARRAY['semantic','linguistic','originality','accessibility','rights','technical']) gate
  WHERE NOT EXISTS(SELECT 1 FROM asset_approvals x JOIN asset_versions av ON av.asset_id=x.asset_id AND av.version=x.asset_version
   WHERE x.asset_id=a AND x.asset_version=v AND x.gate_type=gate AND x.decision='approved'
    AND x.target_checksum=av.checksum AND x.target_metadata_checksum=av.metadata_checksum))
 AND NOT EXISTS(SELECT 1 FROM asset_approvals WHERE asset_id=a AND asset_version=v AND decision='rejected')
$$;
CREATE FUNCTION p5_media_authority() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE av asset_versions; actor uuid; a assets; cv content_versions; turn jsonb; job media_jobs; req media_requirements;
BEGIN
 IF TG_TABLE_NAME='asset_approvals' THEN actor=NEW.reviewer_id; ELSE actor=NEW.created_by; END IF;
 IF TG_TABLE_NAME='asset_approvals' THEN
  SELECT * INTO av FROM asset_versions WHERE asset_id=NEW.asset_id AND version=NEW.asset_version;
  IF av.checksum IS DISTINCT FROM NEW.target_checksum OR av.metadata_checksum IS DISTINCT FROM NEW.target_metadata_checksum THEN RAISE EXCEPTION 'asset approval checksum changed' USING ERRCODE='23514'; END IF;
  IF NOT p2_has_role(actor,CASE WHEN NEW.gate_type='linguistic' THEN 'linguistic_reviewer' ELSE 'administrator' END) THEN RAISE EXCEPTION 'authorized human media reviewer required' USING ERRCODE='42501'; END IF;
 ELSE
  IF NOT (p2_has_role(actor,'content_editor') OR p2_has_role(actor,'administrator')) THEN RAISE EXCEPTION 'media author required' USING ERRCODE='42501'; END IF;
 END IF;
 IF TG_TABLE_NAME IN ('voices','characters') THEN
  PERFORM pg_advisory_xact_lock(hashtextextended(TG_TABLE_NAME||NEW.id::text,0));
  PERFORM pg_advisory_xact_lock(hashtextextended(TG_TABLE_NAME||NEW.language_id::text||NEW.stable_code,0));
  IF NEW.metadata->'scope'->>'language' IS DISTINCT FROM (SELECT stable_code FROM languages WHERE id=NEW.language_id) THEN RAISE EXCEPTION 'media profile language mismatch' USING ERRCODE='23514'; END IF;
  IF TG_TABLE_NAME='voices' AND EXISTS(SELECT 1 FROM voices v WHERE (v.id=NEW.id OR (v.language_id=NEW.language_id AND v.stable_code=NEW.stable_code)) AND (v.id<>NEW.id OR v.language_id<>NEW.language_id OR v.stable_code<>NEW.stable_code OR v.variety<>NEW.variety)) THEN RAISE EXCEPTION 'voice stable identity changed' USING ERRCODE='23514'; END IF;
  IF TG_TABLE_NAME='characters' THEN
   IF EXISTS(SELECT 1 FROM characters c WHERE (c.id=NEW.id OR (c.language_id=NEW.language_id AND c.stable_code=NEW.stable_code)) AND (c.id<>NEW.id OR c.language_id<>NEW.language_id OR c.stable_code<>NEW.stable_code OR c.variety<>NEW.variety)) OR NOT EXISTS(SELECT 1 FROM voices v WHERE v.id=NEW.voice_id AND v.version_code=NEW.voice_version_code AND v.language_id=NEW.language_id AND v.variety=NEW.variety) OR NEW.metadata->>'voice_id' IS DISTINCT FROM NEW.voice_id::text OR NEW.metadata->>'voice_version_code' IS DISTINCT FROM NEW.voice_version_code THEN RAISE EXCEPTION 'character/voice identity or variety mismatch' USING ERRCODE='23514'; END IF;
  END IF;
  IF NEW.metadata->>'id' IS DISTINCT FROM NEW.id::text OR NEW.metadata->>'stable_code' IS DISTINCT FROM NEW.stable_code OR NEW.metadata->>'version_code' IS DISTINCT FROM NEW.version_code OR NEW.metadata->'scope'->>'variety' IS DISTINCT FROM NEW.variety OR NEW.metadata->'rights'->>'real_person_clone' IS DISTINCT FROM 'false' THEN RAISE EXCEPTION 'voice/character metadata mismatch or unapproved clone' USING ERRCODE='23514'; END IF;
 ELSIF TG_TABLE_NAME='asset_versions' THEN
  SELECT * INTO a FROM assets WHERE id=NEW.asset_id;
  SELECT * INTO job FROM media_jobs WHERE id=NEW.job_id FOR UPDATE;
  SELECT * INTO req FROM media_requirements WHERE id=job.requirement_id;
  IF job.state<>'processing' OR req.kind IS DISTINCT FROM a.kind OR req.variety IS DISTINCT FROM a.variety THEN RAISE EXCEPTION 'asset output is outside processing job requirement' USING ERRCODE='23514'; END IF;
  IF NEW.metadata->>'kind' IS DISTINCT FROM a.kind OR NEW.metadata->>'stable_code' IS DISTINCT FROM a.stable_code OR NEW.metadata->'scope'->>'variety' IS DISTINCT FROM a.variety OR NEW.metadata->'scope'->>'language' IS DISTINCT FROM (SELECT stable_code FROM languages WHERE id=NEW.language_id) OR NEW.metadata->'rights'->>'real_person_clone' IS DISTINCT FROM 'false' THEN RAISE EXCEPTION 'asset metadata language/identity/rights mismatch' USING ERRCODE='23514'; END IF;
  IF a.kind='avatar' AND NOT EXISTS(SELECT 1 FROM characters c WHERE c.id=(NEW.metadata->>'character_id')::uuid AND c.version_code=NEW.metadata->>'character_version_code' AND c.language_id=NEW.language_id AND a.variety IN ('common',c.variety)) THEN RAISE EXCEPTION 'avatar character version/language mismatch' USING ERRCODE='23514'; END IF;
  IF a.kind='audio' THEN
   IF NOT EXISTS(SELECT 1 FROM voices v WHERE v.id=(NEW.metadata->>'voice_id')::uuid AND v.version_code=NEW.metadata->>'voice_version_code' AND v.language_id=NEW.language_id AND v.variety=a.variety) THEN RAISE EXCEPTION 'audio voice language/variety mismatch' USING ERRCODE='23514'; END IF;
   IF NEW.metadata->>'speed'='slow' AND NOT EXISTS(
    SELECT 1 FROM asset_versions normal JOIN assets source ON source.id=normal.asset_id
    WHERE normal.asset_id=(NEW.metadata->>'normal_asset_id')::uuid AND normal.version=(NEW.metadata->>'normal_asset_version')::integer
     AND normal.language_id=NEW.language_id AND source.variety=a.variety AND source.kind='audio'
     AND normal.metadata->>'speed'='normal' AND normal.metadata->>'script_hash'=NEW.metadata->>'script_hash'
     AND normal.metadata->>'voice_id'=NEW.metadata->>'voice_id' AND normal.metadata->>'voice_version_code'=NEW.metadata->>'voice_version_code'
     AND normal.metadata->>'transcript'=NEW.metadata->>'transcript'
     AND (SELECT coalesce(jsonb_agg(t-ARRAY['start_ms','end_ms'] ORDER BY n),'[]') FROM jsonb_array_elements(coalesce(normal.metadata->'turns','[]')) WITH ORDINALITY x(t,n))
      = (SELECT coalesce(jsonb_agg(t-ARRAY['start_ms','end_ms'] ORDER BY n),'[]') FROM jsonb_array_elements(coalesce(NEW.metadata->'turns','[]')) WITH ORDINALITY x(t,n))
   ) THEN RAISE EXCEPTION 'slow audio must pin the same script and voice at normal speed' USING ERRCODE='23514'; END IF;
   FOR turn IN SELECT value FROM jsonb_array_elements(coalesce(NEW.metadata->'turns','[]')) LOOP
    IF turn->>'turn_id' IS NULL OR (turn->>'turn_id')::uuid IS NULL OR (SELECT count(*) FROM jsonb_array_elements(NEW.metadata->'turns') t WHERE t->>'turn_id'=turn->>'turn_id')<>1 THEN RAISE EXCEPTION 'audio requires unique UUID turn identities' USING ERRCODE='23514'; END IF;
    IF NOT EXISTS(SELECT 1 FROM voices v WHERE v.id=(turn->>'voice_id')::uuid AND v.version_code=turn->>'voice_version_code' AND v.language_id=NEW.language_id AND v.variety=a.variety) THEN RAISE EXCEPTION 'turn voice language/variety mismatch' USING ERRCODE='23514'; END IF;
    IF turn ? 'character_id' AND NOT EXISTS(SELECT 1 FROM characters c WHERE c.id=(turn->>'character_id')::uuid AND c.version_code=turn->>'character_version_code' AND c.language_id=NEW.language_id AND c.variety=a.variety AND c.voice_id=(turn->>'voice_id')::uuid AND c.voice_version_code=turn->>'voice_version_code') THEN RAISE EXCEPTION 'turn character binding mismatch' USING ERRCODE='23514'; END IF;
   END LOOP;
  END IF;
 ELSIF TG_TABLE_NAME='media_requirements' THEN
  SELECT * INTO cv FROM content_versions WHERE id=NEW.target_content_version_id FOR UPDATE;
  IF cv.status='published' OR NOT EXISTS(SELECT 1 FROM activity_items WHERE id=NEW.item_id AND lesson_id=cv.entity_id AND language_id=NEW.language_id) THEN RAISE EXCEPTION 'media requirement must target an editable lesson item' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['voices','characters','media_requirements','media_jobs','assets','asset_versions','asset_approvals'] LOOP
  EXECUTE format('CREATE TRIGGER media_authority BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION p5_media_authority()',tab);
 END LOOP;
 FOREACH tab IN ARRAY ARRAY['voices','characters','media_requirements','asset_versions','asset_approvals'] LOOP
  EXECUTE format('CREATE TRIGGER media_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION p2_append_only()',tab);
 END LOOP;
END $$;
CREATE FUNCTION p5_media_job_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.state<>'queued' OR NEW.attempts<>0 OR NEW.error_code IS NOT NULL THEN RAISE EXCEPTION 'media jobs start queued' USING ERRCODE='23514'; END IF;
 ELSE
  IF (to_jsonb(NEW)-ARRAY['state','attempts','error_code']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['state','attempts','error_code']) OR OLD.state IN ('succeeded','failed','cancelled') THEN RAISE EXCEPTION 'media job identity/terminal state immutable' USING ERRCODE='23514'; END IF;
  IF NOT ((OLD.state='queued' AND NEW.state='processing' AND NEW.attempts=OLD.attempts+1) OR (OLD.state='processing' AND NEW.state IN ('queued','succeeded','failed','cancelled') AND NEW.attempts=OLD.attempts) OR (OLD.state='queued' AND NEW.state='cancelled' AND NEW.attempts=OLD.attempts)) THEN RAISE EXCEPTION 'invalid media job transition' USING ERRCODE='23514'; END IF;
  IF NEW.state='succeeded' AND NOT EXISTS(SELECT 1 FROM asset_versions WHERE job_id=NEW.id) THEN RAISE EXCEPTION 'media job has no immutable output' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER media_job_guard BEFORE INSERT OR UPDATE ON media_jobs FOR EACH ROW EXECUTE FUNCTION p5_media_job_guard();
CREATE TRIGGER media_job_no_delete BEFORE DELETE OR TRUNCATE ON media_jobs FOR EACH STATEMENT EXECUTE FUNCTION p2_append_only();
CREATE FUNCTION p5_asset_pointer_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (to_jsonb(NEW)-'active_version') IS DISTINCT FROM (to_jsonb(OLD)-'active_version') THEN RAISE EXCEPTION 'asset identity immutable' USING ERRCODE='23514'; END IF;
 IF NEW.active_version IS NOT NULL AND NOT p5_asset_approved(NEW.id,NEW.active_version) THEN RAISE EXCEPTION 'active asset version must be approved' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER asset_pointer_guard BEFORE UPDATE ON assets FOR EACH ROW EXECUTE FUNCTION p5_asset_pointer_guard();
CREATE TRIGGER asset_no_delete BEFORE DELETE OR TRUNCATE ON assets FOR EACH STATEMENT EXECUTE FUNCTION p2_append_only();
CREATE FUNCTION p5_binding_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE cv content_versions; p publications; x record;
BEGIN
 IF TG_OP='DELETE' THEN x=OLD; ELSE x=NEW; END IF;
 IF TG_TABLE_NAME='content_media_bindings' THEN
  SELECT * INTO cv FROM content_versions WHERE id=x.content_version_id FOR UPDATE;
  IF cv.status='published' THEN RAISE EXCEPTION 'published media binding immutable' USING ERRCODE='23514'; END IF;
  IF NOT EXISTS(SELECT 1 FROM activity_items WHERE id=x.item_id AND lesson_id=cv.entity_id AND language_id=x.language_id) THEN RAISE EXCEPTION 'media binding lesson mismatch' USING ERRCODE='23514'; END IF;
 ELSE
  SELECT * INTO p FROM publications WHERE id=x.publication_id FOR UPDATE;
  IF p.status='published' THEN RAISE EXCEPTION 'published asset snapshot immutable' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN x;
END $$;
CREATE TRIGGER content_media_guard BEFORE INSERT OR UPDATE OR DELETE ON content_media_bindings FOR EACH ROW EXECUTE FUNCTION p5_binding_guard();
CREATE TRIGGER publication_assets_guard BEFORE INSERT OR UPDATE OR DELETE ON publication_assets FOR EACH ROW EXECUTE FUNCTION p5_binding_guard();
CREATE TRIGGER no_truncate_media_bindings BEFORE TRUNCATE ON content_media_bindings FOR EACH STATEMENT EXECUTE FUNCTION p2_append_only();
CREATE TRIGGER no_truncate_publication_assets BEFORE TRUNCATE ON publication_assets FOR EACH STATEMENT EXECUTE FUNCTION p2_append_only();
CREATE FUNCTION p5_avatar_closure(refs jsonb,lang_id uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT NOT EXISTS(
  SELECT 1 FROM jsonb_array_elements(refs) audio_ref
  JOIN asset_versions audio_version ON audio_version.asset_id=(audio_ref->>'asset_id')::uuid AND audio_version.version=(audio_ref->>'asset_version')::integer AND audio_version.language_id=lang_id
  CROSS JOIN LATERAL jsonb_array_elements(coalesce(audio_version.metadata->'turns','[]')) speaker_turn
  WHERE speaker_turn ? 'character_id' AND NOT EXISTS(
   SELECT 1 FROM jsonb_array_elements(refs) avatar_ref
   JOIN asset_versions avatar_version ON avatar_version.asset_id=(avatar_ref->>'asset_id')::uuid AND avatar_version.version=(avatar_ref->>'asset_version')::integer AND avatar_version.language_id=lang_id
   WHERE avatar_version.metadata->>'kind'='avatar' AND avatar_version.metadata->>'character_id'=speaker_turn->>'character_id' AND avatar_version.metadata->>'character_version_code'=speaker_turn->>'character_version_code'
  )
 )
$$;
CREATE FUNCTION p5_publication_media_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE cv content_versions; activity jsonb; ref jsonb; actual jsonb; av asset_versions;
BEGIN
 IF NEW.status<>'published' THEN RETURN NEW; END IF;
 FOR cv IN SELECT v.* FROM content_versions v JOIN publication_entries pe ON pe.content_version_id=v.id WHERE pe.publication_id=NEW.id LOOP
  FOR activity IN SELECT value FROM jsonb_array_elements(coalesce(cv.payload->'activities','[]')) LOOP
   IF activity->'contract' IS NOT NULL AND coalesce(activity->'media_refs','[]') IS DISTINCT FROM coalesce(activity->'contract'->'presentation'->'media_refs','[]') THEN RAISE EXCEPTION 'activity media metadata and executable contract differ' USING ERRCODE='23514'; END IF;
   IF EXISTS(SELECT 1 FROM content_media_bindings b WHERE b.content_version_id=cv.id AND b.item_id=(activity->>'id')::uuid AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(activity->'media_refs','[]')) r WHERE (r->>'asset_id')::uuid=b.asset_id AND (r->>'asset_version')::integer=b.asset_version AND r->>'role'=b.role)) THEN RAISE EXCEPTION 'media binding absent from content payload' USING ERRCODE='23514'; END IF;
   FOR ref IN SELECT value FROM jsonb_array_elements(coalesce(activity->'media_refs','[]')) LOOP
    SELECT v.* INTO av FROM asset_versions v JOIN assets a ON a.id=v.asset_id WHERE v.asset_id=(ref->>'asset_id')::uuid AND v.version=(ref->>'asset_version')::integer AND v.language_id=NEW.language_id AND a.stable_code=ref->>'asset_stable_code';
    IF NOT FOUND OR NOT p5_asset_approved(av.asset_id,av.version) OR NOT EXISTS(SELECT 1 FROM content_media_bindings b WHERE b.content_version_id=cv.id AND b.item_id=(activity->>'id')::uuid AND b.asset_id=av.asset_id AND b.asset_version=av.version AND b.role=ref->>'role') OR NOT EXISTS(SELECT 1 FROM publication_assets pa WHERE pa.publication_id=NEW.id AND pa.asset_id=av.asset_id AND pa.asset_version=av.version AND pa.checksum=av.checksum AND pa.metadata_checksum=av.metadata_checksum) THEN RAISE EXCEPTION 'required media missing, unapproved or unpinned' USING ERRCODE='23514'; END IF;
   END LOOP;
   IF NOT p5_avatar_closure(coalesce(activity->'media_refs','[]'),NEW.language_id) THEN RAISE EXCEPTION 'dialogue character requires its pinned avatar in the activity' USING ERRCODE='23514'; END IF;
   IF EXISTS(SELECT 1 FROM media_requirements mr WHERE mr.target_content_version_id=cv.id AND mr.item_id=(activity->>'id')::uuid AND mr.required AND NOT EXISTS(SELECT 1 FROM content_media_bindings b JOIN assets a ON a.id=b.asset_id WHERE b.content_version_id=cv.id AND b.item_id=mr.item_id AND b.role=mr.role AND a.kind=mr.kind AND a.variety=mr.variety)) THEN RAISE EXCEPTION 'required media declaration is not fulfilled' USING ERRCODE='23514'; END IF;
  END LOOP;
 END LOOP;
 IF EXISTS(SELECT 1 FROM publication_assets pa WHERE pa.publication_id=NEW.id AND NOT EXISTS(SELECT 1 FROM content_media_bindings b JOIN publication_entries pe ON pe.content_version_id=b.content_version_id WHERE pe.publication_id=NEW.id AND b.asset_id=pa.asset_id AND b.asset_version=pa.asset_version)) THEN RAISE EXCEPTION 'extraneous publication asset' USING ERRCODE='23514'; END IF;
 IF EXISTS(SELECT 1 FROM publication_assets pa JOIN asset_versions pinned ON pinned.asset_id=pa.asset_id AND pinned.version=pa.asset_version WHERE pa.publication_id=NEW.id AND (pa.checksum<>pinned.checksum OR pa.metadata_checksum<>pinned.metadata_checksum OR NOT p5_asset_approved(pa.asset_id,pa.asset_version))) THEN RAISE EXCEPTION 'asset snapshot checksum/approval mismatch' USING ERRCODE='23514'; END IF;
 IF EXISTS(SELECT 1 FROM publication_assets pa JOIN asset_versions pinned ON pinned.asset_id=pa.asset_id AND pinned.version=pa.asset_version
   WHERE pa.publication_id=NEW.id AND pinned.metadata->>'speed'='slow' AND NOT EXISTS(
    SELECT 1 FROM publication_assets normal WHERE normal.publication_id=NEW.id AND normal.asset_id=(pinned.metadata->>'normal_asset_id')::uuid AND normal.asset_version=(pinned.metadata->>'normal_asset_version')::integer
   )) THEN RAISE EXCEPTION 'slow audio requires its normal source in the publication' USING ERRCODE='23514'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('asset_id',pa.asset_id,'asset_version',pa.asset_version,'checksum',pa.checksum,'metadata_checksum',pa.metadata_checksum) ORDER BY pa.asset_id,pa.asset_version),'[]') INTO actual FROM publication_assets pa WHERE pa.publication_id=NEW.id;
 IF NEW.manifest->'assets' IS DISTINCT FROM actual THEN RAISE EXCEPTION 'publication media manifest differs from relational pins' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER publication_media_guard BEFORE INSERT OR UPDATE ON publications FOR EACH ROW EXECUTE FUNCTION p5_publication_media_guard();
COMMIT;
