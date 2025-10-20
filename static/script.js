// Global variables
let currentTasks = [];
let currentGroups = [];
let editingTaskId = null;
let currentFilter = 'all';
let currentTagFilter = null;

// DOM Content Loaded
document.addEventListener('DOMContentLoaded', async function() {
    await loadGroups();
    await loadTasks();
    setupEventListeners();
    updateStats();
});

// Event Listeners
function setupEventListeners() {
    // Search functionality
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', debounce(filterTasks, 300));
    
    // Navigation filters
    const navItems = document.querySelectorAll('.nav-item[data-filter]');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const filter = item.getAttribute('data-filter');
            setActiveFilter(filter);
        });
    });
    
    // Tag filters
    const tagFilters = document.querySelectorAll('.tag-filter');
    tagFilters.forEach(tag => {
        tag.addEventListener('click', () => {
            const tagName = tag.getAttribute('data-tag');
            setTagFilter(tagName);
        });
    });
    // Group creation
function addGroup() {
    const groupName = document.getElementById("new-group-name").value.trim();
    if (groupName) {
        const groupList = document.getElementById("groups-list");
        const newGroup = document.createElement("div");
        newGroup.className = "nav-item";
        newGroup.innerHTML = `<i class='fas fa-folder'></i> <span>${groupName}</span>`;
        groupList.appendChild(newGroup);
        document.getElementById("new-group-name").value = "";
    }
}
    // Modal escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            hideAllModals();
        }
    });
}

// Debounce function for search
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Load Groups
async function loadGroups() {
    try {
        const response = await fetch('/groups');
        const data = await response.json();
        currentGroups = data.groups;
        renderGroups();
        populateGroupSelects();
    } catch (error) {
        console.error('Error loading groups:', error);
        showToast('Error loading groups', 'error');
    }
}

// Load Tasks
async function loadTasks() {
    try {
        const response = await fetch('/tasks');
        const data = await response.json();
        currentTasks = data.tasks;
        renderTasks();
        updateStats();
    } catch (error) {
        console.error('Error loading tasks:', error);
        showToast('Error loading tasks', 'error');
    }
}

// Render Groups
function renderGroups() {
    const groupsList = document.getElementById('groups-list');
    
    groupsList.innerHTML = currentGroups.map(group => `
        <div class="nav-item" data-group="${group.id}">
            <span>${group.icon}</span>
            <span>${group.name}</span>
            <span class="nav-badge">${getTaskCountByGroup(group.id)}</span>
        </div>
    `).join('');
    
    // Add group click events
    const groupItems = document.querySelectorAll('.nav-item[data-group]');
    groupItems.forEach(item => {
        item.addEventListener('click', () => {
            const groupId = item.getAttribute('data-group');
            setGroupFilter(groupId);
        });
    });
}

// Populate Group Selects
function populateGroupSelects() {
    const groupSelects = document.querySelectorAll('select[id$="GroupSelect"]');
    
    groupSelects.forEach(select => {
        select.innerHTML = '<option value="">No Group</option>' + 
            currentGroups.map(group => 
                `<option value="${group.id}">${group.icon} ${group.name}</option>`
            ).join('');
    });
}

// Render Tasks
function renderTasks() {
    const tasksGrid = document.getElementById('tasks-grid');
    const filteredTasks = filterTasksByCriteria(currentTasks);
    
    // Group tasks by their group
    const tasksByGroup = {};
    const ungroupedTasks = [];
    
    filteredTasks.forEach(task => {
        if (task.group_id) {
            if (!tasksByGroup[task.group_id]) {
                tasksByGroup[task.group_id] = [];
            }
            tasksByGroup[task.group_id].push(task);
        } else {
            ungroupedTasks.push(task);
        }
    });
    
    let html = '';
    
    // Render grouped tasks
    currentGroups.forEach(group => {
        const groupTasks = tasksByGroup[group.id] || [];
        if (groupTasks.length > 0 || currentFilter === 'all') {
            html += `
                <div class="task-column">
                    <div class="column-header">
                        <h3>${group.icon} ${group.name}</h3>
                        <span class="column-count">${groupTasks.length}</span>
                    </div>
                    <div class="tasks-list">
                        ${groupTasks.length > 0 ? 
                            groupTasks.map(task => renderTaskCard(task)).join('') :
                            '<div class="empty-state"><i class="fas fa-inbox"></i><p>No tasks in this group</p></div>'
                        }
                    </div>
                </div>
            `;
        }
    });
    
    // Render ungrouped tasks
    if (ungroupedTasks.length > 0 || (currentFilter === 'all' && filteredTasks.length === 0)) {
        html += `
            <div class="task-column">
                <div class="column-header">
                    <h3>📋 Personal</h3>
                    <span class="column-count">${ungroupedTasks.length}</span>
                </div>
                <div class="tasks-list">
                    ${ungroupedTasks.length > 0 ? 
                        ungroupedTasks.map(task => renderTaskCard(task)).join('') :
                        '<div class="empty-state"><i class="fas fa-check-circle"></i><h4>All caught up!</h4><p>No tasks to display</p></div>'
                    }
                </div>
            </div>
        `;
    }
    
    tasksGrid.innerHTML = html || '<div class="empty-state"><i class="fas fa-check-circle"></i><h4>All caught up!</h4><p>No tasks match your filters</p></div>';
    
    // Add task event listeners
    addTaskEventListeners();
}

// Render Task Card
function renderTaskCard(task) {
    const group = currentGroups.find(g => g.id === task.group_id);
    const dueDate = task.due_date ? new Date(task.due_date) : null;
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    let dueText = '';
    if (dueDate) {
        if (dueDate.toDateString() === today.toDateString()) {
            dueText = 'Today';
        } else if (dueDate.toDateString() === tomorrow.toDateString()) {
            dueText = 'Tomorrow';
        } else {
            dueText = dueDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        }
    }
    
    return `
        <div class="task-card ${task.priority}-priority" data-task-id="${task.id}">
            <div class="task-header">
                <div class="task-content">${task.content}</div>
                <div class="task-actions">
                    <button class="icon-btn" onclick="editTask('${task.id}')" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="icon-btn" onclick="toggleTaskStatus('${task.id}')" title="${task.status === 'done' ? 'Mark pending' : 'Mark done'}">
                        <i class="fas ${task.status === 'done' ? 'fa-undo' : 'fa-check'}"></i>
                    </button>
                </div>
            </div>
            
            <div class="task-meta">
                ${group ? `
                    <div class="task-group">
                        <span class="task-group-badge" style="background: ${group.color}20; color: ${group.color};">
                            ${group.icon} ${group.name}
                        </span>
                    </div>
                ` : ''}
                ${dueText ? `<div class="task-time">${dueText} ${task.time_range || ''}</div>` : ''}
            </div>
            
            ${task.tags && task.tags.length > 0 ? `
                <div class="task-tags">
                    ${task.tags.map(tag => `<span class="task-tag">${tag}</span>`).join('')}
                </div>
            ` : ''}
            
            <div class="task-footer">
                <div class="task-priority priority-${task.priority}">
                    ${task.priority} priority
                </div>
                <div class="task-status">
                    <i class="fas ${task.status === 'done' ? 'fa-check-circle' : 'fa-clock'}"></i>
                    ${task.status === 'done' ? 'Completed' : 'Pending'}
                </div>
            </div>
        </div>
    `;
}

// Add Task Event Listeners
function addTaskEventListeners() {
    const taskCards = document.querySelectorAll('.task-card');
    taskCards.forEach(card => {
        card.addEventListener('click', (e) => {
            if (!e.target.closest('.task-actions')) {
                const taskId = card.getAttribute('data-task-id');
                editTask(taskId);
            }
        });
    });
}

// Filter Tasks
function filterTasks() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    renderTasks();
}

function filterTasksByCriteria(tasks) {
    let filtered = tasks;
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    
    // Search filter
    if (searchTerm) {
        filtered = filtered.filter(task => 
            task.content.toLowerCase().includes(searchTerm)
        );
    }
    
    // Date filters
    const today = new Date().toDateString();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toDateString();
    
    switch (currentFilter) {
        case 'today':
            filtered = filtered.filter(task => 
                task.due_date && new Date(task.due_date).toDateString() === today
            );
            break;
        case 'upcoming':
            filtered = filtered.filter(task => 
                task.due_date && new Date(task.due_date) > new Date()
            );
            break;
    }
    
    // Tag filter
    if (currentTagFilter) {
        filtered = filtered.filter(task => 
            task.tags && task.tags.includes(currentTagFilter)
        );
    }
    
    return filtered;
}

// Set Active Filter
function setActiveFilter(filter) {
    currentFilter = filter;
    
    // Update UI
    document.querySelectorAll('.nav-item[data-filter]').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`.nav-item[data-filter="${filter}"]`).classList.add('active');
    
    // Update page title
    const titleMap = {
        'all': 'All Tasks',
        'today': "Today's Tasks",
        'upcoming': 'Upcoming Tasks'
    };
    document.getElementById('page-title').textContent = titleMap[filter] || 'All Tasks';
    
    renderTasks();
}

function setTagFilter(tag) {
    currentTagFilter = currentTagFilter === tag ? null : tag;
    renderTasks();
}

function setGroupFilter(groupId) {
    // Implement group filtering if needed
    renderTasks();
}

// Update Statistics
function updateStats() {
    const totalTasks = currentTasks.length;
    const completedTasks = currentTasks.filter(task => task.status === 'done').length;
    
    document.getElementById('total-tasks').textContent = totalTasks;
    document.getElementById('completed-tasks').textContent = completedTasks;
    document.getElementById('all-count').textContent = totalTasks;
    
    // Update today and upcoming counts
    const today = new Date().toDateString();
    const todayCount = currentTasks.filter(task => 
        task.due_date && new Date(task.due_date).toDateString() === today
    ).length;
    
    const upcomingCount = currentTasks.filter(task => 
        task.due_date && new Date(task.due_date) > new Date()
    ).length;
    
    document.getElementById('today-count').textContent = todayCount;
    document.getElementById('upcoming-count').textContent = upcomingCount;
}

function getTaskCountByGroup(groupId) {
    return currentTasks.filter(task => task.group_id === groupId).length;
}

// Modal Functions
function showAddTaskModal() {
    document.getElementById('addTaskModal').style.display = 'block';
    document.getElementById('taskContentInput').value = '';
    document.getElementById('taskDueDate').value = '';
    document.getElementById('taskDueTime').value = '';
    document.getElementById('taskPrioritySelect').value = 'medium';
    document.getElementById('taskGroupSelect').value = '';
    document.getElementById('tagsContainer').innerHTML = '<input type="text" id="tagInput" placeholder="Add tags...">';
    document.getElementById('taskContentInput').focus();
}

function hideAddTaskModal() {
    document.getElementById('addTaskModal').style.display = 'none';
}

function showEditTaskModal(task) {
    editingTaskId = task.id;
    const modal = document.getElementById('editTaskModal');
    const body = modal.querySelector('.modal-body');
    
    body.innerHTML = `
        <div class="form-group">
            <label for="editTaskContentInput">Task Description</label>
            <textarea id="editTaskContentInput" placeholder="What needs to be done?" rows="3">${task.content}</textarea>
        </div>
        
        <div class="form-row">
            <div class="form-group">
                <label for="editTaskGroupSelect">Group</label>
                <select id="editTaskGroupSelect">
                    <option value="">No Group</option>
                    ${currentGroups.map(group => 
                        `<option value="${group.id}" ${task.group_id === group.id ? 'selected' : ''}>${group.icon} ${group.name}</option>`
                    ).join('')}
                </select>
            </div>
            <div class="form-group">
                <label for="editTaskPrioritySelect">Priority</label>
                <select id="editTaskPrioritySelect">
                    <option value="low" ${task.priority === 'low' ? 'selected' : ''}>Low</option>
                    <option value="medium" ${task.priority === 'medium' ? 'selected' : ''}>Medium</option>
                    <option value="high" ${task.priority === 'high' ? 'selected' : ''}>High</option>
                </select>
            </div>
        </div>

        <div class="form-row">
            <div class="form-group">
                <label for="editTaskDueDate">Due Date</label>
                <input type="date" id="editTaskDueDate" value="${task.due_date || ''}">
            </div>
            <div class="form-group">
                <label for="editTaskDueTime">Time</label>
                <input type="time" id="editTaskDueTime" value="${task.time_range ? task.time_range.split(' – ')[0] : ''}">
            </div>
        </div>

        <div class="form-group">
            <label>Tags</label>
            <div class="tags-input-container" id="editTagsContainer">
                ${task.tags && task.tags.map(tag => `
                    <div class="tag-pill">
                        ${tag}
                        <span class="remove-tag" onclick="removeEditTag('${tag}')">×</span>
                    </div>
                `).join('')}
                <input type="text" id="editTagInput" placeholder="Add tags...">
            </div>
        </div>
    `;
    
    // Add tag input event listener
    const tagInput = document.getElementById('editTagInput');
    tagInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && this.value.trim()) {
            addEditTag(this.value.trim());
            this.value = '';
        }
    });
    
    modal.style.display = 'block';
}

function hideEditTaskModal() {
    document.getElementById('editTaskModal').style.display = 'none';
    editingTaskId = null;
}

function showCreateGroupModal() {
    document.getElementById('createGroupModal').style.display = 'block';
    document.getElementById('groupNameInput').value = '';
    document.getElementById('groupNameInput').focus();
}

function hideCreateGroupModal() {
    document.getElementById('createGroupModal').style.display = 'none';
}

function hideAllModals() {
    hideAddTaskModal();
    hideEditTaskModal();
    hideCreateGroupModal();
}

// Task CRUD Operations
async function addTask() {
    const content = document.getElementById('taskContentInput').value.trim();
    const groupId = document.getElementById('taskGroupSelect').value || null;
    const priority = document.getElementById('taskPrioritySelect').value;
    const dueDate = document.getElementById('taskDueDate').value;
    const dueTime = document.getElementById('taskDueTime').value;
    
    if (!content) {
        showToast('Please enter task content', 'error');
        return;
    }
    
    let timeRange = '';
    if (dueTime) {
        timeRange = formatTime(dueTime);
    }
    
    const tags = Array.from(document.querySelectorAll('#tagsContainer .tag-pill'))
        .map(pill => pill.textContent.replace('×', '').trim());
    
    try {
        const response = await fetch('/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content,
                group_id: groupId,
                priority,
                due_date: dueDate || null,
                time_range: timeRange,
                tags
            })
        });
        
        if (response.ok) {
            hideAddTaskModal();
            await loadTasks();
            showToast('Task created successfully!');
        } else {
            showToast('Error creating task', 'error');
        }
    } catch (error) {
        console.error('Error adding task:', error);
        showToast('Error creating task', 'error');
    }
}

async function editTask(taskId) {
    const task = currentTasks.find(t => t.id === taskId);
    if (task) {
        showEditTaskModal(task);
    }
}

async function updateTask() {
    if (!editingTaskId) return;
    
    const content = document.getElementById('editTaskContentInput').value.trim();
    const groupId = document.getElementById('editTaskGroupSelect').value || null;
    const priority = document.getElementById('editTaskPrioritySelect').value;
    const dueDate = document.getElementById('editTaskDueDate').value;
    const dueTime = document.getElementById('editTaskDueTime').value;
    
    if (!content) {
        showToast('Please enter task content', 'error');
        return;
    }
    
    let timeRange = '';
    if (dueTime) {
        timeRange = formatTime(dueTime);
    }
    
    const tags = Array.from(document.querySelectorAll('#editTagsContainer .tag-pill'))
        .map(pill => pill.textContent.replace('×', '').trim());
    
    try {
        const response = await fetch(`/tasks/${editingTaskId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content,
                group_id: groupId,
                priority,
                due_date: dueDate || null,
                time_range: timeRange,
                tags
            })
        });
        
        if (response.ok) {
            hideEditTaskModal();
            await loadTasks();
            showToast('Task updated successfully!');
        } else {
            showToast('Error updating task', 'error');
        }
    } catch (error) {
        console.error('Error updating task:', error);
        showToast('Error updating task', 'error');
    }
}

async function deleteCurrentTask() {
    if (!editingTaskId) return;
    
    if (confirm('Are you sure you want to delete this task?')) {
        try {
            const response = await fetch(`/tasks/${editingTaskId}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                hideEditTaskModal();
                await loadTasks();
                showToast('Task deleted successfully!');
            } else {
                showToast('Error deleting task', 'error');
            }
        } catch (error) {
            console.error('Error deleting task:', error);
            showToast('Error deleting task', 'error');
        }
    }
}

async function toggleTaskStatus(taskId) {
    const task = currentTasks.find(t => t.id === taskId);
    if (!task) return;
    
    const newStatus = task.status === 'pending' ? 'done' : 'pending';
    
    try {
        const response = await fetch(`/tasks/${taskId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        
        if (response.ok) {
            await loadTasks();
            showToast(`Task marked as ${newStatus}`);
        }
    } catch (error) {
        console.error('Error updating task status:', error);
        showToast('Error updating task', 'error');
    }
}

// Group Operations
async function createGroup() {
    const name = document.getElementById('groupNameInput').value.trim();
    const icon = document.getElementById('groupIconSelect').value;
    
    if (!name) {
        showToast('Please enter group name', 'error');
        return;
    }
    
    try {
        const response = await fetch('/groups', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, icon })
        });
        
        if (response.ok) {
            hideCreateGroupModal();
            await loadGroups();
            showToast('Group created successfully!');
        } else {
            showToast('Error creating group', 'error');
        }
    } catch (error) {
        console.error('Error creating group:', error);
        showToast('Error creating group', 'error');
    }
}

// Tag Functions
function addEditTag(tag) {
    const container = document.getElementById('editTagsContainer');
    const existingTags = Array.from(container.querySelectorAll('.tag-pill'))
        .map(pill => pill.textContent.replace('×', '').trim());
    
    if (!existingTags.includes(tag)) {
        const tagPill = document.createElement('div');
        tagPill.className = 'tag-pill';
        tagPill.innerHTML = `
            ${tag}
            <span class="remove-tag" onclick="removeEditTag('${tag}')">×</span>
        `;
        container.insertBefore(tagPill, container.lastElementChild);
    }
}

function removeEditTag(tag) {
    const container = document.getElementById('editTagsContainer');
    const tagPills = container.querySelectorAll('.tag-pill');
    
    tagPills.forEach(pill => {
        if (pill.textContent.replace('×', '').trim() === tag) {
            pill.remove();
        }
    });
}

// Utility Functions
function formatTime(timeString) {
    if (!timeString) return '';
    
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    
    return `${displayHour}:${minutes} ${ampm}`;
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function toggleSidebar() {
    document.querySelector('.sidebar').classList.toggle('open');
}

// Initialize tag input
document.addEventListener('DOMContentLoaded', function() {
    const tagInput = document.getElementById('tagInput');
    if (tagInput) {
        tagInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && this.value.trim()) {
                const container = this.parentElement;
                const tag = this.value.trim();
                const existingTags = Array.from(container.querySelectorAll('.tag-pill'))
                    .map(pill => pill.textContent.replace('×', '').trim());
                
                if (!existingTags.includes(tag)) {
                    const tagPill = document.createElement('div');
                    tagPill.className = 'tag-pill';
                    tagPill.innerHTML = `
                        ${tag}
                        <span class="remove-tag" onclick="this.parentElement.remove()">×</span>
                    `;
                    container.insertBefore(tagPill, this);
                }
                
                this.value = '';
            }
        });
    }
});