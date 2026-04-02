# Code Info

一个 VS Code 插件项目，用来扫描当前工作区并可视化展示代码统计信息。

## 已实现功能

- 工作区代码统计：文件总数、总行数、代码行、注释行、空行、体积
- 范围统计分析：切到插件时默认自动刷新当天新增/修改文件，也可手动切换到最近 7 天 / 最近 30 天；若是 Git 仓库，会补充对应时间范围内提交的删文件与增删行统计
- 更精确的多语言注释识别：支持行内块注释、避免字符串内注释误判（近似解析）
- 语言分布分析：按语言聚合文件数、总代码量和体积
- 模块/目录分布：按顶层或多级目录聚合代码规模，快速识别核心模块
- 模块目录树：按目录层级展开查看代码量聚合情况
- 最大文件排行：快速定位体量最大的文件
- TODO / FIXME / HACK 热点：定位待办最密集的文件
- 项目洞察：平均文件规模、注释密度、主力语言占比、待办密度
- 可视化 Dashboard：在编辑区展示完整统计看板
- 侧边栏 Overview：在 Activity Bar 中随时查看概览
- 导出能力：支持导出 `JSON` 和 `CSV`
- Git 趋势：展示最近 12 周提交趋势和贡献者 Top 5

## 开发启动

```bash
npm install
npm run compile
```

然后在 VS Code 中打开本项目，按 `F5` 启动 Extension Development Host。

## 使用方式

- 命令面板执行 `Code Info: Analyze Workspace`
- 命令面板执行 `Code Info: Refresh Today Stats` 可手动刷新今日统计
- 命令面板执行 `Code Info: Refresh Last 7 Days Stats` 可查看最近 7 天范围统计
- 命令面板执行 `Code Info: Refresh Last 30 Days Stats` 可查看最近 30 天范围统计
- 如需只分析部分目录：执行 `Code Info: Select Analysis Directories`，或在设置里配置 `codeInfo.analysis.directories`
- 点击左侧 Activity Bar 的 `Code Info` 图标查看侧边栏概览
- 在看板或侧边栏中点击按钮导出 `JSON` / `CSV`
- 在看板表格中点击文件名可直接跳转到对应源码
- 如果工作区是 Git 仓库，会自动展示最近 12 周提交趋势

## 设计说明

- 基于官方扩展结构，入口文件为 `src/extension.ts`
- 使用 `vscode.workspace.findFiles` 扫描工作区文件
- 分析器采用分批并发读取、按行流式处理文本，减少大仓库统计时的内存分配
- 范围统计仅在插件视图可见时刷新，并且只读取对应时间范围内触达文件的内容，避免实时全量分析
- 使用 `WebviewPanel` 实现详细 Dashboard
- 使用 `WebviewViewProvider` 实现侧边栏视图
- 内置纯前端图表，不依赖外部 CDN，方便本地调试和打包
- Git 趋势通过本地 `git log` 获取，不上传代码内容

## 后续可继续增强

- 按目录维度统计模块规模
- 增加测试覆盖率、TODO 数量等工程指标
- 支持基于语法树/语法高亮的注释解析（进一步提升准确度）
- 支持导出 HTML 报告
