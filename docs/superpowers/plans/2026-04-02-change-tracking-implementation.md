# Change Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an independent “变更对比” page that supports `当前分支 vs main/master` and `两个 commit 对比`, with both file-level and summary-level results.

**Architecture:** Build the feature in four layers: Git compare primitives to resolve refs and raw file changes, analysis helpers that create `before/after` snapshots and aggregate a unified `CompareStats`, a dedicated compare webview panel, and lightweight entry-point wiring from commands and existing UI. Keep the compare result model reusable so future `timeRange` compare modes can resolve into the same snapshot-pair based pipeline.

**Tech Stack:** TypeScript, VS Code extension API, local Git CLI, pnpm, Mocha, @vscode/test-electron

---

## File Structure

**Create**
- `src/git/compare.ts`
  Resolves compare refs, detects base branch, parses `git diff`/`name-status`/`numstat`, and classifies special statuses like `renamed`, `binary`, and `submodule`.
- `src/analysis/compareAnalyzer.ts`
  Orchestrates compare analysis from Git primitives into `CompareStats`.
- `src/analysis/compareSnapshots.ts`
  Reads `before/after` file contents for text-comparable files and converts them into file stats.
- `src/analysis/compareSummaries.ts`
  Aggregates file deltas into summary cards, language changes, directory changes, and hotspots.
- `src/ui/comparePanel.ts`
  Owns the standalone compare `WebviewPanel`, panel lifecycle, and refresh/update flow.
- `src/webview/compareTemplates.ts`
  Renders the compare page HTML and webview-side interactions without inflating the existing dashboard template.
- `src/test/compare.test.ts`
  Covers pure compare parsing and aggregation logic.

**Modify**
- `src/types.ts`
  Add compare result types, compare source metadata, and file status enums.
- `src/extension.ts`
  Register compare commands and connect panel opening actions.
- `src/ui/webviewCommands.ts`
  Route compare-related webview messages to extension commands.
- `src/ui/sidebar.ts`
  Add a compare entry action in the existing sidebar experience.
- `src/webview/templates.ts`
  Add a lightweight “变更对比” jump action from the current dashboard.
- `package.json`
  Register compare commands and any menu/title actions.
- `README.md`
  Document the new compare capability and entry points.

---

### Task 1: Build Git Compare Primitives

**Files:**
- Create: `src/git/compare.ts`
- Modify: `src/types.ts`
- Test: `src/test/compare.test.ts`

- [ ] **Step 1: Write the failing tests for compare ref resolution and diff parsing**

Add tests in `src/test/compare.test.ts` for:
- resolving branch compare targets with `main` fallback to `master`
- parsing `git diff --name-status` into `added/modified/deleted/renamed/binary/submodule`
- parsing `git diff --numstat` totals with binary rows ignored for text metrics

- [ ] **Step 2: Run the targeted tests to verify they fail for missing compare helpers**

Run: `pnpm test`
Expected: FAIL with missing `src/git/compare.ts` exports or unresolved compare types.

- [ ] **Step 3: Implement minimal compare Git helpers**

Add `src/git/compare.ts` with pure helpers and small wrappers around existing Git execution utilities:
- `resolveDefaultCompareBase(rootPath)`
- `parseNameStatusOutput(output)`
- `parseCompareNumstat(output)`
- `resolveCompareTargets(mode, input)`

- [ ] **Step 4: Run tests again and verify the new compare parsing tests pass**

Run: `pnpm test`
Expected: compare parser tests pass; no regressions in existing tests.

- [ ] **Step 5: Commit the Git compare primitives**

```bash
git add src/git/compare.ts src/types.ts src/test/compare.test.ts
git commit -m "feat: add git compare primitives"
```

### Task 2: Add Snapshot-Pair Analysis and CompareStats Model

**Files:**
- Create: `src/analysis/compareSnapshots.ts`
- Create: `src/analysis/compareAnalyzer.ts`
- Modify: `src/types.ts`
- Test: `src/test/compare.test.ts`

- [ ] **Step 1: Write the failing tests for snapshot-pair compare analysis**

Cover:
- text files producing `before` and `after` stats
- deleted files only producing `before`
- added files only producing `after`
- renamed text files still contributing to text statistics
- binary/submodule entries being excluded from text aggregation

- [ ] **Step 2: Run the tests and verify they fail because compare analysis does not exist yet**

Run: `pnpm test`
Expected: FAIL with missing compare analyzer exports or incomplete compare result fields.

- [ ] **Step 3: Implement the snapshot analysis pipeline**

Create:
- `src/analysis/compareSnapshots.ts` to read file content from `baseRef` and `headRef`
- `src/analysis/compareAnalyzer.ts` to build a unified `CompareStats` with:
  - `compareSource`
  - `resolvedTargets`
  - `summary`
  - `files`
  - `analysisMeta`

- [ ] **Step 4: Run tests to verify snapshot handling is correct**

Run: `pnpm test`
Expected: new compare analyzer tests pass; existing tests remain green.

- [ ] **Step 5: Commit the snapshot analysis layer**

```bash
git add src/analysis/compareSnapshots.ts src/analysis/compareAnalyzer.ts src/types.ts src/test/compare.test.ts
git commit -m "feat: add compare snapshot analysis"
```

### Task 3: Add Compare Summaries for Cards, Languages, Directories, and Hotspots

**Files:**
- Create: `src/analysis/compareSummaries.ts`
- Modify: `src/analysis/compareAnalyzer.ts`
- Modify: `src/types.ts`
- Test: `src/test/compare.test.ts`

- [ ] **Step 1: Write the failing tests for compare summary aggregation**

Cover:
- file summary counts
- net code line changes
- language increases/decreases
- directory increases/decreases
- TODO delta counting from `before/after`
- hotspot sorting by changed lines

- [ ] **Step 2: Run tests and verify they fail for missing summary builders**

Run: `pnpm test`
Expected: FAIL with missing compare summary exports or wrong aggregation output.

- [ ] **Step 3: Implement compare summary builders**

Add `src/analysis/compareSummaries.ts` with pure helpers that derive:
- summary cards
- language delta rows
- directory delta rows
- hotspot rows

Refactor `src/analysis/compareAnalyzer.ts` to compose these helpers rather than embedding aggregation logic inline.

- [ ] **Step 4: Run verification**

Run:
- `pnpm run compile`
- `pnpm run lint`
- `pnpm test`

Expected: all green.

- [ ] **Step 5: Commit the compare summary layer**

```bash
git add src/analysis/compareSummaries.ts src/analysis/compareAnalyzer.ts src/types.ts src/test/compare.test.ts
git commit -m "feat: add compare summary aggregation"
```

### Task 4: Build the Standalone Compare Panel

**Files:**
- Create: `src/ui/comparePanel.ts`
- Create: `src/webview/compareTemplates.ts`
- Modify: `src/types.ts`
- Test: `src/test/compare.test.ts`

- [ ] **Step 1: Write failing tests for compare template rendering**

Add tests that cover:
- empty state copy
- compare mode labels
- summary card headings
- rename/binary/submodule badge rendering

- [ ] **Step 2: Run the tests to verify they fail for the missing compare UI files**

Run: `pnpm test`
Expected: FAIL with missing compare template/panel exports.

- [ ] **Step 3: Implement the compare webview panel and template**

Add:
- `src/ui/comparePanel.ts` for standalone panel lifecycle
- `src/webview/compareTemplates.ts` for rendering:
  - compare mode picker
  - input controls
  - summary cards
  - files/languages/directories/hotspots sections
  - empty and error states

- [ ] **Step 4: Run verification**

Run:
- `pnpm run compile`
- `pnpm run lint`
- `pnpm test`

Expected: all green.

- [ ] **Step 5: Commit the standalone compare panel**

```bash
git add src/ui/comparePanel.ts src/webview/compareTemplates.ts src/types.ts src/test/compare.test.ts
git commit -m "feat: add standalone compare panel"
```

### Task 5: Wire Commands and Existing UI Entry Points

**Files:**
- Modify: `src/extension.ts`
- Modify: `src/ui/webviewCommands.ts`
- Modify: `src/ui/sidebar.ts`
- Modify: `src/webview/templates.ts`
- Modify: `package.json`
- Modify: `README.md`
- Test: `src/test/compare.test.ts`

- [ ] **Step 1: Write failing tests for compare command metadata or rendering hooks where practical**

Prefer testing pure helpers for:
- command labels
- compare action visibility logic
- compare button copy in dashboard/sidebar rendering

- [ ] **Step 2: Run tests to verify the new hooks are still missing**

Run: `pnpm test`
Expected: FAIL for missing compare command wiring or render hooks.

- [ ] **Step 3: Implement compare entry wiring**

Add:
- command registration for `Code Info: Open Compare`
- webview message routing for compare actions
- a compare button in sidebar/dashboard UI
- README usage notes

- [ ] **Step 4: Run the full verification suite**

Run:
- `pnpm run compile`
- `pnpm run lint`
- `pnpm test`

Expected: all green on the fully wired compare feature.

- [ ] **Step 5: Commit the compare entry-point wiring**

```bash
git add src/extension.ts src/ui/webviewCommands.ts src/ui/sidebar.ts src/webview/templates.ts package.json README.md src/test/compare.test.ts
git commit -m "feat: wire compare commands and entry points"
```

### Task 6: Final Polish and Manual Validation Notes

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-04-02-change-tracking-design.md` (only if implementation revealed necessary spec drift)

- [ ] **Step 1: Run a manual smoke checklist in VS Code Extension Host**

Verify:
- `Code Info: Open Compare` opens the standalone page
- branch compare auto-resolves `main/master`
- commit compare accepts valid short SHAs
- clicking a compared file opens source
- rename/binary/submodule rows display using the planned fallback strategy

- [ ] **Step 2: Capture any implementation-driven doc corrections**

Only update docs if the implemented behavior intentionally differs from the current spec or README wording.

- [ ] **Step 3: Run final verification**

Run:
- `pnpm run compile`
- `pnpm run lint`
- `pnpm test`

Expected: all green before handing off.

- [ ] **Step 4: Commit the final polish**

```bash
git add README.md docs/superpowers/specs/2026-04-02-change-tracking-design.md
git commit -m "docs: finalize compare feature notes"
```
