export const API_BASE =
  import.meta.env.MODE === 'production'
    ? 'https://www.prizeversity.com'
    : 'http://localhost:5000';
