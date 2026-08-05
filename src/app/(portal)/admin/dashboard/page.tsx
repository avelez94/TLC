'use client'

import { useAdminPanelContext } from '../AdminPanelContext'
import DashboardTab from '../components/DashboardTab'

export default function DashboardPage() {
  const panel = useAdminPanelContext()
  return <DashboardTab {...panel} />
}
