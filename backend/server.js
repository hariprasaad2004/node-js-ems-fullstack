const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const { MongoStore } = require('connect-mongo');

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const employeeRoutes = require('./routes/employee');

const rootDir = path.join(__dirname, '..');
const frontendDist = path.join(rootDir, 'frontend', 'dist');
const frontendIndex = path.join(frontendDist, 'index.html');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

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

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
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
      maxAge: 1000 * 60 * 60 * 8
    }
  })
);

app.use(express.static(frontendDist));

app.get('/', (req, res) => { // Root route redirects by session role.
  const roles = req.session?.roles || {};
  const lastRole = req.session?.lastRole;

  if (lastRole && roles[lastRole]?.userId) {
    return res.redirect(lastRole === 'admin' ? '/admin' : '/employee');
  }
  if (roles.admin?.userId) {
    return res.redirect('/admin');
  }
  if (roles.employee?.userId) {
    return res.redirect('/employee');
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

app.listen(PORT, () => { // Start the HTTP server.
  console.log(`Server running on http://localhost:${PORT}`);
});

