import { useState, useEffect, createContext, useContext, useCallback } from 'react';

const LocationContext = createContext(null);

export const LocationProvider = ({ children }) => {
  const [location, setLocation] = useState(null);
  const [errorStatus, setErrorStatus] = useState(null); // 'DENIED', 'OUTSIDE', 'FETCHING'

  const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

  const fetchLocation = useCallback(() => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        setErrorStatus('UNSUPPORTED');
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const locData = { 
            lat: latitude, 
            lng: longitude, 
            timestamp: Date.now() 
          };
          localStorage.setItem('geo_location', JSON.stringify(locData));
          setLocation(locData);
          if (errorStatus === 'DENIED' || errorStatus === 'FETCHING') setErrorStatus(null);
          resolve(locData);
        },
        (error) => {
          console.error("Geolocation Error:", error);
          if (error.code === error.PERMISSION_DENIED) {
            setErrorStatus('DENIED');
          } else {
            setErrorStatus('ERROR');
          }
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  }, [errorStatus]);

  const getValidLocation = useCallback(async () => {
    const cachedStr = localStorage.getItem('geo_location');
    if (cachedStr) {
      try {
        const cachedLoc = JSON.parse(cachedStr);
        if (Date.now() - cachedLoc.timestamp < CACHE_EXPIRY) {
          if (!location) setLocation(cachedLoc);
          return cachedLoc;
        }
      } catch (e) {
        // Corrupted cache
      }
    }
    // Need to fetch fresh
    return await fetchLocation();
  }, [fetchLocation, location]);

  useEffect(() => {
    // Initial fetch on mount
    getValidLocation();

    // Setup global event listener for 403 Geo errors from api.js
    const handleGeoError = (e) => {
      if (e.detail === 'OUTSIDE') {
        setErrorStatus('OUTSIDE');
      }
    };
    window.addEventListener('geo_error', handleGeoError);

    // Refresh on tab focus
    const handleFocus = () => {
       getValidLocation();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('geo_error', handleGeoError);
      window.removeEventListener('focus', handleFocus);
    };
  }, [getValidLocation]);

  return (
    <LocationContext.Provider value={{ location, errorStatus, getValidLocation }}>
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = () => useContext(LocationContext);
