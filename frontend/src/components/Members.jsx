export default function Members({ members, emergencies }) {
  const criticalCount = emergencies?.filter(e => e.urgencyLevel === 'CRITICAL').length || 0
  const highCount     = emergencies?.filter(e => e.urgencyLevel === 'HIGH').length || 0

  return (
    <aside className="chat-sidebar" style={{ padding: '16px' }}>
      {/* Members Panel */}
      <div style={{ marginBottom: 20 }}>
        <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)',
                     textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12,
                     display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="status-dot status-online" />
          Members ({members.length})
        </h4>
        {members.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No users yet</p>
        ) : (
          <ul style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {members.map((m, i) => (
              <li key={i} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 10px', borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-raised)', fontSize: 13, color: 'var(--text-primary)',
              }}>
                <span style={{ fontSize: 16 }}>👤</span>
                <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{m}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Emergency Summary Panel */}
      {emergencies?.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--critical)',
                       textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
            🚨 Active Alerts
          </h4>

          {criticalCount > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
                          background: 'var(--critical-dim)', borderRadius: 'var(--radius-sm)',
                          padding: '8px 12px', border: '1px solid var(--critical)' }}>
              <span style={{ color: 'var(--critical)', fontWeight: 700, fontSize: 13 }}>
                🔴 CRITICAL
              </span>
              <span style={{ marginLeft: 'auto', background: 'var(--critical)', color: '#fff',
                             borderRadius: 20, padding: '1px 8px', fontSize: 12, fontWeight: 700 }}>
                {criticalCount}
              </span>
            </div>
          )}

          {highCount > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
                          background: 'var(--high-dim)', borderRadius: 'var(--radius-sm)',
                          padding: '8px 12px', border: '1px solid var(--high)' }}>
              <span style={{ color: 'var(--high)', fontWeight: 700, fontSize: 13 }}>
                🟠 HIGH
              </span>
              <span style={{ marginLeft: 'auto', background: 'var(--high)', color: '#fff',
                             borderRadius: 20, padding: '1px 8px', fontSize: 12, fontWeight: 700 }}>
                {highCount}
              </span>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
            {emergencies.slice(-5).reverse().map((e, i) => (
              <div key={i} style={{
                borderRadius: 'var(--radius-sm)',
                padding: '8px 10px',
                fontSize: 12,
                color: 'var(--text-secondary)',
                background: 'var(--bg-raised)',
                borderLeft: `3px solid ${e.urgencyLevel === 'CRITICAL' ? 'var(--critical)' : 'var(--high)'}`,
              }}>
                <div style={{ fontWeight: 600, color: e.urgencyLevel === 'CRITICAL' ? 'var(--critical)' : 'var(--high)' }}>
                  {e.urgencyLevel}
                </div>
                <div style={{ marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {e.message}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  )
}