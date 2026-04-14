# Frontend Refactor Implementation Plan

## Objectives
- Split monolithic frontend code into clear modules and components.
- Keep behavior backward compatible during migration.
- Improve readability, debuggability, and regression control.
- Keep architecture in plain JavaScript with script tags (no bundler in this phase).

## Current Issues to Fix First
- Large monolithic file in frontend script with mixed concerns.
- Multiple duplicate function declarations in the same runtime scope.
- Multiple DOMContentLoaded initialization blocks causing overlapping setup.
- Heavy inline handler usage in HTML (onclick/onchange/oninput), tightly coupled to globals.
- Shared mutable global state without a single ownership point.

## Target Architecture (No Bundler)

### Frontend app target structure
- frontend/js/core
- frontend/js/services
- frontend/js/components
- frontend/js/features
- frontend/js/bootstrap

### Dashboard app target structure
- dashboard/js/core
- dashboard/js/services
- dashboard/js/components
- dashboard/js/features
- dashboard/js/bootstrap

## Migration Principles
1. Compatibility first: do not break current behavior.
2. Extract in thin slices: one domain at a time.
3. Keep old handler surface via temporary facade wrappers.
4. Verify after each slice with role-based smoke checklist.
5. Remove dead/duplicate code only after equivalent module is active.

## Detailed Phases

### Phase 0: Baseline and Safety Net
1. Freeze baseline behavior and script loading order for frontend and dashboard pages.
2. Build smoke test checklist for login, navigation, CRUD, save/evaluate flows, exports, modals, and hash navigation.
3. Identify and mark high-risk debt in frontend script:
   - duplicate functions
   - duplicate bootstrap logic
   - shadowed implementations
4. Create function-to-module mapping tables for frontend and dashboard.

### Phase 1: Architecture Contracts
1. Define module naming conventions and file contracts.
2. Define temporary global facades:
   - window.SizingApp for frontend
   - window.AdminApp for dashboard
3. Define dependency order rules for script includes.
4. Define shared constants policy (roles, statuses, action types).

### Phase 2: Frontend Stabilization
1. Merge startup logic into one idempotent initialization flow.
2. Remove duplicate function declarations and keep one canonical implementation.
3. Introduce single state ownership module for project/session/page state.
4. Introduce selector map module to reduce scattered DOM querying.
5. Keep behavior identical while reducing runtime ambiguity.

### Phase 3: Frontend Core Extraction
1. Extract API + auth helpers to core modules.
2. Extract routing/history helpers to a dedicated router module.
3. Extract shared UI feedback (toast/loading/confirm) to components.
4. Extract shared utils and validation helpers.
5. Introduce bootstrap module and update script order on frontend index.

### Phase 4: Frontend Feature Decomposition
1. Project List feature module:
   - load/render/filter/search/new/delete/open
2. Request tab feature module:
   - load/collect/save/evaluate payload handling
3. Input tab feature module:
   - dynamic rows, evidence handling, dropdown sync
4. Model tab feature module:
   - physical/logical/flow/connection detail handling
5. Summary tab feature module:
   - aggregation, parser orchestration, save/export prep
6. Evidence + image modal shared component modules.

### Phase 5: Sizing Engine Decomposition
1. Extract module instance engine:
   - instance keying
   - context execution
   - inline handler rewrite bridge
   - snapshot capture/restore
2. Split sizing modules by domain:
   - App
   - MariaDB
   - Redis
   - Kafka
   - K8S
   - LB/FW
3. Create sizing controller to orchestrate save/load/evaluate across modules.
4. Preserve current data shape for backend compatibility.

### Phase 6: Dashboard Decomposition
1. Move dashboard core (utils/api/auth/audit) into layered modules.
2. Extract reusable dashboard components:
   - toast
   - confirm
   - loading
   - paginator
3. Split page modules:
   - dashboard shell
   - users
   - projects
   - audit log
   - reports
4. Add bootstrap entry for deterministic init order.

### Phase 7: Event Migration and Cleanup
1. Replace inline HTML handlers with delegated listeners and data-action attributes.
2. Keep temporary global wrappers until all pages pass regression checks.
3. Remove wrappers and dead code after stable verification.
4. Final cleanup:
   - remove duplicate helpers
   - centralize constants
   - standardize error handling
   - update debugging and module-map docs

## Verification Checklist
1. Role auth checks (user/admin1/admin2) on both frontend and dashboard.
2. Hash/back-forward route restoration checks.
3. Frontend list/detail workflows with no behavior drift.
4. Save/load/evaluate on all 5 frontend sections.
5. Sizing module calculations and admin reviews per module type.
6. Export validations:
   - DOCX frontend export
   - CSV dashboard report/audit export
7. Dashboard CRUD and assignment flows.
8. UI interaction checks:
   - modal lifecycle
   - toast queue
   - loading overlay
   - ESC shortcuts
9. Duplicate bootstrap/function removal validation.
10. Performance sanity against baseline.

## Immediate Implementation Sequence (Started)
1. Frontend initialization stabilization and deduplication.
2. Remove duplicate function declarations in frontend script.
3. Continue by introducing state and selector modules.
4. Then split frontend features in priority order:
   - project list
   - request/input
   - model
   - sizing modules
   - summary
5. After frontend core is stable, start dashboard modular split.

## Risks and Mitigations
- Risk: regression from hidden coupling.
  - Mitigation: compatibility facade + smoke tests per slice.
- Risk: event wiring breaks due inline handler migration.
  - Mitigation: migrate in staged mode with fallback wrappers.
- Risk: module split changes payload shape.
  - Mitigation: lock payload contracts and compare before/after samples.

## Done Criteria
- No duplicate bootstrap/function shadowing in runtime-critical paths.
- Domain logic split into modules with clear ownership.
- Inline event coupling removed or isolated behind wrappers.
- Regression checklist passes for all core workflows.
- Codebase easier to navigate, trace, and debug.