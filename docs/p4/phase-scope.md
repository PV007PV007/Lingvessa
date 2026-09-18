# P4 scope and contract implementation

Implementation Plan v1.4 §11 p6 is the sole phase authority. IMP-P4-001 -> 002 -> 003. P3 was accepted by delegated owner review and merged at `07b6aae9b001dbb4d620df3d491473a95f674ad2`; the tested source is `9932a1bbf4b95353445422cb7bde7396d8f1fab5`.

P4 implements item/facet projections and six derived skills, deterministic versioned scheduling/recompute, language-scoped Review sessions, mistake remediation, explicit reset scopes and personal collections. No P5 speech/media or P8/P9 AI runtime. Full Progress/navigation surfaces belong to P10; full M01 authoring to P6/P7. AI-specific rubric/provider acceptance remains P9.

Review reuses the existing Lesson Engine and normal attempt transaction. A review run pins the complete immutable source lesson manifest and selects one existing activity by UUID; it never manufactures a content version. The session orders these single-activity runs. DB FKs retain profile/user/language/content lineage. Skip is session navigation, with no successful evidence and no changed due date. Session expiry/cancellation fences stale attempts; accepted retries return the immutable receipt.

The versioned numerical policy is a deterministic implementation parameter set, not CEFR calibration or a pass threshold. `weighted-evidence-1.0.0` and `facet-srs-1.0.0` are registered immutably in the migration and checked against the compiled policy. Both old P3 evidence and new P4 attempts remain immutable. Recompute writes disposable projections for an explicit model/scheduler version. Empty skill coverage has evidence_count=0 and uncertainty=1; an estimate is not represented as achieved mastery.

Recompute currently uses the full selected profile history under a profile transaction lock, giving an exact golden reference for the foundation. P11 load/scale gates must measure this path against production-sized histories before reference release; no production-load certification is claimed here.

Reset defaults to position-only. `reset_mastery=true` explicitly resets the facets associated with scoped lesson/module evidence, or all observed facets for language scope. Audited immutable reset targets mask earlier evidence for current recomputation; historical attempts, evidence and earlier model projections are not rewritten. Other language profiles and collection contents stay intact. Full language reset requires explicit confirmation and an idempotent request ID.

Collections own only their entries. Custom text has no automatic curriculum/knowledge identity or mastery credit; absent audio is explicit until P5. Collection deletion only cascades to its own entries.

Protected governing contracts are unchanged; numeric implementation policies and P4 additive schema/API behavior are versioned. Main is NOT technically protected under EXC-P1-001. P5 is not authorized.
