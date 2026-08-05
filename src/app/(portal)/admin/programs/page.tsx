'use client'

import { useAdminPanelContext } from '../AdminPanelContext'
import ProgramsTab from '../components/ProgramsTab'

export default function ProgramsPage() {
  const panel = useAdminPanelContext()
  return <ProgramsTab {...panel} />
}
