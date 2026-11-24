# Online Hospital Appointment Management System Using DFA

A full-stack appointment management application that models appointment status changes with a deterministic, role-checked finite-state transition engine.

## Overview

Patients can find doctors and request appointments. Doctors and administrators can review appointments and apply permitted state transitions. The application records each transition in an appointment-history collection.

### Technology stack

| Layer | Technologies |
| --- | --- |
| Frontend | React 18, Vite 5, React Router 6, Axios |
| Backend | Node.js, Express 4 |
| Persistence | MongoDB with Mongoose 8 |
| Development and tests | Local JSON-backed Mongoose-compatible adapter, Node.js test runner |
| Hosting configuration | GitHub Actions for Pages; Render configuration is supplied through environment variables |

## Architecture

```text
Browser (React)
  └── Axios API client
       └── Express REST API (/api)
            ├── Authentication and role middleware
            ├── Appointment DFA engine
            └── Mongoose models
                 └── MongoDB Atlas
```

In local development, Vite proxies `/api` requests to `http://localhost:5050`. For GitHub Pages, the Pages workflow sets the API base URL during the build. The backend serves `frontend/dist` when that directory exists.

## Formal DFA specification

The appointment lifecycle is represented by the 5-tuple:

**M = (Q, Σ, δ, q₀, F)**

| Symbol | Definition |
| --- | --- |
| **Q** | `{REQUESTED, CONFIRMED, RESCHEDULED, CANCELLED, REJECTED, COMPLETED}` |
| **Σ** | `{APPROVE, RESCHEDULE, CANCEL, REJECT, COMPLETE}` |
| **q₀** | `REQUESTED` |
| **F** | `{CANCELLED, REJECTED, COMPLETED}` |
| **δ** | The partial transition function defined by the table below |

Only the state/event pairs listed below are defined. The application rejects unlisted pairs; it does not map them to a separate sink state.

### Transition function

| Current state | Event | Next state | Permitted roles |
| --- | --- | --- | --- |
| `REQUESTED` | `APPROVE` | `CONFIRMED` | Doctor, Administrator |
| `REQUESTED` | `REJECT` | `REJECTED` | Doctor, Administrator |
| `REQUESTED` | `RESCHEDULE` | `RESCHEDULED` | Patient, Doctor, Administrator |
| `REQUESTED` | `CANCEL` | `CANCELLED` | Patient, Administrator |
| `CONFIRMED` | `RESCHEDULE` | `RESCHEDULED` | Patient, Doctor, Administrator |
| `CONFIRMED` | `CANCEL` | `CANCELLED` | Patient, Doctor, Administrator |
| `CONFIRMED` | `COMPLETE` | `COMPLETED` | Doctor, Administrator |
| `RESCHEDULED` | `APPROVE` | `CONFIRMED` | Doctor, Administrator |
| `RESCHEDULED` | `REJECT` | `REJECTED` | Doctor, Administrator |
| `RESCHEDULED` | `RESCHEDULE` | `RESCHEDULED` | Patient, Doctor, Administrator |
| `RESCHEDULED` | `CANCEL` | `CANCELLED` | Patient, Doctor, Administrator |

### State and error behavior

- `REQUESTED` is the initial state for a newly booked appointment.
- `CONFIRMED` indicates that the appointment was approved.
- `RESCHEDULED` indicates that the appointment slot was changed and is pending a subsequent approval or rejection.
- `CANCELLED`, `REJECTED`, and `COMPLETED` are terminal states. No further transitions are allowed from them.
- An unknown state or event, an undefined transition, or an attempt to transition from a terminal state returns HTTP `409 Conflict`.
- A valid transition requested by a role that is not permitted returns HTTP `403 Forbidden`.
- Directly changing an appointment's `status` through an ordinary update is rejected; status changes must go through the DFA transition handler.

## Application features

- Patient registration, login, logout, and profile updates.
- Public doctor directory, doctor details, and available-slot lookup.
- Appointment booking, rescheduling, cancellation, and history.
- Doctor and administrator appointment dashboards.
- Administrator overview and doctor-account creation.
- DFA visualization and role-aware allowed-transition information.
- JWT authentication, account/role checks, transition audit history, and optimistic concurrency checks.
- Server-side checks for appointment slots and active double-booking.

## Roles and permissions

| Role | Main capabilities |
| --- | --- |
| Patient | Register and manage a profile, find doctors, book appointments, view own appointments, and request permitted reschedules or cancellations. |
| Doctor | Manage own availability and review assigned appointments; may perform permitted approve, reject, reschedule, cancel, or complete transitions. |
| Administrator | View the administrative overview, create doctor accounts, and perform transitions permitted to administrators. |

The transition table is authoritative for state-specific permissions. For example, doctors cannot cancel a `REQUESTED` appointment, even though they can cancel a `CONFIRMED` or `RESCHEDULED` appointment.

## Backend API

All endpoints are prefixed with `/api`. Protected routes accept a bearer JWT; the backend also supports the `hospital_jwt` session cookie.

### Health and DFA

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/health` | Public | Reports service status and database connection state. |
| `GET` | `/api/dfa/definition` | Public | Returns the DFA states, alphabet, and defined transitions. |

### Authentication

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/auth/register` | Public | Registers a patient; a client-supplied role is not trusted. |
| `POST` | `/api/auth/login` | Public | Authenticates a user and returns a session token. |
| `POST` | `/api/auth/logout` | Authenticated | Invalidates the current token in the running process and clears the session cookie. |
| `GET` | `/api/auth/me` | Authenticated | Returns the authenticated user's profile. |
| `PUT` | `/api/auth/profile` | Authenticated | Updates the authenticated user's profile. |

### Doctors

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/doctors` | Public | Lists doctors. |
| `GET` | `/api/doctors/:id` | Public | Returns a doctor profile. |
| `GET` | `/api/doctors/:id/slots` | Public | Returns available appointment slots. |
| `PUT` | `/api/doctors/:id/availability` | Doctor or Administrator | Updates doctor availability. |

### Appointments

All appointment routes require authentication. Appointment lists and individual records are scoped by the authenticated user's permissions.

| Method | Path | Additional access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/appointments` | Patient or Administrator | Books an appointment; new appointments start in `REQUESTED`. |
| `GET` | `/api/appointments` | Authenticated | Lists appointments visible to the user. |
| `GET` | `/api/appointments/:id` | Authenticated | Returns an appointment. |
| `GET` | `/api/appointments/:id/history` | Authenticated | Returns its transition history. |
| `POST` | `/api/appointments/:id/transition` | Authenticated | Applies the event in the JSON body's `event` field. |
| `PATCH` | `/api/appointments/:id/approve` | Doctor or Administrator | Applies `APPROVE`. |
| `PATCH` | `/api/appointments/:id/reject` | Doctor or Administrator | Applies `REJECT`. |
| `PATCH` | `/api/appointments/:id/reschedule` | Patient, Doctor, or Administrator | Applies `RESCHEDULE`; requires `appointmentDate` and `timeSlot`. |
| `PATCH` | `/api/appointments/:id/cancel` | Patient, Doctor, or Administrator | Applies `CANCEL`, subject to the DFA's state-specific role rules. |
| `PATCH` | `/api/appointments/:id/complete` | Doctor or Administrator | Applies `COMPLETE`. |
| `PUT`, `PATCH` | `/api/appointments/:id` | Authenticated | Direct appointment updates are rejected to prevent status bypass. |

### Administration

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/admin/overview` | Administrator | Returns system overview data. |
| `POST` | `/api/admin/doctors` | Administrator | Creates a doctor account and profile. |

Errors are returned as JSON. Invalid or terminal DFA transitions use `409`; unauthenticated requests use `401`; role/ownership failures use `403`; and missing resources use `404`.

## Database structure

Mongoose stores the following model collections:

| Collection | Model | Contents |
| --- | --- | --- |
| `users` | `User` | Name, unique email, password hash, role, contact/profile fields, and active status. Password hashes are excluded from normal query results. |
| `doctors` | `Doctor` | User reference, specialization, department, qualifications, experience, fees, schedule, slots, blocked dates, and availability. |
| `appointments` | `Appointment` | Appointment code, patient/doctor references, date, time slot, reason, DFA status, last event, reschedule count, and version. |
| `appointmenthistories` | `AppointmentHistory` | Appointment reference, previous and next states, event, actor, reason, slot snapshot, and version. |

The appointment model uses a partial unique index on doctor, date, and time for active states (`REQUESTED`, `CONFIRMED`, `RESCHEDULED`) to prevent double-booking. History records provide an audit trail for state transitions.

## Configuration

### Backend environment

Create `backend/.env` from `backend/.env.example` and set values locally. In Render, configure these in the service's Environment settings instead; do not commit `.env`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `MONGODB_URI` | Yes for Atlas | Full MongoDB connection URI from the Atlas driver connection dialog. URL-encode special characters in the username and password. |
| `USE_LOCAL_DB` | No | Set to `false` for MongoDB; set to `true` only when intentionally using the local JSON adapter. |
| `JWT_SECRET` | Yes | Random secret of at least 32 characters. Keep it private. |
| `PORT` | No | HTTP port; defaults to `5050`. Render provides this automatically. |
| `NODE_ENV` | No | Runtime mode; use `production` on Render. |
| `JWT_EXPIRES_IN` | No | Token lifetime; defaults to `4h`. |
| `CORS_ORIGIN` | No | Comma-separated allowed origins, such as the GitHub Pages origin and local development origins. |
| `RATE_LIMIT_WINDOW_MS` | No | Rate-limit window; defaults to 15 minutes. |
| `RATE_LIMIT_MAX_REQUESTS` | No | General API request limit; defaults to `500`. |
| `AUTH_RATE_LIMIT_MAX` | No | Authentication request limit; defaults to `50`. |

Do not use the example URI or placeholder JWT secret in production. The application must connect to its configured database before it begins listening for HTTP requests.

### Frontend environment

Vite reads `frontend/.env`, not `backend/.env`.

| Variable | Purpose |
| --- | --- |
| `VITE_API_URL` | Backend origin for a deployed frontend. The Axios client adds `/api` unless it is already present. Leave empty for local Vite development, which uses the `/api` proxy. |
| `VITE_BASE_PATH` | Optional Vite base path; the GitHub Pages workflow sets it from the repository name. |

## Local development

1. Install backend dependencies and configure `backend/.env`.
2. For local JSON-backed development, set `USE_LOCAL_DB=true`. For Atlas, set it to `false` and provide a valid `MONGODB_URI`.
3. Start the backend:

   ```sh
   cd backend
   npm ci
   npm start
   ```

4. In a second terminal, start the frontend:

   ```sh
   cd frontend
   npm ci
   npm run dev
   ```

The frontend is served at `http://localhost:5173`; Vite proxies `/api` to the backend at `http://localhost:5050`.

### Seed data warning

Normal server startup calls the seed utility without resetting existing data; it seeds demo records only when the seeded administrator is absent. **The standalone `npm run seed` command uses `forceReset: true` and deletes existing appointment-history, appointment, doctor, and user records before reseeding. Never run it against a database whose records must be preserved.**

The sample development accounts created by the seed utility use the password `Hospital@123`:

| Role | Email |
| --- | --- |
| Patient | `aravind.patient@aegishealth.org` |
| Patient | `priya.patient@aegishealth.org` |
| Doctor | `ananya.cardio@aegishealth.org` |
| Doctor | `rajeshwar.neuro@aegishealth.org` |
| Doctor | `meenakshi.ortho@aegishealth.org` |
| Doctor | `karthik.general@aegishealth.org` |
| Administrator | `admin@aegishealth.org` |

These are demo credentials only. Do not retain them in a production deployment.

## Deployment

### GitHub Pages frontend

The intended Pages URL for this repository is `https://hariss-12.github.io/hospitalmanagementsystem/`. In repository settings, set **Pages → Build and deployment → Source** to **GitHub Actions**. The workflow builds `frontend/dist`, sets the repository-specific Vite base path, copies `index.html` to `404.html` for SPA route fallback, and deploys that artifact.

Set the GitHub Actions repository variable `RENDER_SERVICE_URL` to the **verified** backend origin (for example, the service's Render origin, without `/api`). The workflow passes it to Vite as `VITE_API_URL`. A Render URL is not hard-coded here because the available service URLs have not been verified to expose this application's API.

### Render backend

The repository is a monorepo. For one Render Web Service that serves both the frontend build and API, use:

| Render setting | Value |
| --- | --- |
| Root Directory | Leave blank (repository root) |
| Build Command | `npm ci --prefix backend && npm ci --prefix frontend && npm run build --prefix frontend` |
| Start Command | `npm start --prefix backend` |

Configure `MONGODB_URI`, `USE_LOCAL_DB=false`, `JWT_SECRET`, `NODE_ENV=production`, and `CORS_ORIGIN` in the Render service environment. Include `https://hariss-12.github.io` as an allowed origin when using the Pages frontend; the origin does not include the repository path. Render supplies `PORT`.

For automated deployment, set the GitHub Actions repository variable `RENDER_SERVICE_URL` to the verified Render origin and the repository secret `RENDER_DEPLOY_HOOK_URL` to that service's deploy hook. The deployment workflow checks `/api/health` and requires `database.connected` to be `true`.

### Deployment verification

Do not treat an HTTP 200 from a generic health page as proof that the correct backend is deployed. Verify that:

1. `GET ${RENDER_SERVICE_URL}/api/health` returns the Hospital DFA service response, including `success: true` and `database.connected: true`.
2. `GET ${RENDER_SERVICE_URL}/api/doctors` returns the doctor-list API response rather than a 404.
3. `GET ${RENDER_SERVICE_URL}/api/dfa/definition` returns this project's DFA definition.
4. Protected authentication, appointment, and admin routes return their expected JSON status codes.
5. The GitHub Pages URL serves the React application, and browser network requests target the verified Render origin.

At the time this documentation was revised, no Render hostname could be verified as serving all of these routes. The service URL must be checked in Render before setting `RENDER_SERVICE_URL`; do not copy a hostname from an older deployment or another project.

## Testing

Run backend tests:

```sh
cd backend
npm test
```

The suite covers DFA unit tests, authentication, appointment integration, security checks, and end-to-end appointment lifecycle scenarios. Test runs use the test database adapter and do not verify a production Atlas deployment.

Build the frontend:

```sh
cd frontend
npm run build
```

The GitHub Pages workflow supplies `VITE_API_URL` and `VITE_BASE_PATH` during its production build.
