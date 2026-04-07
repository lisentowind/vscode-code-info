# GSAP UI Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Code Info 的空态页、Dashboard 和变更对比页接入本地 GSAP 动画，提升整体动效表现，同时保持插件可读性与性能可控。

**Architecture:** 继续沿用当前 `webview shell + runtime script` 的结构，把 GSAP 当作本地静态资源注入到 webview。Dashboard 动画放到 `media/webview/dashboard.js`，空态和 compare 页先通过内联脚本接入，再配合 CSS 增强层次感和 hover 微交互。

**Tech Stack:** VS Code Webview, TypeScript, 本地 vendor JS, GSAP, CSS transitions

---

### Task 1: 给 Webview 资源层增加 GSAP 注入能力

**Files:**
- Modify: `src/webview/dashboardShell.ts`
- Modify: `src/ui/sidebar.ts`
- Modify: `src/ui/panels.ts`
- Modify: `src/ui/comparePanel.ts`
- Test: `src/test/extension.test.ts`
- Test: `src/test/compare.test.ts`

### Task 2: 接入 GSAP 资源文件并验证注入

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create/Update: `media/vendor/gsap.min.js`

### Task 3: 给 Dashboard 和空态页增加入场与交互动画

**Files:**
- Modify: `media/webview/dashboard.js`
- Modify: `src/webview/templates.ts`
- Modify: `media/webview/macos26.css`
- Test: `src/test/extension.test.ts`

### Task 4: 给 Compare 页增加入场与状态切换动画

**Files:**
- Modify: `src/webview/compareTemplates.ts`
- Modify: `media/webview/macos26.css`
- Test: `src/test/compare.test.ts`

### Task 5: 完整验证

**Files:**
- Verify only

- [ ] Run `pnpm run compile`
- [ ] Run `pnpm run lint`
- [ ] Run `pnpm test`
