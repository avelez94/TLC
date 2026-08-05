'use client'

import { useAdminPanelContext } from '../AdminPanelContext'
import JournalPromptsTab from '../components/JournalPromptsTab'

export default function JournalPromptsPage() {
  const panel = useAdminPanelContext()
  return <JournalPromptsTab {...panel} />
}
