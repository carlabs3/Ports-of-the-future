// Single source of truth for carbon footprint categories.
// Thresholds: <4t = bajo, <7t = medio, <10t = alto, ≥10t = muy alto.
// Run once on existing DB to create the index:
//   db.footprintresults.createIndex({ submissionId: 1 }, { unique: true, sparse: true })
// Deduplicate first if needed:
//   db.footprintresults.aggregate([...]) -- see project README
export function getCategory(carbonTons) {
  if (carbonTons < 4)  return 'bajo'
  if (carbonTons < 7)  return 'medio'
  if (carbonTons < 10) return 'alto'
  return 'muy alto'
}
