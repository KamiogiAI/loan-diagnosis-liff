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
const btnCloseOnly = document.getElementById('btn-close-only');
const btnSubmitContact = document.getElementById('btn-submit-contact');
const btnSkipContact = document.getElementById('btn-skip-contact');
const btnCloseFinal = document.getElementById('btn-close-final');
const contactName = document.getElementById('contact-name');
const contactPhone = document.getElementById('contact-phone');
let lastResult = null;
let apiSent = false;
function initForm() {
    incomeSelect.addEventListener('change', handleIncomeSelectChange);
    form.addEventListener('submit', handleSubmit);
    btnConsult.addEventListener('click', goToStep2);
    btnCloseOnly.addEventListener('click', handleCloseOnly);
    btnSubmitContact.addEventListener('click', handleSubmitContact);
    btnSkipContact.addEventListener('click', handleSkipContact);
    btnCloseFinal.addEventListener('click', handleCloseFinal);
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
        if (formData.age >= 65) {
            alert('65歳以上は返済期間が短くなるため診断できません');
            submitBtn.disabled = false;
            submitBtn.textContent = '診断する';
            return;
        }
        const result = calculateBorrowableAmount(formData.income, formData.age, formData.monthlyPayment * 10000);
        if (!result.success) {
            alert(result.error || '計算できませんでした');
            submitBtn.disabled = false;
            submitBtn.textContent = '診断する';
            return;
        }
        lastResult = { ...formData, ...result };
        apiSent = false;
        // 1. 完了画面を表示
        showResult();
        // 2. API呼び出し（LINE通知 + メール送信）
        sendToApi(lastResult, null, null, '結果だけ');
        apiSent = true;
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
        income = parseInt(incomeInput.value) * 10000;
    } else {
        income = parseInt(incomeSelectValue);
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
        age: parseInt(document.getElementById('age').value),
        employmentType: document.querySelector('input[name="employment"]:checked')?.value || '',
        totalDebt: parseInt(document.getElementById('total-debt').value) || 0,
        monthlyPayment: parseInt(document.getElementById('monthly-payment').value) || 0,
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
async function handleCloseOnly() {
    closeLiff();
}
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
    await sendToApi(lastResult, name, phone, '相談希望');
    goToStep3();
}
async function handleSkipContact() {
    await sendToApi(lastResult, null, null, '相談希望');
    goToStep3();
}
function handleCloseFinal() {
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
        consultType: consultType || ''
    };
    const accessToken = typeof getLiffAccessToken === 'function' ? getLiffAccessToken() : null;
    const headers = { 'Content-Type': 'application/json' };
    if (accessToken) {
        headers['X-LIFF-Access-Token'] = accessToken;
    }
    try {
        const response = await fetch(API_ENDPOINT + '/api/diagnose', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(payload)
        });
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        return null;
    }
}
function closeLiff() {
    if (typeof liff !== 'undefined' && liff.isInClient && liff.isInClient()) {
        liff.closeWindow();
    } else {
        window.close();
    }
}
document.addEventListener('DOMContentLoaded', initForm);
