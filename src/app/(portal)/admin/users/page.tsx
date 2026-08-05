'use client'

import { useAdminPanelContext } from '../AdminPanelContext'
import UsersTab from '../components/UsersTab'

export default function UsersPage() {
  const panel = useAdminPanelContext()
  return <UsersTab {...panel} />
}
