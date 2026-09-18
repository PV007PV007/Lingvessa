-- IMP-P4-001..003. Additive mastery/Review/collection/reset foundation.
-- Previous migrations and immutable attempts/evidence/publications are preserved.
BEGIN;
ALTER TABLE activity_attempts ALTER COLUMN accepted_at SET DEFAULT clock_timestamp();
ALTER TABLE evidence_events ALTER COLUMN occurred_at SET DEFAULT clock_timestamp();
CREATE TABLE learning_policies (
  model_version text PRIMARY KEY, scheduler_version text NOT NULL UNIQUE,
  parameters jsonb NOT NULL CHECK(jsonb_typeof(parameters)='object'),
  checksum text GENERATED ALWAYS AS (p2_json_checksum(parameters)) STORED,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER learning_policy_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON learning_policies FOR EACH STATEMENT EXECUTE FUNCTION p2_append_only();
CREATE TABLE mastery_facets (facet text PRIMARY KEY);
INSERT INTO mastery_facets VALUES ('collocation'),('context_use'),('grammar_form'),('intelligibility'),('interaction_goal'),('interaction_repair'),('listening_detail'),('listening_gist'),('listening_recognition'),('meaning'),('morphology'),('orthography'),('production'),('pronunciation_target'),('recall_l1_to_l2'),('recall_l2_to_l1'),('recognition'),('register'),('spelling'),('variant_awareness'),('word_order');
INSERT INTO learning_policies(model_version,scheduler_version,parameters) VALUES ('weighted-evidence-1.0.0','facet-srs-1.0.0','{"model_version": "weighted-evidence-1.0.0", "scheduler_version": "facet-srs-1.0.0", "prior": 1, "retry_weight": 0.35, "hint_weight": 0.2, "transcript_weight": 0.3, "min_freshness": 0.1, "fresh_after_ms": 86400000, "rapid_response_ms": 300, "recognition_weight": 0.6, "productive_weight": 1, "initial_days": 1, "growth": 2, "max_days": 180, "retry_days": 0.25, "hint_days": 0.125, "incorrect_days": 0.02, "reveal_days": 0.01, "weak_estimate": 0.65, "high_uncertainty": 0.6, "session_cap": 20, "session_minutes": 30, "seconds_per_item": 45, "recycle_cap": 2}');
CREATE TABLE knowledge_mastery_states (
 user_id uuid NOT NULL, language_profile_id uuid NOT NULL, language_id uuid NOT NULL, knowledge_item_id uuid NOT NULL, facet text NOT NULL REFERENCES mastery_facets(facet),
 model_version text NOT NULL REFERENCES learning_policies(model_version), estimate numeric(6,5) NOT NULL CHECK(estimate BETWEEN 0 AND 1), uncertainty numeric(6,5) NOT NULL CHECK(uncertainty BETWEEN 0 AND 1),
 evidence_count integer NOT NULL CHECK(evidence_count>=0), lapse_count integer NOT NULL CHECK(lapse_count>=0),
 last_evidence_at timestamptz, updated_at timestamptz NOT NULL,
 PRIMARY KEY(language_profile_id,knowledge_item_id,facet,model_version), FOREIGN KEY(language_profile_id,user_id,language_id) REFERENCES language_profiles(id,user_id,language_id) ON DELETE RESTRICT, FOREIGN KEY(knowledge_item_id,language_id) REFERENCES knowledge_items(id,language_id) ON DELETE RESTRICT
);
CREATE TABLE skill_mastery_states (
 user_id uuid NOT NULL, language_profile_id uuid NOT NULL, language_id uuid NOT NULL, skill text NOT NULL CHECK(skill IN ('vocabulary','grammar','listening','speaking','writing','pronunciation')),
 model_version text NOT NULL REFERENCES learning_policies(model_version), estimate numeric(6,5) NOT NULL CHECK(estimate BETWEEN 0 AND 1), uncertainty numeric(6,5) NOT NULL CHECK(uncertainty BETWEEN 0 AND 1),
 evidence_count integer NOT NULL CHECK(evidence_count>=0), lapse_count integer NOT NULL CHECK(lapse_count>=0),
 last_evidence_at timestamptz, updated_at timestamptz NOT NULL,
 PRIMARY KEY(language_profile_id,skill,model_version), FOREIGN KEY(language_profile_id,user_id,language_id) REFERENCES language_profiles(id,user_id,language_id) ON DELETE RESTRICT
);
CREATE TABLE review_schedules (
 user_id uuid NOT NULL, language_profile_id uuid NOT NULL, language_id uuid NOT NULL, knowledge_item_id uuid NOT NULL, facet text NOT NULL, skill text NOT NULL,
 scheduler_version text NOT NULL REFERENCES learning_policies(scheduler_version), state text NOT NULL CHECK(state='scheduled'),
 difficulty numeric(10,5) NOT NULL CHECK(difficulty BETWEEN 0 AND 1), stability_days numeric(12,5) NOT NULL CHECK(stability_days>0),
 due_at timestamptz NOT NULL, lapses integer NOT NULL CHECK(lapses>=0), reps integer NOT NULL CHECK(reps>=0), updated_at timestamptz NOT NULL,
 PRIMARY KEY(language_profile_id,knowledge_item_id,facet,scheduler_version), FOREIGN KEY(language_profile_id,user_id,language_id) REFERENCES language_profiles(id,user_id,language_id) ON DELETE RESTRICT, FOREIGN KEY(knowledge_item_id,language_id) REFERENCES knowledge_items(id,language_id) ON DELETE RESTRICT,
 FOREIGN KEY(skill,facet) REFERENCES skill_facet_pairs(skill,facet)
);
CREATE INDEX p4_due ON review_schedules(language_profile_id,due_at) WHERE state='scheduled';
ALTER TABLE evidence_events ADD CONSTRAINT p4_evidence_owner_key UNIQUE(id,user_id,language_profile_id,language_id);
CREATE TABLE mistake_instances (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, language_profile_id uuid NOT NULL, language_id uuid NOT NULL, knowledge_item_id uuid NOT NULL, facet text NOT NULL REFERENCES mastery_facets(facet),
 source_evidence_id uuid NOT NULL UNIQUE, item_id uuid NOT NULL, error_type text NOT NULL,
 first_seen timestamptz NOT NULL, last_seen timestamptz NOT NULL, status text NOT NULL CHECK(status IN ('unresolved','remediated','scheduled')),
 remediated_attempt_id uuid, FOREIGN KEY(language_profile_id,user_id,language_id) REFERENCES language_profiles(id,user_id,language_id) ON DELETE RESTRICT, FOREIGN KEY(knowledge_item_id,language_id) REFERENCES knowledge_items(id,language_id) ON DELETE RESTRICT,
 FOREIGN KEY(source_evidence_id,user_id,language_profile_id,language_id) REFERENCES evidence_events(id,user_id,language_profile_id,language_id),
 FOREIGN KEY(item_id,language_id) REFERENCES activity_items(id,language_id),
 FOREIGN KEY(remediated_attempt_id,user_id,language_profile_id,language_id) REFERENCES activity_attempts(id,user_id,language_profile_id,language_id)
);
CREATE TABLE learning_reset_jobs (
 id uuid PRIMARY KEY, user_id uuid NOT NULL, language_profile_id uuid NOT NULL, language_id uuid NOT NULL, request_id uuid NOT NULL, request_hash text NOT NULL,
 scope text NOT NULL CHECK(scope IN ('lesson','module','language')), target_id uuid,
 reset_mastery boolean NOT NULL, confirmed boolean NOT NULL CHECK(confirmed),
 status text NOT NULL CHECK(status='completed'), created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(user_id,request_id), UNIQUE(id,user_id,language_profile_id,language_id), FOREIGN KEY(language_profile_id,user_id,language_id) REFERENCES language_profiles(id,user_id,language_id) ON DELETE RESTRICT,
 FOREIGN KEY(target_id,language_id) REFERENCES content_entities(id,language_id),
 CHECK((scope='language')=(target_id IS NULL))
);
CREATE TABLE mastery_reset_targets (
 reset_job_id uuid NOT NULL, user_id uuid NOT NULL, language_profile_id uuid NOT NULL, language_id uuid NOT NULL, knowledge_item_id uuid NOT NULL, facet text NOT NULL REFERENCES mastery_facets(facet),
 PRIMARY KEY(reset_job_id,knowledge_item_id,facet),
 FOREIGN KEY(reset_job_id,user_id,language_profile_id,language_id) REFERENCES learning_reset_jobs(id,user_id,language_profile_id,language_id),
 FOREIGN KEY(language_profile_id,user_id,language_id) REFERENCES language_profiles(id,user_id,language_id) ON DELETE RESTRICT, FOREIGN KEY(knowledge_item_id,language_id) REFERENCES knowledge_items(id,language_id) ON DELETE RESTRICT
);
CREATE TRIGGER reset_job_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON learning_reset_jobs FOR EACH STATEMENT EXECUTE FUNCTION p2_append_only();
CREATE TRIGGER reset_targets_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON mastery_reset_targets FOR EACH STATEMENT EXECUTE FUNCTION p2_append_only();
CREATE TABLE collections (
 id uuid PRIMARY KEY, user_id uuid NOT NULL, language_profile_id uuid NOT NULL, language_id uuid NOT NULL, name text NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 160),
 status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived')), revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,user_id,language_profile_id,language_id), FOREIGN KEY(language_profile_id,user_id,language_id) REFERENCES language_profiles(id,user_id,language_id) ON DELETE RESTRICT
);
CREATE TABLE collection_entries (
 id uuid PRIMARY KEY, collection_id uuid NOT NULL, user_id uuid NOT NULL, language_profile_id uuid NOT NULL, language_id uuid NOT NULL, knowledge_item_id uuid, content_entity_id uuid,
 custom_text text, normalized_text text NOT NULL CHECK(length(normalized_text) BETWEEN 1 AND 2000),
 translation text CHECK(length(translation)<=2000), note text CHECK(length(note)<=4000), audio_status text NOT NULL DEFAULT 'unavailable' CHECK(audio_status IN ('unavailable','pending','available')),
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(collection_id,user_id,language_profile_id,language_id) REFERENCES collections(id,user_id,language_profile_id,language_id) ON DELETE CASCADE,
 FOREIGN KEY(language_profile_id,user_id,language_id) REFERENCES language_profiles(id,user_id,language_id) ON DELETE RESTRICT, FOREIGN KEY(knowledge_item_id,language_id) REFERENCES knowledge_items(id,language_id) ON DELETE RESTRICT, FOREIGN KEY(content_entity_id,language_id) REFERENCES content_entities(id,language_id),
 CHECK((custom_text IS NOT NULL AND knowledge_item_id IS NULL AND content_entity_id IS NULL) OR (custom_text IS NULL AND (knowledge_item_id IS NOT NULL OR content_entity_id IS NOT NULL)))
);
CREATE TABLE review_sessions (
 id uuid PRIMARY KEY, user_id uuid NOT NULL, language_profile_id uuid NOT NULL, language_id uuid NOT NULL, scheduler_version text NOT NULL REFERENCES learning_policies(scheduler_version),
 model_version text NOT NULL REFERENCES learning_policies(model_version), filters jsonb NOT NULL, request_hash text NOT NULL,
 state text NOT NULL CHECK(state IN ('active','completed','expired','cancelled')), position integer NOT NULL DEFAULT 0 CHECK(position>=0),
 item_count integer NOT NULL CHECK(item_count BETWEEN 0 AND 20), eta_seconds integer NOT NULL CHECK(eta_seconds>=0),
 created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL, completed_at timestamptz,
 UNIQUE(id,user_id,language_profile_id,language_id), FOREIGN KEY(language_profile_id,user_id,language_id) REFERENCES language_profiles(id,user_id,language_id) ON DELETE RESTRICT, CHECK(expires_at>created_at),
 CHECK((state='active')=(completed_at IS NULL))
);
CREATE UNIQUE INDEX p4_one_active_review ON review_sessions(language_profile_id) WHERE state='active';
ALTER TABLE lesson_runs ADD COLUMN run_kind text NOT NULL DEFAULT 'lesson' CHECK(run_kind IN ('lesson','review')),
 ADD COLUMN review_session_id uuid, ADD COLUMN selected_item_id uuid, ADD COLUMN superseded_at timestamptz,
 ADD CONSTRAINT p4_review_scope CHECK((run_kind='lesson' AND review_session_id IS NULL AND selected_item_id IS NULL) OR (run_kind='review' AND review_session_id IS NOT NULL AND selected_item_id IS NOT NULL)),
 ADD CONSTRAINT p4_review_session_owner FOREIGN KEY(review_session_id,user_id,language_profile_id,language_id) REFERENCES review_sessions(id,user_id,language_profile_id,language_id),
 ADD CONSTRAINT p4_review_selected_item FOREIGN KEY(selected_item_id,lesson_id,language_id) REFERENCES activity_items(id,lesson_id,language_id);
DROP INDEX lesson_runs_one_open_pin;
CREATE UNIQUE INDEX lesson_runs_one_open_pin ON lesson_runs(user_id,language_profile_id,publication_id,lesson_id)
 WHERE state<>'completed' AND run_kind='lesson' AND superseded_at IS NULL;
ALTER TABLE lesson_run_items ADD COLUMN hint_count integer NOT NULL DEFAULT 0 CHECK(hint_count BETWEEN 0 AND 1);
CREATE TABLE review_session_items (
 session_id uuid NOT NULL, ordinal integer NOT NULL CHECK(ordinal>=0), user_id uuid NOT NULL, language_profile_id uuid NOT NULL, language_id uuid NOT NULL,
 lesson_run_id uuid NOT NULL UNIQUE, item_id uuid NOT NULL, knowledge_item_id uuid NOT NULL, facet text NOT NULL, skill text NOT NULL,
 reason text NOT NULL CHECK(reason IN ('due','unresolved_mistake','weak_or_uncertain','selected','limited_recycle')),
 source_evidence_id uuid, state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','completed','skipped')),
 completed_at timestamptz, PRIMARY KEY(session_id,ordinal),
 FOREIGN KEY(session_id,user_id,language_profile_id,language_id) REFERENCES review_sessions(id,user_id,language_profile_id,language_id),
 FOREIGN KEY(lesson_run_id,user_id,language_profile_id,language_id,item_id) REFERENCES lesson_run_items(lesson_run_id,user_id,language_profile_id,language_id,item_id),
 FOREIGN KEY(item_id,knowledge_item_id,skill,facet,language_id) REFERENCES item_knowledge_map(item_id,knowledge_item_id,skill,facet,language_id),
 FOREIGN KEY(source_evidence_id,user_id,language_profile_id,language_id) REFERENCES evidence_events(id,user_id,language_profile_id,language_id),
 FOREIGN KEY(language_profile_id,user_id,language_id) REFERENCES language_profiles(id,user_id,language_id) ON DELETE RESTRICT, FOREIGN KEY(knowledge_item_id,language_id) REFERENCES knowledge_items(id,language_id) ON DELETE RESTRICT, CHECK((state='pending')=(completed_at IS NULL))
);
CREATE OR REPLACE FUNCTION p3_run_insert_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE content content_versions%ROWTYPE; publication publications%ROWTYPE; expected_activities jsonb; variant uuid;
BEGIN
  SELECT * INTO content FROM content_versions WHERE id=NEW.content_version_id;
  SELECT * INTO publication FROM publications WHERE id=NEW.publication_id;
  SELECT variant_id INTO variant FROM language_profiles WHERE id=NEW.language_profile_id;
  SELECT jsonb_agg(activity->'contract' ORDER BY ordinal) INTO expected_activities
    FROM jsonb_array_elements(content.payload->'activities') WITH ORDINALITY a(activity,ordinal);
  IF publication.status IS DISTINCT FROM 'published' OR publication.checksum IS DISTINCT FROM NEW.publication_checksum OR
     content.checksum IS DISTINCT FROM NEW.content_checksum OR expected_activities IS DISTINCT FROM NEW.manifest->'activities' OR
     expected_activities IS NULL OR variant IS DISTINCT FROM NEW.variant_id OR
     NEW.state<>'active' OR (NEW.run_kind='lesson' AND NEW.position<>0) OR (NEW.run_kind='review' AND NEW.manifest->'activities'->NEW.position->>'id' IS DISTINCT FROM NEW.selected_item_id::text) OR NEW.client_sequence<>0 OR NEW.revision<>1 THEN
    RAISE EXCEPTION 'run does not pin an executable published lesson' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION p4_lineage_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND (NEW.user_id,NEW.language_profile_id,NEW.language_id) IS DISTINCT FROM (OLD.user_id,OLD.language_profile_id,OLD.language_id) THEN
  RAISE EXCEPTION 'P4 owner lineage is immutable' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER knowledge_mastery_states_lineage BEFORE UPDATE ON knowledge_mastery_states FOR EACH ROW EXECUTE FUNCTION p4_lineage_guard();
CREATE TRIGGER skill_mastery_states_lineage BEFORE UPDATE ON skill_mastery_states FOR EACH ROW EXECUTE FUNCTION p4_lineage_guard();
CREATE TRIGGER review_schedules_lineage BEFORE UPDATE ON review_schedules FOR EACH ROW EXECUTE FUNCTION p4_lineage_guard();
CREATE TRIGGER mistake_instances_lineage BEFORE UPDATE ON mistake_instances FOR EACH ROW EXECUTE FUNCTION p4_lineage_guard();
CREATE TRIGGER collections_lineage BEFORE UPDATE ON collections FOR EACH ROW EXECUTE FUNCTION p4_lineage_guard();
CREATE TRIGGER collection_entries_lineage BEFORE UPDATE ON collection_entries FOR EACH ROW EXECUTE FUNCTION p4_lineage_guard();
CREATE TRIGGER review_sessions_lineage BEFORE UPDATE ON review_sessions FOR EACH ROW EXECUTE FUNCTION p4_lineage_guard();
CREATE TRIGGER review_session_items_lineage BEFORE UPDATE ON review_session_items FOR EACH ROW EXECUTE FUNCTION p4_lineage_guard();
CREATE FUNCTION p4_run_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (NEW.run_kind,NEW.review_session_id,NEW.selected_item_id) IS DISTINCT FROM (OLD.run_kind,OLD.review_session_id,OLD.selected_item_id) OR
    (OLD.superseded_at IS NOT NULL AND NEW.superseded_at IS DISTINCT FROM OLD.superseded_at) THEN
   RAISE EXCEPTION 'P4 run context is immutable' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER p4_run_context BEFORE UPDATE ON lesson_runs FOR EACH ROW EXECUTE FUNCTION p4_run_guard();
CREATE FUNCTION p4_attempt_scope_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r lesson_runs; s review_sessions; i review_session_items;
BEGIN
 SELECT * INTO r FROM lesson_runs WHERE id=NEW.lesson_run_id;
 IF r.superseded_at IS NOT NULL THEN RAISE EXCEPTION 'run superseded by explicit reset' USING ERRCODE='23514'; END IF;
 IF r.run_kind='review' THEN
  SELECT * INTO s FROM review_sessions WHERE id=r.review_session_id FOR UPDATE;
  SELECT * INTO i FROM review_session_items WHERE session_id=s.id AND lesson_run_id=r.id;
  IF s.state<>'active' OR s.expires_at<=clock_timestamp() OR i.state IS DISTINCT FROM 'pending' OR i.ordinal IS DISTINCT FROM s.position THEN
   RAISE EXCEPTION 'inactive or out-of-order review attempt' USING ERRCODE='23514';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER p4_attempt_scope BEFORE INSERT ON activity_attempts FOR EACH ROW EXECUTE FUNCTION p4_attempt_scope_guard();
CREATE FUNCTION p4_review_item_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r lesson_runs;
BEGIN
 SELECT * INTO r FROM lesson_runs WHERE id=NEW.lesson_run_id;
 IF r.run_kind<>'review' OR r.review_session_id IS DISTINCT FROM NEW.session_id OR r.selected_item_id IS DISTINCT FROM NEW.item_id THEN
   RAISE EXCEPTION 'review item differs from pinned run' USING ERRCODE='23514';
 END IF;
 IF TG_OP='UPDATE' AND (NEW.session_id,NEW.ordinal,NEW.lesson_run_id,NEW.item_id,NEW.knowledge_item_id,NEW.skill,NEW.facet,NEW.reason,NEW.source_evidence_id)
 IS DISTINCT FROM (OLD.session_id,OLD.ordinal,OLD.lesson_run_id,OLD.item_id,OLD.knowledge_item_id,OLD.skill,OLD.facet,OLD.reason,OLD.source_evidence_id) THEN
   RAISE EXCEPTION 'review selection is immutable' USING ERRCODE='23514';
 END IF;
 IF TG_OP='UPDATE' AND OLD.state<>'pending' THEN RAISE EXCEPTION 'review item is settled' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER p4_review_item BEFORE INSERT OR UPDATE ON review_session_items FOR EACH ROW EXECUTE FUNCTION p4_review_item_guard();
CREATE FUNCTION p4_mistake_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE e evidence_events;
BEGIN
 SELECT * INTO e FROM evidence_events WHERE id=NEW.source_evidence_id;
 IF e.result_class IS DISTINCT FROM 'negative' OR (NEW.knowledge_item_id,NEW.facet,NEW.item_id) IS DISTINCT FROM (e.knowledge_item_id,e.facet,e.item_id) THEN
  RAISE EXCEPTION 'mistake requires matching immutable negative evidence' USING ERRCODE='23514';
 END IF;
 IF TG_OP='UPDATE' AND (NEW.source_evidence_id,NEW.knowledge_item_id,NEW.facet,NEW.item_id,NEW.first_seen,NEW.error_type)
 IS DISTINCT FROM (OLD.source_evidence_id,OLD.knowledge_item_id,OLD.facet,OLD.item_id,OLD.first_seen,OLD.error_type) THEN
  RAISE EXCEPTION 'mistake origin is immutable' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER p4_mistake_origin BEFORE INSERT OR UPDATE ON mistake_instances FOR EACH ROW EXECUTE FUNCTION p4_mistake_guard();
CREATE TRIGGER p4_no_delete_mistakes BEFORE DELETE OR TRUNCATE ON mistake_instances FOR EACH STATEMENT EXECUTE FUNCTION p2_append_only();
ALTER TABLE evidence_events DROP CONSTRAINT evidence_events_independence_check;
ALTER TABLE evidence_events ADD CONSTRAINT evidence_events_independence_check CHECK(independence IN ('independent','retry','assisted','hinted'));
CREATE OR REPLACE FUNCTION p3_evidence_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE outcome text; pinned jsonb; attempt activity_attempts%ROWTYPE;
BEGIN
  SELECT * INTO attempt FROM activity_attempts a WHERE a.id=NEW.attempt_db_id;
  outcome=attempt.outcome;
  SELECT activity INTO pinned FROM lesson_runs r, jsonb_array_elements(r.manifest->'activities') activity
    WHERE r.id=attempt.lesson_run_id AND activity->>'id'=NEW.item_id::text;
  IF attempt.attempt_id IS DISTINCT FROM NEW.attempt_id OR
     NEW.content_version_id IS DISTINCT FROM attempt.content_version_id OR
     NEW.content_schema_version IS DISTINCT FROM attempt.content_schema_version OR
     NEW.evaluator_version IS DISTINCT FROM attempt.evaluator_version OR
     NEW.mastery_model_version IS DISTINCT FROM attempt.mastery_model_version OR
     NEW.scheduler_version IS DISTINCT FROM attempt.scheduler_version OR
     NEW.model_version IS DISTINCT FROM attempt.mastery_model_version OR
     NEW.independence IS DISTINCT FROM (CASE WHEN outcome='assisted' THEN 'assisted' WHEN (attempt.assistance->>'hint_count')::int>0 THEN 'hinted' WHEN (attempt.assistance->>'prior_attempts')::int>0 THEN 'retry' ELSE 'independent' END) OR
     NEW.difficulty IS DISTINCT FROM (pinned->'learning'->>'difficulty')::numeric OR
     NOT EXISTS (SELECT 1 FROM jsonb_array_elements(pinned->'learning'->'knowledge_refs') k WHERE k->>'knowledge_item_id'=NEW.knowledge_item_id::text) OR
     NOT EXISTS (SELECT 1 FROM jsonb_array_elements(pinned->'learning'->'evidence_map') m
       WHERE m->>'skill'=NEW.skill AND m->>'facet'=NEW.facet AND (m->>'weight')::numeric=NEW.base_weight) THEN
    RAISE EXCEPTION 'evidence differs from pinned attempt/mapping' USING ERRCODE='23514';
  END IF;
  IF (outcome='correct' AND NEW.result_class<>'positive') OR
     (outcome='incorrect' AND NEW.result_class<>'negative') OR
     (outcome='assisted' AND NEW.result_class<>'assisted') OR outcome='accepted' THEN
    RAISE EXCEPTION 'evidence result differs from authoritative attempt' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;

COMMIT;
