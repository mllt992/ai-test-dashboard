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
import { Plus, Link2, ExternalLink, GitPullRequest, Globe, Search, ArrowUpDown } from 'lucide-react';

export default function ExternalTasksPage() {
  const { id } = useParams<{ id: string }>();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [source, setSource] = useState<'jira' | 'github' | 'manual' | 'other'>('jira');
  const [url, setUrl] = useState('');
  const [extId, setExtId] = useState('');

  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date-desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const t = await api.getExternalTasks(id);
      setTasks(t as any[]);
    } catch {}
    setLoading(false);
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreate = async () => {
    if (!title.trim()) return;
    await api.createExternalTask({
      projectId: id!, title: title.trim(), source, externalUrl: url, externalId: extId,
    });
    setShowCreate(false);
    setTitle(''); setUrl(''); setExtId('');
    loadData();
  };

  const sourceIcon = (s: string) => {
    switch (s) {
      case 'github': return <GitPullRequest className="h-4 w-4" />;
      case 'jira': return <Globe className="h-4 w-4 text-blue-500" />;
      default: return <Link2 className="h-4 w-4" />;
    }
  };

  const sourceLabel = (s: string) => {
    switch (s) {
      case 'jira': return 'Jira';
      case 'github': return 'GitHub';
      case 'manual': return '手动';
      case 'other': return '其他';
      default: return s;
    }
  };

  const sourceCounts = useMemo(() => {
    const counts: Record<string, number> = { all: tasks.length, jira: 0, github: 0, manual: 0, other: 0 };
    tasks.forEach(t => { counts[t.source] = (counts[t.source] || 0) + 1; });
    return counts;
  }, [tasks]);

  const filtered = useMemo(() => {
    let result = tasks;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(t => (t.title || '').toLowerCase().includes(q) || (t.externalId || '').toLowerCase().includes(q));
    }
    if (sourceFilter !== 'all') result = result.filter(t => t.source === sourceFilter);

    const sorted = [...result];
    switch (sortBy) {
      case 'title-asc': sorted.sort((a, b) => (a.title || '').localeCompare(b.title || '')); break;
      case 'title-desc': sorted.sort((a, b) => (b.title || '').localeCompare(a.title || '')); break;
      case 'source-asc': sorted.sort((a, b) => (a.source || '').localeCompare(b.source || '')); break;
      case 'date-asc': sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()); break;
      case 'date-desc': default: sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); break;
    }
    return sorted;
  }, [tasks, search, sourceFilter, sortBy]);

  const paged = useMemo(() => filtered.slice((page - 1) * pageSize, page * pageSize), [filtered, page, pageSize]);

  if (loading) return <div className="py-12 text-center text-muted-foreground">加载中...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">关联任务</h1>
          <p className="text-sm text-muted-foreground">关联外部需求、Issue 或任务</p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />添加关联</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>添加关联任务</DialogTitle></DialogHeader>
            <div className="space-y-3 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">任务标题 *</label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="例：用户登录安全加固" autoFocus />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">来源</label>
                <Select value={source} onValueChange={v => setSource(v as any)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="jira">Jira</SelectItem>
                    <SelectItem value="github">GitHub</SelectItem>
                    <SelectItem value="manual">手动</SelectItem>
                    <SelectItem value="other">其他</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">外部 ID</label>
                <Input value={extId} onChange={e => setExtId(e.target.value)} placeholder="例：JIRA-1234" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">URL</label>
                <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." />
              </div>
              <Button onClick={handleCreate} className="w-full" disabled={!title.trim()}>添加</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="搜索标题或外部 ID..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-9" />
        </div>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="h-9 w-44 text-xs"><ArrowUpDown className="h-3.5 w-3.5 mr-1" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="date-desc">最新添加</SelectItem>
            <SelectItem value="date-asc">最早添加</SelectItem>
            <SelectItem value="title-asc">标题 A→Z</SelectItem>
            <SelectItem value="title-desc">标题 Z→A</SelectItem>
            <SelectItem value="source-asc">来源</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'all', label: '全部' },
          { key: 'jira', label: 'Jira' },
          { key: 'github', label: 'GitHub' },
          { key: 'manual', label: '手动' },
          { key: 'other', label: '其他' },
        ].map(f => (
          <Button key={f.key} variant={sourceFilter === f.key ? 'default' : 'outline'} size="sm" onClick={() => { setSourceFilter(f.key); setPage(1); }} className="text-xs">
            {f.label}
            <span className="ml-1 opacity-70">{sourceCounts[f.key] ?? 0}</span>
          </Button>
        ))}
      </div>

      <div className="space-y-3">
        {paged.map(task => (
          <Card key={task.id}>
            <CardContent className="pt-5 flex items-center gap-3">
              {sourceIcon(task.source)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-sm">{task.title}</h3>
                  {task.externalId && <Badge variant="outline" className="text-[10px]">{task.externalId}</Badge>}
                </div>
                {task.externalUrl && (
                  <a href={task.externalUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline flex items-center gap-1 mt-0.5">
                    <ExternalLink className="h-3 w-3" />{task.externalUrl}
                  </a>
                )}
              </div>
              <Badge variant="secondary" className="text-[10px]">{sourceLabel(task.source)}</Badge>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Link2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>没有找到匹配的关联任务</p>
          </div>
        )}
      </div>

      {filtered.length > pageSize && (
        <DataTablePagination total={filtered.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={s => { setPageSize(s); setPage(1); }} />
      )}
    </div>
  );
}
