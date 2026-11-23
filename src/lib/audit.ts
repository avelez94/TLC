import { supabaseAdmin } from './supabase-server'

/**
 * Append an entry to the admin activity log (server routes). Best effort: a logging
 * failure never blocks the action itself. Never include passwords, keys or private
 * reflections in `details`.
 */
export async function audit(
  actorId: string | null, action: string, entityType: string, entityId: string | null,
  details: Record<string, unknown> = {}, extra: { label?: string | null; outcome?: 'success' | 'failed' | 'blocked' } = {},
) {
  try {
    const row = {
      actor_id: actorId, action: action.slice(0, 80), entity_type: entityType.slice(0, 40),
      entity_id: entityId ? entityId.slice(0, 80) : null, details,
      entity_label: extra.label ? extra.label.slice(0, 200) : null, outcome: extra.outcome ?? 'success',
    }
    const { error } = await supabaseAdmin.from('admin_audit_log').insert(row)
    if (error) {
      // Before migration 2d the label/outcome columns do not exist: keep the core entry.
      const { entity_label: _l, outcome: _o, ...core } = row
      void _l; void _o
      await supabaseAdmin.from('admin_audit_log').insert(core)
    }
  } catch {
    // table not present yet, or database unavailable
  }
}
