// Aggregates every port file into a single ordered list. To add a port, drop a
// new file in this directory and add one import + array entry here.
import nordMaris from './01-nord-maris.js'
import deltaSud  from './02-delta-sud.js'
import riuVerd   from './03-riu-verd.js'
import rhona     from './04-rhona.js'
import meridia   from './05-meridia.js'
import insularis from './06-insularis.js'
import boreal    from './07-boreal.js'
import adria     from './08-adria.js'
import atlantis  from './09-atlantis.js'
import kanal     from './10-kanal.js'

export const PORTS = [
  nordMaris, deltaSud, riuVerd, rhona, meridia,
  insularis, boreal, adria, atlantis, kanal,
]

// Indexable by id.
export const PORTS_BY_ID = Object.fromEntries(PORTS.map(p => [p.id, p]))
