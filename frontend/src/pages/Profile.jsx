import { useEffect, useState, useContext } from 'react';
import { useParams } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import axios from 'axios';

const Profile = () => {
    const { user, updateUser } = useContext(AuthContext);
    const { id: profileId } = useParams();
    const [profile, setProfile] = useState(null);
    const [editMode, setEditMode] = useState(false);
    const [form, setForm] = useState({ firstName: '', lastName: '', avatar: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [orders, setOrders] = useState([]);
    const [loadingOrders, setLoadingOrders] = useState(true);
    const [ordersError, setOrdersError] = useState('');
    const [stats, setStats] = useState({});

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const res = await axios.get(`/api/profile/student/${profileId}`, {
                    withCredentials: true,
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem('token')}`,
                    }
                });

                setProfile(res.data);
                setForm({
                    firstName: res.data.firstName || '',
                    lastName: res.data.lastName || '',
                    avatar: res.data.avatar || ''
                });
            } catch (err) {
                console.error('Profile fetch error:', err);
                setError(err.response?.data?.error || 'Failed to load profile');
            } finally {
                setLoading(false);
            }
        };

        if (profileId) fetchProfile();
    }, [profileId]);

    // Added new useEffect to fetch the stats into a table.
    useEffect(() => {
        if (user.role === 'teacher' && profile?.role === 'student') {
            axios
                .get(`/api/bazaar/orders/user/${profileId}`, {
                    withCredentials: true,
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                })
                .then(res => {
                    setOrders(res.data);
                    setLoadingOrders(false);
                })
                .catch(err => {
                    setOrdersError(err.response?.data?.error || 'Failed to load orders');
                    setLoadingOrders(false);
                });
        }
    }, [profile, user.role, profileId]);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await axios.get(`/api/profile/student/${profileId}/stats`, {
                    withCredentials: true,
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem('token')}`,
                    },
                });
                setStats(res.data);
            } catch (err) {
                console.error('Stats fetch error:', err);
            }
        };
        if (profileId) fetchStats();
    }, [profileId]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
        if (error) setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            if (!form.firstName.trim()) {
                throw new Error('First name is required');
            }

            const res = await axios.put(`/api/profile/student/${profileId}`, form, {
                withCredentials: true,
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('token')}`,
                }
            });

            setProfile(res.data);
            updateUser(res.data);
            setEditMode(false);
        } catch (err) {
            console.error('Profile update error:', err);
            setError(err.response?.data?.error || err.message || 'Failed to update profile.');
        } finally {
            setSubmitting(false);
        }
    };

    const canEdit = user?._id === profileId;

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-base-200">
                <span className="loading loading-ring loading-lg"></span>
            </div>
        );
    }

    if (error && !editMode) {
        return (
            <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded shadow">
                <div className="alert alert-error">
                    <span>{error}</span>
                    <button onClick={() => window.location.reload()} className="btn btn-sm ml-4">Retry</button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-md mx-auto p-6 mt-10 bg-white rounded-xl shadow space-y-6">
            <h2 className="text-2xl font-bold text-center">
                {canEdit ? 'Your Profile' : 'Student Profile'}
            </h2>

            {canEdit && editMode ? (
                <form onSubmit={handleSubmit} className="space-y-4">
                    {error && <div className="alert alert-error text-sm">{error}</div>}

                    <div>
                        <label className="label-text">First Name *</label>
                        <input
                            type="text"
                            name="firstName"
                            value={form.firstName}
                            onChange={handleChange}
                            className="input input-bordered w-full"
                            required
                        />
                    </div>

                    <div>
                        <label className="label-text">Last Name</label>
                        <input
                            type="text"
                            name="lastName"
                            value={form.lastName}
                            onChange={handleChange}
                            className="input input-bordered w-full"
                        />
                    </div>

                    <div>
                        <label className="label-text">Avatar URL</label>
                        <input
                            type="url"
                            name="avatar"
                            value={form.avatar}
                            onChange={handleChange}
                            className="input input-bordered w-full"
                            placeholder="https://example.com/avatar.jpg"
                        />
                        {form.avatar && (
                            <img
                                src={form.avatar}
                                alt="Avatar preview"
                                className="w-16 h-16 mt-2 rounded-full object-cover"
                                onError={(e) => e.target.src = 'https://via.placeholder.com/150'}
                            />
                        )}
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={() => setEditMode(false)}
                            className="btn btn-ghost"
                            disabled={submitting}
                        >
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={submitting}>
                            {submitting ? <span className="loading loading-spinner"></span> : 'Save Changes'}
                        </button>
                    </div>
                </form>
            ) : (
                <div className="space-y-4">
                    <div className="flex justify-center">
                        {profile?.avatar && profile.avatar.startsWith('http') ? (
                            <img
                                src={profile.avatar}
                                alt="Profile"
                                className="w-24 h-24 rounded-full object-cover border-4 border-success"
                                onError={(e) => e.target.src = 'https://via.placeholder.com/150'}
                            />
                        ) : (
                            <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center text-4xl font-bold text-gray-500">
                                {`${(profile?.firstName?.[0] || profile?.email?.[0] || 'U')}${(profile?.lastName?.[0] || '')}`.toUpperCase()}
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <InfoRow label="Name" value={[profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || 'Not set'} />
                        <InfoRow label="Email" value={profile?.email || 'N/A'} />
                        <InfoRow label="User ID" value={profile?.shortId || '—'} />
                        {profile?.role && (
                            <InfoRow label="Role" value={profile.role.charAt(0).toUpperCase() + profile.role.slice(1)} />
                        )}
                    </div>

                    {user.role === 'teacher' && profile.role === 'student' && (
                        <div className="mt-6">
                            <h2 className="text-xl mb-2">Purchase History</h2>
                            {loadingOrders ? (
                                <p>Loading…</p>
                            ) : ordersError ? (
                                <p className="text-red-500">{ordersError}</p>
                            ) : orders.length === 0 ? (
                                <p>No purchases by this student.</p>
                            ) : (
                                <ul className="list-disc list-inside">
                                    {orders.map(o => (
                                        <li key={o._id}>
                                            {new Date(o.createdAt).toLocaleDateString()}: {o.items.map(i => i.name).join(', ')} ({o.total} bits)
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}
                    {canEdit && (
                        <button onClick={() => setEditMode(true)} className="btn btn-success w-full mt-4">
                            Edit Profile
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

const InfoRow = ({ label, value }) => (
    <div className="flex justify-between border-b pb-2">
        <span className="font-medium text-gray-600">{label}:</span>
        <span className="text-gray-900">{value}</span>
    </div>
);
export default Profile;
