# Dashboard Motion Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 提升 Dashboard、空态页和 Compare 页的动画质感，让界面更克制高级且更有科技光泽。

**Architecture:** 保持现有 `template/shell + dashboard runtime + shared CSS` 结构，在模板中添加少量状态和动效挂钩，在 `dashboard.js` 中统一动画节奏与交互反馈，在 `macos26.css` 中补充环境光、悬浮高光和图表 reveal 样式。

**Tech Stack:** TypeScript, VS Code Webview, GSAP, CSS

---

### Task 1: 补充模板层的动效挂钩测试

**Files:**
- Modify: `src/test/extension.test.ts`
- Modify: `src/test/compare.test.ts`

- [ ] 为 empty state 增加新的动效挂钩断言
- [ ] 为 compare state 增加新的状态 class / 动效挂钩断言
- [ ] 运行相关测试并确认先失败

### Task 2: 升级空态页和 Compare 模板输出

**Files:**
- Modify: `src/webview/templates.ts`
- Modify: `src/webview/compareTemplates.ts`
- Test: `src/test/extension.test.ts`
- Test: `src/test/compare.test.ts`

- [ ] 给空态页增加环境光和 surface 类名
- [ ] 给 Compare 根节点增加状态类和视觉挂钩
- [ ] 调整内联 GSAP 时间线，使 intro 更连贯
- [ ] 运行相关测试并确认通过

### Task 3: 升级 shared CSS 视觉层次

**Files:**
- Modify: `media/webview/macos26.css`

- [ ] 增加环境光、扫光和 hover glow 样式
- [ ] 增强 card/panel/topbar/compare row 的交互层次
- [ ] 增加 chart reveal、loading sheen 与 reduced motion 降级

### Task 4: 升级 dashboard runtime 动画节奏与联动

**Files:**
- Modify: `media/webview/dashboard.js`

- [ ] 抽取 surface glow / pointer tracking 逻辑
- [ ] 统一 intro timeline、section focus、chart reveal 节奏
- [ ] 增强菜单、导航跳转和数字动画细节

### Task 5: 完整验证

**Files:**
- Verify only

- [ ] Run `pnpm test -- --runInBand`
- [ ] Run `pnpm run compile`
- [ ] Run `pnpm run lint`
