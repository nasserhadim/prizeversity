import { useEffect, useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import axios from 'axios';
import Footer from '../components/Footer';

export default function OrderHistory() {
    const { user } = useContext(AuthContext);
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Fetching all the orders users have made in the bazaar
    useEffect(() => {
        axios
            .get(`/api/bazaar/orders/user/${user._id}`)
            .then(res => {
                setOrders(res.data);
                setLoading(false);
            })
            .catch(err => {
                setError(err.response?.data?.error || 'Failed to load orders');
                setLoading(false);
            });
    }, [user._id]);

    if (loading) return <p>Loading your purchase history…</p>;
    if (error) return <p className="text-red-500">{error}</p>;

    return (
        <div className="flex flex-col min-h-screen">
            <main className="flex-grow p-4 container mx-auto">
                <h1 className="text-2xl mb-4">Your Order History</h1>
                {orders.length === 0
                    ? <p>No purchases yet.</p>
                    : orders.map(o => (
                        <div key={o._id} className="border rounded p-3 mb-3 bg-base-100 shadow">
                            <p><strong>Date:</strong> {new Date(o.createdAt).toLocaleString()}</p>
                            <p><strong>Total:</strong> {o.total} bits</p>
                            {o.items.length > 0 && o.items[0].bazaar?.classroom && (
                                <p><strong>Classroom:</strong> {o.items[0].bazaar.classroom.name} ({o.items[0].bazaar.classroom.code})</p>
                            )}
                            <ul className="list-disc list-inside mt-2">
                                {o.items.map(i => <li key={i._id}>{i.name}</li>)}
                            </ul>
                        </div>
                    ))
                }
            </main>
            <Footer />
        </div>
    );
}