# MediBook — Backend API

MediBook is a Node.js & Express REST API for an appointment booking system, utilizing MySQL as the persistent database store.

---

## 📁 Repository Structure

```
.
├── src/
│   ├── config/       # Database connection pool & Swagger config
│   ├── controllers/  # Auth, Doctor, Patient controller logic
│   ├── database/     # DB migration and seeder scripts
│   ├── middleware/   # JWT verification & request validations
│   ├── routes/       # Express router files
│   ├── utils/        # JWT generators & common response structure helpers
│   └── server.js     # Express App entry point
├── .env
├── package.json
└── .github/
    └── workflows/
        └── ci-cd.yml # GitHub Actions pipeline
```

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js 18+
- MySQL 8.0+

### 2. Configure Environment Variables
Create a `.env` file in the root of this folder:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=appointment_booking

JWT_SECRET=appointment_booking_super_secret_jwt_key_2024
JWT_EXPIRES_IN=7d

PORT=5000
NODE_ENV=development
```

### 3. Installation
```bash
npm install
```

### 4. Database Initialization
```bash
# 1. Run migrations (creates tables)
npm run migrate

# 2. Seed database (generates 1000 doctors, 1000 patients, and active slots)
npm run seed
```

### 5. Running the Application
```bash
# Start in development mode (nodemon hot-reload)
npm run dev

# Start in production mode
npm start
```
The server will boot up at **`http://localhost:5000`**.  
Interactive Swagger documentation is available at **`http://localhost:5000/api/docs`**.

---

## 🔌 API Endpoints Reference

### 🔐 Authentication
* `POST /api/auth/login` - Login to account (auto-checks Doctor/Patient profiles)
* `GET /api/auth/me` - Fetch authenticated user credentials & profile details

### 🩺 Doctor Directory (Public)
* `GET /api/doctors` - Search doctors by name, specialization, or date
* `GET /api/doctors/specializations` - Retrieve list of all available specializations
* `GET /api/doctors/:id` - Fetch detailed doctor profile
* `GET /api/doctors/:id/slots` - Retrieve slots database query for a doctor

### 👨‍⚕️ Doctor Dashboard
* `GET /api/doctors/me/appointments` - Fetch booked patient list
* `POST /api/doctors/me/slots` - Create active availability slots (accepts single or bulk array)
* `PUT /api/doctors/me/slots/:slotId` - Modify time/active state of a slot
* `DELETE /api/doctors/me/slots/:slotId` - Remove slot
* `PUT /api/doctors/me/appointments/:id/status` - Confirm, cancel, or complete appointments

### 🧑‍💼 Patient Dashboard
* `POST /api/patients/appointments` - Book an availability slot (uses transaction locks to prevent concurrency race conditions)
* `GET /api/patients/appointments` - View all booked appointments
* `GET /api/patients/appointments/:id` - View detailed appointment sheet
* `PUT /api/patients/appointments/:id/cancel` - Cancel a scheduled appointment

---

## 🛠️ CI/CD Pipeline
Continuous integration and deployment are handled via GitHub Actions:
* **CI Phase**: Runs syntax checking, builds the project, and executes package validation tests on every pull request and commit to `main`.
* **CD Phase**: Set up credentials under GitHub secrets (`DOCKER_USERNAME`, `DOCKER_PASSWORD`, `SERVER_HOST`, `SSH_PRIVATE_KEY`) to build Docker images and auto-deploy changes.
