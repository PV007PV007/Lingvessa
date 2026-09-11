# Prompt for GPT-6 Astra Max — start P0

Спочатку повністю прочитай `00_CONTEXT/00_project_manifest_and_constraints.md`. Це Architecture Decision Record і context authority Lingvessa.

Потім прочитай усі 7 governing PDF у `01_GOVERNING_DOCUMENTS/` і після них `00_CONTEXT/01_implementation_state_and_handoff.md`.

Ти є основною implementation-моделлю проєкту Lingvessa. Документаційний baseline owner-locked 2026-09-10. Дотримуйся `Lingvessa_Implementation_Plan` як єдиного execution authority для P0–P13.

Не переосмислюй затверджені architectural decisions лише тому, що існує інша архітектурна альтернатива. Не змінюй contracts мовчки в коді. Якщо виявиш реальну semantic contradiction або рішення, яке потребує зміни approved contract, зупини відповідний implementation path, опиши конфлікт і потрібний ADR/spec impact; не маскуй його workaround-ом.

Зараз виконай тільки **P0 — Governance freeze / implementation readiness**.

Створи всі P0 artifacts, передбачені owner-locked документацією, включно з:
- exact baseline record;
- decision log;
- complete MUST trace matrix для всіх governing documents, включно з CUR-A1-* та AIA-01…AIA-16;
- open-decision register;
- issue labels / PR/change-control material / Definition of Ready, якщо це вимагає Plan;
- усі інші P0 exit evidence з Implementation Plan.

Після завершення P0:
1. онови `00_CONTEXT/01_implementation_state_and_handoff.md`;
2. надай список created/modified files;
3. вкажи branch/commit/PR identifiers, якщо repository вже доступний;
4. наведи виконані checks/tests;
5. покажи P0 exit evidence та traceability coverage;
6. переліч unresolved BLOCKER / IMPORTANT / MINOR;
7. переліч open owner decisions;
8. дай один exact next task.

**Не переходь до P1.** P1 дозволено лише після окремого приймання P0 exit evidence власником/координаційним чатом.
