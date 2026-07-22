import Session from '../models/Session.js'

export async function generateCode() {
  let code
  let exists = true
  while (exists) {
    const num = Math.floor(1000 + Math.random() * 9000)
    code = `DROP-${num}`
    exists = await Session.exists({ code })
  }
  return code
}
