import React, { useState, useEffect, useRef, useCallback, useContext } from 'react';
import axios from 'axios';
import { API_BASE } from '../config/api';
import Footer from '../components/Footer';
import ReviewCard from '../components/ReviewCard';
import ReviewStats from '../components/ReviewStats';
import { ExternalLink, Star, Loader2, AlertCircle } from 'lucide-react';
import { ThemeContext } from '../context/ThemeContext';
import '../styles/Feedback.css';

// ---------------------------------------------------------------------------
// Widget embed – loads the provider's script once & initialises the widget div
// ---------------------------------------------------------------------------
const WIDGET_SCRIPTS = {
  trustpilot: '//widget.trustpilot.com/bootstrap/v5/tp.widget.bootstrap.min.js',
};

// Default template IDs per provider (review-list style)
const DEFAULT_TEMPLATES = {
  trustpilot: '539ad0ffdec7e10e686debd7', // Carousel / review collector
};

function ReviewWidget({ provider, widget, isDark }) {
  const widgetRef = useRef(null);
  const tpTheme = isDark ? 'dark' : 'light';

  useEffect(() => {
    const scriptSrc = WIDGET_SCRIPTS[provider];
    if (!scriptSrc) return;

    const initWidget = () => {
      if (window.Trustpilot && widgetRef.current) {
        window.Trustpilot.loadFromElement(widgetRef.current, true);
      }
    };

    // Only append the script once
    const existing = document.querySelector(`script[src="${scriptSrc}"]`);
    if (!existing) {
      const s = document.createElement('script');
      s.src = scriptSrc;
      s.async = true;
      document.head.appendChild(s);
      s.onload = initWidget;
    } else {
      // Script already loaded; (re-)init to pick up theme change
      initWidget();
    }
  }, [provider, widget, tpTheme]);

  if (provider === 'trustpilot') {
    const templateId = widget.templateId || DEFAULT_TEMPLATES.trustpilot;
    const profileUrl = widget.businessUrl
      ? `https://www.trustpilot.com/review/${widget.businessUrl}`
      : '#';

    return (
      <div
        ref={widgetRef}
        key={tpTheme}
        className="trustpilot-widget"
        data-locale="en-US"
        data-template-id={templateId}
        data-businessunit-id={widget.businessId}
        data-style-height="500px"
        data-style-width="100%"
        data-theme={tpTheme}
        data-stars="1,2,3,4,5"
        data-review-languages="en"
        {...(widget.token ? { 'data-token': widget.token } : {})}
      >
        <a href={profileUrl} target="_blank" rel="noopener noreferrer">
          See our reviews on Trustpilot
        </a>
      </div>
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
const ReviewsPage = () => {
  const { theme } = useContext(ThemeContext);
  const isDark = theme === 'dark';
  const [config, setConfig] = useState(null);
  const [summary, setSummary] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const perPage = 10;

  const isWidgetMode = config?.mode === 'widget';
  const isApiMode = config?.mode === 'api';

  // Fetch provider config once
  useEffect(() => {
    axios
      .get(`${API_BASE}/api/reviews/config`)
      .then((res) => setConfig(res.data))
      .catch(() => setConfig({ enabled: false }));
  }, []);

  // Fetch summary once (api mode only)
  useEffect(() => {
    if (!config?.enabled || !isApiMode) return;
    axios
      .get(`${API_BASE}/api/reviews/summary`)
      .then((res) => setSummary(res.data))
      .catch(() => {});
  }, [config, isApiMode]);

  // Fetch reviews – api mode only
  useEffect(() => {
    if (!config?.enabled || !isApiMode) return;
    setLoading(true);
    setError(null);
    axios
      .get(`${API_BASE}/api/reviews`, { params: { page, perPage } })
      .then((res) => {
        const data = res.data;
        if (page === 1) {
          setReviews(data.reviews || []);
        } else {
          setReviews((prev) => [...prev, ...(data.reviews || [])]);
        }
        setTotalPages(data.pagination?.totalPages || 1);
      })
      .catch(() => setError('Unable to load reviews right now. Please try again later.'))
      .finally(() => setLoading(false));
  }, [config, page, isApiMode]);

  // Stop loading spinner for widget mode once config arrives
  useEffect(() => {
    if (config?.enabled && isWidgetMode) setLoading(false);
  }, [config, isWidgetMode]);

  // Provider not configured — show a friendly fallback
  if (config && !config.enabled) {
    return (
      <div className="min-h-screen bg-base-200 flex flex-col">
        <main className="flex-grow p-4 pt-24 flex items-center justify-center">
          <div className="card w-full max-w-xl mx-auto shadow-xl bg-base-100">
            <div className="card-body items-center text-center">
              <AlertCircle className="w-12 h-12 text-warning mb-2" />
              <h2 className="card-title">Reviews Coming Soon</h2>
              <p className="text-base-content/70">
                We're setting up verified third-party reviews so you can see honest,
                independent feedback about Prizeversity. Check back soon!
              </p>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200 flex flex-col">
      <main className="flex-grow p-4 pt-24">
        <div className="card w-full max-w-3xl mx-auto shadow-xl bg-base-100">
          <div className="card-body">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
              <h2 className="card-title text-primary flex items-center gap-2">
                <Star className="w-5 h-5" /> Reviews
              </h2>
              {config?.submitUrl && (
                <a
                  href={config.submitUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary btn-sm gap-1"
                >
                  Write a Review <ExternalLink size={14} />
                </a>
              )}
            </div>

            {config?.provider && (
              <p className="text-xs text-base-content/50 mb-4">
                Reviews sourced from{' '}
                <span className="capitalize font-medium">{config.provider}</span>
              </p>
            )}

            {/* ---- Widget mode ---- */}
            {isWidgetMode && config?.widget && (
              <ReviewWidget provider={config.provider} widget={config.widget} isDark={isDark} />
            )}

            {/* ---- API mode ---- */}
            {isApiMode && (
              <>
                {/* Summary stats */}
                {summary && <ReviewStats summary={summary} />}

                {/* Error state */}
                {error && (
                  <div className="alert alert-error mb-4">
                    <AlertCircle size={18} />
                    <span>{error}</span>
                  </div>
                )}

                {/* Review list */}
                {reviews.map((r) => (
                  <ReviewCard key={r.id} review={r} />
                ))}

                {/* Loading */}
                {loading && (
                  <div className="flex justify-center py-6">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                )}

                {/* Load more */}
                {!loading && page < totalPages && (
                  <div className="text-center mt-4">
                    <button className="btn btn-outline btn-sm" onClick={() => setPage((p) => p + 1)}>
                      Load more reviews
                    </button>
                  </div>
                )}

                {/* Empty state */}
                {!loading && !error && reviews.length === 0 && (
                  <div className="text-center py-8 text-base-content/60">
                    <p>No reviews yet.</p>
                    {config?.submitUrl && (
                      <a
                        href={config.submitUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-primary btn-sm mt-3 gap-1"
                      >
                        Be the first to review <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ReviewsPage;
