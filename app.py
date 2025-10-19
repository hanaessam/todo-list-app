from flask import Flask, request, jsonify
import uuid
from datetime import datetime

app = Flask(__name__)

# Temporary storage for tasks
tasks = []

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
    task = next((task for task in tasks if task['id'] == task_id), None)
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
    
    return jsonify(task), 201

# PUT /tasks/<task_id> - Update a task
@app.route('/tasks/<task_id>', methods=['PUT'])
def update_task(task_id):
    task = next((task for task in tasks if task['id'] == task_id), None)
    
    if not task:
        return jsonify({'error': 'Task not found'}), 404
    
    data = request.get_json()
    
    if 'content' in data:
        task['content'] = data['content']
    
    if 'status' in data:
        if data['status'] not in ['pending', 'done']:
            return jsonify({'error': 'Status must be either "pending" or "done"'}), 400
        task['status'] = data['status']
    
    return jsonify(task), 200

# DELETE /tasks/<task_id> - Delete a task
@app.route('/tasks/<task_id>', methods=['DELETE'])
def delete_task(task_id):
    global tasks
    task = next((task for task in tasks if task['id'] == task_id), None)
    
    if not task:
        return jsonify({'error': 'Task not found'}), 404
    
    tasks = [task for task in tasks if task['id'] != task_id]
    
    return jsonify({'message': 'Task deleted successfully'}), 200

# Health check endpoint
@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'tasks_count': len(tasks)}), 200

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)