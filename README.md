# Employee Management System (EMS)

Fullstack EMS built with Node.js, Express, MongoDB Atlas, and vanilla HTML/CSS/JS.

## Features
- Admin dashboard to create, edit, and delete employees
- Employee self-service dashboard to update personal contact info
- Role-based access control with sessions

## Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Create `.env` from `.env.example` and add your MongoDB Atlas URI:
   ```bash
   copy .env.example .env
   ```
3. Seed an admin account:
   ```bash
   npm run seed
   ```
4. Start the server:
   ```bash
   npm start
   ```
5. Open `http://localhost:3000` and log in.

## Notes
- Sessions are stored in memory (fine for development). For production, use a persistent session store.
- Update the temporary admin password after the first login.
- Optional demo employee is seeded from `EMPLOYEE_EMAIL`, `EMPLOYEE_PASSWORD`, and `EMPLOYEE_NAME` in `.env`.
