const form = document.getElementById('diagnosis-form');
const incomeSelect = document.getElementById('income-select');
const incomeInputWrapper = document.getElementById('income-input-wrapper');
const incomeInput = document.getElementById('income-input');
const resultModal = document.getElementById('result-modal');
const resultAmount = document.getElementById('result-amount');
const resultDetail = document.getElementById('result-detail');

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
let savedContactName = null;
let savedContactPhone = null;
let savedConsultType = null;

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
    
    const formData = new FormData(form);
    let income;
    const incomeSelectValue = formData.get('income');
    
    if (incomeSelectValue === 'custom-low' || incomeSelectValue === 'custom-high') {
        income = parseInt(incomeInput.value) * 10000;
    } else {
        income = parseInt(incomeSelectValue);
    }
    
    const incomeRangeMap = {
        '3000000': '300〜400万円',
        '4000000': '400〜500万円',
        '5000000': '500〜600万円',
        '6000000': '600〜700万円',
        'custom-low': '300万円未満',
        'custom-high': '700万円以上'
    };
    
    const data = {
        income: income,
        incomeRange: incomeRangeMap[incomeSelectValue] || `${Math.floor(income/10000)}万円`,
        age: parseInt(formData.get('age')),
        employmentType: formData.get('employmentType'),
        totalDebt: parseFloat(formData.get('existingDebt') || 0) * 10000,
        monthlyPayment: parseFloat(formData.get('monthlyRepayment') || 0) * 10000,
        yearsEmployed: parseInt(formData.get('yearsEmployed'))
    };
    
    const result = calculateLoan(data);
    lastResult = { ...data, ...result };
    
    resultAmount.textContent = `${result.borrowableAmountMan.toLocaleString()}万円`;
    
    const employmentMultipliers = {
        '正社員': 1.0,
        '契約社員': 0.9,
        '派遣社員': 0.85,
        '自営業': 0.8,
        'パート・アルバイト': 0.7
    };
    const multiplier = employmentMultipliers[data.employmentType] || 1.0;
    
    let detailHtml = '<ul class="result-detail-list">';
    detailHtml += `<li>年収: ${(data.income / 10000).toLocaleString()}万円</li>`;
    detailHtml += `<li>年齢: ${data.age}歳</li>`;
    detailHtml += `<li>雇用形態: ${data.employmentType}（係数: ${multiplier}）</li>`;
    detailHtml += `<li>借入期間: ${result.loanPeriod}年</li>`;
    detailHtml += `<li>返済比率: ${(result.repaymentRatio * 100).toFixed(0)}%</li>`;
    if (data.totalDebt > 0) {
        detailHtml += `<li>他社借入: ${(data.totalDebt / 10000).toLocaleString()}万円</li>`;
    }
    detailHtml += '</ul>';
    resultDetail.innerHTML = detailHtml;
    
    showResultModal();
}

function showResultModal() {
    resultModal.classList.remove('hidden');
    step1.classList.remove('hidden');
    step2.classList.add('hidden');
    step3.classList.add('hidden');
}

function goToStep2() {
    savedConsultType = '相談希望';
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

// 「閉じる」ボタン（step1）- APIを呼んでから閉じる
async function handleCloseOnly() {
    savedConsultType = '結果だけ';
    savedContactName = null;
    savedContactPhone = null;
    
    // API呼び出しして閉じる
    try {
        await sendToApi(lastResult, savedContactName, savedContactPhone, savedConsultType);
    } catch (err) {
        console.error('API Error:', err);
    }
    closeLiff();
}

// 「送信して相談する」ボタン（step2）
async function handleSubmitContact() {
    const name = contactName.value.trim();
    const phone = contactPhone.value.trim();

    if (!name) {
        alert('お名前を入力してください');
        contactName.focus();
        return;
    }

    savedContactName = name;
    savedContactPhone = phone;
    savedConsultType = '相談希望';
    
    // API呼び出しして閉じる
    try {
        await sendToApi(lastResult, savedContactName, savedContactPhone, savedConsultType);
    } catch (err) {
        console.error('API Error:', err);
    }
    goToStep3();
}

// 「入力せずにLINEで相談する」ボタン（step2）
async function handleSkipContact() {
    savedContactName = null;
    savedContactPhone = null;
    savedConsultType = '相談希望';
    
    // API呼び出しして閉じる
    try {
        await sendToApi(lastResult, savedContactName, savedContactPhone, savedConsultType);
    } catch (err) {
        console.error('API Error:', err);
    }
    goToStep3();
}

// 「閉じる」ボタン（step3）
async function handleCloseFinal() {
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
        borrowableAmount: data.borrowableAmount,
        consultType: consultType || '結果だけ',
        contactName: name || null,
        contactPhone: phone || null
    };

    const response = await fetch('https://loan-diagnosis-api-247001240932.asia-northeast1.run.app/api/diagnose', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
    }

    return response.json();
}

function closeLiff() {
    if (typeof liff !== 'undefined' && liff.isInClient && liff.isInClient()) {
        liff.closeWindow();
    } else {
        window.close();
    }
}

document.addEventListener('DOMContentLoaded', initForm);
