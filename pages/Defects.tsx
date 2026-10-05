import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { nextManualDefectStatus } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTablePagination } from '@/components/data-table-pagination';
import { Bug, AlertTriangle, CheckCircle2, XCircle, Clock, RefreshCw, Lightbulb, RotateCcw, ChevronRight, Search, ArrowUpDown } from 'lucide-react';

type SortField = 'date' | 'severity' | 'status' | 'title';
type SortDir = 'asc' | 'desc';

const severityOrder: Record<string, number> = { critical: 0, major: 1, minor: 2, trivial: 3 };
const statusOrder: Record<string, number> = { open: 0, reopened: 1, in_progress: 2, fixed: 3, verified: 4, closed: 5 };

export default function DefectsPage() {
  const { id } = useParams<{ id: string }>();
  const [defects, setDefects] = useState<any[]>([]);
  const [allCases, setAllCases] = useState<any[]>([]);
  const [allResults, setAllResults] = useState<any[]>([]);
  const [allSolutions, setAllSolutions] = useState<any[]>([]);
  const [allRetests, setAllRetests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [expandedDefect, setExpandedDefect] = useState<string | null>(null);
  const [showSolution, setShowSolution] = useState<string | null>(null);
  const [showRetest, setShowRetest] = useState<string | null>(null);
  const [solTitle, setSolTitle] = useState('');
  const [solRootCause, setSolRootCause] = useState('');
  const [solFix, setSolFix] = useState('');
  const [solCommit, setSolCommit] = useState('');
  const [retestStatus, setRetestStatus] = useState<'passed' | 'failed'>('passed');
  const [retestNotes, setRetestNotes] = useState('');
  const [actionError, setActionError] = useState('');
  const [saving, setSaving] = useState(false);
  const [detailLoading, setDetailLoading] = useState<string | null>(null);
  const [detailError, setDetailError] = useState('');
  const detailRequest = useRef(0);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [d, cases] = await Promise.all([
        api.getDefects(id),
        api.getTestCases(id),
      ]);
      setDefects(d as any[]);
      setAllCases(cases as any[]);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '加载失败，请重试。');
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    detailRequest.current++;
    setExpandedDefect(null);
    setAllResults([]); setAllSolutions([]); setAllRetests([]);
  }, [id]);

  const loadDetail = async (defect: any) => {
    if (!defect) return;
    const request = ++detailRequest.current;
    setDetailLoading(defect.id);
    setDetailError('');
    try {
      const [results, solutions, retests] = await Promise.all([
        defect.resultId ? api.getTestResultsPage({ resultId: defect.resultId, projectId: id, pageSize: 1 }).then(page => page.items) : Promise.resolve([]),
        api.getSolutions(defect.id),
        api.getRetests(defect.id),
      ]);
      if (request !== detailRequest.current) return;
      setAllResults(previous => [...previous.filter(r => r.id !== defect.resultId), ...results]);
      setAllSolutions(previous => [...previous.filter(s => s.defectId !== defect.id), ...solutions]);
      setAllRetests(previous => [...previous.filter(r => r.defectId !== defect.id), ...retests]);
    } catch (error) {
      if (request !== detailRequest.current) return;
      setDetailError(error instanceof Error ? error.message : '追溯详情加载失败，请重试。');
    } finally {
      if (request === detailRequest.current) setDetailLoading(null);
    }
  };

  const toggleDetail = (defect: any) => {
    if (expandedDefect === defect.id) { detailRequest.current++; setExpandedDefect(null); return; }
    setExpandedDefect(defect.id);
    setActionError('');
    void loadDetail(defect);
  };

  const caseMap = useMemo(() => {
    const m: Record<string, any> = {};
    allCases.forEach(c => { m[c.id] = c; });
    return m;
  }, [allCases]);

  const resultMap = useMemo(() => {
    const m: Record<string, any> = {};
    allResults.forEach(r => { m[r.id] = r; });
    return m;
  }, [allResults]);

  const solutionsByDefect = useMemo(() => {
    const m: Record<string, any[]> = {};
    allSolutions.forEach(s => {
      if (!m[s.defectId]) m[s.defectId] = [];
      m[s.defectId].push(s);
    });
    return m;
  }, [allSolutions]);

  const retestsByDefect = useMemo(() => {
    const m: Record<string, any[]> = {};
    allRetests.forEach(r => {
      if (!m[r.defectId]) m[r.defectId] = [];
      m[r.defectId].push(r);
    });
    return m;
  }, [allRetests]);

  const filtered = useMemo(() => {
    let result = [...defects];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(d => (d.title || '').toLowerCase().includes(q) || (d.description || '').toLowerCase().includes(q));
    }
    if (filter !== 'all') result = result.filter(d => d.status === filter);
    if (filterSeverity !== 'all') result = result.filter(d => d.severity === filterSeverity);

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'date': cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(); break;
        case 'severity': cmp = (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9); break;
        case 'status': cmp = (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9); break;
        case 'title': cmp = (a.title || '').localeCompare(b.title || ''); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return result;
  }, [defects, search, filter, filterSeverity, sortField, sortDir]);

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const handleAddSolution = async (defectId: string) => {
    if (!solTitle.trim() || saving) return;
    setSaving(true); setActionError('');
    try {
      await api.createSolution({
        defectId, title: solTitle.trim(), rootCause: solRootCause,
        fixDescription: solFix, fixCommitUrl: solCommit,
      });
      setShowSolution(null);
      setSolTitle(''); setSolRootCause(''); setSolFix(''); setSolCommit('');
      await loadData();
      await loadDetail(defects.find(d => d.id === defectId));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '保存失败，请重试。');
    } finally { setSaving(false); }
  };

  const handleRetest = async (defectId: string) => {
    const defect = defects.find(d => d.id === defectId);
    if (!defect || saving) return;
    setSaving(true); setActionError('');
    try {
      const result = resultMap[defect.resultId];
      await api.createRetest({
        defectId, status: retestStatus, notes: retestNotes,
        resultId: result?.id || '', runId: result?.runId || '',
      });
      setShowRetest(null);
      setRetestNotes('');
      await loadData();
      await loadDetail(defect);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '保存失败，请重试。');
    } finally { setSaving(false); }
  };

  const handleStatusFlow = async (defect: any) => {
    const next = nextManualDefectStatus(defect.status);
    if (!next || saving) return;
    setSaving(true); setActionError('');
    try {
      await api.updateDefect(defect.id, { status: next });
      await loadData();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '状态更新失败，请重试。');
    } finally { setSaving(false); }
  };

  const severityColor = (s: string) => {
    switch (s) {
      case 'critical': return 'bg-red-100 text-red-700 border-red-200';
      case 'major': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'minor': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const statusIcon = (s: string) => {
    switch (s) {
      case 'open': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'in_progress': return <Clock className="h-4 w-4 text-blue-500" />;
      case 'fixed': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'verified': return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
      case 'closed': return <CheckCircle2 className="h-4 w-4 text-gray-400" />;
      case 'reopened': return <RefreshCw className="h-4 w-4 text-orange-500" />;
      default: return <Bug className="h-4 w-4" />;
    }
  };

  const statusLabel = (s: string) => {
    switch (s) {
      case 'open': return '待处理'; case 'in_progress': return '处理中'; case 'fixed': return '已修复';
      case 'verified': return '已验证'; case 'closed': return '已关闭'; case 'reopened': return '重新打开';
      default: return s;
    }
  };

  const counts = useMemo(() => ({
    total: defects.length,
    open: defects.filter(d => d.status === 'open').length,
    in_progress: defects.filter(d => d.status === 'in_progress').length,
    fixed: defects.filter(d => d.status === 'fixed').length,
    verified: defects.filter(d => d.status === 'verified').length,
    reopened: defects.filter(d => d.status === 'reopened').length,
    closed: defects.filter(d => d.status === 'closed').length,
    critical: defects.filter(d => d.severity === 'critical').length,
    major: defects.filter(d => d.severity === 'major').length,
  }), [defects]);

  if (loading) return <div className="py-12 text-center text-muted-foreground">加载中...</div>;

  return (
    <div className="space-y-4">
      {actionError && <p role="alert" className="text-sm text-red-600">{actionError}</p>}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">缺陷管理</h1>
          <p className="text-sm text-muted-foreground">跟踪缺陷、解决方案和复测</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="搜索缺陷标题..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="h-8 pl-8 text-xs" />
        </div>
        <Select value={filterSeverity} onValueChange={v => { setFilterSeverity(v); setPage(1); }}>
          <SelectTrigger className="h-8 w-28 text-xs"><SelectValue placeholder="严重程度" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部程度</SelectItem>
            <SelectItem value="critical">严重</SelectItem>
            <SelectItem value="major">重要</SelectItem>
            <SelectItem value="minor">一般</SelectItem>
            <SelectItem value="trivial">轻微</SelectItem>
          </SelectContent>
        </Select>
        <Select value={`${sortField}-${sortDir}`} onValueChange={v => { const [f, d] = v.split('-'); setSortField(f as SortField); setSortDir(d as SortDir); }}>
          <SelectTrigger className="h-8 w-36 text-xs"><ArrowUpDown className="h-3 w-3 mr-1" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="date-desc">最新创建</SelectItem>
            <SelectItem value="date-asc">最早创建</SelectItem>
            <SelectItem value="severity-asc">严重程度 ↑</SelectItem>
            <SelectItem value="severity-desc">严重程度 ↓</SelectItem>
            <SelectItem value="status-asc">状态流转 ↑</SelectItem>
            <SelectItem value="status-desc">状态流转 ↓</SelectItem>
            <SelectItem value="title-asc">标题 A-Z</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {[
          { key: 'all', label: '全部', count: counts.total },
          { key: 'open', label: '待处理', count: counts.open },
          { key: 'in_progress', label: '处理中', count: counts.in_progress },
          { key: 'fixed', label: '已修复', count: counts.fixed },
          { key: 'verified', label: '已验证', count: counts.verified },
          { key: 'reopened', label: '重新打开', count: counts.reopened },
          { key: 'closed', label: '已关闭', count: counts.closed },
        ].map(f => (
          <Badge key={f.key} variant={filter === f.key ? 'default' : 'outline'} className="text-[10px] cursor-pointer hover:bg-accent" onClick={() => { setFilter(f.key); setPage(1); }}>
            {f.label} {f.count}
          </Badge>
        ))}
        {defects.length > 0 && (
          <span className="text-xs text-muted-foreground ml-auto self-center">
            严重 <span className="font-semibold text-red-600">{counts.critical}</span> / 重要 <span className="font-semibold text-orange-600">{counts.major}</span>
          </span>
        )}
      </div>

      <div className="space-y-3">
        {paged.map(defect => {
          const tc = caseMap[defect.caseId];
          const result = resultMap[defect.resultId];
          const solutions = solutionsByDefect[defect.id] || [];
          const retests = retestsByDefect[defect.id] || [];
          const isExpanded = expandedDefect === defect.id;

          return (
            <Card key={defect.id} className={defect.status === 'reopened' ? 'border-orange-200 bg-orange-50/30' : ''}>
              <CardContent className="pt-5">
                <div className="flex items-start gap-3">
                  {statusIcon(defect.status)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-sm">{defect.title}</h3>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${severityColor(defect.severity)}`}>{defect.severity}</span>
                      <Badge variant="outline" className="text-[10px]">{statusLabel(defect.status)}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{defect.description}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>用例: {tc?.name ?? '-'}</span>
                      <span>{new Date(defect.createdAt).toLocaleString('zh-CN')}</span>
                    </div>

                    <Button variant="ghost" size="sm" onClick={() => toggleDetail(defect)} className="text-xs mt-2 h-6 px-2">
                      {isExpanded ? '收起' : '展开追溯链'} <ChevronRight className={`h-3 w-3 ml-1 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    </Button>

                    {isExpanded && (
                      <div className="mt-3 space-y-3 border-t pt-3">
                        {detailLoading === defect.id && <p className="text-xs text-muted-foreground">正在加载追溯详情…</p>}
                        {detailError && <p role="alert" className="text-xs text-red-600">{detailError}</p>}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-xs">
                            <div className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center"><span className="text-[10px]">TC</span></div>
                            <span className="font-medium">{tc?.name}</span>
                          </div>
                          <div className="ml-3 border-l-2 border-dashed pl-3 space-y-2">
                            <div className="flex items-center gap-2 text-xs">
                              <div className={`h-6 w-6 rounded-full flex items-center justify-center ${result?.status === 'passed' ? 'bg-green-100' : result?.status === 'failed' ? 'bg-red-100' : 'bg-gray-100'}`}>
                                {result?.status === 'passed' ? <CheckCircle2 className="h-3 w-3 text-green-600" /> : <XCircle className="h-3 w-3 text-red-600" />}
                              </div>
                              <span>执行结果: {result?.actualResult || result?.description || '-'}</span>
                            </div>
                            {result?.errorLog && (
                              <details className="mt-2 text-xs">
                                <summary className="cursor-pointer text-red-600">查看完整错误日志</summary>
                                <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words font-mono text-red-600">{result.errorLog}</pre>
                              </details>
                            )}
                          </div>
                          <div className="ml-3 border-l-2 border-dashed pl-3">
                            <div className="flex items-center gap-2 text-xs">
                              <div className="h-6 w-6 rounded-full bg-red-100 flex items-center justify-center"><Bug className="h-3 w-3 text-red-600" /></div>
                              <span className="font-medium text-red-700">{defect.title}</span>
                            </div>
                          </div>
                          {solutions.map((sol: any) => (
                            <div key={sol.id} className="ml-3 border-l-2 border-dashed pl-3">
                              <div className="flex items-center gap-2 text-xs">
                                <div className="h-6 w-6 rounded-full bg-green-100 flex items-center justify-center"><Lightbulb className="h-3 w-3 text-green-600" /></div>
                                <div>
                                  <span className="font-medium text-green-700">{sol.title}</span>
                                  {sol.rootCause && <p className="text-muted-foreground">根因: {sol.rootCause}</p>}
                                  {sol.fixDescription && <p className="text-muted-foreground">修复: {sol.fixDescription}</p>}
                                  {sol.fixCommitUrl && <p className="text-blue-500 truncate">{sol.fixCommitUrl}</p>}
                                </div>
                              </div>
                            </div>
                          ))}
                          {retests.map((rt: any) => (
                            <div key={rt.id} className="ml-3 border-l-2 border-dashed pl-3">
                              <div className="flex items-center gap-2 text-xs">
                                <div className={`h-6 w-6 rounded-full flex items-center justify-center ${rt.status === 'passed' ? 'bg-emerald-100' : 'bg-orange-100'}`}>
                                  <RotateCcw className={`h-3 w-3 ${rt.status === 'passed' ? 'text-emerald-600' : 'text-orange-600'}`} />
                                </div>
                                <div>
                                  <span className={`font-medium ${rt.status === 'passed' ? 'text-emerald-700' : 'text-orange-700'}`}>
                                    复测: {rt.status === 'passed' ? '通过' : '失败'}
                                  </span>
                                  {rt.notes && <p className="text-muted-foreground">{rt.notes}</p>}
                                  <p className="text-muted-foreground">{new Date(rt.retestedAt || rt.createdAt).toLocaleString('zh-CN')}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="flex gap-2 pt-2 border-t">
                          {(defect.status === 'open' || defect.status === 'in_progress' || defect.status === 'reopened') && !showSolution && (
                            <Button size="sm" variant="outline" onClick={() => setShowSolution(defect.id)} className="text-xs">
                              <Lightbulb className="h-3 w-3 mr-1" />添加解决方案
                            </Button>
                          )}
                          {(defect.status === 'fixed') && !showRetest && (
                            <Button size="sm" variant="outline" onClick={() => setShowRetest(defect.id)} className="text-xs">
                              <RotateCcw className="h-3 w-3 mr-1" />创建复测
                            </Button>
                          )}
                          {nextManualDefectStatus(defect.status) && (
                            <Button size="sm" variant="ghost" disabled={saving} onClick={() => handleStatusFlow(defect)} className="text-xs">
                              流转状态 → {statusLabel(nextManualDefectStatus(defect.status)!)}
                            </Button>
                          )}
                        </div>

                        {showSolution === defect.id && (
                          <div className="p-3 border rounded-lg space-y-2 bg-green-50/30">
                            <div className="space-y-1.5">
                              <label className="text-xs font-medium">方案标题 *</label>
                              <Input value={solTitle} onChange={e => setSolTitle(e.target.value)} className="h-8 text-xs" placeholder="简述修复方案" autoFocus />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-xs font-medium">根因分析</label>
                              <Textarea value={solRootCause} onChange={e => setSolRootCause(e.target.value)} className="text-xs" rows={2} placeholder="为什么会出现这个问题" />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-xs font-medium">修复说明</label>
                              <Textarea value={solFix} onChange={e => setSolFix(e.target.value)} className="text-xs" rows={2} placeholder="做了什么修改" />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-xs font-medium">关联提交 URL</label>
                              <Input value={solCommit} onChange={e => setSolCommit(e.target.value)} className="h-8 text-xs" placeholder="https://github.com/.../commit/..." />
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => handleAddSolution(defect.id)} disabled={saving || !solTitle.trim()} className="text-xs flex-1">保存方案</Button>
                              <Button size="sm" variant="ghost" onClick={() => setShowSolution(null)} className="text-xs">取消</Button>
                            </div>
                          </div>
                        )}

                        {showRetest === defect.id && (
                          <div className="p-3 border rounded-lg space-y-2 bg-blue-50/30">
                            <div className="space-y-1.5">
                              <label className="text-xs font-medium">复测结果</label>
                              <Select value={retestStatus} onValueChange={v => setRetestStatus(v as 'passed' | 'failed')}>
                                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="passed">通过</SelectItem>
                                  <SelectItem value="failed">失败</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-xs font-medium">备注</label>
                              <Textarea value={retestNotes} onChange={e => setRetestNotes(e.target.value)} className="text-xs" rows={2} placeholder="复测说明" />
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => handleRetest(defect.id)} disabled={saving} className="text-xs flex-1">提交复测</Button>
                              <Button size="sm" variant="ghost" onClick={() => setShowRetest(null)} className="text-xs">取消</Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {paged.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Bug className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>{defects.length === 0 ? '暂无缺陷' : '没有匹配的缺陷'}</p>
          </div>
        )}
        {filtered.length > pageSize && (
          <DataTablePagination total={filtered.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={s => { setPageSize(s); setPage(1); }} />
        )}
      </div>
    </div>
  );
}
