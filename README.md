# Todo List App

A simple RESTful API for managing todo tasks built with Flask. Tasks are persisted to a JSON file for data storage.

## Features

- Create, read, update, and delete todo tasks
- Each task has a unique UUID, content, status (pending/done), and creation timestamp
- Data persistence using JSON file storage
- RESTful API endpoints

## Installation

1. Install dependencies:

```bash
pip install -r requirements.txt
```

2. Run the application:

```bash
python app.py
```

The server will start on `http://localhost:5000`

## API Endpoints

### 1. Get All Tasks
**GET** `/tasks`

Returns all tasks in the system.

**Response:**
```json
{
  "tasks": [
    {
      "id": "f52eb39f-e450-425a-b524-ae3aadff5cf8",
      "content": "Buy groceries",
      "status": "pending",
      "created_at": "2025-10-19T16:24:34.603147"
    }
  ]
}
```

### 2. Get Single Task
**GET** `/tasks/<task_id>`

Returns a specific task by its ID.

**Response (200):**
```json
{
  "id": "f52eb39f-e450-425a-b524-ae3aadff5cf8",
  "content": "Buy groceries",
  "status": "pending",
  "created_at": "2025-10-19T16:24:34.603147"
}
```

**Response (404):**
```json
{
  "error": "Task not found"
}
```

### 3. Create New Task
**POST** `/tasks`

Creates a new task.

**Request Body:**
```json
{
  "content": "Buy groceries"
}
```

**Response (201):**
```json
{
  "id": "f52eb39f-e450-425a-b524-ae3aadff5cf8",
  "content": "Buy groceries",
  "status": "pending",
  "created_at": "2025-10-19T16:24:34.603147"
}
```

**Response (400):**
```json
{
  "error": "Content is required"
}
```

### 4. Update Task
**PUT** `/tasks/<task_id>`

Updates an existing task's content and/or status.

**Request Body (partial updates allowed):**
```json
{
  "content": "Buy organic groceries",
  "status": "done"
}
```

**Response (200):**
```json
{
  "id": "f52eb39f-e450-425a-b524-ae3aadff5cf8",
  "content": "Buy organic groceries",
  "status": "done",
  "created_at": "2025-10-19T16:24:34.603147"
}
```

**Response (404):**
```json
{
  "error": "Task not found"
}
```

**Response (400):**
```json
{
  "error": "Status must be either \"pending\" or \"done\""
}
```

### 5. Delete Task
**DELETE** `/tasks/<task_id>`

Deletes a task by its ID.

**Response (200):**
```json
{
  "message": "Task deleted successfully"
}
```

**Response (404):**
```json
{
  "error": "Task not found"
}
```

### 6. Health Check
**GET** `/health`

Returns the health status of the API and current task count.

**Response:**
```json
{
  "status": "healthy",
  "tasks_count": 3
}
```

## Task Model

Each task has the following structure:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | UUID v4 identifier |
| `content` | string | Task description |
| `status` | string | Either "pending" or "done" |
| `created_at` | string | ISO timestamp of creation |

## Example Usage

### Using curl

**Create a task:**
```bash
curl -X POST http://localhost:5000/tasks \
  -H "Content-Type: application/json" \
  -d '{"content": "Learn Flask"}'
```

**Get all tasks:**
```bash
curl http://localhost:5000/tasks
```

**Update a task:**
```bash
curl -X PUT http://localhost:5000/tasks/<task_id> \
  -H "Content-Type: application/json" \
  -d '{"status": "done"}'
```

**Delete a task:**
```bash
curl -X DELETE http://localhost:5000/tasks/<task_id>
```

## Data Storage

Tasks are automatically saved to `data.json` in the application directory. The file is created automatically when the first task is added.
