import { EVENTS_BY_CODE } from '../config/events.js'

// Read a round entry's money in € millions. A leaf module (config only, no service
// imports) so strategyService and roundsService can both use it without importing
// each other.
//
// Units are decided by an EXPLICIT marker, not by guessing from which fields are
// present (the old `potentialLossM != null` check misfired when Mongoose dropped
// that field, reading new €M entries as coins ×1000). The rule:
//   • moneyUnit === 'eurM'           → already € millions (current entries).
//   • else, impact/lossValue present → a v4/coin-era entry: 1 coin = €1000M.
//   • else                           → treat as € millions (an entry written
//                                       before the marker existed; its damageBill
//                                       is already €M and its potential is the
//                                       drawn event's canonical loss, J1).
const isLegacyCoins = r => r?.moneyUnit !== 'eurM' && (r?.impact != null || r?.lossValue != null)

// Potential loss of the drawn event, €M. For € millions entries prefer the stored
// value, else derive it from the drawn event (one loss per event, J1) — which also
// repairs entries saved while `potentialLossM` was being stripped on save.
export function roundPotentialM(r) {
  if (isLegacyCoins(r)) return (Number(r?.impact) || 0) * 1000
  const stored = Number(r?.potentialLossM)
  if (stored > 0) return stored
  return Number(EVENTS_BY_CODE[r?.drawnEvent]?.potentialLossM) || 0
}

// Damage sustained, €M.
export function roundDamageM(r) {
  if (isLegacyCoins(r)) return (Number(r?.damageBill) || 0) * 1000
  return Number(r?.damageBill) || 0
}
