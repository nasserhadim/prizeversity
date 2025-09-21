// prizeversity/frontend/src/pages/TeacherNewsfeed.jsx

import React, { useState, useEffect } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { useParams, Link } from 'react-router-dom';
import { getNews, postNews, deleteNews, editNews } from '../API/apiNewsfeed';
import toast from 'react-hot-toast';
import ClassroomBanner from '../components/ClassroomBanner';
import { getClassroom } from '../API/apiClassroom';
import Footer from '../components/Footer';


export default function TeacherNewsfeed() {
    const { id: classId } = useParams();
    const [items, setItems] = useState([]);
    const sortedItems = [...items].sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
    const [draft, setDraft] = useState('');
    const [attachments, setAttachments] = useState([]);
    const [classroomName, setClassroomName] = useState('');
    const [classroomCode, setClassroomCode] = useState('');
    // banner color & image
    const [bgColor, setBgColor] = useState('');
    const [backgroundImage, setBackgroundImage] = useState('');
    const [visibleCount, setVisibleCount] = useState(10);
    const [editingId, setEditingId] = useState(null);
    const [editingContent, setEditingContent] = useState('');
    const [editingAttachments, setEditingAttachments] = useState([]);
    const [newAttachments, setNewAttachments] = useState([]);

    useEffect(() => {
        async function fetchData() {
            // load announcements
            const newsRes = await getNews(classId);
            setItems(newsRes.data);
            // load classroom info
            const classRes = await getClassroom(classId);
            setClassroomName(classRes.data.name);
            setClassroomCode(classRes.data.code);
            setBgColor(classRes.data.color);
            setBackgroundImage(classRes.data.backgroundImage);
        }
        fetchData();
    }, [classId]);

    // Handle posting a new announcement
    const handlePost = async () => {
        // Prevent empty announcement
        const plainText = draft.replace(/<(.|\n)*?>/g, '').trim();
        if (!plainText) {
            toast.error('Please enter an announcement before posting');
            return;
        }
        const formData = new FormData();
        formData.append('content', draft);
        attachments.forEach(file => formData.append('attachments', file));

        try {
            const res = await postNews(classId, formData);
            setItems([res.data, ...items]);
            setDraft('');
            setAttachments([]);
            toast.success('Announcement posted');
        } catch (err) {
            console.error('Post failed', err);
            const data = err.response?.data;
            let msg = 'Failed to post announcement';
            // backend may return JSON { error } or { message }, otherwise HTML stack traces start with '<'
            if (data) {
              if (typeof data === 'string' && data.trim().startsWith('<')) {
                msg = 'Server error while uploading (field too large or server problem). Try reducing content or attachments.';
              } else if (data.error) {
                msg = data.error;
              } else if (data.message) {
                msg = data.message;
              } else if (typeof data === 'string') {
                msg = data;
              }
            }
            toast.error(msg);
        }
    };

    // Confirm and handle deletion of an announcement
    const handleDelete = (itemId) => {
        toast((t) => (
            <div className="flex flex-col">
                <span>Are you sure you want to delete this announcement?</span>
                <div className="mt-2">
                    <button
                        className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded mr-2"
                        onClick={async () => {
                            try {
                                await deleteNews(classId, itemId);
                                setItems(items.filter(item => item._id !== itemId));
                                toast.success('Announcement deleted');
                            } catch (err) {
                                console.error('Delete failed', err);
                                toast.error('Failed to delete');
                            }
                            toast.dismiss(t.id);
                        }}
                    >
                        Yes
                    </button>
                    <button
                        className="bg-gray-300 hover:bg-gray-400 text-black px-3 py-1 rounded"
                        onClick={() => toast.dismiss(t.id)}
                    >
                        No
                    </button>
                </div>
            </div>
        ));
    };

    // Handle updating an existing announcement's content
    const handleEdit = async (itemId) => {
        try {
            const formData = new FormData();
            formData.append('content', editingContent);

            // Append existing attachments that are being kept
            editingAttachments.forEach(att => {
                formData.append('existingAttachments', JSON.stringify(att));
            });

            // Append new files
            newAttachments.forEach(file => {
                formData.append('attachments', file);
            });

            const res = await editNews(classId, itemId, formData);
            setItems(items.map(i => (i._id === itemId ? res.data : i)));
            toast.success('Announcement updated');
            setEditingId(null); // Exit editing mode
        } catch (err) {
            if (err.response?.data?.message === 'No changes were made') {
                toast.error('No changes were made');
                setEditingId(null); // Exit editing mode
            } else {
                toast.error('Failed to update announcement');
            }
        }
    };

    return (
        <>
            <ClassroomBanner
                name={classroomName}
                code={classroomCode}
                bgColor={bgColor}
                backgroundImage={backgroundImage}
            />
            <div className="max-w-3xl mx-auto p-6 bg-green-50 rounded-lg">
                <p className="mb-4">
                    <Link to={`/classroom/${classId}`} className="link text-accent">
                        ← Back to Classroom
                    </Link>
                </p>
                <h2 className="text-center text-green-500 text-5xl font-bold mb-6">
                    Manage Announcements
                </h2>
                <div className="bg-white p-4 border border-green-200 rounded-lg mb-6">
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
                        className="file-input file-input-sm mb-4"
                    />
                    <button
                        className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-lg"
                        onClick={handlePost}
                    >
                        Post
                    </button>
                </div>

                <ul className="space-y-6">
                    {sortedItems.slice(0, visibleCount).map(i => (
                        <li key={i._id} className="bg-white p-4 border border-green-200 rounded-lg shadow-sm mx-auto">
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

                                    {/* Attachment management */}
                                    <div className="my-2 space-y-2">
                                        <h4 className="font-semibold">Attachments:</h4>
                                        {editingAttachments.map((att, index) => (
                                            <div key={index} className="flex items-center justify-between bg-gray-100 p-1 rounded">
                                                <span>{att.originalName}</span>
                                                <button 
                                                    className="btn btn-xs btn-error"
                                                    onClick={() => setEditingAttachments(prev => prev.filter((_, idx) => idx !== index))}>
                                                    Remove
                                                </button>
                                            </div>
                                        ))}
                                        <input 
                                            type="file" 
                                            multiple
                                            className="file-input file-input-bordered file-input-sm w-full"
                                            onChange={(e) => setNewAttachments(Array.from(e.target.files))}
                                        />
                                    </div>

                                    <button
                                        className="btn btn-sm btn-success mr-2"
                                        onClick={() => handleEdit(i._id)}
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
                                        setEditingAttachments(i.attachments || []);
                                        setNewAttachments([]);
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
            <Footer />
        </>
    );
}