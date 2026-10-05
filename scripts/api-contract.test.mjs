import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

async function importTypeScript(path) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}

const { api, MAX_ERROR_LOG_LENGTH } = await importTypeScript('../lib/api.ts');
const { nextManualDefectStatus } = await importTypeScript('../lib/types.ts');
const response = (body, status = 200) => new Response(JSON.stringify(body), { status });

test('run lifecycle DTO ignores metadata updates and retains true completion time', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const createdAt = '2026-10-05T10:00:00Z';
  const finishedAt = '2026-10-05T10:30:00Z';
  const rows = [
    { id: 'running', status: 'running', created_at: createdAt, updated_at: finishedAt },
    { id: 'completed', status: 'completed', created_at: createdAt, finished_at: finishedAt, updated_at: '2026-10-05T11:00:00Z' },
  ];
  globalThis.fetch = async () => response({ items: rows });
  const runs = await api.getTestRuns();
  assert.equal(runs[0].status, 'running');
  assert.equal(runs[0].finishedAt, undefined);
  assert.equal(runs[1].status, 'completed');
  assert.equal(runs[1].finishedAt, finishedAt);
  globalThis.fetch = async () => response({ item: rows[0] });
  assert.equal((await api.createTestRun({ name: 'new' })).finishedAt, undefined);
  globalThis.fetch = async () => response({ item: rows[1] });
  assert.equal((await api.updateTestRun('completed', { name: 'renamed' })).finishedAt, finishedAt);
});

test('Unicode multiline logs round-trip unchanged and failed saves reject', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const errorLog = '第一行：错误 🧪\n第二行\r\ntrace\t尾行';
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    assert.equal(body.errorLog, errorLog);
    return response({ item: { id: 'result', status: 'failed', error_log: body.errorLog } }, 201);
  };
  const saved = await api.createTestResult({ status: 'failed', errorLog });
  assert.equal(saved.errorLog, errorLog);
  globalThis.fetch = async () => response({ items: [{ id: 'result', error_log: errorLog }], total: 1, nextOffset: null });
  assert.equal((await api.getTestResults())[0].errorLog, errorLog);
  globalThis.fetch = async () => response({ error: 'database_request_failed' }, 503);
  await assert.rejects(api.createTestResult({ errorLog }), /database_request_failed/);
});

test('log limit counts Unicode code points and rejects oversize before sending', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let requests = 0;
  globalThis.fetch = async (_url, options) => {
    requests++;
    return response({ item: { error_log: JSON.parse(options.body).errorLog } });
  };
  const maximum = '🧪'.repeat(MAX_ERROR_LOG_LENGTH);
  assert.equal((await api.createTestResult({ errorLog: maximum })).errorLog, maximum);
  await assert.rejects(api.createTestResult({ errorLog: maximum + 'a' }));
  assert.equal(requests, 1);
});

test('result pagination follows nextOffset with scoped filters and fails invalid cursors', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const urls = [];
  globalThis.fetch = async url => {
    const params = new URL(url, 'http://localhost').searchParams;
    urls.push(params);
    return response({ items: [{ id: params.get('offset'), error_log: 'trace\n中文' }], total: 2, nextOffset: params.get('offset') === '0' ? 100 : null });
  };
  assert.equal((await api.getTestResults('run', 'case', 'project')).length, 2);
  assert.deepEqual(urls.map(p => p.get('offset')), ['0', '100']);
  for (const params of urls) {
    assert.equal(params.get('runId'), 'run');
    assert.equal(params.get('caseId'), 'case');
    assert.equal(params.get('projectId'), 'project');
    assert.equal(params.get('pageSize'), '100');
  }
  globalThis.fetch = async () => response({ items: [], total: 2, nextOffset: 0 });
  await assert.rejects(api.getTestResults(), /pagination/);
});

test('manual defect flow reopens into repair and cannot bypass verification', () => {
  assert.equal(nextManualDefectStatus('reopened'), 'in_progress');
  assert.equal(nextManualDefectStatus('open'), 'in_progress');
  assert.equal(nextManualDefectStatus('in_progress'), 'fixed');
  assert.equal(nextManualDefectStatus('verified'), 'closed');
  assert.equal(nextManualDefectStatus('fixed'), undefined);
  assert.equal(nextManualDefectStatus('closed'), undefined);
});
