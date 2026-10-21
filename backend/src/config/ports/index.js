// Aggregates every port file into a single ordered list (workshop v4: 6 ports).
// To add a port, drop a new file here and add one import + array entry.
import nordMaris from './01-nord-maris.js'
import meridia   from './02-meridia.js'
import riuVerd   from './03-riu-verd.js'
import boreal    from './04-boreal.js'
import coralia   from './05-coralia.js'
import sabkha    from './06-sabkha.js'

export const PORTS = [nordMaris, meridia, riuVerd, boreal, coralia, sabkha]

// Indexable by id (string slugs, e.g. 'nord-maris').
export const PORTS_BY_ID = Object.fromEntries(PORTS.map(p => [p.id, p]))
