export type ParsedDirectoryEntry = {
  scopeFolderName?: string;
  directory: string;
};

export function normalizeDirectory(value: string): string {
  const cleaned = value.replace(/\\/g, '/').trim();
  if (!cleaned) {
    return '';
  }

  const withoutLeading = cleaned.replace(/^\.?\//, '').replace(/^\/+/, '');
  const withoutTrailing = withoutLeading.replace(/\/+$/, '');
  return withoutTrailing === '.' ? '' : withoutTrailing;
}

export function normalizeDirectorySettingEntry(value: string, folderNames: Set<string>): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const colonIndex = trimmed.indexOf(':');
  if (colonIndex > 0) {
    const scope = trimmed.slice(0, colonIndex).trim();
    const directory = trimmed.slice(colonIndex + 1).trim();
    if (folderNames.has(scope)) {
      const normalizedDir = normalizeDirectory(directory);
      if (!normalizedDir) {
        return undefined;
      }
      return `${scope}:${normalizedDir}`;
    }
  }

  const normalized = normalizeDirectory(trimmed);
  return normalized || undefined;
}

export function parseAnalysisDirectories(
  entries: string[],
  folderNames: Set<string>
): { globalDirectories: string[]; scopedDirectories: Map<string, string[]> } {
  const globalDirectories: string[] = [];
  const scopedDirectories = new Map<string, string[]>();

  for (const raw of entries) {
    const trimmed = raw.trim();
    if (!trimmed) {
      continue;
    }

    const parsed = parseDirectoryEntry(trimmed, folderNames);
    if (!parsed) {
      continue;
    }

    if (parsed.scopeFolderName) {
      const list = scopedDirectories.get(parsed.scopeFolderName) ?? [];
      list.push(parsed.directory);
      scopedDirectories.set(parsed.scopeFolderName, list);
    } else {
      globalDirectories.push(parsed.directory);
    }
  }

  return {
    globalDirectories: dedupeAndSort(globalDirectories),
    scopedDirectories: new Map(
      [...scopedDirectories.entries()].map(([name, dirs]) => [name, dedupeAndSort(dirs)])
    )
  };
}

export function parseDirectoryEntry(value: string, folderNames: Set<string>): ParsedDirectoryEntry | undefined {
  const colonIndex = value.indexOf(':');
  if (colonIndex > 0) {
    const scope = value.slice(0, colonIndex).trim();
    const directory = normalizeDirectory(value.slice(colonIndex + 1));
    if (folderNames.has(scope) && directory) {
      return { scopeFolderName: scope, directory };
    }

    if (folderNames.has(scope)) {
      return undefined;
    }
  }

  const directory = normalizeDirectory(value);
  if (!directory) {
    return undefined;
  }

  return { directory };
}

export function dedupeAndSort(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right, 'en'));
}

