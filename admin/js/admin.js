const API_ENDPOINT = 'https://loan-diagnosis-api-247001240932.asia-northeast1.run.app';

let diagnoses = [];
let currentDiagnosis = null;
let authToken = null;

// DOM
const loginScreen = document.getElementById('login-screen');
const mainScreen = document.getElementById('main-screen');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const tableBody = document.getElementById('table-body');
const emptyState = document.getElementById('empty-state');
const loadingState = document.getElementById('loading-state');
const filterStatus = document.getElementById('filter-status');
const filterDate = document.getElementById('filter-date');
const detailModal = document.getElementById('detail-modal');
const statTotal = document.getElementById('stat-total');
const statToday = document.getElementById('stat-today');
const statPending = document.getElementById('stat-pending');
const statContacted = document.getElementById('stat-contacted');

function init() {
    loginForm.addEventListener('submit', handleLogin);
    document.getElementById('btn-logout').addEventListener('click', handleLogout);
    document.getElementById('btn-refresh').addEventListener('click', loadData);
    document.getElementById('btn-export').addEventListener('click', exportCSV);
    filterStatus.addEventListener('change', renderTable);
    filterDate.addEventListener('change', renderTable);
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('btn-cancel').addEventListener('click', closeModal);
    document.getElementById('btn-save').addEventListener('click', saveDetail);
    
    // タブ
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });
    
    // 設定
    document.getElementById('btn-add-email').addEventListener('click', addEmail);
    document.getElementById('btn-add-user').addEventListener('click', addUser);
    document.getElementById('btn-change-password').addEventListener('click', changePassword);
    
    checkSession();
}

function checkSession() {
    const token = localStorage.getItem('admin_token');
    if (token) { authToken = token; showMainScreen(); loadData(); }
}

async function handleLogin(e) {
    e.preventDefault();
    try {
        const res = await fetch(`${API_ENDPOINT}/api/admin/login`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: document.getElementById('username').value, password: document.getElementById('password').value })
        });
        const data = await res.json();
        if (res.ok && data.success) {
            authToken = data.token;
            localStorage.setItem('admin_token', authToken);
            showMainScreen();
            loadData();
        } else {
            loginError.textContent = data.detail || 'ログイン失敗';
            loginError.classList.remove('hidden');
        }
    } catch (e) { loginError.textContent = '接続エラー'; loginError.classList.remove('hidden'); }
}

function handleLogout() {
    authToken = null;
    localStorage.removeItem('admin_token');
    mainScreen.classList.add('hidden');
    loginScreen.classList.remove('hidden');
}

function showMainScreen() {
    loginScreen.classList.add('hidden');
    mainScreen.classList.remove('hidden');
}

function switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector(`.tab[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`tab-${tabName}`).classList.add('active');
    
    if (tabName === 'emails') loadEmails();
    if (tabName === 'users') loadUsers();
}

async function loadData() {
    loadingState.classList.remove('hidden');
    try {
        const res = await fetch(`${API_ENDPOINT}/api/admin/diagnoses`, { headers: { 'Authorization': `Bearer ${authToken}` } });
        if (res.status === 401) { handleLogout(); return; }
        const data = await res.json();
        diagnoses = data.diagnoses || [];
        updateStats();
        renderTable();
    } catch (e) { alert('データ読み込み失敗'); }
    finally { loadingState.classList.add('hidden'); }
}

function updateStats() {
    const today = new Date().toISOString().split('T')[0];
    statTotal.textContent = diagnoses.length;
    statToday.textContent = diagnoses.filter(d => (d.createdAt || '').startsWith(today)).length;
    statPending.textContent = diagnoses.filter(d => d.status === '未連絡').length;
    statContacted.textContent = diagnoses.filter(d => d.status === '連絡済み').length;
}

function renderTable() {
    const sf = filterStatus.value, df = filterDate.value;
    let filtered = diagnoses;
    if (sf) filtered = filtered.filter(d => d.status === sf);
    if (df) filtered = filtered.filter(d => (d.createdAt || '').startsWith(df));
    
    if (!filtered.length) { tableBody.innerHTML = ''; emptyState.classList.remove('hidden'); return; }
    emptyState.classList.add('hidden');
    
    tableBody.innerHTML = filtered.map(d => {
        const inp = d.input || {}, res = d.result || {};
        return `<tr>
            <td>${formatDate(d.createdAt)}</td>
            <td>${esc(d.lineDisplayName || '不明')}</td>
            <td>${inp.incomeRange || '-'}</td>
            <td>${inp.age || '-'}歳</td>
            <td><strong>${res.borrowableAmountMan ? res.borrowableAmountMan.toLocaleString() : '-'}万円</strong></td>
            <td><span class="status-badge ${d.status || '未連絡'}">${d.status || '未連絡'}</span></td>
            <td><button class="btn-detail" onclick="openDetail('${d.id}')">詳細</button></td>
        </tr>`;
    }).join('');
}

function openDetail(id) {
    currentDiagnosis = diagnoses.find(d => d.id === id);
    if (!currentDiagnosis) return;
    const inp = currentDiagnosis.input || {}, res = currentDiagnosis.result || {};
    document.getElementById('detail-date').textContent = formatDate(currentDiagnosis.createdAt);
    document.getElementById('detail-name').textContent = currentDiagnosis.lineDisplayName || '不明';
    document.getElementById('detail-uid').textContent = currentDiagnosis.lineUserId || '-';
    document.getElementById('detail-income').textContent = inp.incomeRange || '-';
    document.getElementById('detail-age').textContent = (inp.age || '-') + '歳';
    document.getElementById('detail-employment').textContent = inp.employmentType || '-';
    document.getElementById('detail-debt').textContent = (inp.totalDebt || 0) + '万円';
    document.getElementById('detail-monthly').textContent = (inp.monthlyPayment || 0) + '万円';
    document.getElementById('detail-years').textContent = (inp.yearsEmployed || '-') + '年';
    document.getElementById('detail-result').textContent = (res.borrowableAmountMan ? res.borrowableAmountMan.toLocaleString() : '-') + '万円';
    document.getElementById('detail-status-select').value = currentDiagnosis.status || '未連絡';
    document.getElementById('detail-memo').value = currentDiagnosis.memo || '';
    detailModal.classList.remove('hidden');
}

function closeModal() { detailModal.classList.add('hidden'); currentDiagnosis = null; }

async function saveDetail() {
    if (!currentDiagnosis) return;
    try {
        const res = await fetch(`${API_ENDPOINT}/api/admin/diagnoses/${currentDiagnosis.id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify({ status: document.getElementById('detail-status-select').value, memo: document.getElementById('detail-memo').value })
        });
        if (res.status === 401) { handleLogout(); return; }
        const idx = diagnoses.findIndex(d => d.id === currentDiagnosis.id);
        if (idx !== -1) { diagnoses[idx].status = document.getElementById('detail-status-select').value; diagnoses[idx].memo = document.getElementById('detail-memo').value; }
        updateStats(); renderTable(); closeModal();
    } catch (e) { alert('保存失敗'); }
}

async function exportCSV() {
    try {
        const res = await fetch(`${API_ENDPOINT}/api/admin/diagnoses/export`, { headers: { 'Authorization': `Bearer ${authToken}` } });
        if (res.status === 401) { handleLogout(); return; }
        const blob = await res.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `診断履歴_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    } catch (e) { alert('エクスポート失敗'); }
}

// ========== 通知先設定 ==========
async function loadEmails() {
    try {
        const res = await fetch(`${API_ENDPOINT}/api/admin/settings/emails`, { headers: { 'Authorization': `Bearer ${authToken}` } });
        const data = await res.json();
        const list = document.getElementById('email-list');
        list.innerHTML = (data.emails || []).map(e => `<li>${esc(e)} <button class="btn-delete" onclick="deleteEmail('${esc(e)}')">削除</button></li>`).join('');
    } catch (e) { console.error(e); }
}

async function addEmail() {
    const email = document.getElementById('new-email').value.trim();
    if (!email) return;
    try {
        const res = await fetch(`${API_ENDPOINT}/api/admin/settings/emails`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify({ email })
        });
        if (res.ok) { document.getElementById('new-email').value = ''; loadEmails(); }
        else { const d = await res.json(); alert(d.detail || '追加失敗'); }
    } catch (e) { alert('エラー'); }
}

async function deleteEmail(email) {
    if (!confirm(`${email} を削除しますか？`)) return;
    try {
        await fetch(`${API_ENDPOINT}/api/admin/settings/emails?email=${encodeURIComponent(email)}`, {
            method: 'DELETE', headers: { 'Authorization': `Bearer ${authToken}` }
        });
        loadEmails();
    } catch (e) { alert('削除失敗'); }
}

// ========== ユーザー管理 ==========
async function loadUsers() {
    try {
        const res = await fetch(`${API_ENDPOINT}/api/admin/users`, { headers: { 'Authorization': `Bearer ${authToken}` } });
        const data = await res.json();
        const list = document.getElementById('user-list');
        list.innerHTML = (data.users || []).map(u => `<li>${esc(u.username)} <button class="btn-delete" onclick="deleteUser('${esc(u.username)}')">削除</button></li>`).join('');
    } catch (e) { console.error(e); }
}

async function addUser() {
    const username = document.getElementById('new-username').value.trim();
    const password = document.getElementById('new-user-password').value;
    if (!username || !password) return;
    try {
        const res = await fetch(`${API_ENDPOINT}/api/admin/users`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify({ username, password })
        });
        if (res.ok) { document.getElementById('new-username').value = ''; document.getElementById('new-user-password').value = ''; loadUsers(); alert('ユーザーを作成しました'); }
        else { const d = await res.json(); alert(d.detail || '作成失敗'); }
    } catch (e) { alert('エラー'); }
}

async function deleteUser(username) {
    if (!confirm(`${username} を削除しますか？`)) return;
    try {
        await fetch(`${API_ENDPOINT}/api/admin/users/${encodeURIComponent(username)}`, {
            method: 'DELETE', headers: { 'Authorization': `Bearer ${authToken}` }
        });
        loadUsers();
    } catch (e) { alert('削除失敗'); }
}

async function changePassword() {
    const current = document.getElementById('current-password').value;
    const newPw = document.getElementById('new-password').value;
    if (!current || !newPw) return;
    try {
        const res = await fetch(`${API_ENDPOINT}/api/admin/users/change-password`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify({ current_password: current, new_password: newPw })
        });
        if (res.ok) { document.getElementById('current-password').value = ''; document.getElementById('new-password').value = ''; alert('パスワードを変更しました'); }
        else { const d = await res.json(); alert(d.detail || '変更失敗'); }
    } catch (e) { alert('エラー'); }
}

function formatDate(s) { if (!s) return '-'; return new Date(s).toLocaleString('ja-JP'); }
function esc(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
window.openDetail = openDetail;
window.deleteEmail = deleteEmail;
window.deleteUser = deleteUser;
document.addEventListener('DOMContentLoaded', init);
