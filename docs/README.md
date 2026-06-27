# Stratex ERP Backend Documentation

This documentation is for developers joining the SOET University ERP backend. It describes the backend that exists in this repository today, including routes, models, services, middleware, business rules, frontend integration order, and operational notes.

## What This Backend Does

The backend powers a University ERP with these Phase 1 domains:

- Authentication and password setup
- User management
- Schools
- Programs
- Specializations
- Program-level semesters
- Subjects
- Notices
- Events
- Notifications
- Dashboard summaries
- Audit logs

The backend is a Node.js, Express, MongoDB, and JWT-cookie API. The frontend is expected to call `/api/*` endpoints with credentials enabled so the HTTP-only auth cookie is sent.

## Documentation Index

- [Folder Structure](./folder-structure.md)
- [Architecture](./architecture.md)
- [Authentication](./authentication.md)
- [Users](./users.md)
- [Schools](./schools.md)
- [Programs](./programs.md)
- [Specializations](./specializations.md)
- [Semesters](./semesters.md)
- [Subjects](./subjects.md)
- [Academic Modules](./academic.md)
- [Notifications](./notifications.md)
- [Dashboard](./dashboard.md)
- [Audit](./audit.md)
- [API Reference](./api-reference.md)
- [Frontend Integration](./frontend-integration.md)
- [Deployment](./deployment.md)
- [Developer Guide](./developer-guide.md)
- [FAQ](./faq.md)
- [Postman Collection](./postman-collection.json)

## Quick Start

```bash
cd backend
npm install
npm run dev
```

Required backend environment variables are documented in  [Deployment](./deployment.md).

## Request Lifecycle

```mermaid
flowchart LR
  Client["Frontend"] --> Express["Express app"]
  Express --> CookieParser["cookie-parser"]
  Express --> CORS["CORS credentials"]
  Express --> Audit["audit.middleware"]
  Audit --> Route["/api route"]
  Route --> Auth["auth.middleware chkUser"]
  Auth --> Controller["Controller"]
  Controller --> Service["Service"]
  Service --> Model["Mongoose model"]
  Model --> Mongo[("MongoDB")]
  Controller --> Response["JSON response"]
```

## Core Business Rules

- A `School` owns `Program` records.
- A `Program` owns `duration`.
- Semesters are generated once per program as `duration * 2`.
- A `Semester` belongs to a `Program`.
- A `Specialization` belongs to a `Program` but does not own semesters.
- A `Subject` belongs to `Program + Semester`, and optionally `Specialization`.
- Common subjects have `specializationId: null`.
- Specialization subjects have `specializationId`.
- Students do not store subject IDs; subjects are fetched dynamically.
- Coordinators are faculty users with both roles: `["faculty", "coordinator"]`.
- JWT is stored in the HTTP-only `access_token` cookie.
