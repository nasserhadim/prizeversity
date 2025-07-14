import React, { useContext } from 'react';
import { ThemeContext } from '../context/ThemeContext';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import axios from 'axios';

const Settings = () => {
    const { theme, toggleTheme } = useContext(ThemeContext);
    const { user, logout } = useContext(AuthContext);
    const navigate = useNavigate();

    const handleDeleteAccount = async () => {

        if (user.role === 'teacher') {
            try {
                // fetch all classrooms (backend should filter to this teacher)
                const { data: classrooms } = await axios.get('/api/classroom', {
                    withCredentials: true
                });
                const stillHas = classrooms.some(c => c.teacher === user._id);
                if (stillHas) {
                    toast.error('You cannot delete your account. Please delete your classroom(s) first.');
                    return;
                }
            } catch (err) {
                console.error('Error checking classrooms', err);
                toast.error('Unable to verify classrooms. Try again later.');
                return;
            }
        }
        const confirmed = window.confirm('Are you sure you want to permanently delete your account?');
        if (!confirmed) return;

        try {
            await axios.delete(`/api/users/${user._id}`);
            toast.success('Account deleted successfully');
            logout();
            navigate('/');
        } catch (err) {
            console.error('Delete failed', err);
            toast.error('Failed to delete account');
        }
    };

    return (
        <div className="max-w-3xl mx-auto p-6 mt-10 space-y-8">
            <h1 className="text-3xl font-bold text-center">Settings</h1>

            <section className="bg-base-100 p-6 rounded-xl shadow space-y-4">
                <h2 className="text-xl font-semibold">Appearance</h2>
                <div className="flex items-center justify-between">
                    <span>Theme: {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</span>
                    <button onClick={toggleTheme} className="btn btn-outline">
                        Toggle Theme
                    </button>
                </div>
            </section>

            <section className="bg-base-100 p-6 rounded-xl shadow space-y-4">
                <h2 className="text-xl font-semibold">Notifications</h2>
                <p className="text-gray-500">Coming soon: customize how you receive updates.</p>
            </section>

            <section className="bg-base-100 p-6 rounded-xl shadow space-y-4">
                <h2 className="text-xl font-semibold">Security</h2>
                <p className="text-gray-500">
                    You signed in using a third-party provider. To change your password, please visit your account provider directly:
                </p>
                <ul className="list-disc pl-5 text-blue-500">
                    <li><a href="https://myaccount.google.com/security" target="_blank" rel="noopener noreferrer">Google Account</a></li>
                    <li><a href="https://account.microsoft.com/security" target="_blank" rel="noopener noreferrer">Microsoft Account</a></li>
                </ul>
            </section>

            <section className="bg-base-100 p-6 rounded-xl shadow space-y-4">
                <h2 className="text-xl font-semibold text-red-600">Danger Zone</h2>
                <button onClick={handleDeleteAccount} className="btn btn-error">
                    Delete Account
                </button>
            </section>
        </div>
    );
};

export default Settings;