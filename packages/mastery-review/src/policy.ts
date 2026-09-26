/** Versioned implementation policy, not a CEFR calibration or a product pass threshold. */
export const policy = Object.freeze({
  model_version: 'weighted-evidence-1.0.0', scheduler_version: 'facet-srs-1.0.0',
  prior: 1, retry_weight: 0.35, hint_weight: 0.2, transcript_weight: 0.3,
  min_freshness: 0.1, fresh_after_ms: 86400000, rapid_response_ms: 300,
  recognition_weight: 0.6, productive_weight: 1,
  initial_days: 1, growth: 2, max_days: 180, retry_days: 0.25, hint_days: 0.125,
  incorrect_days: 0.02, reveal_days: 0.01, weak_estimate: 0.65, high_uncertainty: 0.6,
  session_cap: 20, session_minutes: 30, seconds_per_item: 45, recycle_cap: 2,
});
export type Policy = { readonly [K in keyof typeof policy]: typeof policy[K] extends number ? number : string };
export const DAY = 86400000;
