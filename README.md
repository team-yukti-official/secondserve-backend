# FeedLink Backend Setup

## Installation

1. **Install dependencies:**
```bash
cd backend
npm install
```

2. **Set up environment variables:**
Create a `.env` file in the backend folder with:
```
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
JWT_SECRET=your_jwt_secret_key
PORT=5000
NODE_ENV=development
```

3. **Set up Supabase Database:**
- Go to your Supabase project dashboard
- Open the SQL Editor
- Copy the contents of `database-schema.sql` and run it in SQL Editor
- This will create all tables, indexes, and row-level security policies

## Running the Server

**Development mode (with auto-reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

Server will run on `http://localhost:5000`

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `POST /api/auth/check-email` - Check if email exists
- `POST /api/auth/forgot-password` - Send password reset email

### Users
- `GET /api/users/profile` - Get current user profile (requires auth)
- `PUT /api/users/profile` - Update profile (requires auth)
- `GET /api/users/:id` - Get public user profile

### Donations
- `POST /api/donations/create` - Create donation (requires auth)
- `GET /api/donations/featured` - Get featured donations
- `GET /api/donations/nearby` - Get nearby donations (query: latitude, longitude, radius)
- `GET /api/donations/my-donations` - Get user's donations (requires auth)
- `GET /api/donations/:id` - Get donation details
- `PUT /api/donations/:id` - Update donation (requires auth)
- `DELETE /api/donations/:id` - Delete donation (requires auth)

### Pickup Requests
- `POST /api/pickups/:donationId/request` - Request pickup (requires auth)
- `GET /api/pickups/:donationId/requests` - Get pickup requests for a donation
- `PUT /api/pickups/:requestId/accept` - Accept pickup request (requires auth)

## Connecting Frontend

Update your frontend API config:
1. Go to `frontend/script/api-config.js` (in this monorepo)
2. Change `BASE_URL` to `http://localhost:5000/api`
3. Update any endpoints that have changed

## Features Included

✅ User Authentication (Signup, Login, Password Reset)
✅ User Profiles (Create, Read, Update)
✅ Donations Management (CRUD operations)
✅ Pickup Requests
✅ Location-based Search (Nearby donations)
✅ Supabase Integration
✅ Row-Level Security
✅ Error Handling
✅ CORS Support

## Database Structure

- **users** - User profiles and authentication
- **donations** - Food/item donations
- **pickup_requests** - Pickup request management
- **ngo_profiles** - NGO specific information
- **messages** - Chat/messaging between users
# secondserve-backend
