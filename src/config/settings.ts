import * as vscode from 'vscode';

const CONFIG_SECTION = 'codeInfo';
const CONFIG_ANALYSIS_DIRECTORIES = 'analysis.directories';

export function getAnalysisDirectoriesSetting(): string[] {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  const value = config.get<unknown>(CONFIG_ANALYSIS_DIRECTORIES);
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function updateAnalysisDirectoriesSetting(value: string[]): Promise<void> {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  await config.update(CONFIG_ANALYSIS_DIRECTORIES, value, vscode.ConfigurationTarget.Workspace);
}

