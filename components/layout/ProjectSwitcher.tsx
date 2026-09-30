import { useState, useRef, useEffect } from 'react';
import { useProject } from '@/store/context';
import { store } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronDown, Plus, Search, FolderOpen, Archive, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function ProjectSwitcher() {
  const { currentProject, projects, setProjectId } = useProject();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );
  const active = filtered.filter(p => p.status === 'active');
  const archived = filtered.filter(p => p.status === 'archived');

  const handleCreate = () => {
    if (!newName.trim()) return;
    const project = store.createProject(newName.trim(), newDesc.trim(), []);
    setProjectId(project.id);
    setShowCreate(false);
    setNewName('');
    setNewDesc('');
    navigate(`/p/${project.id}/overview`);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-2 text-sm font-medium hover:bg-muted/60 transition-colors"
      >
        <FolderOpen className="h-4 w-4 text-primary shrink-0" />
        <span className="truncate flex-1 text-left">{currentProject?.name ?? '选择项目'}</span>
        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1.5 rounded-lg border bg-popover p-2 shadow-lg min-w-[280px]">
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="搜索项目..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
          </div>

          <div className="max-h-[240px] overflow-y-auto space-y-0.5">
            {active.map(p => (
              <div key={p.id} className="flex items-center gap-1 group/item">
                <button
                  onClick={() => { setProjectId(p.id); setOpen(false); navigate(`/p/${p.id}/overview`); }}
                  className={`flex-1 flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs hover:bg-accent transition-colors text-left ${p.id === currentProject?.id ? 'bg-accent font-medium' : ''}`}
                >
                  <span className={`h-2 w-2 rounded-full shrink-0 ${p.status === 'active' ? 'bg-green-500' : 'bg-gray-400'}`} />
                  <span className="truncate">{p.name}</span>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); if (confirm(`确定删除项目「${p.name}」？此操作不可撤销。`)) { store.deleteProject(p.id); const remaining = store.getProjects(); if (currentProject?.id === p.id && remaining.length > 0) setProjectId(remaining[0].id); setOpen(false); }}}
                  className="h-6 w-6 flex items-center justify-center rounded opacity-0 group-hover/item:opacity-100 text-muted-foreground hover:text-red-500 transition-all shrink-0"
                  title="删除项目"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
            {archived.length > 0 && (
              <>
                <div className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] text-muted-foreground uppercase tracking-wider mt-2">
                  <Archive className="h-3 w-3" /> 已归档
                </div>
                {archived.map(p => (
                  <div key={p.id} className="flex items-center gap-1 group/item">
                    <button
                      onClick={() => { setProjectId(p.id); setOpen(false); navigate(`/p/${p.id}/overview`); }}
                      className="flex-1 flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-accent transition-colors text-left"
                    >
                      <span className="h-2 w-2 rounded-full shrink-0 bg-gray-400" />
                      <span className="truncate">{p.name}</span>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); if (confirm(`确定删除项目「${p.name}」？此操作不可撤销。`)) { store.deleteProject(p.id); const remaining = store.getProjects(); if (currentProject?.id === p.id && remaining.length > 0) setProjectId(remaining[0].id); setOpen(false); }}}
                      className="h-6 w-6 flex items-center justify-center rounded opacity-0 group-hover/item:opacity-100 text-muted-foreground hover:text-red-500 transition-all shrink-0"
                      title="删除项目"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </>
            )}
          </div>

          {showCreate ? (
            <div className="mt-2 border-t pt-2 space-y-2">
              <Input placeholder="项目名称" value={newName} onChange={e => setNewName(e.target.value)} className="h-8 text-xs" autoFocus />
              <Input placeholder="项目描述（可选）" value={newDesc} onChange={e => setNewDesc(e.target.value)} className="h-8 text-xs" />
              <div className="flex gap-1.5">
                <Button size="sm" onClick={handleCreate} className="h-7 text-xs flex-1">创建</Button>
                <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)} className="h-7 text-xs">取消</Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowCreate(true)}
              className="mt-2 flex w-full items-center gap-1.5 rounded-md border border-dashed border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> 新建项目
            </button>
          )}
        </div>
      )}
    </div>
  );
}
