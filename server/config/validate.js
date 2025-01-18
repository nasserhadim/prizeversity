import { body, query, validationResult } from 'express-validator';

// Example: create classroom
export const createClassroomValidation = [
  body('className')
    .trim()
    .notEmpty()
    .withMessage('Class name is required')
];

// Example: search/sort transactions
export const transactionQueryValidation = [
  query('search').optional().isString().withMessage('search must be a string'),
  query('sort').optional().isString().withMessage('sort must be a string'),
  query('order').optional().isIn(['asc', 'desc']).withMessage('order must be asc or desc'),
  query('page').optional().isInt({ min: 1 }).withMessage('page must be >= 1'),
  query('limit').optional().isInt({ min: 1 }).withMessage('limit must be >= 1')
];

export const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'fail',
      errors: errors.array().map(e => ({ field: e.param, message: e.msg }))
    });
  }
  next();
};
