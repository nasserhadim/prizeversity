import { useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';
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
    <div className="card bg-base-100 shadow-md border border-base-200 hover:shadow-lg transition duration-200 rounded-2xl overflow-hidden">
      {/* Image */}
      <figure className="relative h-40 sm:h-48 md:h-52 bg-base-200 flex items-center justify-center">
        {item.image ? (
          <img
            src={item.image}
            alt={item.name}
            className="object-cover w-full h-full"
            loading="lazy"
            srcSet={`${item.image}?w=400 1x, ${item.image}?w=800 2x`}
            sizes="(max-width: 768px) 100vw, 50vw"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-gray-400">
            <ImageIcon className="w-12 h-12" />
            <span className="text-sm mt-2">No image</span>
          </div>
        )}
      </figure>

      {/* Content - unchanged from original */}
      <div className="card-body space-y-2">
        <h3 className="card-title text-lg md:text-xl font-semibold">
          {item.name}
        </h3>
        <p className="text-gray-600 text-sm line-clamp-2">{item.description}</p>
        <p className="text-black font-bold text-base">${item.price}</p>

        {role === 'student' && (
          <button
            onClick={() => addToCart(item)}
            className="btn btn-success btn-sm w-full mt-2"
          >
            Add to Cart
          </button>
        )}
      </div>
    </div>
  );
};

export default ItemCard;
