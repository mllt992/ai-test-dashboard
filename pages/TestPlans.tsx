import { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DataTablePagination } from '@/components/data-table-pagination';
import { Plus, ClipboardList, Search, ArrowUpDown } from 'lucide-react';

export default function TestPlansPage() {
  const { id } = useParams<{ id: string }>();
  const [plans, setPlans] = useState<any[]>([]);
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date-desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [p, c] = await Promise.all([
        api.getTestPlans(id),
        api.getTestCases(id),
      ]);
      setPlans(p as any[]);
      setCases(c as any[]);
    } catch {}
    setLoading(false);
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreate = async () => {
    if (!title.trim()) return;
    await api.createTestPlan(id!, title.trim(), desc.trim());
    setShowCreate(false);
    setTitle(''); setDesc('');
    loadData();
  };

  const statusLabel = (s: string) => {
    switch (s) {
      case 'draft': return '草稿';
      case 'ready': return '就绪';
      case 'in_progress': return '进行中';
      case 'completed': return '已完成';
      default: return s;
    }
  };

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: plans.length, draft: 0, ready: 0, in_progress: 0, completed: 0 };
    plans.forEach(p => { counts[p.status] = (counts[p.status] || 0) + 1; });
    return counts;
  }, [plans]);

  const filtered = useMemo(() => {
    let result = plans;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(p => (p.title || '').toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q));
    }
    if (statusFilter !== 'all') result = result.filter(p => p.status === statusFilter);

    const sorted = [...result];
    switch (sortBy) {
      case 'title-asc': sorted.sort((a, b) => (a.title || '').localeCompare(b.title || '')); break;
      case 'title-desc': sorted.sort((a, b) => (b.title || '').localeCompare(a.title || '')); break;
      case 'status-asc': sorted.sort((a, b) => (a.status || '').localeCompare(b.status || '')); break;
      case 'date-asc': sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()); break;
      case 'date-desc': default: sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); break;
    }
    return sorted;
  }, [plans, search, statusFilter, sortBy]);

  const paged = useMemo(() => filtered.slice((page - 1) * pageSize, page * pageSize), [filtered, page, pageSize]);

  const casesByPlan = useMemo(() => {
    const map: Record<string, any[]> = {};
    cases.forEach(c => {
      if (!map[c.planId]) map[c.planId] = [];
      map[c.planId].push(c);
    });
    return map;
  }, [cases]);

  if (loading) return <div className="py-12 text-center text-muted-foreground">加载中...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">测试计划</h1>
          <p className="text-sm text-muted-foreground">管理项目的测试计划</p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />新建计划</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>新建测试计划</DialogTitle></DialogHeader>
            <div className="space-y-3 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">计划标题 *</label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="例：Sprint 12 回归测试" autoFocus />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">描述</label>
                <Input value={desc} onChange={e => setDesc(e.target.value)} placeholder="计划范围和目标" />
              </div>
              <Button onClick={handleCreate} className="w-full" disabled={!title.trim()}>创建</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="搜索计划..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-9" />
        </div>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="h-9 w-44 text-xs"><ArrowUpDown className="h-3.5 w-3.5 mr-1" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="date-desc">最新创建</SelectItem>
            <SelectItem value="date-asc">最早创建</SelectItem>
            <SelectItem value="title-asc">标题 A→Z</SelectItem>
            <SelectItem value="title-desc">标题 Z→A</SelectItem>
            <SelectItem value="status-asc">状态</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'all', label: '全部' },
          { key: 'draft', label: '草稿' },
          { key: 'ready', label: '就绪' },
          { key: 'in_progress', label: '进行中' },
          { key: 'completed', label: '已完成' },
        ].map(f => (
          <Button key={f.key} variant={statusFilter === f.key ? 'default' : 'outline'} size="sm" onClick={() => { setStatusFilter(f.key); setPage(1); }} className="text-xs">
            {f.label}
            <span className="ml-1 opacity-70">{statusCounts[f.key] ?? 0}</span>
          </Button>
        ))}
      </div>

      <div className="space-y-3">
        {paged.map(plan => {
          const planCases = casesByPlan[plan.id] || [];
          const passed = planCases.filter((c: any) => c.status === 'passed').length;
          const failed = planCases.filter((c: any) => c.status === 'failed').length;
          return (
            <Card key={plan.id}>
              <CardContent className="pt-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold">{plan.title}</h3>
                  </div>
                  <Badge variant={plan.status === 'completed' ? 'default' : 'outline'} className="text-[10px]">{statusLabel(plan.status)}</Badge>
                </div>
                {plan.description && <p className="text-xs text-muted-foreground mb-3">{plan.description}</p>}
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>共 {planCases.length} 用例</span>
                  <span className="text-green-600">{passed} 通过</span>
                  <span className="text-red-600">{failed} 失败</span>
                  <span className="ml-auto">{planCases.length > 0 ? Math.round((passed / planCases.length) * 100) : 0}% 通过率</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>没有找到匹配的计划</p>
          </div>
        )}
      </div>

      {filtered.length > pageSize && (
        <DataTablePagination total={filtered.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={s => { setPageSize(s); setPage(1); }} />
      )}
    </div>
  );
}
