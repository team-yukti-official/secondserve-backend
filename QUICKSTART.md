# FeedLink Backend - Quick Start Guide

## 📋 Project Overview

This is a complete backend for FeedLink - a platform connecting food/item donors with NGOs and organizations that help distribute them to those in need.

## 🚀 Quick Start (5 minutes)

### 1. Install & Configure

```bash
# Navigate to backend folder
cd backend

# Install dependencies
npm install

# Create .env file (copy from .env.example)
# Add your Supabase credentials
```

### 2. Set Up Supabase

```
Read SUPABASE_SETUP.md for detailed instructions
(Takes about 10 minutes)
```

### 3. Start Backend

```bash
npm run dev
```

Your backend is now running at `http://localhost:5000`

## 📁 Project Structure

```
backend/
├── server.js                 # Main Express server
├── package.json              # Dependencies
├── .env.example              # Environment template
├── database-schema.sql       # Database setup
├── controllers/              # Business logic
│   ├── authController.js
│   ├── userController.js
│   ├── donationController.js
│   ├── pickupController.js
│   ├── messageController.js
│   └── ngoController.js
├── routes/                   # API endpoints
│   ├── authRoutes.js
│   ├── userRoutes.js
│   ├── donationRoutes.js
│   ├── pickupRoutes.js
│   ├── messageRoutes.js
│   └── ngoRoutes.js
├── middleware/               # Request processing
│   ├── auth.js              # Authentication check
│   └── errorHandler.js      # Error handling
└── config/                   # Configuration
    └── supabase.js          # Supabase client
```

## 🔌 API Endpoints

### Authentication
```
POST   /api/auth/signup              - Create new account
POST   /api/auth/login               - Login user
POST   /api/auth/logout              - Logout user
POST   /api/auth/check-email         - Check if email exists
POST   /api/auth/forgot-password     - Send password reset
```

### Users
```
GET    /api/users/profile            - Get your profile
PUT    /api/users/profile            - Update your profile
GET    /api/users/:id                - Get public profile
```

### Donations
```
POST   /api/donations/create         - Create donation
GET    /api/donations/featured       - Get featured items
GET    /api/donations/nearby         - Find nearby donations
GET    /api/donations/my-donations   - Your donations
GET    /api/donations/:id            - Donation details
PUT    /api/donations/:id            - Edit donation
DELETE /api/donations/:id            - Delete donation
```

### Pickup Requests
```
POST   /api/pickups/:id/request      - Request to pick up
GET    /api/pickups/:id/requests     - View pickup requests
PUT    /api/pickups/:id/accept       - Accept pickup request
```

### NGOs
```
POST   /api/ngos/profile             - Create NGO profile
GET    /api/ngos/profile/:id         - View NGO profile
PUT    /api/ngos/profile             - Update NGO profile
GET    /api/ngos/nearby              - Find nearby NGOs
GET    /api/ngos/search              - Search NGOs
GET    /api/ngos/:id/statistics      - NGO stats
```

### Messages
```
POST   /api/messages/send            - Send message
GET    /api/messages/conversation/:id - View conversation
GET    /api/messages/conversations   - All conversations
```

## 🔐 Authentication

All endpoints (except public GET requests) require an `Authorization` header:

```
Authorization: Bearer your_token_here
```

To get a token, call `/api/auth/login` and use the returned `token`.

## 📊 Database Structure

### users
- Stores all user data (donors, NGOs, admins)
- Has full row-level security

### donations
- Created by donors
- Can be searched by location
- Track status (available, claimed, completed)

### pickup_requests
- NGOs request to pick up donations
- Donors can accept/reject requests

### ngo_profiles
- Additional info for NGO accounts
- Organization details and impact tracking

### messages
- Direct messaging between users
- Linked to donations if needed

## 🧪 Testing API

### Using cURL
```bash
# Signup
curl -X POST http://localhost:5000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "fullName": "Test User",
    "userType": "donor"
  }'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

### Using Frontend
The frontend is already configured to connect to this backend at `http://localhost:5000/api`

## 🛠️ Development

### Run in Development Mode
```bash
npm run dev
```
Auto-reloads on file changes (requires nodemon)

### Run in Production Mode
```bash
NODE_ENV=production npm start
```

## 📝 Environment Variables

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Anonymous key for client operations |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin key for server operations |
| `JWT_SECRET` | Secret for JWT tokens |
| `PORT` | Server port (default: 5000) |
| `NODE_ENV` | development or production |

## 🐛 Troubleshooting

### "Connection refused"
- Is backend running? (`npm run dev`)
- Is port 5000 available?

### "Invalid token"
- Token might be expired
- Request a new token via login

### "Database error"
- Check Supabase credentials in `.env`
- Verify database schema is set up (run database-schema.sql)

### "CORS error"
- Backend is running on different port
- Update CORS in server.js if needed

## 📚 Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Express.js Documentation](https://expressjs.com)
- [FeedLink Frontend](../README.md)

## ✅ Features

✓ User authentication with email/password
✓ User profiles with roles (donor, NGO, admin)
✓ Create and manage donations
✓ Location-based search for nearby donations
✓ Pickup request system
✓ NGO profile management
✓ Direct messaging between users
✓ Row-level security in database
✓ Error handling and validation
✓ CORS support for frontend

## 🚦 Status

✅ Backend: Ready to use
✅ Database: Schema included
✅ APIs: All endpoints implemented
✅ Authentication: JWT + Supabase Auth
✅ Frontend: Connected

---

**Created**: 2024
**Version**: 1.0.0
