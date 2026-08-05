'use client'

import { useAdminPanelContext } from '../AdminPanelContext'
import ResourcesTab from '../components/ResourcesTab'

export default function ResourcesPage() {
  const panel = useAdminPanelContext()
  return <ResourcesTab {...panel} />
}
