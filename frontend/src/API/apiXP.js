import axios from 'axios';

// use a relative /api path so it works in dev/prod behind the same origin
const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});


 //Daily attendance (check-in) XP

export async function giveAttendanceXP(classroomId) {
  try {
    const { data } = await api.post('/xpstudent/dailycheckin', { classroomId });
    return data; // { ok, message, ... }
  } catch (e) {
    console.warn('[XP] attendance failed:', e?.response?.data || e.message);
    return { ok: false, error: e?.response?.data?.error || 'request_failed' };
  }
}


export async function giveGroupJoinXP(classroomId) {
  try {
    const { data } = await api.post('/xpstudent/group-join', { classroomId });
    return data;
  } catch (e) {
    console.warn('[XP] group-join failed:', e?.response?.data || e.message);
    return { ok: false };
  }
}

export async function giveMysteryBoxXP(classroomId) {
  try {
    const { data } = await api.post('/xpstudent/mystery-box', { classroomId });
    return data;
  } catch (e) {
    console.warn('[XP] mystery-box failed:', e?.response?.data || e.message);
    return { ok: false };
  }
}

export async function giveChallengeXP(classroomId, challengeId) {
  try {
    const { data } = await api.post('/xpstudent/challenge-complete', { classroomId, challengeId });
    return data;
  } catch (e) {
    console.warn('[XP] challenge failed:', e?.response?.data || e.message);
    return { ok: false };
  }
}

export async function giveNewsfeedXP(classroomId, postId) {
  try {
    const { data } = await api.post('/xpstudent/news-post', { classroomId, postId });
    return data;
  } catch (e) {
    console.warn('[XP] news-post failed:', e?.response?.data || e.message);
    return { ok: false };
  }
}


export async function giveStatsBoostXP(classroomId, boostKey) {
  try {
    const { data } = await api.post('/xpstudent/stats-boost', { classroomId, boostKey });
    return data;
  } catch (e) {
    console.warn('[XP] stats-boost failed:', e?.response?.data || e.message);
    return { ok: false };
  }
}
