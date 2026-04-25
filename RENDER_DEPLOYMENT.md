# Render Deployment

This repo is configured for Render with `render.yaml`:

- `skillconnect-api`: Dockerized Spring Boot backend from `backend/`
- `skillconnect-frontend`: Vite React static site from `frontend/`
- `skillconnect-db`: Render Postgres database managed by the Blueprint

## Database

The Blueprint now provisions a Render Postgres database and wires the backend to it automatically.

The backend still supports local MySQL development. In Render, the container converts Render's Postgres connection string into a JDBC URL at startup.

## Deploy Steps

1. Push this repository to GitHub.
2. In Render, choose `New` > `Blueprint`.
3. Connect the repository and select `render.yaml`.
4. Let Render create or sync `skillconnect-api`, `skillconnect-frontend`, and `skillconnect-db`.
5. After deployment, verify:
   - Backend health: `https://skillconnect-api.onrender.com/actuator/health`
   - Frontend: `https://skillconnect-frontend.onrender.com`

If Render changes either service URL because the name is already taken, update:

- `VITE_API_BASE_URL` on `skillconnect-frontend`
- `CORS_ALLOWED_ORIGINS` on `skillconnect-api`
