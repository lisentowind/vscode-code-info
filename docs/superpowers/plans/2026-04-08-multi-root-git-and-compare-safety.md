# Multi-Root Git And Compare Safety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make multi-root workspaces safe by disabling misleading single-repo Git and compare results while preserving file-scan analysis.

**Architecture:** Keep workspace scanning intact for multi-root setups, but explicitly degrade features that currently assume a single Git root. Propagate the unsupported state through typed metadata so the dashboard and compare UI can explain why Git-based data is unavailable instead of silently using the first workspace folder.

**Tech Stack:** TypeScript, VS Code extension API, Mocha test suite

---

### Task 1: Lock multi-root downgrade behavior with failing tests

**Files:**
- Modify: `src/test/extension.test.ts`
- Modify: `src/test/compare.test.ts`
- Test: `src/test/extension.test.ts`
- Test: `src/test/compare.test.ts`

- [ ] **Step 1: Write failing tests for multi-root Git unavailability metadata**
- [ ] **Step 2: Write failing tests for compare rejecting multi-root workspaces**
- [ ] **Step 3: Run focused tests to verify they fail for the expected reason**

### Task 2: Make Git-based analysis explicitly unavailable in multi-root mode

**Files:**
- Modify: `src/types.ts`
- Modify: `src/git/history.ts`
- Modify: `src/git/today.ts`
- Modify: `src/analysis/workspaceAnalyzer.ts`
- Modify: `src/analysis/todayAnalyzer.ts`

- [ ] **Step 1: Add typed Git-unavailable reasons**
- [ ] **Step 2: Return multi-root-specific unavailable states from Git analyzers**
- [ ] **Step 3: Wire workspace and range analyzers to skip Git work in multi-root mode**
- [ ] **Step 4: Run focused tests and keep them green**

### Task 3: Surface the unsupported state in dashboard and compare UI

**Files:**
- Modify: `src/analysis/compareAnalyzer.ts`
- Modify: `src/ui/comparePanel.ts`
- Modify: `src/webview/templates.ts`
- Modify: `media/webview/dashboard.js`
- Modify: `src/webview/compareTemplates.ts`

- [ ] **Step 1: Make compare fail fast with a clear multi-root message**
- [ ] **Step 2: Render multi-root-specific Git unavailable copy in dashboard surfaces**
- [ ] **Step 3: Render compare unsupported guidance without attempting auto-run**
- [ ] **Step 4: Run full test suite**
