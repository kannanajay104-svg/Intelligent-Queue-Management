# Queuewise

## Intelligent Queue Management and Real-Time Waiting Time Estimation

Queuewise is a MERN stack application for service environments such as hospitals, banks, offices, and service centers. It gives customers a digital token and a live estimate based on the current queue and service history.

This first implementation uses transparent real-time estimation, not machine learning:

- Current queue state
- Historical completed service durations
- Current service progress
- Socket.IO queue events

## Features

- Customer registration, login, token generation, cancellation, and live queue tracking
- Customer signup phone validation and persisted phone profile data
- Service-center selection at login with center-specific services and queues
- Predefined staff accounts with center-level access across every service in that center
- Staff completed-service history scoped to the authenticated center
- Staff queue view with call, start, and complete transitions
- Server-generated service timestamps and automatic duration calculation
- Admin statistics and active service creation
- JWT authentication, bcrypt password hashing, role-based API authorization
- MongoDB persistence with Mongoose
- Service-specific Socket.IO rooms and `QUEUE_UPDATED` events
- Responsive customer, staff, and admin workspaces

## Technology

React, Vite, React Router-compatible SPA routing, Axios, Socket.IO Client, Node.js, Express, MongoDB, Mongoose, JWT, bcryptjs, and CSS.

## Project Structure

```text
intelligent-queue-management/
  backend/
    config/ models/ middleware/ routes/ utils/ server.js
  frontend/
    src/
      context/ services/ styles/ App.jsx main.jsx
  README.md
  .gitignore
```

## Requirements

- Node.js 18 or newer
- npm
- MongoDB running locally or a MongoDB Atlas connection string

## Setup

Create a backend environment file by copying `backend/.env.example` to `backend/.env`:

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/intelligent_queue
JWT_SECRET=replace_with_a_long_random_secret
CLIENT_URL=http://localhost:5173

# Staff passwords are required only for provisioning and are never stored in plaintext in MongoDB.
STAFF_BANK_USERNAME=staffA
STAFF_BANK_PASSWORD=staffA1
STAFF_CLINIC_USERNAME=staffB
STAFF_CLINIC_PASSWORD=staffB2
STAFF_COLLEGE_USERNAME=staffC
STAFF_COLLEGE_PASSWORD=staffC3
STAFF_GOVERNMENT_USERNAME=staffD
STAFF_GOVERNMENT_PASSWORD=staffD4
STAFF_HOSPITAL_USERNAME=staffE
STAFF_HOSPITAL_PASSWORD=staffE5
STAFF_RAILWAY_USERNAME=staffF
STAFF_RAILWAY_PASSWORD=staffF6
```

Install and run the backend:

```bash
cd intelligent-queue-management/backend
npm install
npm run dev
```

The backend creates six service centers, migrates legacy services/tokens, adds center-specific services, and provisions configured staff accounts without deleting existing data. To run that operation explicitly, use `npm run seed:staff` from `backend`; it is idempotent and does not duplicate center/name or staff username records.

Install and run the frontend in a second terminal:

```bash
cd intelligent-queue-management/frontend
npm install
npm run dev
```

Open `http://localhost:5173`. The API health endpoint is `http://localhost:5000/api/health`.

## Roles and Provisioning

Public registration creates `CUSTOMER` users. Staff never register; the six predefined staff accounts are provisioned by `npm run seed:staff`.

Customers select an active service center during login. The selected center is stored in the signed JWT and restored by `/api/auth/me`; customer service and token requests are restricted to that center. Customer tokens use the selected service's prefix (`H001`, `B001`, and so on).

The seed creates these centers: Bank, Hospital, Government Office, Railway Station, College, and Clinic. Every service references one `ServiceCenter` document, and every new token references both its center and service.

Staff do not register. They use `/staff/login` with `staffA`/`staffA1`, `staffB`/`staffB2`, `staffC`/`staffC3`, `staffD`/`staffD4`, `staffE`/`staffE5`, or `staffF`/`staffF6`. The staff JWT contains the assigned center, and backend queue/action routes use that claim rather than trusting a center ID from the frontend. One staff account manages all services in its center; queue ordering remains service-specific.

## Waiting-Time Calculation

For a waiting customer, the basic estimate is:

```text
Estimated Waiting Time = Customers Ahead × Average Service Duration
```

When a customer is already in service, the calculator replaces one full assigned duration with the remaining portion of the current service. Active queues are broadcast every five seconds while a service is in progress, without writing transient estimates to MongoDB.

The application stores these values separately:

```text
Actual Waiting Time = serviceStartTime - tokenCreatedAt
Actual Service Duration = serviceEndTime - serviceStartTime
```

Completed service durations are averaged per service for the separately labeled actual-service metric. Estimated waiting time uses the service's configured `averageServiceDuration` for each customer ahead, plus only the remaining assigned duration of an in-progress service. If the assigned duration is exceeded, the current token remains in progress and the estimate uses the larger of the assigned duration or historical actual average as its expected total, with a conservative minimum of one minute remaining until staff completes it. Queue position, people ahead, and estimated waiting time are recalculated from current database state after queue mutations and periodic updates.

## Real-Time Updates

The backend attaches Socket.IO to the Express HTTP server. Customers join `service-center:<serviceCenterId>:service:<serviceId>` rooms. After token creation, call, start, completion, skip, or cancellation, the backend rebuilds the queue and emits `QUEUE_UPDATED` only to the matching center/service room.

## API Overview

Auth:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `PATCH /api/auth/me`
- `POST /api/auth/staff/login`

Service centers:

- `GET /api/service-centers`
- `POST /api/service-centers` (admin)

Staff:

- `GET /api/staff/queues`
- `GET /api/staff/history`
- `POST /api/tokens/:id/start`
- `POST /api/tokens/:id/complete`
- `POST /api/tokens/:id/skip`

Services:

- `GET /api/services`
- `POST /api/services` (admin)
- `PUT /api/services/:id` (admin)
- `DELETE /api/services/:id` (admin)

Tokens:

- `POST /api/tokens` (customer)
- `GET /api/tokens/my` (customer)
- `GET /api/tokens/:id`
- `PATCH /api/tokens/:id/cancel` (customer)
- `GET /api/tokens/queue/:serviceId` (staff/admin)
- `POST /api/tokens/:id/call` (staff/admin)
- `POST /api/tokens/:id/start` (staff/admin)
- `POST /api/tokens/:id/complete` (staff/admin)
- `POST /api/tokens/:id/skip` (staff/admin)

Admin:

- `GET /api/admin/users`
- `GET /api/admin/statistics`

Private endpoints use `Authorization: Bearer <jwt>`.

`POST /api/auth/login` requires `serviceCenterId`. `GET /api/services` uses the selected center from the JWT for customers; staff/admin requests may provide `serviceCenterId` explicitly.

Customer signup requires a full name, email, 10-digit phone number, password, and confirm password. It does not create a session or select a service center; customers select an active service center during login. Staff history returns only `COMPLETED` tokens from the authenticated staff member's service center, populated with customer name/phone, service name, server-generated start/end times, and numeric duration.

## Validation Run

- Backend dependency install completed successfully.
- Backend server and queue route syntax checks pass.
- Frontend `npm run build` passes.
- Frontend installation reports four audit findings from the dependency tree; review with `npm audit` before production deployment.

## Known Limitations and Future Enhancements

- MongoDB must be available at runtime; this workspace does not include a hosted database.
- Staff/admin provisioning is intentionally not exposed through public registration.
- Token numbering is readable and backend-generated, but a high-concurrency deployment should use an atomic per-service counter collection.
- Future enhancements can include SMS/email notifications, QR tokens, multiple counters, priority queues, appointments, and an ML model after enough service history has been collected.
