const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { PrismaClient } = require('@prisma/client');

// Import routes
const authRoutes = require('./routes/auth');
const chitSchemeRoutes = require('./routes/chitSchemes');
const customerRoutes = require('./routes/customers');
const collectionRoutes = require('./routes/collections');
const auctionRoutes = require('./routes/auctions');
const passbookRoutes = require('./routes/passbook');
const reportRoutes = require('./routes/reports');

const app = express();

// Trust proxy - required for rate limiting behind proxies/load balancers
// This tells Express to trust the X-Forwarded-* headers
app.set('trust proxy', true);

// Additional proxy configuration for different deployment scenarios
if (process.env.NODE_ENV === 'production') {
  // In production, trust the first proxy
  app.set('trust proxy', 1);
} else {
  // In development, trust all proxies
  app.set('trust proxy', true);
}

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

// Set server timeouts
app.use((req, res, next) => {
  // Set timeout to 30 seconds for all requests
  req.setTimeout(30000, () => {
    res.status(408).json({
      success: false,
      message: 'Request timeout',
      error: 'Request took too long to process'
    });
  });
  
  // Set response timeout
  res.setTimeout(30000, () => {
    if (!res.headersSent) {
      res.status(408).json({
        success: false,
        message: 'Response timeout',
        error: 'Response took too long to send'
      });
    }
  });
  
  next();
});

// Security middleware
app.use(helmet());

// Rate limiting - more lenient for development
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // increased limit for development
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
    retryAfter: Math.round(15 * 60 * 1000 / 1000) // seconds
  },
  
  // Key generator to handle proxy scenarios
  keyGenerator: (req) => {
    // Use X-Forwarded-For header if available, otherwise use IP
    return req.ip || req.connection.remoteAddress || 'unknown';
  },
  
  // Skip successful requests from rate limiting
  skipSuccessfulRequests: false,
  
  // Skip failed requests from rate limiting
  skipFailedRequests: false,
  
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many requests from this IP, please try again later.',
      retryAfter: Math.round(15 * 60 * 1000 / 1000)
    });
  }
});
app.use(limiter);

// CORS configuration
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      // Local development
      'http://localhost:3000',
      'http://localhost:3001', 
      'http://localhost:5173',
      'http://localhost:4173',
      // Vercel deployments
      'https://bhavani-chit-funds.vercel.app',
      'https://bhavani-chit-funds-git-main.vercel.app',
      'https://bhavani-chit-funds-git-develop.vercel.app',
      // Environment variable for custom domains
      process.env.CORS_ORIGIN,
      // Wildcard for Vercel preview deployments
      /^https:\/\/.*\.vercel\.app$/
    ].filter(Boolean);
    
    // Check if origin matches any allowed origin
    const isAllowed = allowedOrigins.some(allowedOrigin => {
      if (typeof allowedOrigin === 'string') {
        return allowedOrigin === origin;
      } else if (allowedOrigin instanceof RegExp) {
        return allowedOrigin.test(origin);
      }
      return false;
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
  optionsSuccessStatus: 200,
  preflightContinue: false
}));

// Logging
app.use(morgan('combined'));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Handle CORS preflight for all API routes
app.options('/api/*', (req, res) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    // Local development
    'http://localhost:3000',
    'http://localhost:3001', 
    'http://localhost:5173',
    'http://localhost:4173',
    // Vercel deployments
    'https://bhavani-chit-funds.vercel.app',
    'https://bhavani-chit-funds-git-main.vercel.app',
    'https://bhavani-chit-funds-git-develop.vercel.app',
    // Environment variable for custom domains
    process.env.CORS_ORIGIN
  ].filter(Boolean);
  
  // Check if origin is allowed (including Vercel preview URLs)
  const isAllowed = allowedOrigins.includes(origin) || 
                   (origin && origin.includes('.vercel.app'));
  
  if (isAllowed) {
    res.header('Access-Control-Allow-Origin', origin);
  } else {
    res.header('Access-Control-Allow-Origin', '*');
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400'); // 24 hours
  res.sendStatus(200);
});

// Global CORS handler for all routes
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    // Local development
    'http://localhost:3000',
    'http://localhost:3001', 
    'http://localhost:5173',
    'http://localhost:4173',

    // Vercel deployments
    'https://bhavani-chit-funds.vercel.app',
    'https://bhavani-chit-funds-git-main.vercel.app',
    'https://bhavani-chit-funds-git-develop.vercel.app',
    'https://bhavanichits.com',
    'https://www.bhavanichits.com',
    'https://www.bhavanichits.com/',
    // Environment variable for custom domains
    process.env.CORS_ORIGIN
  ].filter(Boolean);
  
  // Check if origin is allowed (including Vercel preview URLs)
  const isAllowed = allowedOrigins.includes(origin) || 
                   (origin && origin.includes('.vercel.app'));
  
  if (isAllowed) {
    res.header('Access-Control-Allow-Origin', origin);
  } else if (origin) {
    res.header('Access-Control-Allow-Origin', '*');
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400'); // 24 hours
  
  next();
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/chit-schemes', chitSchemeRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/collections', collectionRoutes);
app.use('/api/auctions', auctionRoutes);
app.use('/api/passbook', passbookRoutes);
app.use('/api/reports', reportRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      errors: err.errors
    });
  }
  
  if (err.name === 'PrismaClientKnownRequestError') {
    return res.status(400).json({
      success: false,
      message: 'Database Error',
      error: 'Invalid request to database'
    });
  }
  
  res.status(500).json({
    success: false,
    message: 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

const PORT = process.env.PORT || 5001;

// Create server with keep-alive settings
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Configure server timeouts
server.timeout = 30000; // 30 seconds
server.keepAliveTimeout = 65000; // 65 seconds
server.headersTimeout = 66000; // 66 seconds

// Handle server errors
server.on('error', (err) => {
  console.error('Server error:', err);
});

// Handle client errors
server.on('clientError', (err, socket) => {
  console.error('Client error:', err);
  socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

module.exports = app;
