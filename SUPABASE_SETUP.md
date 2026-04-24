# Supabase Setup Instructions

## Step 1: Create Supabase Project

1. Go to https://supabase.com
2. Click "Start your project"
3. Sign up or login with your account
4. Click "New Project"
5. Fill in:
   - **Project Name**: `feedlink`
   - **Database Password**: Create a strong password
   - **Region**: Select closest to your location
6. Click "Create new project" and wait for it to be created

## Step 2: Get Your Credentials

Once the project is created:

1. Go to **Project Settings** (bottom left) → **API**
2. Copy these values and save them:
   - **Project URL** → `SUPABASE_URL`
   - **anon public** → `SUPABASE_ANON_KEY`
   - **service_role secret** → `SUPABASE_SERVICE_ROLE_KEY`

## Step 3: Set Up Database Schema

1. In Supabase, go to **SQL Editor** (left sidebar)
2. Click **New Query**
3. Copy everything from `database-schema.sql` file
4. Paste it into the SQL editor
5. Click **Run** button
6. Wait for all tables to be created

## Step 4: Enable Authentication

1. Go to **Authentication** (left sidebar) → **Providers**
2. Click **Email**
3. Enable "Email/Password authentication"
4. Scroll down to **Email templates** and customize if needed
5. Save settings

## Step 5: Update Backend .env File

Create `.env` file in the `backend` folder:

```
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
JWT_SECRET=any_random_secret_key_you_want
PORT=5000
NODE_ENV=development
```

## Step 6: Run Backend

```bash
cd backend
npm install
npm run dev
```

Server will start on `http://localhost:5000`

## Step 7: Test Connection

Open browser and go to:
```
http://localhost:5000/api/health
```

You should see:
```json
{
    "status": "ok",
    "message": "FeedLink Backend is running"
}
```

## Step 8: Update Frontend Configuration (Optional)

If your frontend is served from a different domain, you may need to update CORS:

In `server.js`, modify the CORS configuration:
```javascript
app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:5173', 'http://localhost'],
    credentials: true
}));
```

## Common Issues

### "Connection refused"
- Make sure backend is running (`npm run dev`)
- Check if port 5000 is not blocked by firewall

### "Invalid credentials"
- Verify `SUPABASE_URL` and keys in `.env`
- Make sure you're using `SUPABASE_ANON_KEY` (not service role key) for the client

### "Table does not exist"
- Run the database-schema.sql again
- Check if all tables were created in Supabase SQL Editor

## Next Steps

1. Run backend: `cd backend && npm run dev`
2. Frontend should connect automatically to `http://localhost:5000/api`
3. Test signup/login on your frontend
4. Start creating donations and using the platform!
