'use client'

import { useAdminPanelContext } from '../AdminPanelContext'
import AnnouncementsTab from '../components/AnnouncementsTab'

export default function AnnouncementsPage() {
  const panel = useAdminPanelContext()
  return <AnnouncementsTab {...panel} />
}
