# Time Cache And Range Metadata Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make analysis timestamps stable for caching and rendering, and make range-stat data sources explicit in the model.

**Architecture:** Keep the current extension flow intact, but move timestamp generation onto a stable machine-readable format and let refresh policy depend on numeric time instead of localized text parsing. Extend range-analysis metadata with explicit source fields so UI and exports can describe what came from filesystem timestamps versus Git history without guessing.

**Tech Stack:** TypeScript, VS Code extension API, Mocha test suite

---

### Task 1: Lock timestamp and metadata behavior with tests

**Files:**
- Modify: `src/test/extension.test.ts`
- Test: `src/test/extension.test.ts`

- [ ] **Step 1: Write the failing tests**
- [ ] **Step 2: Run targeted tests to verify they fail**
- [ ] **Step 3: Cover stable timestamp generation and explicit range metadata fields**

### Task 2: Implement stable analysis timestamp helpers

**Files:**
- Modify: `src/types.ts`
- Modify: `src/app/refreshPolicy.ts`
- Modify: `src/analysis/workspaceAnalyzer.ts`
- Modify: `src/analysis/todayAnalyzer.ts`

- [ ] **Step 1: Add stable timestamp fields to stats types**
- [ ] **Step 2: Update refresh policy to use machine-readable timestamps**
- [ ] **Step 3: Emit stable timestamps from workspace and range analyzers**
- [ ] **Step 4: Run targeted tests and keep them green**

### Task 3: Make range-stat sources explicit

**Files:**
- Modify: `src/types.ts`
- Modify: `src/analysis/todayAnalyzer.ts`
- Modify: `media/webview/dashboard.js`

- [ ] **Step 1: Add explicit source metadata for touched/new/deleted files and line deltas**
- [ ] **Step 2: Populate the fields in today/range analysis**
- [ ] **Step 3: Render the explanation from metadata instead of hardcoded assumptions**
- [ ] **Step 4: Run focused and full test suites**
