# Second Serve Backend API

Express.js backend for the Second Serve platform. Connects to Supabase for data management.

## 🚀 Quick Start

### Prerequisites
- Node.js 16+
- npm or yarn
- Supabase account

### Installation

```bash
npm install
```

### Environment Setup

Create `.env` file:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
JWT_SECRET=your-strong-secret-key
PORT=5000
NODE_ENV=development
CORS_ORIGINS=http://localhost:3000,http://localhost:8000
```

### Database Setup

```bash
# In Supabase dashboard:
# 1. Go to SQL Editor
# 2. Run database-schema.sql
# 3. This creates all tables and RLS policies
```

### Running

**Development:**
```bash
npm run dev
```

**Production:**
```bash
npm start
```

Server runs on `http://localhost:5000`

Test health endpoint:
```bash
curl http://localhost:5000/api/health
```

## 📡 API Documentation

### Authentication

```
POST /api/auth/signup
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/forgot-password
POST /api/auth/reset-password
POST /api/auth/validate-token
```

### Donations

```
POST /api/donations/create (auth required)
GET /api/donations/featured
GET /api/donations/all
GET /api/donations/nearby?lat=X&lng=Y&radius=10
GET /api/donations/{id}
PUT /api/donations/{id} (auth required)
DELETE /api/donations/{id} (auth required)
GET /api/donations/statistics/dashboard (public)
```

### Users

```
GET /api/users/profile (auth required)
PUT /api/users/profile (auth required)
GET /api/users/{id}
```

### NGOs

```
GET /api/ngos/nearby?lat=X&lng=Y
GET /api/ngos/all
GET /api/ngos/{id}
POST /api/ngos/{id}/follow (auth required)
DELETE /api/ngos/{id}/follow (auth required)
```

### Volunteers

```
GET /api/volunteers
POST /api/volunteers/join (auth required)
GET /api/volunteers/{id}
```

## 🏗️ Project Structure

```
backend/
├── server.js              # Express app entry point
├── package.json           # Dependencies
├── railway.json           # Railway deployment config
├── database-schema.sql    # Supabase schema
├── .env                   # Environment variables (gitignored)
├── config/
│   └── supabase.js        # Supabase client config
├── controllers/           # Route handlers
├── routes/                # API route definitions
├── middleware/            # Express middleware
│   ├── auth.js            # JWT verification
│   └── errorHandler.js    # Error handling
└── utils/                 # Helper functions
```

## 🔐 Security Features

✅ JWT-based authentication
✅ Supabase Row-Level Security (RLS)
✅ CORS with environment-based origins
✅ Request validation
✅ Error handling middleware
✅ Rate limiting ready

## 📦 Deployment

### Railway

1. Create new service from GitHub repo
2. Set root directory to `.` (backend is root)
3. Add environment variables (see `.env` section)
4. Set start command: `npm start`
5. Deploy

After deploy, test:
```bash
curl https://your-backend.up.railway.app/api/health
```

### Heroku (alternative)

```bash
heroku create your-app-name
git push heroku main
heroku config:set SUPABASE_URL=... (and other vars)
```

## 🧪 Testing

Manual endpoint tests:

```bash
# Health check
curl http://localhost:5000/api/health

# Get dashboard stats (public endpoint)
curl http://localhost:5000/api/donations/statistics/dashboard

# Test with auth (replace TOKEN)
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:5000/api/users/profile
```

## 🔗 Frontend Integration

Frontend connects via:
1. Netlify redirects `/api/*` → backend URL
2. Or directly via `API_BASE_URL` in env-config.js
3. Or via localStorage override

See `frontend/README.md` for details.

## 🐛 Troubleshooting

### Port already in use
```bash
# Kill process on port 5000
lsof -ti:5000 | xargs kill -9
```

### CORS errors
- Check `CORS_ORIGINS` environment variable
- Make sure frontend URL is listed

### Database connection fails
- Verify Supabase credentials in `.env`
- Check if database schema is created
- Verify RLS policies are correct

### JWT errors
- Regenerate `JWT_SECRET`
- Clear frontend tokens: `localStorage.clear()`

## 📚 Files Reference

- [Database Schema](./database-schema.sql)
- [Setup Guide](./SUPABASE_SETUP.md)
- [Deployment Guide](../DEPLOYMENT_GUIDE.md)

## 📝 License

See LICENSE in root directory
