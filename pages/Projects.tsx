import { useState, useMemo, useEffect } from 'react';
import { api } from '@/lib/api';
import { computeDashboardStats } from '@/lib/stats';
import { useProject } from '@/store/context';
import type { Project, TestCase, TestResult, Defect } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { DataTablePagination } from '@/components/data-table-pagination';
import { Link } from 'react-router-dom';
import { Plus, Search, FolderOpen, Archive, Trash2, ArrowUpDown } from 'lucide-react';

export default function ProjectsPage() {
  const { projects, refresh, currentProject, setProjectId } = useProject();
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [tags, setTags] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [statsMap, setStatsMap] = useState<Record<string, ReturnType<typeof computeDashboardStats>>>({});

  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date-desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    if (projects.length === 0) return;
    Promise.all(
      projects.map(async p => {
        const [cases, results, defects] = await Promise.all([
          api.getTestCases(p.id),
          api.getTestResults(),
          api.getDefects(p.id),
        ]);
        const pResults = results.filter((r: any) => {
          const c = cases.find((cc: any) => cc.id === r.caseId);
          return !!c;
        });
        return { id: p.id, stats: computeDashboardStats(cases as TestCase[], pResults as TestResult[], defects as Defect[]) };
      })
    ).then(arr => {
      const map: Record<string, ReturnType<typeof computeDashboardStats>> = {};
      arr.forEach(x => { map[x.id] = x.stats; });
      setStatsMap(map);
    }).catch(() => {});
  }, [projects]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: projects.length, active: 0, archived: 0 };
    projects.forEach(p => { counts[p.status] = (counts[p.status] || 0) + 1; });
    return counts;
  }, [projects]);

  const filtered = useMemo(() => {
    let result = projects;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(p => p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q) || p.tags.some(t => t.toLowerCase().includes(q)));
    }
    if (statusFilter !== 'all') result = result.filter(p => p.status === statusFilter);

    const sorted = [...result];
    switch (sortBy) {
      case 'name-asc': sorted.sort((a, b) => a.name.localeCompare(b.name)); break;
      case 'name-desc': sorted.sort((a, b) => b.name.localeCompare(a.name)); break;
      case 'status-asc': sorted.sort((a, b) => a.status.localeCompare(b.status)); break;
      case 'date-asc': sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()); break;
      case 'date-desc': default: sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); break;
    }
    return sorted;
  }, [projects, search, statusFilter, sortBy]);

  const paged = useMemo(() => filtered.slice((page - 1) * pageSize, page * pageSize), [filtered, page, pageSize]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    await api.createProject(name.trim(), desc.trim(), tags.split(',').map(t => t.trim()).filter(Boolean));
    refresh();
    setShowCreate(false);
    setName(''); setDesc(''); setTags('');
  };

  const handleDelete = async (id: string) => {
    await api.deleteProject(id);
    if (currentProject?.id === id) {
      const remaining = projects.filter(p => p.id !== id);
      if (remaining.length > 0) setProjectId(remaining[0].id);
    }
    refresh();
    setDeleteTarget(null);
  };

  const emptyStats = { caseCount: 0, passRate: 0, openDefects: 0, passed: 0, failed: 0, skipped: 0, blocked: 0, total: 0, totalDuration: 0, planCount: 0, failedCount: 0, recentResults: [] };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">项目列表</h1>
          <p className="text-sm text-muted-foreground">管理所有测试项目</p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" />新建项目</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>新建项目</DialogTitle></DialogHeader>
            <div className="space-y-3 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">项目名称 *</label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="例：支付模块测试" autoFocus />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">项目描述</label>
                <Input value={desc} onChange={e => setDesc(e.target.value)} placeholder="简要描述项目范围" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">标签</label>
                <Input value={tags} onChange={e => setTags(e.target.value)} placeholder="逗号分隔，例：核心功能,安全" />
              </div>
              <Button onClick={handleCreate} className="w-full" disabled={!name.trim()}>创建项目</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="搜索项目名称、描述或标签..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-9" />
        </div>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="h-9 w-44 text-xs"><ArrowUpDown className="h-3.5 w-3.5 mr-1" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="date-desc">最新创建</SelectItem>
            <SelectItem value="date-asc">最早创建</SelectItem>
            <SelectItem value="name-asc">名称 A→Z</SelectItem>
            <SelectItem value="name-desc">名称 Z→A</SelectItem>
            <SelectItem value="status-asc">状态</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'all', label: '全部' },
          { key: 'active', label: '活跃' },
          { key: 'archived', label: '已归档' },
        ].map(f => (
          <Button key={f.key} variant={statusFilter === f.key ? 'default' : 'outline'} size="sm" onClick={() => { setStatusFilter(f.key); setPage(1); }} className="text-xs">
            {f.label}
            <span className="ml-1 opacity-70">{statusCounts[f.key] ?? 0}</span>
          </Button>
        ))}
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {paged.map(p => {
          const stats = statsMap[p.id] || emptyStats;
          return (
            <Card key={p.id} className="hover:shadow-md transition-shadow h-full group">
              <CardContent className="pt-5">
                <div className="flex items-start justify-between mb-3">
                  <Link to={`/p/${p.id}/overview`} className="flex items-center gap-2 flex-1 min-w-0">
                    {p.status === 'active' ? <FolderOpen className="h-5 w-5 text-primary shrink-0" /> : <Archive className="h-5 w-5 text-muted-foreground shrink-0" />}
                    <h3 className="font-semibold truncate">{p.name}</h3>
                  </Link>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <Badge variant={p.status === 'active' ? 'default' : 'secondary'} className="text-[10px]">
                      {p.status === 'active' ? '活跃' : '已归档'}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteTarget(p.id)}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="删除项目"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {p.description && <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{p.description}</p>}
                <div className="flex flex-wrap gap-1 mb-3">
                  {p.tags.map(t => <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>)}
                </div>
                <Link to={`/p/${p.id}/overview`} className="block">
                  <div className="grid grid-cols-3 gap-2 text-center border-t pt-3">
                    <div><p className="text-lg font-bold">{stats.caseCount}</p><p className="text-[10px] text-muted-foreground">用例</p></div>
                    <div><p className="text-lg font-bold text-green-600">{stats.passRate}%</p><p className="text-[10px] text-muted-foreground">通过率</p></div>
                    <div><p className="text-lg font-bold text-red-600">{stats.openDefects}</p><p className="text-[10px] text-muted-foreground">缺陷</p></div>
                  </div>
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>没有找到匹配的项目</p>
        </div>
      )}

      {filtered.length > pageSize && (
        <DataTablePagination total={filtered.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={s => { setPageSize(s); setPage(1); }} />
      )}

      <Dialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除项目</DialogTitle>
            <DialogDescription>
              删除项目将同时删除其所有测试计划、用例、执行记录和缺陷数据。此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>取消</Button>
            <Button variant="destructive" onClick={() => deleteTarget && handleDelete(deleteTarget)}>确认删除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
