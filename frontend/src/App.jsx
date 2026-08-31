import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import PrivateRoute from './components/PrivateRoute.jsx'
import Home from './pages/Home.jsx'
import FacilitatorLogin from './pages/facilitator/FacilitatorLogin.jsx'
import FacilitatorDashboard from './pages/facilitator/FacilitatorDashboard.jsx'
import SessionCreate from './pages/facilitator/SessionCreate.jsx'
import PortsControlCenter from './pages/facilitator/PortsControlCenter.jsx'
import JoinSession from './pages/participant/JoinSession.jsx'
import PariCalculator from './pages/participant/PariCalculator.jsx'
import PariResult from './pages/participant/PariResult.jsx'
import SessionEnd from './pages/participant/SessionEnd.jsx'

export default function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<FacilitatorLogin />} />
        <Route path="/join" element={<JoinSession />} />
        <Route path="/session/:code/par" element={<PariCalculator />} />
        <Route path="/session/:code/par-result" element={<PariResult />} />
        <Route path="/session/:code/end" element={<SessionEnd />} />

        <Route element={<PrivateRoute />}>
          <Route path="/dashboard" element={<FacilitatorDashboard />} />
          <Route path="/session/create" element={<SessionCreate />} />
          <Route path="/session/:code/control" element={<PortsControlCenter />} />
        </Route>
      </Routes>
    </>
  )
}
