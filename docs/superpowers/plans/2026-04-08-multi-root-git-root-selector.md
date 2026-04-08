# Multi-Root Git Root Selector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a shared Git root selector for multi-root workspaces so Compare, Git trend, and range Git stats all use the same chosen repository.

**Architecture:** Introduce a small workspace-scoped Git root context backed by `workspaceState`, then thread the selected root through Compare and dashboard Git-only analysis paths. Keep file-scan analysis multi-root and unchanged; only Git-backed features switch per selected root.

**Tech Stack:** TypeScript, VS Code extension API, Mocha test suite

---

### Task 1: Lock Git root context behavior with tests

**Files:**
- Modify: `src/test/extension.test.ts`
- Modify: `src/test/compare.test.ts`
- Test: `src/test/extension.test.ts`
- Test: `src/test/compare.test.ts`

- [ ] **Step 1: Write failing tests for default/root persistence and invalid fallback**
- [ ] **Step 2: Write failing tests for Compare state carrying selected root options**
- [ ] **Step 3: Run focused tests to verify they fail**

### Task 2: Add shared Git root context

**Files:**
- Modify: `src/types.ts`
- Create: `src/workspace/gitRootContext.ts`
- Modify: `src/workspace/rootSupport.ts`

- [ ] **Step 1: Add typed Git root option/context models**
- [ ] **Step 2: Implement workspaceState-backed selection helpers**
- [ ] **Step 3: Re-run focused tests and make them pass**

### Task 3: Wire selected root into Compare

**Files:**
- Modify: `src/ui/comparePanel.ts`
- Modify: `src/webview/compareTemplates.ts`
- Modify: `src/analysis/compareAnalyzer.ts`
- Modify: `src/extension.ts`

- [ ] **Step 1: Extend compare state with root options and current selection**
- [ ] **Step 2: Add webview command for root switching**
- [ ] **Step 3: Refresh branch/base state and clear stale compare results after switching**
- [ ] **Step 4: Run Compare-focused tests**

### Task 4: Wire selected root into dashboard Git features

**Files:**
- Modify: `src/app/dashboardController.ts`
- Modify: `src/app/commandRegistry.ts`
- Modify: `src/ui/webviewCommands.ts`
- Modify: `src/ui/sidebar.ts`
- Modify: `src/webview/templates.ts`
- Modify: `media/webview/dashboard.js`
- Modify: `src/analysis/workspaceAnalyzer.ts`
- Modify: `src/analysis/todayAnalyzer.ts`
- Modify: `src/git/history.ts`
- Modify: `src/git/today.ts`
- Modify: `src/extension.ts`

- [ ] **Step 1: Add a command to pick the active Git root**
- [ ] **Step 2: Feed the selected root into workspace Git trend and range Git stats**
- [ ] **Step 3: Surface current root and switch affordances in dashboard UI**
- [ ] **Step 4: Keep single-root behavior unchanged**
- [ ] **Step 5: Run full test suite**
