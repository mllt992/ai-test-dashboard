import { NavLink, useLocation } from 'react-router-dom';
import { useProject } from '@/store/context';
import { useAuth } from '@/store/context';
import { ProjectSwitcher } from './ProjectSwitcher';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard, ClipboardList, FlaskConical, ListChecks,
  Bug, BarChart3, Settings, LogOut, FolderOpen, PlaySquare, Link2,
} from 'lucide-react';

export function Sidebar() {
  const { currentProject } = useProject();
  const { user, logout } = useAuth();
  const location = useLocation();
  const isProjectContext = location.pathname.startsWith('/p/');
  const pid = currentProject?.id;

  const globalLinks = [
    { to: '/overview', icon: LayoutDashboard, label: '全局概览' },
    { to: '/projects', icon: FolderOpen, label: '项目列表' },
  ];

  const projectLinks = pid ? [
    { to: `/p/${pid}/overview`, icon: LayoutDashboard, label: '项目概览' },
    { to: `/p/${pid}/plans`, icon: ClipboardList, label: '测试计划' },
    { to: `/p/${pid}/cases`, icon: ListChecks, label: '测试用例' },
    { to: `/p/${pid}/runs`, icon: PlaySquare, label: '测试执行' },
    { to: `/p/${pid}/defects`, icon: Bug, label: '缺陷管理' },
    { to: `/p/${pid}/tasks`, icon: Link2, label: '关联任务' },
    { to: `/p/${pid}/dashboard`, icon: BarChart3, label: '数据看板' },
  ] : [];

  const linkClass = (isActive: boolean) =>
    `flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-all duration-150 ${
      isActive
        ? 'bg-primary/10 text-primary font-medium shadow-sm'
        : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
    }`;

  return (
    <aside className="flex h-dvh w-60 shrink-0 flex-col border-r bg-sidebar">
      <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground font-bold text-sm shadow-sm">T</div>
        <div>
          <div className="text-sm font-semibold leading-tight tracking-tight">AI 测试看板</div>
          <div className="text-[10px] text-muted-foreground tracking-wide">Test Dashboard</div>
        </div>
      </div>

      <div className="px-4 pt-4 pb-1">
        <ProjectSwitcher />
      </div>

      <nav className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
        {!isProjectContext && (
          <>
            <div className="px-3 py-2 text-[10px] uppercase tracking-widest text-muted-foreground/70 font-semibold">全局</div>
            {globalLinks.map(l => (
              <NavLink key={l.to} to={l.to} className={({ isActive }) => linkClass(isActive)}>
                <l.icon className="h-4 w-4" />{l.label}
              </NavLink>
            ))}
          </>
        )}

        {isProjectContext && projectLinks.length > 0 && (
          <>
            <div className="px-3 py-2 text-[10px] uppercase tracking-widest text-muted-foreground/70 font-semibold">项目</div>
            {projectLinks.map(l => (
              <NavLink key={l.to} to={l.to} className={({ isActive }) => linkClass(isActive)}>
                <l.icon className="h-4 w-4" />{l.label}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      <div className="border-t border-sidebar-border px-4 py-3 space-y-1">
        <NavLink to="/settings" className={({ isActive }) => linkClass(isActive)}>
          <Settings className="h-4 w-4" />系统设置
        </NavLink>
        <Button variant="ghost" onClick={logout} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 justify-start">
          <LogOut className="h-4 w-4" />退出登录
        </Button>
        {user && (
          <div className="flex items-center gap-2.5 px-3 py-2 text-xs text-muted-foreground">
            <div className="h-6 w-6 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-[10px] font-semibold text-primary ring-1 ring-primary/20">
              {user.username[0].toUpperCase()}
            </div>
            <span className="truncate font-medium">{user.username}</span>
            <span className="ml-auto text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-md font-medium">{user.role}</span>
          </div>
        )}
      </div>
    </aside>
  );
}
