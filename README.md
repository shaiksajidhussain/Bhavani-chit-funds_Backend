# Bhavani Chit Funds Backend API

A comprehensive backend API for managing chit fund operations built with Express.js, Prisma, and PostgreSQL.

## Features

- **User Management**: Admin, Agent, and Collector roles with authentication
- **Chit Scheme Management**: Create, update, and manage chit fund schemes
- **Customer Management**: Register and track customer participation
- **Collection Management**: Record daily collections and payments
- **Auction Management**: Schedule and manage chit fund auctions
- **Passbook System**: Generate and manage customer passbooks
- **Reports & Analytics**: Comprehensive reporting dashboard
- **Data Validation**: Input validation and error handling
- **Security**: JWT authentication, rate limiting, and CORS protection

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Authentication**: JWT (jsonwebtoken)
- **Security**: Helmet, bcryptjs, express-rate-limit
- **Validation**: express-validator

## Prerequisites

- Node.js (v16 or higher)
- PostgreSQL database
- npm or yarn package manager

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env` file in the root directory:
   ```env
   # Database
   DATABASE_URL="postgresql://postgresAdmin:Bhavani@987!@db.bhavanichits.com/database-1?schema=public"
   
   # JWT Secret
   JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
   
   # Server Configuration
   PORT=5000
   NODE_ENV=development
   
   # CORS Configuration
   CORS_ORIGIN=http://localhost:3000
   ```

4. **Database Setup**
   ```bash
   # Generate Prisma client
   npm run db:generate
   
   # Push schema to database
   npm run db:push
   
   # Seed database with sample data
   npm run db:seed
   ```

5. **Start the server**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update user profile
- `PUT /api/auth/change-password` - Change password
- `POST /api/auth/logout` - Logout user

### Chit Schemes
- `GET /api/chit-schemes` - Get all chit schemes
- `GET /api/chit-schemes/:id` - Get single chit scheme
- `POST /api/chit-schemes` - Create new chit scheme
- `PUT /api/chit-schemes/:id` - Update chit scheme
- `DELETE /api/chit-schemes/:id` - Delete chit scheme
- `GET /api/chit-schemes/:id/stats` - Get scheme statistics

### Customers
- `GET /api/customers` - Get all customers
- `GET /api/customers/:id` - Get single customer
- `POST /api/customers` - Create new customer
- `PUT /api/customers/:id` - Update customer
- `DELETE /api/customers/:id` - Delete customer
- `GET /api/customers/stats/overview` - Get customer statistics

### Collections
- `GET /api/collections` - Get all collections
- `GET /api/collections/:id` - Get single collection
- `POST /api/collections` - Create new collection
- `PUT /api/collections/:id` - Update collection
- `DELETE /api/collections/:id` - Delete collection
- `GET /api/collections/stats/daily` - Get daily collection summary
- `GET /api/collections/stats/range` - Get collection statistics by date range

### Auctions
- `GET /api/auctions` - Get all auctions
- `GET /api/auctions/:id` - Get single auction
- `POST /api/auctions` - Create new auction
- `PUT /api/auctions/:id` - Update auction
- `DELETE /api/auctions/:id` - Delete auction
- `GET /api/auctions/stats/overview` - Get auction statistics
- `GET /api/auctions/upcoming/list` - Get upcoming auctions

### Passbook
- `GET /api/passbook/customer/:customerId` - Get customer passbook entries
- `POST /api/passbook` - Create new passbook entry
- `PUT /api/passbook/:id` - Update passbook entry
- `DELETE /api/passbook/:id` - Delete passbook entry
- `GET /api/passbook/customer/:customerId/summary` - Get passbook summary
- `POST /api/passbook/customer/:customerId/generate` - Generate passbook entries

### Reports
- `GET /api/reports/dashboard/overview` - Get dashboard overview
- `GET /api/reports/revenue` - Get revenue report
- `GET /api/reports/customers/performance` - Get customer performance report
- `GET /api/reports/schemes/performance` - Get scheme performance report
- `GET /api/reports/collections/efficiency` - Get collection efficiency report

## Database Schema

### Core Models
- **User**: System users (Admin, Agent, Collector)
- **ChitScheme**: Chit fund schemes
- **Customer**: Customer registrations
- **Collection**: Daily collection records
- **Auction**: Auction and lifting records
- **PassbookEntry**: Customer passbook entries

### Enums
- **UserRole**: ADMIN, AGENT, COLLECTOR
- **DurationType**: DAYS, MONTHS
- **SchemeStatus**: ACTIVE, PAUSED, COMPLETED
- **CustomerStatus**: ACTIVE, COMPLETED, DEFAULTED
- **PaymentMethod**: CASH, BANK_TRANSFER, UPI, CHEQUE, NOT_PAID
- **AuctionStatus**: SCHEDULED, COMPLETED, CANCELLED
- **EntryType**: GENERATED, MANUAL

## Authentication

The API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Error Handling

All API responses follow a consistent format:

```json
{
  "success": boolean,
  "message": string,
  "data": object,
  "error": string (development only)
}
```

## Rate Limiting

The API implements rate limiting:
- 100 requests per 15 minutes per IP address
- Custom limits can be configured in `server.js`

## Security Features

- **Helmet**: Security headers
- **CORS**: Cross-origin resource sharing
- **Rate Limiting**: Request throttling
- **Input Validation**: Request data validation
- **Password Hashing**: bcryptjs for password security
- **JWT**: Secure token-based authentication

## Development

### Scripts
- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm run db:generate` - Generate Prisma client
- `npm run db:push` - Push schema to database
- `npm run db:migrate` - Run database migrations
- `npm run db:seed` - Seed database with sample data

### Sample Data

The seed script creates:
- 3 user accounts (Admin, Agent, Collector)
- 3 chit schemes
- 5 sample customers
- Sample collections, auctions, and passbook entries

**Default Login Credentials:**
- Admin: `admin@bhavanichits.com` / `admin123`
- Agent: `agent@bhavanichits.com` / `agent123`
- Collector: `collector@bhavanichits.com` / `collector123`

## API Documentation

For detailed API documentation, refer to the individual route files in the `routes/` directory. Each route includes:
- Request/response schemas
- Validation rules
- Authentication requirements
- Error handling

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support and questions, please contact the development team or create an issue in the repository.
