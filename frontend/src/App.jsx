import { Routes, Route, Navigate } from 'react-router-dom'
import Auth from './components/Auth'
import EventJoin from './components/EventJoin'
import Groups from './components/Groups'
import OrganizerDashboard from './components/OrganizerDashboard'

const getOrganizer = () => {
  try { return JSON.parse(localStorage.getItem('organizerUser')) } catch { return null }
}
const getAttendee = () => {
  try { return JSON.parse(sessionStorage.getItem('attendeeSession')) } catch { return null }
}

function ProtectedOrganizer({ children }) {
  return getOrganizer() ? children : <Navigate to="/auth" replace />
}
function ProtectedAttendee({ children }) {
  return getAttendee() ? children : <Navigate to="/join" replace />
}

export default function App() {
  const organizer = getOrganizer()
  const attendee  = getAttendee()

  return (
    <Routes>
      <Route path="/" element={
        organizer ? <Navigate to="/organizer" replace /> :
        attendee  ? <Navigate to="/chat" replace /> :
                    <Navigate to="/join" replace />
      }/>
      <Route path="/auth" element={organizer ? <Navigate to="/organizer" replace /> : <Auth />} />
      <Route path="/join" element={attendee  ? <Navigate to="/chat" replace />    : <EventJoin />} />
      <Route path="/chat" element={
        <ProtectedAttendee><Groups /></ProtectedAttendee>
      }/>
      <Route path="/organizer" element={
        <ProtectedOrganizer><OrganizerDashboard /></ProtectedOrganizer>
      }/>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
