/**
 * 管理画面 JavaScript
 */

// API エンドポイント（本番環境で置き換え）
const API_ENDPOINT = 'https://your-api.run.app';

// デモ用認証情報
const DEMO_CREDENTIALS = {
    username: 'admin',
    password: 'demo1234'
};

// デモ用データ
const DEMO_DATA = [
    {
        id: '1',
        createdAt: '2026-02-28T10:30:00Z',
        lineUserId: 'U1234567890abcdef',
        lineDisplayName: '山田太郎',
        income: 5000000,
        incomeRange: '500〜600万円',
        age: 35,
        employmentType: '正社員',
        totalDebt: 500000,
        monthlyPayment: 15000,
        yearsEmployed: 10,
        borrowableAmount: 38500000,
        contactName: '山田 太郎',
        contactPhone: '090-1234-5678',
        status: '未連絡',
        memo: ''
    },
    {
        id: '2',
        createdAt: '2026-02-28T09:15:00Z',
        lineUserId: 'U2345678901bcdefg',
        lineDisplayName: '佐藤花子',
        income: 4000000,
        incomeRange: '400〜500万円',
        age: 28,
        employmentType: '正社員',
        totalDebt: 0,
        monthlyPayment: 0,
        yearsEmployed: 5,
        borrowableAmount: 42000000,
        contactName: '佐藤 花子',
        contactPhone: '080-2345-6789',
        status: '連絡済み',
        memo: '3/2にメール送信済み'
    },
    {
        id: '3',
        createdAt: '2026-02-27T16:45:00Z',
        lineUserId: 'U3456789012cdefgh',
        lineDisplayName: '鈴木一郎',
        income: 7500000,
        incomeRange: '700万円以上',
        age: 42,
        employmentType: '自営業',
        totalDebt: 2000000,
        monthlyPayment: 50000,
        yearsEmployed: 15,
        borrowableAmount: 52000000,
        contactName: null,
        contactPhone: null,
        status: '面談予約',
        memo: '3/5 14:00 面談予定'
    },
    {
        id: '4',
        createdAt: '2026-02-27T14:20:00Z',
        lineUserId: 'U4567890123defghi',
        lineDisplayName: '田中美咲',
        income: 3500000,
        incomeRange: '300〜400万円',
        age: 25,
        employmentType: '契約社員',
        totalDebt: 300000,
        monthlyPayment: 10000,
        yearsEmployed: 2,
        borrowableAmount: 28000000,
        contactName: '田中 美咲',
        contactPhone: null,
        status: '未連絡',
        memo: ''
    },
    {
        id: '5',
        createdAt: '2026-02-26T11:00:00Z',
        lineUserId: 'U5678901234efghij',
        lineDisplayName: '高橋健太',
        income: 6000000,
        incomeRange: '600〜700万円',
        age: 38,
        employmentType: '正社員',
        totalDebt: 1000000,
        monthlyPayment: 30000,
        yearsEmployed: 12,
        borrowableAmount: 45000000,
        contactName: '高橋 健太',
        contactPhone: '070-3456-7890',
        status: '成約',
        memo: '3/1 契約完了'
    }
];

// 状態管理
let diagnoses = [];
let currentDiagnosis = null;
let isLoggedIn = false;

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
    // イベントリスナー設定
    loginForm.addEventListener('submit', handleLogin);
    btnLogout.addEventListener('click', handleLogout);
    btnRefresh.addEventListener('click', loadData);
    btnExport.addEventListener('click', exportCSV);
    filterStatus.addEventListener('change', renderTable);
    filterDate.addEventListener('change', renderTable);
    modalClose.addEventListener('click', closeModal);
    btnCancel.addEventListener('click', closeModal);
    btnSave.addEventListener('click', saveDetail);

    // セッション確認
    checkSession();
}

/**
 * セッション確認
 */
function checkSession() {
    const session = localStorage.getItem('admin_session');
    if (session) {
        isLoggedIn = true;
        showMainScreen();
        loadData();
    }
}

/**
 * ログイン処理
 */
function handleLogin(e) {
    e.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    // デモ認証
    if (username === DEMO_CREDENTIALS.username && password === DEMO_CREDENTIALS.password) {
        isLoggedIn = true;
        localStorage.setItem('admin_session', 'true');
        loginError.classList.add('hidden');
        showMainScreen();
        loadData();
    } else {
        loginError.textContent = 'ユーザー名またはパスワードが正しくありません';
        loginError.classList.remove('hidden');
    }
}

/**
 * ログアウト処理
 */
function handleLogout() {
    isLoggedIn = false;
    localStorage.removeItem('admin_session');
    mainScreen.classList.add('hidden');
    loginScreen.classList.remove('hidden');
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
}

/**
 * メイン画面表示
 */
function showMainScreen() {
    loginScreen.classList.add('hidden');
    mainScreen.classList.remove('hidden');
}

/**
 * データ読み込み
 */
async function loadData() {
    loadingState.classList.remove('hidden');
    emptyState.classList.add('hidden');
    tableBody.innerHTML = '';

    try {
        // TODO: 本番ではAPIから取得
        // const response = await fetch(`${API_ENDPOINT}/api/admin/diagnoses`);
        // diagnoses = await response.json();
        
        // デモ用データ
        await new Promise(resolve => setTimeout(resolve, 500));
        diagnoses = [...DEMO_DATA];

        updateStats();
        renderTable();
    } catch (error) {
        console.error('Load error:', error);
        alert('データの読み込みに失敗しました');
    } finally {
        loadingState.classList.add('hidden');
    }
}

/**
 * 統計更新
 */
function updateStats() {
    const today = new Date().toISOString().split('T')[0];
    
    statTotal.textContent = diagnoses.length;
    statToday.textContent = diagnoses.filter(d => d.createdAt.startsWith(today)).length;
    statPending.textContent = diagnoses.filter(d => d.status === '未連絡').length;
    statContacted.textContent = diagnoses.filter(d => d.status === '連絡済み').length;
}

/**
 * テーブル描画
 */
function renderTable() {
    const statusFilter = filterStatus.value;
    const dateFilter = filterDate.value;

    let filtered = diagnoses;

    if (statusFilter) {
        filtered = filtered.filter(d => d.status === statusFilter);
    }

    if (dateFilter) {
        filtered = filtered.filter(d => d.createdAt.startsWith(dateFilter));
    }

    if (filtered.length === 0) {
        tableBody.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }

    emptyState.classList.add('hidden');

    tableBody.innerHTML = filtered.map(d => `
        <tr>
            <td>${formatDate(d.createdAt)}</td>
            <td>${escapeHtml(d.lineDisplayName)}</td>
            <td>${d.incomeRange}</td>
            <td>${d.age}歳</td>
            <td><strong>${formatAmount(d.borrowableAmount)}万円</strong></td>
            <td><span class="status-badge ${d.status}">${d.status}</span></td>
            <td><button class="btn-detail" onclick="openDetail('${d.id}')">詳細</button></td>
        </tr>
    `).join('');
}

/**
 * 詳細モーダルを開く
 */
function openDetail(id) {
    currentDiagnosis = diagnoses.find(d => d.id === id);
    if (!currentDiagnosis) return;

    document.getElementById('detail-date').textContent = formatDate(currentDiagnosis.createdAt);
    document.getElementById('detail-name').textContent = currentDiagnosis.lineDisplayName;
    document.getElementById('detail-uid').textContent = currentDiagnosis.lineUserId;
    document.getElementById('detail-income').textContent = currentDiagnosis.incomeRange;
    document.getElementById('detail-age').textContent = currentDiagnosis.age + '歳';
    document.getElementById('detail-employment').textContent = currentDiagnosis.employmentType;
    document.getElementById('detail-debt').textContent = formatAmount(currentDiagnosis.totalDebt) + '万円';
    document.getElementById('detail-monthly').textContent = currentDiagnosis.monthlyPayment.toLocaleString() + '円';
    document.getElementById('detail-years').textContent = currentDiagnosis.yearsEmployed + '年';
    document.getElementById('detail-result').textContent = formatAmount(currentDiagnosis.borrowableAmount) + '万円';
    document.getElementById('detail-contact-name').textContent = currentDiagnosis.contactName || '未入力';
    document.getElementById('detail-contact-phone').textContent = currentDiagnosis.contactPhone || '未入力';
    document.getElementById('detail-status-select').value = currentDiagnosis.status;
    document.getElementById('detail-memo').value = currentDiagnosis.memo || '';

    detailModal.classList.remove('hidden');
}

/**
 * モーダルを閉じる
 */
function closeModal() {
    detailModal.classList.add('hidden');
    currentDiagnosis = null;
}

/**
 * 詳細を保存
 */
async function saveDetail() {
    if (!currentDiagnosis) return;

    const newStatus = document.getElementById('detail-status-select').value;
    const newMemo = document.getElementById('detail-memo').value;

    try {
        // TODO: 本番ではAPIに送信
        // await fetch(`${API_ENDPOINT}/api/admin/diagnoses/${currentDiagnosis.id}`, {
        //     method: 'PUT',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify({ status: newStatus, memo: newMemo })
        // });

        // ローカル更新
        const index = diagnoses.findIndex(d => d.id === currentDiagnosis.id);
        if (index !== -1) {
            diagnoses[index].status = newStatus;
            diagnoses[index].memo = newMemo;
        }

        updateStats();
        renderTable();
        closeModal();
    } catch (error) {
        console.error('Save error:', error);
        alert('保存に失敗しました');
    }
}

/**
 * CSVエクスポート
 */
function exportCSV() {
    const headers = ['日時', 'ユーザー名', 'LINE UID', '年収', '年齢', '雇用形態', '他社借入(合計)', '他社借入(月返済)', '勤続年数', '借入可能額', 'お名前', '電話番号', 'ステータス', 'メモ'];
    
    const rows = diagnoses.map(d => [
        formatDate(d.createdAt),
        d.lineDisplayName,
        d.lineUserId,
        d.incomeRange,
        d.age,
        d.employmentType,
        d.totalDebt,
        d.monthlyPayment,
        d.yearsEmployed,
        d.borrowableAmount,
        d.contactName || '',
        d.contactPhone || '',
        d.status,
        d.memo || ''
    ]);

    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `診断履歴_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    
    URL.revokeObjectURL(url);
}

/**
 * 日付フォーマット
 */
function formatDate(isoString) {
    const date = new Date(isoString);
    return date.toLocaleString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * 金額フォーマット（万円）
 */
function formatAmount(amount) {
    return Math.floor(amount / 10000).toLocaleString();
}

/**
 * HTMLエスケープ
 */
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// グローバルに公開（onclick用）
window.openDetail = openDetail;

// 初期化
document.addEventListener('DOMContentLoaded', init);
