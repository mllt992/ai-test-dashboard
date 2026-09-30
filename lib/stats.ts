import type { TestCase, TestResult, Defect } from '@/lib/types';

export interface DashboardStats {
  caseCount: number;
  passRate: number;
  openDefects: number;
  passed: number;
  failed: number;
  skipped: number;
  blocked: number;
  total: number;
  totalDuration: number;
  planCount: number;
  failedCount: number;
  recentResults: TestResult[];
}

export function computeDashboardStats(
  cases: TestCase[],
  results: TestResult[],
  defects: Defect[],
  planCount?: number,
): DashboardStats {
  const passed = cases.filter(c => c.status === 'passed').length;
  const failed = cases.filter(c => c.status === 'failed').length;
  const skipped = cases.filter(c => c.status === 'skipped').length;
  const blocked = cases.filter(c => c.status === 'blocked').length;
  const total = cases.length;
  const passRate = total > 0 ? Math.round((passed / total) * 1000) / 10 : 0;
  const openDefects = defects.filter(d =>
    d.status !== 'closed' && d.status !== 'verified'
  ).length;
  const totalDuration = results.reduce((s, r) => s + (r.durationMs || 0), 0);

  return {
    caseCount: total,
    passRate,
    openDefects,
    passed,
    failed,
    skipped,
    blocked,
    total,
    totalDuration,
    planCount: planCount ?? 0,
    failedCount: failed,
    recentResults: [...results]
      .sort((a, b) => (b.executedAt || '').localeCompare(a.executedAt || ''))
      .slice(0, 20),
  };
}
