// prizeversity/frontend/src/pages/StudentNewsfeed.jsx

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getNews } from '../API/apiNewsfeed';
import ClassroomBanner from '../components/ClassroomBanner';
import { getClassroom } from '../API/apiClassroom';
import Footer from '../components/Footer';
import socket from '../utils/socket';
import { resolveBannerSrc } from '../utils/image';


export default function StudentNewsfeed() {
    const { id: classId } = useParams();
    
    const [items, setItems] = useState([]);
    const [classroomName, setClassroomName] = useState('');
    const [classroomCode, setClassroomCode] = useState('');
    const [visibleCount, setVisibleCount] = useState(10);
    const [bgColor, setBgColor] = useState('');
    const [backgroundImage, setBackgroundImage] = useState('');

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

    return (
        <div className="flex flex-col min-h-screen bg-base-200">
            <div className="flex-grow">
                <ClassroomBanner
                  name={classroomName}
                  code={classroomCode}
                  bgColor={bgColor}
                  backgroundImage={resolveBannerSrc(backgroundImage)}
                />
                <div className="max-w-3xl mx-auto p-6 bg-green-50 rounded-lg">
                    <p className="mb-4">
                        <Link to={`/classroom/${classId}`} className="link text-accent">
                            ← Back to Classroom
                        </Link>
                    </p>
                    <h2 className="text-center text-green-500 text-4xl font-bold mb-4">
                        Announcements
                    </h2>
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
  className="mb-2 text-gray-800 text-xl announcement-content"
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