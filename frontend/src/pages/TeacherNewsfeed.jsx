// prizeversity/frontend/src/pages/TeacherNewsfeed.jsx

import React, { useState, useEffect } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { useParams, Link } from 'react-router-dom';
import { getNews, postNews, deleteNews, editNews } from '../API/apiNewsfeed';
import toast from 'react-hot-toast';
import ClassroomBanner from '../components/ClassroomBanner';
import { getClassroom } from '../API/apiClassroom';


export default function TeacherNewsfeed() {
    const { id: classId } = useParams();
    const [items, setItems] = useState([]);
    const sortedItems = [...items].sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
    const [draft, setDraft] = useState('');
    const [attachments, setAttachments] = useState([]);
    const [classroomName, setClassroomName] = useState('');
    // banner color & image
    const [bgColor, setBgColor] = useState('');
    const [backgroundImage, setBackgroundImage] = useState('');
    const [visibleCount, setVisibleCount] = useState(10);
    const [editingId, setEditingId] = useState(null);
    const [editingContent, setEditingContent] = useState('');

    useEffect(() => {
        async function fetchData() {
            // load announcements
            const newsRes = await getNews(classId);
            setItems(newsRes.data);
            // load classroom info
            const classRes = await getClassroom(classId);
            setClassroomName(classRes.data.name);
            setBgColor(classRes.data.color);
            setBackgroundImage(classRes.data.backgroundImage);
        }
        fetchData();
    }, [classId]);

    const handlePost = async () => {
        const formData = new FormData();
        formData.append('content', draft);
        attachments.forEach(file => formData.append('attachments', file));

        const res = await postNews(classId, formData);
        setItems([res.data, ...items]);
        setDraft('');
        setAttachments([]);

    };

    const handleDelete = async (itemId) => {
        try {
            await deleteNews(classId, itemId);
            setItems(items.filter(item => item._id !== itemId));
            toast.success('Announcement deleted');
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
            toast.success('Announcement updated');
        } catch (err) {
            toast.error('Failed to update announcement');
        }
    };

    return (
        <>
            <ClassroomBanner
                name={classroomName}
                bgColor={bgColor}
                backgroundImage={backgroundImage}
            />
            <div className="max-w-3xl mx-auto p-6">
                <p className="mb-4">
                    <Link to={`/classroom/${classId}`} className="link text-accent">
                        ← Back to Classroom
                    </Link>
                </p>
                <h2 className="text-center text-green-500 text-5xl font-bold mb-6">
                    Manage Announcements
                </h2>
                <ReactQuill
                    value={draft}
                    onChange={setDraft}
                    modules={{
                        toolbar: [
                            ['bold', 'italic', 'underline', 'strike'],
                            [{ header: [1, 2, false] }],
                            [{ list: 'ordered' }, { list: 'bullet' }],
                            ['link', 'image']
                        ]
                    }}
                    placeholder="Write an update…"
                    className="mb-4"
                />
                <input
                    type="file"
                    multiple
                    onChange={e => setAttachments(Array.from(e.target.files))}
                    className="file-input file-input-sm"
                />
                <button
                    className="btn btn-success px-6 py-2 mb-6"
                    onClick={handlePost}
                    disabled={!draft.trim()}
                >
                    Post
                </button>

                <ul className="space-y-6">
                    {sortedItems.slice(0, visibleCount).map(i => (
                        <li key={i._id} className="p-4 border border-gray-200 rounded shadow-sm mx-auto">
                            <p className="text-sm text-gray-600 mb-1">
                                Posted by {i.authorId.firstName} {i.authorId.lastName}
                            </p>
                            <small className="block text-gray-500 mb-4">
                                {new Date(i.createdAt).toLocaleString()}
                            </small>
                            {/* Render formatted content */}
                            <div
                                className="mb-2 text-gray-800"
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
                            <button
                                className="btn btn-sm btn-error mt-2"
                                onClick={() => handleDelete(i._id)}
                            >
                                Delete
                            </button>
                            {editingId === i._id ? (
                                <>
                                    <ReactQuill
                                        value={editingContent}
                                        onChange={setEditingContent}
                                        modules={{
                                            toolbar: [
                                                ['bold', 'italic', 'underline', 'strike'],
                                                [{ header: [1, 2, false] }],
                                                [{ list: 'ordered' }, { list: 'bullet' }],
                                                ['link', 'image']
                                            ]
                                        }}
                                        className="mb-2 mt-2"
                                    />
                                    <button
                                        className="btn btn-sm btn-success mr-2"
                                        onClick={() => {
                                            handleEdit(i._id, editingContent.trim());
                                            setEditingId(null);
                                        }}
                                        disabled={!editingContent.trim()}
                                    >
                                        Save
                                    </button>
                                    <button
                                        className="btn btn-sm btn-secondary"
                                        onClick={() => setEditingId(null)}
                                    >
                                        Cancel
                                    </button>
                                </>
                            ) : (
                                <button
                                    className="btn btn-sm btn-info mt-2 ml-2"
                                    onClick={() => {
                                        setEditingId(i._id);
                                        setEditingContent(i.content);
                                    }}
                                >
                                    Edit
                                </button>
                            )}
                        </li>
                    ))}
                </ul>
                <div className="flex justify-center space-x-4 mt-4">
                    {sortedItems.length > visibleCount && (
                        <button
                            className="btn bg-green-500 hover:bg-green-600 text-white px-6 py-2"
                            onClick={() => setVisibleCount(sortedItems.length)}
                        >
                            Show more announcements
                        </button>
                    )}
                    {visibleCount > 10 && (
                        <button
                            className="btn bg-green-500 hover:bg-green-600 text-white px-6 py-2"
                            onClick={() => setVisibleCount(10)}
                        >
                            Show less announcements
                        </button>
                    )}
                </div>
            </div>
        </>
    );
}