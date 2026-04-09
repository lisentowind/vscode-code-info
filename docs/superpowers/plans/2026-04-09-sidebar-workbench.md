# Sidebar Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把侧边栏重构成适合个人开发者常驻使用的工作台式 UI，同时保持详情页完整看板不变。

**Architecture:** 保留统一 dashboard runtime，但让 `presentation.compact` 走独立的 sidebar workbench 渲染分支。数据层尽量复用现有 payload，只重组展示结构和 compact 样式。

**Tech Stack:** TypeScript, VS Code Webview, plain JS runtime, CSS, Mocha

---

### Task 1: 用测试锁定新的侧边栏工作台结构

**Files:**
- Modify: `src/test/extension.test.ts`
- Test: `src/test/extension.test.ts`

- [ ] **Step 1: 写失败测试，约束 compact runtime 包含独立 sidebar workbench 标识**
- [ ] **Step 2: 写失败测试，约束 compact runtime 包含当前状态 / 今日该看什么 / 项目速读 等侧边栏区块文案**
- [ ] **Step 3: 写失败测试，约束 compact runtime 暴露高频操作入口**
- [ ] **Step 4: 运行聚焦测试并确认失败**

### Task 2: 重构 compact runtime 的布局分支

**Files:**
- Modify: `media/webview/dashboard.js`

- [ ] **Step 1: 提取 compact 专用渲染函数，不影响 full dashboard 分支**
- [ ] **Step 2: 实现当前状态摘要区**
- [ ] **Step 3: 实现变更概览 / 待办热点 / 快速入口区**
- [ ] **Step 4: 实现项目速读摘要区**
- [ ] **Step 5: 重新运行聚焦测试并确认通过**

### Task 3: 调整侧边栏文案与样式

**Files:**
- Modify: `src/ui/sidebar.ts`
- Modify: `media/webview/macos26.css`
- Modify: `src/webview/templates.ts`

- [ ] **Step 1: 更新侧边栏标题与副标题，让其匹配工作台定位**
- [ ] **Step 2: 新增 compact sidebar workbench 样式，避免复用详情页布局**
- [ ] **Step 3: 校准空态文案，让其更贴近工作台入口**
- [ ] **Step 4: 运行相关测试确认没有回归**

### Task 4: 全量验证与收尾

**Files:**
- Modify: `src/test/extension.test.ts`

- [ ] **Step 1: 运行全量测试**
- [ ] **Step 2: 检查侧边栏和详情页职责是否清晰分离**
- [ ] **Step 3: 总结后续可继续增强的 sidebar 迭代点**
