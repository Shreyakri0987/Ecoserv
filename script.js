// ============================================================
// ECOSERV ADVANCED — script.js
// ============================================================
var API_URL = window.location.origin +'/api';
var currentUser = null;
var isLoginMode = true;
var myChart = null;
var statusChart = null;
var allRequests = [];
var allUsers = [];
var allCollectors = [];
var chatHistory = [];
var analyticsCharts = {};

// ============================================================
// STARTUP
// ============================================================
window.onload = function () {
    const saved = localStorage.getItem('ecoserv_user');
    if (saved) {
        currentUser = JSON.parse(saved);
        updateNavigation();
        routeByRole();
        loadRequests();
        loadNotifications();
        if (currentUser.role === 'user') refreshUserData();
        if (currentUser.role === 'admin') loadCollectors();
    } else {
        showPage('home');
        fetchDailyFact();
        loadHeroStats();
    }
    if (window.lucide) lucide.createIcons();

    const theme = localStorage.getItem('ecoserv_theme') || 'light';
    document.documentElement.setAttribute('data-theme', theme);
    updateThemeIcon(theme);

    const dateEl = document.getElementById('req-date');
    if (dateEl) { const t = new Date(); t.setDate(t.getDate()+1); dateEl.valueAsDate = t; }
};

function routeByRole() {
    if (!currentUser) return showPage('home');
    if (currentUser.role === 'admin') showPage('admin');
    else if (currentUser.role === 'collector') showPage('collector');
    else showPage('dashboard');
}

function goHome() {
    if (currentUser) routeByRole();
    else showPage('home');
}

// ============================================================
// PAGE ROUTING
// ============================================================
function showPage(pageId) {
    if (pageId === 'login' || pageId === 'register') {
        isLoginMode = (pageId === 'login');
        pageId = 'auth';
    }
    document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
    const el = document.getElementById('page-' + pageId);
    if (el) el.style.display = 'block';

    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    const tab = document.querySelector(`.nav-tab[data-page="${pageId}"]`);
    if (tab) tab.classList.add('active');

    if (pageId === 'auth') updateAuthUI();
    if (pageId === 'analytics') loadAnalytics();
    if (pageId === 'leaderboard') loadLeaderboard();
    if (pageId === 'profile') loadProfile();
    if (window.lucide) lucide.createIcons();
}

// ============================================================
// NAVIGATION
// ============================================================
function updateNavigation() {
    if (!currentUser) {
        document.getElementById('logged-out-menu').style.display = 'flex';
        document.getElementById('logged-in-menu').style.display = 'none';
        document.getElementById('nav-tabs').style.display = 'none';
        return;
    }
    document.getElementById('logged-out-menu').style.display = 'none';
    document.getElementById('logged-in-menu').style.display = 'flex';
    document.getElementById('user-email-display').innerText = (currentUser.full_name || currentUser.email.split('@')[0]);

    // Role pill
    const pill = document.getElementById('role-pill');
    if (pill) {
        const roleMap = { admin: 'Admin', collector: 'Collector', user: 'User' };
        pill.innerText = roleMap[currentUser.role] || '';
        pill.className = `role-pill role-${currentUser.role}`;
    }

    // Build nav tabs based on role
    const navTabs = document.getElementById('nav-tabs');
    navTabs.style.display = 'flex';
    if (currentUser.role === 'admin') {
        navTabs.innerHTML = `
            <button class="nav-tab" onclick="showPage('admin')" data-page="admin"><i data-lucide="shield"></i> Admin Console</button>
            <button class="nav-tab" onclick="showPage('analytics')" data-page="analytics"><i data-lucide="bar-chart-2"></i> Analytics</button>
            <button class="nav-tab" onclick="showPage('leaderboard')" data-page="leaderboard"><i data-lucide="trophy"></i> Leaderboard</button>`;
    } else if (currentUser.role === 'collector') {
        navTabs.innerHTML = `
            <button class="nav-tab" onclick="showPage('collector')" data-page="collector"><i data-lucide="truck"></i> My Assignments</button>
            <button class="nav-tab" onclick="showPage('leaderboard')" data-page="leaderboard"><i data-lucide="trophy"></i> Leaderboard</button>`;
    } else {
        navTabs.innerHTML = `
            <button class="nav-tab" onclick="showPage('dashboard')" data-page="dashboard"><i data-lucide="layout-dashboard"></i> Dashboard</button>
            <button class="nav-tab" onclick="showPage('analytics')" data-page="analytics"><i data-lucide="bar-chart-2"></i> Analytics</button>
            <button class="nav-tab" onclick="showPage('leaderboard')" data-page="leaderboard"><i data-lucide="trophy"></i> Leaderboard</button>`;
    }

    // Avatar
    const color = currentUser.avatar_color || '#10b981';
    const letter = (currentUser.full_name || currentUser.email)[0].toUpperCase();
    ['user-avatar','dash-avatar'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.innerText = letter; el.style.background = color; }
    });

    if (currentUser.role === 'user') updateDashboardGreeting();
    if (window.lucide) lucide.createIcons();
}

function updateDashboardGreeting() {
    const hour = new Date().getHours();
    const g = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';
    const name = currentUser.full_name || currentUser.email.split('@')[0];
    setText('dash-greeting', `${g}, ${name} 👋`);
}

function toggleTheme() {
    const cur = document.documentElement.getAttribute('data-theme');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('ecoserv_theme', next);
    updateThemeIcon(next);
    if (window.lucide) lucide.createIcons();
}
function updateThemeIcon(t) {
    const btn = document.getElementById('theme-toggle');
    if (btn) btn.innerHTML = t === 'dark' ? '<i data-lucide="sun"></i>' : '<i data-lucide="moon"></i>';
}

// ============================================================
// AUTH — FIX 1: Email already exists → auto-switch to login
// ============================================================
function toggleAuthMode() { isLoginMode = !isLoginMode; updateAuthUI(); }

function updateAuthUI() {
    setText('auth-title', isLoginMode ? "Welcome back" : "Create account");
    setText('auth-subtitle', isLoginMode ? "Sign in to your EcoServ account" : "Join the eco revolution today");
    document.getElementById('auth-btn').innerText = isLoginMode ? "Login" : "Create Account";
    document.getElementById('auth-toggle').innerHTML = isLoginMode ? "Need an account? <b>Register</b>" : "Have an account? <b>Login</b>";
    document.getElementById('auth-error').style.display = 'none';
}

function handleAuth() {
    const email = document.getElementById('auth-email').value.trim();
    const pass = document.getElementById('auth-pass').value;
    if (!email || !pass) return showToast('Please fill all fields', 'warning');

    fetch(API_URL + (isLoginMode ? '/login' : '/register'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass })
    })
    .then(r => r.json())
    .then(data => {
        if (data.id) {
            localStorage.setItem('ecoserv_user', JSON.stringify(data));
            showToast('Welcome to EcoServ! 🌿', 'success');
            setTimeout(() => window.location.reload(), 800);
        } else {
            // FIX: if email exists during register, auto-switch to login
            if (!isLoginMode && data.emailExists) {
                showToast('Email already registered — switching to login!', 'warning');
                setTimeout(() => {
                    isLoginMode = true;
                    updateAuthUI();
                    document.getElementById('auth-pass').value = '';
                    document.getElementById('auth-pass').focus();
                }, 600);
                return;
            }
            const err = document.getElementById('auth-error');
            err.innerText = data.message || "Error occurred";
            err.style.display = 'block';
        }
    }).catch(() => showToast("Server connection failed. Is Node running?", 'error'));
}

function logout() {
    localStorage.removeItem('ecoserv_user');
    showToast('Logged out', 'info');
    setTimeout(() => window.location.reload(), 500);
}

// ============================================================
// USER DATA
// ============================================================
function refreshUserData() {
    if (!currentUser || currentUser.role !== 'user') return;
    fetch(`${API_URL}/profile/${currentUser.id}`)
    .then(r => r.json()).then(data => {
        currentUser = { ...currentUser, ...data };
        localStorage.setItem('ecoserv_user', JSON.stringify(currentUser));
        updatePointsUI();
        loadBadges();
    }).catch(() => {});
}

function updatePointsUI() {
    const pts = currentUser.eco_points || 0;
    const lvl = currentUser.level || 1;
    setText('dash-points', pts);
    setText('dash-level', lvl);
    const pct = Math.min(((pts % 200) / 200) * 100, 100);
    const bar = document.getElementById('xp-bar');
    if (bar) bar.style.width = pct + '%';
    // Re-update avatar
    const color = currentUser.avatar_color || '#10b981';
    const letter = (currentUser.full_name || currentUser.email)[0].toUpperCase();
    ['user-avatar','dash-avatar'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.innerText = letter; el.style.background = color; }
    });
}

function updatePointsPreview() {
    const w = parseInt(document.getElementById('req-weight')?.value) || 1;
    setText('pts-preview-val', Math.floor(w * 5) + 10);
}

// ============================================================
// LOAD REQUESTS (all roles)
// ============================================================
function loadRequests() {
    if (!currentUser) return;
    fetch(`${API_URL}/requests?userId=${currentUser.id}&role=${currentUser.role}`)
    .then(r => r.json()).then(data => {
        allRequests = data;
        if (currentUser.role === 'admin') renderAdminView(data);
        else if (currentUser.role === 'collector') renderCollectorView(data);
        else renderUserView(data);
    });
}

// ============================================================
// USER VIEW
// ============================================================
function renderUserView(requests) {
    const list = document.getElementById('requests-list');
    if (!list) return;
    list.innerHTML = '';
    let pending = 0, progress = 0, recycled = 0;

    if (!requests.length) {
        list.innerHTML = `<div class="empty-state">
            <div class="empty-icon">📦</div>
            <h4>No pickups yet</h4>
            <p>Schedule your first waste pickup to start earning eco points!</p>
            <button onclick="openModal()" class="btn-primary">+ Schedule Pickup</button>
        </div>`;
    }

    requests.forEach(req => {
        if (req.status === 'Pending') pending++;
        else if (req.status === 'Recycled') recycled += req.weight;
        else progress++;

        const item = document.createElement('div');
        item.className = 'request-item';
        item.dataset.status = req.status;
        item.dataset.type = req.waste_type;
        item.innerHTML = `
            <div class="req-left">
                <div class="waste-icon">${getWasteIcon(req.waste_type)}</div>
                <div>
                    <b>${req.waste_type}</b> <span class="tag ${req.status}">${req.status}</span>
                    ${req.collector_name ? `<span class="collector-badge">🚚 ${req.collector_name}</span>` : ''}
                    <div class="req-meta">${req.weight}kg • ${fmtDate(req.pickup_date)} • ${req.address ? req.address.substring(0,35)+'…' : 'No address'}</div>
                </div>
            </div>
            <div class="req-actions">
                <button onclick="openTracker(${req.id},'${req.status}','${req.collector_name||''}')" class="btn-purple btn-sm">📍 Track</button>
                <button onclick="printReceipt(${req.id})" class="btn-outline-icon" title="Print">🖨️</button>
                ${req.status === 'Pending' ? `<button onclick="deleteRequest(${req.id})" class="btn-danger-icon" title="Delete">🗑️</button>` : ''}
            </div>`;
        list.appendChild(item);
    });

    setText('stat-pending', pending);
    setText('stat-progress', progress);
    setText('stat-recycled', recycled);
}

// ============================================================
// FIX 2: ADMIN VIEW — no New Pickup, full power features
// ============================================================
function renderAdminView(requests) {
    const tbody = document.getElementById('admin-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    let pendingCount = 0, totalWeight = 0, recycledToday = 0;
    let wasteCounts = {}, statusCounts = {};
    const today = new Date().toISOString().split('T')[0];

    requests.forEach(req => {
        if (req.status === 'Pending') pendingCount++;
        totalWeight += req.weight || 0;
        if (req.status === 'Recycled' && req.created_at && new Date(req.created_at).toISOString().split('T')[0] === today) recycledToday++;
        wasteCounts[req.waste_type] = (wasteCounts[req.waste_type] || 0) + 1;
        statusCounts[req.status] = (statusCounts[req.status] || 0) + 1;

        // Build collector options
        const collectorOpts = `<option value="">Unassigned</option>` +
            allCollectors.map(c => `<option value="${c.id}" ${req.collector_id == c.id ? 'selected' : ''}>${c.full_name || c.email}</option>`).join('');

        const tr = document.createElement('tr');
        tr.dataset.status = req.status;
        tr.dataset.user = (req.user_email || '').toLowerCase();
        tr.dataset.type = (req.waste_type || '').toLowerCase();
        tr.innerHTML = `
            <td>${fmtDate(req.pickup_date)}</td>
            <td><div class="user-cell">
                <div class="mini-avatar" style="background:${req.avatar_color||'#10b981'}">${(req.user_email||'?')[0].toUpperCase()}</div>
                <span title="${req.user_email}">${(req.user_email||'').split('@')[0]}</span>
            </div></td>
            <td>${getWasteIcon(req.waste_type)} ${req.waste_type}</td>
            <td><b>${req.weight}kg</b></td>
            <td title="${req.address||''}">${(req.address||'—').substring(0,22)}${req.address&&req.address.length>22?'…':''}</td>
            <td><select class="status-select" onchange="assignCollector(${req.id}, this.value, this.options[this.selectedIndex].text)">${collectorOpts}</select></td>
            <td><select class="status-select ${req.status}" onchange="updateStatus(${req.id}, this.value)">
                <option ${req.status==='Pending'?'selected':''}>Pending</option>
                <option ${req.status==='Scheduled'?'selected':''}>Scheduled</option>
                <option ${req.status==='Collected'?'selected':''}>Collected</option>
                <option ${req.status==='Recycled'?'selected':''}>Recycled</option>
            </select></td>
            <td><button onclick="deleteRequest(${req.id})" class="btn-danger-sm">Delete</button></td>`;
        tbody.appendChild(tr);
    });

    setText('admin-total', requests.length);
    setText('admin-pending', pendingCount);
    setText('admin-weight', totalWeight);
    setText('admin-recycled-today', recycledToday);
    renderAdminCharts(wasteCounts, statusCounts);
    if (window.lucide) lucide.createIcons();
}

// ============================================================
// FIX 3: COLLECTOR CONSOLE
// ============================================================
function renderCollectorView(requests) {
    const list = document.getElementById('collector-list');
    if (!list) return;
    list.innerHTML = '';

    // Load stats
    fetch(`${API_URL}/collector/stats/${currentUser.id}`)
    .then(r => r.json()).then(stats => {
        setText('c-total', stats.total_assigned || 0);
        setText('c-scheduled', stats.pending_today || 0);
        setText('c-collected', stats.collected || 0);
        setText('c-kg', stats.total_kg || 0);
    });

    if (!requests.length) {
        list.innerHTML = `<div class="empty-state">
            <div class="empty-icon">🚚</div>
            <h4>No assignments yet</h4>
            <p>The admin will assign pickups to you soon. Check back later!</p>
        </div>`;
        return;
    }

    // Sort by pickup date
    requests.sort((a, b) => new Date(a.pickup_date) - new Date(b.pickup_date));

    requests.forEach(req => {
        const isToday = fmtDate(req.pickup_date) === fmtDate(new Date().toISOString());
        const item = document.createElement('div');
        item.className = 'collector-card';
        item.dataset.status = req.status;
        item.dataset.search = (req.user_email + req.waste_type + req.address).toLowerCase();

        let actionBtn = '';
        if (req.status === 'Scheduled') {
            actionBtn = `<button onclick="collectorUpdateStatus(${req.id}, 'Collected')" class="btn-primary btn-sm">✅ Mark Collected</button>`;
        } else if (req.status === 'Collected') {
            actionBtn = `<button onclick="collectorUpdateStatus(${req.id}, 'Recycled')" class="btn-purple btn-sm">♻️ Mark Recycled</button>`;
        }

        item.innerHTML = `
            <div class="cc-top">
                <div class="cc-left">
                    <div class="waste-icon">${getWasteIcon(req.waste_type)}</div>
                    <div>
                        <div class="cc-title">${req.waste_type} <span class="tag ${req.status}">${req.status}</span>
                            ${isToday ? '<span class="today-badge">Today</span>' : ''}
                        </div>
                        <div class="cc-meta">👤 ${req.user_email}</div>
                        <div class="cc-meta">⚖️ ${req.weight}kg &nbsp;•&nbsp; 📅 ${fmtDate(req.pickup_date)}</div>
                    </div>
                </div>
                <div class="cc-actions">
                    ${actionBtn}
                    <button onclick="openPickupDetail(${req.id})" class="btn-outline btn-sm">📋 Details</button>
                </div>
            </div>
            <div class="cc-address"><i>📍</i> ${req.address || 'No address provided'}</div>
            ${req.notes ? `<div class="cc-notes">📝 ${req.notes}</div>` : ''}`;
        list.appendChild(item);
    });

    if (window.lucide) lucide.createIcons();
}

function collectorUpdateStatus(id, newStatus) {
    fetch(`${API_URL}/requests/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
    }).then(() => {
        showToast(`Marked as ${newStatus} ✅`, 'success');
        loadRequests();
        loadNotifications();
    });
}

function openPickupDetail(id) {
    const req = allRequests.find(r => r.id === id);
    if (!req) return;
    const body = document.getElementById('pickup-detail-body');
    body.innerHTML = `
        <div class="detail-row"><b>Waste Type:</b> ${getWasteIcon(req.waste_type)} ${req.waste_type}</div>
        <div class="detail-row"><b>Weight:</b> ${req.weight} kg</div>
        <div class="detail-row"><b>Pickup Date:</b> ${fmtDate(req.pickup_date)}</div>
        <div class="detail-row"><b>Status:</b> <span class="tag ${req.status}">${req.status}</span></div>
        <div class="detail-row"><b>Customer:</b> ${req.user_email}</div>
        <div class="detail-row"><b>Address:</b><br><span class="address-block">${req.address || '—'}</span></div>
        ${req.notes ? `<div class="detail-row"><b>Notes:</b> ${req.notes}</div>` : ''}`;

    const actions = document.getElementById('pickup-detail-actions');
    actions.innerHTML = `<button onclick="closePickupDetail()" class="btn-ghost-sm">Close</button>`;
    if (req.status === 'Scheduled') actions.innerHTML += `<button onclick="collectorUpdateStatus(${req.id},'Collected'); closePickupDetail();" class="btn-primary">✅ Mark Collected</button>`;
    if (req.status === 'Collected') actions.innerHTML += `<button onclick="collectorUpdateStatus(${req.id},'Recycled'); closePickupDetail();" class="btn-purple">♻️ Mark Recycled</button>`;

    document.getElementById('modal-pickup-detail').style.display = 'flex';
}
function closePickupDetail() { document.getElementById('modal-pickup-detail').style.display = 'none'; }

function filterCollectorList() {
    const query = (document.getElementById('col-search')?.value || '').toLowerCase();
    const statusF = document.getElementById('col-filter')?.value || '';
    document.querySelectorAll('.collector-card').forEach(card => {
        const matches = (!query || (card.dataset.search || '').includes(query))
            && (!statusF || card.dataset.status === statusF);
        card.style.display = matches ? 'block' : 'none';
    });
}

// ============================================================
// ADMIN — USER MANAGEMENT
// ============================================================
function switchAdminTab(tab) {
    ['requests','users','collectors'].forEach(t => {
        const el = document.getElementById('admin-tab-' + t);
        if (el) el.style.display = t === tab ? 'block' : 'none';
    });
    document.querySelectorAll('.admin-tab').forEach((btn, i) => {
        btn.classList.toggle('active', ['requests','users','collectors'][i] === tab);
    });
    if (tab === 'users') loadAdminUsers();
    if (tab === 'collectors') loadCollectorsOverview();
}

function loadCollectors() {
    fetch(`${API_URL}/collectors`)
    .then(r => r.json()).then(data => { allCollectors = data; });
}

function loadAdminUsers() {
    fetch(`${API_URL}/admin/users`)
    .then(r => r.json()).then(data => {
        allUsers = data;
        renderUsersTable(data);
    });
}

function renderUsersTable(users) {
    const tbody = document.getElementById('users-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    users.forEach(u => {
        const tr = document.createElement('tr');
        tr.dataset.role = u.role;
        tr.dataset.search = (u.email + (u.full_name||'')).toLowerCase();
        tr.innerHTML = `
            <td><div class="user-cell">
                <div class="mini-avatar" style="background:${u.avatar_color||'#10b981'}">${(u.full_name||u.email)[0].toUpperCase()}</div>
                <span>${u.full_name || '—'}</span>
            </div></td>
            <td>${u.email}</td>
            <td><select class="status-select" onchange="updateUserRole(${u.id}, this.value)" ${u.id==1?'disabled':''}>
                <option ${u.role==='user'?'selected':''} value="user">User</option>
                <option ${u.role==='collector'?'selected':''} value="collector">Collector</option>
                <option ${u.role==='admin'?'selected':''} value="admin">Admin</option>
            </select></td>
            <td>${u.eco_points}</td>
            <td>${u.total_requests}</td>
            <td>${new Date(u.created_at).toLocaleDateString()}</td>
            <td><label class="toggle-switch">
                <input type="checkbox" ${u.is_active?'checked':''} onchange="toggleUserActive(${u.id}, this.checked)" ${u.id==1?'disabled':''}>
                <span class="toggle-slider"></span>
            </label></td>
            <td>${u.id != 1 ? `<button onclick="adminDeleteUser(${u.id})" class="btn-danger-sm">Delete</button>` : '—'}</td>`;
        tbody.appendChild(tr);
    });
}

function filterUserTable() {
    const q = (document.getElementById('user-search')?.value||'').toLowerCase();
    const role = document.getElementById('user-role-filter')?.value||'';
    document.querySelectorAll('#users-table-body tr').forEach(row => {
        const show = (!q || (row.dataset.search||'').includes(q)) && (!role || row.dataset.role === role);
        row.style.display = show ? '' : 'none';
    });
}

function updateUserRole(id, role) {
    const user = allUsers.find(u => u.id === id);
    fetch(`${API_URL}/admin/users/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, is_active: user ? user.is_active : 1 })
    }).then(() => { showToast(`Role updated to ${role}`, 'success'); loadCollectors(); });
}

function toggleUserActive(id, active) {
    const user = allUsers.find(u => u.id === id);
    fetch(`${API_URL}/admin/users/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: user ? user.role : 'user', is_active: active ? 1 : 0 })
    }).then(() => showToast(active ? 'User activated' : 'User deactivated', 'info'));
}

function adminDeleteUser(id) {
    if (!confirm("Delete this user and all their data?")) return;
    fetch(`${API_URL}/admin/users/${id}`, { method: 'DELETE' })
    .then(() => { showToast('User deleted', 'info'); loadAdminUsers(); });
}

function assignCollector(requestId, collectorId, collectorName) {
    if (!collectorId) return;
    fetch(`${API_URL}/requests/${requestId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collectorId: parseInt(collectorId), collectorName: collectorName.trim() })
    }).then(() => { showToast(`Assigned to ${collectorName} ✅`, 'success'); loadRequests(); loadNotifications(); });
}

function loadCollectorsOverview() {
    fetch(`${API_URL}/admin/users`)
    .then(r => r.json()).then(users => {
        const collectors = users.filter(u => u.role === 'collector');
        const el = document.getElementById('collectors-overview');
        if (!el) return;
        if (!collectors.length) {
            el.innerHTML = '<p class="text-light" style="text-align:center;padding:40px">No collectors yet. Go to User Management tab and change a user\'s role to Collector.</p>';
            return;
        }
        el.innerHTML = collectors.map(c => `
            <div class="collector-profile-card">
                <div class="cp-header">
                    <div class="avatar-lg" style="background:${c.avatar_color||'#3b82f6'};width:50px;height:50px;font-size:20px;">${(c.full_name||c.email)[0].toUpperCase()}</div>
                    <div>
                        <b>${c.full_name || c.email.split('@')[0]}</b>
                        <div class="cp-email">${c.email}</div>
                        <span class="tag Scheduled" style="margin:0">${c.is_active ? 'Active' : 'Inactive'}</span>
                    </div>
                </div>
                <div class="cp-stats">
                    <div><span>Total Requests</span><b>${c.total_requests}</b></div>
                    <div><span>Eco Points</span><b>${c.eco_points}</b></div>
                    <div><span>Level</span><b>${c.level}</b></div>
                </div>
            </div>`).join('');
    });
}

// ============================================================
// SEARCH & FILTER
// ============================================================
function filterRequests() {
    const q = (document.getElementById('search-input')?.value||'').toLowerCase();
    const s = document.getElementById('filter-status')?.value||'';
    document.querySelectorAll('.request-item').forEach(item => {
        const show = (!q || item.innerText.toLowerCase().includes(q)) && (!s || item.dataset.status === s);
        item.style.display = show ? 'flex' : 'none';
    });
}

function filterAdminTable() {
    const q = (document.getElementById('admin-search')?.value||'').toLowerCase();
    const s = document.getElementById('admin-filter-status')?.value||'';
    document.querySelectorAll('#admin-table-body tr').forEach(row => {
        const matches = (!q || ((row.dataset.user||'') + (row.dataset.type||'')).includes(q))
            && (!s || row.dataset.status === s);
        row.style.display = matches ? '' : 'none';
    });
}

// ============================================================
// ADMIN CHARTS
// ============================================================
function renderAdminCharts(wasteCounts, statusCounts) {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    const tc = dark ? '#94a3b8' : '#64748b';
    const ctx1 = document.getElementById('wasteChart')?.getContext('2d');
    if (ctx1) {
        if (myChart) myChart.destroy();
        myChart = new Chart(ctx1, {
            type: 'doughnut',
            data: { labels: Object.keys(wasteCounts), datasets: [{ data: Object.values(wasteCounts), backgroundColor: ['#10b981','#3b82f6','#f59e0b','#ef4444','#8b5cf6'], borderWidth: 0 }] },
            options: { plugins: { legend: { labels: { color: tc } }, title: { display: true, text: 'Waste by Type', color: tc } }, cutout: '65%' }
        });
    }
    const ctx2 = document.getElementById('statusChart')?.getContext('2d');
    if (ctx2) {
        if (statusChart) statusChart.destroy();
        statusChart = new Chart(ctx2, {
            type: 'bar',
            data: { labels: Object.keys(statusCounts), datasets: [{ data: Object.values(statusCounts), backgroundColor: ['#fef3c7','#e0e7ff','#ffedd5','#d1fae5'], borderRadius: 8, borderWidth: 0 }] },
            options: { plugins: { legend: { display: false }, title: { display: true, text: 'Status Overview', color: tc } }, scales: { y: { ticks: { color: tc } }, x: { ticks: { color: tc } } } }
        });
    }
}

// ============================================================
// ANALYTICS
// ============================================================
function loadAnalytics() {
    if (!currentUser) return;
    fetch(`${API_URL}/analytics/${currentUser.id}?role=${currentUser.role}`)
    .then(r => r.json()).then(data => {
        const dark = document.documentElement.getAttribute('data-theme') === 'dark';
        const tc = dark ? '#94a3b8' : '#64748b';

        const c1 = document.getElementById('monthlyChart')?.getContext('2d');
        if (c1) {
            if (analyticsCharts.monthly) analyticsCharts.monthly.destroy();
            analyticsCharts.monthly = new Chart(c1, {
                type: 'line',
                data: { labels: data.monthly.map(m=>m.month), datasets: [
                    { label: 'Requests', data: data.monthly.map(m=>m.count), borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', tension: 0.4, fill: true, pointRadius: 5 },
                    { label: 'Weight (kg)', data: data.monthly.map(m=>m.total_weight), borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', tension: 0.4, fill: true, pointRadius: 5 }
                ]},
                options: { plugins: { legend: { labels: { color: tc } } }, scales: { y: { ticks: { color: tc } }, x: { ticks: { color: tc } } } }
            });
        }

        const c2 = document.getElementById('typeChart')?.getContext('2d');
        if (c2) {
            if (analyticsCharts.type) analyticsCharts.type.destroy();
            analyticsCharts.type = new Chart(c2, {
                type: 'polarArea',
                data: { labels: data.byType.map(t=>t.waste_type), datasets: [{ data: data.byType.map(t=>t.count), backgroundColor: ['rgba(16,185,129,0.7)','rgba(59,130,246,0.7)','rgba(245,158,11,0.7)','rgba(239,68,68,0.7)','rgba(139,92,246,0.7)'] }] },
                options: { plugins: { legend: { labels: { color: tc } } } }
            });
        }

        const c3 = document.getElementById('analyticStatusChart')?.getContext('2d');
        if (c3) {
            if (analyticsCharts.status) analyticsCharts.status.destroy();
            analyticsCharts.status = new Chart(c3, {
                type: 'doughnut',
                data: { labels: data.byStatus.map(s=>s.status), datasets: [{ data: data.byStatus.map(s=>s.count), backgroundColor: ['#fef3c7','#e0e7ff','#ffedd5','#d1fae5'], borderWidth: 0 }] },
                options: { plugins: { legend: { labels: { color: tc } } }, cutout: '60%' }
            });
        }

        const logEl = document.getElementById('activity-log');
        if (logEl) logEl.innerHTML = data.activity.length
            ? data.activity.map(a => `<div class="activity-item"><div class="activity-dot"></div><div><b>${a.action}</b><span class="pts-tag">+${a.points_earned} pts</span></div><div class="act-time">${new Date(a.created_at).toLocaleDateString()}</div></div>`).join('')
            : '<p class="text-light" style="padding:20px">No activity yet.</p>';
    });
}

// ============================================================
// LEADERBOARD
// ============================================================
function loadLeaderboard() {
    fetch(`${API_URL}/leaderboard`).then(r => r.json()).then(data => {
        const medals = ['🥇','🥈','🥉'];
        const el = document.getElementById('leaderboard-list');
        if (!el) return;
        el.innerHTML = data.map((u, i) => `
            <div class="lb-row ${currentUser && u.id === currentUser.id ? 'lb-mine' : ''}">
                <div class="lb-rank">${medals[i] || '#'+(i+1)}</div>
                <div class="lb-avatar" style="background:${u.avatar_color||'#10b981'}">${(u.full_name||u.email)[0].toUpperCase()}</div>
                <div class="lb-info">
                    <b>${u.full_name || u.email.split('@')[0]}</b>
                    <span>Level ${u.level} • ${u.total_requests} pickups • ${u.total_recycled}kg recycled</span>
                </div>
                <div class="lb-points"><span>${u.eco_points}</span> pts</div>
            </div>`).join('') || '<p style="text-align:center;padding:40px" class="text-light">No users yet.</p>';
    });
}

// ============================================================
// PROFILE
// ============================================================
function loadProfile() {
    if (!currentUser) return;
    fetch(`${API_URL}/profile/${currentUser.id}`).then(r => r.json()).then(data => {
        const color = data.avatar_color || '#10b981';
        const letter = (data.full_name || data.email)[0].toUpperCase();
        const av = document.getElementById('profile-avatar');
        if (av) { av.innerText = letter; av.style.background = color; }
        setText('profile-name', data.full_name || data.email.split('@')[0]);
        setText('profile-email-display', data.email);
        setText('profile-level-badge', `Level ${data.level}`);
        setText('profile-points', data.eco_points);
        setText('profile-since', new Date(data.created_at).toLocaleDateString('en-IN',{year:'numeric',month:'long'}));
        setVal('profile-fullname', data.full_name||'');
        setVal('profile-phone', data.phone||'');
    });
    if (currentUser.role === 'user') loadBadges('profile-badges');
}

function saveProfile() {
    fetch(`${API_URL}/profile/${currentUser.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: document.getElementById('profile-fullname').value.trim(), phone: document.getElementById('profile-phone').value.trim() })
    }).then(r => r.json()).then(() => {
        currentUser.full_name = document.getElementById('profile-fullname').value.trim();
        localStorage.setItem('ecoserv_user', JSON.stringify(currentUser));
        showToast('Profile saved ✅', 'success');
        updateNavigation();
    });
}

function loadBadges(targetId = 'dash-badges') {
    if (!currentUser || currentUser.role !== 'user') return;
    fetch(`${API_URL}/badges/${currentUser.id}`).then(r => r.json()).then(badges => {
        const el = document.getElementById(targetId);
        if (!el) return;
        if (targetId === 'dash-badges') {
            el.innerHTML = badges.slice(0,4).map(b => `<div class="badge-chip" title="${b.badge_name}">${b.badge_icon}</div>`).join('');
        } else {
            el.innerHTML = badges.length
                ? badges.map(b => `<div class="badge-card"><div class="badge-icon-lg">${b.badge_icon}</div><span>${b.badge_name}</span></div>`).join('')
                : '<p class="text-light">No badges yet. Start recycling! 🏅</p>';
        }
    });
}

// ============================================================
// NOTIFICATIONS
// ============================================================
function loadNotifications() {
    if (!currentUser) return;
    fetch(`${API_URL}/notifications/${currentUser.id}`).then(r => r.json()).then(data => {
        const unread = data.filter(n => !n.is_read).length;
        const badge = document.getElementById('notif-badge');
        if (badge) { badge.innerText = unread; badge.style.display = unread > 0 ? 'block' : 'none'; }
        const list = document.getElementById('notif-list');
        if (list) list.innerHTML = data.length
            ? data.map(n => `<div class="notif-item ${n.is_read?'':'unread'} notif-${n.type}">
                <div class="notif-msg">${n.message}</div>
                <div class="notif-time">${timeAgo(n.created_at)}</div></div>`).join('')
            : '<p class="text-light" style="padding:20px;text-align:center">No notifications</p>';
    });
}
function toggleNotifications() {
    const p = document.getElementById('notif-panel');
    const o = document.getElementById('notif-overlay');
    const open = p.style.display !== 'none';
    p.style.display = open ? 'none' : 'block';
    o.style.display = open ? 'none' : 'block';
    if (!open) loadNotifications();
}
function closeNotifications() {
    document.getElementById('notif-panel').style.display = 'none';
    document.getElementById('notif-overlay').style.display = 'none';
}
function markAllRead() {
    fetch(`${API_URL}/notifications/read/${currentUser.id}`, { method: 'PUT' })
    .then(() => { loadNotifications(); showToast('All read', 'info'); });
}

// ============================================================
// HERO STATS
// ============================================================
function loadHeroStats() {
    fetch(`${API_URL}/leaderboard`).then(r => r.json()).then(data => {
        animateCount('hs-users', data.length);
        animateCount('hs-kg', data.reduce((a,u) => a + parseInt(u.total_recycled||0), 0));
        animateCount('hs-pts', data.reduce((a,u) => a + u.eco_points, 0));
    }).catch(()=>{});
}
function animateCount(id, target) {
    const el = document.getElementById(id);
    if (!el || !target) { if(el) el.innerText = target||0; return; }
    let cur = 0; const step = Math.ceil(target/30);
    const t = setInterval(() => { cur = Math.min(cur+step, target); el.innerText = cur.toLocaleString(); if(cur>=target) clearInterval(t); }, 40);
}

// ============================================================
// CRUD
// ============================================================
function openModal() { document.getElementById('modal-request').style.display='flex'; updatePointsPreview(); if(window.lucide) lucide.createIcons(); }
function closeModal() { document.getElementById('modal-request').style.display='none'; }

function submitRequest() {
    const data = {
        userId: currentUser.id, userEmail: currentUser.email,
        wasteType: document.getElementById('req-type').value,
        weight: document.getElementById('req-weight').value,
        date: document.getElementById('req-date').value,
        pickupAddress: document.getElementById('req-address').value,
        notes: document.getElementById('req-notes').value
    };
    if (!data.date) return showToast('Please select a pickup date', 'warning');
    if (!data.pickupAddress) return showToast('Please enter your address', 'warning');
    fetch(API_URL+'/requests', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) })
    .then(r => r.json()).then(res => {
        closeModal();
        showToast(`Pickup scheduled! +${res.points_earned||0} eco points 🌿`, 'success');
        loadRequests(); refreshUserData(); loadNotifications();
    });
}

function deleteRequest(id) {
    if (!confirm("Delete this request?")) return;
    fetch(API_URL+'/requests/'+id, {method:'DELETE'}).then(() => { loadRequests(); showToast('Deleted','info'); });
}

function updateStatus(id, newStatus) {
    fetch(API_URL+'/requests/'+id, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({status:newStatus}) })
    .then(() => { loadRequests(); showToast(`Updated to ${newStatus}`,'success'); });
}

// ============================================================
// AI FEATURES
// ============================================================
function openAI() { document.getElementById('modal-ai').style.display='flex'; if(window.lucide) lucide.createIcons(); }
function closeAI() { document.getElementById('modal-ai').style.display='none'; }

function askAI() {
    const input = document.getElementById('ai-input').value;
    const res = document.getElementById('ai-result');
    if (!input) return;
    res.innerText = '🤔 Thinking...';
    fetch(API_URL+'/ai/sort', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({item:input}) })
    .then(r=>r.json()).then(d => res.innerText = d.answer)
    .catch(() => res.innerText = 'Server error.');
}

function runDemoAI() {
    const input = document.getElementById('demo-ai-input').value;
    const res = document.getElementById('demo-ai-result');
    if (!input) return;
    res.innerText = 'Thinking...';
    fetch(API_URL+'/ai/sort', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({item:input}) })
    .then(r=>r.json()).then(d => res.innerText = '🤖 '+d.answer)
    .catch(() => res.innerText = 'Server error.');
}

function fetchDailyFact() {
    const el = document.getElementById('ai-daily-fact');
    if (!el) return;
    el.innerText = 'Generating...';
    fetch(API_URL+'/ai/fact').then(r=>r.json()).then(d => {
        el.innerText = '"' + d.fact.replace(/['"]+/g,'') + '"';
    }).catch(() => el.innerText = '"Recycling 1 aluminum can saves enough energy to power a TV for 3 hours!"');
}

function generateReport() {
    const text = document.getElementById('impact-text');
    const weight = document.getElementById('stat-recycled').innerText;
    if (parseInt(weight) === 0) { text.innerText = "You haven't recycled anything yet. Start today!"; return; }
    text.innerText = 'Calculating with AI...';
    fetch(API_URL+'/ai/impact', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({weight}) })
    .then(r=>r.json()).then(d => text.innerText = '🌱 '+d.answer)
    .catch(() => text.innerText = 'Error calculating impact.');
}

function suggestSchedule() {
    const tip = document.getElementById('ai-schedule-tip');
    if (!tip) return;
    const wasteType = document.getElementById('req-type').value;
    const weight = document.getElementById('req-weight').value;
    tip.style.display = 'block'; tip.innerText = '🤖 Getting AI suggestion...';
    fetch(API_URL+'/ai/schedule', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({wasteType,weight}) })
    .then(r=>r.json()).then(d => tip.innerText = '💡 '+d.suggestion)
    .catch(() => tip.style.display='none');
}

// ============================================================
// CHATBOT
// ============================================================
function toggleChatbot() {
    const p = document.getElementById('chatbot-panel');
    p.style.display = p.style.display==='none' ? 'flex' : 'none';
    if (p.style.display==='flex') { document.getElementById('chat-input').focus(); if(window.lucide) lucide.createIcons(); }
}
function sendChat() {
    const input = document.getElementById('chat-input');
    const msg = input.value.trim();
    if (!msg) return;
    input.value = '';
    appendChat(msg, 'user');
    chatHistory.push({role:'User', content:msg});
    const thinking = appendChat('...', 'bot thinking');
    fetch(API_URL+'/ai/chat', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({message:msg, history:chatHistory.slice(-6)}) })
    .then(r=>r.json()).then(d => { thinking.remove(); appendChat(d.answer,'bot'); chatHistory.push({role:'EcoBot',content:d.answer}); })
    .catch(() => thinking.innerText = "Sorry, connection issue!");
}
function appendChat(text, cls) {
    const msgs = document.getElementById('chatbot-messages');
    const div = document.createElement('div');
    div.className = 'chat-msg '+cls;
    div.innerText = text;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
    return div;
}

// ============================================================
// TRACKER
// ============================================================
function openTracker(id, status, collectorName) {
    document.getElementById('modal-tracker').style.display='flex';
    setText('track-id', '#'+id);
    const cl = document.getElementById('track-collector');
    if (cl) cl.innerText = collectorName ? `🚚 Assigned to: ${collectorName}` : '';
    document.querySelectorAll('.track-step').forEach(s => s.classList.remove('active'));
    ['Pending','Scheduled','Collected','Recycled'].forEach(s => {
        document.getElementById('step-'+s)?.classList.add('active');
        if (s === status) return false;
    });
    if(window.lucide) lucide.createIcons();
}
function closeTracker() { document.getElementById('modal-tracker').style.display='none'; }

// ============================================================
// PRINT & EXPORT
// ============================================================
function printReceipt(id) {
    const req = allRequests.find(r => r.id === id);
    const win = window.open('','','height=600,width=450');
    win.document.write(`<body style="font-family:sans-serif;text-align:center;padding:30px;border:2px dashed #10b981;max-width:400px;margin:20px auto;">
        <h2 style="color:#10b981;">🌿 EcoServ Receipt</h2><hr>
        <p><b>Order ID:</b> #${id}</p>
        ${req ? `<p><b>Type:</b> ${req.waste_type}</p><p><b>Weight:</b> ${req.weight}kg</p><p><b>Date:</b> ${fmtDate(req.pickup_date)}</p><p><b>Status:</b> ${req.status}</p>` : ''}
        <hr><p style="font-size:12px;color:#64748b">Thank you for recycling with EcoServ!</p></body>`);
    win.print();
}
function exportUserCSV() {
    const rows = [['ID','Type','Weight','Date','Status','Address']];
    allRequests.forEach(r => rows.push([r.id,r.waste_type,r.weight,fmtDate(r.pickup_date),r.status,r.address||'']));
    downloadCSV(rows,'my_pickups.csv');
}
function exportAdminCSV() {
    const rows = [['ID','User','Type','Weight','Date','Status','Collector']];
    allRequests.forEach(r => rows.push([r.id,r.user_email,r.waste_type,r.weight,fmtDate(r.pickup_date),r.status,r.collector_name||'']));
    downloadCSV(rows,'all_pickups.csv');
}
function downloadCSV(rows, filename) {
    const csv = rows.map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
    a.download = filename; a.click();
    showToast('CSV exported 📥','success');
}

// ============================================================
// TOAST
// ============================================================
function showToast(message, type='info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icons = {success:'✅',error:'❌',warning:'⚠️',info:'ℹ️'};
    toast.innerHTML = `<span>${icons[type]||'ℹ️'}</span> ${message}`;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('toast-show'), 10);
    setTimeout(() => { toast.classList.remove('toast-show'); setTimeout(()=>toast.remove(),400); }, 4000);
}

// ============================================================
// HELPERS
// ============================================================
function setText(id, val) { const el=document.getElementById(id); if(el) el.innerText=val; }
function setVal(id, val) { const el=document.getElementById(id); if(el) el.value=val; }
function fmtDate(d) { if(!d) return '—'; return new Date(d).toISOString().split('T')[0]; }
function getWasteIcon(type) { return {Plastic:'🧴',Paper:'📄',Metal:'🥫',Glass:'🍶','E-Waste':'💻'}[type]||'♻️'; }
function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff/60000);
    if (mins < 1) return 'Just now'; if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins/60); if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs/24)}d ago`;
}

setTimeout(() => {
    if (document.getElementById('page-home')?.style.display !== 'none') fetchDailyFact();
}, 500);
