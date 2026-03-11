/**
 * フォーム処理
 */
const API_ENDPOINT = 'https://loan-diagnosis-api-247001240932.asia-northeast1.run.app';

const form = document.getElementById('diagnosis-form');
const incomeSelect = document.getElementById('income-select');
const incomeInputWrapper = document.getElementById('income-input-wrapper');
const incomeInput = document.getElementById('income-input');
const resultModal = document.getElementById('result-modal');

const step1 = document.getElementById('result-step-1');
const step2 = document.getElementById('result-step-2');
const step3 = document.getElementById('result-step-3');

const btnConsult = document.getElementById('btn-consult');
// const btnCloseOnly = document.getElementById('btn-close-only'); // 削除
const btnSubmitContact = document.getElementById('btn-submit-contact');
// const btnSkipContact = document.getElementById('btn-skip-contact'); // 削除
// const btnCloseFinal = document.getElementById('btn-close-final'); // 削除

const contactName = document.getElementById('contact-name');
const contactPhone = document.getElementById('contact-phone');

let lastResult = null;
let savedContactName = null;
let savedContactPhone = null;
let savedConsultType = null;

function initForm() {
    incomeSelect.addEventListener('change', handleIncomeSelectChange);
    form.addEventListener('submit', handleSubmit);
    btnConsult.addEventListener('click', goToStep2);
    // btnCloseOnly削除
    btnSubmitContact.addEventListener('click', handleSubmitContact);
    // btnSkipContact削除
    // btnCloseFinal削除
}

function handleIncomeSelectChange(e) {
    const value = e.target.value;
    if (value === 'custom-low' || value === 'custom-high') {
        incomeInputWrapper.classList.remove('hidden');
        incomeInput.required = true;
        incomeInput.focus();
        if (value === 'custom-low') {
            incomeInput.placeholder = '300未満の年収（万円）';
            incomeInput.max = 299;
            incomeInput.min = 0;
        } else {
            incomeInput.placeholder = '700以上の年収（万円）';
            incomeInput.min = 700;
            incomeInput.max = 10000;
        }
    } else {
        incomeInputWrapper.classList.add('hidden');
        incomeInput.required = false;
        incomeInput.value = '';
        incomeInput.min = 0;
        incomeInput.max = 10000;
    }
}

async function handleSubmit(e) {
    e.preventDefault();
    const submitBtn = form.querySelector('.btn-submit');
    submitBtn.disabled = true;
    submitBtn.textContent = '診断中...';

    try {
        const formData = getFormData();
        
        if (isNaN(formData.income) || formData.income <= 0) {
            alert('年収を正しく入力してください');
            return;
        }
        if (isNaN(formData.age) || formData.age < 18 || formData.age > 100) {
            alert('年齢を正しく入力してください');
            return;
        }
        if (formData.age >= 65) {
            alert('65歳以上は返済期間が短くなるため診断できません');
            return;
        }

        // 重複チェック
        const profile = typeof getUserProfile === 'function' ? getUserProfile() : null;
        const lineUserId = profile?.userId || 'unknown';
        
        if (lineUserId && lineUserId !== 'unknown') {
            try {
                const checkRes = await fetch(`${API_ENDPOINT}/api/diagnose/check/${lineUserId}`);
                const checkData = await checkRes.json();
                if (checkData.exists) {
                    alert('既に診断済みです。\n診断は1回のみご利用いただけます。');
                    submitBtn.disabled = false;
                    submitBtn.textContent = '診断する';
                    return;
                }
            } catch (e) {
                console.error('Check duplicate error:', e);
            }
        }

        const result = calculateBorrowableAmount(formData.income, formData.age, formData.monthlyPayment);
        
        if (!result.success) {
            alert(result.error || '計算できませんでした');
            return;
        }

        lastResult = { ...formData, ...result };
        savedContactName = null;
        savedContactPhone = null;
        savedConsultType = '結果だけ';
        
        // 診断結果をサーバーに送信
        await sendToApiSafe(lastResult, null, null, '結果だけ');
        
        showResult();

    } catch (error) {
        console.error('Submit error:', error);
        alert('エラーが発生しました。もう一度お試しください。');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '診断する';
    }
}

function getFormData() {
    let income;
    const incomeSelectValue = incomeSelect.value;
    if (incomeSelectValue === 'custom-low' || incomeSelectValue === 'custom-high') {
        const inputVal = parseInt(incomeInput.value);
        income = isNaN(inputVal) ? 0 : inputVal * 10000;
    } else {
        income = parseInt(incomeSelectValue) || 0;
    }

    let incomeRange;
    if (income < 3000000) incomeRange = '300万円未満';
    else if (income < 4000000) incomeRange = '300〜400万円';
    else if (income < 5000000) incomeRange = '400〜500万円';
    else if (income < 6000000) incomeRange = '500〜600万円';
    else if (income < 7000000) incomeRange = '600〜700万円';
    else incomeRange = '700万円以上';

    return {
        income,
        incomeRange,
        age: parseInt(document.getElementById('age').value) || 0,
        employmentType: document.querySelector('input[name="employment"]:checked')?.value || '',
        totalDebt: (parseInt(document.getElementById('total-debt').value) || 0) * 10000,
        monthlyPayment: (parseInt(document.getElementById('monthly-payment').value) || 0) * 10000,
        yearsEmployed: parseInt(document.getElementById('years-employed').value) || 0
    };
}

function showResult() {
    step1.classList.remove('hidden');
    step2.classList.add('hidden');
    step3.classList.add('hidden');
    resultModal.classList.remove('hidden');
}

function goToStep2() {
    step1.classList.add('hidden');
    step2.classList.remove('hidden');
    step3.classList.add('hidden');
    contactName.focus();
}

function goToStep3() {
    step1.classList.add('hidden');
    step2.classList.add('hidden');
    step3.classList.remove('hidden');
}

// 「閉じる」ボタン（step1）
async function handleCloseOnly() {
    savedConsultType = '結果だけ';
    // API送信完了を待ってから閉じる
    await sendToApiSafe(lastResult, null, null, '結果だけ');
    closeLiff();
}

// 安全なAPI送信（エラーでも止まらない）
async function sendToApiSafe(data, name, phone, consultType) {
    try {
        await sendToApi(data, name, phone, consultType);
    } catch (err) {
        console.error('API Error:', err);
    }
}


// 「送信して閉じる」ボタン（step2）
async function handleSubmitContact() {
    const name = contactName.value.trim();
    const phone = contactPhone.value.trim();

    if (!name) {
        alert('お名前を入力してください');
        contactName.focus();
        return;
    }
    if (!phone) {
        alert('電話番号を入力してください');
        contactPhone.focus();
        return;
    }
    
    // 連絡先を送信して完了画面へ
    await sendToApiSafe(lastResult, name, phone, '相談希望');
    goToStep3();
}

// 「入力せずに閉じる」ボタン（step2）
async function handleSkipContact() {
    // API送信→閉じる
    await sendToApiSafe(lastResult, null, null, '相談希望');
    closeLiff();
}

// 「閉じる」ボタン（step3）- ここでAPI呼び出し
async function handleCloseFinal() {
    try {
        await sendToApi(lastResult, savedContactName, savedContactPhone, savedConsultType);
    } catch (err) {
        console.error('API Error:', err);
    }
    closeLiff();
}

async function sendToApi(data, name, phone, consultType) {
    const profile = typeof getUserProfile === 'function' ? getUserProfile() : null;
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
        contactName: name || '',
        contactPhone: phone || '',
        consultType: consultType || '結果だけ'
    };

    const accessToken = typeof getLiffAccessToken === 'function' ? getLiffAccessToken() : null;
    const headers = { 'Content-Type': 'application/json' };
    if (accessToken) {
        headers['X-LIFF-Access-Token'] = accessToken;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(API_ENDPOINT + '/api/diagnose', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload),
        signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
    }
    
    return await response.json();
}

function closeLiff() {
    alert('閉じます');
    if (typeof liff !== 'undefined' && liff.isInClient && liff.isInClient()) {
        liff.closeWindow();
    } else {
        alert('LIFF外です');
        window.close();
    }
}

document.addEventListener('DOMContentLoaded', initForm);
