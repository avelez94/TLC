'use client'

import { useAdminPanelContext } from '../AdminPanelContext'
import SecurityTab from '../components/SecurityTab'

export default function SecurityPage() {
  const panel = useAdminPanelContext()
  return <SecurityTab {...panel} />
}
