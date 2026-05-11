import { useState, useEffect, useRef, useCallback } from 'react';
import { X } from 'lucide-react';
import { resolveImageSrc } from '../utils/image';

/**
 * Parse a GIF binary from a URL and sum all frame delays.
 * Searches for Graphic Control Extension blocks (0x21 0xF9 0x04).
 * Returns total duration in ms, or null on failure/CORS block.
 */
async function getGifDuration(url) {
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    let totalDelay = 0;
    // GCE signature bytes: 0x21 (Extension Introducer), 0xF9 (Graphic Control Label), 0x04 (block size)
    for (let i = 0; i < bytes.length - 5; i++) {
      if (bytes[i] === 0x21 && bytes[i + 1] === 0xF9 && bytes[i + 2] === 0x04) {
        // delay is stored as little-endian uint16 at offsets +4, +5 in units of 1/100 second
        const delayHundredths = bytes[i + 4] | (bytes[i + 5] << 8);
        // If delay is 0 browsers typically use 100ms (10 hundredths)
        totalDelay += (delayHundredths || 10) * 10;
        i += 7; // skip past this GCE (8 bytes total, but loop will add 1)
      }
    }
    return totalDelay > 0 ? totalDelay : null;
  } catch {
    return null;
  }
}

const CATEGORY_BAR_COLOR = {
  Attack: 'bg-error',
  Defend: 'bg-info',
  Utility: 'bg-purple-500',
  Passive: 'bg-success',
  MysteryBox: 'bg-warning',
};

const FALLBACK_DURATION = 4000;

/**
 * ActivationEffectModal
 *
 * Shows a GIF/image effect when a bazaar item is activated.
 * - Parses GIF binary to determine exact animation duration (sum of all frame delays)
 * - Falls back to 4 seconds for non-GIFs or CORS-blocked URLs
 * - Shows a depleting progress bar (category accent color)
 * - Auto-closes at the end of the duration
 * - Clicking the backdrop or X button closes early ("skip")
 *
 * Props:
 *   effectUrl   {string}   - URL/path of the image or GIF
 *   itemName    {string}   - Item name shown in the header
 *   category    {string}   - Item category (controls progress bar color)
 *   isOpen      {boolean}  - Whether the modal is visible
 *   onClose     {function} - Called when the modal should close
 */
const ActivationEffectModal = ({ effectUrl, itemName, category, isOpen, onClose }) => {
  const [duration, setDuration] = useState(FALLBACK_DURATION);
  const [elapsed, setElapsed] = useState(0);
  const [ready, setReady] = useState(false);
  const timerRef = useRef(null);
  const startRef = useRef(null);

  const doClose = useCallback(() => {
    clearInterval(timerRef.current);
    onClose?.();
  }, [onClose]);

  // When modal opens, determine the display duration
  useEffect(() => {
    if (!isOpen || !effectUrl) return;
    setElapsed(0);
    setReady(false);

    let cancelled = false;
    (async () => {
      const resolvedUrl = resolveImageSrc(effectUrl);
      const isGif =
        /\.gif(\?.*)?$/i.test(resolvedUrl) || /\.gif(\?.*)?$/i.test(effectUrl);

      let dur = FALLBACK_DURATION;
      if (isGif) {
        const parsed = await getGifDuration(resolvedUrl);
        if (parsed && parsed > 0) dur = parsed;
      }

      if (cancelled) return;
      setDuration(dur);
      setElapsed(0);
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, effectUrl]);

  // Countdown timer
  useEffect(() => {
    if (!isOpen || !ready) return;
    startRef.current = Date.now();
    clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      const el = Date.now() - startRef.current;
      setElapsed(el);
      if (el >= duration) {
        clearInterval(timerRef.current);
        onClose?.();
      }
    }, 50);

    return () => clearInterval(timerRef.current);
  }, [isOpen, ready, duration, onClose]);

  if (!isOpen || !effectUrl) return null;

  const progress = ready ? Math.min(1, elapsed / duration) : 0;
  // Depletes from 100% → 0%
  const barWidthPct = Math.round((1 - progress) * 100);
  const barColor = CATEGORY_BAR_COLOR[category] || 'bg-primary';
  const resolvedSrc = resolveImageSrc(effectUrl);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.78)' }}
      onClick={doClose}
    >
      <div
        className="relative bg-base-100 rounded-2xl shadow-2xl max-w-sm w-full mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-base-200">
          <span className="font-semibold text-base-content truncate pr-2">
            {itemName}
          </span>
          <button
            type="button"
            className="btn btn-sm btn-ghost btn-circle flex-shrink-0"
            onClick={doClose}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Effect image/GIF */}
        <div className="flex items-center justify-center p-6 bg-base-200/30 min-h-[200px]">
          <img
            src={resolvedSrc}
            alt={`${itemName} activation effect`}
            className="max-w-full max-h-72 object-contain rounded-lg"
            onError={() => doClose()}
          />
        </div>

        {/* Depleting progress bar */}
        <div className="h-1.5 bg-base-200 w-full">
          <div
            className={`h-full ${barColor}`}
            style={{ width: `${barWidthPct}%`, transition: 'none' }}
          />
        </div>
      </div>
    </div>
  );
};

export default ActivationEffectModal;
