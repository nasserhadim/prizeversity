// prizeversity/frontend/src/pages/StudentNewsfeed.jsx

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getNews } from '../API/apiNewsfeed';

export default function StudentNewsfeed() {
    const { id: classId } = useParams();
    const [items, setItems] = useState([]);

    useEffect(() => {
        getNews(classId).then(res => setItems(res.data));
    }, [classId]);

    return (
        <div className="max-w-3xl mx-auto p-6">
            <p className="mb-4">
                <Link to={`/classroom/${classId}`} className="link text-accent">
                    ← Back to Classroom
                </Link>
            </p>
            <h2 className="text-center text-green-500 text-4xl font-bold mb-4">
                Class News
            </h2>
            <ul className="space-y-6">
                {items.map(i => (
                    <li key={i._id} className="p-4 border border-gray-200 rounded shadow-sm">
                        <p className="text-sm text-gray-600 mb-1">
                            Posted by {i.authorId.firstName} {i.authorId.lastName}
                        </p>
                        <small className="block text-gray-500 mb-2">
                            {new Date(i.createdAt).toLocaleString()}
                        </small>
                        <p className="text-xl">{i.content}</p>
                    </li>
                ))}
            </ul>
        </div>
    );
}