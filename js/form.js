/**
 * フォーム処理
 */

// API エンドポイント（本番環境で置き換え）
const API_ENDPOINT = 'https://your-api.run.app';

// DOM要素
const form = document.getElementById('diagnosis-form');
const incomeSelect = document.getElementById('income-select');
const incomeInputWrapper = document.getElementById('income-input-wrapper');
const incomeInput = document.getElementById('income-input');
const resultModal = document.getElementById('result-modal');
const resultValue = document.getElementById('result-value');
const btnDetail = document.getElementById('btn-detail');
const btnClose = document.getElementById('btn-close');

// 計算結果を保存
let lastResult = null;

/**
 * 初期化
 */
function initForm() {
    // 年収選択の変更イベント
    incomeSelect.addEventListener('change', handleIncomeSelectChange);

    // フォーム送信イベント
    form.addEventListener('submit', handleSubmit);

    // モーダルボタン
    btnDetail.addEventListener('click', handleDetailClick);
    btnClose.addEventListener('click', handleCloseClick);
}

/**
 * 年収選択変更ハンドラ
 */
function handleIncomeSelectChange(e) {
    const value = e.target.value;

    if (value === 'custom-low' || value === 'custom-high') {
        // 手入力を表示
        incomeInputWrapper.classList.remove('hidden');
        incomeInput.required = true;
        incomeInput.focus();

        // プレースホルダーを設定
        if (value === 'custom-low') {
            incomeInput.placeholder = '300未満の年収（万円）';
            incomeInput.max = 299;
        } else {
            incomeInput.placeholder = '700以上の年収（万円）';
            incomeInput.min = 700;
            incomeInput.max = 10000;
        }
    } else {
        // 手入力を非表示
        incomeInputWrapper.classList.add('hidden');
        incomeInput.required = false;
        incomeInput.value = '';
    }
}

/**
 * フォーム送信ハンドラ
 */
async function handleSubmit(e) {
    e.preventDefault();

    // 送信ボタンを無効化
    const submitBtn = form.querySelector('.btn-submit');
    submitBtn.disabled = true;
    submitBtn.classList.add('loading');
    submitBtn.textContent = '計算中...';

    try {
        // 入力値を取得
        const formData = getFormData();

        // 計算実行
        const result = calculateBorrowableAmount(
            formData.income,
            formData.age,
            formData.monthlyPayment
        );

        if (!result.success) {
            alert(result.error || '計算できませんでした');
            return;
        }

        // 結果を保存
        lastResult = {
            ...formData,
            ...result
        };

        // 結果を表示
        showResult(result.borrowableAmount);

        // APIに送信（バックグラウンド）
        sendToApi(lastResult);

    } catch (error) {
        console.error('Submit error:', error);
        alert('エラーが発生しました。もう一度お試しください。');
    } finally {
        submitBtn.disabled = false;
        submitBtn.classList.remove('loading');
        submitBtn.textContent = '診断する';
    }
}

/**
 * フォームデータを取得
 */
function getFormData() {
    // 年収
    let income;
    const incomeSelectValue = incomeSelect.value;

    if (incomeSelectValue === 'custom-low' || incomeSelectValue === 'custom-high') {
        income = parseInt(incomeInput.value) * 10000; // 万円→円
    } else {
        income = parseInt(incomeSelectValue);
    }

    // 年収の範囲ラベル
    let incomeRange;
    if (income < 3000000) {
        incomeRange = '300万円未満';
    } else if (income < 4000000) {
        incomeRange = '300〜400万円';
    } else if (income < 5000000) {
        incomeRange = '400〜500万円';
    } else if (income < 6000000) {
        incomeRange = '500〜600万円';
    } else if (income < 7000000) {
        incomeRange = '600〜700万円';
    } else {
        incomeRange = '700万円以上';
    }

    // その他の項目
    const age = parseInt(document.getElementById('age').value);
    const employmentType = document.querySelector('input[name="employment"]:checked').value;
    const totalDebt = parseInt(document.getElementById('total-debt').value || 0) * 10000; // 万円→円
    const monthlyPayment = parseInt(document.getElementById('monthly-payment').value || 0);
    const yearsEmployed = parseInt(document.getElementById('years-employed').value);

    return {
        income,
        incomeRange,
        age,
        employmentType,
        totalDebt,
        monthlyPayment,
        yearsEmployed
    };
}

/**
 * 結果を表示
 */
function showResult(borrowableAmount) {
    resultValue.textContent = formatAmountInMan(borrowableAmount);
    resultModal.classList.remove('hidden');
}

/**
 * 結果を非表示
 */
function hideResult() {
    resultModal.classList.add('hidden');
}

/**
 * 「詳しく相談する」ボタン
 */
async function handleDetailClick() {
    // LINEメッセージを送信
    const message = `【住宅ローン診断結果】\n借入可能額（目安）: ${formatAmountInMan(lastResult.borrowableAmount)}万円\n\n詳細希望`;

    await sendMessage(message);

    // LIFFを閉じる
    closeLiff();
}

/**
 * 「閉じる」ボタン
 */
function handleCloseClick() {
    hideResult();
}

/**
 * APIに診断結果を送信
 */
async function sendToApi(data) {
    // ユーザー情報を追加
    const profile = getUserProfile();

    const payload = {
        lineUserId: profile?.userId || 'unknown',
        lineDisplayName: profile?.displayName || '不明',
        income: data.income,
        incomeRange: data.incomeRange,
        age: data.age,
        employmentType: data.employmentType,
        totalDebt: data.totalDebt,
        monthlyPayment: data.monthlyPayment,
        yearsEmployed: data.yearsEmployed,
        borrowableAmount: data.borrowableAmount,
        repaymentRatio: data.repaymentRatio,
        loanPeriod: data.loanPeriod
    };

    try {
        const response = await fetch(`${API_ENDPOINT}/api/diagnose`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error('API error');
        }

        const result = await response.json();
        console.log('API response:', result);

    } catch (error) {
        console.error('API send error:', error);
        // エラーでもユーザー体験は継続
    }
}

// 初期化
document.addEventListener('DOMContentLoaded', initForm);
