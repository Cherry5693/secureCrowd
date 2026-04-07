import { useEffect } from 'react'

export default function EmergencyAlert({ alert, onDismiss }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 30000) // auto-dismiss after 30s
    return () => clearTimeout(timer)
  }, [onDismiss])

  const isCritical = alert.urgencyLevel === 'CRITICAL'

  return (
    <div className="emergency-overlay" onClick={onDismiss}>
      <div className="emergency-card" onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>{isCritical ? '🚨' : '⚠️'}</div>

        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: isCritical ? 'var(--critical-dim)' : 'var(--high-dim)',
          color: isCritical ? 'var(--critical)' : 'var(--high)',
          border: `1px solid ${isCritical ? 'var(--critical)' : 'var(--high)'}`,
          borderRadius: 20, padding: '4px 14px', fontSize: 12, fontWeight: 700,
          letterSpacing: 1, marginBottom: 16,
        }}>
          {alert.urgencyLevel} EMERGENCY
        </div>

        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>
          Emergency Reported — Section {alert.section}
        </h2>

        <p style={{
          background: 'var(--bg-raised)', borderRadius: 'var(--radius-md)',
          padding: '14px 18px', fontSize: 15, color: 'var(--text-primary)',
          marginBottom: 16, lineHeight: 1.6, wordBreak: 'break-word',
        }}>
          "{alert.message}"
        </p>

        {alert.urgencyKeywords?.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 20 }}>
            {alert.urgencyKeywords.map(kw => (
              <span key={kw} style={{
                background: 'var(--critical-dim)', color: 'var(--critical)',
                border: '1px solid var(--critical)', borderRadius: 20,
                padding: '2px 10px', fontSize: 11, fontWeight: 600,
              }}>
                {kw}
              </span>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', flexDirection: 'column', alignItems: 'center' }}>
          {alert.location && (
            <a 
              href={`https://maps.google.com/?q=${alert.location.lat},${alert.location.lng}`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-primary btn-sm"
              style={{ background: 'var(--accent)', borderColor: 'var(--accent)', textDecoration: 'none', marginBottom: 8 }}
            >
              📍 View Exact Location on Map
            </a>
          )}
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Reported by {alert.sender} • {new Date(alert.time).toLocaleTimeString()}
          </span>
        </div>

        <button
          className="btn btn-ghost btn-sm"
          style={{ marginTop: 20, width: '100%' }}
          onClick={onDismiss}
        >
          Dismiss Alert
        </button>
      </div>
    </div>
  )
}
