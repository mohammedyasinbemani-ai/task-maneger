# Kanban Task Manager

A modern, full-featured Kanban-style task management application built with **Cloudflare Workers** and **Cloudflare D1** database.

## Features

- 📋 **Kanban Board** with three columns: To Do, In Progress, Done
- 🖱️ **Drag & Drop** support between columns
- ✏️ Add, Edit, and Delete tasks
- 🏷️ Task priority (Low / Medium / High) with color indicators
- 📅 Due date with overdue highlighting
- 🔍 Search and filter tasks by priority
- 📊 Real-time statistics (Total, To Do, In Progress, Done, Overdue)
- 🌐 **Bilingual Support** — English and Persian (with full RTL)
- 🌓 **Dark & Light Theme** with persistence
- 📱 Fully responsive design
- 💾 Data stored persistently in **Cloudflare D1**

## Tech Stack

- **Backend**: Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite)
- **Frontend**: HTML + Tailwind CSS + Vanilla JavaScript
- **Deployment**: Cloudflare Workers

## Project Structure
task-manager/
├── worker.js          # Main file (API + Frontend)
├── wrangler.toml
└── README.md
text## Getting Started

### 1. Create D1 Database

```bash
wrangler d1 create kanban-db
Copy the database_id and add it to wrangler.toml.
2. Deploy
Bashwrangler deploy
Your app will be available at:
texthttps://your-project-name.workers.dev
API Endpoints








































MethodEndpointDescriptionGET/api/tasksGet all tasks (with filters)POST/api/tasksCreate a new taskPUT/api/tasks/:idUpdate a taskDELETE/api/tasks/:idDelete a taskPATCH/api/tasks/reorderReorder tasks (Drag & Drop)GET/api/tasks/statsGet task statistics
Environment Variables















VariableTypeDescriptionDBD1Cloudflare D1 Database Binding
License
MIT License
text
