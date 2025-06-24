import { useState } from 'react';
import toast from 'react-hot-toast';
// import axios from 'axios'
import apiBazaar from '../API/apiBazaar.js'
import { ShoppingCart } from 'lucide-react';
import { useCart } from '../context/CartContext';

const ItemCard = ({ item, role, classroomId }) => {
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const { addToCart } = useCart();

  const handleBuy = async () => {
    if (quantity < 1) return toast.error('Quantity must be at least 1');
    setLoading(true);
    try {
      await apiBazaar.post(
        `classroom/${classroomId}/bazaar/${item.bazaar}/items/${item._id}/buy`,
        { quantity: Number(quantity) }
      );
      toast.success('Item purchased!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Purchase failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card bg-base-100 shadow border border-gray-200">
      <figure>
        <img
          src={item.image || '/placeholder.jpg'}
          alt={item.name}
          className="h-40 object-cover w-full"
        />
      </figure>
      <div className="card-body">
        <h3 className="card-title">{item.name}</h3>
        <p className="text-sm">{item.description}</p>
        <p className="font-semibold text-primary">${item.price}</p>

        {role === 'student' && (
          <button
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 mt-4 w-full"
            onClick={() => addToCart(item)}
          >
            Add to Cart
          </button>
        )}
      </div>
    </div>
  );
};

export default ItemCard;
