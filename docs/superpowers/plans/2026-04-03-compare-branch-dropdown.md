# Compare Branch Dropdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace free-text branch inputs in compare branch mode with local-branch dropdown selectors while keeping commit mode as manual SHA input.

**Architecture:** Extend compare panel state with local branch options and resolved defaults, add a small Git helper to list local branches/current branch, and render branch-mode-specific `<select>` controls in the compare webview. Keep commit mode behavior unchanged.

**Tech Stack:** TypeScript, VS Code extension API, local Git CLI, Mocha, existing compare panel/webview templates

---

### Task 1: Add Local Branch Dropdown Data Flow

**Files:**
- Modify: `src/git/compare.ts`
- Modify: `src/ui/comparePanel.ts`
- Modify: `src/webview/compareTemplates.ts`
- Modify: `src/types.ts`
- Test: `src/test/compare.test.ts`

- [ ] **Step 1: Write failing tests**

Cover:
- branch-mode compare state carries local branch options and defaults
- compare template renders branch `<select>` controls instead of commit inputs in branch mode
- commit mode still renders manual base/head inputs

- [ ] **Step 2: Run targeted tests and confirm they fail**

Run: `pnpm test -- --grep "Compare Primitives Test Suite"`
Expected: FAIL for missing branch dropdown state/template behavior.

- [ ] **Step 3: Implement minimal branch dropdown flow**

Implement:
- local branch listing helper in `src/git/compare.ts`
- compare panel state fields for branch options
- branch-mode initialization that loads local branches and default selections
- compare template rendering for branch selects and message handling

- [ ] **Step 4: Re-run tests**

Run: `pnpm test -- --grep "Compare Primitives Test Suite"`
Expected: PASS

- [ ] **Step 5: Run full verification**

Run:
- `pnpm run compile`
- `pnpm run lint`
- `pnpm test`

Expected: all green
