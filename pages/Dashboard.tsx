import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '@/lib/api';
import type { DashboardSummary } from '@/lib/dashboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';

const COLORS = ['#22c55e', '#ef4444', '#94a3b8', '#eab308'];

export default function DashboardPage() {
  const { id } = useParams<{ id: string }>();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(false);
    api.getDashboard(id!).then(data => { if (active) setSummary(data); })
      .catch(() => { if (active) setLoadError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);
  if (loading) return <div className="p-8 text-center text-muted-foreground">加载中...</div>;
  if (loadError || !summary) return <div role="alert" className="p-8 text-center">统计加载失败，请重试。</div>;
  const stats = summary;
  const statusData = [
    { name: '通过', value: stats.passed }, { name: '失败', value: stats.failed },
    { name: '跳过', value: stats.skipped }, { name: '阻塞', value: stats.blocked },
  ].filter(d => d.value > 0);
  const { priorityData, trendData, durationData, topFailed } = summary;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">数据看板</h1>
        <p className="text-sm text-muted-foreground">项目测试数据多维度分析</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5 text-center">
            <p className="text-3xl font-bold text-green-600">{stats.passRate}%</p>
            <p className="text-xs text-muted-foreground mt-1">总通过率</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 text-center">
            <p className="text-3xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground mt-1">总执行次数</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 text-center">
            <p className="text-3xl font-bold text-red-600">{stats.openDefects}</p>
            <p className="text-xs text-muted-foreground mt-1">活跃缺陷</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 text-center">
            <p className="text-3xl font-bold">{(stats.totalDuration / 1000).toFixed(1)}s</p>
            <p className="text-xs text-muted-foreground mt-1">总执行耗时</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">通过率趋势（近7天）</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} unit="%" />
                <Tooltip />
                <Line type="monotone" dataKey="passRate" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} name="通过率" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">状态分布</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">优先级分布</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={priorityData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="passed" fill="#22c55e" name="通过" radius={[2, 2, 0, 0]} />
                <Bar dataKey="failed" fill="#ef4444" name="失败" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">执行耗时分布</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={durationData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#6366f1" name="次数" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {topFailed.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">失败 Top 5</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topFailed.map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                  <span className="text-xs font-bold text-red-500 w-6">{i + 1}</span>
                  <span className="text-sm flex-1 truncate">{item.name}</span>
                  <span className="text-xs text-muted-foreground">{item.failCount}/{item.total} 次失败</span>
                  <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-red-500 rounded-full" style={{ width: `${item.total > 0 ? (item.failCount / item.total) * 100 : 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
