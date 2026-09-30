import { useParams } from 'react-router-dom';
import { store } from '@/lib/store';
import { useProject } from '@/store/context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Link } from 'react-router-dom';
import { CheckCircle2, XCircle, Clock, SkipForward, Bug, FlaskConical, ClipboardList, Timer } from 'lucide-react';

export default function ProjectOverviewPage() {
  const { id } = useParams<{ id: string }>();
  const { currentProject } = useProject();
  const project = currentProject?.id === id ? currentProject : store.getProject(id!);
  if (!project) return <div className="p-8 text-center text-muted-foreground">项目不存在</div>;

  const stats = store.getDashboardStats(project.id);
  const plans = store.getTestPlans(project.id);
  const defects = store.getDefects(project.id);

  const severityColor = (s: string) => {
    switch (s) {
      case 'critical': return 'bg-red-50 text-red-600 ring-1 ring-red-200';
      case 'major': return 'bg-orange-50 text-orange-600 ring-1 ring-orange-200';
      case 'minor': return 'bg-yellow-50 text-yellow-600 ring-1 ring-yellow-200';
      default: return 'bg-gray-50 text-gray-600 ring-1 ring-gray-200';
    }
  };

  const statCards = [
    { label: '测试计划', value: stats.planCount, icon: ClipboardList, iconColor: 'text-blue-600', bgLight: 'bg-blue-50' },
    { label: '测试用例', value: stats.caseCount, icon: FlaskConical, iconColor: 'text-violet-600', bgLight: 'bg-violet-50' },
    { label: '通过率', value: `${stats.passRate}%`, icon: CheckCircle2, iconColor: 'text-emerald-600', bgLight: 'bg-emerald-50' },
    { label: '失败用例', value: stats.failedCount, icon: XCircle, iconColor: 'text-rose-600', bgLight: 'bg-rose-50' },
    { label: '总耗时', value: `${(stats.totalDuration / 1000).toFixed(1)}s`, icon: Timer, iconColor: 'text-cyan-600', bgLight: 'bg-cyan-50' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
          {project.description && <p className="text-sm text-muted-foreground mt-1.5">{project.description}</p>}
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="text-xs font-medium">{project.status === 'active' ? '活跃' : '已归档'}</Badge>
          {project.tags.map(t => <Badge key={t} variant="secondary" className="text-xs font-medium">{t}</Badge>)}
        </div>
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

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-md border-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">用例状态分布</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { label: '通过', count: stats.passed, total: stats.total, color: 'bg-emerald-500' },
                { label: '失败', count: stats.failed, total: stats.total, color: 'bg-rose-500' },
                { label: '跳过', count: stats.skipped, total: stats.total, color: 'bg-gray-400' },
                { label: '阻塞', count: stats.blocked, total: stats.total, color: 'bg-amber-500' },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-3">
                  <span className="text-xs w-8 text-muted-foreground font-medium">{item.label}</span>
                  <div className="flex-1 h-7 bg-muted/60 rounded-lg overflow-hidden">
                    <div className={`h-full ${item.color} rounded-lg transition-all duration-500`} style={{ width: `${item.total > 0 ? (item.count / item.total) * 100 : 0}%` }} />
                  </div>
                  <span className="text-xs font-semibold w-8 text-right tabular-nums">{item.count}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 pt-4 border-t">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground font-medium">总通过率</span>
                <span className="font-bold text-xl tabular-nums">{stats.passRate}%</span>
              </div>
              <Progress value={stats.passRate} className="mt-2.5 h-2.5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md border-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">活跃缺陷</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {defects.filter(d => d.status !== 'closed' && d.status !== 'verified').slice(0, 5).map(d => (
              <Link key={d.id} to={`/p/${project.id}/defects`} className="block p-2.5 -mx-2 rounded-lg hover:bg-muted/40 transition-colors group">
                <div className="flex items-center gap-2.5">
                  <Bug className="h-4 w-4 text-rose-500 shrink-0" />
                  <span className="text-xs font-medium truncate flex-1 group-hover:text-foreground transition-colors">{d.title}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium shrink-0 ${severityColor(d.severity)}`}>{d.severity}</span>
                </div>
              </Link>
            ))}
            {defects.filter(d => d.status !== 'closed' && d.status !== 'verified').length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6">暂无活跃缺陷</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-md border-0">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">测试计划</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {plans.map(plan => {
              const cases = store.getTestCasesByPlan(plan.id);
              const passed = cases.filter(c => c.status === 'passed').length;
              return (
                <Link key={plan.id} to={`/p/${project.id}/plans`} className="block p-4 -mx-3 rounded-xl hover:bg-muted/40 transition-colors group">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold group-hover:text-foreground transition-colors">{plan.title}</span>
                    <Badge variant={plan.status === 'completed' ? 'default' : plan.status === 'in_progress' ? 'secondary' : 'outline'} className="text-[10px] font-medium">
                      {plan.status === 'draft' ? '草稿' : plan.status === 'ready' ? '就绪' : plan.status === 'in_progress' ? '进行中' : '已完成'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="font-medium">{cases.length} 用例</span>
                    <span className="font-medium">{passed}/{cases.length} 通过</span>
                    <div className="flex-1"><Progress value={cases.length > 0 ? (passed / cases.length) * 100 : 0} className="h-1.5" /></div>
                  </div>
                </Link>
              );
            })}
            {plans.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">暂无测试计划</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
