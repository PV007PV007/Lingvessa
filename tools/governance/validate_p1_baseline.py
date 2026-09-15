#!/usr/bin/env python3
"""P1 governance checks. This is not a substitute for DB/container exit gates."""
import csv
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
checks = []

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
check("original checksum manifest unchanged", digest(baseline["checksum_manifest"]["path"]) == baseline["checksum_manifest"]["sha256"])
check("sole execution authority", baseline["precedence"]["execution_order"]["version"] == "1.4" and baseline["precedence"]["execution_order"]["sole_authority"].endswith("Lingvessa_Implementation_Plan.pdf"))
authorization = read("docs/p1/authorization.json")
check("P1 owner authorization; P2 hard stop", authorization["owner_instruction"] == "P0 accepted. Proceed to P1." and authorization["p2_authorized"] is False)
check("accepted P0 recorded", baseline["p0"]["owner_acceptance"] == "ACCEPTED" and baseline["p0"]["p1_authorized"] is True)
catalog = read("docs/baseline/requirement-catalog.json")
with (ROOT / "docs/baseline/requirements-trace.csv").open(encoding="utf-8", newline="") as file:
    matrix = list(csv.DictReader(file))
ids = [row["requirement_id"] for row in catalog]
check("P0 trace preserved without lost IDs", len(catalog) == 2475 and len(ids) == len(set(ids)) and set(ids) == {r["requirement_id"] for r in matrix})
check("all 2453 MUST rows retained", sum(r["priority"] == "MUST" for r in catalog) == 2453)
evidence = read("docs/p1/requirement-evidence.json")
p1_ids = {r["requirement_id"] for r in catalog if r["implementation_phase"] == "P1"}
overlay_ids = [r["requirement_id"] for r in evidence["requirements"]]
check("P1 evidence overlay covers exactly P1 planning rows", set(overlay_ids) == p1_ids and len(overlay_ids) == len(set(overlay_ids)))
check("evidence points to real implementation files", all(all((ROOT / p).exists() for p in r["actual_code_schema"]) for r in evidence["requirements"]))
check("no invented full runtime acceptance", all(r["status"] in {"P1_FOUNDATION_VERIFIED", "P1_FOUNDATION_PARTIAL", "P1_GATE_PENDING", "FUTURE_RUNTIME_ACCEPTANCE"} for r in evidence["requirements"]))
schema = (ROOT / "prisma/schema.prisma").read_text()
check("P1-only schema boundary", re.findall(r"^model\s+(\w+)", schema, re.M) == ["BootstrapFixture"] and 'schemas  = ["p1_bootstrap"]' in schema)
check("no feature engine implementation before P2", all((ROOT / f"packages/{name}/src/index.ts").read_text().strip().endswith("export {};") for name in ["domain", "application", "activity-schemas", "lesson-engine", "mastery-review", "ai-core"]))
tooling = read("package.json")
check("exact Node/pnpm pins", tooling["engines"] == {"node": "24.19.0", "pnpm": "11.19.0"} and tooling["packageManager"] == "pnpm@11.19.0")
check("private package and lockfile", tooling["private"] is True and (ROOT / "pnpm-lock.yaml").exists())
check("OpenAPI 3.1.2", read("infra/contracts/health.openapi.json")["openapi"] == "3.1.2")
images = read("docs/p1/image-lock.json")["images"]
dockerfile = (ROOT / "infra/containers/Dockerfile").read_text()
compose = (ROOT / "infra/local/compose.yml").read_text()
check("pinned base image digests", images["node"]["tag"] + "@" + images["node"]["digest"] in dockerfile and images["postgres"]["tag"] + "@" + images["postgres"]["digest"] in compose)
check("CI gates and review rule artifacts", all((ROOT / p).exists() for p in [".github/workflows/p1.yml", ".github/repository-rules.json", ".github/PULL_REQUEST_TEMPLATE.md", "docs/governance/change-control.md"]))
report = {"scope": "P1 governance integrity only; DB/OCI runtime gates are separate", "timestamp": datetime.now(timezone.utc).isoformat(), "status": "PASS" if all(c["status"] == "PASS" for c in checks) else "FAIL", "checks": checks}
output = ROOT / "artifacts/p1/baseline-validation.json"
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps({"status": report["status"], "passed": sum(c["status"] == "PASS" for c in checks), "total": len(checks)}, indent=2))
raise SystemExit(0 if report["status"] == "PASS" else 1)
