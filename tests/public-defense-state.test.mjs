import test from 'node:test'
import assert from 'node:assert/strict'
import { defenseHasEnded, isUpcomingDefense, publicDefenseStatus } from '../lib/public-defense-state.ts'

const beforeEnd = Date.parse('2026-09-16T01:59:59Z')
const atEnd = Date.parse('2026-09-16T02:00:00Z')

test('uses Philippine time and retains an in-progress defense until its end', () => {
  assert.equal(defenseHasEnded('2026-09-16', '10:00:00', beforeEnd), false)
  assert.equal(defenseHasEnded('2026-09-16', '10:00:00', atEnd), true)
  assert.equal(isUpcomingDefense('scheduled', '2026-09-16', '10:00:00', beforeEnd), true)
  assert.equal(isUpcomingDefense('scheduled', '2026-09-16', '10:00:00', atEnd), false)
})

test('does not infer completed status just because the scheduled time ended', () => {
  assert.equal(publicDefenseStatus('scheduled', '2026-09-16', '10:00:00', atEnd), 'Awaiting update')
  assert.equal(publicDefenseStatus('completed', '2026-09-16', '10:00:00', beforeEnd), '✓ Completed')
  assert.equal(isUpcomingDefense('completed', '2026-09-16', '10:00:00', beforeEnd), false)
  assert.equal(isUpcomingDefense('cancelled', '2026-09-16', '10:00:00', beforeEnd), false)
})

test('handles the Philippine date boundary independently of the browser timezone', () => {
  assert.equal(isUpcomingDefense('scheduled', '2026-09-17', '00:15:00', Date.parse('2026-09-16T16:00:00Z')), true)
  assert.equal(isUpcomingDefense('scheduled', '2026-09-16', '23:59:00', Date.parse('2026-09-16T16:00:00Z')), false)
})
