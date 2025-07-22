import { useEffect, useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import axios from 'axios';

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
        <div className="p-4">
            <h1 className="text-2xl mb-4">Your Order History</h1>
            {orders.length === 0
                ? <p>No purchases yet.</p>
                : orders.map(o => (
                    <div key={o._id} className="border rounded p-3 mb-3">
                        <p><strong>Date:</strong> {new Date(o.createdAt).toLocaleString()}</p>
                        <p><strong>Total:</strong> {o.total} bits</p>
                        <ul className="list-disc list-inside">
                            {o.items.map(i => <li key={i._id}>{i.name}</li>)}
                        </ul>
                    </div>
                ))
            }
        </div>
    );
}