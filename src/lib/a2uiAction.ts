export interface A2uiActionSource {
  surfaceId: string;
  sourceComponentId: string;
  version?: string;
  mimeType?: string;
}

/** Keep every resolved context value and identify the exact surface/button that was pressed. */
export function a2uiActionParts(name: string, context: Record<string, unknown>, source: A2uiActionSource, timestamp = new Date().toISOString()) {
  const action = { name, surfaceId: source.surfaceId, sourceComponentId: source.sourceComponentId, timestamp, context };
  const version = source.version === 'v0.8' ? 'v0.8' : 'v0.9';
  const values = Object.values(context);
  // Existing text-only agents still receive a single text field unchanged. Multiple fields are never dropped.
  const text = values.length === 1 && typeof values[0] === 'string' ? values[0] : JSON.stringify({ action: name, context });
  return [
    { kind: 'text', text },
    { kind: 'data', metadata: { mimeType: source.mimeType ?? 'application/a2ui+json' }, data: { version, [version === 'v0.8' ? 'userAction' : 'action']: action } },
  ];
}
