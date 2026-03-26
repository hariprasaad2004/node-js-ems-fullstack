# Employee Management System (EMS)

Fullstack EMS built with Node.js, Express, MongoDB Atlas, and React (Vite).

## Folder Structure
- `frontend/` React app (Vite)
- `frontend/src/` components, pages, and styles
- `frontend/public/` static assets
- `frontend/views/` legacy HTML (kept for reference)
- `backend/` API server
- `backend/routes/` API endpoints
- `backend/models/` MongoDB models
- `backend/middleware/` auth middleware
- `backend/seed.js` seed script

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
5. Go to the frontend folder and install dependencies:
   ```bash
   cd ..\frontend
   npm install
   ```
6. Build the React app:
   ```bash
   npm run build
   ```
7. Start the backend server:
   ```bash
   cd ..\backend
   npm start
   ```
8. Open `http://localhost:3000` and log in.

## Dev (Optional)
1. Start the backend server:
   ```bash
   cd backend
   npm start
   ```
2. Start the React dev server:
   ```bash
   cd ..\frontend
   npm run dev
   ```
3. Open `http://localhost:5173`.

## Notes
- Sessions are stored in memory (fine for development). For production, use a persistent session store.
- Update the temporary admin password after the first login.
- Optional demo employee is seeded from `EMPLOYEE_EMAIL`, `EMPLOYEE_PASSWORD`, and `EMPLOYEE_NAME` in `.env`.
