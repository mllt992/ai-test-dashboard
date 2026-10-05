import { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { api, MAX_ERROR_LOG_LENGTH } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { DataTablePagination } from '@/components/data-table-pagination';
import { Plus, PlaySquare, CheckCircle2, XCircle, Clock, SkipForward, Camera, Search } from 'lucide-react';

export default function TestRunsPage() {
  const { id } = useParams<{ id: string }>();
  const [runs, setRuns] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [allResults, setAllResults] = useState<any[]>([]);
  const [allCases, setAllCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showResult, setShowResult] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [trigger, setTrigger] = useState<'manual' | 'ai' | 'ci'>('manual');
  const [env, setEnv] = useState('');
  const [planId, setPlanId] = useState('');
  const [resultCaseId, setResultCaseId] = useState('');
  const [resultStatus, setResultStatus] = useState<'passed' | 'failed' | 'skipped' | 'blocked'>('passed');
  const [resultActual, setResultActual] = useState('');
  const [resultError, setResultError] = useState('');
  const [resultDuration, setResultDuration] = useState('1000');
  const [resultSaveError, setResultSaveError] = useState('');
  const [savingResult, setSavingResult] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [search, setSearch] = useState('');
  const [filterTrigger, setFilterTrigger] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPlan, setFilterPlan] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [r, p, results, cases] = await Promise.all([
        api.getTestRuns(id),
        api.getTestPlans(id),
        api.getTestResults(undefined, undefined, id),
        api.getTestCases(id),
      ]);
      setRuns(r as any[]);
      setPlans(p as any[]);
      setAllResults(results as any[]);
      setAllCases(cases as any[]);
      if (p.length > 0 && !planId) setPlanId(p[0].id);
      setLoadError('');
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : '加载失败，请重试。');
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = useMemo(() => {
    let result = [...runs];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(r => (r.name || '').toLowerCase().includes(q) || (r.environment || '').toLowerCase().includes(q));
    }
    if (filterTrigger !== 'all') result = result.filter(r => r.trigger === filterTrigger);
    if (filterPlan !== 'all') result = result.filter(r => r.planId === filterPlan);
    if (filterStatus !== 'all') {
      if (filterStatus === 'finished') result = result.filter(r => r.status === 'completed');
      else result = result.filter(r => r.status === 'running');
    }
    result.sort((a, b) => new Date(b.startedAt || b.createdAt).getTime() - new Date(a.startedAt || a.createdAt).getTime());
    return result;
  }, [runs, search, filterTrigger, filterPlan, filterStatus]);

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const counts = useMemo(() => ({
    total: runs.length,
    running: runs.filter(r => r.status === 'running').length,
    finished: runs.filter(r => r.status === 'completed').length,
    manual: runs.filter(r => r.trigger === 'manual').length,
    ai: runs.filter(r => r.trigger === 'ai').length,
    ci: runs.filter(r => r.trigger === 'ci').length,
  }), [runs]);

  const resultsByRun = useMemo(() => {
    const map: Record<string, any[]> = {};
    allResults.forEach(r => {
      if (!map[r.runId]) map[r.runId] = [];
      map[r.runId].push(r);
    });
    return map;
  }, [allResults]);

  const caseMap = useMemo(() => {
    const map: Record<string, any> = {};
    allCases.forEach(c => { map[c.id] = c; });
    return map;
  }, [allCases]);

  const casesByPlan = useMemo(() => {
    const map: Record<string, any[]> = {};
    allCases.forEach(c => {
      if (!map[c.planId]) map[c.planId] = [];
      map[c.planId].push(c);
    });
    return map;
  }, [allCases]);

  const handleCreateRun = async () => {
    if (!name.trim() || !planId) return;
    await api.createTestRun({ planId, projectId: id!, name: name.trim(), trigger, environment: env.trim() });
    setShowCreate(false);
    setName(''); setEnv('');
    loadData();
  };

  const handleSubmitResult = async (runId: string) => {
    if (!resultCaseId || savingResult) return;
    setSavingResult(true);
    setResultSaveError('');
    try {
      await api.createTestResult({
        runId, caseId: resultCaseId, status: resultStatus,
        actualResult: resultActual, description: resultActual,
        errorLog: resultError,
        durationMs: parseInt(resultDuration) || 0,
      });
      setShowResult(null);
      setResultCaseId(''); setResultActual(''); setResultError(''); setResultDuration('1000');
      await loadData();
    } catch (error) {
      setResultSaveError(error instanceof Error && error.message.includes(String(MAX_ERROR_LOG_LENGTH)) ? error.message : '保存失败，输入已保留，请稍后重试。');
    } finally {
      setSavingResult(false);
    }
  };

  const statusIcon = (s: string) => {
    switch (s) {
      case 'passed': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'skipped': return <SkipForward className="h-4 w-4 text-gray-400" />;
      default: return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  if (loading) return <div className="py-12 text-center text-muted-foreground">加载中...</div>;

  return (
    <div className="space-y-4">
      {loadError && <p role="alert" className="text-sm text-red-600">{loadError}</p>}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">测试执行</h1>
          <p className="text-sm text-muted-foreground">管理测试执行批次</p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />新建执行</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>新建测试执行</DialogTitle></DialogHeader>
            <div className="space-y-3 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">所属计划 *</label>
                <Select value={planId} onValueChange={setPlanId}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{plans.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">执行名称 *</label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="例：第3轮回归测试" autoFocus />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">触发方式</label>
                <Select value={trigger} onValueChange={v => setTrigger(v as 'manual' | 'ai' | 'ci')}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">手动</SelectItem>
                    <SelectItem value="ai">AI 执行</SelectItem>
                    <SelectItem value="ci">CI/CD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">环境信息</label>
                <Input value={env} onChange={e => setEnv(e.target.value)} placeholder="例：Chrome 120 / Windows 11" />
              </div>
              <Button onClick={handleCreateRun} className="w-full" disabled={!name.trim() || !planId}>创建</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="搜索执行名称..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="h-8 pl-8 text-xs" />
        </div>
        <Select value={filterTrigger} onValueChange={v => { setFilterTrigger(v); setPage(1); }}>
          <SelectTrigger className="h-8 w-28 text-xs"><SelectValue placeholder="触发方式" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部方式</SelectItem>
            <SelectItem value="manual">手动</SelectItem>
            <SelectItem value="ai">AI</SelectItem>
            <SelectItem value="ci">CI/CD</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={v => { setFilterStatus(v); setPage(1); }}>
          <SelectTrigger className="h-8 w-28 text-xs"><SelectValue placeholder="状态" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="running">进行中</SelectItem>
            <SelectItem value="finished">已完成</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterPlan} onValueChange={v => { setFilterPlan(v); setPage(1); }}>
          <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="测试计划" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部计划</SelectItem>
            {plans.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {[
          { key: 'all', label: '全部', count: counts.total },
          { key: 'running', label: '进行中', count: counts.running },
          { key: 'finished', label: '已完成', count: counts.finished },
        ].map(f => (
          <Badge key={f.key} variant={filterStatus === f.key ? 'default' : 'outline'} className="text-[10px] cursor-pointer hover:bg-accent" onClick={() => { setFilterStatus(f.key); setPage(1); }}>
            {f.label} {f.count}
          </Badge>
        ))}
        <span className="text-xs text-muted-foreground ml-auto self-center">
          手动 {counts.manual} / AI {counts.ai} / CI {counts.ci}
        </span>
      </div>

      <div className="space-y-4">
        {paged.map(run => {
          const results = resultsByRun[run.id] || [];
          const passed = results.filter((r: any) => r.status === 'passed').length;
          const failed = results.filter((r: any) => r.status === 'failed').length;
          const plan = plans.find((p: any) => p.id === run.planId);
          return (
            <Card key={run.id}>
              <CardContent className="pt-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <PlaySquare className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold">{run.name}</h3>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {plan?.title ?? '未知计划'} · {run.trigger === 'ai' ? 'AI' : run.trigger === 'ci' ? 'CI' : '手动'} · {run.environment || '未指定环境'}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    {run.status === 'completed' ? '已完成' : '进行中'}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                  <span className="text-green-600">{passed} 通过</span>
                  <span className="text-red-600">{failed} 失败</span>
                  <span>共 {results.length} 条结果</span>
                  <span className="ml-auto">{new Date(run.startedAt || run.createdAt).toLocaleString('zh-CN')}</span>
                  {run.status === 'completed' && run.finishedAt && <span>完成于 {new Date(run.finishedAt).toLocaleString('zh-CN')}</span>}
                </div>
                <div className="space-y-1.5">
                  {results.map((r: any) => {
                    const tc = caseMap[r.caseId];
                    const screenshots = r.screenshots || [];
                    return (
                      <div key={r.id} className="p-2 rounded-lg bg-muted/30 text-xs">
                        <div className="flex items-center gap-2">
                        {statusIcon(r.status)}
                        <span className="font-medium flex-1 truncate">{tc?.name ?? '未知用例'}</span>
                        <span className="text-muted-foreground">{r.durationMs}ms</span>
                        {screenshots.length > 0 && <Camera className="h-3 w-3 text-muted-foreground" />}
                        </div>
                        {(r.actualResult || r.errorLog) && (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-muted-foreground">查看结果详情</summary>
                            {r.actualResult && <p className="mt-2 whitespace-pre-wrap break-words">{r.actualResult}</p>}
                            {r.errorLog && <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words font-mono text-red-600">{r.errorLog}</pre>}
                          </details>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 pt-3 border-t">
                  <Button size="sm" variant="outline" onClick={() => setShowResult(run.id)} className="text-xs">
                    <Plus className="h-3 w-3 mr-1" />提交结果
                  </Button>
                </div>
                {showResult === run.id && (
                  <div className="mt-3 p-3 border rounded-lg space-y-3 bg-muted/20">
                    {resultSaveError && <p role="alert" className="text-xs text-red-600">{resultSaveError}</p>}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium">选择用例 *</label>
                      <Select value={resultCaseId} onValueChange={setResultCaseId}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="选择用例" /></SelectTrigger>
                        <SelectContent>
                          {(casesByPlan[run.planId] || []).map((c: any) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium">结果状态</label>
                      <Select value={resultStatus} onValueChange={v => setResultStatus(v as 'passed' | 'failed' | 'skipped' | 'blocked')}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="passed">通过</SelectItem>
                          <SelectItem value="failed">失败</SelectItem>
                          <SelectItem value="skipped">跳过</SelectItem>
                          <SelectItem value="blocked">阻塞</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium">实际结果</label>
                      <Input value={resultActual} onChange={e => setResultActual(e.target.value)} className="h-8 text-xs" placeholder="实际执行结果" />
                    </div>
                    {resultStatus === 'failed' && (
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium">错误日志</label>
                        <Textarea value={resultError} onChange={e => setResultError(e.target.value)} aria-describedby="error-log-limit" className="text-xs font-mono" rows={2} placeholder="错误信息..." />
                        <p id="error-log-limit" className="text-xs text-muted-foreground">{Array.from(resultError).length} / {MAX_ERROR_LOG_LENGTH}</p>
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium">耗时(ms)</label>
                      <Input value={resultDuration} onChange={e => setResultDuration(e.target.value)} className="h-8 text-xs" type="number" />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleSubmitResult(run.id)} disabled={savingResult || !resultCaseId} className="text-xs flex-1">提交</Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowResult(null)} className="text-xs">取消</Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        {paged.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <PlaySquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>{runs.length === 0 ? '暂无执行记录' : '没有匹配的执行记录'}</p>
          </div>
        )}
        {filtered.length > pageSize && (
          <DataTablePagination total={filtered.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
        )}
      </div>
    </div>
  );
}
