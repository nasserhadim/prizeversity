// prizeversity/frontend/src/pages/TeacherNewsfeed.jsx

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getNews, postNews, deleteNews } from '../API/apiNewsfeed';
import toast from 'react-hot-toast';


export default function TeacherNewsfeed() {
    const { id: classId } = useParams();
    const [items, setItems] = useState([]);
    const [draft, setDraft] = useState('');

    useEffect(() => {
        getNews(classId).then(res => setItems(res.data));
    }, [classId]);

    const handlePost = async () => {
        const res = await postNews(classId, draft);
        setItems([res.data, ...items]);
        setDraft('');
    };

    const handleDelete = async (itemId) => {
        try {
            await deleteNews(classId, itemId);
            setItems(items.filter(item => item._id !== itemId));
            toast.success('News item deleted');
        } catch (err) {
            console.error('Delete failed', err);
            toast.error('Failed to delete');
        }
    };

    return (
        <div>
            <h2 className="text-center text-green-500 text-4xl font-bold mb-4">
                Class News
            </h2>
            <textarea
                value={draft}
                onChange={e => setDraft(e.target.value)}
                placeholder="Write an update…"
            />
            <button onClick={handlePost} disabled={!draft.trim()}>
                Post
            </button>

            <ul>
                {items.map(i => (
                    <li key={i._id} className="space-y-1 p-4 border rounded-md">
                        <small className="block text-gray-500">
                            {new Date(i.createdAt).toLocaleString()}
                        </small>
                        <p className="text-lg">{i.content}</p>
                        <button
                            className="btn btn-sm btn-error mt-2"
                            onClick={() => handleDelete(i._id)}
                        >
                            Delete
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
}