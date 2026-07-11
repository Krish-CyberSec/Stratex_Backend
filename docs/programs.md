# Programs

Programs belong to schools and own semester generation.

## Implementation

| Type | File |
|---|---|
| Route | `backend/src/routes/program.routes.js` |
| Controller | `backend/src/controllers/acadmicgroups/program.controller.js` |
| Model | `backend/src/models/program.model.js` |
| Semester generation | `backend/src/services/academic/semesterGeneration.service.js` |

## Model

Fields: `name`, `code`, `schoolId`, `description`, `status`, `duration`, `degreeType`, `createdBy`, `updatedBy`.

Unique index:

- `schoolId + name`
- `schoolId + code` when code is present

## Business Rules

- `duration` is years.
- Creating a program generates `duration * 2` semesters.
- Program code can be entered manually. If omitted, backend auto-generates a school-scoped code.
- Specializations do not generate semesters.
- Duration increase creates missing semesters only.
- Duration decrease is rejected when higher semesters have dependent academic data.
- Delete is blocked when dependent semesters, subjects, users, notifications, or specializations exist.

## Endpoints

- `GET /api/programs`
- `GET /api/programs/:id`
- `POST /api/programs`
- `PUT /api/programs/:id`
- `DELETE /api/programs/:id`

See also: [Academic Modules](./academic.md), [API Reference](./api-reference.md).

