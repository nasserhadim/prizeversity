import { useEffect, useRef } from 'react';
import axios from 'axios';

const HEARTBEAT_INTERVAL_MS = 60_000; // every 60 seconds

export default function useSessionActivity({ user, classroomId }) {
  const intervalRef = useRef(null);
  const lastTickRef = useRef(null);

  useEffect(() => {
    if (!user?._id || !classroomId) return;

    // Signal session start
    axios.post(`/api/classroom/${classroomId}/session/start`, {}, { withCredentials: true })
      .catch(err => console.debug('[session] start failed', err?.message));

    lastTickRef.current = Date.now();

    // Periodic heartbeat
    intervalRef.current = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.round((now - (lastTickRef.current || now)) / 1000);
      lastTickRef.current = now;

      axios.post(
        `/api/classroom/${classroomId}/session/heartbeat`,
        { seconds: elapsed },
        { withCredentials: true }
      ).catch(err => console.debug('[session] heartbeat failed', err?.message));
    }, HEARTBEAT_INTERVAL_MS);

    // On unmount or tab close, send a final heartbeat
    const handleUnload = () => {
      const now = Date.now();
      const elapsed = Math.round((now - (lastTickRef.current || now)) / 1000);
      if (elapsed > 0) {
        // Use sendBeacon for reliability on page unload
        const blob = new Blob(
          [JSON.stringify({ seconds: elapsed })],
          { type: 'application/json' }
        );
        navigator.sendBeacon(`/api/classroom/${classroomId}/session/heartbeat`, blob);
      }
    };

    window.addEventListener('beforeunload', handleUnload);

    return () => {
      clearInterval(intervalRef.current);
      window.removeEventListener('beforeunload', handleUnload);
      // Send final heartbeat on cleanup
      handleUnload();
    };
  }, [user?._id, classroomId]);
}