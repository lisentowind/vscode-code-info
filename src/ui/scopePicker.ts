import * as vscode from 'vscode';
import * as path from 'node:path';
import { getAnalysisDirectoriesSetting, updateAnalysisDirectoriesSetting } from '../config/settings';
import { normalizeDirectorySettingEntry } from '../analysis/scope';
import type { Logger } from '../types';

export async function selectAnalysisDirectories(logger?: Logger): Promise<void> {
  const folders = vscode.workspace.workspaceFolders;

  if (!folders || folders.length === 0) {
    void vscode.window.showWarningMessage('Code Info: 请先打开一个工作区再选择分析目录。');
    return;
  }

  const current = getAnalysisDirectoriesSetting();
  const currentSet = new Set(current);
  const multiRoot = folders.length > 1;

  const scopedFolderNames = new Set(folders.map((folder) => folder.name));
  const topLevelDirsPerFolder = await Promise.all(
    folders.map(async (folder) => {
      try {
        const entries = await vscode.workspace.fs.readDirectory(folder.uri);
        const dirs = entries
          .filter(([, type]) => type === vscode.FileType.Directory)
          .map(([name]) => name)
          .filter((name) => name !== '.git' && name !== 'node_modules')
          .sort((left, right) => left.localeCompare(right, 'en'));
        return { folder, dirs };
      } catch {
        return { folder, dirs: [] as string[] };
      }
    })
  );

  type PickItem = vscode.QuickPickItem & { value: string };
  const items: PickItem[] = [
    {
      label: '$(root-folder) 分析全工作区（默认）',
      description: '清空目录限制',
      value: '__ALL__',
      picked: current.length === 0
    },
    {
      label: '$(folder-opened) 从文件系统选择文件夹…',
      description: '可选择任意层级目录（必须在工作区内）',
      value: '__BROWSE__'
    },
    {
      label: '$(pencil) 自定义输入目录…',
      description: "支持逗号分隔；多根工作区可用 'workspaceFolderName:dir'",
      value: '__CUSTOM__'
    }
  ];

  for (const { folder, dirs } of topLevelDirsPerFolder) {
    for (const dir of dirs) {
      const value = multiRoot ? `${folder.name}:${dir}` : dir;
      items.push({
        label: multiRoot ? `${folder.name} · ${dir}` : dir,
        description: multiRoot ? undefined : `/${dir}`,
        value,
        picked: currentSet.has(value) || (!multiRoot && currentSet.has(`${folder.name}:${dir}`))
      });
    }
  }

  const picked = await vscode.window.showQuickPick(items, {
    canPickMany: true,
    matchOnDescription: true,
    placeHolder: '选择要分析的目录（不选或选择“全工作区”表示分析整个工作区）'
  });

  if (!picked) {
    return;
  }

  if (picked.some((item) => item.value === '__ALL__') || picked.length === 0) {
    await updateAnalysisDirectoriesSetting([]);
    void vscode.window.showInformationMessage('Code Info: 已设置为分析整个工作区。');
    return;
  }

  const values = new Set<string>();
  const needsBrowse = picked.some((item) => item.value === '__BROWSE__');
  const needsCustom = picked.some((item) => item.value === '__CUSTOM__');

  for (const item of picked) {
    if (item.value === '__CUSTOM__' || item.value === '__BROWSE__') {
      continue;
    }
    values.add(item.value);
  }

  if (needsBrowse) {
    const selected = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: true,
      openLabel: '选择要分析的目录',
      defaultUri: folders[0]?.uri
    });

    if (selected) {
      for (const uri of selected) {
        const wsFolder = vscode.workspace.getWorkspaceFolder(uri);
        if (!wsFolder) {
          continue;
        }

        const relative = path.relative(wsFolder.uri.fsPath, uri.fsPath);
        const normalized = relative.replace(/\\/g, '/');
        if (!normalized || normalized === '.') {
          continue;
        }

        values.add(multiRoot ? `${wsFolder.name}:${normalized}` : normalized);
      }
    }
  }

  if (needsCustom) {
    const input = await vscode.window.showInputBox({
      prompt: "输入要分析的目录（相对工作区根目录），多个用逗号分隔。多根工作区可用 'workspaceFolderName:dir'。",
      placeHolder: multiRoot ? 'client:src, server:src, shared' : 'src, packages/app'
    });

    if (input) {
      for (const part of input.split(',')) {
        const trimmed = part.trim();
        if (trimmed) {
          values.add(trimmed);
        }
      }
    }
  }

  const normalized = [...values]
    .map((value) => normalizeDirectorySettingEntry(value, scopedFolderNames))
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => left.localeCompare(right, 'en'));

  await updateAnalysisDirectoriesSetting(normalized);

  const summary = normalized.length ? normalized.join(', ') : '全工作区';
  logger?.appendLine(`Updated analysis directories: ${summary}`);
  void vscode.window.showInformationMessage(`Code Info: 已更新分析目录：${summary}`);
}
