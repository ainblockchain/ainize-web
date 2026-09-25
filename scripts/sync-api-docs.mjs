/** Refresh compact API references from the node that will be deployed with this web app. */
import { readFileSync, writeFileSync } from 'node:fs';
const input = process.argv[2] ?? 'https://ainize.ai/api/openapi.json';
let spec;
if (/^https?:/.test(input)) {
  const response = await fetch(input);
  if (!response.ok) throw new Error(`OpenAPI returned ${response.status}`);
  spec = await response.json();
} else spec = JSON.parse(readFileSync(input, 'utf8'));
if (!spec.openapi || !spec.paths || !spec.components?.schemas) throw new Error('Expected an OpenAPI document');
const clean = value => String(value ?? '').replace(/\s+/g, ' ').replaceAll('|', '\\|').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const short = value => clean(value).split(/(?<=\.)\s/)[0];
const type = s => s.$ref ? s.$ref.split('/').at(-1) : s.enum ? s.enum.map(String).join(', ') : s.type === 'array' ? `array of ${type(s.items ?? {})}` : s.type ?? (s.oneOf || s.anyOf ? 'union (see OpenAPI)' : 'object');
const api = ['# HTTP API reference', '', 'The running node’s [OpenAPI document](/api/openapi.json) is the complete contract for request bodies, response schemas and authentication. This compact index is refreshed with `node scripts/sync-api-docs.mjs <OpenAPI URL or file>`.', '', 'Use JSON unless an endpoint specifies multipart upload or streaming. Operator sessions and teaching keys are separate credentials. For model SDK authentication and `/v1`, see [Call the model](../how-to/call-the-model.md).', ''];
for (const [path, item] of Object.entries(spec.paths)) {
  for (const [method, op] of Object.entries(item)) {
    if (!['get', 'post', 'put', 'patch', 'delete', 'options', 'head'].includes(method)) continue;
    const security = op.security ?? spec.security ?? [];
    const auth = security.length ? security.map(s => Object.keys(s).join(' + ') || 'none').join(' or ') : 'No security scheme declared; check required headers below.';
    api.push(`## \`${method.toUpperCase()} ${path}\``, '', short(op.summary || op.description), '', `Auth: ${auth} Responses: ${Object.keys(op.responses ?? {}).map(s => '\`'+s+'\`').join(', ')}.`, '');
    const parameters = [...(item.parameters ?? []), ...(op.parameters ?? [])];
    if (parameters.length) {
      api.push('| Parameter | In | Required | Type |', '|---|---|---|---|');
      for (const p of parameters) api.push(`| \`${p.name}\` | ${p.in} | ${p.required ? 'yes' : 'no'} | ${clean(type(p.schema ?? {}))} |`);
      api.push('');
    }
    if (op.requestBody) api.push(`Body: ${Object.keys(op.requestBody.content ?? {}).join(', ')}${op.requestBody.required ? ' (required)' : ''}. See OpenAPI for fields.`, '');
  }
}
writeFileSync(new URL('../docs/en/reference/http-api.md', import.meta.url), api.join('\n').trimEnd()+'\n');
const schemas = ['# Schemas', '', 'Reusable shapes from the node’s [OpenAPI document](/api/openapi.json). Required fields are marked below. Consult OpenAPI for nested constraints, formats and unions.', ''];
for (const [name, schema] of Object.entries(spec.components.schemas)) {
  schemas.push(`## \`${name}\``, '', short(schema.description), '');
  if (schema.properties) {
    schemas.push('| Field | Type | Required |', '|---|---|---|');
    for (const [field, s] of Object.entries(schema.properties)) schemas.push(`| \`${field}\` | ${clean(type(s))} | ${schema.required?.includes(field) ? 'yes' : 'no'} |`);
    schemas.push('');
  } else schemas.push(clean(type(schema)), '');
}
writeFileSync(new URL('../docs/en/reference/schemas.md', import.meta.url), schemas.join('\n').trimEnd()+'\n');
