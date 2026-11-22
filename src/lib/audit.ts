import { supabaseAdmin } from './supabase-server'

/**
 * Append an entry to the admin activity log (server routes). Best effort: a logging
 * failure never blocks the action itself. Never include passwords, keys or private
 * reflections in `details`.
 */
export async function audit(actorId: string | null, action: string, entityType: string, entityId: string | null, details: Record<string, unknown> = {}) {
  try {
    await supabaseAdmin.from('admin_audit_log').insert({
      actor_id: actorId, action: action.slice(0, 80), entity_type: entityType.slice(0, 40),
      entity_id: entityId ? entityId.slice(0, 80) : null, details,
    })
  } catch {
    // table not present yet, or database unavailable
  }
}
