# Frontend Integration Guide

## ✅ What's Already Done

Your frontend is **already configured** to connect to the backend! Here's why:

### API Configuration
In `script/api-config.js`, the `BASE_URL` is set to:
```javascript
get BASE_URL() {
    return localStorage.getItem('apiBaseUrl') || 'http://localhost:5000/api';
}
```

This means:
- ✅ Frontend automatically connects to `http://localhost:5000/api`
- ✅ No changes needed in your HTML files
- ✅ All API calls will work as soon as backend is running

## 🚀 What You Need To Do

### Step 1: Supabase Setup (10 min)
1. Open `backend/SUPABASE_SETUP.md`
2. Follow the setup instructions
3. Get your Supabase credentials
4. Create `.env` file in backend folder with credentials

### Step 2: Start Backend (3 min)
```bash
cd backend
npm install
npm run dev
```

You'll see:
```
Server running on http://localhost:5000
```

### Step 3: Test Connection (1 min)
Open your browser and visit:
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

### Step 4: Open Frontend (1 min)
Open your HTML files in browser - they'll automatically connect to the backend!

## 📡 How Frontend Communicates with Backend

### Signup Flow
```
Frontend: POST /api/auth/signup
↓
Backend: Creates user in Supabase
↓
Frontend: Receives token + user data
↓
Frontend: Stores token in localStorage
```

### Viewing Donations
```
Frontend: GET /api/donations/featured
↓
Backend: Queries Supabase database
↓
Frontend: Receives donation list
↓
Frontend: Displays items on page
```

### Authentication Required Endpoints
```
Frontend: POST /api/donations/create
Header: Authorization: Bearer <token>
↓
Backend: Verifies token
↓
Backend: Creates donation in Supabase
↓
Frontend: Shows success
```

## 🔑 Token Handling

The frontend automatically handles tokens:

```javascript
// 1. After login, token is saved
localStorage.setItem('feedlink_auth_token', token);

// 2. For protected endpoints, token is sent automatically
const token = localStorage.getItem('feedlink_auth_token');
headers.Authorization = `Bearer ${token}`;

// 3. When logging out, token is cleared
localStorage.removeItem('feedlink_auth_token');
```

## 📝 Checklist

Before testing, make sure:

- [ ] Supabase project is created
- [ ] Database schema is set up (ran database-schema.sql)
- [ ] `.env` file is created in backend folder with credentials
- [ ] Backend is running (`npm run dev`)
- [ ] Health check works (`http://localhost:5000/api/health`)
- [ ] Opening HTML files in browser

## 🧪 Manual Testing

### Test 1: Register New User
```javascript
// Open browser console (F12) and run:
fetch('http://localhost:5000/api/auth/signup', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'test@example.com',
    password: 'password123',
    fullName: 'Test User',
    userType: 'donor'
  })
})
.then(r => r.json())
.then(d => console.log(d));
```

### Test 2: Login
```javascript
fetch('http://localhost:5000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'test@example.com',
    password: 'password123'
  })
})
.then(r => r.json())
.then(d => console.log(d));
```

### Test 3: Get Profile (with token)
```javascript
const token = 'paste_your_token_here'; // from login response
fetch('http://localhost:5000/api/users/profile', {
  headers: { 
    'Authorization': `Bearer ${token}`
  }
})
.then(r => r.json())
.then(d => console.log(d));
```

## 🔧 If Connection Fails

### Error: "Cannot reach server"
1. Make sure backend is running: `npm run dev`
2. Check if port 5000 is available
3. Try: `http://localhost:5000/api/health`

### Error: "CORS error"
1. Backend should handle CORS automatically
2. Check browser console for details
3. If still fails, clear browser cache and reload

### Error: "Invalid token"
1. Log in again to get fresh token
2. Copy the token from response
3. Use in Authorization header

### Error: "Database error"
1. Check `.env` file has correct credentials
2. Verify Supabase project is running
3. Check if database-schema.sql ran successfully

## 📚 File Locations

```
e:\secondserve - 2f\
├── index.html                  # Frontend pages
├── ... (all HTML files)
├── script/
│   ├── api-config.js          # ✅ Already configured!
│   ├── api-utils.js           # Handles API calls
│   └── ... (other JS files)
└── backend/                    # Backend we just created
    ├── .env                    # Your credentials (create this)
    ├── server.js              # Main server
    ├── package.json
    └── ... (other backend files)
```

## ✨ What Happens Automatically

Once backend is running, your frontend:

✅ Connects to backend automatically
✅ Sends login/signup requests
✅ Saves tokens automatically
✅ Sends tokens with protected requests
✅ Handles errors automatically
✅ Displays user data automatically

**No code changes needed!**

## 🎯 Next Steps

1. Follow SUPABASE_SETUP.md to set up Supabase
2. Create `.env` file with your credentials
3. Run `npm run dev` in backend folder
4. Open your HTML files in browser
5. Try signing up and creating a donation

That's it! Your FeedLink app is now fully functional! 🎉
