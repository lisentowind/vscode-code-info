# Dashboard Motion Refresh Design

**Context**

Code Info 的 webview 已经有基础的 GSAP 入场、数字滚动和列表 reveal，但当前动画更像多个零散效果的叠加，缺少统一节奏、层次递进和更精致的悬浮反馈。

**Goal**

在不改变信息架构的前提下，把 Dashboard、空态页和 Compare 页升级成更克制高级的动效风格：强化玻璃感、柔和光影、数据点亮感和交互层次，同时保持 VS Code 内的可读性与性能。

**Design Direction**

- 基调以“克制高级”为主，避免强烈位移和夸张 3D。
- 科技感来自柔和流光、边缘高光、图表点亮和状态过渡，而不是大面积特效。
- 动画统一以 `transform`、`opacity`、`filter` 为主，减少布局抖动。
- 保留 `prefers-reduced-motion` 降级路径。

**Experience Changes**

1. 全局氛围

- 为 dashboard/compare/empty state 增加环境光层和缓慢漂移的背景光晕。
- 强化 topbar、panel、card 的玻璃层次和边缘高光。

2. 交互反馈

- 给卡片、panel、导航项、compare 行增加基于鼠标位置的柔和径向高光。
- 强化 hover/focus 态，让元素从“轻微上浮”升级为“轻微提亮 + 边缘变亮 + 阴影抬升”。
- 优化 section 跳转后的聚焦反馈，形成更明确的阅读落点。

3. 数据表现

- 统一 dashboard 的 intro timeline：先容器、再数据卡片、再列表和图表。
- 图表容器在 ready 后增加 reveal，避免从空白到完整渲染的硬切。
- 数值滚动、bar fill、stack fill 的时间曲线保持一致，形成“数据被点亮”的感觉。

4. Compare 体验

- Compare 页增加状态 class，区分 idle/loading/success/error 的视觉氛围。
- loading banner 增加轻微流动质感。
- 文件变化和 delta 列表增加更清晰的 hover 层次与聚焦边缘。

5. 空态页

- 空态插画增加更柔和的环境光和轻微漂浮节奏。
- 步骤卡片与操作按钮的入场改为单条时间线，形成更像启动台的欢迎感。

**Implementation Notes**

- 样式主要集中在 `media/webview/macos26.css`。
- Dashboard 运行时动画主要集中在 `media/webview/dashboard.js`。
- 空态与 Compare 页通过模板内联脚本补充轻量 runtime。
- 通过少量 DOM class / data attribute 让 CSS 和 JS 联动，不重构页面结构。

**Verification**

- 更新 HTML 模板测试，验证新的状态 class 和动效挂钩已注入。
- 运行 compile、lint、test 进行完整验证。
