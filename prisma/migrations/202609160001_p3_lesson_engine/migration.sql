-- IMP-P3-001..004: pinned Lesson Engine, deterministic attempts and durable outbox.
-- P4 mastery/review projections, P5 speech/media jobs and all AI runtime remain absent.
BEGIN;

ALTER TABLE publication_entries
  ADD CONSTRAINT publication_entries_exact_version_language_key
  UNIQUE(publication_id,entity_id,content_version_id,language_id);
ALTER TABLE activity_items
  ADD CONSTRAINT activity_items_lesson_language_key UNIQUE(id,lesson_id,language_id);
ALTER TABLE item_knowledge_map
  ADD CONSTRAINT item_knowledge_map_language_key UNIQUE(item_id,knowledge_item_id,skill,facet,language_id);

CREATE TABLE lesson_runs (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  language_profile_id uuid NOT NULL,
  language_id uuid NOT NULL,
  variant_id uuid NOT NULL,
  publication_id uuid NOT NULL,
  publication_checksum text NOT NULL CHECK(publication_checksum ~ '^[0-9a-f]{64}$'),
  lesson_id uuid NOT NULL,
  content_version_id uuid NOT NULL,
  content_checksum text NOT NULL CHECK(content_checksum ~ '^[0-9a-f]{64}$'),
  manifest jsonb NOT NULL CHECK(jsonb_typeof(manifest)='object'),
  state text NOT NULL DEFAULT 'active' CHECK(state IN ('active','remediation','completed')),
  position integer NOT NULL DEFAULT 0 CHECK(position>=0),
  client_sequence bigint NOT NULL DEFAULT 0 CHECK(client_sequence>=0),
  revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
  started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE(id,user_id,language_profile_id,language_id),
  FOREIGN KEY(language_profile_id,user_id,language_id)
    REFERENCES language_profiles(id,user_id,language_id) ON DELETE RESTRICT,
  FOREIGN KEY(variant_id,language_id) REFERENCES variants(id,language_id) ON DELETE RESTRICT,
  FOREIGN KEY(publication_id,language_id) REFERENCES publications(id,language_id) ON DELETE RESTRICT,
  FOREIGN KEY(content_version_id,lesson_id,language_id)
    REFERENCES content_versions(id,entity_id,language_id) ON DELETE RESTRICT,
  FOREIGN KEY(publication_id,lesson_id,content_version_id,language_id)
    REFERENCES publication_entries(publication_id,entity_id,content_version_id,language_id) ON DELETE RESTRICT,
  CHECK ((state='completed')=(completed_at IS NOT NULL)),
  CHECK (manifest->>'publication_id'=publication_id::text),
  CHECK (manifest->>'publication_checksum'=publication_checksum),
  CHECK (manifest->>'lesson_id'=lesson_id::text),
  CHECK (manifest->>'content_version_id'=content_version_id::text),
  CHECK (manifest->>'language_id'=language_id::text)
);
CREATE INDEX lesson_runs_resume ON lesson_runs(user_id,language_profile_id,state,updated_at DESC)
  WHERE state<>'completed';
CREATE UNIQUE INDEX lesson_runs_one_open_pin
  ON lesson_runs(user_id,language_profile_id,publication_id,lesson_id)
  WHERE state<>'completed';

CREATE TABLE lesson_run_items (
  lesson_run_id uuid NOT NULL,
  user_id uuid NOT NULL,
  language_profile_id uuid NOT NULL,
  language_id uuid NOT NULL,
  lesson_id uuid NOT NULL,
  item_id uuid NOT NULL,
  ordinal integer NOT NULL CHECK(ordinal>=0),
  state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','active','incorrect','correct','assisted','completed')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK(attempt_count>=0),
  revealed boolean NOT NULL DEFAULT false,
  needs_remediation boolean NOT NULL DEFAULT false,
  last_attempt_id uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(lesson_run_id,item_id),
  UNIQUE(lesson_run_id,ordinal),
  UNIQUE(lesson_run_id,user_id,language_profile_id,language_id,item_id),
  FOREIGN KEY(lesson_run_id,user_id,language_profile_id,language_id)
    REFERENCES lesson_runs(id,user_id,language_profile_id,language_id) ON DELETE RESTRICT,
  FOREIGN KEY(item_id,lesson_id,language_id)
    REFERENCES activity_items(id,lesson_id,language_id) ON DELETE RESTRICT
);

CREATE TABLE activity_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  attempt_id uuid NOT NULL,
  lesson_run_id uuid NOT NULL,
  language_profile_id uuid NOT NULL,
  language_id uuid NOT NULL,
  publication_id uuid NOT NULL,
  lesson_id uuid NOT NULL,
  item_id uuid NOT NULL,
  content_version_id uuid NOT NULL,
  client_sequence bigint NOT NULL CHECK(client_sequence>0),
  request_hash text NOT NULL CHECK(request_hash ~ '^[0-9a-f]{64}$'),
  response jsonb NOT NULL CHECK(jsonb_typeof(response)='object'),
  response_hash text NOT NULL CHECK(response_hash ~ '^[0-9a-f]{64}$'),
  presentation jsonb NOT NULL CHECK(jsonb_typeof(presentation)='object'),
  assistance jsonb NOT NULL CHECK(jsonb_typeof(assistance)='object'),
  intent text NOT NULL CHECK(intent IN ('submit','reveal','continue')),
  outcome text NOT NULL CHECK(outcome IN ('correct','incorrect','assisted','unscored')),
  error_category text NOT NULL CHECK(error_category IN ('none','selection','mapping','form','order')),
  feedback text NOT NULL,
  content_schema_version text NOT NULL,
  evaluator_version text NOT NULL,
  answer_policy_id text NOT NULL,
  answer_policy_version text NOT NULL,
  mastery_model_version text NOT NULL,
  scheduler_version text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id,attempt_id),
  UNIQUE(lesson_run_id,client_sequence),
  UNIQUE(lesson_run_id,user_id,attempt_id),
  UNIQUE(user_id,attempt_id,language_profile_id,language_id,item_id,content_version_id),
  FOREIGN KEY(lesson_run_id,user_id,language_profile_id,language_id,item_id)
    REFERENCES lesson_run_items(lesson_run_id,user_id,language_profile_id,language_id,item_id) ON DELETE RESTRICT,
  FOREIGN KEY(publication_id,lesson_id,content_version_id,language_id)
    REFERENCES publication_entries(publication_id,entity_id,content_version_id,language_id) ON DELETE RESTRICT,
  CHECK ((intent='reveal')=(outcome='assisted') OR intent<>'reveal'),
  CHECK (presentation ? 'seed' AND presentation ? 'order'),
  CHECK (assistance ? 'hint_count' AND assistance ? 'reveal'),
  CHECK ((assistance->>'reveal')::boolean=(intent='reveal'))
);

-- Raw immutable evidence is accepted in P3 so the attempt transaction is complete.
-- P4 owns mastery/review projections and recompute behavior; no projection table exists here.
CREATE TABLE evidence_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  attempt_id uuid NOT NULL,
  language_profile_id uuid NOT NULL,
  language_id uuid NOT NULL,
  item_id uuid NOT NULL,
  knowledge_item_id uuid NOT NULL,
  skill text NOT NULL,
  facet text NOT NULL,
  result_class text NOT NULL CHECK(result_class IN ('positive','negative','assisted')),
  assisted boolean NOT NULL,
  base_weight numeric(6,5) NOT NULL CHECK(base_weight>0 AND base_weight<=1),
  effective_weight numeric(6,5) NOT NULL CHECK(effective_weight>=0 AND effective_weight<=base_weight),
  content_version_id uuid NOT NULL,
  content_schema_version text NOT NULL,
  evaluator_version text NOT NULL,
  mastery_model_version text NOT NULL,
  scheduler_version text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id,attempt_id,knowledge_item_id,skill,facet),
  FOREIGN KEY(user_id,attempt_id,language_profile_id,language_id,item_id,content_version_id)
    REFERENCES activity_attempts(user_id,attempt_id,language_profile_id,language_id,item_id,content_version_id) ON DELETE RESTRICT,
  FOREIGN KEY(language_profile_id,user_id,language_id)
    REFERENCES language_profiles(id,user_id,language_id) ON DELETE RESTRICT,
  FOREIGN KEY(item_id,knowledge_item_id,skill,facet,language_id)
    REFERENCES item_knowledge_map(item_id,knowledge_item_id,skill,facet,language_id) ON DELETE RESTRICT,
  FOREIGN KEY(content_version_id,language_id) REFERENCES content_versions(id,language_id) ON DELETE RESTRICT,
  CHECK (assisted=(result_class='assisted')),
  CHECK (result_class<>'assisted' OR effective_weight=0)
);

CREATE TABLE attempt_receipts (
  user_id uuid NOT NULL,
  attempt_id uuid NOT NULL,
  result jsonb NOT NULL CHECK(jsonb_typeof(result)='object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,attempt_id),
  FOREIGN KEY(user_id,attempt_id) REFERENCES activity_attempts(user_id,attempt_id) ON DELETE RESTRICT
);

CREATE TABLE outbox_events (
  id uuid PRIMARY KEY,
  event_key text NOT NULL UNIQUE,
  event_type text NOT NULL,
  event_version integer NOT NULL CHECK(event_version>0),
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  correlation_id uuid NOT NULL,
  causation_id uuid NOT NULL,
  language_profile_id uuid,
  language_id uuid,
  payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK(payload::text !~* '"(raw[_-]?audio|password|secret|authorization|cookie|provider[_-]?key|access[_-]?token|refresh[_-]?token|full[_-]?response)"[[:space:]]*:')
);
CREATE INDEX outbox_events_created ON outbox_events(created_at,id);

CREATE TABLE outbox_deliveries (
  event_id uuid NOT NULL REFERENCES outbox_events(id) ON DELETE RESTRICT,
  consumer text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','succeeded','terminal_failure')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK(attempt_count BETWEEN 0 AND 8),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  lease_expires_at timestamptz,
  last_error_code text,
  completed_at timestamptz,
  PRIMARY KEY(event_id,consumer),
  CHECK ((status IN ('succeeded','terminal_failure'))=(completed_at IS NOT NULL)),
  CHECK (last_error_code IS NULL OR last_error_code ~ '^[A-Z0-9_]{1,64}$')
);
CREATE INDEX outbox_delivery_ready ON outbox_deliveries(consumer,next_attempt_at,event_id)
  WHERE status IN ('pending','processing');

CREATE FUNCTION p3_run_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='UPDATE' THEN
    IF (NEW.id,NEW.user_id,NEW.language_profile_id,NEW.language_id,NEW.variant_id,
        NEW.publication_id,NEW.publication_checksum,NEW.lesson_id,NEW.content_version_id,
        NEW.content_checksum,NEW.manifest,NEW.started_at)
       IS DISTINCT FROM
       (OLD.id,OLD.user_id,OLD.language_profile_id,OLD.language_id,OLD.variant_id,
        OLD.publication_id,OLD.publication_checksum,OLD.lesson_id,OLD.content_version_id,
        OLD.content_checksum,OLD.manifest,OLD.started_at) THEN
      RAISE EXCEPTION 'pinned lesson run identity/manifest is immutable' USING ERRCODE='23514';
    END IF;
    IF OLD.state='completed' OR
       NOT ((OLD.state='active' AND NEW.state IN ('active','remediation','completed')) OR
            (OLD.state='remediation' AND NEW.state IN ('remediation','completed'))) THEN
      RAISE EXCEPTION 'invalid lesson run transition' USING ERRCODE='23514';
    END IF;
    IF NEW.revision<>OLD.revision+1 OR NEW.client_sequence<OLD.client_sequence THEN
      RAISE EXCEPTION 'lesson run revision/sequence conflict' USING ERRCODE='40001';
    END IF;
    NEW.updated_at=now();
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER lesson_run_guard BEFORE UPDATE ON lesson_runs FOR EACH ROW EXECUTE FUNCTION p3_run_guard();
CREATE TRIGGER no_delete_lesson_runs BEFORE DELETE OR TRUNCATE ON lesson_runs FOR EACH STATEMENT EXECUTE FUNCTION p2_append_only();

CREATE FUNCTION p3_run_item_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE run lesson_runs%ROWTYPE;
BEGIN
  SELECT * INTO run FROM lesson_runs WHERE id=NEW.lesson_run_id;
  IF run.lesson_id IS DISTINCT FROM NEW.lesson_id OR
     run.manifest->'activities'->NEW.ordinal->>'id' IS DISTINCT FROM NEW.item_id::text THEN
    RAISE EXCEPTION 'item differs from pinned manifest' USING ERRCODE='23514';
  END IF;
  IF TG_OP='UPDATE' AND (NEW.lesson_run_id,NEW.user_id,NEW.language_profile_id,NEW.language_id,NEW.lesson_id,NEW.item_id,NEW.ordinal)
    IS DISTINCT FROM (OLD.lesson_run_id,OLD.user_id,OLD.language_profile_id,OLD.language_id,OLD.lesson_id,OLD.item_id,OLD.ordinal) THEN
    RAISE EXCEPTION 'run item lineage is immutable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER run_item_lineage BEFORE INSERT OR UPDATE ON lesson_run_items FOR EACH ROW EXECUTE FUNCTION p3_run_item_guard();

CREATE FUNCTION p3_attempt_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE run lesson_runs%ROWTYPE;
BEGIN
  SELECT * INTO run FROM lesson_runs WHERE id=NEW.lesson_run_id FOR UPDATE;
  IF NOT FOUND OR (run.user_id,run.language_profile_id,run.language_id,run.publication_id,run.lesson_id,run.content_version_id)
    IS DISTINCT FROM (NEW.user_id,NEW.language_profile_id,NEW.language_id,NEW.publication_id,NEW.lesson_id,NEW.content_version_id) THEN
    RAISE EXCEPTION 'attempt lineage differs from pinned run' USING ERRCODE='23514';
  END IF;
  IF run.state='completed' THEN RAISE EXCEPTION 'completed run rejects attempts' USING ERRCODE='23514'; END IF;
  IF NEW.client_sequence<>run.client_sequence+1 THEN
    RAISE EXCEPTION 'client sequence conflict' USING ERRCODE='40001';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER attempt_lineage BEFORE INSERT ON activity_attempts FOR EACH ROW EXECUTE FUNCTION p3_attempt_guard();
CREATE TRIGGER attempt_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON activity_attempts FOR EACH STATEMENT EXECUTE FUNCTION p2_append_only();
CREATE TRIGGER attempt_receipt_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON attempt_receipts FOR EACH STATEMENT EXECUTE FUNCTION p2_append_only();

CREATE FUNCTION p3_evidence_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE outcome text;
BEGIN
  SELECT a.outcome INTO outcome FROM activity_attempts a WHERE a.user_id=NEW.user_id AND a.attempt_id=NEW.attempt_id;
  IF (outcome='correct' AND NEW.result_class<>'positive') OR
     (outcome='incorrect' AND NEW.result_class<>'negative') OR
     (outcome='assisted' AND NEW.result_class<>'assisted') OR outcome='unscored' THEN
    RAISE EXCEPTION 'evidence result differs from authoritative attempt' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER evidence_lineage BEFORE INSERT ON evidence_events FOR EACH ROW EXECUTE FUNCTION p3_evidence_guard();
CREATE TRIGGER evidence_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON evidence_events FOR EACH STATEMENT EXECUTE FUNCTION p2_append_only();
CREATE TRIGGER outbox_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON outbox_events FOR EACH STATEMENT EXECUTE FUNCTION p2_append_only();

COMMIT;
