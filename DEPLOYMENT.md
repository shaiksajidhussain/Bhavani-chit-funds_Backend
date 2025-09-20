# Deployment Guide

## Prisma Binary Target Issue Fix

If you encounter the error:
```
PrismaClientInitializationError: Prisma Client could not locate the Query Engine for runtime "rhel-openssl-3.0.x"
```

This has been fixed by adding the correct binary targets to `schema.prisma`:

```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "rhel-openssl-3.0.x", "rhel-openssl-1.0.x", "linux-musl", "linux-musl-openssl-3.0.x"]
}
```

## Deployment Steps

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Generate Prisma Client:**
   ```bash
   npm run db:generate
   ```
   Or it will run automatically via `postinstall` script.

3. **Run Database Migrations:**
   ```bash
   npm run db:push
   ```

4. **Start the Server:**
   ```bash
   npm start
   ```

## Environment Variables

Make sure to set these environment variables:

- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret key for JWT tokens
- `NODE_ENV`: Environment (development/production)
- `PORT`: Server port (default: 5001)
- `CORS_ORIGIN`: Allowed CORS origins

## Supported Deployment Platforms

- ✅ Vercel
- ✅ Netlify
- ✅ AWS Lambda
- ✅ Railway
- ✅ Render
- ✅ Heroku
- ✅ DigitalOcean App Platform

## Binary Targets Included

- `native`: For local development
- `rhel-openssl-3.0.x`: For Red Hat Enterprise Linux with OpenSSL 3.0
- `rhel-openssl-1.0.x`: For Red Hat Enterprise Linux with OpenSSL 1.0
- `linux-musl`: For Alpine Linux
- `linux-musl-openssl-3.0.x`: For Alpine Linux with OpenSSL 3.0

This ensures compatibility across different deployment environments.
