/**
 * SecureCrowd — AI Urgency Detection Module
 * Keyword-based classifier, no external API required.
 */

const CRITICAL_PATTERNS = [
  { kw: ['fire', 'flames', 'burning', 'blaze', 'smoke'], label: 'FIRE' },
  { kw: ['bomb', 'explosion', 'blast', 'detonation'], label: 'EXPLOSION' },
  { kw: ['shooting', 'gunshot', 'shot', 'armed', 'weapon'], label: 'WEAPON' },
  { kw: ['stampede', 'crush', 'trampled', 'crowd surge', 'crowd crush'], label: 'CRUSH' },
  { kw: ['collapse', 'roof down', 'structure fell'], label: 'STRUCTURAL' },
  { kw: ['cardiac arrest', 'not breathing', 'heart attack', 'cpr'], label: 'CARDIAC' },
  { kw: ['kidnap', 'abduct', 'abducted', 'taken forcibly'], label: 'KIDNAP' },
  { kw: ['stabbed', 'knife', 'slash', 'cut deep'], label: 'WEAPON' },
  { kw: ['mayday', 'sos', 'dying', 'dead', 'overdose'], label: 'CRITICAL_GENERAL' },
  { kw: ['terrorist', 'riot', 'attack', 'violence'], label: 'SECURITY' },
  { kw: ['bleeding heavily', 'severe bleeding', 'blood everywhere'], label: 'HEMORRHAGE' },
]

const HIGH_PATTERNS = [
  { kw: ['help', 'please help', 'need help', 'someone help'], label: 'HELP' },
  { kw: ['lost child', 'missing child', 'child missing', 'my child is lost', 'kid lost'], label: 'LOST_CHILD' },
  { kw: ['missing', 'lost person', 'lost someone', "can't find"], label: 'MISSING' },
  { kw: ['medical', 'ambulance', 'paramedic', 'first aid'], label: 'MEDICAL' },
  { kw: ['injured', 'injury', 'hurt', 'wounded', 'bleeding'], label: 'INJURY' },
  { kw: ['trapped', 'stuck', "can't get out", 'blocked exit'], label: 'TRAPPED' },
  { kw: ['police', 'security', 'guard needed'], label: 'SECURITY_REQUEST' },
  { kw: ['fainted', 'passed out', 'unconscious', 'collapsed'], label: 'FAINT' },
  { kw: ['danger', 'dangerous', 'unsafe', 'threatening'], label: 'DANGER' },
  { kw: ['asthma', 'allergic', 'allergy', 'epipen', 'inhaler'], label: 'MEDICAL' },
  { kw: ['accident', 'fell', 'fallen', 'trip'], label: 'ACCIDENT' },
  { kw: ['panic', "can't breathe", 'anxiety', 'hyperventilat'], label: 'DISTRESS' },
]

const detectUrgency = (message) => {
  const text = message.toLowerCase().trim()

  // Check CRITICAL patterns
  const criticalMatches = []
  for (const { kw, label } of CRITICAL_PATTERNS) {
    const found = kw.filter(k => text.includes(k))
    if (found.length > 0) criticalMatches.push({ label, keywords: found })
  }

  if (criticalMatches.length > 0) {
    const allKw = criticalMatches.flatMap(m => m.keywords)
    return {
      level: 'CRITICAL',
      confidence: Math.min(0.97, 0.80 + allKw.length * 0.05),
      keywords: allKw,
      labels: criticalMatches.map(m => m.label),
      isEmergency: true,
    }
  }

  // Check HIGH patterns
  const highMatches = []
  for (const { kw, label } of HIGH_PATTERNS) {
    const found = kw.filter(k => text.includes(k))
    if (found.length > 0) highMatches.push({ label, keywords: found })
  }

  const totalHighKw = highMatches.flatMap(m => m.keywords).length

  // Multiple HIGH signals → escalate to CRITICAL
  if (highMatches.length >= 3 || totalHighKw >= 4) {
    return {
      level: 'CRITICAL',
      confidence: 0.75,
      keywords: highMatches.flatMap(m => m.keywords),
      labels: highMatches.map(m => m.label),
      isEmergency: true,
    }
  }

  if (highMatches.length >= 1) {
    return {
      level: 'HIGH',
      confidence: Math.min(0.90, 0.55 + totalHighKw * 0.10),
      keywords: highMatches.flatMap(m => m.keywords),
      labels: highMatches.map(m => m.label),
      isEmergency: true,
    }
  }

  return { level: 'NORMAL', confidence: 0.95, keywords: [], labels: [], isEmergency: false }
}

module.exports = { detectUrgency }
