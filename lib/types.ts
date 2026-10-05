export type Role = 'admin' | 'member';

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  role: Role;
  avatarUrl?: string;
  createdAt: string;
}

export interface ApiKey {
  id: string;
  userId: string;
  key: string;
  name: string;
  permissions: string[];
  status: 'active' | 'revoked';
  lastUsedAt?: string;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  status: 'active' | 'archived';
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ExternalTask {
  id: string;
  projectId: string;
  title: string;
  source: 'jira' | 'github' | 'manual' | 'other';
  externalUrl: string;
  externalId: string;
  createdAt: string;
}

export interface TestPlan {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: 'draft' | 'ready' | 'in_progress' | 'completed';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface TestCase {
  id: string;
  planId: string;
  projectId: string;
  name: string;
  description: string;
  precondition: string;
  steps: string;
  expectedResult: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  tags: string[];
  linkedTaskIds: string[];
  status: 'pending' | 'passed' | 'failed' | 'skipped' | 'blocked';
  executionOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface TestRun {
  id: string;
  planId: string;
  projectId: string;
  name: string;
  trigger: 'manual' | 'ai' | 'ci';
  environment: string;
  status: 'running' | 'completed';
  startedAt: string;
  finishedAt?: string;
  createdBy: string;
}

export interface TestResult {
  id: string;
  runId: string;
  caseId: string;
  status: 'passed' | 'failed' | 'skipped' | 'blocked';
  actualResult: string;
  errorLog: string;
  durationMs: number;
  executedAt: string;
  executedBy: string;
}

export interface Screenshot {
  id: string;
  resultId: string;
  dataUrl: string;
  caption: string;
  sortOrder: number;
  createdAt: string;
}

export type DefectSeverity = 'critical' | 'major' | 'minor' | 'trivial';
export type DefectStatus = 'open' | 'in_progress' | 'fixed' | 'verified' | 'closed' | 'reopened';

// Verification comes from a retest; it cannot be skipped by the manual button.
export function nextManualDefectStatus(status: DefectStatus): DefectStatus | undefined {
  switch (status) {
    case 'open':
    case 'reopened': return 'in_progress';
    case 'in_progress': return 'fixed';
    case 'verified': return 'closed';
    default: return undefined;
  }
}

export interface Defect {
  id: string;
  projectId: string;
  resultId: string;
  caseId: string;
  title: string;
  description: string;
  severity: DefectSeverity;
  status: DefectStatus;
  assigneeId: string;
  reportedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Solution {
  id: string;
  defectId: string;
  title: string;
  description: string;
  rootCause: string;
  fixDescription: string;
  fixCommitUrl: string;
  resolvedBy: string;
  resolvedAt: string;
  createdAt: string;
}

export interface Retest {
  id: string;
  defectId: string;
  resultId: string;
  runId: string;
  status: 'passed' | 'failed';
  notes: string;
  retestedBy: string;
  retestedAt: string;
  createdAt: string;
}

export interface SystemSettings {
  maxScreenshotSize: number;
  maxScreenshotsPerResult: number;
  maxProjectsPerUser: number;
  resultRetentionDays: number;
  webhookUrl: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  targetType: string;
  targetId: string;
  detail: string;
  createdAt: string;
}
