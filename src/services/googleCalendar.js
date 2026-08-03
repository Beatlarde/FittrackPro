const GOOGLE_CALENDAR_CLIENT_ID = import.meta.env.VITE_GOOGLE_CALENDAR_CLIENT_ID;
const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';

// Helper: obtener token de Google Calendar via OAuth popup
export const getGoogleCalendarToken = () => new Promise((resolve, reject) => {
  const params = new URLSearchParams({
    client_id: GOOGLE_CALENDAR_CLIENT_ID,
    redirect_uri: 'https://fittrackpro.store',
    response_type: 'token',
    scope: GOOGLE_CALENDAR_SCOPE,
    prompt: 'consent'
  });
  const popup = window.open(`https://accounts.google.com/o/oauth2/v2/auth?${params}`, 'googleAuth', 'width=500,height=600');
  const interval = setInterval(() => {
    try {
      const url = popup?.location?.href || '';
      if (url.includes('access_token')) {
        clearInterval(interval);
        popup.close();
        const hash = new URLSearchParams(url.split('#')[1]);
        resolve(hash.get('access_token'));
      }
      if (popup?.closed) { clearInterval(interval); reject(new Error('Popup cerrado')); }
    } catch {}
  }, 500);
});

// Helper: crear evento en Google Calendar
export const createCalendarEvent = async (token, event) => {
  const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(event)
  });
  return res.json();
};
