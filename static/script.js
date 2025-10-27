// Global variables
let currentTasks = [];
let currentGroups = [];
let currentTags = [];
let editingTaskId = null;
let currentFilter = 'all';
let currentTagFilter = null;
let currentCounts = null; // full counts (may include per_group)
let currentCountsSummary = null; // lightweight summary (total, pending, completed)

// DOM Content Loaded
document.addEventListener('DOMContentLoaded', async function() {
    await loadGroups();
    await loadTags();
    await loadTasks();
    await loadCountsSummary();
    setupEventListeners();
    updateStats();
    // initialize color palettes for tag modals
    setupColorPalettes();
    // hook displays for hex values
    hookColorValueDisplays();
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
        await renderGroups();
        showToast('Error loading groups', 'error');
    }
}


// lightweight counts summary: total/pending/completed
async function loadCountsSummary() {
    try {
        const res = await fetch('/tasks/counts/summary');
        const data = await res.json();
        currentCountsSummary = data;
        // update UI badges (use summary)
        updateStats();
    } catch (err) {
        console.error('Error loading counts summary', err);
    }
}

// full counts including per-group numbers (heavier)
async function loadCounts() {
    try {
        const res = await fetch('/tasks/counts');
        const data = await res.json();
        currentCounts = data;
        // update UI badges
        updateStats();
        // re-render groups so their badges update
        renderGroups();
    } catch (err) {
        console.error('Error loading counts', err);
    }
}
// Load Tags
async function loadTags() {
    try {
        const response = await fetch('/tags');
        const data = await response.json();
        const tags = data.tags || [];
        currentTags = tags;
        renderTags(tags);
    } catch (error) {
        console.error('Error loading tags:', error);
        showToast('Error loading tags', 'error');
    }
}

function renderTags(tags) {
    const tagsList = document.querySelector('.tags-list');
    if (!tagsList) return;

    // keep Add Tag button at the end
    const addButton = `<button class="add-tag-btn" onclick="openCreateTagModal()">
                                <i class="fas fa-plus"></i>
                                Add Tag
                            </button>`;

    const tagHtml = tags.map(t => `
        <div class="tag-filter" data-tag-id="${t.id}" title="${t.name}">
            <span class="tag-bubble" style="background:${t.color || '#ddd'}"></span>
            <span>${t.name}</span>
            <span class="tag-actions">
                <button class="icon-btn small" onclick="openEditTagModal('${t.id}')" title="Edit tag"><i class="fas fa-edit"></i></button>
                <button class="icon-btn small" onclick="deleteTag('${t.id}')" title="Delete tag"><i class="fas fa-trash"></i></button>
            </span>
        </div>
    `).join('');

    tagsList.innerHTML = tagHtml + addButton;

    // Attach click listeners (filter by id)
    const tagFilters = tagsList.querySelectorAll('.tag-filter');
    tagFilters.forEach(tag => {
        tag.addEventListener('click', (e) => {
            // ignore clicks on action buttons
            if (e.target.closest('.tag-actions')) return;
            const tagId = tag.getAttribute('data-tag-id');
            setTagFilter(tagId);
        });
    });

    // update any multi-select widgets on the page
    populateMultiSelects();
}

function populateMultiSelects() {
    // Initialize all .multi-select widgets on the page using currentTags
    const widgets = document.querySelectorAll('.multi-select');
    widgets.forEach(widget => {
        initializeMultiSelect(widget, []);
    });
}

function initializeMultiSelect(rootElementOrId, preselectedIds = []) {
    const root = typeof rootElementOrId === 'string' ? document.getElementById(rootElementOrId) : rootElementOrId;
    if (!root) return;

    const chips = root.querySelector('.chips');
    const input = root.querySelector('.multi-input');
    const options = root.querySelector('.options');

    // build options from currentTags
    const buildOptions = () => {
        if (!options) return;
        options.innerHTML = currentTags.map(t => `
            <div class="option" data-id="${t.id}" data-color="${t.color || '#ccc'}">
                <span class="tag-bubble" style="background:${t.color || '#ccc'}"></span>
                <span class="option-label">${t.name}</span>
            </div>
        `).join('') || `<div class="no-options">No tags available</div>`;

        // mark preselected
        preselectedIds.forEach(id => {
            const opt = options.querySelector(`.option[data-id="${id}"]`);
            if (opt) opt.classList.add('selected');
        });
    };

    const openOptions = () => { if (options) options.style.display = 'block'; };
    const closeOptions = () => { if (options) options.style.display = 'none'; };

    const clearChips = () => {
        if (!chips) return;
        chips.innerHTML = '';
    };

    const addChip = (id, name, color) => {
        if (!chips) return;
        // prevent duplicates
        if (chips.querySelector(`.chip[data-id="${id}"]`)) return;
        const chip = document.createElement('span');
        chip.className = 'chip';
        chip.setAttribute('data-id', id);
        chip.innerHTML = `<span class="tag-bubble" style="background:${color}"></span><span class="chip-label">${name}</span><span class="remove-chip">×</span>`;
        chips.appendChild(chip);

        // remove handler
        chip.querySelector('.remove-chip').addEventListener('click', (e) => {
            e.stopPropagation();
            // unselect option
            const opt = options && options.querySelector(`.option[data-id="${id}"]`);
            if (opt) opt.classList.remove('selected');
            chip.remove();
        });
    };

    const removeChipById = (id) => {
        if (!chips) return;
        const chip = chips.querySelector(`.chip[data-id="${id}"]`);
        if (chip) chip.remove();
    };

    const getSelectedIds = () => {
        if (!chips) return [];
        return Array.from(chips.querySelectorAll('.chip')).map(c => c.getAttribute('data-id'));
    };

    // build options initially
    buildOptions();

    // preselect chips
    if (preselectedIds && preselectedIds.length) {
        preselectedIds.forEach(id => {
            const tag = currentTags.find(t => t.id === id);
            if (tag) addChip(tag.id, tag.name, tag.color || '#ccc');
        });
    }

    // option click handler (use event delegation)
    if (options) {
        options.addEventListener('click', (e) => {
            const opt = e.target.closest('.option');
            if (!opt) return;
            const id = opt.getAttribute('data-id');
            const label = opt.querySelector('.option-label').textContent;
            const color = opt.getAttribute('data-color') || '#ccc';

            if (opt.classList.contains('selected')) {
                opt.classList.remove('selected');
                removeChipById(id);
            } else {
                opt.classList.add('selected');
                addChip(id, label, color);
            }
        });
    }

    // input handlers for search/filter
    if (input) {
        input.addEventListener('focus', () => { buildOptions(); openOptions(); });
        input.addEventListener('click', (e) => { e.stopPropagation(); buildOptions(); openOptions(); });
        input.addEventListener('input', () => {
            const q = input.value.trim().toLowerCase();
            if (!options) return;
            const opts = Array.from(options.querySelectorAll('.option'));
            let any = false;
            opts.forEach(o => {
                const label = o.querySelector('.option-label').textContent.toLowerCase();
                if (label.includes(q)) { o.style.display = ''; any = true; } else { o.style.display = 'none'; }
            });
            // show a message if no matches
            if (!any) {
                options.innerHTML = `<div class="no-options">No tags match "${input.value}"</div>`;
            }
        });
    }

    // close if clicked outside (store handler on the root so we can remove it later)
    if (root._outsideClickHandler) document.removeEventListener('click', root._outsideClickHandler);
    root._outsideClickHandler = (e) => {
        if (!root.contains(e.target)) {
            closeOptions();
        }
    };
    setTimeout(() => document.addEventListener('click', root._outsideClickHandler));

    // store helpers on the root for later queries
    root.getSelectedIds = getSelectedIds;
    root.clearSelection = () => { clearChips(); const opts = options && options.querySelectorAll('.option'); if (opts) opts.forEach(o => o.classList.remove('selected')); };
}

function openCreateTagModal() {
    document.getElementById('createTagModal').style.display = 'block';
    document.getElementById('newTagName').value = '';
    document.getElementById('newTagColor').value = '#cccccc';
}

function closeCreateTagModal() {
    document.getElementById('createTagModal').style.display = 'none';
}

function createTagFromModal() {
    const name = document.getElementById('newTagName').value.trim();
    const color = document.getElementById('newTagColor').value;
    if (!name) { showToast('Tag name required', 'error'); return; }

    fetch('/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color })
    }).then(r => {
        if (r.ok) {
            closeCreateTagModal();
            loadTags();
            showToast('Tag created');
        } else if (r.status === 409) {
            showToast('Tag already exists', 'error');
        } else {
            showToast('Error creating tag', 'error');
        }
    }).catch(err => { console.error(err); showToast('Error creating tag', 'error'); });
}

function openEditTagModal(tagId) {
    fetch(`/tags`)
        .then(r => r.json())
        .then(data => {
            const tg = (data.tags || []).find(x => x.id === tagId);
            if (!tg) { showToast('Tag not found', 'error'); return; }
            document.getElementById('editTagId').value = tg.id;
            document.getElementById('editTagName').value = tg.name;
            document.getElementById('editTagColor').value = tg.color || '#cccccc';
            document.getElementById('editTagModal').style.display = 'block';
        });
}

function closeEditTagModal() {
    document.getElementById('editTagModal').style.display = 'none';
}

function updateTagFromModal() {
    const id = document.getElementById('editTagId').value;
    const name = document.getElementById('editTagName').value.trim();
    const color = document.getElementById('editTagColor').value;
    if (!name) { showToast('Tag name required', 'error'); return; }

    fetch(`/tags/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color })
    }).then(r => {
        if (r.ok) {
            closeEditTagModal();
            loadTags();
            showToast('Tag updated');
        } else if (r.status === 409) {
            showToast('Tag name already used', 'error');
        } else {
            showToast('Error updating tag', 'error');
        }
    }).catch(err => { console.error(err); showToast('Error updating tag', 'error'); });
}

function deleteTag(tagId) {
    if (!confirm('Delete this tag? It will be removed from tasks.')) return;
    fetch(`/tags/${encodeURIComponent(tagId)}`, { method: 'DELETE' })
        .then(r => {
            if (r.ok) { loadTags(); loadTasks(); showToast('Tag deleted'); }
            else showToast('Error deleting tag', 'error');
        }).catch(err => { console.error(err); showToast('Error deleting tag', 'error'); });
}

function deleteTagFromModal() {
    const id = document.getElementById('editTagId').value;
    deleteTag(id);
    closeEditTagModal();
}

// create tag flow uses modal: openCreateTagModal() / createTagFromModal()

// Load Tasks
async function loadTasks() {
    try {
        const response = await fetch('/tasks');
        const data = await response.json();
        currentTasks = data.tasks;
        renderTasks();
        updateStats();
        // keep counts up to date
        await loadCountsSummary();
    } catch (error) {
        console.error('Error loading tasks:', error);
        showToast('Error loading tasks', 'error');
    }
}

// Render Groups
function renderGroups() {
    const groupsList = document.getElementById('groups-list');
    
    // use counts from server when available
    const groupCountsMap = (currentCounts && currentCounts.per_group) ? Object.fromEntries(currentCounts.per_group.map(g => [g.group_id, g.count])) : {};

    // If full counts aren't loaded yet, attempt to compute a best-effort map from currentTasks
    if (!currentCounts) {
        const bestEffort = {};
        currentTasks.forEach(t => {
            if (t.group_id) bestEffort[t.group_id] = (bestEffort[t.group_id] || 0) + 1;
        });
        // merge bestEffort values where groupCountsMap doesn't have them
        Object.keys(bestEffort).forEach(k => { if (!groupCountsMap[k]) groupCountsMap[k] = bestEffort[k]; });
        // kick off a background refresh of full counts so per-group badges become accurate
        loadCounts().catch(err => console.error('Error loading full counts in background', err));
    }

    groupsList.innerHTML = currentGroups.map(group => `
        <div class="nav-item" data-group="${group.id}">
            <span>${group.icon}</span>
            <span>${group.name}</span>
            <span class="nav-badge">${groupCountsMap[group.id] || 0}</span>
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
    // Only render groups that actually have tasks (avoid empty group columns)
    currentGroups.forEach(group => {
        const groupTasks = tasksByGroup[group.id] || [];
        if (groupTasks.length > 0) {
            html += `
                <div class="task-column">
                    <div class="column-header">
                        <h3>${group.icon} ${group.name}</h3>
                        <span class="column-count">${groupTasks.length}</span>
                    </div>
                    <div class="tasks-list">
                        ${groupTasks.map(task => renderTaskCard(task)).join('')}
                    </div>
                </div>
            `;
        }
    });
    
    // Render ungrouped tasks
    // Render ungrouped only if there are ungrouped tasks
    if (ungroupedTasks.length > 0) {
        html += `
            <div class="task-column">
                <div class="column-header">
                    <h3>📋 Ungrouped</h3>
                    <span class="column-count">${ungroupedTasks.length}</span>
                </div>
                <div class="tasks-list">
                    ${ungroupedTasks.map(task => renderTaskCard(task)).join('')}
                </div>
            </div>
        `;
    }
    
    // If nothing to show, present friendly empty-state
    tasksGrid.innerHTML = html || '<div class="empty-state"><i class="fas fa-check-circle"></i><h4>All caught up!</h4><p>No tasks match your filters</p></div>';
    
    // Add task event listeners
    addTaskEventListeners();
    
    // populate week view with tasks for the current week
    populateWeekView();
}

// Populate week view calendar with tasks due this week
function populateWeekView() {
    const weekContainer = document.querySelector('.week-days');
    if (!weekContainer) return;

    // compute Monday as start of week
    const today = new Date();
    const day = today.getDay(); // 0 (Sun) - 6
    const diffToMonday = ((day + 6) % 7); // days since Monday
    const monday = new Date(today);
    monday.setDate(today.getDate() - diffToMonday);

    // create 7 day columns
    const days = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        days.push(d);
    }

    // build HTML for the week view
    let html = '';
    days.forEach(d => {
        const dayTasks = currentTasks.filter(t => t.due_date && new Date(t.due_date).toDateString() === d.toDateString());
        const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });

        html += `
            <div class="day-column">
                <div class="day-header">${dayLabel}</div>
                <div class="time-slots">
                    ${dayTasks.map(dt => `<div class="time-slot" data-task-id="${dt.id}">${dt.time_range ? formatTime(dt.time_range) + ' — ' : ''}${dt.content}</div>`).join('')}
                </div>
            </div>
        `;
    });

    weekContainer.innerHTML = html;
    // attach click handlers to open task editor
    weekContainer.querySelectorAll('.time-slot').forEach(slot => {
        slot.addEventListener('click', () => {
            const id = slot.getAttribute('data-task-id');
            if (id) editTask(id);
        });
    });
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
                    <button class="icon-btn" onclick="deleteTaskFromCard('${task.id}')" title="Delete">
                        <i class="fas fa-trash"></i>
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
                ${dueText ? `<div class="task-time">${dueText} ${task.time_range ? formatTime(task.time_range) : ''}</div>` : ''}
            </div>
            
            ${task.tags && task.tags.length > 0 ? `
                <div class="task-tags">
                    ${task.tags.map(tag => `<span class="task-tag" style="background:${tag.color || '#eee'}">${tag.name}</span>`).join('')}
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
    
    // Tag filter — task.tags is an array of tag objects ({id,...})
    if (currentTagFilter) {
        filtered = filtered.filter(task => 
            task.tags && task.tags.some(t => t.id === currentTagFilter)
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
        'upcoming': 'Upcoming Tasks',
        'pending': 'Pending Tasks',
        'completed': 'Completed Tasks'
    };
    document.getElementById('page-title').textContent = titleMap[filter] || 'All Tasks';
    
    // Use server endpoints for certain filters
    if (filter === 'today') {
        fetch('/tasks/today').then(r => r.json()).then(data => { currentTasks = data.tasks || []; renderTasks(); updateStats(); }).catch(err => { console.error('Error loading today tasks', err); showToast('Error loading tasks', 'error'); });
    } else if (filter === 'upcoming') {
        fetch('/tasks/upcoming').then(r => r.json()).then(data => { currentTasks = data.tasks || []; renderTasks(); updateStats(); }).catch(err => { console.error('Error loading upcoming tasks', err); showToast('Error loading tasks', 'error'); });
    } else if (filter === 'pending') {
        fetch('/tasks/pending').then(r => r.json()).then(data => { currentTasks = data.tasks || []; renderTasks(); updateStats(); }).catch(err => { console.error('Error loading pending tasks', err); showToast('Error loading tasks', 'error'); });
    } else if (filter === 'completed') {
        fetch('/tasks/completed').then(r => r.json()).then(data => { currentTasks = data.tasks || []; renderTasks(); updateStats(); }).catch(err => { console.error('Error loading completed tasks', err); showToast('Error loading tasks', 'error'); });
    } else if (filter === 'all') {
        loadTasks();
    } else {
        renderTasks();
    }
}

function setTagFilter(tag) {
    // toggle
    if (currentTagFilter === tag) {
        currentTagFilter = null;
        // reload all tasks
        loadTasks();
    } else {
        currentTagFilter = tag;
        // fetch tasks by tag from server
        fetch(`/tasks/tag/${encodeURIComponent(tag)}`)
            .then(r => r.json())
            .then(data => {
                currentTasks = data.tasks || [];
                renderTasks();
                updateStats();
            }).catch(err => {
                console.error('Error fetching tasks by tag', err);
                showToast('Error fetching tasks by tag', 'error');
            });
    }
}

function setGroupFilter(groupId) {
    // fetch tasks for the group from server
    const group = currentGroups.find(g => g.id === groupId);
    if (group) {
        document.getElementById('page-title').textContent = `${group.icon} ${group.name}`;
    }

    // clear any tag filter so group selection shows group's tasks
    currentTagFilter = null;
    fetch(`/groups/${encodeURIComponent(groupId)}/tasks`)
        .then(r => r.json())
        .then(data => {
            currentTasks = data.tasks || [];
            renderTasks();
            updateStats();
        }).catch(err => {
            console.error('Error fetching tasks by group', err);
            showToast('Error fetching tasks by group', 'error');
        });
}

// Update Statistics
function updateStats() {
    // Prefer server-provided full counts when available, otherwise use lightweight summary
    if (currentCounts) {
        document.getElementById('total-tasks').textContent = currentCounts.total;
        document.getElementById('completed-tasks').textContent = currentCounts.completed;
        document.getElementById('all-count').textContent = currentCounts.total;
        const pendingBadge = document.getElementById('pending-count');
        if (pendingBadge) pendingBadge.textContent = currentCounts.pending;
        const completedBadge = document.getElementById('completed-count');
        if (completedBadge) completedBadge.textContent = currentCounts.completed;
        document.getElementById('today-count').textContent = currentCounts.today;
        document.getElementById('upcoming-count').textContent = currentCounts.upcoming;
    } else if (currentCountsSummary) {
        // lightweight summary available
        document.getElementById('total-tasks').textContent = currentCountsSummary.total;
        document.getElementById('completed-tasks').textContent = currentCountsSummary.completed;
        document.getElementById('all-count').textContent = currentCountsSummary.total;
        const pendingBadge = document.getElementById('pending-count');
        if (pendingBadge) pendingBadge.textContent = currentCountsSummary.pending;
        const completedBadge = document.getElementById('completed-count');
        if (completedBadge) completedBadge.textContent = currentCountsSummary.completed;
        // today/upcoming are not part of summary; fall back to client computation
        const today = new Date().toDateString();
        const todayCount = currentTasks.filter(task => task.due_date && new Date(task.due_date).toDateString() === today).length;
        const upcomingCount = currentTasks.filter(task => task.due_date && new Date(task.due_date) > new Date()).length;
        document.getElementById('today-count').textContent = todayCount;
        document.getElementById('upcoming-count').textContent = upcomingCount;
    } else {
        const totalTasks = currentTasks.length;
        const completedTasks = currentTasks.filter(task => task.status === 'done').length;
        
        document.getElementById('total-tasks').textContent = totalTasks;
        document.getElementById('completed-tasks').textContent = completedTasks;
        document.getElementById('all-count').textContent = totalTasks;
        
        // Update today and upcoming counts based on currentTasks
        const today = new Date().toDateString();
        const todayCount = currentTasks.filter(task => 
            task.due_date && new Date(task.due_date).toDateString() === today
        ).length;
        
        const upcomingCount = currentTasks.filter(task => 
            task.due_date && new Date(task.due_date) > new Date()
        ).length;
        
        document.getElementById('today-count').textContent = todayCount;
        document.getElementById('upcoming-count').textContent = upcomingCount;
        const pendingBadge = document.getElementById('pending-count');
        if (pendingBadge) pendingBadge.textContent = currentTasks.filter(t => t.status === 'pending').length;
        const completedBadge = document.getElementById('completed-count');
        if (completedBadge) completedBadge.textContent = completedTasks;
    }
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
    // initialize/populate multi-select for tags
    populateMultiSelects();
    const addWidget = document.getElementById('taskTagMulti');
    if (addWidget && addWidget.clearSelection) addWidget.clearSelection();
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
                <input type="time" id="editTaskDueTime" value="${task.time_range || ''}">
            </div>
        </div>

        <div class="form-group">
            <label>Tags</label>
            <div class="tags-input-container" id="editTagsContainer">
                <div class="multi-select" id="editTaskTagMulti">
                    <div class="chips" id="editTaskTagChips"></div>
                    <input type="text" class="multi-input" id="editTaskTagInput" placeholder="Search tags or add..." autocomplete="off">
                    <div class="options" id="editTaskTagOptions" style="display:none"></div>
                </div>
            </div>
        </div>
    `;
    
    // Add tag input event listener
    // initialize multi-select for edit with preselected tag ids
    const selectedIds = task.tags ? task.tags.map(t => t.id) : [];
    // populate options then initialize with selected ids
    populateMultiSelects();
    const editWidget = document.getElementById('editTaskTagMulti');
    if (editWidget) initializeMultiSelect(editWidget, selectedIds);
    
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
        // store raw HH:MM string for easier editing; format for display
        timeRange = dueTime;
    }
    
    const addWidget = document.getElementById('taskTagMulti');
    const tags = addWidget && addWidget.getSelectedIds ? addWidget.getSelectedIds() : [];
    
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
        timeRange = dueTime; // keep raw HH:MM
    }
    
    const editWidget = document.getElementById('editTaskTagMulti');
    const tags = editWidget && editWidget.getSelectedIds ? editWidget.getSelectedIds() : [];
    
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

// Delete directly from card (inline delete)
async function deleteTaskFromCard(taskId) {
    if (!taskId) return;
    if (!confirm('Are you sure you want to delete this task?')) return;

    try {
        const response = await fetch(`/tasks/${taskId}`, { method: 'DELETE' });
        if (response.ok) {
            await loadTasks();
            showToast('Task deleted successfully!');
        } else {
            showToast('Error deleting task', 'error');
        }
    } catch (err) {
        console.error('Error deleting task from card:', err);
        showToast('Error deleting task', 'error');
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

// Color palette setup for tag modals
function setupColorPalettes() {
    const palette = ['#ef4444','#f97316','#f59e0b','#eab308','#10b981','#06b6d4','#3b82f6','#8b5cf6','#ec4899','#9ca3af'];
    const newContainer = document.getElementById('newTagPalette');
    const editContainer = document.getElementById('editTagPalette');

    const build = (container, inputId) => {
        if (!container) return;
        container.innerHTML = palette.map(c => `<button type="button" class="color-swatch" data-color="${c}" style="background:${c}" title="${c}"></button>`).join('');
        container.querySelectorAll('.color-swatch').forEach(btn => {
            btn.addEventListener('click', () => {
                const color = btn.getAttribute('data-color');
                const input = document.getElementById(inputId);
                if (input) input.value = color;
                // visual feedback
                container.querySelectorAll('.color-swatch').forEach(b=>b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
    };

    build(newContainer, 'newTagColor');
    build(editContainer, 'editTagColor');
}

// Update color value text next to inputs and hook input events
function hookColorValueDisplays() {
    const newInput = document.getElementById('newTagColor');
    const editInput = document.getElementById('editTagColor');
    const newVal = document.getElementById('newTagColorValue');
    const editVal = document.getElementById('editTagColorValue');

    const setVal = (el, display) => {
        if (!el || !display) return;
        display.textContent = el.value.toLowerCase();
        // try to mark active swatch
        const container = display.parentElement.nextElementSibling; // color-palette
        if (container) {
            container.querySelectorAll('.color-swatch').forEach(b => b.classList.toggle('active', b.getAttribute('data-color').toLowerCase() === el.value.toLowerCase()));
        }
    };

    if (newInput && newVal) {
        newInput.addEventListener('input', () => setVal(newInput, newVal));
        setVal(newInput, newVal);
    }
    if (editInput && editVal) {
        editInput.addEventListener('input', () => setVal(editInput, editVal));
        setVal(editInput, editVal);
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