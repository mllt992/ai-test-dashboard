import { useState } from 'react';
import { store } from '@/lib/store';
import { useAuth } from '@/store/context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Settings, Key, Users, Copy, CheckCircle2, Trash2, Plus, Shield, Server, Webhook } from 'lucide-react';

export default function SettingsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('mcp');
  const [copied, setCopied] = useState(false);
  const [showCreateKey, setShowCreateKey] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [lastCreatedKey, setLastCreatedKey] = useState<string | null>(null);
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'member'>('member');

  const apiKeys = store.getApiKeys();
  const users = store.getUsers();
  const settings = store.getSettings();

  const activeKey = apiKeys.find(k => k.status === 'active');
  const mcpConfig = JSON.stringify({
    mcpServers: {
      'test-dashboard': {
        url: `${window.location.origin}/functions/v1/app/mcp`,
        headers: {
          'Authorization': `Bearer ${activeKey?.key ?? 'sk-your-api-key-here'}`,
        },
      },
    },
  }, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(mcpConfig);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreateKey = () => {
    if (!keyName.trim()) return;
    const newKey = store.createApiKey(keyName.trim(), ['read', 'write']);
    setLastCreatedKey(newKey.key);
    setRevealedKeys(prev => new Set(prev).add(newKey.id));
    setShowCreateKey(false);
    setKeyName('');
  };

  const handleCreateUser = () => {
    if (!newUsername.trim() || !newPassword.trim()) return;
    store.createUser(newUsername.trim(), newPassword.trim(), newRole);
    setShowCreateUser(false);
    setNewUsername(''); setNewPassword('');
  };

  const mcpTools = [
    { name: 'create_project', desc: '创建项目', enabled: true },
    { name: 'list_projects', desc: '列出项目', enabled: true },
    { name: 'create_test_plan', desc: '创建测试计划', enabled: true },
    { name: 'add_test_cases', desc: '添加测试用例', enabled: true },
    { name: 'create_test_run', desc: '创建执行批次', enabled: true },
    { name: 'submit_test_result', desc: '提交测试结果', enabled: true },
    { name: 'upload_screenshots', desc: '上传截图', enabled: true },
    { name: 'create_defect', desc: '创建缺陷', enabled: true },
    { name: 'add_solution', desc: '添加解决方案', enabled: true },
    { name: 'create_retest', desc: '创建复测', enabled: true },
    { name: 'link_task', desc: '关联外部任务', enabled: true },
    { name: 'get_dashboard', desc: '获取看板数据', enabled: true },
    { name: 'get_traceability', desc: '获取追溯链', enabled: true },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">系统设置</h1>
        <p className="text-sm text-muted-foreground mt-1.5">管理 MCP 接入、API Key、用户和系统参数</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="mcp" className="text-xs"><Server className="h-3.5 w-3.5 mr-1" />MCP 接入</TabsTrigger>
          <TabsTrigger value="api-keys" className="text-xs"><Key className="h-3.5 w-3.5 mr-1" />API Key</TabsTrigger>
          <TabsTrigger value="users" className="text-xs"><Users className="h-3.5 w-3.5 mr-1" />用户管理</TabsTrigger>
          <TabsTrigger value="general" className="text-xs"><Settings className="h-3.5 w-3.5 mr-1" />系统参数</TabsTrigger>
        </TabsList>

        <TabsContent value="mcp" className="space-y-4">
          <Card className="shadow-md border-0">
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2"><Server className="h-4 w-4" />MCP Server 配置</CardTitle>
              <CardDescription>配置 AI 客户端接入测试看板的 MCP 服务</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium">Server Endpoint</label>
                <Input value={`${window.location.origin}/functions/v1/app/mcp`} readOnly className="font-mono text-xs bg-muted" />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium">可用工具列表</label>
                <div className="border rounded-lg divide-y max-h-[300px] overflow-y-auto">
                  {mcpTools.map(tool => (
                    <div key={tool.name} className="flex items-center justify-between px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Switch checked={tool.enabled} disabled />
                        <code className="text-xs font-mono">{tool.name}</code>
                      </div>
                      <span className="text-xs text-muted-foreground">{tool.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md border-0">
            <CardHeader>
              <CardTitle className="text-base font-semibold">MCP JSON 配置</CardTitle>
              <CardDescription>复制以下配置到 AI 客户端（Qoder / Cursor / Claude Desktop）</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <pre className="bg-muted rounded-lg p-4 text-xs font-mono overflow-x-auto">{mcpConfig}</pre>
                <Button size="sm" variant="outline" onClick={handleCopy} className="absolute top-2 right-2 h-7 text-xs">
                  {copied ? <><CheckCircle2 className="h-3 w-3 mr-1 text-green-500" />已复制</> : <><Copy className="h-3 w-3 mr-1" />复制</>}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api-keys" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={showCreateKey} onOpenChange={setShowCreateKey}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-3.5 w-3.5 mr-1" />生成 Key</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>生成 API Key</DialogTitle></DialogHeader>
                <div className="space-y-3 pt-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">名称 *</label>
                    <Input value={keyName} onChange={e => setKeyName(e.target.value)} placeholder="例：AI Agent Key" autoFocus />
                  </div>
                  <Button onClick={handleCreateKey} className="w-full" disabled={!keyName.trim()}>生成</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {lastCreatedKey && (
            <Card className="border-emerald-200 bg-emerald-50/50">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-emerald-800">API Key 已生成</p>
                    <p className="text-xs text-emerald-600 mt-1">请立即复制保存，关闭后将无法再次查看完整 Key。</p>
                    <div className="flex items-center gap-2 mt-2">
                      <code className="text-xs font-mono bg-white px-3 py-1.5 rounded-md border flex-1 truncate">{lastCreatedKey}</code>
                      <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(lastCreatedKey); setLastCreatedKey(''); }}>
                        <Copy className="h-3 w-3 mr-1" />复制
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="shadow-md border-0">
            <CardContent className="pt-5">
              {apiKeys.length > 0 ? (
                <div className="space-y-3">
                  {apiKeys.map(k => {
                    const isRevealed = revealedKeys.has(k.id);
                    return (
                      <div key={k.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Key className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium text-sm">{k.name}</span>
                            <Badge variant={k.status === 'active' ? 'default' : 'secondary'} className="text-[10px]">{k.status === 'active' ? '活跃' : '已吊销'}</Badge>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <code className="text-xs text-muted-foreground font-mono">
                              {isRevealed ? k.key : k.key.slice(0, 12) + '••••••••••••••••'}
                            </code>
                            <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[10px]" onClick={() => {
                              if (isRevealed) {
                                setRevealedKeys(prev => { const n = new Set(prev); n.delete(k.id); return n; });
                              } else {
                                setRevealedKeys(prev => new Set(prev).add(k.id));
                              }
                            }}>
                              {isRevealed ? '隐藏' : '查看'}
                            </Button>
                            <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[10px]" onClick={() => navigator.clipboard.writeText(k.key)}>
                              <Copy className="h-3 w-3 mr-0.5" />复制
                            </Button>
                          </div>
                        </div>
                        {k.status === 'active' ? (
                          <Button variant="ghost" size="sm" onClick={() => store.revokeApiKey(k.id)} className="text-xs text-red-500 hover:text-red-700 shrink-0 ml-2">
                            <Trash2 className="h-3 w-3 mr-1" />吊销
                          </Button>
                        ) : (
                          <Button variant="ghost" size="sm" onClick={() => store.deleteApiKey(k.id)} className="text-xs text-red-500 hover:text-red-700 shrink-0 ml-2">
                            <Trash2 className="h-3 w-3 mr-1" />删除
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Key className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">暂无 API Key</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          {user?.role === 'admin' && (
            <div className="flex justify-end">
              <Dialog open={showCreateUser} onOpenChange={setShowCreateUser}>
                <DialogTrigger asChild><Button size="sm"><Plus className="h-3.5 w-3.5 mr-1" />添加用户</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>添加用户</DialogTitle></DialogHeader>
                  <div className="space-y-3 pt-2">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium">用户名 *</label>
                      <Input value={newUsername} onChange={e => setNewUsername(e.target.value)} autoFocus />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium">密码 *</label>
                      <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium">角色</label>
                      <Select value={newRole} onValueChange={v => setNewRole(v as 'admin' | 'member')}>
                        <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">管理员</SelectItem>
                          <SelectItem value="member">普通用户</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={handleCreateUser} className="w-full" disabled={!newUsername.trim() || !newPassword.trim()}>创建</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}

          <Card className="shadow-md border-0">
            <CardContent className="pt-5">
              <div className="space-y-2">
                {users.map(u => (
                  <div key={u.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-sm font-semibold text-primary ring-1 ring-primary/10">
                        {u.username[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{u.username}</span>
                          <Badge variant={u.role === 'admin' ? 'default' : 'outline'} className="text-[10px]">
                            <Shield className="h-3 w-3 mr-0.5" />{u.role === 'admin' ? '管理员' : '成员'}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">创建于 {new Date(u.createdAt).toLocaleDateString('zh-CN')}</p>
                      </div>
                    </div>
                    {user?.role === 'admin' && u.id !== user.id && (
                      <Button variant="ghost" size="sm" onClick={() => store.deleteUser(u.id)} className="text-xs text-red-500 hover:text-red-700">
                        <Trash2 className="h-3 w-3 mr-1" />删除
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="general" className="space-y-4">
          <Card className="shadow-md border-0">
            <CardHeader>
              <CardTitle className="text-base font-semibold">系统参数</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">截图大小上限 (MB)</label>
                  <Input type="number" value={settings.maxScreenshotSize / 1024 / 1024} onChange={e => store.updateSettings({ maxScreenshotSize: parseInt(e.target.value) * 1024 * 1024 })} className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">单结果截图上限</label>
                  <Input type="number" value={settings.maxScreenshotsPerResult} onChange={e => store.updateSettings({ maxScreenshotsPerResult: parseInt(e.target.value) })} className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">每用户项目上限</label>
                  <Input type="number" value={settings.maxProjectsPerUser} onChange={e => store.updateSettings({ maxProjectsPerUser: parseInt(e.target.value) })} className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">结果保留天数</label>
                  <Input type="number" value={settings.resultRetentionDays} onChange={e => store.updateSettings({ resultRetentionDays: parseInt(e.target.value) })} className="h-9 text-sm" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium flex items-center gap-1"><Webhook className="h-3.5 w-3.5" />Webhook URL</label>
                <Input value={settings.webhookUrl} onChange={e => store.updateSettings({ webhookUrl: e.target.value })} placeholder="https://hooks.example.com/..." className="text-sm" />
                <p className="text-[10px] text-muted-foreground">测试失败时发送通知</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
