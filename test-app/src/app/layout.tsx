export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#f5f5f5', minHeight: '100vh' }}>
        <nav style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 24px',
          background: '#1a1a2e',
          color: '#e0e0e0',
          fontSize: 14,
        }}>
          <span style={{ fontWeight: 700, fontSize: 16 }}>✅ Task Tracker</span>
          <span style={{ opacity: 0.6 }}>v0.2</span>
        </nav>
        {children}
      </body>
    </html>
  );
}
