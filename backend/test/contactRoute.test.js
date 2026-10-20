import { test } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import contactRouter from '../src/routes/contact.js'

// Spin up a throwaway server with the real router. trust proxy = 1 makes req.ip
// the leftmost X-Forwarded-For, so we can simulate distinct client IPs.
function makeServer() {
  const app = express()
  app.set('trust proxy', 1)
  app.use(express.json())
  app.use('/api/contact', contactRouter())
  return new Promise(resolve => {
    const server = app.listen(0, () => resolve({ server, port: server.address().port }))
  })
}

const post = (port, body, ip) => fetch(`http://127.0.0.1:${port}/api/contact`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip },
  body: JSON.stringify(body),
})

test('honeypot filled → 200 (nothing sent; no RESEND needed)', async () => {
  const { server, port } = await makeServer()
  try {
    const res = await post(port, { website: 'http://spam', name: 'x', organisation: 'y', email: 'a@b.co', consent: true }, '10.0.0.1')
    assert.equal(res.status, 200)
  } finally { server.close() }
})

test('missing required field → 400', async () => {
  const { server, port } = await makeServer()
  try {
    const res = await post(port, { name: '', organisation: 'y', email: 'a@b.co', consent: true }, '10.0.0.2')
    assert.equal(res.status, 400)
  } finally { server.close() }
})

test('rate limit: 5/hour per IP, and two IPs get separate limits', async () => {
  const { server, port } = await makeServer()
  try {
    const body = { website: 'x' } // honeypot → 200, still counts toward the limiter
    const A = '203.0.113.1', B = '203.0.113.2'
    const statuses = []
    for (let i = 0; i < 6; i++) statuses.push((await post(port, body, A)).status)
    assert.deepEqual(statuses.slice(0, 5), [200, 200, 200, 200, 200], 'first 5 from IP A pass')
    assert.equal(statuses[5], 429, '6th from IP A is rate-limited')

    // A different IP has its own budget and is not affected by A's limit.
    const bRes = await post(port, body, B)
    assert.equal(bRes.status, 200, 'IP B is unaffected')
  } finally { server.close() }
})
