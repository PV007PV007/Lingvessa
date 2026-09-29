#!/usr/bin/env python3
"""P3 governance/trace checks. PostgreSQL and OCI exit gates execute separately."""
import csv
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
checks = []
p4_authorized = (ROOT / "docs/p4/authorization.json").exists() and json.loads((ROOT / "docs/p4/authorization.json").read_text()).get("p4_authorized") is True

def check(name, condition):
    checks.append({"check": name, "status": "PASS" if condition else "FAIL"})

def read(path):
    return json.loads((ROOT / path).read_text(encoding="utf-8"))

def digest(path):
    return hashlib.sha256((ROOT / path).read_bytes()).hexdigest()

baseline = read("docs/baseline/baseline.yml")
versions = {"FS": "1.7", "TS": "1.7", "TD": "1.7", "CUR": "1.6", "REF": "1.6", "AI": "1.4", "PLAN": "1.4"}
check("exact governing versions", {d["document_id"]: d["version"] for d in baseline["governing_documents"]} == versions)
for document in baseline["governing_documents"]:
    check("locked checksum " + document["document_id"], digest(document["path"]) == document["sha256"])
check("locked architecture manifest", digest(baseline["architecture_manifest"]["path"]) == baseline["architecture_manifest"]["sha256"])
check("locked original handoff retained", digest(baseline["handoff"]["initial_owner_locked_snapshot"]) == baseline["handoff"]["initial_sha256"])
check("checksum manifest unchanged", digest(baseline["checksum_manifest"]["path"]) == baseline["checksum_manifest"]["sha256"])
check("sole execution authority", baseline["precedence"]["execution_order"]["version"] == "1.4" and baseline["precedence"]["execution_order"]["sole_authority"].endswith("Lingvessa_Implementation_Plan.pdf"))

authorization = read("docs/p3/authorization.json")
check("P3 owner authorization and P4 hard stop", authorization["p3_authorized"] is True and authorization["p4_authorized"] is False)
check("accepted P2 source pin", authorization["accepted_main_sha"] == "df07f9a15838c99da1ea8c876a8b6262057b0354" and authorization["accepted_tag"] == "p2-accepted-2026-09-16")
check("accepted process limitation retained", "NOT technically protected" in authorization["operational_exception"])

catalog = read("docs/baseline/requirement-catalog.json")
with (ROOT / "docs/baseline/requirements-trace.csv").open(encoding="utf-8", newline="") as file:
    matrix = list(csv.DictReader(file))
ids = [row["requirement_id"] for row in catalog]
check("P0 trace preserved", len(catalog) == 2475 and len(ids) == len(set(ids)) and set(ids) == {row["requirement_id"] for row in matrix})
check("all MUST rows retained", sum(row["priority"] == "MUST" for row in catalog) == 2453)

p3_ids = {row["requirement_id"] for row in catalog if row["implementation_phase"] == "P3"}
evidence = read("docs/p3/requirement-evidence.json")
overlay_ids = [row["requirement_id"] for row in evidence["requirements"]]
check("P3 evidence covers exactly 165 planning rows", len(p3_ids) == 165 and set(overlay_ids) == p3_ids and len(overlay_ids) == len(set(overlay_ids)))
check("P3 priority count", evidence["stats"]["MUST"] == 162 and evidence["stats"]["SHOULD"] == 3)
check("evidence points to real implementation files", all(all((ROOT / path).exists() for path in row["actual_code_schema"]) for row in evidence["requirements"]))
check("evidence status vocabulary", all(row["status"] in {"P3_IMPLEMENTED_LOCAL_HOSTED_PENDING", "P3_VERIFIED", "P3_FOUNDATION_PARTIAL", "FUTURE_RUNTIME_ACCEPTANCE"} for row in evidence["requirements"]))

tasks = read("docs/p3/task-status.json")
check("ordered P3 task packets", [task["task_id"] for task in tasks["tasks"]] == ["IMP-P3-001","IMP-P3-002","IMP-P3-003","IMP-P3-004"])
check("all P3 requirements assigned once", sorted(rid for task in tasks["tasks"] for rid in task["requirement_ids"]) == sorted(p3_ids))

schema = (ROOT / "prisma/schema.prisma").read_text(encoding="utf-8")
migration = (ROOT / "prisma/migrations/202609160001_p3_lesson_engine/migration.sql").read_text(encoding="utf-8")
for table in ["lesson_runs","lesson_run_items","activity_attempts","attempt_receipts","evidence_events","outbox_events","outbox_deliveries"]:
    check("P3 schema table " + table, f"model {table}" in schema and f"CREATE TABLE {table}" in migration)
p5_authorized = (ROOT / "docs/p5/authorization.json").exists() and read("docs/p5/authorization.json").get("p5_authorized") is True
forbidden = ["ai_runs","ai_sessions"] if p5_authorized and p4_authorized else ["speech_jobs","ai_runs","ai_sessions"] if p4_authorized else ["knowledge_mastery_states","skill_mastery_states","review_schedules","speech_jobs","ai_runs","ai_sessions"]
check("authorized phase boundary (P4/P5 extensions require recorded owner authorization)", all(f"model {name}" not in schema and f"CREATE TABLE {name}" not in migration for name in forbidden))
check("mastery and AI packages remain phase-empty", all((ROOT / f"packages/{name}/src/index.ts").read_text().strip().endswith("export {};") for name in (["ai-core"] if p4_authorized else ["mastery-review","ai-core"])))
check("lesson engine materialized", not (ROOT / "packages/lesson-engine/src/index.ts").read_text().strip().endswith("export {};") and (ROOT / "packages/lesson-engine/src/state.ts").exists())
check("shared bilingual executable fixtures", all((ROOT / f"content/fixtures/p3/{language}-lesson.json").exists() for language in ["en","cs"]))
check("OpenAPI 3.1.2 and P3 surface", read("infra/contracts/p3.openapi.json")["openapi"] == "3.1.2" and "/lesson-runs/{id}/attempts" in read("infra/contracts/p3.openapi.json")["paths"])
check("P3 workflow and P1/P2 regression retained", all((ROOT / path).exists() for path in [".github/workflows/p1.yml",".github/workflows/p2.yml",".github/workflows/p3.yml"]))

tooling = read("package.json")
check("exact Node/pnpm pins", tooling["engines"] == {"node":"24.19.0","pnpm":"11.19.0"} and tooling["packageManager"] == "pnpm@11.19.0")
check("private package and lockfile", tooling["private"] is True and (ROOT / "pnpm-lock.yaml").exists())
images = read("docs/p1/image-lock.json")["images"]
dockerfile = (ROOT / "infra/containers/Dockerfile").read_text(encoding="utf-8")
compose = (ROOT / "infra/local/compose.yml").read_text(encoding="utf-8")
check("pinned image digests", images["node"]["tag"] + "@" + images["node"]["digest"] in dockerfile and images["postgres"]["tag"] + "@" + images["postgres"]["digest"] in compose)

report = {"scope":"P3 governance/trace integrity; DB/OCI runtime gates are separate", "timestamp":datetime.now(timezone.utc).isoformat(),
          "status":"PASS" if all(item["status"] == "PASS" for item in checks) else "FAIL", "checks":checks}
output = ROOT / "artifacts/p3/baseline-validation.json"
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"status":report["status"],"passed":sum(item["status"] == "PASS" for item in checks),"total":len(checks)}, indent=2))
raise SystemExit(0 if report["status"] == "PASS" else 1)
