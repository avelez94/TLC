'use client'

import { useAdminPanelContext } from '../AdminPanelContext'
import CohortsTab from '../components/CohortsTab'

export default function CohortsPage() {
  const panel = useAdminPanelContext()
  return <CohortsTab {...panel} />
}
