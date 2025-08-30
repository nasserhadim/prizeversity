import React from 'react';
import toast from 'react-hot-toast';
import { Image as ImageIcon, Copy as CopyIcon } from 'lucide-react';
import { getEffectDescription, splitDescriptionEffect } from '../utils/itemHelpers';
import { resolveImageSrc } from '../utils/image';

export default function OrderCard({ order }) {
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

  const classroomLabel = (o) => {
    const c = o.items?.[0]?.bazaar?.classroom;
    if (!c) return '—';
    return `${c.name} (${c.code || ''})`.trim();
  };

  return (
    <div className="border rounded p-4 mb-4 bg-base-100 shadow">
      <div className="flex items-start justify-between">
        <div>
          <p><strong>Date:</strong> {new Date(order.createdAt).toLocaleString()}</p>
          <p><strong>Total:</strong> {Number.isFinite(Number(order.total)) ? `${order.total} ₿` : '—'}</p>
          <p><strong>Classroom:</strong> {classroomLabel(order)}</p>
        </div>

        <div className="text-right">
          <div className="mt-2 flex gap-2 justify-end items-center">
            <span className="text-xs font-mono" title={order._id} aria-label="Full order id">
              {shortId(order._id)}
            </span>

            <button
              className="btn btn-xs btn-ghost p-1"
              onClick={() => copyToClipboard(order._id)}
              title="Copy order ID"
              aria-label="Copy order ID"
            >
              <CopyIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {order.items && order.items.length > 0 && (
        <div className="mt-2 space-y-3">
          {order.items.map((i) => {
            const priceLabel = Number.isFinite(Number(i.price)) ? `(${Number(i.price)} ₿)` : '';
            const { main, effect } = splitDescriptionEffect(i.description || '');
            return (
              <div key={i._id || i.id} className="flex items-start gap-3 border-t pt-3">
                <div className="w-12 h-12 bg-base-200 rounded overflow-hidden flex items-center justify-center flex-shrink-0">
                  <img
                    src={resolveImageSrc(i.image)}
                    alt={i.name}
                    className="object-cover w-full h-full"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = '/images/item-placeholder.svg';
                    }}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="font-medium truncate">{i.name} {priceLabel}</div>
                  </div>

                  {main && (
                    <div className="text-sm text-base-content/70 whitespace-pre-wrap mt-1">{main}</div>
                  )}

                  {effect && (
                    <div className="text-sm text-base-content/60 mt-1">
                      <strong>Effect:</strong> {effect}
                    </div>
                  )}

                  {!effect && getEffectDescription(i) && (
                    <div className="text-sm text-base-content/60 mt-1">
                      <strong>Effect:</strong> {getEffectDescription(i)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}