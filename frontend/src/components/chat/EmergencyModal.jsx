const EMERGENCY_TEMPLATES = [
  {
    title:   'Lost Child',
    preview: "URGENT: I've lost my child. Name: [child...",
    text:    "URGENT: I've lost my child. Name: [child name], wearing [description]. Last seen near [location]. Please help find them!",
  },
  {
    title:   'Medical Emergency',
    preview: 'MEDICAL EMERGENCY: I need medical assist...',
    text:    'MEDICAL EMERGENCY: I need medical assistance immediately at [location]. Patient condition: [describe condition].',
  },
  {
    title:   'Lost Person',
    preview: "URGENT: I've been separated from my grou...",
    text:    "URGENT: I've been separated from my group. I am at [location]. Please help me find [person name / description].",
  },
  {
    title:   'Suspicious Activity',
    preview: 'ALERT: I noticed suspicious activity nea...',
    text:    'ALERT: I noticed suspicious activity near [location]. Description: [describe what you saw]. Please send security immediately.',
  },
]

/**
 * EmergencyModal
 * Full-screen overlay with 4 pre-filled emergency message templates.
 * Clicking a template fires onSelect(templateText) and closes the modal.
 */
export default function EmergencyModal({ onSelect, onClose }) {
  return (
    <div className="emergency-overlay" onClick={onClose}>
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-xl)',
          padding: '28px',
          maxWidth: 560,
          width: '92%',
          animation: 'fade-in 0.2s ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              background: 'var(--critical-dim)', border: '1px solid var(--critical)',
              borderRadius: 8, padding: '5px 8px', fontSize: 16,
            }}>⚠️</span>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
              Quick Emergency Messages
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', color: 'var(--text-muted)', fontSize: 20, lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
          Select a template below, then fill in the [brackets] with your details before sending.
        </p>

        {/* Template grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {EMERGENCY_TEMPLATES.map((tpl) => (
            <button
              key={tpl.title}
              onClick={() => onSelect(tpl.text)}
              className="emergency-template-btn"
              style={{
                background:    'var(--bg-raised)',
                border:        '1px solid var(--border)',
                borderRadius:  'var(--radius-md)',
                padding:       '14px 16px',
                textAlign:     'left',
                cursor:        'pointer',
                display:       'flex',
                alignItems:    'flex-start',
                gap:           12,
                transition:    'all 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--critical)'
                e.currentTarget.style.background  = 'var(--critical-dim)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)'
                e.currentTarget.style.background  = 'var(--bg-raised)'
              }}
            >
              <div style={{
                background:   'var(--critical-dim)', border: '1px solid var(--critical)',
                borderRadius: 8, padding: '6px 8px', flexShrink: 0, fontSize: 16,
              }}>⚠️</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                  {tpl.title}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                  {tpl.preview}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
