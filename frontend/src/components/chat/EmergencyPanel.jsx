/**
 * EmergencyPanel
 * Shows the collapsible cross-section emergency broadcast strip
 * that appears above the chat thread when alerts arrive from other sections.
 */
export default function EmergencyPanel({ alerts, onClearAll, onRespond, onDismiss }) {
  if (alerts.length === 0) return null

  return (
    <div style={{
      borderBottom: '2px solid var(--critical)',
      background: 'rgba(255,45,85,0.06)',
      maxHeight: 260,
      overflowY: 'auto',
      flexShrink: 0,
    }}>
      {/* Panel header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px',
        borderBottom: '1px solid var(--critical-dim)',
      }}>
        <span style={{
          fontSize: 12, fontWeight: 700, color: 'var(--critical)',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{
            animation: 'pulse-critical 1.5s infinite', display: 'inline-block',
            width: 8, height: 8, borderRadius: '50%', background: 'var(--critical)',
          }} />
          🚨 EMERGENCY BROADCASTS — Respond via Private Chat Only
        </span>
        <button
          onClick={onClearAll}
          style={{ background: 'none', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600 }}
        >
          Clear All
        </button>
      </div>

      {/* Individual alerts */}
      {alerts.map((alert, i) => (
        <div
          key={alert._id || i}
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--border)',
            animation: 'fade-in 0.3s ease',
            background: alert.resolved ? 'rgba(48,209,88,0.06)' : 'transparent',
            transition: 'background 0.4s ease',
          }}
        >
          {alert.resolved ? (
            // ── Resolved state ──
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 24 }}>✅</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--safe)' }}>
                  Issue Resolved
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  Resolved by{' '}
                  <strong style={{ color: 'var(--text-secondary)' }}>{alert.resolvedBy}</strong>
                  {' '}· §{alert.originalSection} · Removing in 5s…
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, fontStyle: 'italic' }}>
                  &ldquo;{alert.message.slice(0, 70)}{alert.message.length > 70 ? '…' : ''}&rdquo;
                </div>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => onDismiss(alert._id)}
              >✕</button>
            </div>
          ) : (
            // ── Active state ──
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                <span style={{
                  background: 'var(--critical-dim)', color: 'var(--critical)',
                  border: '1px solid var(--critical)', borderRadius: 20,
                  padding: '2px 10px', fontSize: 11, fontWeight: 700,
                }}>
                  {alert.urgencyLevel}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>
                  📢 Section {alert.originalSection}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                  {new Date(alert.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              <div style={{
                fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5,
                background: 'var(--bg-raised)', borderRadius: 'var(--radius-sm)',
                padding: '8px 12px', marginBottom: 8,
                borderLeft: '3px solid var(--critical)',
              }}>
                {alert.message}
              </div>

              {alert.urgencyKeywords?.length > 0 && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                  {alert.urgencyKeywords.map(kw => (
                    <span key={kw} style={{
                      fontSize: 10, fontWeight: 600, padding: '1px 8px',
                      background: 'var(--critical-dim)', color: 'var(--critical)',
                      border: '1px solid var(--critical)', borderRadius: 20,
                    }}>{kw}</span>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', flex: 1 }}>
                  Reported by{' '}
                  <strong style={{ color: 'var(--text-secondary)' }}>{alert.sender}</strong>
                </span>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => onRespond(alert.sender, alert.message, alert._id)}
                >
                  🔒 Respond Privately
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => onDismiss(alert._id)}
                >
                  Dismiss
                </button>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  )
}
