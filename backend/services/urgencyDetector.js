/**
 * SecureCrowd — AI Urgency Detection Module
 * Optimized keyword classifier, same response shape as before.
 */

const MAX_CACHE_SIZE = 1000;

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

const normalizeText = (value = '') =>
  String(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const buildBank = (patterns) =>
  patterns.map(({ kw, label }) => ({
    label,
    kw: [...new Set(kw.map(normalizeText).filter(Boolean))].sort((a, b) => b.length - a.length),
  }))

const CRITICAL_BANK = buildBank(CRITICAL_PATTERNS)
const HIGH_BANK = buildBank(HIGH_PATTERNS)

const resultCache = new Map()

const cacheResult = (key, value) => {
  if (resultCache.has(key)) resultCache.delete(key)
  resultCache.set(key, value)

  if (resultCache.size > MAX_CACHE_SIZE) {
    const oldestKey = resultCache.keys().next().value
    resultCache.delete(oldestKey)
  }

  return value
}

const getMatches = (text, bank) => {
  const matches = []
  const seenKeywords = new Set()

  for (const { label, kw } of bank) {
    const found = []

    for (const phrase of kw) {
      if (!seenKeywords.has(phrase) && text.includes(phrase)) {
        found.push(phrase)
        seenKeywords.add(phrase)
      }
    }

    if (found.length > 0) {
      matches.push({ label, keywords: found })
    }
  }

  return matches
}

const buildResponse = ({ level, confidence, keywords, labels, isEmergency }) => ({
  level,
  confidence: Math.max(0, Math.min(0.99, confidence)),
  keywords,
  labels,
  isEmergency,
})

const detectUrgency = (message = '') => {
  const text = normalizeText(message)

  if (!text) {
    return buildResponse({
      level: 'NORMAL',
      confidence: 0.95,
      keywords: [],
      labels: [],
      isEmergency: false,
    })
  }

  const cached = resultCache.get(text)
  if (cached) return cached

  const criticalMatches = getMatches(text, CRITICAL_BANK)

  if (criticalMatches.length > 0) {
    const allKw = criticalMatches.flatMap((m) => m.keywords)
    return cacheResult(
      text,
      buildResponse({
        level: 'CRITICAL',
        confidence: Math.min(0.97, 0.82 + allKw.length * 0.04),
        keywords: allKw,
        labels: criticalMatches.map((m) => m.label),
        isEmergency: true,
      })
    )
  }

  const highMatches = getMatches(text, HIGH_BANK)
  const totalHighKw = highMatches.flatMap((m) => m.keywords).length

  if (highMatches.length >= 3 || totalHighKw >= 4) {
    return cacheResult(
      text,
      buildResponse({
        level: 'CRITICAL',
        confidence: 0.75,
        keywords: highMatches.flatMap((m) => m.keywords),
        labels: highMatches.map((m) => m.label),
        isEmergency: true,
      })
    )
  }

  if (highMatches.length >= 1) {
    return cacheResult(
      text,
      buildResponse({
        level: 'HIGH',
        confidence: Math.min(0.9, 0.58 + totalHighKw * 0.08),
        keywords: highMatches.flatMap((m) => m.keywords),
        labels: highMatches.map((m) => m.label),
        isEmergency: true,
      })
    )
  }

  return cacheResult(
    text,
    buildResponse({
      level: 'NORMAL',
      confidence: 0.95,
      keywords: [],
      labels: [],
      isEmergency: false,
    })
  )
}

module.exports = { detectUrgency }