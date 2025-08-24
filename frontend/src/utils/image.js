export const ITEM_PLACEHOLDER = '/images/item-placeholder.svg';
export const BANNER_PLACEHOLDER = '/images/bazaar-placeholder.svg';
import { API_BASE } from '../config/api';

/**
 * Resolve an image source to a safe URL the frontend can use.
 * - Allows http(s) and data URIs
 * - Maps backend "/uploads/..." to `${API_BASE}/uploads/...`
 * - Returns frontend absolute paths (starting with '/')
 * - Falls back to item placeholder for anything else
 */
export function resolveImageSrc(src) {
  const placeholder = ITEM_PLACEHOLDER;
  if (!src || typeof src !== 'string') return placeholder;
  const s = src.trim();
  if (!s) return placeholder;
  if (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('data:')) return s;
  if (s.startsWith('/uploads/')) return `${API_BASE}${s}`;
  if (s.startsWith('/')) return s;
  return placeholder;
}

/**
 * Resolve banner / bazaar image source. Falls back to banner placeholder.
 */
export function resolveBannerSrc(src) {
  const placeholder = BANNER_PLACEHOLDER;
  if (!src || typeof src !== 'string') return placeholder;
  const s = src.trim();
  if (!s) return placeholder;
  if (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('data:')) return s;
  if (s.startsWith('/uploads/')) return `${API_BASE}${s}`;
  if (s.startsWith('/')) return s;
  return placeholder;
}