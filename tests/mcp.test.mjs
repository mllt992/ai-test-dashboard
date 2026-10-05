import test from 'node:test';
import assert from 'node:assert/strict';
import { handleApp } from '../functions/handler.mjs';
import { createFixture, FIXTURE_PROJECT } from '../dev/fixture.mjs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

function request(body, headers = {}) {
  return new Request('http://127.0.0.1:8000/functions/v1/app/mcp', {
    method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...headers },
    body: JSON.stringify(body),
  });
}
const rpc = (method, params = {}, id = 1) => ({ jsonrpc: '2.0', id, method, params });
const call = (name, args) => rpc('tools/call', { name, arguments: args });
async function send(fixture, body, headers) {
  const response = await handleApp({ request: request(body, headers), supabase: fixture });
  const responseText = await response.clone().text();
  return { response, body: responseText ? JSON.parse(responseText) : null };
}
const content = body => JSON.parse(body.result.content[0].text);

test('MCP initialize → initialized → tools/list → tools/call preserves two cases and screenshots', async () => {
  const fixture = createFixture();
  const initialized = await send(fixture, rpc('initialize', {
    protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'fixture-client', version: '1' },
  }, 0));
  assert.equal(initialized.body.id, 0);
  assert.equal(initialized.body.result.protocolVersion, '2025-11-25');
  assert.equal(initialized.body.result.serverInfo.name, 'test-dashboard');
  assert.deepEqual(initialized.body.result.capabilities, { tools: { listChanged: false } });
  const notification = await send(fixture, { jsonrpc: '2.0', method: 'notifications/initialized' }, { 'mcp-protocol-version': '2025-11-25' });
  assert.equal(notification.response.status, 202);
  assert.equal(await notification.response.text(), '');
  const listed = await send(fixture, rpc('tools/list'));
  const casesSchema = listed.body.result.tools.find(t => t.name === 'add_test_cases').inputSchema;
  assert.deepEqual(casesSchema.required, ['projectId', 'cases']);
  assert.equal(casesSchema.properties.cases.type, 'array');
  assert.deepEqual(casesSchema.properties.cases.items.required, ['name']);
  const args = { projectId: FIXTURE_PROJECT, cases: [
    { name: 'first', priority: 'P0', sortOrder: 2, steps: 'do first', expected: 'first works' },
    { name: 'second', priority: 'P2', sortOrder: 3, precondition: 'ready' },
  ] };
  const added = await send(fixture, call('add_test_cases', args));
  assert.equal(added.body.error, undefined);
  const cases = content(added.body);
  assert.equal(cases.length, 2);
  assert.equal(cases[0].project_id, FIXTURE_PROJECT);
  assert.equal(cases[0].steps, 'do first');
  assert.equal(cases[0].expected, 'first works');
  assert.equal(cases[0].sort_order, 2);
  assert.equal(cases[1].precondition, 'ready');
  assert.equal(fixture.tables.test_cases.length, 3);
  fixture.tables.test_results.push({ id: 'result-one', screenshots: [] });
  const screenshots = ['https://example.invalid/fixture.png', { dataUrl: 'data:image/png;base64,bG9jYWw=', caption: 'fixture image', sortOrder: 1 }];
  const uploaded = await send(fixture, call('upload_screenshots', { resultId: 'result-one', screenshots }));
  assert.deepEqual(content(uploaded.body).screenshots, screenshots);
  assert.deepEqual(fixture.tables.test_results[0].screenshots, screenshots);
});

test('invalid arrays, nested values, required fields, enums, and integers are rejected before writes', async () => {
  const fixture = createFixture();
  let accesses = 0;
  const unavailable = { from() { accesses++; throw new Error('must not access database'); }, rpc() { accesses++; throw new Error('must not access database'); } };
  const invalid = [
    ['add_test_cases', { projectId: FIXTURE_PROJECT, cases: 'case' }],
    ['add_test_cases', { projectId: FIXTURE_PROJECT, cases: [] }],
    ['add_test_cases', { projectId: FIXTURE_PROJECT, cases: [{ name: 'good' }, {}] }],
    ['add_test_cases', { projectId: FIXTURE_PROJECT, cases: [{ name: 'bad', priority: 'P7' }] }],
    ['add_test_cases', { projectId: FIXTURE_PROJECT, cases: [{ name: 'bad', sortOrder: 0.5 }] }],
    ['create_project', { name: '  ' }],
    ['create_project', { name: 'good', unexpected: 'do not echo this' }],
    ['list_projects', { limit: 10 }],
    ['list_projects', { offset: 10 }],
    ['submit_test_result', { runId: 'run', caseId: 'case' }],
    ['submit_test_result', { runId: 'run', caseId: 'case', status: 'unknown' }],
    ['submit_test_result', { runId: 'run', caseId: 'case', status: 'passed', durationMs: -1 }],
    ['submit_test_result', { runId: 'run', caseId: 'case', status: 'passed', errorLog: 'a'.repeat(65537) }],
    ['submit_test_result', { runId: 'run', caseId: 'case', status: 'passed', executedAt: 'yesterday' }],
    ['upload_screenshots', { resultId: 'result', screenshots: 'wrong' }],
    ['upload_screenshots', { resultId: 'result', screenshots: [{}] }],
    ['upload_screenshots', { resultId: 'result', screenshots: [{ dataUrl: 'image', sortOrder: -1 }] }],
    ['create_retest', { defectId: 'defect', status: 'skipped' }],
  ];
  for (const [name, args] of invalid) {
    const result = await send(unavailable, call(name, args));
    assert.equal(result.body.error.code, -32602, name);
  }
  assert.equal(accesses, 0);
  assert.equal(fixture.tables.test_cases.length, 1);
});

test('JSON-RPC parse, envelope, method, version, and notification behavior', async () => {
  const fixture = createFixture();
  const parseResponse = await handleApp({ request: new Request('http://localhost/mcp', { method: 'POST', body: '{' }), supabase: fixture });
  assert.equal((await parseResponse.json()).error.code, -32700);
  const invalid = await send(fixture, []);
  assert.equal(invalid.body.error.code, -32600);
  const unknown = await send(fixture, rpc('missing-method'));
  assert.equal(unknown.body.error.code, -32601);
  const unknownTool = await send(fixture, call('missing-tool', {}));
  assert.equal(unknownTool.body.error.code, -32602);
  const negotiated = await send(fixture, rpc('initialize', { protocolVersion: 'future', capabilities: {}, clientInfo: { name: 'client', version: '1' } }));
  assert.equal(negotiated.body.result.protocolVersion, '2025-11-25');
  const version = await send(fixture, rpc('ping'), { 'mcp-protocol-version': 'unsupported' });
  assert.equal(version.response.status, 400);
  const ping = await send(fixture, rpc('ping'));
  assert.deepEqual(ping.body.result, {});
  const ignored = await send(fixture, { jsonrpc: '2.0', method: 'notifications/cancelled', params: { requestId: 4 } });
  assert.equal(ignored.response.status, 202);
  const toolsAsNotification = await send(fixture, { jsonrpc: '2.0', method: 'tools/call', params: { name: 'create_project', arguments: { name: 'do not write' } } });
  assert.equal(toolsAsNotification.response.status, 400);
  assert.equal(fixture.tables.projects.length, 1);
});

test('Streamable HTTP declines SSE and rejects foreign origins', async () => {
  const fixture = createFixture();
  const get = await handleApp({ request: new Request('http://localhost/mcp'), supabase: fixture });
  assert.equal(get.status, 405);
  assert.equal(get.headers.get('allow'), 'POST');
  const badOrigin = await send(fixture, rpc('ping'), { origin: 'http://external.invalid' });
  assert.equal(badOrigin.response.status, 403);
  const sameOrigin = await send(fixture, rpc('ping'), { origin: 'http://127.0.0.1:8000' });
  assert.equal(sameOrigin.response.status, 200);
});

test('tool execution failures are marked isError without leaking provider details', async () => {
  const failing = { from() { throw new Error('SECRET_PROVIDER_DETAIL'); } };
  const result = await send(failing, call('add_test_cases', { projectId: FIXTURE_PROJECT, cases: [{ name: 'case' }] }));
  assert.equal(result.body.result.isError, true);
  assert.equal(JSON.stringify(result.body).includes('SECRET_PROVIDER_DETAIL'), false);
  const missing = await send(createFixture(), call('upload_screenshots', { resultId: 'missing', screenshots: [] }));
  assert.equal(missing.body.result.isError, true);
});

test('official MCP SDK client completes a standard Streamable HTTP connection and writes a batch', async () => {
  const fixture = createFixture();
  const methods = [];
  const transport = new StreamableHTTPClientTransport(new URL('http://127.0.0.1:8000/mcp'), {
    fetch: async (url, init) => {
      const incoming = new Request(url, init);
      if (incoming.method === 'POST') methods.push((await incoming.clone().json()).method);
      return handleApp({ request: incoming, supabase: fixture });
    },
  });
  const client = new Client({ name: 'automated-sdk-client', version: '1.0.0' });
  try {
    await client.connect(transport);
    const tools = await client.listTools();
    assert.equal(tools.tools.length, 13);
    assert.equal(client.getServerVersion().name, 'test-dashboard');
    const result = await client.callTool({ name: 'add_test_cases', arguments: { projectId: FIXTURE_PROJECT, cases: [{ name: 'SDK first' }, { name: 'SDK second' }] } });
    assert.equal(result.isError, undefined);
    assert.equal(JSON.parse(result.content[0].text).length, 2);
    assert.deepEqual(methods.slice(0, 4), ['initialize', 'notifications/initialized', 'tools/list', 'tools/call']);
    assert.equal(fixture.tables.test_cases.length, 3);
  } finally {
    await client.close();
  }
});
