# Employee Management System (EMS)

Fullstack EMS built with Node.js, Express, MongoDB Atlas, and vanilla HTML/CSS/JS.

## Folder Structure
- frontend/
  - views/ (HTML)
  - public/ (CSS/JS/assets)
- backend/
  - server.js
  - routes/
  - models/
  - middleware/
  - seed.js
  - package.json

## Features
- Admin dashboard to create, edit, and delete employees
- Employee self-service dashboard to update personal contact info
- Role-based access control with sessions

## Setup
1. Go to the backend folder:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create `.env` from `.env.example` (if you have one) and add your MongoDB Atlas URI:
   ```bash
   copy .env.example .env
   ```
4. Seed an admin account:
   ```bash
   npm run seed
   ```
5. Start the server:
   ```bash
   npm start
   ```
6. Open `http://localhost:3000` and log in.

## Notes
- Sessions are stored in memory (fine for development). For production, use a persistent session store.
- Update the temporary admin password after the first login.
- Optional demo employee is seeded from `EMPLOYEE_EMAIL`, `EMPLOYEE_PASSWORD`, and `EMPLOYEE_NAME` in `.env`.
