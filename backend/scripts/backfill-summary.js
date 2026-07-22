import 'dotenv/config'
import mongoose from 'mongoose'
import Session from '../src/models/Session.js'
import FootprintResult from '../src/models/FootprintResult.js'

await mongoose.connect(process.env.MONGODB_URI)
console.log('Connected to MongoDB')

const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length

const closedSessions = await Session.find({ status: 'closed' })
console.log(`Found ${closedSessions.length} closed session(s)`)

for (const session of closedSessions) {
  const results = await FootprintResult.find({ sessionCode: session.code })
  if (!results.length) {
    console.log(`  ${session.code}: no footprint results — skipped`)
    continue
  }
  const values   = results.map(r => r.carbonTons).sort((a, b) => a - b)
  const groupMap = results.reduce((acc, r) => {
    if (!acc[r.group]) acc[r.group] = []
    acc[r.group].push(r.carbonTons)
    return acc
  }, {})
  const summary = {
    totalParticipants: results.length,
    averageCarbonTons: Math.round(avg(values) * 10) / 10,
    medianCarbonTons:  Math.round(values[Math.floor(values.length / 2)] * 10) / 10,
    minCarbonTons:     Math.round(values[0] * 10) / 10,
    maxCarbonTons:     Math.round(values[values.length - 1] * 10) / 10,
    byArea: {
      transport:   Math.round(avg(results.map(r => r.areas?.transport   || 0)) * 10) / 10,
      energy:      Math.round(avg(results.map(r => r.areas?.energy      || 0)) * 10) / 10,
      food:        Math.round(avg(results.map(r => r.areas?.food        || 0)) * 10) / 10,
      consumption: Math.round(avg(results.map(r => r.areas?.consumption || 0)) * 10) / 10,
      waste:       Math.round(avg(results.map(r => r.areas?.waste       || 0)) * 10) / 10,
    },
    byGroup: Object.entries(groupMap).map(([group, vals]) => ({
      group,
      average: Math.round(avg(vals) * 10) / 10,
      count: vals.length,
    })),
    calculatedAt: new Date(),
  }
  await Session.findOneAndUpdate({ code: session.code }, { summary })
  console.log(`  ${session.code}: updated (${results.length} participants, avg ${summary.averageCarbonTons} t)`)
}

await mongoose.disconnect()
console.log('Done')
