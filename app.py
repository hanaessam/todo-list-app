from flask import Flask, request, jsonify
import uuid
from datetime import datetime
import json
import os

app = Flask(__name__)

# JSON file path for storing tasks
TASKS_FILE = 'data.json'

# Load tasks from JSON file
def load_tasks():
    if os.path.exists(TASKS_FILE):
        try:
            with open(TASKS_FILE, 'r') as f:
                return json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            return []
    return []

# Save tasks to JSON file
def save_tasks():
    try:
        with open(TASKS_FILE, 'w') as f:
            json.dump(tasks, f, indent=2)
        print(f"Tasks saved successfully to {TASKS_FILE}")
        print(f"Current tasks count: {len(tasks)}")
    except Exception as e:
        print(f"Error saving tasks: {e}")

# Initialize tasks from file
tasks = load_tasks()

# Task model structure
def create_task(content):
    return {
        'id': str(uuid.uuid4()),
        'content': content,
        'status': 'pending',
        'created_at': datetime.now().isoformat()
    }

# GET /tasks - Get all tasks
@app.route('/tasks', methods=['GET'])
def get_tasks():
    return jsonify({'tasks': tasks}), 200

# GET /tasks/<task_id> - Get a specific task
@app.route('/tasks/<task_id>', methods=['GET'])
def get_task(task_id):
    task = None
    for t in tasks:
        if t['id'] == task_id:
            task = t
            break

    if task:
        return jsonify(task), 200

    return jsonify({'error': 'Task not found'}), 404

# POST /tasks - Create a new task
@app.route('/tasks', methods=['POST'])
def create_new_task():
    data = request.get_json()
    
    if not data or 'content' not in data:
        return jsonify({'error': 'Content is required'}), 400
    
    task = create_task(data['content'])
    tasks.append(task)
    save_tasks()  # Save to file
    
    return jsonify(task), 201

# PUT /tasks/<task_id> - Update a task
@app.route('/tasks/<task_id>', methods=['PUT'])
def update_task(task_id):
    task = None
    for t in tasks:
        if t['id'] == task_id:
            task = t
            break

    if not task:
        return jsonify({'error': 'Task not found'}), 404
    
    data = request.get_json()
    
    if 'content' in data:
        task['content'] = data['content']
    
    if 'status' in data:
        if data['status'] not in ['pending', 'done']:
            return jsonify({'error': 'Status must be either "pending" or "done"'}), 400
        task['status'] = data['status']
    
    save_tasks()  # Save to file
    return jsonify(task), 200

# DELETE /tasks/<task_id> - Delete a task
@app.route('/tasks/<task_id>', methods=['DELETE'])
def delete_task(task_id):
    task = None
    for t in tasks:
        if t['id'] == task_id:
            task = t
            break

    if not task:
        return jsonify({'error': 'Task not found'}), 404

    tasks.remove(task)      # remove in-place
    save_tasks()  # Save to file

    return jsonify({'message': 'Task deleted successfully'}), 200

# Health check endpoint
@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'tasks_count': len(tasks)}), 200

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)