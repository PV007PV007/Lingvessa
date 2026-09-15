-- IMP-P2-001/002/003. TS §§8-10, TD §§6-8 + Appendix E, manifest §§2.1/3.
-- Later-phase lesson runs, attempts, evidence, mastery, Review, speech and AI are deliberately absent.
BEGIN;

-- PostgreSQL JSONB text in UTF-8 is the database checksum encoding. It is not a file hash.
CREATE FUNCTION p2_json_checksum(value jsonb) RETURNS text LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT encode(sha256(convert_to(value::text,'UTF8')),'hex')
$$;

CREATE TABLE languages (
  id uuid PRIMARY KEY, stable_code text NOT NULL UNIQUE CHECK (stable_code IN ('en','cs')),
  UNIQUE(id, stable_code)
);
CREATE TABLE variants (
  id uuid PRIMARY KEY, language_id uuid NOT NULL, language_code text NOT NULL,
  code text NOT NULL UNIQUE, is_default boolean NOT NULL,
  UNIQUE(id,language_id), UNIQUE(language_id,code),
  FOREIGN KEY(language_id,language_code) REFERENCES languages(id,stable_code) ON DELETE RESTRICT,
  CHECK ((language_code='en' AND code IN ('en-GB','en-US')) OR (language_code='cs' AND code='cs-CZ')),
  CHECK (NOT is_default OR code IN ('en-GB','cs-CZ'))
);
CREATE UNIQUE INDEX variants_one_default ON variants(language_id) WHERE is_default;

CREATE TABLE users (
  id uuid PRIMARY KEY, email_normalized text NOT NULL UNIQUE,
  account_type text NOT NULL DEFAULT 'human' CHECK (account_type IN ('human','service')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled','tombstoned')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (email_normalized=lower(btrim(email_normalized)) AND position('@' IN email_normalized)>1)
);
CREATE TABLE credentials (
  id uuid PRIMARY KEY, user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
  password_hash text NOT NULL CHECK (password_hash LIKE '$argon2id$v=19$%'),
  policy_version text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE roles (
  id uuid PRIMARY KEY, stable_code text NOT NULL UNIQUE CHECK (stable_code IN
    ('learner','content_editor','linguistic_reviewer','pedagogical_reviewer','administrator','service'))
);
CREATE TABLE user_roles (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  granted_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,role_id)
);
CREATE TABLE sessions (
  id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  token_hash bytea NOT NULL UNIQUE CHECK (octet_length(token_hash)=32),
  csrf_hash bytea NOT NULL CHECK (octet_length(csrf_hash)=32),
  created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL,
  revoked_at timestamptz, authenticated_at timestamptz NOT NULL DEFAULT now(),
  mfa_verified_at timestamptz, CHECK (expires_at>created_at)
);
CREATE INDEX sessions_owner_active ON sessions(user_id) WHERE revoked_at IS NULL;
CREATE TABLE auth_rate_windows (
  key_hash bytea PRIMARY KEY CHECK(octet_length(key_hash)=32),
  attempts integer NOT NULL CHECK(attempts>0), expires_at timestamptz NOT NULL
);
CREATE TABLE consents (
  id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  purpose text NOT NULL, policy_version text NOT NULL, granted boolean NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(), CHECK (length(purpose)>0 AND length(policy_version)>0)
);
CREATE INDEX consents_owner_purpose_time ON consents(user_id,purpose,recorded_at DESC,id);
CREATE TABLE language_profiles (
  id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  language_id uuid NOT NULL REFERENCES languages(id) ON DELETE RESTRICT,
  variant_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id,language_id), UNIQUE(id,user_id,language_id), UNIQUE(id,language_id),
  FOREIGN KEY(variant_id,language_id) REFERENCES variants(id,language_id) ON DELETE RESTRICT
);
CREATE TABLE user_settings (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE RESTRICT,
  active_language_profile_id uuid, active_language_id uuid,
  ui_locale text NOT NULL DEFAULT 'uk-UA' CHECK (ui_locale='uk-UA'),
  timezone text NOT NULL DEFAULT 'UTC', learner_ai_opt_in boolean NOT NULL DEFAULT false,
  revision integer NOT NULL DEFAULT 1 CHECK (revision>0),
  CHECK ((active_language_profile_id IS NULL)=(active_language_id IS NULL)),
  FOREIGN KEY(active_language_profile_id,user_id,active_language_id)
    REFERENCES language_profiles(id,user_id,language_id) ON DELETE RESTRICT
);
CREATE TABLE audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid REFERENCES users(id) ON DELETE RESTRICT,
  action text NOT NULL, target_id uuid, payload jsonb NOT NULL DEFAULT '{}',
  occurred_at timestamptz NOT NULL DEFAULT now(), CHECK (jsonb_typeof(payload)='object')
);
CREATE FUNCTION p2_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'immutable historical record' USING ERRCODE='23514'; END $$;
CREATE TRIGGER audit_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON audit_events
  FOR EACH STATEMENT EXECUTE FUNCTION p2_append_only();
CREATE TRIGGER consent_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON consents
  FOR EACH STATEMENT EXECUTE FUNCTION p2_append_only();

CREATE FUNCTION p2_identity_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE subject uuid;
BEGIN
  IF TG_TABLE_NAME='user_settings' THEN
    IF NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=NEW.timezone) THEN
      RAISE EXCEPTION 'invalid IANA timezone' USING ERRCODE='23514';
    END IF;
    IF TG_OP='UPDATE' THEN
      IF NEW.user_id<>OLD.user_id THEN RAISE EXCEPTION 'immutable owner' USING ERRCODE='23514'; END IF;
      NEW.revision=OLD.revision+1;
    END IF;
    RETURN NEW;
  ELSIF TG_TABLE_NAME='language_profiles' THEN
    IF (NEW.id,NEW.user_id,NEW.language_id) IS DISTINCT FROM (OLD.id,OLD.user_id,OLD.language_id) THEN
      RAISE EXCEPTION 'immutable profile identity and owner' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
  ELSE
    IF TG_OP='UPDATE' AND NEW.user_id<>OLD.user_id THEN RAISE EXCEPTION 'immutable identity owner' USING ERRCODE='23514'; END IF;
    subject=CASE WHEN TG_OP='DELETE' THEN OLD.user_id ELSE NEW.user_id END;
    PERFORM 1 FROM users WHERE id=subject FOR UPDATE;
    UPDATE sessions SET revoked_at=now() WHERE user_id=subject AND revoked_at IS NULL;
    INSERT INTO audit_events(action,target_id,payload) VALUES
      ('identity.'||TG_TABLE_NAME||'.'||lower(TG_OP),subject,jsonb_build_object('operation',TG_OP));
    RETURN NULL;
  END IF;
END $$;
CREATE TRIGGER settings_validate BEFORE INSERT OR UPDATE ON user_settings FOR EACH ROW EXECUTE FUNCTION p2_identity_guard();
CREATE TRIGGER profile_identity BEFORE UPDATE ON language_profiles FOR EACH ROW EXECUTE FUNCTION p2_identity_guard();
CREATE TRIGGER role_change AFTER INSERT OR UPDATE OR DELETE ON user_roles FOR EACH ROW EXECUTE FUNCTION p2_identity_guard();
CREATE TRIGGER credential_change AFTER UPDATE OR DELETE ON credentials FOR EACH ROW EXECUTE FUNCTION p2_identity_guard();
CREATE FUNCTION p2_disable_sessions() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.id<>OLD.id THEN RAISE EXCEPTION 'immutable user identity' USING ERRCODE='23514'; END IF;
  IF NEW.status<>OLD.status THEN
    UPDATE sessions SET revoked_at=now() WHERE user_id=NEW.id AND revoked_at IS NULL;
    INSERT INTO audit_events(action,target_id,payload) VALUES('identity.status_changed',NEW.id,jsonb_build_object('before',OLD.status,'after',NEW.status));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER user_status BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION p2_disable_sessions();

CREATE TABLE content_entities (
  id uuid PRIMARY KEY, language_id uuid NOT NULL REFERENCES languages(id) ON DELETE RESTRICT,
  stable_code text NOT NULL CHECK (stable_code ~ '^[A-Za-z0-9][A-Za-z0-9_-]*$'),
  kind text NOT NULL CHECK (kind IN ('course','level','module','lesson','activity','knowledge','outcome','translation')),
  title text NOT NULL, variety_scope text NOT NULL DEFAULT 'common',
  UNIQUE(id,language_id), UNIQUE(language_id,stable_code), UNIQUE(id,language_id,kind)
);
CREATE FUNCTION p2_entity_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE code text;
BEGIN
  IF TG_OP='UPDATE' AND (NEW.id,NEW.language_id,NEW.stable_code,NEW.kind) IS DISTINCT FROM (OLD.id,OLD.language_id,OLD.stable_code,OLD.kind) THEN
    RAISE EXCEPTION 'immutable semantic identity' USING ERRCODE='23514';
  END IF;
  SELECT stable_code INTO code FROM languages WHERE id=NEW.language_id;
  IF NOT ((code='en' AND NEW.variety_scope IN ('common','en-GB','en-US')) OR (code='cs' AND NEW.variety_scope='cs-CZ')) THEN
    RAISE EXCEPTION 'invalid content variety' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER content_entity_identity BEFORE INSERT OR UPDATE ON content_entities FOR EACH ROW EXECUTE FUNCTION p2_entity_guard();
CREATE TABLE courses (
  id uuid PRIMARY KEY, language_id uuid NOT NULL, kind text NOT NULL DEFAULT 'course' CHECK(kind='course'),
  UNIQUE(id,language_id), FOREIGN KEY(id,language_id,kind) REFERENCES content_entities(id,language_id,kind) ON DELETE RESTRICT
);
CREATE TABLE levels (
  id uuid PRIMARY KEY, language_id uuid NOT NULL, course_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'level' CHECK(kind='level'),
  cefr text NOT NULL CHECK(cefr IN ('A1','A2','B1','B2','C1')), position integer NOT NULL CHECK(position>=0),
  UNIQUE(id,language_id), UNIQUE(course_id,cefr),
  FOREIGN KEY(id,language_id,kind) REFERENCES content_entities(id,language_id,kind) ON DELETE RESTRICT,
  FOREIGN KEY(course_id,language_id) REFERENCES courses(id,language_id) ON DELETE RESTRICT
);
CREATE TABLE modules (
  id uuid PRIMARY KEY, language_id uuid NOT NULL, level_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'module' CHECK(kind='module'), position integer NOT NULL CHECK(position>=0),
  UNIQUE(id,language_id), UNIQUE(level_id,position),
  FOREIGN KEY(id,language_id,kind) REFERENCES content_entities(id,language_id,kind) ON DELETE RESTRICT,
  FOREIGN KEY(level_id,language_id) REFERENCES levels(id,language_id) ON DELETE RESTRICT
);
CREATE TABLE lessons (
  id uuid PRIMARY KEY, language_id uuid NOT NULL, module_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'lesson' CHECK(kind='lesson'), unit_kind text NOT NULL CHECK(unit_kind IN ('lesson','recap')),
  position integer NOT NULL CHECK(position>=0), UNIQUE(id,language_id), UNIQUE(module_id,position),
  FOREIGN KEY(id,language_id,kind) REFERENCES content_entities(id,language_id,kind) ON DELETE RESTRICT,
  FOREIGN KEY(module_id,language_id) REFERENCES modules(id,language_id) ON DELETE RESTRICT
);
CREATE TABLE activity_items (
  id uuid PRIMARY KEY, language_id uuid NOT NULL, lesson_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'activity' CHECK(kind='activity'), activity_type text NOT NULL,
  response_modality text NOT NULL CHECK(response_modality IN ('none','selection','typed','speech')),
  position integer NOT NULL CHECK(position>=0), UNIQUE(id,language_id), UNIQUE(lesson_id,position),
  FOREIGN KEY(id,language_id,kind) REFERENCES content_entities(id,language_id,kind) ON DELETE RESTRICT,
  FOREIGN KEY(lesson_id,language_id) REFERENCES lessons(id,language_id) ON DELETE RESTRICT
);
CREATE TABLE knowledge_items (
  id uuid PRIMARY KEY, language_id uuid NOT NULL, kind text NOT NULL DEFAULT 'knowledge' CHECK(kind='knowledge'),
  knowledge_type text NOT NULL, canonical_form text NOT NULL, sense text NOT NULL,
  cefr text NOT NULL CHECK(cefr IN ('A1','A2','B1','B2','C1')),
  learning_scope text NOT NULL CHECK(learning_scope IN ('active','receptive','both')),
  status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','deprecated')),
  schema_version text NOT NULL DEFAULT '1.7',
  UNIQUE(id,language_id),
  FOREIGN KEY(id,language_id,kind) REFERENCES content_entities(id,language_id,kind) ON DELETE RESTRICT
);
CREATE TABLE outcomes (
  id uuid PRIMARY KEY, language_id uuid NOT NULL, kind text NOT NULL DEFAULT 'outcome' CHECK(kind='outcome'),
  cefr text NOT NULL, can_do text NOT NULL, source_reference text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','deprecated')), version_code text NOT NULL DEFAULT '1',
  UNIQUE(id,language_id),
  FOREIGN KEY(id,language_id,kind) REFERENCES content_entities(id,language_id,kind) ON DELETE RESTRICT
);
CREATE TABLE knowledge_edges (
  id uuid PRIMARY KEY, language_id uuid NOT NULL, from_id uuid NOT NULL, to_id uuid NOT NULL,
  edge_type text NOT NULL CHECK(edge_type IN ('prerequisite','contrast','component','variant','reuse','co_occurrence')),
  direction text NOT NULL CHECK(direction IN ('directed','bidirectional')), weight numeric(6,5) NOT NULL CHECK(weight BETWEEN 0 AND 1),
  version_code text NOT NULL, review_status text NOT NULL CHECK(review_status IN ('draft','approved')),
  provenance jsonb NOT NULL CHECK(jsonb_typeof(provenance)='object'),
  UNIQUE(id,language_id), UNIQUE(from_id,to_id,edge_type,version_code), CHECK(from_id<>to_id),
  FOREIGN KEY(from_id,language_id) REFERENCES knowledge_items(id,language_id) ON DELETE RESTRICT,
  FOREIGN KEY(to_id,language_id) REFERENCES knowledge_items(id,language_id) ON DELETE RESTRICT
);
-- Registry rows contain content validation data, not mastery states/projections.
CREATE TABLE skill_facet_pairs (skill text NOT NULL, facet text NOT NULL, PRIMARY KEY(skill,facet));
CREATE TABLE item_knowledge_map (
  item_id uuid NOT NULL, knowledge_item_id uuid NOT NULL, language_id uuid NOT NULL,
  role text NOT NULL CHECK(role IN ('teach','practice','assess')), skill text NOT NULL, facet text NOT NULL,
  evidence_weight numeric(6,5) NOT NULL CHECK(evidence_weight>0 AND evidence_weight<=1),
  PRIMARY KEY(item_id,knowledge_item_id,skill,facet),
  FOREIGN KEY(item_id,language_id) REFERENCES activity_items(id,language_id) ON DELETE RESTRICT,
  FOREIGN KEY(knowledge_item_id,language_id) REFERENCES knowledge_items(id,language_id) ON DELETE RESTRICT,
  FOREIGN KEY(skill,facet) REFERENCES skill_facet_pairs(skill,facet) ON DELETE RESTRICT
);
CREATE TABLE item_outcome_map (
  item_id uuid NOT NULL, outcome_id uuid NOT NULL, language_id uuid NOT NULL, PRIMARY KEY(item_id,outcome_id),
  FOREIGN KEY(item_id,language_id) REFERENCES activity_items(id,language_id) ON DELETE RESTRICT,
  FOREIGN KEY(outcome_id,language_id) REFERENCES outcomes(id,language_id) ON DELETE RESTRICT
);
CREATE FUNCTION p2_evidence_map_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE modality text;
BEGIN
  SELECT response_modality INTO modality FROM activity_items WHERE id=NEW.item_id AND language_id=NEW.language_id;
  IF NEW.skill IN ('speaking','pronunciation') AND modality IS DISTINCT FROM 'speech' THEN
    RAISE EXCEPTION 'speech evidence requires learner speech modality' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER evidence_map_modality BEFORE INSERT OR UPDATE ON item_knowledge_map FOR EACH ROW EXECUTE FUNCTION p2_evidence_map_guard();

CREATE TABLE content_versions (
  id uuid PRIMARY KEY, entity_id uuid NOT NULL, language_id uuid NOT NULL,
  version_code text NOT NULL CHECK(length(version_code)>0), schema_version text NOT NULL,
  payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object'),
  checksum text GENERATED ALWAYS AS (p2_json_checksum(payload)) STORED,
  status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published')),
  revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
  source_kind text NOT NULL CHECK(source_kind IN ('human','ai_assisted','imported')),
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,language_id), UNIQUE(id,entity_id,language_id), UNIQUE(entity_id,version_code),
  FOREIGN KEY(entity_id,language_id) REFERENCES content_entities(id,language_id) ON DELETE RESTRICT
);
CREATE TABLE translations (
  id uuid PRIMARY KEY, language_id uuid NOT NULL, content_version_id uuid NOT NULL,
  locale text NOT NULL CHECK(locale='uk-UA'), payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object'),
  version_code text NOT NULL, checksum text GENERATED ALWAYS AS (p2_json_checksum(payload)) STORED,
  UNIQUE(id,language_id), UNIQUE(content_version_id,locale,version_code),
  FOREIGN KEY(content_version_id,language_id) REFERENCES content_versions(id,language_id) ON DELETE RESTRICT
);
CREATE TABLE content_version_refs (
  source_version_id uuid NOT NULL, language_id uuid NOT NULL,
  target_entity_id uuid NOT NULL, target_version_id uuid NOT NULL,
  relation text NOT NULL CHECK(relation IN ('contains','knowledge','outcome','prerequisite','contrast','component','variant','reuse','co_occurrence')),
  PRIMARY KEY(source_version_id,target_entity_id,relation),
  FOREIGN KEY(source_version_id,language_id) REFERENCES content_versions(id,language_id) ON DELETE RESTRICT,
  FOREIGN KEY(target_version_id,target_entity_id,language_id) REFERENCES content_versions(id,entity_id,language_id) ON DELETE RESTRICT
);
CREATE TABLE content_validations (
  id uuid PRIMARY KEY, content_version_id uuid NOT NULL REFERENCES content_versions(id) ON DELETE RESTRICT,
  target_checksum text NOT NULL, target_revision integer NOT NULL, validator_version text NOT NULL,
  passed boolean NOT NULL, report jsonb NOT NULL, validated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE approvals (
  id uuid PRIMARY KEY, target_content_version_id uuid NOT NULL REFERENCES content_versions(id) ON DELETE RESTRICT,
  target_checksum text NOT NULL, target_revision integer NOT NULL,
  gate_type text NOT NULL CHECK(gate_type IN ('linguistic','pedagogical','technical','accessibility','media','originality')),
  reviewer_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  decision text NOT NULL CHECK(decision IN ('approved','rejected')), decided_at timestamptz NOT NULL DEFAULT now(), notes text NOT NULL,
  UNIQUE(target_content_version_id,target_revision,gate_type,reviewer_id)
);
CREATE TRIGGER approval_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON approvals FOR EACH STATEMENT EXECUTE FUNCTION p2_append_only();
CREATE TRIGGER validation_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON content_validations FOR EACH STATEMENT EXECUTE FUNCTION p2_append_only();

CREATE TABLE publications (
  id uuid PRIMARY KEY, course_id uuid NOT NULL, language_id uuid NOT NULL,
  channel text NOT NULL CHECK(channel IN ('test','preview','stable')),
  version_code text NOT NULL, schema_version text NOT NULL, manifest jsonb NOT NULL,
  checksum text GENERATED ALWAYS AS (p2_json_checksum(manifest)) STORED,
  status text NOT NULL DEFAULT 'building' CHECK(status IN ('building','published')),
  previous_publication_id uuid, published_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  published_at timestamptz, UNIQUE(id,language_id), UNIQUE(id,course_id,language_id,channel),
  UNIQUE(course_id,channel,version_code),
  FOREIGN KEY(course_id,language_id) REFERENCES courses(id,language_id) ON DELETE RESTRICT,
  FOREIGN KEY(previous_publication_id,course_id,language_id,channel) REFERENCES publications(id,course_id,language_id,channel) ON DELETE RESTRICT,
  CHECK((status='published')=(published_at IS NOT NULL))
);
CREATE TABLE publication_entries (
  publication_id uuid NOT NULL, entity_id uuid NOT NULL, content_version_id uuid NOT NULL, language_id uuid NOT NULL,
  content_checksum text NOT NULL, PRIMARY KEY(publication_id,entity_id),
  FOREIGN KEY(publication_id,language_id) REFERENCES publications(id,language_id) ON DELETE RESTRICT,
  FOREIGN KEY(content_version_id,entity_id,language_id) REFERENCES content_versions(id,entity_id,language_id) ON DELETE RESTRICT
);
CREATE TABLE publication_pointers (
  course_id uuid NOT NULL, language_id uuid NOT NULL, channel text NOT NULL,
  publication_id uuid NOT NULL, revision integer NOT NULL DEFAULT 1,
  updated_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT, updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(course_id,channel),
  FOREIGN KEY(publication_id,course_id,language_id,channel) REFERENCES publications(id,course_id,language_id,channel) ON DELETE RESTRICT
);
-- Curriculum selection context only; P3 owns lesson runs, attempts, evaluation and position advancement.
CREATE TABLE user_courses (
  id uuid PRIMARY KEY, user_id uuid NOT NULL, language_profile_id uuid NOT NULL, language_id uuid NOT NULL,
  course_id uuid NOT NULL, selected_lesson_id uuid,
  UNIQUE(language_profile_id,course_id), UNIQUE(id,user_id,language_profile_id,language_id),
  FOREIGN KEY(language_profile_id,user_id,language_id) REFERENCES language_profiles(id,user_id,language_id) ON DELETE RESTRICT,
  FOREIGN KEY(course_id,language_id) REFERENCES courses(id,language_id) ON DELETE RESTRICT,
  FOREIGN KEY(selected_lesson_id,language_id) REFERENCES lessons(id,language_id) ON DELETE RESTRICT
);
CREATE FUNCTION p2_course_selection_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.selected_lesson_id IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM lessons l JOIN modules m ON m.id=l.module_id JOIN levels v ON v.id=m.level_id
    WHERE l.id=NEW.selected_lesson_id AND v.course_id=NEW.course_id AND l.language_id=NEW.language_id
  ) THEN RAISE EXCEPTION 'lesson outside selected course' USING ERRCODE='23514'; END IF;
  IF TG_OP='UPDATE' AND (NEW.id,NEW.user_id,NEW.language_profile_id,NEW.language_id,NEW.course_id) IS DISTINCT FROM
      (OLD.id,OLD.user_id,OLD.language_profile_id,OLD.language_id,OLD.course_id) THEN
    RAISE EXCEPTION 'immutable selection owner' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER course_selection BEFORE INSERT OR UPDATE ON user_courses FOR EACH ROW EXECUTE FUNCTION p2_course_selection_guard();

CREATE FUNCTION p2_has_role(actor uuid, role_code text) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS(SELECT 1 FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id
    WHERE u.id=actor AND u.status='active' AND u.account_type='human' AND r.stable_code=role_code)
$$;
CREATE FUNCTION p2_approval_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v content_versions; required_role text;
BEGIN
  SELECT * INTO v FROM content_versions WHERE id=NEW.target_content_version_id FOR UPDATE;
  IF NOT FOUND OR NEW.target_checksum<>v.checksum OR NEW.target_revision<>v.revision THEN
    RAISE EXCEPTION 'approval target changed' USING ERRCODE='23514';
  END IF;
  required_role=CASE NEW.gate_type WHEN 'linguistic' THEN 'linguistic_reviewer' WHEN 'pedagogical' THEN 'pedagogical_reviewer' ELSE 'administrator' END;
  IF NOT p2_has_role(NEW.reviewer_id,required_role) THEN
    RAISE EXCEPTION 'approval requires an authorized human reviewer' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER approval_target BEFORE INSERT ON approvals FOR EACH ROW EXECUTE FUNCTION p2_approval_guard();
CREATE FUNCTION p2_version_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    IF OLD.status='published' THEN RAISE EXCEPTION 'published version is immutable' USING ERRCODE='23514'; END IF;
    RETURN OLD;
  END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.status<>'draft' THEN RAISE EXCEPTION 'new version must start as draft' USING ERRCODE='23514'; END IF;
    RETURN NEW;
  END IF;
  IF OLD.status='published' THEN RAISE EXCEPTION 'published version is immutable' USING ERRCODE='23514'; END IF;
  IF (NEW.id,NEW.entity_id,NEW.language_id,NEW.version_code,NEW.schema_version,NEW.source_kind,NEW.created_by,NEW.created_at)
      IS DISTINCT FROM (OLD.id,OLD.entity_id,OLD.language_id,OLD.version_code,OLD.schema_version,OLD.source_kind,OLD.created_by,OLD.created_at) THEN
    RAISE EXCEPTION 'immutable content version identity' USING ERRCODE='23514';
  END IF;
  IF NEW.status='published' THEN
    IF NEW.payload<>OLD.payload OR NOT EXISTS(SELECT 1 FROM publication_entries e JOIN publications p ON p.id=e.publication_id
       WHERE e.content_version_id=NEW.id AND p.status='published') THEN
      RAISE EXCEPTION 'version requires a sealed publication' USING ERRCODE='23514';
    END IF;
  END IF;
  NEW.revision=CASE WHEN NEW.payload<>OLD.payload OR NEW.revision<>OLD.revision THEN OLD.revision+1 ELSE OLD.revision END;
  RETURN NEW;
END $$;
CREATE TRIGGER content_version_guard BEFORE INSERT OR UPDATE OR DELETE ON content_versions FOR EACH ROW EXECUTE FUNCTION p2_version_guard();
CREATE TRIGGER no_truncate_versions BEFORE TRUNCATE ON content_versions FOR EACH STATEMENT EXECUTE FUNCTION p2_append_only();
CREATE FUNCTION p2_translation_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target uuid;
BEGIN
  target=CASE WHEN TG_OP='DELETE' THEN OLD.content_version_id ELSE NEW.content_version_id END;
  IF TG_OP='UPDATE' AND (NEW.id,NEW.content_version_id,NEW.language_id,NEW.locale,NEW.version_code)
    IS DISTINCT FROM (OLD.id,OLD.content_version_id,OLD.language_id,OLD.locale,OLD.version_code) THEN
    RAISE EXCEPTION 'immutable translation identity' USING ERRCODE='23514';
  END IF;
  PERFORM 1 FROM content_versions WHERE id=target FOR UPDATE;
  IF EXISTS(SELECT 1 FROM content_versions WHERE id=target AND status='published') THEN
    RAISE EXCEPTION 'published translation is immutable' USING ERRCODE='23514';
  END IF;
  IF TG_OP='UPDATE' OR TG_OP='DELETE' THEN
    IF EXISTS(SELECT 1 FROM content_versions WHERE id=OLD.content_version_id AND status='published') THEN
      RAISE EXCEPTION 'published translation is immutable' USING ERRCODE='23514';
    END IF;
  END IF;
  UPDATE content_versions SET revision=revision+1 WHERE id=target;
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
CREATE TRIGGER translation_guard BEFORE INSERT OR UPDATE OR DELETE ON translations FOR EACH ROW EXECUTE FUNCTION p2_translation_guard();
CREATE TRIGGER no_truncate_translations BEFORE TRUNCATE ON translations FOR EACH STATEMENT EXECUTE FUNCTION p2_append_only();
CREATE FUNCTION p2_ref_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target uuid;
BEGIN
  target=CASE WHEN TG_OP='DELETE' THEN OLD.source_version_id ELSE NEW.source_version_id END;
  IF TG_OP='UPDATE' AND NEW.source_version_id<>OLD.source_version_id THEN
    RAISE EXCEPTION 'immutable reference owner' USING ERRCODE='23514';
  END IF;
  PERFORM 1 FROM content_versions WHERE id=target FOR UPDATE;
  IF EXISTS(SELECT 1 FROM content_versions WHERE id=target AND status='published') THEN
    RAISE EXCEPTION 'published reference is immutable' USING ERRCODE='23514';
  END IF;
  UPDATE content_versions SET revision=revision+1 WHERE id=target;
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
CREATE TRIGGER content_ref_guard BEFORE INSERT OR UPDATE OR DELETE ON content_version_refs FOR EACH ROW EXECUTE FUNCTION p2_ref_guard();
CREATE TRIGGER no_truncate_refs BEFORE TRUNCATE ON content_version_refs FOR EACH STATEMENT EXECUTE FUNCTION p2_append_only();

CREATE FUNCTION p2_entry_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE pub uuid;
BEGIN
  pub=CASE WHEN TG_OP='DELETE' THEN OLD.publication_id ELSE NEW.publication_id END;
  PERFORM 1 FROM publications WHERE id=pub FOR UPDATE;
  IF EXISTS(SELECT 1 FROM publications WHERE id=pub AND status='published') OR
    (TG_OP='UPDATE' AND EXISTS(SELECT 1 FROM publications WHERE id=OLD.publication_id AND status='published')) THEN
    RAISE EXCEPTION 'published entries are immutable' USING ERRCODE='23514';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
CREATE TRIGGER publication_entry_guard BEFORE INSERT OR UPDATE OR DELETE ON publication_entries FOR EACH ROW EXECUTE FUNCTION p2_entry_guard();
CREATE TRIGGER no_truncate_entries BEFORE TRUNCATE ON publication_entries FOR EACH STATEMENT EXECUTE FUNCTION p2_append_only();

CREATE FUNCTION p2_publication_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v record; gate text; actual_entries jsonb; actual_translations jsonb; actual_refs jsonb; a jsonb; k jsonb;
BEGIN
  IF TG_OP='DELETE' THEN
    IF OLD.status='published' THEN RAISE EXCEPTION 'published snapshot is immutable' USING ERRCODE='23514'; END IF;
    RETURN OLD;
  END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.status<>'building' THEN RAISE EXCEPTION 'publication requires preflight' USING ERRCODE='23514'; END IF;
    RETURN NEW;
  END IF;
  IF OLD.status='published' THEN RAISE EXCEPTION 'published snapshot is immutable' USING ERRCODE='23514'; END IF;
  IF (NEW.id,NEW.course_id,NEW.language_id,NEW.channel,NEW.version_code,NEW.schema_version,NEW.previous_publication_id,NEW.published_by)
      IS DISTINCT FROM (OLD.id,OLD.course_id,OLD.language_id,OLD.channel,OLD.version_code,OLD.schema_version,OLD.previous_publication_id,OLD.published_by) THEN
    RAISE EXCEPTION 'immutable publication scope' USING ERRCODE='23514';
  END IF;
  IF NEW.status='published' THEN
    IF NOT p2_has_role(NEW.published_by,'administrator') THEN RAISE EXCEPTION 'publisher must be a human administrator' USING ERRCODE='42501'; END IF;
    IF NOT EXISTS(SELECT 1 FROM publication_entries WHERE publication_id=NEW.id) THEN
      RAISE EXCEPTION 'empty publication' USING ERRCODE='23514';
    END IF;
    IF NOT EXISTS(SELECT 1 FROM publication_entries WHERE publication_id=NEW.id AND entity_id=NEW.course_id) THEN
      RAISE EXCEPTION 'publication must pin its course version' USING ERRCODE='23514';
    END IF;
    IF EXISTS(
      SELECT 1 FROM publication_entries pe JOIN (
        SELECT id,course_id FROM levels UNION ALL
        SELECT m.id,l.course_id FROM modules m JOIN levels l ON l.id=m.level_id UNION ALL
        SELECT s.id,l.course_id FROM lessons s JOIN modules m ON m.id=s.module_id JOIN levels l ON l.id=m.level_id UNION ALL
        SELECT a.id,l.course_id FROM activity_items a JOIN lessons s ON s.id=a.lesson_id JOIN modules m ON m.id=s.module_id JOIN levels l ON l.id=m.level_id
      ) lineage ON lineage.id=pe.entity_id WHERE pe.publication_id=NEW.id AND lineage.course_id<>NEW.course_id
    ) THEN RAISE EXCEPTION 'publication contains another course lineage' USING ERRCODE='23514'; END IF;
    FOR v IN SELECT cv.* FROM publication_entries pe JOIN content_versions cv ON cv.id=pe.content_version_id
      WHERE pe.publication_id=NEW.id ORDER BY cv.id FOR UPDATE OF cv LOOP
      IF v.payload->>'entity_id' IS DISTINCT FROM v.entity_id::text OR
         v.payload->>'content_version_id' IS DISTINCT FROM v.id::text OR
         v.payload->>'schema_version' IS DISTINCT FROM v.schema_version OR
         v.payload->>'version_code' IS DISTINCT FROM v.version_code OR
         v.payload->>'language' IS DISTINCT FROM (SELECT stable_code FROM languages WHERE id=v.language_id) OR
         v.payload->>'stable_code' IS DISTINCT FROM (SELECT stable_code FROM content_entities WHERE id=v.entity_id) THEN
        RAISE EXCEPTION 'payload identity differs from relational identity' USING ERRCODE='23514';
      END IF;
      SELECT coalesce(jsonb_agg(jsonb_build_object('relation',r.relation,'entity_id',r.target_entity_id,
          'content_version_id',r.target_version_id,'stable_code',e.stable_code,'version_code',t.version_code)
          ORDER BY r.relation COLLATE "C",e.stable_code COLLATE "C"),'[]'::jsonb) INTO actual_refs
        FROM content_version_refs r JOIN content_versions t ON t.id=r.target_version_id
        JOIN content_entities e ON e.id=r.target_entity_id WHERE r.source_version_id=v.id;
      IF v.payload->'refs' IS DISTINCT FROM actual_refs THEN
        RAISE EXCEPTION 'payload references must match resolved UUID references in canonical order' USING ERRCODE='23514';
      END IF;
      IF EXISTS(SELECT 1 FROM content_version_refs r WHERE r.source_version_id=v.id AND NOT EXISTS(
          SELECT 1 FROM publication_entries pe WHERE pe.publication_id=NEW.id AND pe.content_version_id=r.target_version_id)) THEN
        RAISE EXCEPTION 'reference is absent from immutable publication closure' USING ERRCODE='23514';
      END IF;
      FOR a IN SELECT value FROM jsonb_array_elements(coalesce(v.payload->'activities','[]'::jsonb)) LOOP
        IF NOT EXISTS(SELECT 1 FROM activity_items i JOIN publication_entries pe ON pe.entity_id=i.id
          WHERE i.id=(a->>'id')::uuid AND i.lesson_id=v.entity_id AND i.language_id=NEW.language_id AND pe.publication_id=NEW.id) THEN
          RAISE EXCEPTION 'activity missing from publication/language lineage' USING ERRCODE='23514';
        END IF;
        FOR k IN SELECT value FROM jsonb_array_elements(a->'knowledge_refs') LOOP
          IF NOT EXISTS(SELECT 1 FROM knowledge_items ki JOIN publication_entries pe ON pe.entity_id=ki.id
            WHERE ki.id=(k->>'knowledge_item_id')::uuid AND ki.language_id=NEW.language_id AND pe.publication_id=NEW.id) THEN
            RAISE EXCEPTION 'knowledge missing from publication/language lineage' USING ERRCODE='23514';
          END IF;
        END LOOP;
      END LOOP;
      IF NOT EXISTS(SELECT 1 FROM content_validations c WHERE c.content_version_id=v.id AND c.target_checksum=v.checksum
        AND c.target_revision=v.revision AND c.passed) THEN RAISE EXCEPTION 'current validation required' USING ERRCODE='23514'; END IF;
      FOREACH gate IN ARRAY ARRAY['linguistic','pedagogical','technical','accessibility','media','originality'] LOOP
        IF NOT EXISTS(SELECT 1 FROM approvals a WHERE a.target_content_version_id=v.id AND a.target_checksum=v.checksum
          AND a.target_revision=v.revision AND a.gate_type=gate AND a.decision='approved') OR EXISTS(
          SELECT 1 FROM approvals a WHERE a.target_content_version_id=v.id AND a.target_revision=v.revision AND a.gate_type=gate AND a.decision='rejected') THEN
          RAISE EXCEPTION 'mandatory current approval required: %',gate USING ERRCODE='23514';
        END IF;
      END LOOP;
    END LOOP;
    IF EXISTS(SELECT 1 FROM publication_entries e JOIN content_versions cv ON cv.id=e.content_version_id
      WHERE e.publication_id=NEW.id AND (e.content_checksum<>cv.checksum OR cv.language_id<>NEW.language_id)) THEN
      RAISE EXCEPTION 'publication checksum mismatch' USING ERRCODE='23514';
    END IF;
    SELECT jsonb_agg(jsonb_build_object('entity_id',e.entity_id,'content_version_id',e.content_version_id,
      'stable_code',ce.stable_code,'version_code',cv.version_code,'checksum',cv.checksum) ORDER BY ce.stable_code COLLATE "C")
      INTO actual_entries FROM publication_entries e JOIN content_versions cv ON cv.id=e.content_version_id
      JOIN content_entities ce ON ce.id=e.entity_id WHERE e.publication_id=NEW.id;
    SELECT coalesce(jsonb_agg(jsonb_build_object('translation_id',t.id,'content_version_id',t.content_version_id,
      'locale',t.locale,'version_code',t.version_code,'checksum',t.checksum) ORDER BY t.id),'[]'::jsonb)
      INTO actual_translations FROM translations t JOIN publication_entries e ON e.content_version_id=t.content_version_id
      WHERE e.publication_id=NEW.id;
    IF NEW.manifest->'entries' IS DISTINCT FROM actual_entries OR
       NEW.manifest->'translations' IS DISTINCT FROM actual_translations OR
       NEW.manifest->>'publication_id' IS DISTINCT FROM NEW.id::text OR
       NEW.manifest->>'language_id' IS DISTINCT FROM NEW.language_id::text OR
       NEW.manifest->>'course_id' IS DISTINCT FROM NEW.course_id::text OR
       NEW.manifest->>'schema_version' IS DISTINCT FROM NEW.schema_version THEN
      RAISE EXCEPTION 'manifest and relational entries differ' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER publication_guard BEFORE INSERT OR UPDATE OR DELETE ON publications FOR EACH ROW EXECUTE FUNCTION p2_publication_guard();
CREATE TRIGGER no_truncate_publications BEFORE TRUNCATE ON publications FOR EACH STATEMENT EXECUTE FUNCTION p2_append_only();
CREATE FUNCTION p2_seal_versions() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status='published' AND OLD.status='building' THEN
    UPDATE content_versions SET status='published' WHERE id IN
      (SELECT content_version_id FROM publication_entries WHERE publication_id=NEW.id) AND status<>'published';
    INSERT INTO audit_events(actor_id,action,target_id,payload) VALUES(NEW.published_by,'publication.published',NEW.id,jsonb_build_object('checksum',NEW.checksum));
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER seal_content_versions AFTER UPDATE ON publications FOR EACH ROW EXECUTE FUNCTION p2_seal_versions();
CREATE FUNCTION p2_pointer_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT p2_has_role(NEW.updated_by,'administrator') THEN RAISE EXCEPTION 'human publisher required' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS(SELECT 1 FROM publications WHERE id=NEW.publication_id AND status='published') THEN
    RAISE EXCEPTION 'active pointer requires published snapshot' USING ERRCODE='23514';
  END IF;
  IF TG_OP='UPDATE' THEN
    IF (NEW.course_id,NEW.language_id,NEW.channel) IS DISTINCT FROM (OLD.course_id,OLD.language_id,OLD.channel) THEN
      RAISE EXCEPTION 'immutable pointer scope' USING ERRCODE='23514';
    END IF;
    NEW.revision=OLD.revision+1;
  END IF;
  NEW.updated_at=now();
  INSERT INTO audit_events(actor_id,action,target_id,payload) VALUES(NEW.updated_by,'publication.pointer_changed',NEW.publication_id,
    jsonb_build_object('previous_publication_id',CASE WHEN TG_OP='UPDATE' THEN OLD.publication_id ELSE NULL END));
  RETURN NEW;
END $$;
CREATE TRIGGER active_publication_guard BEFORE INSERT OR UPDATE ON publication_pointers FOR EACH ROW EXECUTE FUNCTION p2_pointer_guard();

CREATE FUNCTION p2_modality_change_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.response_modality<>'speech' AND EXISTS(SELECT 1 FROM item_knowledge_map
      WHERE item_id=NEW.id AND skill IN ('speaking','pronunciation')) THEN
    RAISE EXCEPTION 'existing speech evidence map requires speech modality' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER activity_modality_guard BEFORE UPDATE ON activity_items FOR EACH ROW EXECUTE FUNCTION p2_modality_change_guard();

-- P2 exposes no knowledge split/merge/retirement command. Later phases must supply the
-- governing migration map + impact preview before enabling such a command.
CREATE FUNCTION p2_knowledge_retirement_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' OR NEW.status<>OLD.status THEN
    RAISE EXCEPTION 'knowledge retirement requires versioned mapping and impact report; command not enabled in P2' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER knowledge_retirement_guard BEFORE UPDATE OR DELETE ON knowledge_items FOR EACH ROW EXECUTE FUNCTION p2_knowledge_retirement_guard();
CREATE TRIGGER no_truncate_knowledge BEFORE TRUNCATE ON knowledge_items FOR EACH STATEMENT EXECUTE FUNCTION p2_append_only();
-- Titles/canonical forms are authoring indexes; published readers always consume versioned payloads.
CREATE FUNCTION p2_hierarchy_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.id<>OLD.id OR NEW.language_id<>OLD.language_id THEN RAISE EXCEPTION 'immutable hierarchy identity' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
DO $$ DECLARE tab text; BEGIN
  FOREACH tab IN ARRAY ARRAY['courses','levels','modules','lessons','activity_items','knowledge_items','outcomes'] LOOP
    EXECUTE format('CREATE TRIGGER hierarchy_identity BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION p2_hierarchy_identity()',tab);
  END LOOP;
END $$;

INSERT INTO languages VALUES
 ('0198f000-0000-7000-8000-000000000001','en'),('0198f000-0000-7000-8000-000000000002','cs');
INSERT INTO variants VALUES
 ('0198f000-0000-7000-8000-000000000011','0198f000-0000-7000-8000-000000000001','en','en-GB',true),
 ('0198f000-0000-7000-8000-000000000012','0198f000-0000-7000-8000-000000000001','en','en-US',false),
 ('0198f000-0000-7000-8000-000000000013','0198f000-0000-7000-8000-000000000002','cs','cs-CZ',true);
INSERT INTO roles(id,stable_code) VALUES
 ('0198f000-0000-7000-8000-000000000021','learner'),('0198f000-0000-7000-8000-000000000022','content_editor'),
 ('0198f000-0000-7000-8000-000000000023','linguistic_reviewer'),('0198f000-0000-7000-8000-000000000024','pedagogical_reviewer'),
 ('0198f000-0000-7000-8000-000000000025','administrator'),('0198f000-0000-7000-8000-000000000026','service');
INSERT INTO skill_facet_pairs(skill,facet)
SELECT 'vocabulary',unnest(ARRAY['recognition','meaning','recall_l2_to_l1','recall_l1_to_l2','production','spelling','context_use','collocation','variant_awareness','register']) UNION ALL
SELECT 'grammar',unnest(ARRAY['grammar_form','morphology','word_order','register','context_use']) UNION ALL
SELECT 'listening',unnest(ARRAY['listening_recognition','listening_gist','listening_detail','meaning']) UNION ALL
SELECT 'speaking',unnest(ARRAY['production','context_use','register','interaction_repair','interaction_goal','intelligibility']) UNION ALL
SELECT 'writing',unnest(ARRAY['production','spelling','orthography','grammar_form','context_use','register']) UNION ALL
SELECT 'pronunciation',unnest(ARRAY['pronunciation_target','intelligibility']);
CREATE TRIGGER registry_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON skill_facet_pairs FOR EACH STATEMENT EXECUTE FUNCTION p2_append_only();
COMMIT;
