'use client'

import { useAdminPanelContext } from '../AdminPanelContext'
import CertificatesTab from '../components/CertificatesTab'

export default function CertificatesPage() {
  const panel = useAdminPanelContext()
  return <CertificatesTab {...panel} />
}
