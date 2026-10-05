import type { DashboardStats } from './stats';
export interface DashboardSummary extends DashboardStats {
  priorityData: { name: string; passed: number; failed: number; total: number }[];
  trendData: { date: string; passRate: number; count: number }[];
  durationData: { range: string; count: number }[];
  topFailed: { name: string; failCount: number; total: number }[];
}
