from flask import Flask, request, jsonify, render_template
import uuid
from datetime import datetime
import json
import os

app = Flask(__name__)  # Flask serves /static by default from ./static

TASKS_FILE = 'data.json'

def load_data():
    if os.path.exists(TASKS_FILE):
        try:
            with open(TASKS_FILE, 'r') as f:
                return json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            return {"groups": [], "tasks": []}
    return {"groups": [], "tasks": []}

def save_data():
    try:
        with open(TASKS_FILE, 'w') as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        print(f"Error saving data: {e}")

data = load_data()

def create_task(content, group_id=None, due_date=None, time_range=None, priority="medium", tags=None):
    return {
        'id': str(uuid.uuid4()),
        'content': content,
        'group_id': group_id,
        'status': 'pending',
        'due_date': due_date,
        'time_range': time_range,
        'priority': priority,
        'tags': tags or [],
        'created_at': datetime.now().isoformat(),
        'updated_at': datetime.now().isoformat()
    }

def create_group(name, color=None, icon="📁"):
    return {
        'id': str(uuid.uuid4()),
        'name': name,
        'color': color or '#6366f1',
        'icon': icon,
        'created_at': datetime.now().isoformat()
    }

# Initialize sample data
def init_sample_data():
    if not data['groups']:
        sample_groups = [
            create_group("Work-Related Groups", "#ef4444", "📅"),
            create_group("Personal Productivity", "#3b82f6", "💼"),
            create_group("Learning & Development", "#8b5cf6", "📚"),
            create_group("Family & Relationships", "#f59e0b", "👪"),
            create_group("Social & Events", "#10b981", "🎉"),
            create_group("Health & Wellness", "#10b981", "🏥"),
            create_group("Creative & Hobby Groups", "#10b981", "🎨")
        ]
        data['groups'] = sample_groups
        
        sample_tasks = [
            create_task(
                "Amanda at Ruth's",
                group_id=sample_groups[0]['id'],
                due_date=datetime.now().strftime('%Y-%m-%d'),
                time_range="4:00 PM",
                priority="high"
            ),
            create_task(
                "Holidays in Norway",
                group_id=sample_groups[1]['id'],
                due_date=(datetime.now().replace(day=datetime.now().day + 5)).strftime('%Y-%m-%d'),
                priority="medium"
            ),
            create_task(
                "Amanda at Ruth's",
                group_id=sample_groups[2]['id'],
                time_range="10:00 AM – 12:00 PM",
                priority="high"
            ),
            create_task(
                "Read online reviews",
                group_id=sample_groups[3]['id'],
                time_range="12:30 PM – 3:00 PM",
                priority="medium"
            ),
            create_task(
                "Take the coat to dry cleaning",
                tags=["errand"]
            ),
            create_task(
                "Help with Sam's project",
                priority="high"
            ),
            create_task(
                "Fix mom's bike",
                tags=["family", "repair"]
            )
        ]
        data['tasks'] = sample_tasks
        save_data()

init_sample_data()

@app.route('/')
def home():
    return render_template('index.html')

# Groups API
@app.route('/groups', methods=['GET'])
def get_groups():
    return jsonify({'groups': data['groups']}), 200

@app.route('/groups', methods=['POST'])
def create_new_group():
    request_data = request.get_json()
    if not request_data or 'name' not in request_data or not request_data['name'].strip():
        return jsonify({'error': 'Group name is required'}), 400

    group = create_group(
        request_data['name'].strip(), 
        request_data.get('color'),
        request_data.get('icon', '📁')
    )
    data['groups'].append(group)
    save_data()
    return jsonify(group), 201

@app.route('/groups/<group_id>', methods=['DELETE'])
def delete_group(group_id):
    data['groups'] = [g for g in data['groups'] if g['id'] != group_id]
    data['tasks'] = [t for t in data['tasks'] if t.get('group_id') != group_id]
    save_data()
    return jsonify({'message': 'Group deleted successfully'}), 200

# Tasks API
@app.route('/tasks', methods=['GET'])
def get_tasks():
    return jsonify({'tasks': data['tasks']}), 200

@app.route('/tasks', methods=['POST'])
def create_new_task():
    request_data = request.get_json()
    if not request_data or 'content' not in request_data or not request_data['content'].strip():
        return jsonify({'error': 'Content is required'}), 400

    task = create_task(
        request_data['content'].strip(),
        request_data.get('group_id'),
        request_data.get('due_date'),
        request_data.get('time_range'),
        request_data.get('priority', 'medium'),
        request_data.get('tags', [])
    )
    data['tasks'].append(task)
    save_data()
    return jsonify(task), 201

@app.route('/tasks/<task_id>', methods=['PUT'])
def update_task(task_id):
    task = next((t for t in data['tasks'] if t['id'] == task_id), None)
    if not task:
        return jsonify({'error': 'Task not found'}), 404

    request_data = request.get_json() or {}
    
    update_fields = ['content', 'group_id', 'due_date', 'time_range', 'priority', 'status', 'tags']
    for field in update_fields:
        if field in request_data:
            if field == 'content' and request_data[field].strip():
                task[field] = request_data[field].strip()
            elif field != 'content':
                task[field] = request_data[field]
    
    task['updated_at'] = datetime.now().isoformat()
    
    if 'status' in request_data and request_data['status'] not in ['pending', 'done']:
        return jsonify({'error': 'Status must be either "pending" or "done"'}), 400

    save_data()
    return jsonify(task), 200

@app.route('/tasks/<task_id>', methods=['DELETE'])
def delete_task(task_id):
    data['tasks'] = [t for t in data['tasks'] if t['id'] != task_id]
    save_data()
    return jsonify({'message': 'Task deleted successfully'}), 200

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)