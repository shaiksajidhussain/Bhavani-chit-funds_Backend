const { body, param, query, validationResult } = require('express-validator');

// Validation error handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

// Common validation rules
const commonValidations = {
  id: param('id').isString().notEmpty().withMessage('Valid ID is required'),
  
  pagination: [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
  ]
};

// User validation rules
const userValidations = {
  register: [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
    body('role').optional().isIn(['ADMIN', 'AGENT', 'COLLECTOR']).withMessage('Invalid role')
  ],
  
  login: [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required')
  ]
};

// Chit Scheme validation rules
const chitSchemeValidations = {
  create: [
    body('name').trim().isLength({ min: 3 }).withMessage('Scheme name must be at least 3 characters'),
    body('chitValue').isInt({ min: 1000 }).withMessage('Chit value must be at least ₹1000'),
    body('duration').isInt({ min: 1 }).withMessage('Duration must be at least 1'),
    body('durationType').isIn(['DAYS', 'MONTHS']).withMessage('Duration type must be DAYS or MONTHS'),
    body('dailyPayment').isInt({ min: 1 }).withMessage('Daily payment must be at least ₹1'),
    body('monthlyPayment').optional().isInt({ min: 1 }).withMessage('Monthly payment must be at least ₹1'),
    body('numberOfMembers').isInt({ min: 2 }).withMessage('Number of members must be at least 2'),
    body('startDate').isISO8601().withMessage('Valid start date is required'),
    body('lastDate').optional().isISO8601().withMessage('Valid last date is required'),
    body('description').optional().trim().isLength({ max: 500 }).withMessage('Description must be less than 500 characters'),
    body('commissionRate').optional().isFloat({ min: 0, max: 1 }).withMessage('Commission rate must be between 0 and 1'),
    body('penaltyRate').optional().isFloat({ min: 0, max: 1 }).withMessage('Penalty rate must be between 0 and 1'),
    body('minBidAmount').optional().isInt({ min: 0 }).withMessage('Minimum bid amount must be non-negative'),
    body('maxBidAmount').optional().isInt({ min: 0 }).withMessage('Maximum bid amount must be non-negative'),
    body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
    body('status').optional().isIn(['ACTIVE', 'PAUSED', 'COMPLETED']).withMessage('Invalid status')
  ],
  
  update: [
    body('name').optional().trim().isLength({ min: 3 }).withMessage('Scheme name must be at least 3 characters'),
    body('chitValue').optional().isInt({ min: 1000 }).withMessage('Chit value must be at least ₹1000'),
    body('duration').optional().isInt({ min: 1 }).withMessage('Duration must be at least 1'),
    body('durationType').optional().isIn(['DAYS', 'MONTHS']).withMessage('Duration type must be DAYS or MONTHS'),
    body('dailyPayment').optional().isInt({ min: 1 }).withMessage('Daily payment must be at least ₹1'),
    body('monthlyPayment').optional().isInt({ min: 1 }).withMessage('Monthly payment must be at least ₹1'),
    body('numberOfMembers').optional().isInt({ min: 2 }).withMessage('Number of members must be at least 2'),
    body('startDate').optional().isISO8601().withMessage('Valid start date is required'),
    body('lastDate').optional().isISO8601().withMessage('Valid last date is required'),
    body('description').optional().trim().isLength({ max: 500 }).withMessage('Description must be less than 500 characters'),
    body('commissionRate').optional().isFloat({ min: 0, max: 1 }).withMessage('Commission rate must be between 0 and 1'),
    body('penaltyRate').optional().isFloat({ min: 0, max: 1 }).withMessage('Penalty rate must be between 0 and 1'),
    body('minBidAmount').optional().isInt({ min: 0 }).withMessage('Minimum bid amount must be non-negative'),
    body('maxBidAmount').optional().isInt({ min: 0 }).withMessage('Maximum bid amount must be non-negative'),
    body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
    body('status').optional().isIn(['ACTIVE', 'PAUSED', 'COMPLETED']).withMessage('Invalid status')
  ]
};

// Customer validation rules
const customerValidations = {
  create: [
    body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
    body('mobile').isMobilePhone('en-IN').withMessage('Valid mobile number is required'),
    body('address').trim().isLength({ min: 10 }).withMessage('Address must be at least 10 characters'),
    body('schemeId').isString().notEmpty().withMessage('Valid scheme ID is required'),
    body('startDate').isISO8601().withMessage('Valid start date is required'),
    body('lastDate').optional().isISO8601().withMessage('Valid last date is required'),
    body('amountPerDay').isInt({ min: 1 }).withMessage('Amount per day must be at least ₹1'),
    body('duration').isInt({ min: 1 }).withMessage('Duration must be at least 1'),
    body('durationType').optional().isIn(['DAYS', 'MONTHS']).withMessage('Duration type must be DAYS or MONTHS'),
    body('group').trim().notEmpty().withMessage('Group is required'),
    body('photo').optional().isString().withMessage('Photo must be a valid string'),
    body('status').optional().isIn(['ACTIVE', 'COMPLETED', 'DEFAULTED']).withMessage('Invalid status')
  ],
  
  update: [
    body('name').optional().trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
    body('mobile').optional().isMobilePhone('en-IN').withMessage('Valid mobile number is required'),
    body('address').optional().trim().isLength({ min: 10 }).withMessage('Address must be at least 10 characters'),
    body('schemeId').optional().isString().notEmpty().withMessage('Valid scheme ID is required'),
    body('startDate').optional().isISO8601().withMessage('Valid start date is required'),
    body('lastDate').optional().isISO8601().withMessage('Valid last date is required'),
    body('amountPerDay').optional().isInt({ min: 1 }).withMessage('Amount per day must be at least ₹1'),
    body('duration').optional().isInt({ min: 1 }).withMessage('Duration must be at least 1'),
    body('durationType').optional().isIn(['DAYS', 'MONTHS']).withMessage('Duration type must be DAYS or MONTHS'),
    body('group').optional().trim().notEmpty().withMessage('Group is required'),
    body('photo').optional().isString().withMessage('Photo must be a valid string'),
    body('status').optional().isIn(['ACTIVE', 'COMPLETED', 'DEFAULTED']).withMessage('Invalid status')
  ]
};

// Collection validation rules
const collectionValidations = {
  create: [
    body('customerId').isString().notEmpty().withMessage('Valid customer ID is required'),
    body('amountPaid').isInt({ min: 0 }).withMessage('Amount paid must be non-negative'),
    body('date').isISO8601().withMessage('Valid date is required'),
    body('balanceRemaining').isInt({ min: 0 }).withMessage('Balance remaining must be non-negative'),
    body('paymentMethod').isIn(['CASH', 'BANK_TRANSFER', 'UPI', 'CHEQUE', 'NOT_PAID']).withMessage('Invalid payment method')
  ],
  
  update: [
    body('amountPaid').optional().isInt({ min: 0 }).withMessage('Amount paid must be non-negative'),
    body('date').optional().isISO8601().withMessage('Valid date is required'),
    body('balanceRemaining').optional().isInt({ min: 0 }).withMessage('Balance remaining must be non-negative'),
    body('paymentMethod').optional().isIn(['CASH', 'BANK_TRANSFER', 'UPI', 'CHEQUE', 'NOT_PAID']).withMessage('Invalid payment method')
  ]
};

// Auction validation rules
const auctionValidations = {
  create: [
    body('chitSchemeId').isString().notEmpty().withMessage('Valid chit scheme ID is required'),
    body('auctionDate').isISO8601().withMessage('Valid auction date is required'),
    body('amountReceived').optional().isInt({ min: 0 }).withMessage('Amount received must be non-negative'),
    body('discountAmount').optional().isInt({ min: 0 }).withMessage('Discount amount must be non-negative'),
    body('newDailyPayment').optional().isInt({ min: 1 }).withMessage('New daily payment must be at least ₹1'),
    body('previousDailyPayment').optional().isInt({ min: 1 }).withMessage('Previous daily payment must be at least ₹1'),
    body('status').optional().isIn(['SCHEDULED', 'COMPLETED', 'CANCELLED']).withMessage('Invalid status')
  ],
  
  update: [
    body('auctionDate').optional().isISO8601().withMessage('Valid auction date is required'),
    body('amountReceived').optional().isInt({ min: 0 }).withMessage('Amount received must be non-negative'),
    body('discountAmount').optional().isInt({ min: 0 }).withMessage('Discount amount must be non-negative'),
    body('newDailyPayment').optional().isInt({ min: 1 }).withMessage('New daily payment must be at least ₹1'),
    body('previousDailyPayment').optional().isInt({ min: 1 }).withMessage('Previous daily payment must be at least ₹1'),
    body('status').optional().isIn(['SCHEDULED', 'COMPLETED', 'CANCELLED']).withMessage('Invalid status')
  ]
};

// Passbook validation rules
const passbookValidations = {
  create: [
    body('customerId').isString().notEmpty().withMessage('Valid customer ID is required'),
    body('month').isInt({ min: 1, max: 12 }).withMessage('Month must be between 1 and 12'),
    body('date').isISO8601().withMessage('Valid date is required'),
    body('dailyPayment').isInt({ min: 0 }).withMessage('Daily payment must be non-negative'),
    body('amount').isInt({ min: 0 }).withMessage('Amount must be non-negative'),
    body('chittiAmount').isInt({ min: 0 }).withMessage('Chitti amount must be non-negative'),
    body('type').optional().isIn(['GENERATED', 'MANUAL']).withMessage('Invalid entry type')
  ]
};

module.exports = {
  handleValidationErrors,
  commonValidations,
  userValidations,
  chitSchemeValidations,
  customerValidations,
  collectionValidations,
  auctionValidations,
  passbookValidations
};
