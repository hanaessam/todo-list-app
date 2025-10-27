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

# ORM Models for Groups, Tasks, Tags 
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

class Tag(Base):
    __tablename__ = 'tags'
    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)
    color = Column(String, nullable=True)
    created_at = Column(DateTime, nullable=False)

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
    # t.tags is expected to be a list of tag IDs (strings). Expand them to tag objects.
    tag_objs = []
    if t.tags:
        try:
            with SessionLocal() as session:
                tag_rows = session.query(Tag).filter(Tag.id.in_(t.tags)).all()
                tag_map = {tg.id: tg for tg in tag_rows}
                for tid in t.tags:
                    tg = tag_map.get(tid)
                    if tg:
                        tag_objs.append({'id': tg.id, 'name': tg.name, 'color': tg.color})
        except Exception:
            # fallback: return raw ids if anything goes wrong
            tag_objs = t.tags

    return {
        'id': t.id,
        'content': t.content,
        'group_id': t.group_id,
        'status': t.status,
        'due_date': t.due_date,
        'time_range': t.time_range,
        'priority': t.priority,
        'tags': tag_objs,
        'created_at': t.created_at.isoformat(),
        'updated_at': t.updated_at.isoformat()
    }

# Routes
@app.route('/')
def home():
    return render_template('index.html')

# Groups API
# GET /groups
@app.route('/groups', methods=['GET'])
def get_groups():
    with SessionLocal() as session:
        groups = session.query(Group).all()
        return jsonify({'groups': [row_to_group(g) for g in groups]}), 200
# POST /groups
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
# DELETE /groups/<group_id>
@app.route('/groups/<group_id>', methods=['DELETE'])
def delete_group(group_id):
    with SessionLocal() as session:
        session.query(Task).filter(Task.group_id == group_id).update({'group_id': None})
        session.query(Group).filter(Group.id == group_id).delete()
        session.commit()
        return jsonify({'message': 'Group deleted successfully'}), 200

# Tasks API
# GET /tasks
@app.route('/tasks', methods=['GET'])
def get_tasks():
    with SessionLocal() as session:
        tasks = session.query(Task).all()
        return jsonify({'tasks': [row_to_task(t) for t in tasks]}), 200


# GET /tasks/today - tasks with due_date equal to today's date (YYYY-MM-DD)
@app.route('/tasks/today', methods=['GET'])
def get_tasks_today():
    today = datetime.now().date().isoformat()
    with SessionLocal() as session:
        tasks = session.query(Task).filter(Task.due_date == today).all()
        return jsonify({'tasks': [row_to_task(t) for t in tasks]}), 200


# GET /tasks/upcoming - tasks with due_date after today
@app.route('/tasks/upcoming', methods=['GET'])
def get_tasks_upcoming():
    today = datetime.now().date().isoformat()
    with SessionLocal() as session:
        tasks = session.query(Task).filter(Task.due_date != None, Task.due_date > today).all()
        return jsonify({'tasks': [row_to_task(t) for t in tasks]}), 200


# GET /tasks/pending - tasks with status pending
@app.route('/tasks/pending', methods=['GET'])
def get_tasks_pending():
    with SessionLocal() as session:
        tasks = session.query(Task).filter(Task.status == 'pending').all()
        return jsonify({'tasks': [row_to_task(t) for t in tasks]}), 200


# GET /tasks/completed - tasks with status done/completed
@app.route('/tasks/completed', methods=['GET'])
def get_tasks_completed():
    with SessionLocal() as session:
        tasks = session.query(Task).filter(Task.status == 'done').all()
        return jsonify({'tasks': [row_to_task(t) for t in tasks]}), 200
# POST /tasks
@app.route('/tasks', methods=['POST'])
def create_new_task():
    req = request.get_json() or {}
    content = (req.get('content') or '').strip()
    if not content:
        return jsonify({'error': 'Content is required'}), 400

    # If user did not supply due_date/time, default to now's date and time
    supplied_due = req.get('due_date')
    supplied_time = req.get('time_range')
    default_due = datetime.now().date().isoformat()
    default_time = datetime.now().strftime('%H:%M')

    t = Task(
        id=str(uuid.uuid4()),
        content=content,
        group_id=req.get('group_id'),
        status='pending',
        due_date=(supplied_due if supplied_due else default_due),
        time_range=(supplied_time if supplied_time else default_time),
        priority=req.get('priority', 'medium'),
        tags=req.get('tags', []),
        created_at=datetime.now(),
        updated_at=datetime.now()
    )
    with SessionLocal() as session:
        session.add(t)
        session.commit()
        return jsonify(row_to_task(t)), 201
# PUT /tasks/<task_id>
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

# DELETE /tasks/<task_id>
@app.route('/tasks/<task_id>', methods=['DELETE'])
def delete_task(task_id):
    with SessionLocal() as session:
        deleted = session.query(Task).filter(Task.id == task_id).delete()
        session.commit()
        if not deleted:
            return jsonify({'error': 'Task not found'}), 404
        return jsonify({'message': 'Task deleted successfully'}), 200

# Tags API
@app.route('/tags', methods=['GET'])
def get_tags():
    with SessionLocal() as session:
        tags = session.query(Tag).all()
        return jsonify({'tags': [
            {'id': tg.id, 'name': tg.name, 'color': tg.color, 'created_at': tg.created_at.isoformat()} for tg in tags
        ]}), 200


@app.route('/tags', methods=['POST'])
def create_tag():
    req = request.get_json() or {}
    name = (req.get('name') or '').strip()
    if not name:
        return jsonify({'error': 'Tag name is required'}), 400

    with SessionLocal() as session:
        existing = session.query(Tag).filter(Tag.name == name).first()
        if existing:
            return jsonify({'error': 'Tag already exists'}), 409

        tg = Tag(
            id=str(uuid.uuid4()),
            name=name,
            color=req.get('color'),
            created_at=datetime.now()
        )
        session.add(tg)
        session.commit()
        return jsonify({'id': tg.id, 'name': tg.name, 'color': tg.color, 'created_at': tg.created_at.isoformat()}), 201


@app.route('/tags/<tag_id>', methods=['PUT'])
def update_tag(tag_id):
    req = request.get_json() or {}
    with SessionLocal() as session:
        tag = session.get(Tag, tag_id)
        if not tag:
            return jsonify({'error': 'Tag not found'}), 404

        if 'name' in req:
            newname = (req['name'] or '').strip()
            if not newname:
                return jsonify({'error': 'Tag name cannot be empty'}), 400
            other = session.query(Tag).filter(Tag.name == newname, Tag.id != tag_id).first()
            if other:
                return jsonify({'error': 'Tag name already used'}), 409
            tag.name = newname

        if 'color' in req:
            tag.color = req['color']

        session.commit()
        return jsonify({'id': tag.id, 'name': tag.name, 'color': tag.color, 'created_at': tag.created_at.isoformat()}), 200


@app.route('/tags/<tag_id>', methods=['DELETE'])
def delete_tag(tag_id):
    with SessionLocal() as session:
        tag = session.get(Tag, tag_id)
        if not tag:
            return jsonify({'error': 'Tag not found'}), 404

        session.delete(tag)

        # Remove tag id from any tasks that include it
        tasks = session.query(Task).filter(Task.tags != None).all()
        for t in tasks:
            if t.tags and tag_id in t.tags:
                t.tags = [x for x in t.tags if x != tag_id]

        session.commit()
        return jsonify({'message': 'Tag deleted successfully'}), 200


# Get tasks by tag name
@app.route('/tasks/tag/<tag_id>', methods=['GET'])
def get_tasks_by_tag(tag_id):
    with SessionLocal() as session:
        # filter tasks where tags array contains tag_id
        tasks = session.query(Task).filter(Task.tags.contains([tag_id])).all()
        return jsonify({'tasks': [row_to_task(t) for t in tasks]}), 200


# Get tasks by group
@app.route('/groups/<group_id>/tasks', methods=['GET'])
def get_tasks_by_group(group_id):
    with SessionLocal() as session:
        tasks = session.query(Task).filter(Task.group_id == group_id).all()
        return jsonify({'tasks': [row_to_task(t) for t in tasks]}), 200


# GET /tasks/counts - overall counts and per-group counts
@app.route('/tasks/counts', methods=['GET'])
def get_tasks_counts():
    today = datetime.now().date().isoformat()
    with SessionLocal() as session:
        total = session.query(Task).count()
        completed = session.query(Task).filter(Task.status == 'done').count()
        pending = session.query(Task).filter(Task.status == 'pending').count()
        today_count = session.query(Task).filter(Task.due_date == today).count()
        upcoming = session.query(Task).filter(Task.due_date != None, Task.due_date > today).count()

        # counts per group
        groups = session.query(Group).all()
        per_group = []
        for g in groups:
            cnt = session.query(Task).filter(Task.group_id == g.id).count()
            per_group.append({'group_id': g.id, 'count': cnt})

        return jsonify({
            'total': total,
            'completed': completed,
            'pending': pending,
            'today': today_count,
            'upcoming': upcoming,
            'per_group': per_group
        }), 200


@app.route('/tasks/counts/summary', methods=['GET'])
def get_tasks_counts_summary():
    """Lightweight summary of top-level counts for badges and quick UI updates."""
    with SessionLocal() as session:
        total = session.query(Task).count()
        completed = session.query(Task).filter(Task.status == 'done').count()
        pending = session.query(Task).filter(Task.status == 'pending').count()
        return jsonify({'total': total, 'pending': pending, 'completed': completed}), 200


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)