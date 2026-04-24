#!/bin/bash
# FeedLink Backend - Setup Checklist
# Follow these steps to get your backend running

echo "╔════════════════════════════════════════════════════════════╗"
echo "║         FeedLink Backend - Setup Checklist                 ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check 1: Node.js installed
echo "✓ Checking Node.js..."
if command -v node &> /dev/null
then
    echo "  ✅ Node.js $(node -v) is installed"
else
    echo "  ❌ Node.js not found. Install it from https://nodejs.org/"
    exit 1
fi

# Check 2: npm installed
echo ""
echo "✓ Checking npm..."
if command -v npm &> /dev/null
then
    echo "  ✅ npm $(npm -v) is installed"
else
    echo "  ❌ npm not found. Install it with Node.js"
    exit 1
fi

# Check 3: Backend folder exists
echo ""
echo "✓ Checking backend folder..."
if [ -d "backend" ]; then
    echo "  ✅ backend/ folder exists"
else
    echo "  ❌ backend/ folder not found"
    exit 1
fi

# Check 4: package.json exists
echo ""
echo "✓ Checking package.json..."
if [ -f "backend/package.json" ]; then
    echo "  ✅ backend/package.json found"
else
    echo "  ❌ backend/package.json not found"
    exit 1
fi

# Suggested next steps
echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║           Now Follow These Steps                           ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "1️⃣  Setup Supabase (10 minutes)"
echo "    📖 Read: backend/SUPABASE_SETUP.md"
echo "    • Create Supabase project"
echo "    • Get your credentials"
echo ""
echo "2️⃣  Create .env file (2 minutes)"
echo "    📝 Create: backend/.env"
echo "    # Copy from .env.example and add:"
echo "    SUPABASE_URL=your_url"
echo "    SUPABASE_ANON_KEY=your_key"
echo "    SUPABASE_SERVICE_ROLE_KEY=your_role_key"
echo "    JWT_SECRET=your_secret"
echo ""
echo "3️⃣  Install Dependencies (3 minutes)"
cd backend
echo "    $ npm install"
echo ""
echo "4️⃣  Run Database Schema (5 minutes)"
echo "    • Copy: backend/database-schema.sql"
echo "    • Open: Supabase SQL Editor"
echo "    • Paste and run the SQL"
echo ""
echo "5️⃣  Start Backend (1 minute)"
echo "    $ npm run dev"
echo ""
echo "6️⃣  Test Connection (1 minute)"
echo "    🌐 Visit: http://localhost:5000/api/health"
echo "    ✅ Should see: {'status': 'ok', 'message': '...'}"
echo ""
echo "7️⃣  Use Frontend (0 minutes)"
echo "    ✨ Frontend already connects automatically!"
echo "    🎉 Now test signup and create donations"
echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║           Documentation Files                              ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "📚 README.md"
echo "   Complete backend reference guide"
echo ""
echo "⚡ QUICKSTART.md"
echo "   5-minute quick start guide"
echo ""
echo "🔧 SUPABASE_SETUP.md"
echo "   Step-by-step Supabase configuration"
echo ""
echo "🔗 FRONTEND_INTEGRATION.md"
echo "   How frontend connects to backend"
echo ""
echo "🗄️  SQL_QUERIES.md"
echo "   Database testing and debugging queries"
echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║          Quick Commands                                    ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "# Install dependencies"
echo "npm install"
echo ""
echo "# Development mode (with auto-reload)"
echo "npm run dev"
echo ""
echo "# Production mode"
echo "NODE_ENV=production npm start"
echo ""
echo "# Test API health"
echo "curl http://localhost:5000/api/health"
echo ""
echo "✅ Setup checklist complete!"
echo "🚀 Ready to transform your platform!"
echo ""
