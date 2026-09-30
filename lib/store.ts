import type {
  User, Project, TestPlan, TestCase, TestRun, TestResult,
  Screenshot, Defect, Solution, Retest, ExternalTask, ApiKey,
  SystemSettings, AuditLog,
} from './types';

const STORAGE_KEY = 'test-dashboard-data';

interface StoreData {
  users: User[];
  apiKeys: ApiKey[];
  projects: Project[];
  externalTasks: ExternalTask[];
  testPlans: TestPlan[];
  testCases: TestCase[];
  testRuns: TestRun[];
  testResults: TestResult[];
  screenshots: Screenshot[];
  defects: Defect[];
  solutions: Solution[];
  retests: Retest[];
  systemSettings: SystemSettings;
  auditLogs: AuditLog[];
  currentUserId: string | null;
  authToken: string | null;
}

function hashPassword(password: string): string {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return 'h_' + Math.abs(hash).toString(36);
}

function generateId(): string {
  return crypto.randomUUID();
}

function generateToken(): string {
  return 'tk_' + crypto.randomUUID().replace(/-/g, '');
}

function now(): string {
  return new Date().toISOString();
}

function getDefaultSettings(): SystemSettings {
  return {
    maxScreenshotSize: 5 * 1024 * 1024,
    maxScreenshotsPerResult: 10,
    maxProjectsPerUser: 50,
    resultRetentionDays: 365,
    webhookUrl: '',
  };
}

function getSeedData(): StoreData {
  const adminId = generateId();
  const projectId = generateId();
  const planId = generateId();
  const runId = generateId();

  const users: User[] = [
    {
      id: adminId,
      username: 'xrilang',
      passwordHash: hashPassword('qq2686485465'),
      role: 'admin',
      createdAt: now(),
    },
  ];

  const projects: Project[] = [
    {
      id: projectId,
      name: '登录模块测试',
      description: '用户登录功能完整测试，包含密码登录、OAuth、安全策略等',
      ownerId: adminId,
      status: 'active',
      tags: ['安全', '核心功能'],
      createdAt: now(),
      updatedAt: now(),
    },
  ];

  const testPlans: TestPlan[] = [
    {
      id: planId,
      projectId,
      title: '登录功能回归测试计划',
      description: '覆盖密码登录、记住密码、账号锁定、OAuth登录等场景',
      status: 'in_progress',
      createdBy: adminId,
      createdAt: now(),
      updatedAt: now(),
    },
  ];

  const cases: TestCase[] = [
    { id: generateId(), planId, projectId, name: '用户名密码正确登录', description: '输入正确的用户名和密码，验证登录成功', precondition: '用户已注册', steps: '1. 打开登录页\n2. 输入正确用户名\n3. 输入正确密码\n4. 点击登录', expectedResult: '成功跳转到首页', priority: 'P0', tags: ['登录'], linkedTaskIds: [], status: 'passed', executionOrder: 1, createdAt: now(), updatedAt: now() },
    { id: generateId(), planId, projectId, name: '密码错误提示', description: '输入错误密码，验证提示信息', precondition: '用户已注册', steps: '1. 打开登录页\n2. 输入正确用户名\n3. 输入错误密码\n4. 点击登录', expectedResult: '提示密码错误', priority: 'P0', tags: ['登录', '错误处理'], linkedTaskIds: [], status: 'passed', executionOrder: 2, createdAt: now(), updatedAt: now() },
    { id: generateId(), planId, projectId, name: '连续错误5次锁定账号', description: '连续输入5次错误密码，验证账号锁定', precondition: '用户已注册，未锁定', steps: '1. 连续5次输入错误密码\n2. 第6次输入正确密码', expectedResult: '账号被锁定，提示30分钟后重试', priority: 'P1', tags: ['安全', '锁定'], linkedTaskIds: [], status: 'failed', executionOrder: 3, createdAt: now(), updatedAt: now() },
    { id: generateId(), planId, projectId, name: '记住密码功能', description: '勾选记住密码后，关闭浏览器重新打开验证', precondition: '用户已注册', steps: '1. 登录时勾选记住密码\n2. 关闭浏览器\n3. 重新打开登录页', expectedResult: '自动填充用户名和密码', priority: 'P2', tags: ['体验'], linkedTaskIds: [], status: 'passed', executionOrder: 4, createdAt: now(), updatedAt: now() },
    { id: generateId(), planId, projectId, name: '第三方OAuth登录', description: '使用Google/GitHub账号登录', precondition: '已绑定第三方账号', steps: '1. 点击GitHub登录\n2. 授权\n3. 验证跳转', expectedResult: '成功登录并跳转到首页', priority: 'P1', tags: ['OAuth'], linkedTaskIds: [], status: 'skipped', executionOrder: 5, createdAt: now(), updatedAt: now() },
    { id: generateId(), planId, projectId, name: '并发登录踢出', description: '同一账号在两个设备同时登录', precondition: '用户已注册', steps: '1. 设备A登录\n2. 设备B登录\n3. 设备A操作', expectedResult: '设备A被踢出，提示在其他设备登录', priority: 'P1', tags: ['并发', '安全'], linkedTaskIds: [], status: 'failed', executionOrder: 6, createdAt: now(), updatedAt: now() },
  ];

  const testRuns: TestRun[] = [
    {
      id: runId,
      planId,
      projectId,
      name: '第2轮回归测试',
      trigger: 'ai',
      environment: 'Chrome 120 / Windows 11',
      startedAt: now(),
      finishedAt: now(),
      createdBy: adminId,
    },
  ];

  const testResults: TestResult[] = cases.map((c, i) => ({
    id: generateId(),
    runId,
    caseId: c.id,
    status: c.status as 'passed' | 'failed' | 'skipped',
    actualResult: c.status === 'passed' ? '符合预期' : c.status === 'failed' ? '实际结果与预期不符' : '未执行',
    errorLog: c.status === 'failed' ? `AssertionError: 期望账号锁定，实际仍可登录\n  at TestCase${i + 1}.execute()` : '',
    durationMs: Math.floor(Math.random() * 5000) + 1000,
    executedAt: now(),
    executedBy: adminId,
  }));

  const defects: Defect[] = [
    {
      id: generateId(),
      projectId,
      resultId: testResults[2].id,
      caseId: cases[2].id,
      title: '连续错误5次未锁定账号',
      description: '连续输入5次错误密码后，第6次输入正确密码仍能登录成功，账号锁定机制未生效',
      severity: 'critical',
      status: 'open',
      assigneeId: adminId,
      reportedBy: adminId,
      createdAt: now(),
      updatedAt: now(),
    },
    {
      id: generateId(),
      projectId,
      resultId: testResults[5].id,
      caseId: cases[5].id,
      title: '并发登录未踢出先登录设备',
      description: '同一账号在两个设备登录后，先登录的设备未被踢出，两个设备可同时操作',
      severity: 'major',
      status: 'in_progress',
      assigneeId: adminId,
      reportedBy: adminId,
      createdAt: now(),
      updatedAt: now(),
    },
  ];

  return {
    users,
    apiKeys: [],
    projects,
    externalTasks: [],
    testPlans,
    testCases: cases,
    testRuns,
    testResults,
    screenshots: [],
    defects,
    solutions: [],
    retests: [],
    systemSettings: getDefaultSettings(),
    auditLogs: [],
    currentUserId: null,
    authToken: null,
  };
}

function loadData(): StoreData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  const seed = getSeedData();
  saveData(seed);
  return seed;
}

function saveData(data: StoreData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

type Listener = () => void;
const listeners = new Set<Listener>();

function notify(): void {
  listeners.forEach(fn => fn());
}

function getData(): StoreData {
  return loadData();
}

function updateData(fn: (data: StoreData) => void): StoreData {
  const data = loadData();
  fn(data);
  saveData(data);
  notify();
  return data;
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Auth
function login(username: string, password: string): { user: User; token: string } | null {
  const data = loadData();
  const user = data.users.find(u => u.username === username);
  if (!user || user.passwordHash !== hashPassword(password)) return null;
  const token = generateToken();
  updateData(d => { d.currentUserId = user.id; d.authToken = token; });
  return { user, token };
}

function logout(): void {
  updateData(d => { d.currentUserId = null; d.authToken = null; });
}

function getCurrentUser(): User | null {
  const data = loadData();
  if (!data.currentUserId) return null;
  return data.users.find(u => u.id === data.currentUserId) ?? null;
}

function isAuthenticated(): boolean {
  return loadData().authToken !== null;
}

// Projects
function createProject(name: string, description: string, tags: string[]): Project {
  const user = getCurrentUser();
  if (!user) throw new Error('Not authenticated');
  const project: Project = {
    id: generateId(), name, description, ownerId: user.id,
    status: 'active', tags, createdAt: now(), updatedAt: now(),
  };
  updateData(d => { d.projects.push(project); });
  return project;
}

function updateProject(id: string, updates: Partial<Project>): void {
  updateData(d => {
    const p = d.projects.find(x => x.id === id);
    if (p) Object.assign(p, updates, { updatedAt: now() });
  });
}

function deleteProject(id: string): void {
  updateData(d => {
    d.projects = d.projects.filter(p => p.id !== id);
    d.testPlans = d.testPlans.filter(p => p.projectId !== id);
    d.testCases = d.testCases.filter(c => c.projectId !== id);
    d.testRuns = d.testRuns.filter(r => r.projectId !== id);
    d.defects = d.defects.filter(df => df.projectId !== id);
  });
}

// Test Plans
function createTestPlan(projectId: string, title: string, description: string): TestPlan {
  const user = getCurrentUser();
  if (!user) throw new Error('Not authenticated');
  const plan: TestPlan = {
    id: generateId(), projectId, title, description,
    status: 'draft', createdBy: user.id, createdAt: now(), updatedAt: now(),
  };
  updateData(d => { d.testPlans.push(plan); });
  return plan;
}

function updateTestPlan(id: string, updates: Partial<TestPlan>): void {
  updateData(d => {
    const p = d.testPlans.find(x => x.id === id);
    if (p) Object.assign(p, updates, { updatedAt: now() });
  });
}

// Test Cases
function createTestCase(data: Omit<TestCase, 'id' | 'createdAt' | 'updatedAt'>): TestCase {
  const tc: TestCase = { ...data, id: generateId(), createdAt: now(), updatedAt: now() };
  updateData(d => { d.testCases.push(tc); });
  return tc;
}

function updateTestCase(id: string, updates: Partial<TestCase>): void {
  updateData(d => {
    const c = d.testCases.find(x => x.id === id);
    if (c) Object.assign(c, updates, { updatedAt: now() });
  });
}

function deleteTestCase(id: string): void {
  updateData(d => { d.testCases = d.testCases.filter(c => c.id !== id); });
}

// Test Runs
function createTestRun(planId: string, projectId: string, name: string, trigger: 'manual' | 'ai' | 'ci', environment: string): TestRun {
  const user = getCurrentUser();
  if (!user) throw new Error('Not authenticated');
  const run: TestRun = {
    id: generateId(), planId, projectId, name, trigger, environment,
    startedAt: now(), createdBy: user.id,
  };
  updateData(d => { d.testRuns.push(run); });
  return run;
}

function finishTestRun(id: string): void {
  updateData(d => {
    const r = d.testRuns.find(x => x.id === id);
    if (r) r.finishedAt = now();
  });
}

// Test Results
function submitTestResult(runId: string, caseId: string, status: 'passed' | 'failed' | 'skipped' | 'blocked', actualResult: string, errorLog: string, durationMs: number): TestResult {
  const user = getCurrentUser();
  if (!user) throw new Error('Not authenticated');
  const result: TestResult = {
    id: generateId(), runId, caseId, status, actualResult, errorLog, durationMs,
    executedAt: now(), executedBy: user.id,
  };
  updateData(d => {
    d.testResults.push(result);
    const tc = d.testCases.find(c => c.id === caseId);
    if (tc) tc.status = status;
  });
  return result;
}

// Screenshots
function addScreenshot(resultId: string, dataUrl: string, caption: string): Screenshot {
  const ss: Screenshot = {
    id: generateId(), resultId, dataUrl, caption,
    sortOrder: getData().screenshots.filter(s => s.resultId === resultId).length,
    createdAt: now(),
  };
  updateData(d => { d.screenshots.push(ss); });
  return ss;
}

// Defects
function createDefect(projectId: string, resultId: string, caseId: string, title: string, description: string, severity: Defect['severity']): Defect {
  const user = getCurrentUser();
  if (!user) throw new Error('Not authenticated');
  const defect: Defect = {
    id: generateId(), projectId, resultId, caseId, title, description, severity,
    status: 'open', assigneeId: user.id, reportedBy: user.id,
    createdAt: now(), updatedAt: now(),
  };
  updateData(d => { d.defects.push(defect); });
  return defect;
}

function updateDefect(id: string, updates: Partial<Defect>): void {
  updateData(d => {
    const df = d.defects.find(x => x.id === id);
    if (df) Object.assign(df, updates, { updatedAt: now() });
  });
}

// Solutions
function createSolution(defectId: string, title: string, description: string, rootCause: string, fixDescription: string, fixCommitUrl: string): Solution {
  const user = getCurrentUser();
  if (!user) throw new Error('Not authenticated');
  const solution: Solution = {
    id: generateId(), defectId, title, description, rootCause, fixDescription, fixCommitUrl,
    resolvedBy: user.id, resolvedAt: now(), createdAt: now(),
  };
  updateData(d => {
    d.solutions.push(solution);
    const df = d.defects.find(x => x.id === defectId);
    if (df) { df.status = 'fixed'; df.updatedAt = now(); }
  });
  return solution;
}

// Retests
function createRetest(defectId: string, resultId: string, runId: string, status: 'passed' | 'failed', notes: string): Retest {
  const user = getCurrentUser();
  if (!user) throw new Error('Not authenticated');
  const retest: Retest = {
    id: generateId(), defectId, resultId, runId, status, notes,
    retestedBy: user.id, retestedAt: now(), createdAt: now(),
  };
  updateData(d => {
    d.retests.push(retest);
    const df = d.defects.find(x => x.id === defectId);
    if (df) {
      df.status = status === 'passed' ? 'verified' : 'reopened';
      df.updatedAt = now();
    }
  });
  return retest;
}

// External Tasks
function createExternalTask(projectId: string, title: string, source: ExternalTask['source'], externalUrl: string, externalId: string): ExternalTask {
  const task: ExternalTask = {
    id: generateId(), projectId, title, source, externalUrl, externalId, createdAt: now(),
  };
  updateData(d => { d.externalTasks.push(task); });
  return task;
}

// API Keys
function createApiKey(name: string, permissions: string[]): ApiKey {
  const user = getCurrentUser();
  if (!user) throw new Error('Not authenticated');
  const apiKey: ApiKey = {
    id: generateId(), userId: user.id, key: 'sk_' + crypto.randomUUID().replace(/-/g, ''),
    name, permissions, status: 'active', createdAt: now(),
  };
  updateData(d => { d.apiKeys.push(apiKey); });
  return apiKey;
}

function revokeApiKey(id: string): void {
  updateData(d => {
    const k = d.apiKeys.find(x => x.id === id);
    if (k) k.status = 'revoked';
  });
}

function deleteApiKey(id: string): void {
  updateData(d => {
    d.apiKeys = d.apiKeys.filter(k => k.id !== id);
  });
}

// Users
function createUser(username: string, password: string, role: 'admin' | 'member'): User {
  const user: User = {
    id: generateId(), username, passwordHash: hashPassword(password),
    role, createdAt: now(),
  };
  updateData(d => { d.users.push(user); });
  return user;
}

function deleteUser(id: string): void {
  updateData(d => { d.users = d.users.filter(u => u.id !== id); });
}

// System Settings
function updateSettings(updates: Partial<SystemSettings>): void {
  updateData(d => { Object.assign(d.systemSettings, updates); });
}

// Queries
function getProjects(): Project[] {
  return getData().projects;
}

function getProject(id: string): Project | undefined {
  return getData().projects.find(p => p.id === id);
}

function getTestPlans(projectId: string): TestPlan[] {
  return getData().testPlans.filter(p => p.projectId === projectId);
}

function getTestPlan(id: string): TestPlan | undefined {
  return getData().testPlans.find(p => p.id === id);
}

function getTestCases(projectId: string): TestCase[] {
  return getData().testCases.filter(c => c.projectId === projectId).sort((a, b) => a.executionOrder - b.executionOrder);
}

function getTestCasesByPlan(planId: string): TestCase[] {
  return getData().testCases.filter(c => c.planId === planId).sort((a, b) => a.executionOrder - b.executionOrder);
}

function getTestCase(id: string): TestCase | undefined {
  return getData().testCases.find(c => c.id === id);
}

function getTestRuns(projectId: string): TestRun[] {
  return getData().testRuns.filter(r => r.projectId === projectId).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

function getTestRun(id: string): TestRun | undefined {
  return getData().testRuns.find(r => r.id === id);
}

function getTestResults(runId: string): TestResult[] {
  return getData().testResults.filter(r => r.runId === runId);
}

function getTestResultsByCase(caseId: string): TestResult[] {
  return getData().testResults.filter(r => r.caseId === caseId).sort((a, b) => b.executedAt.localeCompare(a.executedAt));
}

function getResult(id: string): TestResult | undefined {
  return getData().testResults.find(r => r.id === id);
}

function getScreenshots(resultId: string): Screenshot[] {
  return getData().screenshots.filter(s => s.resultId === resultId).sort((a, b) => a.sortOrder - b.sortOrder);
}

function getDefects(projectId: string): Defect[] {
  return getData().defects.filter(d => d.projectId === projectId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function getDefect(id: string): Defect | undefined {
  return getData().defects.find(d => d.id === id);
}

function getSolutions(defectId: string): Solution[] {
  return getData().solutions.filter(s => s.defectId === defectId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function getRetests(defectId: string): Retest[] {
  return getData().retests.filter(r => r.defectId === defectId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function getExternalTasks(projectId: string): ExternalTask[] {
  return getData().externalTasks.filter(t => t.projectId === projectId);
}

function getApiKeys(): ApiKey[] {
  const user = getCurrentUser();
  if (!user) return [];
  return getData().apiKeys.filter(k => k.userId === user.id);
}

function getUsers(): User[] {
  return getData().users;
}

function getSettings(): SystemSettings {
  return getData().systemSettings;
}

function getDashboardStats(projectId: string) {
  const data = getData();
  const cases = data.testCases.filter(c => c.projectId === projectId);
  const results = data.testResults.filter(r => {
    const tc = data.testCases.find(c => c.id === r.caseId);
    return tc?.projectId === projectId;
  });
  const defects = data.defects.filter(d => d.projectId === projectId);
  const plans = data.testPlans.filter(p => p.projectId === projectId);

  const passed = results.filter(r => r.status === 'passed').length;
  const failed = results.filter(r => r.status === 'failed').length;
  const skipped = results.filter(r => r.status === 'skipped').length;
  const blocked = results.filter(r => r.status === 'blocked').length;
  const total = results.length;
  const passRate = total > 0 ? Math.round((passed / total) * 1000) / 10 : 0;
  const totalDuration = results.reduce((sum, r) => sum + r.durationMs, 0);

  return {
    planCount: plans.length,
    caseCount: cases.length,
    passRate,
    failedCount: failed,
    totalDuration,
    passed, failed, skipped, blocked, total,
    openDefects: defects.filter(d => d.status === 'open' || d.status === 'reopened').length,
    recentResults: results.sort((a, b) => b.executedAt.localeCompare(a.executedAt)).slice(0, 10),
  };
}

export const store = {
  getData, subscribe,
  login, logout, getCurrentUser, isAuthenticated,
  createProject, updateProject, deleteProject,
  getProjects, getProject,
  createTestPlan, updateTestPlan, getTestPlans, getTestPlan,
  createTestCase, updateTestCase, deleteTestCase, getTestCases, getTestCasesByPlan, getTestCase,
  createTestRun, finishTestRun, getTestRuns, getTestRun,
  submitTestResult, getTestResults, getTestResultsByCase, getResult,
  addScreenshot, getScreenshots,
  createDefect, updateDefect, getDefects, getDefect,
  createSolution, getSolutions,
  createRetest, getRetests,
  createExternalTask, getExternalTasks,
  createApiKey, revokeApiKey, deleteApiKey, getApiKeys,
  createUser, deleteUser, getUsers,
  updateSettings, getSettings,
  getDashboardStats,
};
