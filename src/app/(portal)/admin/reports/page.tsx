'use client'

import { useAdminPanelContext } from '../AdminPanelContext'
import ReportsTab from '../components/ReportsTab'

export default function ReportsPage() {
  const panel = useAdminPanelContext()
  return <ReportsTab {...panel} />
}
