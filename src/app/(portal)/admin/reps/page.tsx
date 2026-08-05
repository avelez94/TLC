'use client'

import { useAdminPanelContext } from '../AdminPanelContext'
import WeeklyRepsTab from '../components/WeeklyRepsTab'

export default function WeeklyRepsPage() {
  const panel = useAdminPanelContext()
  return <WeeklyRepsTab {...panel} />
}
