'use client'

import { useAdminPanelContext } from '../AdminPanelContext'
import RegistrationsTab from '../components/RegistrationsTab'

export default function RegistrationsPage() {
  const panel = useAdminPanelContext()
  return <RegistrationsTab {...panel} />
}
