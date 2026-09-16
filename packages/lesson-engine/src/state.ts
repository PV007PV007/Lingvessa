export type AuthoritativeOutcome = 'correct' | 'incorrect' | 'assisted' | 'accepted';

export type LessonPlayerState =
  | { kind: 'loading' }
  | { kind: 'active'; activity_id: string; position: number; revision: number; ai_notice?: string }
  | { kind: 'submitting'; activity_id: string; position: number; revision: number; attempt_id: string }
  | { kind: 'correct' | 'incorrect' | 'assisted' | 'accepted'; activity_id: string; position: number; revision: number; attempt_id: string; feedback: string }
  | { kind: 'speech_unavailable' | 'ai_unavailable'; activity_id: string; position: number; revision: number; reason: string }
  | { kind: 'remediation'; activity_id: string; position: number; revision: number; unresolved_count: number }
  | { kind: 'completed'; revision: number; unresolved_count: number }
  | { kind: 'recoverable_error'; code: string; correlation_id?: string; resumable: true };

export type LessonPlayerEvent =
  | { type: 'LOADED'; activity_id: string; position: number; revision: number }
  | { type: 'SUBMIT'; attempt_id: string }
  | { type: 'AUTHORITATIVE_RESULT'; outcome: AuthoritativeOutcome; attempt_id: string; feedback: string; revision: number }
  | { type: 'RETRY' }
  | { type: 'NEXT'; activity_id?: string; position?: number; revision: number; remediation_count?: number }
  | { type: 'SPEECH_UNAVAILABLE' | 'AI_UNAVAILABLE'; reason: string }
  | { type: 'FAIL'; code: string; correlation_id?: string }
  | { type: 'RESUME'; state: LessonPlayerState };

export function lessonPlayerReducer(state: LessonPlayerState, event: LessonPlayerEvent): LessonPlayerState {
  if (event.type === 'RESUME') return event.state;
  if (event.type === 'FAIL') return { kind: 'recoverable_error', code: event.code, resumable: true, ...(event.correlation_id ? { correlation_id: event.correlation_id } : {}) };
  switch (state.kind) {
    case 'loading':
      if (event.type === 'LOADED') return { kind: 'active', activity_id: event.activity_id, position: event.position, revision: event.revision };
      break;
    case 'active':
    case 'remediation':
      if (event.type === 'SUBMIT') return { kind: 'submitting', activity_id: state.activity_id, position: state.position, revision: state.revision, attempt_id: event.attempt_id };
      if (event.type === 'SPEECH_UNAVAILABLE') return { kind: 'speech_unavailable', activity_id: state.activity_id, position: state.position, revision: state.revision, reason: event.reason };
      if (event.type === 'AI_UNAVAILABLE') return { kind: 'active', activity_id: state.activity_id, position: state.position, revision: state.revision, ai_notice: event.reason };
      break;
    case 'submitting':
      if (event.type === 'AUTHORITATIVE_RESULT' && event.attempt_id === state.attempt_id) {
        return { kind: event.outcome, activity_id: state.activity_id, position: state.position, revision: event.revision, attempt_id: state.attempt_id, feedback: event.feedback };
      }
      break;
    case 'incorrect':
      if (event.type === 'RETRY') return { kind: 'active', activity_id: state.activity_id, position: state.position, revision: state.revision };
      break;
    case 'correct':
    case 'assisted':
    case 'accepted':
      if (event.type === 'NEXT') {
        if (event.activity_id !== undefined && event.position !== undefined) {
          if ((event.remediation_count ?? 0) > 0)
            return { kind: 'remediation', activity_id: event.activity_id, position: event.position, revision: event.revision, unresolved_count: event.remediation_count! };
          return { kind: 'active', activity_id: event.activity_id, position: event.position, revision: event.revision };
        }
        return { kind: 'completed', revision: event.revision, unresolved_count: event.remediation_count ?? 0 };
      }
      break;
    case 'speech_unavailable':
    case 'ai_unavailable':
    case 'completed':
    case 'recoverable_error':
      break;
  }
  throw new TypeError(`Invalid LessonPlayer transition ${state.kind} -> ${event.type}`);
}

export function mayAutoAdvance(state: LessonPlayerState, activityAllows: boolean): boolean {
  return activityAllows && (state.kind === 'correct' || state.kind === 'assisted');
}
