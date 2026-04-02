export type AnalysisDateRangePreset = 'today' | 'last7Days' | 'last30Days';

export type AnalysisDateRange = {
  preset: AnalysisDateRangePreset;
  label: string;
  start: Date;
  end: Date;
};

export function createPresetDateRange(
  preset: AnalysisDateRangePreset,
  reference: Date = new Date()
): AnalysisDateRange {
  const end = endOfLocalDay(reference);

  switch (preset) {
    case 'today':
      return {
        preset,
        label: '今天',
        start: startOfLocalDay(reference),
        end
      };
    case 'last7Days':
      return {
        preset,
        label: '最近 7 天',
        start: shiftLocalDays(startOfLocalDay(reference), -6),
        end
      };
    case 'last30Days':
      return {
        preset,
        label: '最近 30 天',
        start: shiftLocalDays(startOfLocalDay(reference), -29),
        end
      };
  }
}

export function formatDateRangeLabel(start: Date, end: Date): string {
  const startLabel = formatLocalDate(start);
  const endLabel = formatLocalDate(end);
  return startLabel === endLabel ? startLabel : `${startLabel} ~ ${endLabel}`;
}

function startOfLocalDay(value: Date): Date {
  const result = new Date(value);
  result.setHours(0, 0, 0, 0);
  return result;
}

function endOfLocalDay(value: Date): Date {
  const result = new Date(value);
  result.setHours(23, 59, 59, 999);
  return result;
}

function shiftLocalDays(value: Date, days: number): Date {
  const result = new Date(value);
  result.setDate(result.getDate() + days);
  return result;
}

function formatLocalDate(value: Date): string {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}
