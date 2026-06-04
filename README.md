# EcoServ 🌱

A full-stack waste management platform built with **Node.js + Express + MySQL**, with **Groq AI** powering smart recycling features.

---

## Features

- **User / Collector / Admin roles** with JWT-free session via `localStorage`
- **Pickup scheduling** with eco-points rewards
- **Leaderboard, badges, activity log, notifications**
- **AI features** (powered by Groq — free & fast):
  - Waste sorting guide
  - Daily eco fact
  - Environmental impact report
  - Pickup schedule suggestion
  - EcoBot chatbot

---

## Tech Stack

| Layer     | Technology                          |
| --------- | ----------------------------------- |
| Runtime   | Node.js ≥ 18                        |
| Framework | Express 4                           |
| Database  | MySQL 8 (Railway MySQL plugin)      |
| AI        | Groq API (`llama3-8b-8192` default) |
| Frontend  | Vanilla JS + HTML + CSS             |

---

## Quick Start (Local)

```bash
# 1. Clone and install
npm install

# 2. Copy env template and fill in values
cp .env.example .env

# 3. Create the database
mysql -u root -p < database.sql

# 4. Start the server
npm start
# → http://localhost:3000
```

---

## Environment Variables

| Variable       | Required | Description                                 |
| -------------- | -------- | ------------------------------------------- |
| `GROQ_API_KEY` | ✅ Yes   | Get free at https://console.groq.com        |
| `GROQ_MODEL`   | No       | Default: `llama3-8b-8192`                   |
| `DB_HOST`      | ✅ Yes   | MySQL host                                  |
| `DB_USER`      | ✅ Yes   | MySQL user                                  |
| `DB_PASS`      | ✅ Yes   | MySQL password                              |
| `DB_NAME`      | ✅ Yes   | MySQL database name (default: `ecoserv_db`) |
| `DB_PORT`      | No       | MySQL port (default: `3306`)                |
| `PORT`         | No       | HTTP port (Railway sets this automatically) |

---

## Deploying to Railway

### Step 1 — Add MySQL plugin

In your Railway project → **New** → **Database** → **MySQL**.  
Railway injects: `MYSQLHOST`, `MYSQLUSER`, `MYSQLPASSWORD`, `MYSQLDATABASE`, `MYSQLPORT`.

Map them to the names this app expects in **Variables**:

```
DB_HOST     = ${{MySQL.MYSQLHOST}}
DB_USER     = ${{MySQL.MYSQLUSER}}
DB_PASS     = ${{MySQL.MYSQLPASSWORD}}
DB_NAME     = ${{MySQL.MYSQLDATABASE}}
DB_PORT     = ${{MySQL.MYSQLPORT}}
```

### Step 2 — Add Groq API key

In **Variables** add:

```
GROQ_API_KEY = <your key from console.groq.com>
```

### Step 3 — Deploy

Push to GitHub and connect the repo, or use Railway CLI:

```bash
railway up
```

### Step 4 — Seed the database

Run the SQL seed file via the Railway MySQL shell or any MySQL client connected to the Railway instance:

```bash
mysql -h <MYSQLHOST> -P <MYSQLPORT> -u <MYSQLUSER> -p<MYSQLPASSWORD> <MYSQLDATABASE> < database.sql
```

---

## Demo Credentials

| Role      | Email                  | Password   |
| --------- | ---------------------- | ---------- |
| Admin     | admin@ecoserv.com      | admin123   |
| Collector | collector1@ecoserv.com | collect123 |
| Collector | collector2@ecoserv.com | collect123 |
| User      | priya@demo.com         | demo123    |
| User      | rahul@demo.com         | demo123    |

> ⚠️ Change all passwords before any production use.

---

## API Reference

| Method | Endpoint                          | Description                   |
| ------ | --------------------------------- | ----------------------------- |
| POST   | `/api/login`                      | Login                         |
| POST   | `/api/register`                   | Register                      |
| GET    | `/api/profile/:id`                | Get profile                   |
| PUT    | `/api/profile/:id`                | Update profile                |
| GET    | `/api/requests`                   | List requests (role-filtered) |
| POST   | `/api/requests`                   | Create request                |
| PUT    | `/api/requests/:id`               | Update request / assign       |
| DELETE | `/api/requests/:id`               | Delete request                |
| GET    | `/api/leaderboard`                | Top 10 users                  |
| GET    | `/api/analytics/:userId`          | Analytics data                |
| GET    | `/api/badges/:userId`             | User badges                   |
| GET    | `/api/notifications/:userId`      | Notifications                 |
| PUT    | `/api/notifications/read/:userId` | Mark all read                 |
| GET    | `/api/collectors`                 | Active collectors             |
| GET    | `/api/collector/stats/:id`        | Collector stats               |
| GET    | `/api/admin/users`                | All users (admin)             |
| PUT    | `/api/admin/users/:id`            | Update user role/status       |
| DELETE | `/api/admin/users/:id`            | Delete user                   |
| POST   | `/api/ai/sort`                    | AI: waste sorting advice      |
| GET    | `/api/ai/fact`                    | AI: daily eco fact            |
| POST   | `/api/ai/impact`                  | AI: environmental impact      |
| POST   | `/api/ai/chat`                    | AI: EcoBot chatbot            |
| POST   | `/api/ai/schedule`                | AI: pickup schedule tip       |
