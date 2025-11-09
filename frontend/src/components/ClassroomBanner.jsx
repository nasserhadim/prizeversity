import React, { useEffect, useState } from 'react';
import { giveAttendanceXP } from '../API/apiXP';
import toast from 'react-hot-toast';

export default function ClassroomBanner({ name, code, bgColor, backgroundImage, classroomId}){
  const [checkingIn, setCheckingIn] = useState(false);
  const [countToday, setCountToday] = useState(0);
  const [limitToday, setLimitToday] = useState(1);
  const [cooldown, setCooldown] = useState(0); // seconds

  const innerStyle = {};
  if (backgroundImage) {
    innerStyle.backgroundImage = `url("${backgroundImage}")`;
    innerStyle.backgroundSize = 'cover';
    innerStyle.backgroundPosition = 'center';
    innerStyle.backgroundRepeat = 'no-repeat';
  } else {
    innerStyle.backgroundColor = bgColor || '#22c55e';
  }

const todayStamp = () => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}${mm}${dd}`;
};
const lsKey = classroomId ? `pv_dailycheckin_${classroomId}_${todayStamp()}` : null;

useEffect(() => {
  if (!lsKey) return;
  const raw = localStorage.getItem(lsKey);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      setCountToday(Number(parsed.count || 0));
      setLimitToday(Number(parsed.limit || 1));
    } catch {}
  }
}, [lsKey]);

useEffect(() => {
  if (cooldown <= 0) return;
  const t = setInterval(() => setCooldown(s => (s > 0 ? s - 1 : 0)), 1000);
  return () => clearInterval(t);
}, [cooldown]);


async function handleCheckIn() {
  if (checkingIn || cooldown > 0) return;
  if (!classroomId) {
    toast.error('Missing classroom ID');
    return;
  }
  if (countToday >= limitToday) {
    toast('Already checked in today 👌');
    return;
  }

  setCheckingIn(true);
  try {
    const res = await giveAttendanceXP(classroomId);
    setCooldown(2);

    if (res?.ok) {
      toast.success(res.message || 'Checked in! XP granted 🎉');
      const nextCount = Number(res?.countToday ?? countToday + 1);
      const nextLimit = Number(res?.limit ?? limitToday ?? 1);
      setCountToday(nextCount);
      setLimitToday(nextLimit);
      if (lsKey) {
        localStorage.setItem(lsKey, JSON.stringify({ count: nextCount, limit: nextLimit }));
      }
    } else if (res?.error === 'Daily check-in limit reached for today') {
      toast('Already checked in today 👌');
      if (lsKey) {
        localStorage.setItem(lsKey, JSON.stringify({ count: limitToday, limit: limitToday }));
      }
      setCountToday(limitToday);
    } else {
      toast.error(res?.error || 'Check-in failed');
    }
  } catch (err) {
    toast.error('Error checking in');
  } finally {
    setCheckingIn(false);
  }
}

  return (
    <div className="py-6 px-4">
      <div
        className="mx-auto w-full max-w-3xl rounded-lg overflow-hidden shadow-sm relative"
        style={innerStyle}
      >
        {/* Overlay to improve text contrast on image backgrounds */}
        {backgroundImage && (
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(to bottom, rgba(0,0,0,0.35), rgba(0,0,0,0.35))',
              // fallback for older browsers
              pointerEvents: 'none'
            }}
          />
        )}

        <div className="py-10 px-6 text-center relative z-10">
          <h1
            className="text-3xl font-bold break-words"
            style={{ color: backgroundImage ? '#ffffff' : undefined, textShadow: backgroundImage ? '0 1px 2px rgba(0,0,0,0.6)' : undefined }}
          >
            {name}
            {code ? ` (${code})` : ''}
          </h1>
        <button
          onClick={handleCheckIn}
          disabled={checkingIn || cooldown > 0 || countToday >= limitToday}
          className="mt-4 bg-white text-green-600 font-semibold px-5 py-2 rounded-md shadow hover:bg-green-50 disabled:opacity-60"
        >
          {checkingIn
            ? 'Checking in…'
            : countToday >= limitToday
            ? 'Checked in'
            : cooldown > 0
            ? `Wait ${cooldown}s…`
            : 'Check In'}
        </button>
        <div className="mt-2 text-xs opacity-80">
          {countToday}/{limitToday} used today
        </div>
        </div>
      </div>
    </div>
  );
}