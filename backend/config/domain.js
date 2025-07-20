const isProd = process.env.NODE_ENV === 'production';

if (isProd && !process.env.DOMAIN) {
  throw new Error('DOMAIN env variable is missing in production!');
}

const callbackBase = isProd
  ? process.env.DOMAIN
  : 'http://localhost:5000';

module.exports = {
  isProd,
  callbackBase,
};
