// prizeversity/frontend/src/pages/StudentNewsfeed.jsx

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getNews } from '../API/apiNewsfeed';

export default function StudentNewsfeed() {
    const { id: classId } = useParams();
    const [items, setItems] = useState([]);

    useEffect(() => {
        getNews(classId).then(res => setItems(res.data));
    }, [classId]);

    return (
        <div>
            <h2 className="text-center text-green-500 text-4xl font-bold mb-4">
                Class News
            </h2>
            <ul>
                {items.map(i => (
                    <li key={i._id}>
                        <small>{new Date(i.createdAt).toLocaleString()}</small>
                        <p>{i.content}</p>
                    </li>
                ))}
            </ul>
        </div>
    );
}