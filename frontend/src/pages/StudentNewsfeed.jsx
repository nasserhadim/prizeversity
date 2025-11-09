// prizeversity/frontend/src/pages/StudentNewsfeed.jsx

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getNews } from '../API/apiNewsfeed';
import { giveNewsfeedXP } from '../API/apiXP'; //award xp after post 
import ClassroomBanner from '../components/ClassroomBanner';
import { getClassroom } from '../API/apiClassroom';
import Footer from '../components/Footer';
import socket from '../utils/socket';
import { postNews } from '../API/apiNewsfeed'; //creating a post 



//import for XP card
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { computeProgress } from '../utils/xp';


const normalizePct = (p) => {
  if (!Number.isFinite(p)) return 0;
  //iff computeProgress returns 0–1, scale to 0–100
  const pct = p <= 1 ? p * 100 : p;
  return Math.max(0, Math.min(100, pct));
};

export default function StudentNewsfeed() {
    const { id: classId } = useParams();
    const [items, setItems] = useState([]);
    const [classroomName, setClassroomName] = useState('');
    const [classroomCode, setClassroomCode] = useState('');
    const [visibleCount, setVisibleCount] = useState(10);
    const [bgColor, setBgColor] = useState('');
    const [backgroundImage, setBackgroundImage] = useState('');
    const [newPostHtml, setNewPostHtml] = useState(''); //HTML accepted like your feed items)
    const [savingPost, setSavingPost] = useState(false); //prevents double submits


    //auth and xp state
    const { user } = useAuth();
    const [xpSettings, setXpSettings] = useState(null);
    const [xpRefresh, setXpRefresh] = useState(false);
    //adding a local balance oveerice for live updates
    const [localBalance, setLocalBalance] = useState(null);

//load xp settings for classroom 
  useEffect(() => {
    if (!classId) return;
    (async () => {
      try {
        const r = await axios.get(`/api/xpSettings/${classId}`);
        setXpSettings(r.data || {});
      } catch (e) {
        console.error('Failed to load xpSettings', e);
        setXpSettings({});
      }
    })();
  }, [classId, xpRefresh]);

  // Find this student's balance for this classroom
  const myClassroomBalance = React.useMemo(() => {
    //in case of a liev socket update comes in, we use it immedityly 
      if (localBalance) {
        return {
          xp: Number(localBalance.xp ?? 0),
          level: Number(localBalance.level ?? 1)
        };
      }
    const list = user?.classroomBalances || [];
    const found = list.find(cb => String(cb.classroom) === String(classId));
    return found || { xp: 0, level: 1 };
  }, [user, classId, xpRefresh, localBalance]);

  // Compute progress numbers for the bar + labels
// Compute progress numbers for the bar + labels (SAFE)
const progress = React.useMemo(() => {
  // fallback if settings not loaded yet
  if (xpSettings == null) {
    return { need: 100, have: Number(myClassroomBalance?.xp) || 0, pct: 0 };
  }
  try {
    const res = computeProgress(
      Number(myClassroomBalance?.xp) || 0,
      Number(myClassroomBalance?.level) || 1,
      xpSettings
    );
    // ensure shape
    const need = Number(res?.need) || 100;
    const have = Number(res?.have);
    let pct = Number(res?.pct);
    if (!Number.isFinite(pct)) {
      pct = need > 0 ? have / need : 0;
    }
    return { need, have, pct };
  } catch (e) {
    console.error('computeProgress failed:', e);
    const have = Number(myClassroomBalance?.xp) || 0;
    const need = 100;
    const pct = need > 0 ? have / need : 0;
    return { need, have, pct };
  }
}, [myClassroomBalance, xpSettings]);

  useEffect(() => {
    if (!classId || !user?._id) return;

    // if your backend supports rooms by classroom, join it
    socket.emit('joinClassroom', classId);

    const onXpUpdate = (payload = {}) => {
      // expected shape (adjust if your backend differs):
      // { userId, classroomId, newXP, newLevel }
      if (
        String(payload.classroomId) === String(classId) &&
        String(payload.userId) === String(user._id)
      ) {
        // flip a local flag to recalc progress from AuthContext values
        //setXpRefresh(r => !r);
        //oveerride locally so the bar will move instanlty 
        setLocalBalance({ xp: payload.newXP, level: payload.newLevel });
      }
    };

    socket.on('xp:update', onXpUpdate);

    return () => {
      socket.off('xp:update', onXpUpdate);
      socket.emit('leaveClassroom', classId);
    };
  }, [classId, user?._id]);

    useEffect(() => {
        async function fetchData() {
            // fetch announcements
            const newsRes = await getNews(classId);
            setItems(newsRes.data);
            // fetch classroom info
            const classRes = await getClassroom(classId);
            setClassroomName(classRes.data.name);
            setClassroomCode(classRes.data.code);
            setBgColor(classRes.data.color);
            setBackgroundImage(classRes.data.backgroundImage);
        }
        fetchData();
    }, [classId]);

        async function handleCreatePost() {
          if (!newPostHtml.trim()) {
            return; // no empty posts
          }
          try {
            setSavingPost(true);

            //Create the post in your existing API
            //Expecting your createNews to return { data: { post: {_id, ...} } } or { postId }
            const res = await createNews(classId, { content: newPostHtml }); // adjust payload keys if your API differs
            const created = res?.data?.post || res?.data || {}; // tolerate different shapes
            const postId = created._id || created.postId;       // we only need an id for XP call

            // 2) Optimistically refresh the list so user sees their post
            const newsRes = await getNews(classId);
            setItems(newsRes.data || []);

            // 3) Immediately award XP for posting (idempotent server-side)
            if (postId) {
              await giveNewsfeedXP(classId, postId); // award and emit socket xp:update
            }

            //Clear composer + toast
            setNewPostHtml('');
            // toast.success('Announcement posted (+XP)');
          } catch (e) {
            console.error('[Newsfeed] create + XP failed:', e);
            // toast.error(e?.response?.data?.error || 'Failed to post');
          } finally {
            setSavingPost(false);
          }
        }    

    console.log({
    xpSettings,
    myClassroomBalance,
    computedProgress: progress
    });


    return (
        <div className="flex flex-col min-h-screen bg-base-200">
            <div className="flex-grow">
                <ClassroomBanner
                    name={classroomName}
                    code={classroomCode}
                    bgColor={bgColor}
                    backgroundImage={backgroundImage}
                    classroomId={classId}
                />
                <div className="max-w-3xl mx-auto p-6 bg-green-50 rounded-lg">
                    <p className="mb-4">
                        <Link to={`/classroom/${classId}`} className="link text-accent">
                            ← Back to Classroom
                        </Link>
                        </p>
    {/* --- XP DEBUG CARD (TEMPORARY) --- */}
    {(() => {
    // derive sane numbers no matter what computeProgress returns
    const haveSafe = Number(progress?.have) || 0;
    const needSafe = Number(progress?.need) || 100;

    // if progress.pct is missing, compute from have/need
    const derivedPct = needSafe > 0 ? (haveSafe / needSafe) : 0;
    const rawPct = (typeof progress?.pct === 'number') ? progress.pct : derivedPct;

    const pct = normalizePct(rawPct);

    const level = myClassroomBalance?.level ?? 1;

    return (
        <div className="card bg-white border border-green-200 shadow-sm rounded-lg p-4 mb-4"
            style={{ outline: '3px solid red' }}>
        <div className="flex items-center justify-between mb-1">
            <div className="font-semibold">Level {level}</div>
            <div className="text-sm text-gray-600">{haveSafe} / {needSafe} XP</div>
        </div>

        {/* Fallback bar only (always visible) */}
        <div className="h-2 bg-gray-200 rounded">
            <div className="h-2 rounded bg-green-500" style={{ width: `${pct}%` }} />
        </div>
        <div className="text-xs text-gray-500 mt-1">{Math.round(pct)}% to next level</div>

        {/* On-screen debug payload */}
        <pre className="mt-3 text-xs bg-gray-50 p-2 rounded border overflow-auto">
            {JSON.stringify({ xpSettings, myClassroomBalance, progress, rawPct, pct }, null, 2)}
        </pre>
        <p className="text-[10px] text-gray-400 mt-1">[TEMP DEBUG: always rendering XP card]</p>
        </div>
    );
    })()}
    {/* --- END XP DEBUG CARD --- */}



                    <h2 className="text-center text-green-500 text-4xl font-bold mb-4">
                        Announcements
                    </h2>
                    {/* Teacher compose box */}
                    {user?.role === 'teacher' && (
                      <div className="card bg-white border border-green-200 rounded-lg p-4 mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          New Announcement (HTML allowed)
                        </label>
                        <textarea
                          className="textarea textarea-bordered w-full"
                          rows={4}
                          placeholder="Type your announcement (you can paste formatted HTML if your editor outputs it)…"
                          value={newPostHtml}
                          onChange={(e) => setNewPostHtml(e.target.value)}
                        />
                        <div className="mt-3 flex gap-2">
                          <button
                            className="btn bg-green-500 hover:bg-green-600 text-white"
                            onClick={handleCreatePost}
                            disabled={savingPost || !newPostHtml.trim()}
                          >
                            {savingPost ? 'Posting…' : 'Post Announcement (+XP)'}
                          </button>
                          <button
                            className="btn btn-ghost"
                            onClick={() => setNewPostHtml('')}
                            disabled={savingPost || !newPostHtml}
                          >
                            Clear
                          </button>
                        </div>
                        <p className="text-[11px] text-gray-500 mt-2">
                          Posting will grant XP per your classroom settings (once per post, server-side idempotent).
                        </p>
                      </div>
                    )}

                    <ul className="space-y-6">
                        {items.slice(0, visibleCount).map(i => (
                            <li key={i._id} className="bg-white p-4 border border-green-200 rounded-lg shadow-sm mx-auto">
                                <p className="text-sm text-gray-600 mb-1">
                                    Posted by {i.authorId.firstName} {i.authorId.lastName}
                                </p>
                                <small className="block text-gray-500 mb-2">
                                    {new Date(i.createdAt).toLocaleString()}
                                </small>
                                {/* Render formatted content */}
                                <div
                                    className="mb-2 text-gray-800 text-xl"
                                    dangerouslySetInnerHTML={{ __html: i.content }}
                                />

                                {/* List attachments, if present */}
                                {i.attachments && i.attachments.length > 0 && (
                                    <ul className="mt-2 space-y-1">
                                        {i.attachments.map(a => (
                                            <li key={a.url}>
                                                <a
                                                    href={a.url}
                                                    download
                                                    className="text-blue-500 underline"
                                                >
                                                    {a.originalName}
                                                </a>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </li>
                        ))}
                    </ul>
                    <div className="flex justify-center space-x-4 mt-4">
                        {items.length > visibleCount && (
                            <button
                                className="btn bg-green-500 hover:bg-green-600 text-white px-4 py-2"
                                onClick={() => setVisibleCount(items.length)}
                            >
                                Show more announcements
                            </button>
                        )}
                        {visibleCount > 10 && (
                            <button
                                className="btn bg-green-500 hover:bg-green-600 text-white px-4 py-2"
                                onClick={() => setVisibleCount(10)}
                            >
                                Show less announcements
                            </button>
                        )}
                    </div>
                </div>
            </div>
            <Footer />
        </div>
    );
}