import { store } from '@/lib/store';
import { useAuth, useProject } from '@/store/context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Link } from 'react-router-dom';
import { FolderOpen, FlaskConical, CheckCircle2, XCircle, Bug, Clock } from 'lucide-react';

export default function OverviewPage() {
  const { user } = useAuth();
  const projects = store.getProjects();
  const allStats = projects.map(p => ({ project: p, stats: store.getDashboardStats(p.id) }));

  const totalCases = allStats.reduce((s, x) => s + x.stats.caseCount, 0);
  const totalPassed = allStats.reduce((s, x) => s + x.stats.passed, 0);
  const totalFailed = allStats.reduce((s, x) => s + x.stats.failed, 0);
  const totalDefects = allStats.reduce((s, x) => s + x.stats.openDefects, 0);
  const overallRate = totalCases > 0 ? Math.round((totalPassed / (totalPassed + totalFailed)) * 1000) / 10 : 0;

  const statCards = [
    { label: '项目总数', value: projects.length, icon: FolderOpen, iconColor: 'text-blue-600', bgLight: 'bg-blue-50' },
    { label: '测试用例', value: totalCases, icon: FlaskConical, iconColor: 'text-violet-600', bgLight: 'bg-violet-50' },
    { label: '通过率', value: `${overallRate}%`, icon: CheckCircle2, iconColor: 'text-emerald-600', bgLight: 'bg-emerald-50' },
    { label: '失败用例', value: totalFailed, icon: XCircle, iconColor: 'text-rose-600', bgLight: 'bg-rose-50' },
    { label: '活跃缺陷', value: totalDefects, icon: Bug, iconColor: 'text-orange-600', bgLight: 'bg-orange-50' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">全局概览</h1>
        <p className="text-sm text-muted-foreground mt-1.5">欢迎回来，{user?.username}。以下是所有项目的汇总数据。</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {statCards.map(s => (
          <Card key={s.label} className="overflow-hidden border-0 shadow-md hover:shadow-lg transition-shadow duration-200">
            <CardContent className="pt-5 pb-4 px-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">{s.label}</p>
                  <p className="text-2xl font-bold mt-1.5 tracking-tight">{s.value}</p>
                </div>
                <div className={`h-10 w-10 rounded-xl ${s.bgLight} flex items-center justify-center`}>
                  <s.icon className={`h-5 w-5 ${s.iconColor}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="shadow-md border-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">项目状态</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {allStats.map(({ project: p, stats }) => (
              <Link key={p.id} to={`/p/${p.id}/overview`} className="block hover:bg-muted/40 rounded-xl p-4 -mx-3 transition-colors group">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-sm group-hover:text-foreground transition-colors">{p.name}</span>
                  <Badge variant={p.status === 'active' ? 'default' : 'secondary'} className="text-[10px] font-medium">
                    {p.status === 'active' ? '活跃' : '已归档'}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="font-medium">{stats.caseCount} 用例</span>
                  <span className="font-medium">通过率 {stats.passRate}%</span>
                  <span className="ml-auto font-medium">{stats.openDefects} 缺陷</span>
                </div>
                <Progress value={stats.passRate} className="mt-2.5 h-1.5" />
              </Link>
            ))}
            {allStats.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">暂无项目</p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-md border-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">最近执行</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {allStats.flatMap(x => x.stats.recentResults.map(r => ({ ...r, projectName: x.project.name, projectId: x.project.id })))
              .sort((a, b) => b.executedAt.localeCompare(a.executedAt))
              .slice(0, 8)
              .map(r => {
                const tc = store.getTestCase(r.caseId);
                return (
                  <div key={r.id} className="flex items-center gap-3 text-xs py-2 px-2 rounded-lg hover:bg-muted/30 transition-colors">
                    {r.status === 'passed' ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" /> :
                     r.status === 'failed' ? <XCircle className="h-4 w-4 text-rose-500 shrink-0" /> :
                     <Clock className="h-4 w-4 text-gray-400 shrink-0" />}
                    <span className="truncate flex-1 font-medium">{tc?.name ?? '未知用例'}</span>
                    <span className="text-muted-foreground tabular-nums">{r.durationMs}ms</span>
                  </div>
                );
              })}
            {totalCases === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">暂无执行记录</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
