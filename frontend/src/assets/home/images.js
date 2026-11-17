// Home-page illustrations. Imported (not referenced from /public) so Vite
// content-hashes them for cache-busting. All PNGs have transparent backgrounds
// and are decorative on the page (alt=""). The hero photo is the only JPG.
import heroShip from './hero-ship.jpg'
import illSelfAssessment from './ill-self-assessment.png'
import illReadTheRisk from './ill-read-the-risk.png'
import illStormWave from './ill-storm-wave.png'
import illPeople from './ill-people.png'
import illIsometricPort from './ill-isometric-port.png'
import illRailTerminal from './ill-rail-terminal.png'

export const HOME_IMG = {
  heroShip,
  selfAssessment: illSelfAssessment,
  readTheRisk: illReadTheRisk,
  stormWave: illStormWave,
  people: illPeople,
  isometricPort: illIsometricPort,
  railTerminal: illRailTerminal,
}
