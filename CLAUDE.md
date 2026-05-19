# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a multi-service IT project sizing application for Vietnam Telecom. Three services: Java/Spring Boot backend (port 8081), vanilla HTML/JS frontend, and an admin dashboard (HTML/JS).

## Build & Run

### Backend
```bash
cd backend1
mvn clean install -DskipTests=true     # Build
mvn spring-boot:run                     # Run locally (requires MySQL)
```

### Full Stack (Docker)
```bash
docker compose up -d --build backend    # Build & start backend
docker compose up -d --build nginx      # Build & start frontend proxy
```

## Architecture

- **Nginx** (port 80) acts as reverse proxy: `/` → frontend, `/dashboard/` → dashboard, `/api/` → backend
- **Backend** exposes REST API with JWT authentication. Controllers live in `backend1/src/main/java/com/example/sizing/controller/`
- **Frontend** uses hash-based routing (`#/projects`, `#/project/{id}/{tab}`) with localStorage for session state
- **Database**: MySQL with Flyway migrations in `backend1/src/main/resources/db/migration/`

## Database Conventions

- **Never modify existing Flyway migration files** (V1, V2, V3). Add new migration files (V4, V5, etc.) for schema changes.
- Database uses MariaDB dialect
- If adding columns/tables, create a new migration: `V{n}__description.sql`

## Authentication Model

JWT-based stateless auth. Three roles:
- `admin2` — full access including user management
- `admin1` — can see and review assigned projects
- `user` — can only see own projects

JWT secret and default users are in `backend1/.env` (do not commit this file).

## CI/CD

Jenkins pipeline (`Jenkinsfile`):
- Changes to `backend1/**` → Maven build + deploy backend container
- Changes to `frontend/**`, `dashboard/**`, `nginx/**` → rebuild nginx container
- Docker-based builds using `maven:3.9-eclipse-temurin-21-alpine` image

## Project Structure

```
sizing/
├── backend1/                      # Java Spring Boot application
│   ├── src/main/java/com/example/sizing/
│   │   ├── config/                # Configuration (CORS, Security, etc.)
│   │   ├── controller/            # REST API controllers
│   │   ├── dto/                   # Data Transfer Objects
│   │   ├── exception/             # Exception handling
│   │   ├── model/                 # JPA entities
│   │   ├── repository/            # Spring Data repositories
│   │   ├── security/              # JWT authentication & filters
│   │   └── service/               # Business logic services
│   ├── src/main/resources/
│   │   ├── application.yaml       # Spring Boot configuration
│   │   └── db/migration/          # Flyway SQL migrations (V1__ to V3__)
│   ├── src/test/                  # Unit tests
│   ├── pom.xml                    # Maven build file
│   └── Dockerfile
│
├── frontend/                      # Main user-facing application
│   ├── index.html                 # Main SPA entry
│   ├── login.html                 # Login page
│   ├── script.js                  # Main application logic
│   └── style.css                  # Styles
│
├── dashboard/                     # Admin dashboard
│   ├── index.html                 # Dashboard entry
│   ├── login.html                 # Admin login
│   └── js/                        # Dashboard modules (api.js, auth.js, etc.)
│
├── nginx/                         # Reverse proxy
│   ├── nginx.conf                 # Nginx routing configuration
│   └── Dockerfile
│
├── docker-compose.yml             # Container orchestration
├── Jenkinsfile                    # CI/CD pipeline
└── CLAUDE.md                      # This file
```

## Key Constraints

- `backend1/.env` contains secrets — never commit it
- No automated linting/formatting tools are configured — follow existing code patterns
- No `.env.example` exists — copy from existing `.env` and fill in values