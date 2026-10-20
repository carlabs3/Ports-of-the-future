import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateContactRequest, isHoneypotFilled, CONTACT_LIMITS } from '../src/services/contactService.js'

const valid = { name: 'Ada', organisation: 'Port Co', email: 'ada@port.co', consent: true }

test('valid request passes and returns trimmed data', () => {
  const r = validateContactRequest({ ...valid, name: '  Ada  ', country: ' NL ', message: 'hi' })
  assert.equal(r.ok, true)
  assert.equal(r.data.name, 'Ada')
  assert.equal(r.data.country, 'NL')
  assert.equal(r.data.email, 'ada@port.co')
})

test('name, organisation and email are required', () => {
  assert.equal(validateContactRequest({ ...valid, name: '' }).ok, false)
  assert.equal(validateContactRequest({ ...valid, name: '   ' }).ok, false)
  assert.equal(validateContactRequest({ ...valid, organisation: '' }).ok, false)
  assert.equal(validateContactRequest({ ...valid, email: '' }).ok, false)
})

test('email must be valid', () => {
  for (const bad of ['notanemail', 'a@b', 'a@b.', '@b.co', 'a b@c.co']) {
    assert.equal(validateContactRequest({ ...valid, email: bad }).ok, false, bad)
  }
})

test('consent must be exactly true', () => {
  assert.equal(validateContactRequest({ ...valid, consent: false }).ok, false)
  assert.equal(validateContactRequest({ ...valid, consent: 'true' }).ok, false)
  assert.equal(validateContactRequest({ ...valid, consent: undefined }).ok, false)
})

test('over-long fields are rejected', () => {
  assert.equal(validateContactRequest({ ...valid, name: 'x'.repeat(CONTACT_LIMITS.name + 1) }).ok, false)
  assert.equal(validateContactRequest({ ...valid, message: 'x'.repeat(CONTACT_LIMITS.message + 1) }).ok, false)
  // exactly at the limit is allowed
  assert.equal(validateContactRequest({ ...valid, message: 'x'.repeat(CONTACT_LIMITS.message) }).ok, true)
})

test('honeypot: non-empty website is spam, empty/absent is not', () => {
  assert.equal(isHoneypotFilled({ website: 'http://spam' }), true)
  assert.equal(isHoneypotFilled({ website: '  ' }), false)
  assert.equal(isHoneypotFilled({ website: '' }), false)
  assert.equal(isHoneypotFilled({}), false)
})
