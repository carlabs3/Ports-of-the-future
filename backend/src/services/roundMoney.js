// Read a round entry's money in € millions (J3). A leaf module with no service
// dependencies, so strategyService and roundsService can both use it without
// importing each other (avoids a circular import).
//
// New entries store potentialLossM and damageBill already in €M. Old (pre-J)
// entries stored coins (1 coin = €1bn = €1000M), so multiply by 1000 — which
// keeps them equal to what they showed before.
export const roundPotentialM = r => (r && r.potentialLossM != null) ? r.potentialLossM : (Number(r?.impact) || 0) * 1000
export const roundDamageM = r => (r && r.potentialLossM != null) ? (Number(r.damageBill) || 0) : (Number(r?.damageBill) || 0) * 1000
