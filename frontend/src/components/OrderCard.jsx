import React from 'react';
import toast from 'react-hot-toast';
import { Image as ImageIcon, Copy as CopyIcon, Package, ShoppingCart, Info } from 'lucide-react';
import { getEffectDescription, splitDescriptionEffect } from '../utils/itemHelpers';
import { resolveImageSrc } from '../utils/image';

export default function OrderCard({ order }) {
  const classroomLabel = (o) => {
    const c = o.items?.[0]?.bazaar?.classroom || o.classroom;
    if (c && typeof c === 'object' && c.name) {
      return `${c.name}${c.code ? ` (${c.code})` : ''}`;
    }
    if (o.metadata?.classroomName) {
      return o.metadata.classroomCode
        ? `${o.metadata.classroomName} (${o.metadata.classroomCode})`
        : o.metadata.classroomName;
    }
    return '—';
  };

  if (!order) return null;

  const shortId = (id) => {
    if (!id) return '';
    if (id.length <= 14) return id;
    return `${id.slice(0,6)}...${id.slice(-6)}`;
  };

  const copyToClipboard = async (text) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      toast.success('Order ID copied');
    } catch (err) {
      toast.error('Copy failed');
    }
  };

  return (
    <div className="card bg-base-100 shadow-md border border-base-300">
      <div className="card-body p-4 space-y-3">
        {/* Header with date and copy ID */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Icon based on order type */}
            {order.type === 'mystery_box' ? (
              <Package className="text-warning" size={20} />
            ) : (
              <ShoppingCart className="text-success" size={20} />
            )}
            <div>
              <p className="text-sm font-semibold">
                {order.type === 'mystery_box' ? 'Mystery Box Opened' : 'Order'}
              </p>
              <p className="text-xs opacity-60">
                {new Date(order.createdAt).toLocaleString()}
              </p>
            </div>
          </div>
          
          {/* Copy button inline */}
          <button
            className="inline-flex items-center gap-2 text-xs text-base-content/50 hover:text-base-content transition-colors"
            onClick={() => copyToClipboard(order._id)}
            title="Copy order ID"
          >
            {shortId(order._id)}
            <CopyIcon size={14} />
          </button>
        </div>

        {/* Mystery Box Description */}
        {order.type === 'mystery_box' && order.description && (
          <div className="alert alert-info py-2">
            <Info size={16} />
            <span className="text-sm">{order.description}</span>
          </div>
        )}

        {/* Total and Classroom */}
        <div className="flex items-center justify-between text-sm">
          {/* LEFT: Classroom badge */}
          <div>
            {classroomLabel(order) !== '—' && (
              <span className="badge badge-sm">{classroomLabel(order)}</span>
            )}
          </div>
          
          {/* RIGHT: Total/Price */}
          <div className="font-bold text-lg">
            {order.type === 'mystery_box' ? (
              <span className="text-success">Reward ✨</span>
            ) : (
              <span>{order.total} ₿</span>
            )}
          </div>
        </div>

        {/* Items list */}
        <div className="space-y-2">
          {(() => {
            // CHANGED: Use metadata.itemDetails if items are missing (deleted after use)
            let displayItems = order.items || [];
            
            // If items array is empty or items were deleted, use metadata
            if (displayItems.length === 0 && order.metadata?.itemDetails) {
              displayItems = order.metadata.itemDetails;
            } else if (displayItems.some(item => !item || !item.name)) {
              // If some items are missing/deleted, fallback to metadata
              displayItems = order.metadata?.itemDetails || displayItems.filter(i => i && i.name);
            }

            // NEW: group identical purchased items (only for normal purchase orders)
            const groupItems = (items) => {
              const map = new Map();
              for (const it of items) {
                if (!it) continue;
                // Build a stable grouping key. You can adjust fields if needed.
                const key = [
                  it.name,
                  it.price,
                  it.category,
                  it.primaryEffect,
                  it.primaryEffectValue,
                  // avoid huge descriptions in key; assume identical items share same main description
                  (it.description || '').split('\n\nEffect:')[0].trim()
                ].join('||');
                const entry = map.get(key);
                if (entry) {
                  entry.count += 1;
                  entry.items.push(it);
                } else {
                  map.set(key, { ref: it, count: 1, items: [it] });
                }
              }
              return Array.from(map.values());
            };

            const grouped = order.type === 'purchase'
              ? groupItems(displayItems)
              : displayItems.map(it => ({ ref: it, count: 1, items: [it] }));

            return grouped.map((g, idx) => {
              const item = g.ref;
              if (!item) return null;
              const priceLabel = Number.isFinite(Number(item.price)) ? `(${Number(item.price)} ₿)` : '';
              const { main, effect } = splitDescriptionEffect(item.description || '');
              return (
                <div key={item._id || idx} className="flex items-start gap-3 bg-base-200 p-3 rounded-lg">
                  {/* Rarity badge for mystery box rewards */}
                  {order.type === 'mystery_box' && order.metadata?.wonItemRarity && (
                    <span className={`badge badge-sm ${
                      order.metadata.wonItemRarity === 'legendary' ? 'badge-warning' :
                      order.metadata.wonItemRarity === 'epic'      ? 'badge-secondary' :
                      order.metadata.wonItemRarity === 'rare'      ? 'badge-primary' :
                      order.metadata.wonItemRarity === 'uncommon'  ? 'badge-accent'  :
                      'badge-neutral' // common or unknown
                    }`}>
                      {order.metadata.wonItemRarity}
                    </span>
                  )}

                  <div className="w-12 h-12 bg-base-300 rounded flex items-center justify-center overflow-hidden flex-shrink-0">
                    <img
                      src={resolveImageSrc(item.image)}
                      alt={item.name}
                      className="object-cover w-full h-full"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = '/images/item-placeholder.svg';
                      }}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate wrap-any">
                      {item.name}{g.count > 1 && <span className="ml-1 text-xs badge badge-outline">x{g.count}</span>} {priceLabel}
                    </div>
                    {main && <div className="text-xs text-base-content/70 whitespace-pre-wrap wrap-any">{main}</div>}
                    {effect && (
                      <div className="text-xs text-base-content/60 mt-1">
                        <strong>Effect:</strong> {effect}
                      </div>
                    )}
                    {!effect && getEffectDescription(item) && (
                      <div className="text-xs text-base-content/60 mt-1">
                        <strong>Effect:</strong> {getEffectDescription(item)}
                      </div>
                    )}
                  </div>
                </div>
              );
            });
          })()}
        </div>
      </div>
    </div>
  );
}