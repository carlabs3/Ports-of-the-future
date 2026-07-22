import { PORTS_BY_ID } from '../config/ports/index.js'

// Validate the port assignments submitted at session creation.
// Rules: every group has exactly one portId; every portId exists; no two
// groups share a port. Pure and testable (no DB). Returns { ok, error }.
export function validatePortAssignments(groups = [], portAssignments = []) {
  if (!Array.isArray(portAssignments) || portAssignments.length !== groups.length) {
    return { ok: false, error: 'Cada grupo debe tener exactamente un puerto asignado' }
  }
  const seenGroups = new Set()
  const seenPorts = new Set()
  for (const pa of portAssignments) {
    if (!pa || !groups.includes(pa.group)) {
      return { ok: false, error: `Grupo desconocido en la asignación de puertos: ${pa?.group}` }
    }
    if (seenGroups.has(pa.group)) {
      return { ok: false, error: `Grupo duplicado en la asignación de puertos: ${pa.group}` }
    }
    seenGroups.add(pa.group)

    if (!PORTS_BY_ID[pa.portId]) {
      return { ok: false, error: `Puerto inexistente: ${pa.portId}` }
    }
    if (seenPorts.has(pa.portId)) {
      return { ok: false, error: `Dos grupos no pueden compartir el mismo puerto (portId ${pa.portId})` }
    }
    seenPorts.add(pa.portId)
  }
  for (const g of groups) {
    if (!seenGroups.has(g)) return { ok: false, error: `El grupo "${g}" no tiene puerto asignado` }
  }
  return { ok: true }
}
