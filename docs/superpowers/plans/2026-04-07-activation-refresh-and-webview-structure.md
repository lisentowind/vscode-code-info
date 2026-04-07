# Code Info Activation Refresh And Webview Structure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce unnecessary startup work, split `extension.ts` into clearer orchestration seams, and move the dashboard webview away from one giant inline template string without introducing a heavyweight frontend framework.

**Architecture:** First, tighten activation and refresh so the extension only does meaningful work when the user opens the view or runs a command, with lightweight stale-state tracking instead of eager reruns. Next, extract extension orchestration into focused modules for cached state, command registration, and dashboard refresh. Finally, keep the current webview stack but split the dashboard shell, data bootstrap, and front-end behavior into dedicated files under `src/webview` and `media/webview`, so UI iteration no longer requires editing one huge TypeScript string.

**Tech Stack:** TypeScript, VS Code extension API, WebviewPanel/WebviewView, pnpm, Mocha, @vscode/test-electron

---

### Task 1: Add regression coverage for activation and refresh behavior

**Files:**
- Modify: `src/test/extension.test.ts`
- Test helpers introduced in: `src/extension.ts`, `src/ui/sidebar.ts`, `src/ui/panels.ts`

- [ ] **Step 1: Write the failing tests for startup and refresh orchestration**

Add focused tests around extracted pure helpers that will cover:
- deciding whether cached range stats can be reused
- deciding when sidebar visibility should trigger a refresh
- guarding against duplicate range refresh requests while one is in flight

- [ ] **Step 2: Run the targeted tests and verify they fail for the missing helpers**

Run: `pnpm test`
Expected: FAIL because the new orchestration helpers or exported seams do not exist yet.

- [ ] **Step 3: Add a failing test for dashboard shell resource generation**

Cover the future split between:
- shell HTML generation
- CSS/JS resource injection
- serialized payload bootstrapping for compact vs full dashboard mode

- [ ] **Step 4: Run tests again and verify failures are still about missing implementation**

Run: `pnpm test`
Expected: FAIL with missing helper/symbol errors, not syntax or fixture mistakes.

- [ ] **Step 5: Commit the red tests**

```bash
git add src/test/extension.test.ts
git commit -m "test: cover activation refresh and dashboard shell helpers"
```

### Task 2: Tighten activation and refresh strategy

**Files:**
- Modify: `package.json`
- Modify: `src/extension.ts`
- Modify: `src/ui/sidebar.ts`
- Modify: `src/ui/statusBar.ts`
- Modify: `README.md`
- Test: `src/test/extension.test.ts`

- [ ] **Step 1: Replace eager startup activation with view and command driven activation**

Update `package.json` so activation happens from the Code Info view and user-facing commands instead of only `onStartupFinished`.

- [ ] **Step 2: Introduce stale-state tracking for range stats**

Add a lightweight freshness model in `src/extension.ts` so:
- first visible sidebar load still refreshes
- repeated visibility changes do not immediately rerun analysis
- command-triggered explicit refresh always bypasses freshness checks

- [ ] **Step 3: Keep the status bar honest during deferred refresh**

Make sure the status bar can distinguish:
- no data yet
- cached data shown
- active refresh in progress

- [ ] **Step 4: Update README behavior notes**

Document the new behavior so users understand that:
- the extension activates on demand
- range analysis refreshes when needed rather than unconditionally at startup

- [ ] **Step 5: Run verification**

Run:
- `pnpm run compile`
- `pnpm run lint`
- `pnpm test`

Expected: all green with no command regression.

- [ ] **Step 6: Commit the activation/refresh change**

```bash
git add package.json src/extension.ts src/ui/sidebar.ts src/ui/statusBar.ts README.md src/test/extension.test.ts
git commit -m "perf: defer activation and tighten refresh flow"
```

### Task 3: Extract extension orchestration out of `extension.ts`

**Files:**
- Create: `src/app/state.ts`
- Create: `src/app/dashboardController.ts`
- Create: `src/app/commandRegistry.ts`
- Modify: `src/extension.ts`
- Modify: `src/ui/webviewCommands.ts`
- Modify: `src/ui/panels.ts`
- Test: `src/test/extension.test.ts`

- [ ] **Step 1: Extract a shared app state module**

Move mutable extension state behind a small module that owns:
- latest project stats
- latest range stats
- selected range preset
- in-flight refresh promise

- [ ] **Step 2: Extract dashboard refresh orchestration**

Create a controller module responsible for:
- `ensureStats`
- full project analysis
- range analysis refresh
- rendering sidebar/panel/status bar after data changes

- [ ] **Step 3: Extract command registration**

Move command setup out of `src/extension.ts` so the entry file becomes a thin bootstrap that wires:
- output channel
- sidebar provider
- status bar
- dashboard controller
- command registry

- [ ] **Step 4: Keep webview command dispatch simple**

`src/ui/webviewCommands.ts` should stay as a small adapter around command ids, not as a second orchestration layer.

- [ ] **Step 5: Run verification**

Run:
- `pnpm run compile`
- `pnpm run lint`
- `pnpm test`

- [ ] **Step 6: Commit the extension split**

```bash
git add src/app/state.ts src/app/dashboardController.ts src/app/commandRegistry.ts src/extension.ts src/ui/webviewCommands.ts src/ui/panels.ts src/test/extension.test.ts
git commit -m "refactor: split extension orchestration"
```

### Task 4: Split dashboard webview shell from behavior and rendering

**Files:**
- Create: `src/webview/dashboardShell.ts`
- Create: `media/webview/dashboard.js`
- Modify: `src/webview/templates.ts`
- Modify: `src/ui/sidebar.ts`
- Modify: `src/ui/panels.ts`
- Modify: `media/webview/macos26.css`
- Test: `src/test/extension.test.ts`

- [ ] **Step 1: Introduce a shell builder for dashboard webviews**

Move the outer HTML document responsibilities into `src/webview/dashboardShell.ts`, including:
- CSP
- nonce
- CSS/JS URIs
- serialized payload bootstrapping
- root container markup

- [ ] **Step 2: Move dashboard runtime behavior into `media/webview/dashboard.js`**

The front-end script should own:
- payload parsing
- rendering
- event listeners
- menu behavior
- chart initialization

Keep it framework-free and DOM-driven.

- [ ] **Step 3: Shrink `templates.ts` to dashboard render helpers**

Leave `templates.ts` responsible for:
- generating dashboard content fragments
- pure HTML fragment helpers
- empty state HTML if still simple enough

It should no longer contain the entire page shell plus all runtime script behavior in one file.

- [ ] **Step 4: Reuse the new shell in both sidebar and full panel**

`src/ui/sidebar.ts` and `src/ui/panels.ts` should both consume the same dashboard shell entry, passing only:
- compact/full presentation mode
- resource URIs
- current data payload

- [ ] **Step 5: Keep compare webview unchanged in this iteration**

Do not migrate `compareTemplates.ts` yet. This iteration should prove the shell split on the dashboard path first.

- [ ] **Step 6: Run verification**

Run:
- `pnpm run compile`
- `pnpm run lint`
- `pnpm test`

- [ ] **Step 7: Commit the dashboard webview split**

```bash
git add src/webview/dashboardShell.ts media/webview/dashboard.js src/webview/templates.ts src/ui/sidebar.ts src/ui/panels.ts media/webview/macos26.css src/test/extension.test.ts
git commit -m "refactor: split dashboard webview shell"
```

### Task 5: Polish follow-up seams for future iterations

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-04-07-activation-refresh-and-webview-structure.md`

- [ ] **Step 1: Record follow-up opportunities discovered during implementation**

Capture any deferred items such as:
- compare webview shell split
- dashboard payload size limits
- persistence of cached stats across window reloads
- optional worker-based chart or analysis offloading

- [ ] **Step 2: Update user-facing docs if behavior changed**

Make sure README reflects:
- activation behavior
- dashboard architecture expectations
- current non-goals (still framework-free, compare page not migrated yet)

- [ ] **Step 3: Final verification**

Run:
- `pnpm run compile`
- `pnpm run lint`
- `pnpm test`

- [ ] **Step 4: Commit documentation follow-up**

```bash
git add README.md docs/superpowers/plans/2026-04-07-activation-refresh-and-webview-structure.md
git commit -m "docs: document activation and webview architecture"
```
