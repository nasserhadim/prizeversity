import { useEffect, useRef } from 'react';
import axios from 'axios';

function dayStamp(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Run daily classroom check-in once per day per classroom (session-scoped).
 * Intended to be called from a globally-mounted component (e.g., Navbar).
 */
export default function useDailyCheckin({ user, classroomId }) {
  const inFlightRef = useRef(false);

  useEffect(() => {
    const role = String(user?.role || '').toLowerCase();
    if (!user?._id) return;
    if (!classroomId) return;

    // Backend check-in requires the user to be in classroom.students (students only).
    if (role !== 'student') return;

    const key = `dailyCheckin:${String(classroomId)}:${dayStamp()}`;
    try {
      if (sessionStorage.getItem(key) === '1') return;
    } catch {
      // if sessionStorage is unavailable, we still proceed (guarded by inFlightRef)
    }

    if (inFlightRef.current) return;
    inFlightRef.current = true;

    (async () => {
      try {
        const res = await axios.post(
          `/api/classroom/${classroomId}/checkin`,
          {},
          { withCredentials: true }
        );

        // Mark as done for this session/day whether awarded or already checked in
        if (res?.data) {
          try {
            sessionStorage.setItem(key, '1');
          } catch {
            // ignore storage errors
          }
        }
      } catch (err) {
        // If it fails, allow retry later (don’t set the key)
        console.debug('[useDailyCheckin] check-in failed:', err?.response?.data || err?.message || err);
      } finally {
        inFlightRef.current = false;
      }
    })();
  }, [user?._id, user?.role, classroomId]);
}