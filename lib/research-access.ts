import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

export function normalizeResearchCode(value: unknown) {
  return String(value ?? '').trim().toUpperCase().slice(0, 32)
}

export function normalizeAccessKey(value: unknown) {
  return String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 64)
}

export function hashAccessKey(value: unknown) {
  const normalized = normalizeAccessKey(value)
  if (!normalized) return ''
  return createHash('sha256').update(normalized, 'utf8').digest('hex')
}

export function generateAccessKey() {
  const raw = randomBytes(9).toString('hex').toUpperCase()
  return `${raw.slice(0, 6)}-${raw.slice(6, 12)}-${raw.slice(12, 18)}`
}

export function accessKeyMatches(storedHash: string | null | undefined, candidate: unknown) {
  const candidateHash = hashAccessKey(candidate)
  if (!storedHash || !candidateHash || storedHash.length !== candidateHash.length) return false
  return timingSafeEqual(Buffer.from(storedHash, 'hex'), Buffer.from(candidateHash, 'hex'))
}

export function defenseLabel(value: string | null | undefined) {
  if (value === 'title') return 'Title Defense'
  if (value === 'proposal') return 'Proposal Defense'
  if (value === 'final') return 'Final Defense'
  return 'Research Defense'
}

export function nextDefenseType(value: string | null | undefined) {
  if (value === 'title') return 'proposal'
  if (value === 'proposal') return 'final'
  return null
}
