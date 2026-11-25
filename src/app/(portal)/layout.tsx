import '../globals.css'

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="portal-ui">{children}</body>
    </html>
  )
}
