import React, { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Custom CSS to fix Leaflet marker issues and style the tactical map
const mapStyles = `
  .leaflet-container {
    width: 100%;
    height: 100%;
    background: #000;
  }
  .leaflet-popup-content-wrapper {
    background: #18181b;
    color: #e4e4e7;
    border: 1px solid #27272a;
    border-radius: 8px;
  }
  .leaflet-popup-tip {
    background: #18181b;
    border: 1px solid #27272a;
  }
  .tactical-marker {
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .pulse-blob {
    width: 16px;
    height: 16px;
    background: var(--critical);
    border-radius: 50%;
    box-shadow: 0 0 0 0 rgba(255, 45, 85, 1);
    animation: tactical-pulse 2s infinite;
  }
  .pulse-safe {
    background: var(--safe);
    box-shadow: 0 0 0 0 rgba(48, 209, 88, 1);
  }
  .pulse-high {
    background: var(--high);
    box-shadow: 0 0 0 0 rgba(255, 149, 0, 1);
  }
  @keyframes tactical-pulse {
    0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(255, 45, 85, 0.7); }
    70% { transform: scale(1); box-shadow: 0 0 0 16px rgba(255, 45, 85, 0); }
    100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(255, 45, 85, 0); }
  }
`

// Default Center (New Delhi) if no active locations
const DEFAULT_CENTER = [28.6139, 77.2090]
const DEFAULT_ZOOM = 12

// Component to dynamically fit map bounds when alerts change
const MapBoundsFitter = ({ locations }) => {
  const map = useMap()
  useEffect(() => {
    if (locations.length === 0) return
    if (locations.length === 1) {
      map.setView([locations[0].lat, locations[0].lng], 16)
      return
    }
    const bounds = L.latLngBounds(locations.map(loc => [loc.lat, loc.lng]))
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 18 })
  }, [map, locations])
  return null
}

export default function TacticalMap({ alerts = [] }) {
  // Extract strictly processable GPS locations
  const activeLocations = alerts
    .filter(a => a.location?.lat && a.location?.lng)
    .map(a => ({
      ...a,
      lat: a.location.lat,
      lng: a.location.lng,
      isResolved: a.resolved
    }))

  const createIcon = (level, resolved) => {
    let pingClass = 'pulse-critical'
    if (resolved) pingClass = 'pulse-safe'
    else if (level === 'HIGH') pingClass = 'pulse-high'

    return L.divIcon({
      className: 'tactical-marker',
      html: `<div class="pulse-blob ${pingClass}"></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    })
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <style>{mapStyles}</style>
      
      {/* HUD Overlay */}
      <div style={{
        position: 'absolute', top: 16, left: 16, zIndex: 1000,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)',
        border: '1px solid #3f3f46', padding: '8px 16px', borderRadius: 8,
        color: '#fff', fontSize: 13, fontWeight: 700, letterSpacing: 1,
        boxShadow: '0 4px 6px rgba(0,0,0,0.3)', pointerEvents: 'none'
      }}>
        📡 GLOBAL GPS LINK <span style={{ color: 'var(--safe)', marginLeft: 8 }}>ONLINE</span>
      </div>

      {activeLocations.length === 0 && (
         <div style={{
           position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
           zIndex: 1000, textAlign: 'center', background: 'rgba(0,0,0,0.8)',
           padding: '24px 40px', borderRadius: 12, border: '1px solid #27272a',
           pointerEvents: 'none'
         }}>
           <div style={{ fontSize: 32, marginBottom: 8 }}>🛡️</div>
           <h3 style={{ color: '#a1a1aa', margin: 0, fontSize: 16 }}>No Active Beacons</h3>
           <p style={{ color: '#52525b', fontSize: 13, marginTop: 4 }}>Waiting for geolocation telemetry...</p>
         </div>
      )}

      <MapContainer 
        center={DEFAULT_CENTER} 
        zoom={DEFAULT_ZOOM} 
        zoomControl={false}
      >
        {/* Dark map tiles (CartoDB Dark Matter) */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />
        
        <MapBoundsFitter locations={activeLocations} />

        {activeLocations.map((loc) => (
          <Marker 
            key={loc._id} 
            position={[loc.lat, loc.lng]}
            icon={createIcon(loc.urgencyLevel, loc.isResolved)}
          >
            <Popup>
              <div style={{ maxWidth: 220 }}>
                <div style={{ 
                  fontSize: 11, fontWeight: 800, marginBottom: 8,
                  color: loc.isResolved ? 'var(--safe)' : loc.urgencyLevel === 'CRITICAL' ? 'var(--critical)' : 'var(--high)'
                }}>
                  SECTOR {loc.section} — {loc.isResolved ? 'RESOLVED' : loc.urgencyLevel}
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.4, marginBottom: 8 }}>
                  "{loc.message}"
                </div>
                <div style={{ fontSize: 11, color: '#a1a1aa', display: 'flex', justifyContent: 'space-between' }}>
                  <span>UID: {loc.sender || 'Unknown'}</span>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
