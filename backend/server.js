const path = require('path');
const http = require('http');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const { MongoStore } = require('connect-mongo');
const { initSocket } = require('./realtime');

// Allowed origins for CORS; override in .env with comma-separated list.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const employeeRoutes = require('./routes/employee');

const rootDir = path.join(__dirname, '..');
const frontendDist = path.join(rootDir, 'frontend', 'dist');
const frontendIndex = path.join(frontendDist, 'index.html');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0'; // Bind to all interfaces for cloud providers (e.g., Render).
const MONGODB_URI = process.env.MONGODB_URI;

// HTTP + Socket.IO server setup.
const httpServer = http.createServer(app);
initSocket(httpServer, ALLOWED_ORIGINS);

// Ensure Express knows it is behind a proxy (Render/Heroku/etc.) so secure cookies are set correctly.
app.set('trust proxy', 1);

if (!MONGODB_URI) {
  console.error('Missing MONGODB_URI in .env');
  process.exit(1);
}

mongoose
  .connect(MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });

// Minimal CORS to allow frontend to send cookies.
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.json({ limit: '3mb' }));
app.use(express.urlencoded({ extended: false, limit: '3mb' }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: MONGODB_URI
    }),
    cookie: {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 8,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      secure: process.env.NODE_ENV === 'production'
    }
  })
);

app.use(express.static(frontendDist));

// Lightweight health check for Render/uptime monitors.
app.get('/health', (req, res) => res.send('ok'));

app.get('/', (req, res) => { // Root route redirects by session role.
  const roles = req.session?.roles || {};
  const lastRole = req.session?.lastRole;
const rolePath = {
    admin: '/admin',
    manager: '/manager',
    teamlead: '/teamlead',
    employee: '/employee'
  };

  if (lastRole && roles[lastRole]?.userId) {
    return res.redirect(rolePath[lastRole] || '/login');
  }
  if (roles.admin?.userId) {
    return res.redirect(rolePath.admin);
  }
  if (roles.manager?.userId) {
    return res.redirect(rolePath.manager);
  }
  if (roles.teamlead?.userId) {
    return res.redirect(rolePath.teamlead);
  }
  if (roles.employee?.userId) {
    return res.redirect(rolePath.employee);
  }
  return res.redirect('/login');
});

app.use(authRoutes);
app.use(adminRoutes);
app.use(employeeRoutes);

app.get('*', (req, res) => { // SPA fallback for non-API routes.
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ message: 'Not found' });
  }
  return res.sendFile(frontendIndex);
});

app.use((req, res) => { // 404 handler for unmatched API routes.
  res.status(404).json({ message: 'Not found' });
});

httpServer.listen(PORT, HOST, () => { // Start the HTTP + WebSocket server.
  console.log(`Server running on http://${HOST}:${PORT}`);
});

