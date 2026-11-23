'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { useAdminPanel, type AdminPanel, type AdminPanelOptions } from './useAdminPanel'

const AdminPanelContext = createContext<AdminPanel | null>(null)

export function AdminPanelProvider({ children, ...options }: AdminPanelOptions & { children: ReactNode }) {
  const panel = useAdminPanel(options)
  return <AdminPanelContext.Provider value={panel}>{children}</AdminPanelContext.Provider>
}

export function useAdminPanelContext() {
  const ctx = useContext(AdminPanelContext)
  if (!ctx) throw new Error('useAdminPanelContext must be used within AdminPanelProvider')
  return ctx
}
