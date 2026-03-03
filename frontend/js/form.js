/**
 * フォーム処理
 */

const API_ENDPOINT = 'https://loan-diagnosis-api-247001240932.asia-northeast1.run.app';

const form = document.getElementById('diagnosis-form');
const incomeSelect = document.getElementById('income-select');
const incomeInputWrapper = document.getElementById('income-input-wrapper');
const incomeInput = document.getElementById('income-input');
const resultModal = document.getElementById('result-modal');
const resultValue = document.getElementById('result-value');
const resultValueCopy = document.getElementById('result-value-copy');
const mainContainer = document.querySelector('.main');

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
let isConsultMode = false;  // 相談希望かどうか

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
        incomeInput.placeholder = value === 'custom-low' ? '300未満の年収（万円）' : '700以上の年収（万円）';
        incomeInput.max = value === 'custom-low' ? 299 : 10000;
        if (value === 'custom-high') incomeInput.min = 700;
    } else {
        incomeInputWrapper.classList.add('hidden');
        incomeInput.required = false;
        incomeInput.value = '';
    }
}

async function handleSubmit(e) {
    e.preventDefault();
    const submitBtn = form.querySelector('.btn-submit');
    submitBtn.disabled = true;
    submitBtn.textContent = '計算中...';

    try {
        const formData = getFormData();
        if (formData.age >= 65) {
            alert('65歳以上は返済期間が短くなるため診断できません');
            return;
        }

        const result = calculateBorrowableAmount(formData.income, formData.age, formData.monthlyPayment * 10000);
        if (!result.success) {
            alert(result.error || '計算できませんでした');
            return;
        }

        lastResult = { ...formData, ...result };
        showResult(result.borrowableAmount);
    } catch (error) {
        alert('エラーが発生しました。もう一度お試しください。');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '診断する';
    }
}

function getFormData() {
    let income;
    const val = incomeSelect.value;
    if (val === 'custom-low' || val === 'custom-high') {
        income = parseInt(incomeInput.value) * 10000;
    } else {
        income = parseInt(val);
    }

    let incomeRange;
    if (income < 3000000) incomeRange = '300万円未満';
    else if (income < 4000000) incomeRange = '300〜400万円';
    else if (income < 5000000) incomeRange = '400〜500万円';
    else if (income < 6000000) incomeRange = '500〜600万円';
    else if (income < 7000000) incomeRange = '600〜700万円';
    else incomeRange = '700万円以上';

    return {
        income, incomeRange,
        age: parseInt(document.getElementById('age').value),
        employmentType: document.querySelector('input[name="employment"]:checked').value,
        totalDebt: parseFloat(document.getElementById('total-debt').value || 0),
        monthlyPayment: parseFloat(document.getElementById('monthly-payment').value || 0),
        yearsEmployed: parseInt(document.getElementById('years-employed').value)
    };
}

function showResult(borrowableAmount) {
    resultValue.textContent = formatAmountInMan(borrowableAmount);
    resultValueCopy.textContent = formatAmountInMan(borrowableAmount) + '万円';
    step1.classList.remove('hidden');
    step2.classList.add('hidden');
    step3.classList.add('hidden');
    resultModal.classList.remove('hidden');
}

function goToStep2() {
    isConsultMode = true;
    step1.classList.add('hidden');
    step2.classList.remove('hidden');
    step3.classList.add('hidden');
    setTimeout(() => contactName.focus(), 100);
}

function goToStep3() {
    step1.classList.add('hidden');
    step2.classList.add('hidden');
    step3.classList.remove('hidden');
}

async function handleCloseOnly() {
    isConsultMode = false;
    const message = `【住宅ローン診断結果】\n借入可能額（目安）: ${formatAmountInMan(lastResult.borrowableAmount)}万円\n\n詳しい審査をご希望の場合は「詳細希望」とお送りください。`;
    await sendMessage(message);
    await sendToApi(lastResult, null, null);
    showCompleteScreen(false);
}

async function handleSubmitContact() {
    isConsultMode = true;
    const name = contactName.value.trim();
    const phone = contactPhone.value.trim();
    let message = `【住宅ローン診断結果】\n借入可能額（目安）: ${formatAmountInMan(lastResult.borrowableAmount)}万円\n\n`;
    if (name || phone) {
        message += `【ご連絡先】\n`;
        if (name) message += `お名前: ${name}\n`;
        if (phone) message += `電話番号: ${phone}\n`;
        message += `\n`;
    }
    message += `詳細希望`;
    await sendMessage(message);
    await sendToApi(lastResult, name, phone);
    goToStep3();
}

async function handleSkipContact() {
    isConsultMode = true;
    const message = `【住宅ローン診断結果】\n借入可能額（目安）: ${formatAmountInMan(lastResult.borrowableAmount)}万円\n\n詳細希望`;
    await sendMessage(message);
    await sendToApi(lastResult, null, null);
    goToStep3();
}

function showCompleteScreen(withContact) {
    if (mainContainer) {
        if (withContact) {
            mainContainer.innerHTML = `
                <div class="complete-screen">
                    <div class="complete-icon">✓</div>
                    <h2>診断完了</h2>
                    <p>ありがとうございました。<br>担当者からのご連絡をお待ちください。</p>
                </div>
            `;
        } else {
            mainContainer.innerHTML = `
                <div class="complete-screen">
                    <div class="complete-icon">✓</div>
                    <h2>診断完了</h2>
                    <p>ご利用ありがとうございました。<br>詳しい審査をご希望の場合は<br>「詳細希望」とお送りください。</p>
                </div>
            `;
        }
    }
    resultModal.classList.add('hidden');
    setTimeout(() => closeLiff(), 500);
}

function handleCloseFinal() {
    showCompleteScreen(isConsultMode);
}

async function sendToApi(data, name, phone) {
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
        contactName: name || '',
        contactPhone: phone || ''
    };
    try {
        const response = await fetch(`${API_ENDPOINT}/api/diagnose`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        return await response.json();
    } catch (error) {
        return null;
    }
}

document.addEventListener('DOMContentLoaded', initForm);
