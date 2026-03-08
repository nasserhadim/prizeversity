/**
 * Review provider configuration.
 *
 * Supported providers: 'trustpilot' (more can be added).
 *
 * Environment variables:
 *   REVIEW_PROVIDER          – provider key, e.g. 'trustpilot'
 *   REVIEW_MODE              – 'widget' (free, default) or 'api' (paid, needs API key)
 *   REVIEW_API_KEY           – API key for the provider (only needed for 'api' mode)
 *   REVIEW_BUSINESS_ID       – business/unit ID on the provider platform
 *   REVIEW_BUSINESS_URL      – business profile URL slug (e.g. 'prizeversity.com')
 *   REVIEW_WIDGET_TEMPLATE   – widget template ID (provider-specific, optional)
 *   REVIEW_WIDGET_TOKEN      – widget token (provider-specific, optional)
 *   REVIEW_SUBMIT_URL        – URL where users submit new reviews (opened in new tab)
 *   REVIEW_CACHE_MINUTES     – how long to cache reviews in api mode (default 15)
 */

module.exports = {
  provider: process.env.REVIEW_PROVIDER || '',
  mode: process.env.REVIEW_MODE || 'widget',
  apiKey: process.env.REVIEW_API_KEY || '',
  businessId: process.env.REVIEW_BUSINESS_ID || '',
  businessUrl: process.env.REVIEW_BUSINESS_URL || '',
  widgetTemplate: process.env.REVIEW_WIDGET_TEMPLATE || '',
  widgetToken: process.env.REVIEW_WIDGET_TOKEN || '',
  submitUrl: process.env.REVIEW_SUBMIT_URL || '',
  cacheMinutes: Number(process.env.REVIEW_CACHE_MINUTES) || 15,
};
