import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from "react-hot-toast"

import Auth from './components/Auth'
import EventJoin from './components/EventJoin'
import Groups from './components/Groups'
import OrganizerDashboard from './components/OrganizerDashboard'
import SecurityDashboard from './components/SecurityDashboard'
import ResetPassword from './components/resetModal/ResetPassword'

import { LocationProvider } from './hooks/useLocation'
import LocationModal from './components/LocationModal'

// ── Helpers ─────────────────────────────────────
const getStaff = () => {
  try { return JSON.parse(localStorage.getItem('organizerUser')) } 
  catch { return null }
}

const getAttendee = () => {
  try { return JSON.parse(sessionStorage.getItem('attendeeSession')) } 
  catch { return null }
}

// ── Protected Routes ────────────────────────────
function ProtectedOrganizer({ children }) {
  const staff = getStaff()
  return staff?.role === 'organizer' ? children : <Navigate to="/auth" replace />
}

function ProtectedSecurity({ children }) {
  const staff = getStaff()
  return staff?.role === 'security' ? children : <Navigate to="/auth" replace />
}

function ProtectedAttendee({ children }) {
  return getAttendee() ? children : <Navigate to="/join" replace />
}

// ── App ─────────────────────────────────────────
export default function App() {
  const staff = getStaff()
  const attendee = getAttendee()

  return (
    <LocationProvider>
      <LocationModal />
      {/* Global Toast System */}
      <Toaster
        position="top-right"
        reverseOrder={false}
        toastOptions={{
          style: {
            background: "#1e1e2f",
            color: "#fff",
            border: "1px solid #2c2c3a",
          },
        }}
      />

      {/* Routes */}
      <Routes>


        <Route path="/" element={
          staff?.role === 'security' ? <Navigate to="/security" replace /> :
          staff?.role === 'organizer' ? <Navigate to="/organizer" replace /> :
          attendee ? <Navigate to="/chat" replace /> :
                     <Navigate to="/join" replace />
        }/>

        <Route path="/auth" element={
          staff?.role === 'security' ? <Navigate to="/security" replace /> :
          staff?.role === 'organizer' ? <Navigate to="/organizer" replace /> : 
          <Auth />
        } />

        <Route 
          path="/join" 
          element={attendee ? <Navigate to="/chat" replace /> : <EventJoin />} 
        />

        <Route 
          path="/chat" 
          element={
            <ProtectedAttendee>
              <Groups />
            </ProtectedAttendee>
          } 
        />

        <Route 
          path="/organizer" 
          element={
            <ProtectedOrganizer>
              <OrganizerDashboard />
            </ProtectedOrganizer>
          } 
        />

        <Route 
          path="/security" 
          element={
            <ProtectedSecurity>
              <SecurityDashboard />
            </ProtectedSecurity>
          } 
        />

        <Route path="/reset-password/:token" element={<ResetPassword />} />
        
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </LocationProvider>
  )
}