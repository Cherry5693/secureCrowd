import React from 'react';
import { useLocation } from '../hooks/useLocation';

export default function LocationModal() {
  const { errorStatus } = useLocation();

  if (!errorStatus) return null;

  let title = "Location Error";
  let message = "We could not determine your location.";

  if (errorStatus === 'DENIED') {
    title = "Location Access Required";
    message = "Location access is required to use this app. Please enable location permissions in your browser to continue.";
  } else if (errorStatus === 'OUTSIDE') {
    title = "Access Restricted";
    message = "You need to be inside the allowed area to use this app.";
  } else if (errorStatus === 'UNSUPPORTED') {
    title = "Browser Unsupported";
    message = "Your browser does not support geolocation, which is required for this app.";
  }

  return (
    <div className="modal-overlay" style={{ zIndex: 9999 }}>
      <div className="modal-box" style={{ textAlign: 'center', maxWidth: 400 }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>📍</div>
        <h2 style={{ marginBottom: 12, color: 'var(--text-primary)' }}>{title}</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>
          {message}
        </p>
        {errorStatus === 'DENIED' && (
          <button 
            className="btn btn-primary btn-full"
            onClick={() => window.location.reload()}
          >
            I have enabled permissions (Reload)
          </button>
        )}
      </div>
    </div>
  );
}
