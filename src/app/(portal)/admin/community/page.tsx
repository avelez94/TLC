'use client'

import { useAdminPanelContext } from '../AdminPanelContext'
import CommunityTab from '../components/CommunityTab'

export default function CommunityPage() {
  const panel = useAdminPanelContext()
  return <CommunityTab {...panel} />
}
