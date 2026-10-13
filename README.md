# 🎓 ProjectNest - Student Project Management Portal

> **Level 1–2 Portfolio-Grade Full-Stack Web Application**  
> A collaborative academic workspace where students create capstone projects, manage sprint deliverables on an interactive Kanban board, track progress velocity with dynamic analytics, and receive formal mentorship evaluations.

---

## 🌟 Highlights & Key Features

- **🎨 Unique & Creative UI with Dark & Light Themes**: Curated modern aesthetics with glassmorphic cards, glowing accents, and smooth micro-animations. Persists theme choices across sessions.
- **📋 4-Stage Interactive Kanban Board**: Drag-and-drop or click-to-move sprint tasks across `To Do`, `In Progress`, `Under Review`, and `Completed`.
- **📊 Real-time Progress Charts & Analytics**: Custom Canvas-rendered donut status breakdowns and project milestone velocity charts.
- **🎖️ Academic Mentorship & Evaluation System**: Dedicated faculty evaluation badges and comment threads with mentor feedback markers.
- **🛡️ Role-Based Access Control (RBAC)**: Distinct permissions for **Students**, **Faculty Mentors**, and **Portal Administrators**.
- **⚡ 1-Click Instant Demo Personas**: Pre-configured test accounts (Student, Mentor, Admin) to instantly test the platform without filling forms.
- **🗄️ Relational Database Engine**: Native **PostgreSQL** schema (`database/schema.sql` and `database/seeds.sql`) with zero-config local relational fallback for instant run.
- **🔍 Real-Time Search & Status Filters**: Instant filtering by status (Planning, In Progress, Review, Completed) and academic field categories.

---

## 🛠️ Technology Stack

| Layer | Technologies Used | Description |
| :--- | :--- | :--- |
| **Frontend** | HTML5, Vanilla CSS3 (Custom Design System), JavaScript (ES6+) | Single-Page Application (SPA) architecture, Canvas charts, drag-and-drop API, responsive layouts. |
| **Backend** | Node.js, Express 5, RESTful API | JWT authentication, bcrypt password hashing, input validation, role-based authorization middleware. |
| **Database** | PostgreSQL & Relational Database Layer | Normalized relational tables with foreign keys, cascading deletes, indexes, and automated seeders. |
| **Tooling & VCS** | Git, npm, dotenv, Morgan | Version control, environment separation, HTTP request logging. |

---

## 📐 Relational Database Schema

```mermaid
erDiagram
    USERS ||--o{ PROJECTS : "creates"
    USERS ||--o{ PROJECTS : "mentors"
    USERS ||--o{ PROJECT_MEMBERS : "joins"
    PROJECTS ||--o{ PROJECT_MEMBERS : "has"
    PROJECTS ||--o{ TASKS : "contains"
    USERS ||--o{ TASKS : "assigned_to"
    TASKS ||--o{ COMMENTS : "has"
    USERS ||--o{ COMMENTS : "writes"
    PROJECTS ||--o{ ACTIVITY_LOGS : "records"

    USERS {
        int id PK
        string name
        string email UK
        string password_hash
        string role "student | mentor | admin"
        string department
        string avatar_url
        timestamp created_at
    }

    PROJECTS {
        int id PK
        string title
        text description
        string category
        string status "planning | in_progress | review | completed | on_hold"
        int mentor_id FK
        int created_by FK
        date due_date
        timestamp created_at
    }

    PROJECT_MEMBERS {
        int id PK
        int project_id FK
        int user_id FK
        string role_in_project
        timestamp joined_at
    }

    TASKS {
        int id PK
        int project_id FK
        string title
        text description
        string status "todo | in_progress | review | done"
        string priority "low | medium | high | urgent"
        int assigned_to FK
        int created_by FK
        date due_date
        numeric estimated_hours
        numeric actual_hours
        int position
        timestamp updated_at
    }

    COMMENTS {
        int id PK
        int task_id FK
        int project_id FK
        int user_id FK
        text content
        boolean is_mentor_feedback
        timestamp created_at
    }

    ACTIVITY_LOGS {
        int id PK
        int project_id FK
        int user_id FK
        string action_type
        text description
        timestamp created_at
    }
```

---

## 👥 Role Permissions Matrix

| Capability | Student 🎓 | Faculty Mentor 🧑‍🏫 | Administrator 🛡️ |
| :--- | :---: | :---: | :---: |
| **Create & Edit Projects** | ✅ Own Projects | ✅ Mentored Projects | ✅ All Projects |
| **Manage & Move Tasks** | ✅ Assigned Tasks | ✅ All Project Tasks | ✅ Full Access |
| **Post Discussion Comments** | ✅ Standard Comments | ✅ Comments + Official Mentor Evaluations | ✅ Full Access |
| **Evaluate Milestone Deliverables** | ❌ | ✅ Official Academic Review | ✅ Full Access |
| **Manage User Accounts & Roles** | ❌ | ❌ | ✅ Promote / Demote Roles |
| **Inspect System Audit Logs** | ❌ | ❌ | ✅ View Platform Activity |

---

## 🔑 Pre-Seeded Demo Accounts

To quickly test each persona, use the **1-Click Demo Evaluation** buttons on the sign-in screen, or use these credentials:

| Persona | Name | Email | Password |
| :--- | :--- | :--- | :--- |
| **Student (Lead)** | Alex Rivera | `alex.student@campus.edu` | `Password123!` |
| **Student (Contributor)** | Priya Patel | `priya.student@campus.edu` | `Password123!` |
| **Faculty Mentor** | Dr. Marcus Chen | `dr.chen@campus.edu` | `Password123!` |
| **Faculty Mentor** | Prof. Elena Rostova | `elena.mentor@campus.edu` | `Password123!` |
| **Administrator** | Sarah Jenkins | `admin@campus.edu` | `Password123!` |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v18+ or v22+)
- **npm** (v9+)
- *(Optional)* **PostgreSQL** (v14+) — if PostgreSQL is not installed or running, the portal automatically operates in zero-configuration local relational database mode.

### 1. Installation
Clone the repository and install dependencies:
```bash
git clone <your-repo-url>
cd studentp
npm install
```

### 2. Environment Configuration
Copy the template configuration file:
```bash
cp .env.example .env
```
Default `.env` settings:
```ini
PORT=3000
NODE_ENV=development
JWT_SECRET=super_secret_student_portal_jwt_key_2026_secure
JWT_EXPIRES_IN=7d
DB_TYPE=postgres
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/studentp_db
SQLITE_DB_PATH=./data/studentp.db
```

### 3. Database Initialization & Seeding
Initialize schema and seed initial sample capstone projects:
```bash
npm run seed
```

### 4. Running the Application
Start the server:
```bash
npm start
```
For automatic file reloading during development:
```bash
npm run dev
```

Open your browser and navigate to:  
👉 **`http://localhost:3000`**

### 5. Running Automated Tests
Execute the end-to-end integration test suites:
```bash
# Test Faculty Mentor Dashboard & Supervision Workflows
node test-mentor-workflows.js

# Test Role-Based Scoping & Data Isolation
node test-role-scoping.js

# Test Full End-to-End Suite
node test-e2e.js
```

---

## 🧑‍🏫 Faculty Mentor Supervision Hub

ProjectNest includes a dedicated workspace tailored specifically for Faculty Advisors and Capstone Mentors:

1. **Assigned Students Directory**: View all students enrolled across your mentored projects, inspect their individual task completion velocities, and message or assign tasks directly.
2. **Mentored Projects Overview**: Track milestone progress percentages, lead student creators, deadlines, and direct Kanban access.
3. **Task Assignment Workflow**: Create and directly assign new tasks and technical deliverables to students on your mentored projects.
4. **Deliverables Review Queue**: Specialized queue for all tasks submitted into `Under Review` status. Mentors can **Approve & Mark Done** (with rubric grades/commendations) or **Request Revisions** (with actionable feedback).
5. **Academic Feedback & Communication Hub**: Broadcast announcements, office hours notices, or project advice directly to student teams, visible on project discussion streams and activity logs.

---

## 📡 REST API Reference

### Authentication
- `POST /api/auth/register` — Create a new student or mentor account.
- `POST /api/auth/login` — Authenticate and receive a JWT token.
- `GET /api/auth/me` — Retrieve the currently authenticated user session.
- `GET /api/auth/demo-accounts` — List pre-seeded demo user profiles.

### Faculty Mentor Workflows (`/api/mentor`)
- `GET /api/mentor/overview` — Aggregated KPI stats, mentored projects, assigned students, and review queue.
- `GET /api/mentor/tasks` — Filterable consolidated task tracker across all mentored projects and students.
- `POST /api/mentor/assign-task` — Create and assign a task to a student on a mentored project.
- `POST /api/mentor/review-task` — Evaluate student deliverable (`approve` or `request_revision`) with rubric scores.
- `POST /api/mentor/communicate` — Broadcast guidance or send mentorship advice to a student or project team.

### Projects
- `GET /api/projects` — Query projects with filters (`status`, `category`, `search`).
- `GET /api/projects/:id` — Detailed project metadata, tasks grouped by status, and members.
- `POST /api/projects` — Create a new project (requires student, mentor, or admin).
- `PUT /api/projects/:id` — Update project details and status.
- `DELETE /api/projects/:id` — Remove project (creator or admin).
- `POST /api/projects/:id/members` — Add team members to a project.

### Tasks & Kanban
- `GET /api/tasks?project_id=:id` — Get tasks for a given project.
- `GET /api/tasks/:id` — Retrieve task details and comment threads.
- `POST /api/tasks` — Create a task within a project.
- `PUT /api/tasks/:id` — Update task details, priority, and assignees.
- `PATCH /api/tasks/:id/status` — Quick status transition for Kanban movement (`todo`, `in_progress`, `review`, `done`).
- `DELETE /api/tasks/:id` — Delete a task.

### Comments & Mentorship Feedback
- `GET /api/comments/task/:taskId` — Retrieve task comments and feedback.
- `POST /api/comments` — Post a comment (flagged as `is_mentor_feedback` when submitted by faculty).
- `DELETE /api/comments/:id` — Delete a comment (author or admin).

### Admin Console
- `GET /api/admin/users` — Directory of all users with project & task metrics.
- `PATCH /api/admin/users/:id/role` — Update user role (`student`, `mentor`, `admin`).
- `GET /api/admin/stats` — Platform-wide analytics.
- `GET /api/admin/activities` — System audit logs.

---

## 🚢 Deployment Guide

### Deploying with PostgreSQL (Production)
1. Provision a PostgreSQL database (e.g., Supabase, Neon, Render, AWS RDS, or local PostgreSQL).
2. Set the connection string in your `.env` or production environment variables:
   ```env
   DB_TYPE=postgres
   DATABASE_URL=postgresql://user:password@hostname:5432/dbname
   ```
3. Run the PostgreSQL schema and seed script:
   ```bash
   psql -d <dbname> -f src/database/schema.sql
   psql -d <dbname> -f src/database/seeds.sql
   ```
4. Start the application:
   ```bash
   NODE_ENV=production npm start
   ```

---

## 📄 License
This project is open-source under the MIT License.
