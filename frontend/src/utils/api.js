export const apiFetch = async (url, options = {}) => {
  // 1. Get cached location
  let lat = '';
  let lng = '';
  let timestamp = Date.now().toString();

  const cachedStr = localStorage.getItem('geo_location');
  if (cachedStr) {
    try {
      const loc = JSON.parse(cachedStr);
      // Smart refresh before critical API calls if expired (5 minutes)
      if (Date.now() - loc.timestamp >= 5 * 60 * 1000) {
         // It's expired, ideally frontend should refresh, but we might just send the stale one
         // Alternatively, we can force a fetch here but async geolocation can block UI.
         // Since the hook handles tab focus, we'll just send what we have and let the backend 403 it if it's too old
         // Wait! User required: "If location expired before request: Refresh location silently before sending request"
         if (navigator.geolocation) {
           const freshPosition = await new Promise((res) => {
              navigator.geolocation.getCurrentPosition(res, () => res(null), { timeout: 5000, maximumAge: 0 });
           });
           if (freshPosition) {
             loc.lat = freshPosition.coords.latitude;
             loc.lng = freshPosition.coords.longitude;
             loc.timestamp = Date.now();
             localStorage.setItem('geo_location', JSON.stringify(loc));
           }
         }
      }
      
      lat = loc.lat.toString();
      lng = loc.lng.toString();
      // Use the *current* timestamp for anti-replay, not the location capture timestamp!
      // "timestamp older than 5 minutes" - the user meant the REQUEST timestamp, not the location timestamp.
      // Wait: "x-timestamp: Reject if timestamp older than 5 minutes. Convert Turf point using [lng, lat]".
    } catch(e) {}
  }

  // 2. Setup Headers
  const baseHeaders = {
    'Content-Type': 'application/json',
    'x-user-lat': lat,
    'x-user-lng': lng,
    'x-timestamp': timestamp,
  };
  
  // Attach JWT if available
  const organizerUser = localStorage.getItem('organizerUser');
  if (organizerUser) {
    try {
      const parsed = JSON.parse(organizerUser);
      if (parsed.token) {
        baseHeaders['Authorization'] = `Bearer ${parsed.token}`;
      }
    } catch(e) {}
  }
  
  // Attendee token (if attendee is using this)
  const attendeeSession = sessionStorage.getItem('attendeeSession');
  if (attendeeSession && !baseHeaders['Authorization']) {
     try {
       const parsed = JSON.parse(attendeeSession);
       if (parsed.token) baseHeaders['Authorization'] = `Bearer ${parsed.token}`;
     } catch(e) {}
  }

  const finalOptions = {
    ...options,
    headers: {
      ...baseHeaders,
      ...(options.headers || {})
    }
  };

  const response = await fetch(url, finalOptions);

  // 3. Handle 403 Geo Location specifically
  if (response.status === 403) {
    const data = await response.clone().json().catch(() => ({}));
    if (data.error === 'Access restricted outside allowed area') {
       window.dispatchEvent(new CustomEvent('geo_error', { detail: 'OUTSIDE' }));
    } else if (data.error === 'Location expired' || data.error === 'Location required') {
       // Silent refresh triggered naturally but we dispatch fetching so UI might freeze
       window.dispatchEvent(new CustomEvent('geo_error', { detail: 'OUTSIDE' }));
    }
  }

  return response;
};
