// prizeversity/frontend/src/pages/TeacherNewsfeed.jsx

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getNews, postNews, deleteNews, editNews } from '../API/apiNewsfeed';
import toast from 'react-hot-toast';


export default function TeacherNewsfeed() {
    const { id: classId } = useParams();
    const [items, setItems] = useState([]);
    const sortedItems = [...items].sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
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

    const handleEdit = async (itemId, newContent) => {
        try {
            await editNews(classId, itemId, newContent);
            setItems(items.map(i =>
                i._id === itemId ? { ...i, content: newContent } : i
            ));
            toast.success('News updated');
        } catch (err) {
            toast.error('Failed to update news');
        }
    };

    return (
        <div className="max-w-3xl mx-auto p-6">
            <h2 className="text-center text-green-500 text-5xl font-bold mb-6">
                Manage News
            </h2>
            <textarea
                className="w-full h-32 p-3 border border-gray-300 rounded mb-4"
                value={draft}
                onChange={e => setDraft(e.target.value)}
                placeholder="Write an update…"
            />
            <button
                className="btn btn-primary px-6 py-2 mb-6"
                onClick={handlePost}
                disabled={!draft.trim()}
            >
                Post
            </button>

            <ul className="space-y-6">
                {sortedItems.map(i => (
                    <li key={i._id} className="p-4 border border-gray-200 rounded shadow-sm mx-auto">

                        <p className="text-sm text-gray-600 mb-1">
                            Posted by {i.authorId.firstName} {i.authorId.lastName}
                        </p>
                        <small className="block text-gray-500 mb-4">
                            {new Date(i.createdAt).toLocaleString()}
                        </small>
                        <button
                            className="btn btn-sm btn-error mt-2"
                            onClick={() => handleDelete(i._id)}
                        >
                            Delete
                        </button>

                        <button
                            className="btn btn-sm btn-primary mt-2 ml-2"
                            onClick={() => {
                                const updated = prompt('Edit this news item:', i.content);
                                if (updated !== null && updated.trim() !== '') {
                                    handleEdit(i._id, updated.trim());
                                }
                            }}
                        >
                            Edit
                        </button>
                    </li>
                ))}
            </ul>
        </div >
    );
}