// Loads who submitted which weekly rep in one cohort (admins only; never reflection text).
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { friendlyError, type DbError } from '@/lib/admin-errors'
import type { ParticipationRow } from './participation'

export function useCohortParticipation(cohortId: string) {
  const [rows, setRows] = useState<ParticipationRow[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: e } = await supabase.rpc('admin_cohort_participation', { p_cohort: cohortId })
      if (e) setError(friendlyError(e as DbError, 'Participation could not be loaded.'))
      else setRows((data as ParticipationRow[] | null) ?? [])
    } catch {
      setError('Participation could not be loaded: the server could not be reached.')
    }
    setLoading(false)
  }, [cohortId])

  useEffect(() => { void Promise.resolve().then(load) }, [load])

  return { rows, loading, error, reload: load }
}
