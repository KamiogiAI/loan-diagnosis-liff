/**
 * 管理画面 JavaScript
 */

// API エンドポイント
const API_ENDPOINT = 'https://loan-diagnosis-api-247001240932.asia-northeast1.run.app';

// 状態管理
let diagnoses = [];
let currentDiagnosis = null;
let authToken = null;

// DOM要素
const loginScreen = document.getElementById('login-screen');
const mainScreen = document.getElementById('main-screen');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const btnLogout = document.getElementById('btn-logout');
const tableBody = document.getElementById('table-body');
const emptyState = document.getElementById('empty-state');
const loadingState = document.getElementById('loading-state');
const filterStatus = document.getElementById('filter-status');
const filterDate = document.getElementById('filter-date');
const btnRefresh = document.getElementById('btn-refresh');
const btnExport = document.getElementById('btn-export');
const detailModal = document.getElementById('detail-modal');
const modalClose = document.getElementById('modal-close');
const btnSave = document.getElementById('btn-save');
const btnCancel = document.getElementById('btn-cancel');

// 統計要素
const statTotal = document.getElementById('stat-total');
const statToday = document.getElementById('stat-today');
const statPending = document.getElementById('stat-pending');
const statContacted = document.getElementById('stat-contacted');

/**
 * 初期化
 */
function init() {
    loginForm.addEventListener('submit', handleLogin);
    btnLogout.addEventListener('click', handleLogout);
    btnRefresh.addEventListener('click', loadData);
    btnExport.addEventListener('click', exportCSV);
    filterStatus.addEventListener('change', renderTable);
    filterDate.addEventListener('change', renderTable);
    modalClose.addEventListener('click', closeModal);
    btnCancel.addEventListener('click', closeModal);
    btnSave.addEventListener('click', saveDetail);
    checkSession();
}

function checkSession() {
    const token = localStorage.getItem('admin_token');
    if (token) {
        authToken = token;
        showMainScreen();
        loadData();
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
        const response = await fetch(`${API_ENDPOINT}/api/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();

        if (response.ok && data.success) {
            authToken = data.token;
            localStorage.setItem('admin_token', authToken);
            loginError.classList.add('hidden');
            showMainScreen();
            loadData();
        } else {
            loginError.textContent = data.detail || 'ログインに失敗しました';
            loginError.classList.remove('hidden');
        }
    } catch (error) {
        loginError.textContent = 'サーバーに接続できません';
        loginError.classList.remove('hidden');
    }
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

async function loadData() {
    loadingState.classList.remove('hidden');
    emptyState.classList.add('hidden');
    tableBody.innerHTML = '';

    try {
        const response = await fetch(`${API_ENDPOINT}/api/admin/diagnoses`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (response.status === 401) { handleLogout(); return; }
        const data = await response.json();
        diagnoses = data.diagnoses || [];
        updateStats();
        renderTable();
    } catch (error) {
        alert('データの読み込みに失敗しました');
    } finally {
        loadingState.classList.add('hidden');
    }
}

function updateStats() {
    const today = new Date().toISOString().split('T')[0];
    statTotal.textContent = diagnoses.length;
    statToday.textContent = diagnoses.filter(d => (d.createdAt || '').startsWith(today)).length;
    statPending.textContent = diagnoses.filter(d => d.status === '未連絡').length;
    statContacted.textContent = diagnoses.filter(d => d.status === '連絡済み').length;
}

function renderTable() {
    const statusFilter = filterStatus.value;
    const dateFilter = filterDate.value;
    let filtered = diagnoses;
    if (statusFilter) filtered = filtered.filter(d => d.status === statusFilter);
    if (dateFilter) filtered = filtered.filter(d => (d.createdAt || '').startsWith(dateFilter));

    if (filtered.length === 0) {
        tableBody.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }
    emptyState.classList.add('hidden');

    tableBody.innerHTML = filtered.map(d => {
        const input = d.input || {};
        const result = d.result || {};
        return `
            <tr>
                <td>${formatDate(d.createdAt)}</td>
                <td>${escapeHtml(d.lineDisplayName || '不明')}</td>
                <td>${input.incomeRange || '-'}</td>
                <td>${input.age || '-'}歳</td>
                <td><strong>${result.borrowableAmountMan ? result.borrowableAmountMan.toLocaleString() : '-'}万円</strong></td>
                <td><span class="status-badge ${d.status || '未連絡'}">${d.status || '未連絡'}</span></td>
                <td><button class="btn-detail" onclick="openDetail('${d.id}')">詳細</button></td>
            </tr>
        `;
    }).join('');
}

function openDetail(id) {
    currentDiagnosis = diagnoses.find(d => d.id === id);
    if (!currentDiagnosis) return;
    const input = currentDiagnosis.input || {};
    const result = currentDiagnosis.result || {};

    document.getElementById('detail-date').textContent = formatDate(currentDiagnosis.createdAt);
    document.getElementById('detail-name').textContent = currentDiagnosis.lineDisplayName || '不明';
    document.getElementById('detail-uid').textContent = currentDiagnosis.lineUserId || '-';
    document.getElementById('detail-income').textContent = input.incomeRange || '-';
    document.getElementById('detail-age').textContent = (input.age || '-') + '歳';
    document.getElementById('detail-employment').textContent = input.employmentType || '-';
    document.getElementById('detail-debt').textContent = (input.totalDebt || 0) + '万円';
    document.getElementById('detail-monthly').textContent = (input.monthlyPayment || 0) + '万円';
    document.getElementById('detail-years').textContent = (input.yearsEmployed || '-') + '年';
    document.getElementById('detail-result').textContent = (result.borrowableAmountMan ? result.borrowableAmountMan.toLocaleString() : '-') + '万円';
    document.getElementById('detail-contact-name').textContent = currentDiagnosis.contactName || '未入力';
    document.getElementById('detail-contact-phone').textContent = currentDiagnosis.contactPhone || '未入力';
    document.getElementById('detail-status-select').value = currentDiagnosis.status || '未連絡';
    document.getElementById('detail-memo').value = currentDiagnosis.memo || '';
    detailModal.classList.remove('hidden');
}

function closeModal() {
    detailModal.classList.add('hidden');
    currentDiagnosis = null;
}

async function saveDetail() {
    if (!currentDiagnosis) return;
    const newStatus = document.getElementById('detail-status-select').value;
    const newMemo = document.getElementById('detail-memo').value;

    try {
        const response = await fetch(`${API_ENDPOINT}/api/admin/diagnoses/${currentDiagnosis.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify({ status: newStatus, memo: newMemo })
        });
        if (response.status === 401) { handleLogout(); return; }
        if (!response.ok) throw new Error('Save failed');

        const index = diagnoses.findIndex(d => d.id === currentDiagnosis.id);
        if (index !== -1) { diagnoses[index].status = newStatus; diagnoses[index].memo = newMemo; }
        updateStats();
        renderTable();
        closeModal();
    } catch (error) {
        alert('保存に失敗しました');
    }
}

async function exportCSV() {
    try {
        const response = await fetch(`${API_ENDPOINT}/api/admin/diagnoses/export`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (response.status === 401) { handleLogout(); return; }
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `診断履歴_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    } catch (error) {
        alert('エクスポートに失敗しました');
    }
}

function formatDate(isoString) {
    if (!isoString) return '-';
    const date = new Date(isoString);
    return date.toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

window.openDetail = openDetail;
document.addEventListener('DOMContentLoaded', init);
