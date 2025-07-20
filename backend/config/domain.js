const isProd = process.env.NODE_ENV === 'production';

console.log('✅ [domain.js] NODE_ENV:', process.env.NODE_ENV);
console.log('✅ [domain.js] DOMAIN:', process.env.DOMAIN);

if (isProd && !process.env.DOMAIN) {
  throw new Error('DOMAIN env variable is missing in production!');
}

// Use this base for callback URLs like /api/auth/google/callback
const callbackBase = isProd
  ? process.env.DOMAIN
  : 'http://localhost:5000';

// Use this base for frontend redirects like after OAuth login
const redirectBase = isProd
  ? process.env.DOMAIN
  : 'http://localhost:5173';

module.exports = {
  isProd,
  callbackBase,
  redirectBase,
};
