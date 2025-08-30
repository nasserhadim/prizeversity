import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * usePaginatedList(items, options)
 * - items: array to paginate
 * - options.perPage: number (default 10)
 * - options.resetDeps: additional deps that should reset pagination when changed (array)
 */
export function usePaginatedList(items = [], options = {}) {
  const perPage = options.perPage ?? 10;
  const resetDeps = Array.isArray(options.resetDeps) ? options.resetDeps : [];

  const [page, setPage] = useState(1);
  const [displayCount, setDisplayCount] = useState(perPage);
  const sentinelRef = useRef(null);

  const visible = useMemo(() => (Array.isArray(items) ? items.slice() : []), [items]);
  const totalPages = Math.max(1, Math.ceil(visible.length / perPage));
  const displayed = useMemo(() => visible.slice(0, displayCount), [visible, displayCount]);

  // reset when items or provided reset deps change
  useEffect(() => {
    setDisplayCount(perPage);
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible.length, perPage, ...resetDeps]);

  // sentinel intersection observer to lazy-load next page
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && displayCount < visible.length) {
        setDisplayCount(prev => {
          const next = Math.min(prev + perPage, visible.length);
          setPage(Math.min(Math.ceil(next / perPage), totalPages));
          return next;
        });
      }
    }, { rootMargin: '200px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [displayCount, visible.length, perPage, totalPages]);

  return {
    displayed,
    visible,
    page,
    setPage,
    displayCount,
    setDisplayCount,
    sentinelRef,
    perPage,
    totalPages
  };
}

export default usePaginatedList;