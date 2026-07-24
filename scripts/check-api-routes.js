import fs from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

const clientRoot = process.cwd();
const isExtension = clientRoot.toLowerCase().endsWith('pangupayextension');
const sourceRoot = path.join(clientRoot, isExtension ? 'src' : 'js');
const apiPath = path.join(sourceRoot, isExtension ? 'core' : 'config', 'api.ts');
const backendRoot = process.env.PANGU_BACKEND_REPO
  ? path.resolve(process.env.PANGU_BACKEND_REPO)
  : path.resolve(clientRoot, '..', 'UTXO-Area');
const gatewayPath = path.join(backendRoot, 'gateway', 'server.go');

// This is the client-side HTTP contract. Some endpoint values travel through
// URL builders before reaching fetch(), so their method cannot be recovered
// reliably from a local AST parent walk. Keep the method next to the route
// gate and verify it against both directly visible calls and Gateway routes.
const METHOD_CONTRACT = Object.freeze({
  HEALTH: 'GET',
  GROUPS_LIST: 'GET',
  GROUP_INFO: 'GET',
  COMMITTEE_ENDPOINT: 'GET',
  ASSIGN_HEALTH: 'GET',
  ASSIGN_NEW_ADDRESS: 'POST',
  ASSIGN_UNBIND_ADDRESS: 'POST',
  ASSIGN_CAPSULE_GENERATE: 'POST',
  ASSIGN_FLOW_APPLY: 'POST',
  ASSIGN_SUBMIT_TX: 'POST',
  ASSIGN_TX_STATUS: 'GET',
  ASSIGN_RE_ONLINE: 'POST',
  ASSIGN_GROUP_INFO: 'GET',
  ASSIGN_ACCOUNT_UPDATE: 'GET',
  ASSIGN_TXCER_CHANGE: 'GET',
  ASSIGN_TXCER_STATUSES: 'GET',
  ASSIGN_TXCER_STATUS: 'GET',
  ASSIGN_TXCER_STATUS_CHANGE: 'GET',
  ASSIGN_SCHEDULER_STATS: 'GET',
  ASSIGN_SCHEDULER_DAG_RECORDS: 'GET',
  ASSIGN_SCHEDULER_DAG_EVENTS: 'GET',
  ASSIGN_AUDIT_EVENTS: 'GET',
  ASSIGN_CHALLENGES: 'GET',
  ASSIGN_PENALTIES: 'GET',
  ASSIGN_CERTIFIERS: 'GET',
  ASSIGN_CROSS_ORG_TXCER: 'GET',
  AGGR_TXCER_ISSUANCE_RECORDS: 'GET',
  AGGR_TXCER_ISSUANCE_RECORD: 'GET',
  AGGR_TXCER_ISSUANCE_BATCH: 'GET',
  AGGR_AUDIT_EVENTS: 'GET',
  AGGR_CHALLENGES: 'GET',
  AGGR_CERTIFIERS: 'GET',
  AGGR_CERTIFIER_STATS: 'GET',
  AGGR_CERTIFIER_PENDING_REQUESTS: 'GET',
  COM_HEALTH: 'GET',
  COM_QUERY_ADDRESS: 'POST',
  COM_QUERY_ADDRESS_GROUP: 'POST',
  COM_REGISTER_ADDRESS: 'POST',
  COM_CAPSULE_GENERATE: 'POST',
  COM_PUBLIC_KEY: 'GET',
  COM_SUBMIT_NOGUARGROUP_TX: 'POST',
  COM_CHALLENGES: 'GET',
  ORG_PUBLIC_KEY: 'GET',
});

function normalizedRoute(raw) {
  return String(raw || '')
    .trim()
    .replace(/^['"`]|['"`]$/g, '')
    .split('?')[0]
    .replace(/\$\{[^}]+\}/g, '{}')
    .replace(/\{[^}]+\}/g, '{}')
    .replace(/\/+$/, '') || '/';
}

function propertyName(node) {
  return node && (ts.isIdentifier(node) || ts.isStringLiteral(node)) ? node.text : '';
}

function endpointText(node, sourceFile) {
  let value = node;
  while (ts.isAsExpression(value) || ts.isParenthesizedExpression(value)) value = value.expression;
  if (ts.isArrowFunction(value)) value = value.body;
  if (ts.isStringLiteralLike(value)) return value.text;
  if (ts.isTemplateExpression(value) || ts.isNoSubstitutionTemplateLiteral(value)) {
    return value.getText(sourceFile).replace(/\$\{[^}]+\}/g, '{}').replace(/^`|`$/g, '');
  }
  return '';
}

function extractEndpointDefinitions(source) {
  const sourceFile = ts.createSourceFile(apiPath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const endpoints = new Map();
  function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'API_ENDPOINTS' && node.initializer) {
      let initializer = node.initializer;
      while (ts.isAsExpression(initializer) || ts.isParenthesizedExpression(initializer)) initializer = initializer.expression;
      if (ts.isObjectLiteralExpression(initializer)) {
        for (const property of initializer.properties) {
          if (!ts.isPropertyAssignment(property)) continue;
          const name = propertyName(property.name);
          const route = endpointText(property.initializer, sourceFile);
          if (name && route) endpoints.set(name, route);
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return endpoints;
}

function extractBackendRoutes(source) {
  const routes = new Map();
  const expression = /HandleFunc\(\s*"([^"]+)"[\s\S]{0,240}?\)\.Methods\(([^)]*)\)/g;
  for (const match of source.matchAll(expression)) {
    const route = normalizedRoute(match[1]);
    const methods = new Set([...match[2].matchAll(/"([A-Z]+)"/g)].map(item => item[1]));
    routes.set(route, methods);
  }
  return routes;
}

async function listTypeScriptFiles(root) {
  const files = [];
  async function walk(dir) {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(absolute);
      else if (entry.isFile() && entry.name.endsWith('.ts')) files.push(absolute);
    }
  }
  await walk(root);
  return files;
}

function methodFromOptions(call) {
  for (const argument of call.arguments.slice(1)) {
    if (!ts.isObjectLiteralExpression(argument)) continue;
    for (const property of argument.properties) {
      if (!ts.isPropertyAssignment(property) || propertyName(property.name).toLowerCase() !== 'method') continue;
      if (ts.isStringLiteralLike(property.initializer)) return property.initializer.text.toUpperCase();
    }
  }
  return '';
}

function inferMethod(node) {
  let current = node;
  for (let depth = 0; current && depth < 16; depth += 1, current = current.parent) {
    if (ts.isCallExpression(current)) {
      const expression = current.expression;
      if (ts.isPropertyAccessExpression(expression)) {
        const name = expression.name.text.toLowerCase();
        if (['get', 'post', 'put', 'delete', 'patch'].includes(name)) return name.toUpperCase();
        if (name === 'request') return methodFromOptions(current) || 'UNKNOWN';
      }
      if (ts.isIdentifier(expression) && ['fetch', 'secureFetchWithRetry'].includes(expression.text)) {
        return methodFromOptions(current) || 'GET';
      }
    }
    if (ts.isNewExpression(current) && ts.isIdentifier(current.expression) && current.expression.text === 'EventSource') {
      return 'GET';
    }
  }
  return 'UNKNOWN';
}

async function collectEndpointUses(files) {
  const uses = new Map();
  for (const file of files) {
    const source = await fs.readFile(file, 'utf8');
    const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    function visit(node) {
      if (
        ts.isPropertyAccessExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'API_ENDPOINTS'
      ) {
        const key = node.name.text;
        if (!uses.has(key)) uses.set(key, { methods: new Set(), files: new Set() });
        const use = uses.get(key);
        use.methods.add(inferMethod(node));
        use.files.add(path.relative(clientRoot, file));
      }
      ts.forEachChild(node, visit);
    }
    visit(sourceFile);
  }
  return uses;
}

async function run() {
  const [apiSource, gatewaySource, files] = await Promise.all([
    fs.readFile(apiPath, 'utf8'),
    fs.readFile(gatewayPath, 'utf8'),
    listTypeScriptFiles(sourceRoot),
  ]);
  const endpoints = extractEndpointDefinitions(apiSource);
  const backendRoutes = extractBackendRoutes(gatewaySource);
  const uses = await collectEndpointUses(files);
  const errors = [];

  for (const forbidden of ['/api/v1/committee/qc/', '/aggr/txcer`', '/aggr/txcer\'']) {
    if (apiSource.includes(forbidden)) errors.push(`obsolete endpoint remains in API config: ${forbidden}`);
  }

  for (const [key, rawRoute] of endpoints) {
    const route = normalizedRoute(rawRoute);
    if (!backendRoutes.has(route)) {
      errors.push(`${key}: configured route ${rawRoute} is not registered by gateway/server.go`);
    }
    if (!METHOD_CONTRACT[key]) errors.push(`${key}: configured route has no client HTTP method contract`);
  }

  for (const key of Object.keys(METHOD_CONTRACT)) {
    if (!endpoints.has(key)) errors.push(`${key}: method contract exists but endpoint is not defined`);
  }

  for (const [key, use] of uses) {
    const rawRoute = endpoints.get(key);
    if (!rawRoute) {
      errors.push(`${key}: used by ${[...use.files].join(', ')} but not defined`);
      continue;
    }
    const route = normalizedRoute(rawRoute);
    const backendMethods = backendRoutes.get(route);
    if (!backendMethods) {
      errors.push(`${key}: ${rawRoute} is not registered by gateway/server.go`);
      continue;
    }
    const declaredMethod = METHOD_CONTRACT[key];
    if (!declaredMethod) {
      errors.push(`${key}: used by ${[...use.files].join(', ')} without an HTTP method contract`);
      continue;
    }
    if (!backendMethods.has(declaredMethod)) {
      errors.push(`${key}: client contract declares ${declaredMethod} ${rawRoute}; backend allows ${[...backendMethods].join(', ')}`);
    }
    const knownMethods = [...use.methods].filter(method => method !== 'UNKNOWN');
    for (const method of knownMethods) {
      if (method !== declaredMethod) {
        errors.push(`${key}: source visibly uses ${method} ${rawRoute}; client contract declares ${declaredMethod}`);
      }
    }
  }

  console.log(`Backend route contract: ${gatewayPath}`);
  console.log(`Client endpoints: ${endpoints.size}; referenced: ${uses.size}; backend routes: ${backendRoutes.size}`);
  if (errors.length > 0) {
    for (const error of errors) console.error(`ERROR: ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log('OK: every referenced API endpoint exists in the latest Gateway with a compatible HTTP method.');
}

run().catch(error => {
  console.error(`API route contract check failed: ${error.message}`);
  process.exitCode = 1;
});
