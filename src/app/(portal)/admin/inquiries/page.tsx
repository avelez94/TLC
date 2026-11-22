'use client'

import { useAdminPanelContext } from '../AdminPanelContext'
import InquiriesTab from '../components/InquiriesTab'

export default function InquiriesPage() {
  const panel = useAdminPanelContext()
  return <InquiriesTab {...panel} />
}
