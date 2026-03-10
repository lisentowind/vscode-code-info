# Code Info

一个 VS Code 插件项目，用来扫描当前工作区并可视化展示代码统计信息。

## 已实现功能

- 工作区代码统计：文件总数、总行数、代码行、注释行、空行、体积
- 更精确的多语言注释识别：支持行内块注释、避免字符串内注释误判（近似解析）
- 语言分布分析：按语言聚合文件数、总代码量和体积
- 最大文件排行：快速定位体量最大的文件
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
- 点击左侧 Activity Bar 的 `Code Info` 图标查看侧边栏概览
- 在看板或侧边栏中点击按钮导出 `JSON` / `CSV`
- 如果工作区是 Git 仓库，会自动展示最近 12 周提交趋势

## 设计说明

- 基于官方扩展结构，入口文件为 `src/extension.ts`
- 使用 `vscode.workspace.findFiles` 扫描工作区文件
- 使用 `WebviewPanel` 实现详细 Dashboard
- 使用 `WebviewViewProvider` 实现侧边栏视图
- 内置纯前端图表，不依赖外部 CDN，方便本地调试和打包
- Git 趋势通过本地 `git log` 获取，不上传代码内容

## 后续可继续增强

- 按目录维度统计模块规模
- 增加测试覆盖率、TODO 数量等工程指标
- 支持基于语法树/语法高亮的注释解析（进一步提升准确度）
- 支持导出 HTML 报告
