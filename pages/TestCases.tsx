import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { store } from '@/lib/store';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { DataTablePagination } from '@/components/data-table-pagination';
import { Plus, ListChecks, ChevronUp, ChevronDown, Search, ArrowUpDown } from 'lucide-react';

type SortField = 'name' | 'priority' | 'status' | 'order';
type SortDir = 'asc' | 'desc';

const priorityOrder: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
const statusOrder: Record<string, number> = { pending: 0, blocked: 1, failed: 2, skipped: 3, passed: 4 };

export default function TestCasesPage() {
  const { id } = useParams<{ id: string }>();
  const cases = store.getTestCases(id!);
  const plans = store.getTestPlans(id!);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [priority, setPriority] = useState<string>('P1');
  const [planId, setPlanId] = useState(plans[0]?.id ?? '');
  const [steps, setSteps] = useState('');
  const [expected, setExpected] = useState('');
  const [precondition, setPrecondition] = useState('');

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterPlan, setFilterPlan] = useState('all');
  const [sortField, setSortField] = useState<SortField>('order');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const filtered = useMemo(() => {
    let result = [...cases];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(c => c.name.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q));
    }
    if (filterStatus !== 'all') result = result.filter(c => c.status === filterStatus);
    if (filterPriority !== 'all') result = result.filter(c => c.priority === filterPriority);
    if (filterPlan !== 'all') result = result.filter(c => c.planId === filterPlan);

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name': cmp = a.name.localeCompare(b.name); break;
        case 'priority': cmp = (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9); break;
        case 'status': cmp = (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9); break;
        case 'order': cmp = a.executionOrder - b.executionOrder; break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return result;
  }, [cases, search, filterStatus, filterPriority, filterPlan, sortField, sortDir]);

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const handleCreate = () => {
    if (!name.trim() || !planId) return;
    store.createTestCase({
      planId, projectId: id!, name: name.trim(), description: desc.trim(),
      precondition, steps, expectedResult: expected,
      priority: priority as 'P0' | 'P1' | 'P2' | 'P3',
      tags: [], linkedTaskIds: [], status: 'pending', executionOrder: cases.length + 1,
    });
    setShowCreate(false);
    setName(''); setDesc(''); setSteps(''); setExpected(''); setPrecondition('');
  };

  const statusColor = (s: string) => {
    switch (s) {
      case 'passed': return 'bg-green-100 text-green-700';
      case 'failed': return 'bg-red-100 text-red-700';
      case 'skipped': return 'bg-gray-100 text-gray-600';
      case 'blocked': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-blue-100 text-blue-700';
    }
  };

  const priorityColor = (p: string) => {
    switch (p) {
      case 'P0': return 'bg-red-100 text-red-700';
      case 'P1': return 'bg-orange-100 text-orange-700';
      case 'P2': return 'bg-blue-100 text-blue-700';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const statusLabel = (s: string) => {
    switch (s) {
      case 'pending': return '待执行'; case 'passed': return '通过'; case 'failed': return '失败';
      case 'skipped': return '跳过'; case 'blocked': return '阻塞'; default: return s;
    }
  };

  const counts = useMemo(() => ({
    total: cases.length,
    pending: cases.filter(c => c.status === 'pending').length,
    passed: cases.filter(c => c.status === 'passed').length,
    failed: cases.filter(c => c.status === 'failed').length,
    skipped: cases.filter(c => c.status === 'skipped').length,
    blocked: cases.filter(c => c.status === 'blocked').length,
  }), [cases]);

  const SortHeader = ({ field, label }: { field: SortField; label: string }) => (
    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground" onClick={() => handleSort(field)}>
      <span className="flex items-center gap-1">{label}<ArrowUpDown className="h-3 w-3" /></span>
    </th>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">测试用例</h1>
          <p className="text-sm text-muted-foreground">共 {cases.length} 条用例</p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />新建用例</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>新建测试用例</DialogTitle></DialogHeader>
            <div className="space-y-3 pt-2 max-h-[60vh] overflow-y-auto">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">所属计划 *</label>
                <Select value={planId} onValueChange={setPlanId}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="选择计划" /></SelectTrigger>
                  <SelectContent>{plans.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">用例名称 *</label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="简要描述测试场景" autoFocus />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">描述</label>
                <Textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="详细描述" rows={2} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">前置条件</label>
                <Input value={precondition} onChange={e => setPrecondition(e.target.value)} placeholder="执行前需满足的条件" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">测试步骤</label>
                <Textarea value={steps} onChange={e => setSteps(e.target.value)} placeholder="1. 第一步&#10;2. 第二步" rows={3} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">预期结果</label>
                <Input value={expected} onChange={e => setExpected(e.target.value)} placeholder="期望的结果" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">优先级</label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="P0">P0 - 阻塞</SelectItem>
                    <SelectItem value="P1">P1 - 严重</SelectItem>
                    <SelectItem value="P2">P2 - 一般</SelectItem>
                    <SelectItem value="P3">P3 - 轻微</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleCreate} className="w-full" disabled={!name.trim() || !planId}>创建</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="搜索用例名称..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="h-8 pl-8 text-xs" />
        </div>
        <Select value={filterStatus} onValueChange={v => { setFilterStatus(v); setPage(1); }}>
          <SelectTrigger className="h-8 w-28 text-xs"><SelectValue placeholder="状态" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="pending">待执行</SelectItem>
            <SelectItem value="passed">通过</SelectItem>
            <SelectItem value="failed">失败</SelectItem>
            <SelectItem value="skipped">跳过</SelectItem>
            <SelectItem value="blocked">阻塞</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={v => { setFilterPriority(v); setPage(1); }}>
          <SelectTrigger className="h-8 w-28 text-xs"><SelectValue placeholder="优先级" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部优先级</SelectItem>
            <SelectItem value="P0">P0</SelectItem>
            <SelectItem value="P1">P1</SelectItem>
            <SelectItem value="P2">P2</SelectItem>
            <SelectItem value="P3">P3</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterPlan} onValueChange={v => { setFilterPlan(v); setPage(1); }}>
          <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="测试计划" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部计划</SelectItem>
            {plans.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {[
          { key: 'all', label: '全部', count: counts.total, color: '' },
          { key: 'pending', label: '待执行', count: counts.pending, color: 'text-blue-600' },
          { key: 'passed', label: '通过', count: counts.passed, color: 'text-green-600' },
          { key: 'failed', label: '失败', count: counts.failed, color: 'text-red-600' },
          { key: 'skipped', label: '跳过', count: counts.skipped, color: 'text-gray-500' },
          { key: 'blocked', label: '阻塞', count: counts.blocked, color: 'text-yellow-600' },
        ].map(s => (
          <Badge key={s.key} variant={filterStatus === s.key ? 'default' : 'outline'} className={`text-[10px] cursor-pointer ${filterStatus === s.key ? '' : s.color} ${filterStatus !== s.key ? 'hover:bg-accent' : ''}`} onClick={() => { setFilterStatus(s.key); setPage(1); }}>
            {s.label} {s.count}
          </Badge>
        ))}
        {cases.length > 0 && (
          <span className="text-xs text-muted-foreground ml-auto self-center">
            通过率 <span className="font-semibold text-green-600">{counts.total > 0 ? Math.round((counts.passed / counts.total) * 100) : 0}%</span>
          </span>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground w-10">#</th>
                <SortHeader field="name" label="用例名称" />
                <SortHeader field="priority" label="优先级" />
                <SortHeader field="status" label="状态" />
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground w-20">操作</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((c, i) => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{(page - 1) * pageSize + i + 1}</td>
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-sm">{c.name}</div>
                    {c.description && <div className="text-xs text-muted-foreground truncate max-w-md">{c.description}</div>}
                  </td>
                  <td className="px-4 py-2.5"><span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${priorityColor(c.priority)}`}>{c.priority}</span></td>
                  <td className="px-4 py-2.5"><span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${statusColor(c.status)}`}>{statusLabel(c.status)}</span></td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => {
                        const idx = cases.findIndex(x => x.id === c.id);
                        if (idx > 0) {
                          const prev = cases[idx - 1];
                          store.updateTestCase(prev.id, { executionOrder: c.executionOrder });
                          store.updateTestCase(c.id, { executionOrder: prev.executionOrder });
                        }
                      }}><ChevronUp className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => {
                        const idx = cases.findIndex(x => x.id === c.id);
                        if (idx < cases.length - 1) {
                          const next = cases[idx + 1];
                          store.updateTestCase(next.id, { executionOrder: c.executionOrder });
                          store.updateTestCase(c.id, { executionOrder: next.executionOrder });
                        }
                      }}><ChevronDown className="h-3 w-3" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {paged.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <ListChecks className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>{cases.length === 0 ? '暂无用例' : '没有匹配的用例'}</p>
            </div>
          )}
          {filtered.length > 0 && (
            <DataTablePagination total={filtered.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
