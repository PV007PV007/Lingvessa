-- IMP-P5-003. Async job/result metadata only; no raw learner audio in PostgreSQL.
BEGIN;
CREATE TABLE speech_policies (
 id uuid PRIMARY KEY, stable_code text NOT NULL, version_code text NOT NULL, language_id uuid NOT NULL REFERENCES languages(id),
 variety text NOT NULL, target_feature text NOT NULL, provider_code text NOT NULL, model_version text NOT NULL,
 confidence_threshold numeric NOT NULL CHECK(confidence_threshold BETWEEN 0 AND 1), test_only boolean NOT NULL,
 calibration_reference text NOT NULL CHECK(length(btrim(calibration_reference))>0), approved_by uuid NOT NULL REFERENCES users(id), approved_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(id,language_id), UNIQUE(stable_code,version_code,language_id,variety,target_feature), CHECK(p5_media_scope(language_id,variety) AND variety<>'common')
);
CREATE FUNCTION p5_speech_policy_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NOT (p2_has_role(NEW.approved_by,'administrator') AND p2_has_role(NEW.approved_by,'linguistic_reviewer')) THEN RAISE EXCEPTION 'speech policy requires authorized human calibration review' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER speech_policy_authority BEFORE INSERT ON speech_policies FOR EACH ROW EXECUTE FUNCTION p5_speech_policy_guard();
CREATE TRIGGER speech_policy_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON speech_policies FOR EACH STATEMENT EXECUTE FUNCTION p2_append_only();

CREATE TABLE speech_jobs (
 id uuid PRIMARY KEY, attempt_id uuid NOT NULL, idempotency_key uuid NOT NULL, request_hash text NOT NULL CHECK(request_hash~'^[a-f0-9]{64}$'),
 user_id uuid NOT NULL, language_profile_id uuid NOT NULL, language_id uuid NOT NULL, lesson_run_id uuid NOT NULL,
 item_id uuid NOT NULL, content_version_id uuid NOT NULL, policy_id uuid, policy_code text NOT NULL, policy_version text NOT NULL,
 provider_code text NOT NULL, model_version text NOT NULL,
 state text NOT NULL DEFAULT 'created' CHECK(state IN ('created','uploaded','queued','processing','succeeded','unavailable','failed','cancelled','expired')),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 3), execution_id uuid, lease_until timestamptz, next_attempt_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), expires_at timestamptz NOT NULL,
 mime text, audio_checksum text CHECK(audio_checksum~'^[a-f0-9]{64}$'), audio_bytes integer CHECK(audio_bytes BETWEEN 1 AND 5242880),
 audio_deleted_at timestamptz, cleanup_pending boolean NOT NULL DEFAULT false,
 settled_at timestamptz, outcome text CHECK(outcome IN ('speech_correct','speech_incorrect','speech_unavailable')),
 reason text CHECK(reason IN ('matched','target_mismatch','mic_denied','mic_absent','unsupported_audio','low_confidence','provider_unavailable','provider_timeout','provider_failure','policy_unavailable','invalid_result','user_cancelled','expired','context_superseded')),
 result jsonb, feedback text NOT NULL DEFAULT '',
 UNIQUE(user_id,attempt_id), UNIQUE(user_id,idempotency_key), UNIQUE(id,user_id), UNIQUE(id,user_id,language_profile_id,language_id),
 FOREIGN KEY(lesson_run_id,user_id,language_profile_id,language_id,item_id) REFERENCES lesson_run_items(lesson_run_id,user_id,language_profile_id,language_id,item_id),
 FOREIGN KEY(content_version_id,language_id) REFERENCES content_versions(id,language_id), FOREIGN KEY(policy_id,language_id) REFERENCES speech_policies(id,language_id),
 CHECK(expires_at>created_at AND expires_at<=created_at+interval '14 minutes'),
 CHECK((settled_at IS NOT NULL)=(state IN ('succeeded','unavailable','failed','cancelled','expired'))),
 CHECK((outcome IS NOT NULL)=(settled_at IS NOT NULL)), CHECK((reason IS NOT NULL)=(settled_at IS NOT NULL)),
 CHECK(result IS NULL OR (jsonb_typeof(result)='object' AND result-ARRAY['usable','confidence','target_match','error_tags','processing_ms']='{}'::jsonb))
);
CREATE UNIQUE INDEX speech_one_pending_run ON speech_jobs(lesson_run_id) WHERE settled_at IS NULL;
CREATE INDEX speech_queue ON speech_jobs(next_attempt_at,created_at) WHERE state='queued';
CREATE INDEX speech_expiry ON speech_jobs(expires_at) WHERE settled_at IS NULL;

ALTER TABLE activity_attempts ADD COLUMN speech_job_id uuid UNIQUE;
ALTER TABLE activity_attempts ADD CONSTRAINT attempt_speech_job_owner_fk FOREIGN KEY(speech_job_id,user_id,language_profile_id,language_id) REFERENCES speech_jobs(id,user_id,language_profile_id,language_id);
ALTER TABLE activity_attempts DROP CONSTRAINT activity_attempts_outcome_check;
ALTER TABLE activity_attempts ADD CONSTRAINT activity_attempts_outcome_check CHECK(outcome IN ('correct','incorrect','assisted','accepted','speech_correct','speech_incorrect','speech_unavailable'));
ALTER TABLE activity_attempts ADD CONSTRAINT attempt_speech_kind_check CHECK((speech_job_id IS NOT NULL)=(outcome IN ('speech_correct','speech_incorrect','speech_unavailable')));
ALTER TABLE activity_attempts DROP CONSTRAINT activity_attempts_error_category_check;
ALTER TABLE activity_attempts ADD CONSTRAINT activity_attempts_error_category_check CHECK(error_category IN ('none','selection','mapping','form','order','pronunciation'));
ALTER TABLE lesson_run_items DROP CONSTRAINT lesson_run_items_state_check;
ALTER TABLE lesson_run_items ADD CONSTRAINT lesson_run_items_state_check CHECK(state IN ('pending','active','incorrect','correct','assisted','completed','speech_correct','speech_incorrect','speech_unavailable'));

CREATE FUNCTION p5_speech_job_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r lesson_runs; a jsonb; p speech_policies;
BEGIN
 SELECT * INTO r FROM lesson_runs WHERE id=NEW.lesson_run_id;
 a=r.manifest->'activities'->r.position;
 IF NEW.content_version_id IS DISTINCT FROM r.content_version_id THEN RAISE EXCEPTION 'speech content does not match pinned run' USING ERRCODE='23514'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.state<>'created' OR NEW.attempts<>0 OR NEW.settled_at IS NOT NULL OR r.superseded_at IS NOT NULL OR r.state='completed' OR
    a->>'id' IS DISTINCT FROM NEW.item_id::text OR a->'runtime'->>'completion_policy' IS DISTINCT FROM 'speech_binary_nonblocking_v1' OR
    a->'response'->'answer_policy'->>'id' IS DISTINCT FROM NEW.policy_code OR a->'response'->'answer_policy'->>'version' IS DISTINCT FROM NEW.policy_version OR
    EXISTS(SELECT 1 FROM activity_attempts WHERE user_id=NEW.user_id AND attempt_id=NEW.attempt_id) THEN RAISE EXCEPTION 'speech creation context invalid' USING ERRCODE='23514'; END IF;
  IF NEW.policy_id IS NOT NULL THEN
   SELECT * INTO p FROM speech_policies WHERE id=NEW.policy_id;
   IF (p.stable_code,p.version_code,p.language_id,p.variety,p.target_feature,p.provider_code,p.model_version) IS DISTINCT FROM
    (NEW.policy_code,NEW.policy_version,NEW.language_id,a->>'variety',a->'speech'->>'target_feature',NEW.provider_code,NEW.model_version) OR
    (p.test_only AND (SELECT channel FROM publications WHERE id=r.publication_id)<>'test') THEN RAISE EXCEPTION 'speech policy/context mismatch' USING ERRCODE='23514'; END IF;
  END IF;
 ELSE
  IF (to_jsonb(NEW)-ARRAY['state','attempts','execution_id','lease_until','next_attempt_at','mime','audio_checksum','audio_bytes','audio_deleted_at','cleanup_pending','settled_at','outcome','reason','result','feedback']) IS DISTINCT FROM
     (to_jsonb(OLD)-ARRAY['state','attempts','execution_id','lease_until','next_attempt_at','mime','audio_checksum','audio_bytes','audio_deleted_at','cleanup_pending','settled_at','outcome','reason','result','feedback']) THEN RAISE EXCEPTION 'speech job identity immutable' USING ERRCODE='23514'; END IF;
  IF OLD.settled_at IS NOT NULL THEN
   IF (to_jsonb(NEW)-ARRAY['audio_deleted_at','cleanup_pending']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['audio_deleted_at','cleanup_pending']) OR NEW.cleanup_pending OR (OLD.audio_deleted_at IS NOT NULL AND NEW.audio_deleted_at IS DISTINCT FROM OLD.audio_deleted_at) THEN RAISE EXCEPTION 'speech settlement immutable' USING ERRCODE='23514'; END IF;
   RETURN NEW;
  END IF;
  IF OLD.audio_checksum IS NOT NULL AND (NEW.mime,NEW.audio_checksum,NEW.audio_bytes) IS DISTINCT FROM (OLD.mime,OLD.audio_checksum,OLD.audio_bytes) THEN RAISE EXCEPTION 'uploaded speech identity immutable' USING ERRCODE='23514'; END IF;
  IF NOT ((OLD.state='created' AND NEW.state='uploaded') OR (OLD.state='uploaded' AND NEW.state='queued') OR
    (OLD.state='queued' AND NEW.state='processing') OR (OLD.state='processing' AND NEW.state IN ('queued','succeeded','failed')) OR
    NEW.state IN ('unavailable','cancelled','expired')) THEN RAISE EXCEPTION 'invalid speech job transition' USING ERRCODE='23514'; END IF;
  IF NEW.attempts IS DISTINCT FROM OLD.attempts+CASE WHEN OLD.state='queued' AND NEW.state='processing' THEN 1 ELSE 0 END THEN RAISE EXCEPTION 'speech retry counter invalid' USING ERRCODE='23514'; END IF;
 END IF;
 IF NEW.state='uploaded' AND (NEW.audio_checksum IS NULL OR NEW.audio_bytes IS NULL OR NEW.mime IS NULL OR NOT NEW.cleanup_pending) THEN RAISE EXCEPTION 'uploaded audio receipt required' USING ERRCODE='23514'; END IF;
 IF NEW.state='processing' AND (NEW.execution_id IS NULL OR NEW.lease_until IS NULL) THEN RAISE EXCEPTION 'processing lease required' USING ERRCODE='23514'; END IF;
 IF NEW.state='succeeded' THEN
  SELECT * INTO p FROM speech_policies WHERE id=NEW.policy_id;
  IF NEW.policy_id IS NULL OR NEW.result IS NULL OR jsonb_typeof(NEW.result->'usable') IS DISTINCT FROM 'boolean' OR jsonb_typeof(NEW.result->'confidence') IS DISTINCT FROM 'number' OR jsonb_typeof(NEW.result->'target_match') IS DISTINCT FROM 'boolean' OR (NEW.result->>'usable')::boolean IS DISTINCT FROM true OR
    (NEW.result->>'confidence')::numeric NOT BETWEEN p.confidence_threshold AND 1 OR (NEW.result->>'target_match') NOT IN ('true','false') OR
    NEW.outcome IS DISTINCT FROM (CASE WHEN (NEW.result->>'target_match')::boolean THEN 'speech_correct' ELSE 'speech_incorrect' END) OR
    NEW.reason IS DISTINCT FROM (CASE WHEN (NEW.result->>'target_match')::boolean THEN 'matched' ELSE 'target_mismatch' END) THEN RAISE EXCEPTION 'speech success requires evaluable calibrated result' USING ERRCODE='23514'; END IF;
 ELSIF NEW.settled_at IS NOT NULL AND NEW.outcome IS DISTINCT FROM 'speech_unavailable' THEN RAISE EXCEPTION 'unavailable speech cannot produce a scored outcome' USING ERRCODE='23514'; END IF;
 IF NEW.state='cancelled' AND NEW.reason IS DISTINCT FROM 'user_cancelled' THEN RAISE EXCEPTION 'cancelled speech reason must be user_cancelled' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER speech_job_guard BEFORE INSERT OR UPDATE ON speech_jobs FOR EACH ROW EXECUTE FUNCTION p5_speech_job_guard();
CREATE TRIGGER speech_job_no_delete BEFORE DELETE OR TRUNCATE ON speech_jobs FOR EACH STATEMENT EXECUTE FUNCTION p2_append_only();

-- Superseded/expired contexts may append a neutral settlement for an already-created job,
-- never a new scored attempt or a mastery update.
CREATE OR REPLACE FUNCTION p3_attempt_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r lesson_runs; j speech_jobs;
BEGIN
 SELECT * INTO r FROM lesson_runs WHERE id=NEW.lesson_run_id FOR UPDATE;
 IF NOT FOUND OR (r.user_id,r.language_profile_id,r.language_id,r.publication_id,r.lesson_id,r.content_version_id)
  IS DISTINCT FROM (NEW.user_id,NEW.language_profile_id,NEW.language_id,NEW.publication_id,NEW.lesson_id,NEW.content_version_id) THEN RAISE EXCEPTION 'attempt lineage differs from pinned run' USING ERRCODE='23514'; END IF;
 IF NEW.speech_job_id IS NOT NULL THEN
  SELECT * INTO j FROM speech_jobs WHERE id=NEW.speech_job_id;
  IF j.settled_at IS NULL OR (j.user_id,j.attempt_id,j.lesson_run_id,j.item_id,j.content_version_id,j.outcome) IS DISTINCT FROM
    (NEW.user_id,NEW.attempt_id,NEW.lesson_run_id,NEW.item_id,NEW.content_version_id,NEW.outcome) OR NEW.response IS DISTINCT FROM jsonb_build_object('kind','speech','job_id',j.id) OR NEW.intent<>'submit' OR NEW.evaluator_version<>'speech-target-1.0.0' THEN RAISE EXCEPTION 'speech attempt differs from settlement' USING ERRCODE='23514'; END IF;
 END IF;
 IF r.state='completed' AND NEW.outcome<>'speech_unavailable' THEN RAISE EXCEPTION 'completed run rejects attempts' USING ERRCODE='23514'; END IF;
 IF NEW.client_sequence<>r.client_sequence+1 THEN RAISE EXCEPTION 'client sequence conflict' USING ERRCODE='40001'; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION p4_attempt_scope_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r lesson_runs; s review_sessions; i review_session_items;
BEGIN
 SELECT * INTO r FROM lesson_runs WHERE id=NEW.lesson_run_id;
 IF NEW.outcome='speech_unavailable' AND NEW.speech_job_id IS NOT NULL THEN RETURN NEW; END IF;
 IF r.superseded_at IS NOT NULL THEN RAISE EXCEPTION 'run superseded by explicit reset' USING ERRCODE='23514'; END IF;
 IF r.run_kind='review' THEN
  SELECT * INTO s FROM review_sessions WHERE id=r.review_session_id FOR UPDATE;
  SELECT * INTO i FROM review_session_items WHERE session_id=s.id AND lesson_run_id=r.id;
  IF s.state<>'active' OR s.expires_at<=clock_timestamp() OR i.state IS DISTINCT FROM 'pending' OR i.ordinal IS DISTINCT FROM s.position THEN RAISE EXCEPTION 'inactive or out-of-order review attempt' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION p5_speech_terminal_receipt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.settled_at IS NOT NULL AND NOT EXISTS(SELECT 1 FROM activity_attempts WHERE speech_job_id=NEW.id AND outcome=NEW.outcome) THEN RAISE EXCEPTION 'terminal speech job requires exactly one immutable attempt' USING ERRCODE='23514'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER speech_terminal_receipt AFTER INSERT OR UPDATE ON speech_jobs DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION p5_speech_terminal_receipt();

CREATE TABLE speech_callback_events (
 event_id uuid PRIMARY KEY, job_id uuid NOT NULL REFERENCES speech_jobs(id), payload_hash text NOT NULL,
 disposition text NOT NULL CHECK(disposition IN ('settled','duplicate','late','stale_execution')), received_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TRIGGER speech_callback_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON speech_callback_events FOR EACH STATEMENT EXECUTE FUNCTION p2_append_only();
CREATE TABLE speech_next_receipts (
 job_id uuid PRIMARY KEY REFERENCES speech_jobs(id), user_id uuid NOT NULL REFERENCES users(id), result jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(job_id,user_id) REFERENCES speech_jobs(id,user_id)
);
CREATE TRIGGER speech_next_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON speech_next_receipts FOR EACH STATEMENT EXECUTE FUNCTION p2_append_only();

CREATE OR REPLACE FUNCTION p3_evidence_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE outcome text; pinned jsonb; attempt activity_attempts;
BEGIN
 SELECT * INTO attempt FROM activity_attempts a WHERE a.id=NEW.attempt_db_id;outcome=attempt.outcome;
 SELECT activity INTO pinned FROM lesson_runs r,jsonb_array_elements(r.manifest->'activities') activity WHERE r.id=attempt.lesson_run_id AND activity->>'id'=NEW.item_id::text;
 IF attempt.attempt_id IS DISTINCT FROM NEW.attempt_id OR NEW.content_version_id IS DISTINCT FROM attempt.content_version_id OR
  NEW.content_schema_version IS DISTINCT FROM attempt.content_schema_version OR NEW.evaluator_version IS DISTINCT FROM attempt.evaluator_version OR
  NEW.mastery_model_version IS DISTINCT FROM attempt.mastery_model_version OR NEW.scheduler_version IS DISTINCT FROM attempt.scheduler_version OR NEW.model_version IS DISTINCT FROM attempt.mastery_model_version OR
  NEW.independence IS DISTINCT FROM (CASE WHEN outcome='assisted' THEN 'assisted' WHEN (attempt.assistance->>'hint_count')::int>0 THEN 'hinted' WHEN (attempt.assistance->>'prior_attempts')::int>0 THEN 'retry' ELSE 'independent' END) OR
  NEW.difficulty IS DISTINCT FROM (pinned->'learning'->>'difficulty')::numeric OR
  NOT EXISTS(SELECT 1 FROM jsonb_array_elements(pinned->'learning'->'knowledge_refs') k WHERE k->>'knowledge_item_id'=NEW.knowledge_item_id::text) OR
  NOT EXISTS(SELECT 1 FROM jsonb_array_elements(pinned->'learning'->'evidence_map') m WHERE m->>'skill'=NEW.skill AND m->>'facet'=NEW.facet AND (m->>'weight')::numeric=NEW.base_weight) THEN RAISE EXCEPTION 'evidence differs from pinned attempt/mapping' USING ERRCODE='23514'; END IF;
 IF (outcome IN ('correct','speech_correct') AND NEW.result_class<>'positive') OR (outcome IN ('incorrect','speech_incorrect') AND NEW.result_class<>'negative') OR (outcome='assisted' AND NEW.result_class<>'assisted') OR outcome IN ('accepted','speech_unavailable') THEN RAISE EXCEPTION 'evidence result differs from authoritative attempt' USING ERRCODE='23514'; END IF;
 IF outcome IN ('speech_correct','speech_incorrect') AND (NEW.skill<>'pronunciation' OR NEW.facet NOT IN ('pronunciation_target','intelligibility') OR attempt.speech_job_id IS NULL) THEN RAISE EXCEPTION 'target speech evidence cannot affect another skill/facet' USING ERRCODE='23514'; END IF;
 IF NEW.skill IN ('speaking','pronunciation') AND attempt.speech_job_id IS NULL THEN RAISE EXCEPTION 'oral evidence requires evaluable learner speech' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
COMMIT;
