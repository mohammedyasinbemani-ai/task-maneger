// ============================================================================
// Kanban Task Manager — Single-File Cloudflare Worker
// Backend API + Frontend SPA all in one file.
// Uses Cloudflare D1 for persistent storage.
// ============================================================================

const SCHEMA = `
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'todo'
    CHECK(status IN ('todo', 'in_progress', 'done')),
  priority TEXT NOT NULL DEFAULT 'medium'
    CHECK(priority IN ('low', 'medium', 'high')),
  due_date TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_position ON tasks(status, position);
`;

const HTML = `<!DOCTYPE html>
<html lang="en" dir="ltr" data-theme="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Task Manager</title>
  <script src="https://cdn.tailwindcss.com"><\/script>
  <script>
    tailwind.config = {
      darkMode: ['selector', '[data-theme="dark"]'],
    };
  <\/script>
  <style>
    /* ===== Theme tokens ===== */
    :root, [data-theme="dark"] {
      --bg-primary: #0f172a;
      --bg-secondary: #1e293b;
      --bg-card: #334155;
      --bg-card-hover: #3e4f6a;
      --text-primary: #f1f5f9;
      --text-secondary: #94a3b8;
      --border: #475569;
      --accent: #3b82f6;
      --accent-hover: #2563eb;
      --danger: #ef4444;
      --danger-hover: #dc2626;
      --success: #22c55e;
      --warning: #eab308;
      --column-bg: #1e293b80;
      --overlay: rgba(0, 0, 0, 0.6);
    }
    [data-theme="light"] {
      --bg-primary: #f1f5f9;
      --bg-secondary: #ffffff;
      --bg-card: #ffffff;
      --bg-card-hover: #f8fafc;
      --text-primary: #0f172a;
      --text-secondary: #64748b;
      --border: #e2e8f0;
      --accent: #2563eb;
      --accent-hover: #1d4ed8;
      --danger: #ef4444;
      --danger-hover: #dc2626;
      --success: #22c55e;
      --warning: #eab308;
      --column-bg: #e2e8f060;
      --overlay: rgba(0, 0, 0, 0.3);
    }
    body {
      background-color: var(--bg-primary);
      color: var(--text-primary);
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      transition: background-color 0.2s, color 0.2s;
      min-height: 100vh;
    }
    .card { background: var(--bg-card); border: 1px solid var(--border); }
    .card:hover { background: var(--bg-card-hover); }
    .column-bg { background: var(--column-bg); }
    .drag-over {
      outline: 2px dashed var(--accent);
      outline-offset: -2px;
      background: color-mix(in srgb, var(--accent) 8%, transparent) !important;
    }
    .dragging { opacity: 0.4; transform: rotate(2deg); }
    .drop-placeholder {
      height: 4px;
      background: var(--accent);
      border-radius: 2px;
      margin: 4px 0;
      transition: opacity 0.15s;
    }
    .priority-low    { border-left: 3px solid var(--success); }
    .priority-medium { border-left: 3px solid var(--warning); }
    .priority-high   { border-left: 3px solid var(--danger); }
    [dir="rtl"] .priority-low,
    [dir="rtl"] .priority-medium,
    [dir="rtl"] .priority-high {
      border-left: none;
      border-right: 3px solid;
    }
    [dir="rtl"] .priority-low    { border-right-color: var(--success); }
    [dir="rtl"] .priority-medium { border-right-color: var(--warning); }
    [dir="rtl"] .priority-high   { border-right-color: var(--danger); }
    .badge-low    { background: #166534; color: #bbf7d0; }
    .badge-medium { background: #854d0e; color: #fef08a; }
    .badge-high   { background: #991b1b; color: #fecaca; }
    [data-theme="light"] .badge-low    { background: #dcfce7; color: #166534; }
    [data-theme="light"] .badge-medium { background: #fef9c3; color: #854d0e; }
    [data-theme="light"] .badge-high   { background: #fee2e2; color: #991b1b; }
    .modal-overlay {
      background: var(--overlay);
      backdrop-filter: blur(4px);
    }
    .modal-content {
      background: var(--bg-secondary);
      border: 1px solid var(--border);
    }
    input, textarea, select {
      background: var(--bg-card);
      color: var(--text-primary);
      border: 1px solid var(--border);
    }
    input:focus, textarea:focus, select:focus {
      outline: none;
      border-color: var(--accent);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 20%, transparent);
    }
    .btn-primary { background: var(--accent); color: white; }
    .btn-primary:hover { background: var(--accent-hover); }
    .btn-danger { background: var(--danger); color: white; }
    .btn-danger:hover { background: var(--danger-hover); }
    .toast {
      animation: slideIn 0.3s ease, fadeOut 0.3s ease 2.7s forwards;
    }
    @keyframes slideIn {
      from { transform: translateY(20px); opacity: 0; }
      to   { transform: translateY(0);    opacity: 1; }
    }
    @keyframes fadeOut {
      to { opacity: 0; transform: translateY(-10px); }
    }
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
  </style>
</head>
<body class="overflow-x-hidden">

<div id="app" class="min-h-screen flex flex-col">
  <header class="sticky top-0 z-30 border-b" style="background:var(--bg-secondary);border-color:var(--border)">
    <div class="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center gap-3">
      <h1 class="text-xl font-bold tracking-tight mr-auto" style="color:var(--accent)" data-i18n="appTitle">Task Manager</h1>
      <div class="relative">
        <input id="searchInput" type="text" class="w-48 sm:w-64 rounded-lg px-3 py-2 text-sm"
               placeholder="Search tasks..." data-i18n-placeholder="search" />
        <svg class="absolute right-3 top-2.5 w-4 h-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>
      </div>
      <select id="priorityFilter" class="rounded-lg px-3 py-2 text-sm">
        <option value="all" data-i18n="allPriorities">All Priorities</option>
        <option value="low" data-i18n="low">Low</option>
        <option value="medium" data-i18n="medium">Medium</option>
        <option value="high" data-i18n="high">High</option>
      </select>
      <button id="themeToggle" class="p-2 rounded-lg hover:opacity-80 transition"
              style="background:var(--bg-card);border:1px solid var(--border)" title="Toggle theme">
        <svg id="themeIconDark" class="w-5 h-5 hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>
        </svg>
        <svg id="themeIconLight" class="w-5 h-5 hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>
        </svg>
      </button>
      <button id="langToggle" class="px-3 py-2 rounded-lg text-sm font-medium transition hover:opacity-80"
              style="background:var(--bg-card);border:1px solid var(--border)">
        \u0641\u0627\u0631\u0633\u06cc
      </button>
    </div>
    <div class="max-w-7xl mx-auto px-4 py-2 flex flex-wrap gap-4 text-xs font-medium" style="color:var(--text-secondary)">
      <span><span id="statTotal" class="font-bold" style="color:var(--text-primary)">0</span> <span data-i18n="total">Total</span></span>
      <span><span id="statTodo" class="font-bold" style="color:var(--accent)">0</span> <span data-i18n="todo">To Do</span></span>
      <span><span id="statInProgress" class="font-bold" style="color:var(--warning)">0</span> <span data-i18n="inProgress">In Progress</span></span>
      <span><span id="statDone" class="font-bold" style="color:var(--success)">0</span> <span data-i18n="done">Done</span></span>
      <span><span id="statOverdue" class="font-bold" style="color:var(--danger)">0</span> <span data-i18n="overdue">Overdue</span></span>
    </div>
  </header>
  <main class="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 h-full" id="board"></div>
  </main>
</div>

<div id="taskModal" class="fixed inset-0 z-50 hidden items-center justify-center p-4 modal-overlay">
  <div class="modal-content rounded-2xl shadow-2xl w-full max-w-lg p-6 relative">
    <h2 id="modalTitle" class="text-lg font-bold mb-4" data-i18n="addTask">Add Task</h2>
    <form id="taskForm" class="space-y-4">
      <input type="hidden" id="taskId" />
      <div>
        <label class="block text-sm font-medium mb-1" style="color:var(--text-secondary)" data-i18n="title">Title</label>
        <input id="taskTitle" type="text" class="w-full rounded-lg px-3 py-2 text-sm" required />
      </div>
      <div>
        <label class="block text-sm font-medium mb-1" style="color:var(--text-secondary)" data-i18n="description">Description</label>
        <textarea id="taskDesc" rows="3" class="w-full rounded-lg px-3 py-2 text-sm resize-none"></textarea>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium mb-1" style="color:var(--text-secondary)" data-i18n="priority">Priority</label>
          <select id="taskPriority" class="w-full rounded-lg px-3 py-2 text-sm">
            <option value="low" data-i18n="low">Low</option>
            <option value="medium" selected data-i18n="medium">Medium</option>
            <option value="high" data-i18n="high">High</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium mb-1" style="color:var(--text-secondary)" data-i18n="dueDate">Due Date</label>
          <input id="taskDueDate" type="date" class="w-full rounded-lg px-3 py-2 text-sm" />
        </div>
      </div>
      <div class="flex gap-3 pt-2" dir="ltr">
        <button type="submit" class="btn-primary flex-1 py-2 rounded-lg text-sm font-medium transition">
          <span data-i18n="save">Save</span>
        </button>
        <button type="button" id="cancelBtn" class="flex-1 py-2 rounded-lg text-sm font-medium transition"
                style="background:var(--bg-card);border:1px solid var(--border)">
          <span data-i18n="cancel">Cancel</span>
        </button>
      </div>
    </form>
    <button id="deleteBtn" class="hidden absolute top-4 end-4 btn-danger p-2 rounded-lg transition" title="Delete">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
      </svg>
    </button>
  </div>
</div>

<div id="toastContainer" class="fixed bottom-4 end-4 z-50 flex flex-col gap-2"></div>

<script>
(function () {
  'use strict';

  /* ===== i18n strings ===== */
  var strings = {
    en: {
      appTitle: 'Task Manager',
      todo: 'To Do',
      inProgress: 'In Progress',
      done: 'Done',
      addTask: 'Add Task',
      editTask: 'Edit Task',
      title: 'Title',
      description: 'Description',
      priority: 'Priority',
      dueDate: 'Due Date',
      low: 'Low',
      medium: 'Medium',
      high: 'High',
      allPriorities: 'All Priorities',
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
      search: 'Search tasks...',
      total: 'Total',
      overdue: 'Overdue',
      noTasks: 'No tasks yet',
      confirmDelete: 'Are you sure you want to delete this task?'
    },
    fa: {
      appTitle: '\\u0645\\u062f\\u06cc\\u0631\\u06cc\\u062a \\u0648\\u0638\\u0627\\u06cc\\u0641',
      todo: '\\u0627\\u0646\\u062c\\u0627\\u0645 \\u0646\\u0634\\u062f\\u0647',
      inProgress: '\\u062f\\u0631 \\u062d\\u0627\\u0644 \\u0627\\u0646\\u062c\\u0627\\u0645',
      done: '\\u0627\\u0646\\u062c\\u0627\\u0645 \\u0634\\u062f\\u0647',
      addTask: '\\u0627\\u0641\\u0632\\u0648\\u062f\\u0646 \\u0648\\u0638\\u06cc\\u0641\\u0647',
      editTask: '\\u0648\\u06cc\\u0631\\u0627\\u06cc\\u0634 \\u0648\\u0638\\u06cc\\u0641\\u0647',
      title: '\\u0639\\u0646\\u0648\\u0627\\u0646',
      description: '\\u062a\\u0648\\u0636\\u06cc\\u062d\\u0627\\u062a',
      priority: '\\u0627\\u0648\\u0644\\u0648\\u06cc\\u062a',
      dueDate: '\\u062a\\u0627\\u0631\\u06cc\\u062e \\u0633\\u0631\\u0633\\u06cc\\u062f',
      low: '\\u06a9\\u0645',
      medium: '\\u0645\\u062a\\u0648\\u0633\\u0637',
      high: '\\u0632\\u06cc\\u0627\\u062f',
      allPriorities: '\\u0647\\u0645\\u0647 \\u0627\\u0648\\u0644\\u0648\\u06cc\\u062a\\u200c\\u0647\\u0627',
      save: '\\u0630\\u062e\\u06cc\\u0631\\u0647',
      cancel: '\\u0644\\u063a\\u0648',
      delete: '\\u062d\\u0630\\u0641',
      search: '\\u062c\\u0633\\u062a\\u062c\\u0648\\u06cc \\u0648\\u0638\\u0627\\u06cc\\u0641...',
      total: '\\u0645\\u062c\\u0645\\u0648\\u0639',
      overdue: '\\u0633\\u0631\\u0633\\u06cc\\u062f \\u06af\\u0630\\u0634\\u062a\\u0647',
      noTasks: '\\u0647\\u0646\\u0648\\u0632 \\u0648\\u0638\\u06cc\\u0641\\u0647\\u0627\\u06cc \\u0648\\u062c\\u0648\\u062f \\u0646\\u062f\\u0627\\u0631\\u062f',
      confirmDelete: '\\u0622\\u06cc\\u0627 \\u0627\\u0632 \\u062d\\u0630\\u0641 \\u0627\\u06cc\\u0646 \\u0648\\u0638\\u06cc\\u0641\\u0647 \\u0627\\u0637\\u0645\\u06cc\\u0646\\u0627\\u0646 \\u062f\\u0627\\u0631\\u06cc\\u062f\\u061f'
    }
  };

  /* ===== App state ===== */
  var state = {
    tasks: [],
    stats: { total: 0, todo: 0, in_progress: 0, done: 0, overdue: 0 },
    filters: { search: '', priority: 'all' },
    lang: localStorage.getItem('lang') || 'en',
    theme: localStorage.getItem('theme') || 'dark'
  };

  /* ===== Helpers ===== */
  var $ = function (sel) { return document.querySelector(sel); };
  var $$ = function (sel) { return document.querySelectorAll(sel); };
  var t = function (key) { return strings[state.lang][key] || key; };

  var columnConfig = [
    { status: 'todo',       icon: '\\u{1f4cb}', color: 'var(--accent)' },
    { status: 'in_progress', icon: '\\u2699\\ufe0f',  color: 'var(--warning)' },
    { status: 'done',       icon: '\\u2705', color: 'var(--success)' }
  ];

  var priorityColors = { low: 'badge-low', medium: 'badge-medium', high: 'badge-high' };

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /* ===== API helpers ===== */
  var api = {
    get: function (url) {
      return fetch(url).then(function (r) {
        if (!r.ok) throw new Error('GET ' + url + ' failed: ' + r.status);
        return r.json();
      });
    },
    post: function (url, body) {
      return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }).then(function (r) {
        return r.json().then(function (data) {
          if (!r.ok) throw new Error(data.error || 'Request failed');
          return data;
        });
      });
    },
    put: function (url, body) {
      return fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }).then(function (r) {
        return r.json().then(function (data) {
          if (!r.ok) throw new Error(data.error || 'Request failed');
          return data;
        });
      });
    },
    del: function (url) {
      return fetch(url, { method: 'DELETE' }).then(function (r) {
        return r.json().then(function (data) {
          if (!r.ok) throw new Error(data.error || 'Request failed');
          return data;
        });
      });
    },
    patch: function (url, body) {
      return fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }).then(function (r) {
        return r.json().then(function (data) {
          if (!r.ok) throw new Error(data.error || 'Request failed');
          return data;
        });
      });
    }
  };

  /* ===== Data fetching ===== */
  function fetchTasks() {
    var params = new URLSearchParams();
    if (state.filters.search) params.set('search', state.filters.search);
    if (state.filters.priority !== 'all') params.set('priority', state.filters.priority);
    var qs = params.toString();
    return api.get('/api/tasks' + (qs ? '?' + qs : '')).then(function (data) {
      state.tasks = data.tasks;
      renderBoard();
    }).catch(function (err) {
      showToast(err.message, 'error');
    });
  }

  function fetchStats() {
    return api.get('/api/tasks/stats').then(function (data) {
      state.stats = data;
      renderStats();
    }).catch(function (err) {
      console.error('Stats fetch failed:', err);
    });
  }

  function refreshAll() {
    return Promise.all([fetchTasks(), fetchStats()]);
  }

  /* ===== Render — Stats ===== */
  function renderStats() {
    $('#statTotal').textContent = state.stats.total || 0;
    $('#statTodo').textContent = state.stats.todo || 0;
    $('#statInProgress').textContent = state.stats.in_progress || 0;
    $('#statDone').textContent = state.stats.done || 0;
    $('#statOverdue').textContent = state.stats.overdue || 0;
  }

  /* ===== Render — Board ===== */
  function renderBoard() {
    var board = $('#board');
    board.innerHTML = '';

    columnConfig.forEach(function (col) {
      var tasks = state.tasks
        .filter(function (task) { return task.status === col.status; })
        .sort(function (a, b) { return a.position - b.position; });

      var column = document.createElement('section');
      column.className = 'column-bg rounded-xl p-4 flex flex-col';
      column.dataset.status = col.status;

      var labelKey = col.status === 'todo' ? 'todo' : col.status === 'in_progress' ? 'inProgress' : 'done';

      column.innerHTML =
        '<div class="flex items-center justify-between mb-3">' +
          '<h2 class="text-sm font-bold flex items-center gap-2">' +
            '<span>' + col.icon + '</span>' +
            '<span data-i18n="' + labelKey + '">' + t(labelKey) + '</span>' +
            '<span class="text-xs font-normal px-2 py-0.5 rounded-full" style="background:var(--bg-card);color:var(--text-secondary)">' + tasks.length + '</span>' +
          '</h2>' +
          (col.status === 'todo' ?
            '<button class="add-task-btn p-1.5 rounded-lg transition hover:opacity-80" style="background:var(--accent);color:white" title="' + t('addTask') + '">' +
              '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>' +
            '</button>' : '') +
        '</div>' +
        '<div class="task-list flex flex-col gap-2 flex-1 min-h-[100px]" data-status="' + col.status + '">' +
          (tasks.length === 0 ?
            '<p class="text-center text-sm py-8" style="color:var(--text-secondary)">' + t('noTasks') + '</p>' : '') +
        '</div>';

      var taskList = column.querySelector('.task-list');

      if (tasks.length > 0) {
        tasks.forEach(function (task) {
          taskList.appendChild(createTaskCard(task));
        });
      }

      setupDropZone(taskList);
      board.appendChild(column);
    });

    // Attach add-task button events
    $$('.add-task-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { openModal(); });
    });

    applyI18nToDOM();
  }

  /* ===== Render — Task card ===== */
  function createTaskCard(task) {
    var card = document.createElement('div');
    card.className = 'card rounded-lg p-3 cursor-grab active:cursor-grabbing transition priority-' + task.priority;
    card.draggable = true;
    card.dataset.id = task.id;

    var isOverdue = task.due_date && task.status !== 'done' && new Date(task.due_date) < new Date(new Date().toDateString());
    var locale = state.lang === 'fa' ? 'fa-IR' : 'en-US';
    var dueDateStr = task.due_date ? new Date(task.due_date).toLocaleDateString(locale) : '';
    var createdAtStr = task.created_at ? new Date(task.created_at + 'Z').toLocaleDateString(locale) : '';

    card.innerHTML =
      '<div class="flex items-start justify-between gap-2 mb-2">' +
        '<h3 class="text-sm font-semibold leading-tight flex-1">' + escapeHtml(task.title) + '</h3>' +
        '<span class="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ' + priorityColors[task.priority] + '">' + t(task.priority) + '</span>' +
      '</div>' +
      (task.description ?
        '<p class="text-xs mb-2 line-clamp-2" style="color:var(--text-secondary)">' + escapeHtml(task.description) + '</p>' : '') +
      '<div class="flex items-center gap-2 flex-wrap text-[10px]" style="color:var(--text-secondary)">' +
        (dueDateStr ?
          '<span class="' + (isOverdue ? 'font-bold' : '') + '" style="' + (isOverdue ? 'color:var(--danger)' : '') + '">' +
            (isOverdue ? '\\u26a0 ' : '\\ud83d\\udcc5 ') + dueDateStr +
          '</span>' : '') +
        '<span>\\ud83d\\udd50 ' + createdAtStr + '</span>' +
      '</div>';

    card.addEventListener('click', function (e) {
      if (e.target.closest('.drop-placeholder')) return;
      openModal(task);
    });

    card.addEventListener('dragstart', function (e) {
      e.dataTransfer.setData('text/plain', JSON.stringify({ id: task.id, status: task.status }));
      e.dataTransfer.effectAllowed = 'move';
      requestAnimationFrame(function () { card.classList.add('dragging'); });
    });

    card.addEventListener('dragend', function () {
      card.classList.remove('dragging');
      $$('.drop-placeholder').forEach(function (p) { p.remove(); });
      $$('.drag-over').forEach(function (el) { el.classList.remove('drag-over'); });
    });

    return card;
  }

  /* ===== Drag & Drop ===== */
  function setupDropZone(taskList) {
    taskList.addEventListener('dragover', function (e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      taskList.closest('.column-bg').classList.add('drag-over');

      var cards = Array.from(taskList.querySelectorAll('.card:not(.dragging)'));
      var placeholder = taskList.querySelector('.drop-placeholder') || createPlaceholder();
      var insertBefore = null;

      for (var i = 0; i < cards.length; i++) {
        var rect = cards[i].getBoundingClientRect();
        if (e.clientY < rect.top + rect.height / 2) {
          insertBefore = cards[i];
          break;
        }
      }

      if (insertBefore) {
        taskList.insertBefore(placeholder, insertBefore);
      } else {
        taskList.appendChild(placeholder);
      }
    });

    taskList.addEventListener('dragleave', function (e) {
      if (!taskList.contains(e.relatedTarget)) {
        var col = taskList.closest('.column-bg');
        if (col) col.classList.remove('drag-over');
        var ph = taskList.querySelector('.drop-placeholder');
        if (ph) ph.remove();
      }
    });

    taskList.addEventListener('drop', function (e) {
      e.preventDefault();
      var col = taskList.closest('.column-bg');
      if (col) col.classList.remove('drag-over');
      var ph = taskList.querySelector('.drop-placeholder');
      if (ph) ph.remove();

      var data;
      try {
        data = JSON.parse(e.dataTransfer.getData('text/plain'));
      } catch (ex) { return; }

      var targetStatus = taskList.dataset.status;
      var taskId = data.id;

      var cards = Array.from(taskList.querySelectorAll('.card:not(.dragging)'));
      var newPosition = cards.length;
      for (var i = 0; i < cards.length; i++) {
        var rect = cards[i].getBoundingClientRect();
        if (e.clientY < rect.top + rect.height / 2) {
          newPosition = i;
          break;
        }
      }

      // Optimistic update
      var task = state.tasks.find(function (tk) { return tk.id === taskId; });
      if (task) {
        task.status = targetStatus;
        task.position = newPosition;
      }

      // Build batch updates
      var affected = state.tasks
        .filter(function (tk) { return tk.status === targetStatus && tk.id !== taskId; })
        .sort(function (a, b) { return a.position - b.position; });

      affected.splice(newPosition, 0, { id: taskId, status: targetStatus, position: 0 });
      var updates = [];
      affected.forEach(function (tk, idx) {
        if (tk.position !== idx || tk.status !== targetStatus) {
          updates.push({ id: tk.id, position: idx, status: tk.status });
        }
      });

      renderBoard();

      api.patch('/api/tasks/reorder', { updates: updates })
        .then(function () { return fetchStats(); })
        .catch(function (err) {
          showToast(err.message, 'error');
          return refreshAll();
        });
    });
  }

  function createPlaceholder() {
    var ph = document.createElement('div');
    ph.className = 'drop-placeholder';
    return ph;
  }

  /* ===== Modal ===== */
  function openModal(task) {
    var modal = $('#taskModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    $('#modalTitle').textContent = task ? t('editTask') : t('addTask');
    $('#taskId').value = task ? task.id : '';
    $('#taskTitle').value = task ? task.title : '';
    $('#taskDesc').value = task ? task.description : '';
    $('#taskPriority').value = task ? task.priority : 'medium';
    $('#taskDueDate').value = task ? (task.due_date || '') : '';
    $('#deleteBtn').classList.toggle('hidden', !task);

    $('#taskTitle').focus();
  }

  function closeModal() {
    var modal = $('#taskModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    $('#taskForm').reset();
    $('#taskId').value = '';
    $('#deleteBtn').classList.add('hidden');
  }

  function handleFormSubmit(e) {
    e.preventDefault();
    var id = $('#taskId').value;
    var payload = {
      title: $('#taskTitle').value.trim(),
      description: $('#taskDesc').value.trim(),
      priority: $('#taskPriority').value,
      due_date: $('#taskDueDate').value || null
    };

    if (!payload.title) return;

    var promise = id
      ? api.put('/api/tasks/' + id, payload)
      : api.post('/api/tasks', payload);

    promise.then(function () {
      showToast(id
        ? (state.lang === 'fa' ? '\\u0648\\u0638\\u06cc\\u0641\\u0647 \\u0628\\u0631\\u0648\\u0632\\u0631\\u0633\\u0627\\u0646\\u06cc \\u0634\\u062f' : 'Task updated')
        : (state.lang === 'fa' ? '\\u0648\\u0638\\u06cc\\u0641\\u0647 \\u0627\\u06cc\\u062c\\u0627\\u062f \\u0634\\u062f' : 'Task created'),
        'success');
      closeModal();
      return refreshAll();
    }).catch(function (err) {
      showToast(err.message, 'error');
    });
  }

  function handleDelete() {
    var id = $('#taskId').value;
    if (!id) return;
    if (!confirm(t('confirmDelete'))) return;

    api.del('/api/tasks/' + id).then(function () {
      showToast(state.lang === 'fa' ? '\\u0648\\u0638\\u06cc\\u0641\\u0647 \\u062d\\u0630\\u0641 \\u0634\\u062f' : 'Task deleted', 'success');
      closeModal();
      return refreshAll();
    }).catch(function (err) {
      showToast(err.message, 'error');
    });
  }

  /* ===== Toast ===== */
  function showToast(message, type) {
    var container = $('#toastContainer');
    var toast = document.createElement('div');
    var bgColor = type === 'error' ? 'var(--danger)' : type === 'success' ? 'var(--success)' : 'var(--accent)';
    toast.className = 'toast px-4 py-2 rounded-lg text-sm font-medium shadow-lg text-white';
    toast.style.background = bgColor;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(function () { toast.remove(); }, 3000);
  }

  /* ===== Theme ===== */
  function applyTheme() {
    document.documentElement.dataset.theme = state.theme;
    var isDark = state.theme === 'dark';
    $('#themeIconDark').classList.toggle('hidden', !isDark);
    $('#themeIconLight').classList.toggle('hidden', isDark);
  }

  function toggleTheme() {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', state.theme);
    applyTheme();
  }

  /* ===== Language ===== */
  function applyLanguage() {
    var isRtl = state.lang === 'fa';
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
    document.documentElement.lang = state.lang;
    $('#langToggle').textContent = isRtl ? 'English' : '\\u0641\\u0627\\u0631\\u0633\\u06cc';
    $('#searchInput').placeholder = t('search');
    $('#priorityFilter').options[0].text = t('allPriorities');
    renderBoard();
    renderStats();
  }

  function applyI18nToDOM() {
    $$('[data-i18n]').forEach(function (el) {
      var key = el.dataset.i18n;
      if (strings[state.lang][key]) el.textContent = strings[state.lang][key];
    });
    $$('[data-i18n-placeholder]').forEach(function (el) {
      var key = el.dataset.i18nPlaceholder;
      if (strings[state.lang][key]) el.placeholder = strings[state.lang][key];
    });
  }

  function toggleLanguage() {
    state.lang = state.lang === 'en' ? 'fa' : 'en';
    localStorage.setItem('lang', state.lang);
    applyLanguage();
  }

  /* ===== Search & Filter ===== */
  var searchTimeout;
  function handleSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(function () {
      state.filters.search = $('#searchInput').value.trim();
      fetchTasks();
    }, 300);
  }

  function handlePriorityFilter() {
    state.filters.priority = $('#priorityFilter').value;
    fetchTasks();
  }

  /* ===== Init ===== */
  function init() {
    applyTheme();
    applyLanguage();

    $('#themeToggle').addEventListener('click', toggleTheme);
    $('#langToggle').addEventListener('click', toggleLanguage);
    $('#searchInput').addEventListener('input', handleSearch);
    $('#priorityFilter').addEventListener('change', handlePriorityFilter);
    $('#taskForm').addEventListener('submit', handleFormSubmit);
    $('#cancelBtn').addEventListener('click', closeModal);
    $('#deleteBtn').addEventListener('click', handleDelete);

    $('#taskModal').addEventListener('click', function (e) {
      if (e.target === $('#taskModal')) closeModal();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeModal();
    });

    refreshAll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
<\/script>
</body>
</html>`;

// ============================================================================
// Worker fetch handler
// ============================================================================

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;

    // Ensure schema is applied once
    await ensureSchema(env.DB);

    // Serve frontend
    if (pathname === '/' || pathname === '') {
      return new Response(HTML, {
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    }

    // API routes
    try {
      if (pathname === '/api/tasks' && request.method === 'GET') {
        return handleListTasks(env.DB, url);
      }
      if (pathname === '/api/tasks' && request.method === 'POST') {
        return handleCreateTask(env.DB, request);
      }
      if (pathname === '/api/tasks/stats' && request.method === 'GET') {
        return handleStats(env.DB);
      }
      if (pathname === '/api/tasks/reorder' && request.method === 'PATCH') {
        return handleReorder(env.DB, request);
      }
      const taskMatch = pathname.match(/^\/api\/tasks\/(\d+)$/);
      if (taskMatch) {
        const id = Number(taskMatch[1]);
        if (request.method === 'PUT') return handleUpdateTask(env.DB, id, request);
        if (request.method === 'DELETE') return handleDeleteTask(env.DB, id);
      }
    } catch (err) {
      return jsonResponse({ error: err.message }, 500);
    }

    return new Response('Not Found', { status: 404 });
  },
};

// ============================================================================
// Schema management
// ============================================================================

let schemaApplied = false;

async function ensureSchema(db) {
  if (schemaApplied) return;
  const statements = SCHEMA.split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  await db.batch(statements.map((s) => db.prepare(s)));
  schemaApplied = true;
}

// ============================================================================
// Helpers
// ============================================================================

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

// ============================================================================
// GET /api/tasks
// ============================================================================

async function handleListTasks(db, url) {
  let query = 'SELECT * FROM tasks WHERE 1=1';
  const params = [];

  const status = url.searchParams.get('status');
  if (status && ['todo', 'in_progress', 'done'].includes(status)) {
    query += ' AND status = ?';
    params.push(status);
  }

  const priority = url.searchParams.get('priority');
  if (priority && ['low', 'medium', 'high'].includes(priority)) {
    query += ' AND priority = ?';
    params.push(priority);
  }

  const search = url.searchParams.get('search');
  if (search) {
    query += ' AND (title LIKE ? OR description LIKE ?)';
    const term = `%${search}%`;
    params.push(term, term);
  }

  query += ' ORDER BY position ASC, created_at DESC';

  const stmt = db.prepare(query);
  const result = params.length ? await stmt.bind(...params).all() : await stmt.all();

  return jsonResponse({ tasks: result.results });
}

// ============================================================================
// GET /api/tasks/stats
// ============================================================================

async function handleStats(db) {
  const [total, todo, inProgress, done, overdue] = await Promise.all([
    db.prepare('SELECT COUNT(*) as count FROM tasks').first(),
    db.prepare("SELECT COUNT(*) as count FROM tasks WHERE status = 'todo'").first(),
    db.prepare("SELECT COUNT(*) as count FROM tasks WHERE status = 'in_progress'").first(),
    db.prepare("SELECT COUNT(*) as count FROM tasks WHERE status = 'done'").first(),
    db.prepare(
      "SELECT COUNT(*) as count FROM tasks WHERE status != 'done' AND due_date IS NOT NULL AND due_date < date('now')"
    ).first(),
  ]);

  return jsonResponse({
    total: total.count,
    todo: todo.count,
    in_progress: inProgress.count,
    done: done.count,
    overdue: overdue.count,
  });
}

// ============================================================================
// POST /api/tasks
// ============================================================================

async function handleCreateTask(db, request) {
  const body = await request.json();
  const { title, description = '', priority = 'medium', due_date = null } = body;

  if (!title || !title.trim()) {
    return jsonResponse({ error: 'Title is required' }, 400);
  }
  if (!['low', 'medium', 'high'].includes(priority)) {
    return jsonResponse({ error: 'Invalid priority' }, 400);
  }

  const maxPos = await db
    .prepare("SELECT COALESCE(MAX(position), -1) + 1 as pos FROM tasks WHERE status = 'todo'")
    .first();

  const result = await db
    .prepare(
      'INSERT INTO tasks (title, description, priority, due_date, position) VALUES (?, ?, ?, ?, ?)'
    )
    .bind(title.trim(), description.trim(), priority, due_date, maxPos.pos)
    .run();

  const task = await db
    .prepare('SELECT * FROM tasks WHERE id = ?')
    .bind(result.meta.last_row_id)
    .first();

  return jsonResponse({ task }, 201);
}

// ============================================================================
// PUT /api/tasks/:id
// ============================================================================

async function handleUpdateTask(db, id, request) {
  const body = await request.json();
  const { title, description, priority, due_date, status } = body;

  const existing = await db.prepare('SELECT * FROM tasks WHERE id = ?').bind(id).first();
  if (!existing) return jsonResponse({ error: 'Task not found' }, 404);

  if (priority && !['low', 'medium', 'high'].includes(priority)) {
    return jsonResponse({ error: 'Invalid priority' }, 400);
  }
  if (status && !['todo', 'in_progress', 'done'].includes(status)) {
    return jsonResponse({ error: 'Invalid status' }, 400);
  }

  await db
    .prepare(
      `UPDATE tasks
       SET title = ?, description = ?, priority = ?, due_date = ?, status = ?,
           updated_at = datetime('now')
       WHERE id = ?`
    )
    .bind(
      title !== undefined ? title.trim() : existing.title,
      description !== undefined ? description.trim() : existing.description,
      priority || existing.priority,
      due_date !== undefined ? due_date : existing.due_date,
      status || existing.status,
      id
    )
    .run();

  const task = await db.prepare('SELECT * FROM tasks WHERE id = ?').bind(id).first();
  return jsonResponse({ task });
}

// ============================================================================
// DELETE /api/tasks/:id
// ============================================================================

async function handleDeleteTask(db, id) {
  const existing = await db.prepare('SELECT * FROM tasks WHERE id = ?').bind(id).first();
  if (!existing) return jsonResponse({ error: 'Task not found' }, 404);

  await db.prepare('DELETE FROM tasks WHERE id = ?').bind(id).run();
  return jsonResponse({ success: true });
}

// ============================================================================
// PATCH /api/tasks/reorder
// ============================================================================

async function handleReorder(db, request) {
  const { updates } = await request.json();

  if (!Array.isArray(updates)) {
    return jsonResponse({ error: 'updates must be an array' }, 400);
  }

  const stmts = updates.map((u) =>
    db
      .prepare("UPDATE tasks SET position = ?, status = ?, updated_at = datetime('now') WHERE id = ?")
      .bind(u.position, u.status, u.id)
  );

  await db.batch(stmts);
  return jsonResponse({ success: true });
}
