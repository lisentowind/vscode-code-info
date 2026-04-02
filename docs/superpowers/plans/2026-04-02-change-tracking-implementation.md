# Change Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an independent “变更对比” page that supports `当前分支 vs main/master` and `两个 commit 对比`, and shows both file-level changes and summary-level deltas with clear source-opening behavior.

**Architecture:** Follow the current extension split: Git helpers produce compare primitives, analysis helpers convert a resolved snapshot pair into reusable compare models, a dedicated compare panel owns page state and webview messages, and the compare template renders the standalone page while reusing the existing visual language. The plan explicitly keeps “统计看板入口” and “变更对比独立页面” separate so current dashboard complexity does not bleed into compare state management.

**Tech Stack:** TypeScript, VS Code extension API, local Git CLI, Mocha, @vscode/test-electron, existing `macos26.css`

---

## File Structure

**Create**
- `src/git/compare.ts`
  Resolve compare targets, inspect refs, read raw Git diff metadata, and load snapshot text from Git.
- `src/analysis/compareSnapshots.ts`
  Convert `base/head` file content into `FileStat`-like snapshots for compareable text files.
- `src/analysis/compareSummaries.ts`
  Build summary cards, language deltas, directory deltas, TODO deltas, and hotspot rows from snapshot pairs.
- `src/analysis/compareAnalyzer.ts`
  Orchestrate Git compare primitives + snapshot analysis + summary aggregation into `CompareStats`.
- `src/ui/comparePanel.ts`
  Own the standalone compare `WebviewPanel`, compare form state, loading/error states, and message handling.
- `src/webview/compareTemplates.ts`
  Render compare page HTML, result tables, empty/error/loading states, and webview-side interactions.
- `src/test/compare.test.ts`
  Cover pure compare parsing, aggregation, and template rendering.

**Modify**
- `src/types.ts`
  Add compare result models, request state, UI message payloads, and compare file/open metadata.
- `src/git/common.ts`
  Reuse `runGit`; add shared helpers only if the compare module genuinely needs a common primitive.
- `src/ui/resourceNavigator.ts`
  Add the ability to open compare snapshot content for deleted/base-side files instead of only workspace URIs.
- `src/ui/webviewCommands.ts`
  Route only the lightweight “open compare page” action from current dashboard/sidebar into the new panel command.
- `src/ui/sidebar.ts`
  Add a “变更对比” entry in the compact/sidebar view.
- `src/ui/panels.ts`
  Keep existing dashboard panel isolated; only touch if a shared resource helper is necessary.
- `src/webview/templates.ts`
  Add a “变更对比” jump action in the current dashboard and empty state.
- `src/extension.ts`
  Register compare commands, instantiate compare panel state, and wire compare panel refresh/open actions.
- `media/webview/macos26.css`
  Add dedicated compare page layout/style hooks instead of cramming compare HTML into dashboard-only selectors.
- `package.json`
  Register compare commands and menu entries.
- `README.md`
  Document compare entry points and supported compare modes.

## Key Technical Decisions To Preserve During Execution

- **Git status classification cannot rely on `--name-status` alone.**
  Use `git diff --raw -z --find-renames` to classify regular file changes, rename pairs, and submodule entries via mode `160000`. Use `git diff --numstat -z --find-renames` to map line deltas and binary markers (`-` rows). Merge both streams by path identity.

- **The compare page must have explicit state flow.**
  The panel owns `mode`, raw user inputs, resolved targets, current run status (`idle/loading/success/error`), latest result, and latest error. Opening the panel should resolve defaults for branch compare and trigger an initial run for `current branch vs main/master`.

- **Snapshot opening behavior is part of scope, not a later polish item.**
  - `added` / `modified`: open the head-side workspace file when available.
  - `deleted`: open a readonly text document built from `git show <baseRef>:<path>`.
  - `renamed`: expose old path and new path; old path opens base snapshot, new path opens head snapshot/current file.
  - `binary` / `submodule`: row is visible but no text snapshot open action is offered.

- **UI tests must verify visible control paths, not accidental string presence.**
  Compare template tests should assert mode controls, submit controls, badge rendering, and opening affordances rather than only checking whether command strings appear anywhere in HTML.

---

### Task 1: Define Compare Types and Git Primitive Contracts

**Files:**
- Modify: `src/types.ts`
- Create: `src/git/compare.ts`
- Test: `src/test/compare.test.ts`

- [ ] **Step 1: Write failing tests for raw compare parsing and target resolution**

Add tests in `src/test/compare.test.ts` for:
- resolving current branch compare target with `main` first and `master` fallback
- parsing `git diff --raw -z --find-renames` into `added / modified / deleted / renamed / submodule`
- parsing `git diff --numstat -z --find-renames` into per-file line deltas and binary markers
- merging raw and numstat rows into a unified compare file primitive

- [ ] **Step 2: Run the test suite and confirm it fails for missing exports**

Run: `pnpm test`
Expected: FAIL with missing compare types/helpers such as `resolveCompareTargets`, `parseCompareRawOutput`, or `mergeCompareDiffRows`.

- [ ] **Step 3: Add compare types and Git primitive helpers**

Implement:
- compare request/source types in `src/types.ts`
- raw diff row types for `status`, `oldPath`, `path`, `isBinary`, `isSubmodule`
- `resolveDefaultCompareBase(rootPath)`
- `resolveCompareTargets(rootPath, request)`
- `parseCompareRawOutput(output)`
- `parseCompareNumstatOutput(output)`
- `mergeCompareDiffRows(rawRows, numstatRows)`

Notes:
- prefer `git symbolic-ref --short HEAD` and `git rev-parse --verify`
- use `git diff --raw -z --find-renames <base> <head>`
- use `git diff --numstat -z --find-renames <base> <head>`

- [ ] **Step 4: Run tests again and confirm the compare primitive tests pass**

Run: `pnpm test`
Expected: new compare primitive tests pass; current extension tests stay green.

- [ ] **Step 5: Commit the compare primitive contract**

```bash
git add src/types.ts src/git/compare.ts src/test/compare.test.ts
git commit -m "feat: add compare git primitives"
```

### Task 2: Add Snapshot Readers and Compare File Open Strategy

**Files:**
- Create: `src/analysis/compareSnapshots.ts`
- Modify: `src/git/compare.ts`
- Modify: `src/ui/resourceNavigator.ts`
- Modify: `src/types.ts`
- Test: `src/test/compare.test.ts`

- [ ] **Step 1: Write failing tests for snapshot loading and open-target behavior**

Cover:
- text file with both base/head snapshots
- deleted file producing only base snapshot
- added file producing only head snapshot
- renamed text file keeping `oldPath` + `path`
- binary/submodule files returning “not text-comparable”
- deleted file rows mapping to a readonly compare snapshot open target instead of a workspace URI

- [ ] **Step 2: Run the test suite and confirm it fails for missing snapshot/open helpers**

Run: `pnpm test`
Expected: FAIL with missing snapshot loader or open-target helpers.

- [ ] **Step 3: Implement snapshot and open helpers**

Add:
- `readCompareTextSnapshot(rootPath, ref, path)` in `src/git/compare.ts`
- snapshot analyzers in `src/analysis/compareSnapshots.ts`
- compare file open target types in `src/types.ts`
- resource navigator helper for opening compare snapshot content, for example:
  - `openTextContent(title, content, language?, line?, character?)`

Keep behavior explicit:
- workspace file opens remain in `openResource`
- compare snapshots open through a separate helper so deleted/base-only files work

- [ ] **Step 4: Re-run tests and confirm snapshot/open behavior is green**

Run: `pnpm test`
Expected: snapshot and open-target tests pass with no regressions.

- [ ] **Step 5: Commit the snapshot/open strategy**

```bash
git add src/analysis/compareSnapshots.ts src/git/compare.ts src/ui/resourceNavigator.ts src/types.ts src/test/compare.test.ts
git commit -m "feat: add compare snapshots and open strategy"
```

### Task 3: Build Compare Analyzer and Summary Aggregation

**Files:**
- Create: `src/analysis/compareAnalyzer.ts`
- Create: `src/analysis/compareSummaries.ts`
- Modify: `src/types.ts`
- Test: `src/test/compare.test.ts`

- [ ] **Step 1: Write failing tests for compare summary output**

Cover:
- summary card totals (`changed files`, `new files`, `deleted files`, `added/deleted lines`, `net code lines`, `todo delta`)
- language delta rows using `before/after` snapshots rather than diff lines
- directory delta rows reusing current module-depth aggregation rules
- hotspot sorting by changed lines, then file path
- renamed text files contributing to language/directory/TODO deltas
- binary/submodule files excluded from text-derived summary metrics

- [ ] **Step 2: Run the test suite and confirm it fails for missing analyzer/aggregator code**

Run: `pnpm test`
Expected: FAIL for missing compare analyzer exports or incomplete `CompareStats` shape.

- [ ] **Step 3: Implement compare analyzer composition**

Implement:
- `analyzeCompare(request, logger?)` in `src/analysis/compareAnalyzer.ts`
- snapshot-pair aggregation in `src/analysis/compareSummaries.ts`
- compare result models in `src/types.ts`

`CompareStats` must include:
- `compareSource`
- `resolvedTargets`
- `summary`
- `files`
- `languages`
- `directories`
- `hotspots`
- `analysisMeta`

- [ ] **Step 4: Run full verification for the pure analysis layer**

Run:
- `pnpm run compile`
- `pnpm run lint`
- `pnpm test`

Expected: all green.

- [ ] **Step 5: Commit compare analysis aggregation**

```bash
git add src/analysis/compareAnalyzer.ts src/analysis/compareSummaries.ts src/types.ts src/test/compare.test.ts
git commit -m "feat: add compare analysis summaries"
```

### Task 4: Build Compare Panel State Flow

**Files:**
- Create: `src/ui/comparePanel.ts`
- Modify: `src/types.ts`
- Modify: `src/extension.ts`
- Test: `src/test/compare.test.ts`

- [ ] **Step 1: Write failing tests for compare panel state transitions where practical**

Cover pure/stateful helpers for:
- default initial state uses branch compare mode
- panel input state updates when mode changes
- branch mode auto-resolves and triggers compare run
- commit mode requires both `baseRef` and `headRef`
- loading, success, and error view-model transitions

- [ ] **Step 2: Run the test suite and confirm it fails for the missing panel state helpers**

Run: `pnpm test`
Expected: FAIL with missing compare panel state/update helpers.

- [ ] **Step 3: Implement compare panel lifecycle and message handling**

Add `src/ui/comparePanel.ts` with:
- compare panel state type
- `showComparePanel(...)`
- `updateComparePanelIfOpen(...)` only if needed
- compare message handler for:
  - `compare:setMode`
  - `compare:updateBaseRef`
  - `compare:updateHeadRef`
  - `compare:run`
  - `compare:openFile`

Implementation rule:
- compare panel handles compare-only messages itself
- existing `handleWebviewCommand` remains for dashboard/sidebar commands like `openCompare`

- [ ] **Step 4: Re-run tests and verify state helpers behave correctly**

Run: `pnpm test`
Expected: panel state tests pass; existing tests remain green.

- [ ] **Step 5: Commit the compare panel state layer**

```bash
git add src/ui/comparePanel.ts src/types.ts src/extension.ts src/test/compare.test.ts
git commit -m "feat: add compare panel state flow"
```

### Task 5: Render the Standalone Compare Page

**Files:**
- Create: `src/webview/compareTemplates.ts`
- Modify: `media/webview/macos26.css`
- Modify: `src/types.ts`
- Test: `src/test/compare.test.ts`

- [ ] **Step 1: Write failing tests for visible compare page controls and result rendering**

Cover:
- branch mode and commit mode controls are both visible
- branch mode default copy clearly shows current branch vs resolved base branch
- commit mode renders base/head input fields and run button
- summary cards render compare-focused labels
- file rows render status badges for `added / modified / deleted / renamed / binary / submodule`
- renamed rows show old/new path separately
- deleted rows show base snapshot open affordance
- loading, empty, and error states each render distinct text
- invalid SHA and non-Git workspace errors render explicit, distinct feedback

- [ ] **Step 2: Run the test suite and confirm it fails before template implementation**

Run: `pnpm test`
Expected: FAIL with missing compare template exports or wrong rendered text.

- [ ] **Step 3: Implement compare HTML and CSS**

Add:
- `src/webview/compareTemplates.ts`
- compare-specific class names in `media/webview/macos26.css`

Do not reuse dashboard-only layout directly. Reuse visual tokens, but give compare page its own:
- header
- mode switch area
- input bar
- summary card grid
- result sections/tables

- [ ] **Step 4: Run verification for template + styling changes**

Run:
- `pnpm run compile`
- `pnpm run lint`
- `pnpm test`

Expected: all green.

- [ ] **Step 5: Commit the compare UI layer**

```bash
git add src/webview/compareTemplates.ts media/webview/macos26.css src/types.ts src/test/compare.test.ts
git commit -m "feat: add compare page template"
```

### Task 6: Wire Compare Entry Points Into the Existing Extension

**Files:**
- Modify: `src/extension.ts`
- Modify: `src/ui/webviewCommands.ts`
- Modify: `src/ui/sidebar.ts`
- Modify: `src/webview/templates.ts`
- Modify: `package.json`
- Modify: `README.md`
- Test: `src/test/compare.test.ts`

- [ ] **Step 1: Write failing tests for existing entry-point hooks**

Prefer pure/render tests for:
- dashboard renders “变更对比” entry in non-compact and compact views
- empty state includes “打开变更对比” guidance where appropriate
- webview command routing recognizes `openCompare`

- [ ] **Step 2: Run the test suite and confirm it fails before wiring**

Run: `pnpm test`
Expected: FAIL for missing compare entry hooks.

- [ ] **Step 3: Implement compare command wiring**

Add:
- command registration `codeInfo.openCompare`
- command palette metadata in `package.json`
- dashboard/sidebar/empty-state compare buttons using `data-command="openCompare"`
- `handleWebviewCommand` routing for `openCompare`
- README usage note for supported compare modes

- [ ] **Step 4: Run full verification after end-to-end wiring**

Run:
- `pnpm run compile`
- `pnpm run lint`
- `pnpm test`

Expected: all green on the fully wired compare feature.

- [ ] **Step 5: Commit compare entry-point wiring**

```bash
git add src/extension.ts src/ui/webviewCommands.ts src/ui/sidebar.ts src/webview/templates.ts package.json README.md src/test/compare.test.ts
git commit -m "feat: wire compare entry points"
```

### Task 7: Manual Smoke Validation and Doc Drift Check

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-04-02-change-tracking-design.md` (only if implementation reveals deliberate spec drift)

- [ ] **Step 1: Run a manual smoke checklist in Extension Development Host**

Verify:
- `Code Info: Open Compare` opens the standalone page
- panel opens with `当前分支 vs main/master` selected by default
- branch compare auto-runs once defaults resolve
- commit compare accepts valid short SHA input
- deleted file rows open base snapshot content
- renamed rows can reach both old and new path targets
- binary/submodule rows are visible but clearly marked as non-text compare items

- [ ] **Step 2: Update docs only for deliberate implementation drift**

If implementation behavior intentionally differs from the spec or README wording, update the docs now. Do not make speculative doc edits.

- [ ] **Step 3: Run final verification**

Run:
- `pnpm run compile`
- `pnpm run lint`
- `pnpm test`

Expected: all green before handoff.

- [ ] **Step 4: Commit final polish if docs changed**

```bash
git add README.md docs/superpowers/specs/2026-04-02-change-tracking-design.md
git commit -m "docs: finalize compare feature notes"
```
