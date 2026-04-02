# Code Info Core Refactor And Time Range Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce duplicated analysis and UI plumbing, add test coverage around the extracted seams, and prepare the extension for a follow-up time range analysis feature.

**Architecture:** Extract the repeated workspace file analysis flow into a shared analysis pipeline, centralize Git command execution and parsing helpers, and unify dashboard panel creation behind one panel bootstrap path. Expand tests around the new shared seams first so the refactors stay behavior-preserving. After the refactor lands, add a reusable date range model that can power "today" and future "last 7 days / custom range" modes.

**Tech Stack:** TypeScript, VS Code extension API, pnpm, Mocha, @vscode/test-electron

---

### Task 1: Add tests for shared analysis and Git parsing seams

**Files:**
- Modify: `src/test/extension.test.ts`
- Test helpers introduced in: `src/analysis/shared.ts`, `src/git/common.ts`, `src/git/today.ts`, `src/git/history.ts`

- [ ] **Step 1: Write failing tests for analysis result aggregation**

Add tests that cover:
- collecting `file`, `skipped-binary-content`, and `skipped-unreadable` results
- truncating and sorting TODO locations
- computing touched file totals from analyzed file stats

- [ ] **Step 2: Run the targeted tests and verify they fail for the expected missing helpers**

Run: `pnpm test`
Expected: FAIL with missing exports or missing shared helpers referenced by the new tests.

- [ ] **Step 3: Write failing tests for Git output parsing**

Add tests that cover:
- parsing deleted file lines from `git log --name-status`
- parsing `numstat` additions/deletions
- mapping commit dates into the expected weekly buckets

- [ ] **Step 4: Run the targeted tests again and verify the failures are still about missing implementations**

Run: `pnpm test`
Expected: FAIL with parser/helper symbols missing, not with syntax or fixture errors.

- [ ] **Step 5: Commit the red tests**

```bash
git add src/test/extension.test.ts
git commit -m "test: cover shared analysis and git parsing helpers"
```

### Task 2: Extract a shared workspace file analysis pipeline

**Files:**
- Create: `src/analysis/shared.ts`
- Modify: `src/analysis/workspaceAnalyzer.ts`
- Modify: `src/analysis/todayAnalyzer.ts`
- Modify: `src/types.ts`
- Test: `src/test/extension.test.ts`

- [ ] **Step 1: Implement `collectAnalyzedFiles` and shared result utilities**

Move the duplicated worker-pool loop into `src/analysis/shared.ts`. The helper should accept:
- the `vscode.Uri[]` list
- a per-file callback for filtering or enrichment
- shared TODO truncation and skipped-file counting behavior

- [ ] **Step 2: Refactor `analyzeWorkspace` to use the shared pipeline**

Keep the public `WorkspaceStats` shape unchanged. `workspaceAnalyzer.ts` should delegate the worker loop to the shared helper and keep only workspace-specific aggregation.

- [ ] **Step 3: Refactor `analyzeTodayWorkspace` to use the shared pipeline**

Reuse the same worker loop while preserving "today" filtering and touched-file enrichment (`status`, `modifiedAt`).

- [ ] **Step 4: Run tests and quality checks**

Run:
- `pnpm run compile`
- `pnpm run lint`
- `pnpm test`

Expected: all green with no behavior regression.

- [ ] **Step 5: Commit the shared analysis extraction**

```bash
git add src/analysis/shared.ts src/analysis/workspaceAnalyzer.ts src/analysis/todayAnalyzer.ts src/types.ts src/test/extension.test.ts
git commit -m "refactor: share workspace file analysis pipeline"
```

### Task 3: Centralize Git command execution and parsing helpers

**Files:**
- Create: `src/git/common.ts`
- Modify: `src/git/history.ts`
- Modify: `src/git/today.ts`
- Test: `src/test/extension.test.ts`

- [ ] **Step 1: Implement shared Git utilities**

Add helpers for:
- `runGit(args, cwd)`
- repository availability checks
- parsing `numstat` totals
- parsing deleted file paths

- [ ] **Step 2: Refactor `history.ts` and `today.ts` to consume the shared helpers**

Keep current return types and fallback behavior unchanged.

- [ ] **Step 3: Run verification**

Run:
- `pnpm run compile`
- `pnpm run lint`
- `pnpm test`

Expected: all green, with parser tests protecting the extraction.

- [ ] **Step 4: Commit the Git refactor**

```bash
git add src/git/common.ts src/git/history.ts src/git/today.ts src/test/extension.test.ts
git commit -m "refactor: share git command helpers"
```

### Task 4: Merge duplicated dashboard panel bootstrap logic

**Files:**
- Modify: `src/ui/panels.ts`
- Test: `src/test/extension.test.ts`

- [ ] **Step 1: Write a small test or assertion-focused helper coverage if panel bootstrap is split into pure helpers**

If direct webview tests are too expensive, extract pure option-building helpers and test them instead.

- [ ] **Step 2: Introduce an `ensurePanel` helper**

Unify repeated logic for:
- webview options
- icon application
- dispose and visibility listeners
- command message wiring

- [ ] **Step 3: Keep `showStatsPanel` and `showDashboardEmptyPanel` as thin wrappers**

They should differ only in title and final render path.

- [ ] **Step 4: Run verification**

Run:
- `pnpm run compile`
- `pnpm run lint`
- `pnpm test`

- [ ] **Step 5: Commit the panel refactor**

```bash
git add src/ui/panels.ts src/test/extension.test.ts
git commit -m "refactor: unify dashboard panel bootstrap"
```

### Task 5: Prepare the date range analysis model

**Files:**
- Create: `src/analysis/dateRange.ts`
- Modify: `src/analysis/todayAnalyzer.ts`
- Modify: `src/types.ts`
- Modify: `src/extension.ts`
- Modify: `README.md`
- Test: `src/test/extension.test.ts`

- [ ] **Step 1: Write failing tests for date range utilities**

Cover:
- start/end normalization
- label formatting
- reusable range presets (`today`, `last7Days`, `last30Days`)

- [ ] **Step 2: Implement pure date range helpers**

Keep them UI-agnostic so later commands and settings can reuse them.

- [ ] **Step 3: Adapt `todayAnalyzer` internals to consume the range helper without changing user-facing behavior yet**

This task prepares the seam; it does not need to expose new commands yet.

- [ ] **Step 4: Run verification**

Run:
- `pnpm run compile`
- `pnpm run lint`
- `pnpm test`

- [ ] **Step 5: Commit the range-prep extraction**

```bash
git add src/analysis/dateRange.ts src/analysis/todayAnalyzer.ts src/types.ts src/extension.ts README.md src/test/extension.test.ts
git commit -m "refactor: prepare date range analysis model"
```
