import type { AnalysisDateRangePreset } from '../analysis/dateRange';

type CachedRangeStats = {
  generatedAt: string;
  generatedAtMs?: number;
  rangePreset: AnalysisDateRangePreset;
};

export type RangeRefreshDecision = {
  preset: AnalysisDateRangePreset;
  useCached: boolean;
  waitForInFlight: boolean;
  rerunAfterInFlight: boolean;
};

export function decideRangeRefresh(input: {
  requestedPreset?: AnalysisDateRangePreset;
  latestPreset: AnalysisDateRangePreset;
  latestStats?: CachedRangeStats;
  inFlightPreset?: AnalysisDateRangePreset;
  maxAgeMs: number;
  force?: boolean;
  now?: number;
}): RangeRefreshDecision {
  const preset = input.requestedPreset ?? input.latestPreset;
  if (input.inFlightPreset) {
    return {
      preset,
      useCached: false,
      waitForInFlight: true,
      rerunAfterInFlight: input.inFlightPreset !== preset
    };
  }

  const shouldReuseCached =
    !input.force &&
    input.latestStats?.rangePreset === preset &&
    isFresh(input.latestStats.generatedAt, input.latestStats.generatedAtMs, input.maxAgeMs, input.now);

  return {
    preset,
    useCached: shouldReuseCached,
    waitForInFlight: false,
    rerunAfterInFlight: false
  };
}

function isFresh(generatedAt: string, generatedAtMs: number | undefined, maxAgeMs: number, now = Date.now()): boolean {
  const generatedAtTimestamp =
    typeof generatedAtMs === 'number' && Number.isFinite(generatedAtMs)
      ? generatedAtMs
      : new Date(generatedAt).getTime();
  if (!Number.isFinite(generatedAtTimestamp)) {
    return false;
  }

  return now - generatedAtTimestamp <= maxAgeMs;
}
