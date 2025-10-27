from flask import Flask, request, jsonify, render_template
import uuid
from datetime import datetime
import os
from sqlalchemy import (
    create_engine, Column, String, Text, DateTime, ForeignKey
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import declarative_base, sessionmaker, relationship

app = Flask(__name__)

# DB url from env (docker-compose sets DATABASE_URL)
DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/todo')

engine = create_engine(DATABASE_URL, echo=False, future=True)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)
Base = declarative_base()

# Models
class Group(Base):
    __tablename__ = 'groups'
    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    color = Column(String, nullable=True)
    icon = Column(String, nullable=True)
    created_at = Column(DateTime, nullable=False)

class Task(Base):
    __tablename__ = 'tasks'
    id = Column(String, primary_key=True, index=True)
    content = Column(Text, nullable=False)
    group_id = Column(String, ForeignKey('groups.id'), nullable=True)
    status = Column(String, nullable=False, default='pending')
    due_date = Column(String, nullable=True)
    time_range = Column(String, nullable=True)
    priority = Column(String, nullable=True)
    tags = Column(JSONB, nullable=True)
    created_at = Column(DateTime, nullable=False)
    updated_at = Column(DateTime, nullable=False)

# create tables
Base.metadata.create_all(bind=engine)

# helpers
def now_iso():
    return datetime.now().isoformat()

def row_to_group(g):
    return {
        'id': g.id,
        'name': g.name,
        'color': g.color,
        'icon': g.icon,
        'created_at': g.created_at.isoformat()
    }

def row_to_task(t):
    return {
        'id': t.id,
        'content': t.content,
        'group_id': t.group_id,
        'status': t.status,
        'due_date': t.due_date,
        'time_range': t.time_range,
        'priority': t.priority,
        'tags': t.tags or [],
        'created_at': t.created_at.isoformat(),
        'updated_at': t.updated_at.isoformat()
    }

# Routes
@app.route('/')
def home():
    return render_template('index.html')

# Groups API
@app.route('/groups', methods=['GET'])
def get_groups():
    with SessionLocal() as session:
        groups = session.query(Group).all()
        return jsonify({'groups': [row_to_group(g) for g in groups]}), 200

@app.route('/groups', methods=['POST'])
def create_new_group():
    req = request.get_json() or {}
    name = req.get('name', '').strip()
    if not name:
        return jsonify({'error': 'Group name is required'}), 400

    g = Group(
        id=str(uuid.uuid4()),
        name=name,
        color=req.get('color'),
        icon=req.get('icon', '📁'),
        created_at=datetime.now()
    )
    with SessionLocal() as session:
        session.add(g)
        session.commit()
        return jsonify(row_to_group(g)), 201

@app.route('/groups/<group_id>', methods=['DELETE'])
def delete_group(group_id):
    with SessionLocal() as session:
        session.query(Task).filter(Task.group_id == group_id).update({'group_id': None})
        session.query(Group).filter(Group.id == group_id).delete()
        session.commit()
        return jsonify({'message': 'Group deleted successfully'}), 200

# Tasks API
@app.route('/tasks', methods=['GET'])
def get_tasks():
    with SessionLocal() as session:
        tasks = session.query(Task).all()
        return jsonify({'tasks': [row_to_task(t) for t in tasks]}), 200

@app.route('/tasks', methods=['POST'])
def create_new_task():
    req = request.get_json() or {}
    content = (req.get('content') or '').strip()
    if not content:
        return jsonify({'error': 'Content is required'}), 400

    t = Task(
        id=str(uuid.uuid4()),
        content=content,
        group_id=req.get('group_id'),
        status='pending',
        due_date=req.get('due_date'),
        time_range=req.get('time_range'),
        priority=req.get('priority', 'medium'),
        tags=req.get('tags', []),
        created_at=datetime.now(),
        updated_at=datetime.now()
    )
    with SessionLocal() as session:
        session.add(t)
        session.commit()
        return jsonify(row_to_task(t)), 201

@app.route('/tasks/<task_id>', methods=['PUT'])
def update_task(task_id):
    req = request.get_json() or {}
    with SessionLocal() as session:
        task = session.get(Task, task_id)
        if not task:
            return jsonify({'error': 'Task not found'}), 404

        allowed = ['content', 'group_id', 'due_date', 'time_range', 'priority', 'status', 'tags']
        for field in allowed:
            if field in req:
                if field == 'content':
                    val = (req[field] or '').strip()
                    if val:
                        setattr(task, field, val)
                else:
                    setattr(task, field, req[field])

        if 'status' in req and req['status'] not in ['pending', 'done']:
            return jsonify({'error': 'Status must be either "pending" or "done"'}), 400

        task.updated_at = datetime.now()
        session.commit()
        return jsonify(row_to_task(task)), 200

@app.route('/tasks/<task_id>', methods=['DELETE'])
def delete_task(task_id):
    with SessionLocal() as session:
        deleted = session.query(Task).filter(Task.id == task_id).delete()
        session.commit()
        if not deleted:
            return jsonify({'error': 'Task not found'}), 404
        return jsonify({'message': 'Task deleted successfully'}), 200

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)