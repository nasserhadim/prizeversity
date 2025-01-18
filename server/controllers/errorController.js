export const globalErrorHandler = (err, req, res, next) => {
  console.error('[Global Error Handler]', err);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Server Error';

  res.status(statusCode).json({
    status: 'error',
    message
  });
};
