import type { Settings } from '../api/types';

export const NOTIFICATION_LEVELS = ['all', 'sales', 'none'] as const;
export type SettingsFields = Pick<Settings, 'display_name' | 'notifications'>;
export interface SettingsEditor { base: Settings; draft: SettingsFields }
const fields = ['display_name', 'notifications'] as const;

export function readAccountSettings(raw: unknown): Settings | null {
  const value = (raw as { settings?: unknown } | null)?.settings;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const s = value as Settings;
  if (typeof s.display_name !== 'string' || typeof s.payout_address !== 'string' || !NOTIFICATION_LEVELS.includes(s.notifications)) return null;
  return s;
}
export const settingsEditor = (base: Settings): SettingsEditor => ({ base, draft: { display_name: base.display_name, notifications: base.notifications } });
export const settingsDirty = (editor: SettingsEditor) => fields.some(key => editor.base[key] !== editor.draft[key]);
export function receiveSettings(editor: SettingsEditor | null, incoming: Settings): SettingsEditor {
  if (!editor) return settingsEditor(incoming);
  if (settingsDirty(editor) || fields.every(key => editor.base[key] === incoming[key]) && editor.base.payout_address === incoming.payout_address) return editor;
  return settingsEditor(incoming);
}
export const settingsConflict = (editor: SettingsEditor, current: Settings) => fields.some(key =>
  editor.draft[key] !== editor.base[key] && current[key] !== editor.base[key] && current[key] !== (key === 'display_name' ? editor.draft[key].trim() : editor.draft[key]));
export const rebaseSettings = (editor: SettingsEditor, current: Settings): SettingsEditor => ({ base: current, draft: {
  display_name: editor.draft.display_name === editor.base.display_name ? current.display_name : editor.draft.display_name,
  notifications: editor.draft.notifications === editor.base.notifications ? current.notifications : editor.draft.notifications,
} });

export class SettingsSaveError extends Error {
  constructor(readonly code: 'input' | 'read' | 'conflict' | 'unconfirmed') { super(code); }
}

/** Read-before-write is a conflict check, not a server-atomic compare-and-swap guarantee. */
export function createSettingsSaveTask() {
  let busy = false, generation = 0;
  return {
    pending: () => busy,
    abandon() { generation++; busy = false; },
    async run(editor: SettingsEditor, deps: { active: () => boolean; read: () => Promise<unknown>; write: (patch: Partial<SettingsFields>) => Promise<unknown> }): Promise<{ settings: Settings; wrote: boolean } | null> {
      if (busy || !deps.active()) return null;
      busy = true;
      const attempt = ++generation, current = () => generation === attempt && deps.active();
      try {
        const desired: SettingsFields = { display_name: editor.draft.display_name.trim(), notifications: editor.draft.notifications };
        if (desired.display_name.length < 1 || desired.display_name.length > 64 || !NOTIFICATION_LEVELS.includes(desired.notifications)) throw new SettingsSaveError('input');
        const changed = fields.filter(key => desired[key] !== editor.base[key]);
        const latest = readAccountSettings(await deps.read());
        if (!current()) return null;
        if (!latest) throw new SettingsSaveError('read');
        if (changed.every(key => latest[key] === desired[key])) return { settings: latest, wrote: false };
        if (settingsConflict(editor, latest)) throw new SettingsSaveError('conflict');
        const patch: Partial<SettingsFields> = {};
        for (const key of changed) if (latest[key] !== desired[key]) Object.assign(patch, { [key]: desired[key] });
        const response = readAccountSettings(await deps.write(patch));
        if (!current()) return null;
        if (!response || changed.some(key => response[key] !== desired[key])) throw new SettingsSaveError('unconfirmed');
        // A failed post-save read must not be presented as a confirmed current setting or retried automatically.
        let confirmed: Settings | null;
        try { confirmed = readAccountSettings(await deps.read()); } catch { throw new SettingsSaveError('unconfirmed'); }
        if (!current()) return null;
        if (!confirmed || changed.some(key => confirmed![key] !== desired[key])) throw new SettingsSaveError('unconfirmed');
        return { settings: confirmed, wrote: true };
      } finally { if (generation === attempt) busy = false; }
    },
  };
}
