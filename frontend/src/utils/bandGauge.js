// Maturity-band gauge geometry — pure, so it can be unit-tested.
//
// The gauge draws four EQUAL quarters (0–25 / 25–50 / 50–75 / 75–100). Those are
// exactly the boundaries the server uses to assign the band (getBand in
// scoringService: score ≤25 / ≤50 / ≤75 / else). Because the quarters and the
// server thresholds share the same cut points, a marker placed at `score%` on a
// 0–100 scale always lands inside the quarter of the band the server assigned —
// no second set of thresholds exists on the client.

// The marker's horizontal position, as a percentage (0–100), clamped so 0 and
// 100 are not pushed off the bar. The arrow's TIP is drawn at this exact point.
export const clampScore = s => Math.max(0, Math.min(100, Number(s) || 0))

// The four quarters, in order, matching the band ramp and the server band names.
export const GAUGE_BANDS = ['reactive', 'aware', 'developing', 'proactive']

// Which quarter (0..3) the marker sits in for a given score. Uses the SAME cut
// points as the server's getBand, so GAUGE_BANDS[gaugeQuarter(s)] === getBand(s).
export function gaugeQuarter(score) {
  const s = clampScore(score)
  if (s <= 25) return 0
  if (s <= 50) return 1
  if (s <= 75) return 2
  return 3
}
