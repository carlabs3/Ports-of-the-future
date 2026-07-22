import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import PrivateRoute from './components/PrivateRoute.jsx'
import Home from './pages/Home.jsx'
import FacilitatorLogin from './pages/facilitator/FacilitatorLogin.jsx'
import FacilitatorDashboard from './pages/facilitator/FacilitatorDashboard.jsx'
import SessionCreate from './pages/facilitator/SessionCreate.jsx'
import Step2Rankings from './pages/facilitator/Step2Rankings.jsx'
import SessionStats from './pages/facilitator/SessionStats.jsx'
import JoinSession from './pages/participant/JoinSession.jsx'
import WaitingRoom from './pages/participant/WaitingRoom.jsx'
import Step2Calculator from './pages/participant/Step2Calculator.jsx'
import Step2Results from './pages/participant/Step2Results.jsx'
import SessionEnd from './pages/participant/SessionEnd.jsx'
import TeamScreen from './pages/participant/TeamScreen.jsx'

export default function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<FacilitatorLogin />} />
        <Route path="/join" element={<JoinSession />} />
        <Route path="/session/:code/waiting" element={<WaitingRoom />} />
        <Route path="/session/:code/calculator" element={<Step2Calculator />} />
        <Route path="/session/:code/results" element={<Step2Results />} />
        <Route path="/session/:code/end" element={<SessionEnd />} />
        <Route path="/team/:code/:group" element={<TeamScreen />} />

        <Route element={<PrivateRoute />}>
          <Route path="/dashboard" element={<FacilitatorDashboard />} />
          <Route path="/session/create" element={<SessionCreate />} />
          <Route path="/session/:code/rankings" element={<Step2Rankings />} />
          <Route path="/session/:code/stats" element={<SessionStats />} />
        </Route>
      </Routes>
    </>
  )
}
