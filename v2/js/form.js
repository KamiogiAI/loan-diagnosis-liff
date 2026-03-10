/**
 * フォーム処理
 */

const API_ENDPOINT = 'https://loan-diagnosis-api-247001240932.asia-northeast1.run.app';

let form, incomeSelect, incomeInputWrapper, incomeInput, resultModal;
let step1, step2, step3;
let btnConsult, btnCloseOnly, btnSubmitContact, btnSkipContact, btnCloseFinal;
let contactName, contactPhone;
let lastResult = null;
let isConsultMode = false;
let apiSent = false;
let formInitialized = false;

// ページ読み込み時にテスト表示
document.addEventListener('DOMContentLoaded', function() {
    var testDiv = document.createElement('div');
    testDiv.style.cssText = 'background:red;color:white;padding:10px;position:fixed;top:0;left:0;z-index:9999;';
    testDiv.textContent = 'JS読み込み成功 - ' + new Date().toLocaleTimeString();
    document.body.appendChild(testDiv);
});

function handleIncomeSelectChange(e) {
    var wrapper = document.getElementById('income-input-wrapper');
    var input = document.getElementById('income-input');
    
    // デバッグ表示
    var debug = document.getElementById('debug-info');
    if (!debug) {
        debug = document.createElement('div');
        debug.id = 'debug-info';
        debug.style.cssText = 'background:blue;color:white;padding:10px;position:fixed;top:40px;left:0;z-index:9999;';
        document.body.appendChild(debug);
    }
    debug.textContent = 'onchange: ' + (e.target ? e.target.value : 'no target');
    
    if (!wrapper || !input) {
        debug.textContent += ' - 要素なし!';
        return;
    }
    
    var value = e.target ? e.target.value : '';
    
    if (value === 'custom-low' || value === 'custom-high') {
        wrapper.classList.remove('hidden');
        wrapper.style.display = 'flex';
        input.required = true;
        input.placeholder = value === 'custom-low' ? '300未満の年収（万円）' : '700以上の年収（万円）';
    } else {
        wrapper.classList.add('hidden');
        wrapper.style.display = 'none';
        input.required = false;
        input.value = '';
    }
}

function initForm() {
    if (formInitialized) return;
    
    form = document.getElementById('diagnosis-form');
    incomeSelect = document.getElementById('income-select');
    incomeInputWrapper = document.getElementById('income-input-wrapper');
    incomeInput = document.getElementById('income-input');
    resultModal = document.getElementById('result-modal');
    
    step1 = document.getElementById('result-step-1');
    step2 = document.getElementById('result-step-2');
    step3 = document.getElementById('result-step-3');
    
    btnConsult = document.getElementById('btn-consult');
    btnCloseOnly = document.getElementById('btn-close-only');
    btnSubmitContact = document.getElementById('btn-submit-contact');
    btnSkipContact = document.getElementById('btn-skip-contact');
    btnCloseFinal = document.getElementById('btn-close-final');
    
    contactName = document.getElementById('contact-name');
    contactPhone = document.getElementById('contact-phone');
    
    if (!form || !incomeSelect) {
        return;
    }
    
    form.addEventListener('submit', handleSubmit);
    
    if (btnConsult) btnConsult.addEventListener('click', goToStep2);
    if (btnCloseOnly) btnCloseOnly.addEventListener('click', handleCloseOnly);
    if (btnSubmitContact) btnSubmitContact.addEventListener('click', handleSubmitContact);
    if (btnSkipContact) btnSkipContact.addEventListener('click', handleSkipContact);
    if (btnCloseFinal) btnCloseFinal.addEventListener('click', handleCloseFinal);
    
    formInitialized = true;
}

async function handleSubmit(e) {
    e.preventDefault();
    const submitBtn = form.querySelector('.btn-submit');
    
    if (typeof isLiffReady === 'function' && !isLiffReady()) {
        alert('初期化中です。しばらくお待ちください。');
        return;
    }
    
    const profile = getUserProfile();
    if (!profile || !profile.userId) {
        alert('LINEの認証情報を取得できませんでした。ページを再読み込みしてください。');
        return;
    }
    
    submitBtn.disabled = true;
    submitBtn.textContent = '計算中...';

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
        
        showResult();
        
    } catch (error) {
        console.error('Error:', error);
        alert('エラーが発生しました。もう一度お試しください。');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '診断する';
    }
}

function getFormData() {
    var selEl = document.getElementById('income-select');
    var inEl = document.getElementById('income-input');
    
    let income;
    const val = selEl.value;
    if (val === 'custom-low' || val === 'custom-high') {
        income = parseInt(inEl.value) * 10000;
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

    const employmentRadio = document.querySelector('input[name="employment"]:checked');
    
    return {
        income,
        incomeRange,
        age: parseInt(document.getElementById('age').value),
        employmentType: employmentRadio ? employmentRadio.value : '',
        totalDebt: parseInt(document.getElementById('total-debt').value) || 0,
        monthlyPayment: parseInt(document.getElementById('monthly-payment').value) || 0,
        yearsEmployed: parseInt(document.getElementById('years-employed').value) || 0
    };
}

function showResult() {
    var s1 = document.getElementById('result-step-1');
    var s2 = document.getElementById('result-step-2');
    var s3 = document.getElementById('result-step-3');
    var modal = document.getElementById('result-modal');
    
    s1.classList.remove('hidden');
    s2.classList.add('hidden');
    s3.classList.add('hidden');
    modal.classList.remove('hidden');
}

function goToStep2() {
    var s1 = document.getElementById('result-step-1');
    var s2 = document.getElementById('result-step-2');
    var s3 = document.getElementById('result-step-3');
    var cName = document.getElementById('contact-name');
    
    isConsultMode = true;
    s1.classList.add('hidden');
    s2.classList.remove('hidden');
    s3.classList.add('hidden');
    if (cName) setTimeout(function() { cName.focus(); }, 100);
}

function goToStep3() {
    var s1 = document.getElementById('result-step-1');
    var s2 = document.getElementById('result-step-2');
    var s3 = document.getElementById('result-step-3');
    
    s1.classList.add('hidden');
    s2.classList.add('hidden');
    s3.classList.remove('hidden');
}

async function handleCloseOnly() {
    if (!apiSent) {
        const result = await sendToApi(lastResult, null, null, '結果だけ');
        apiSent = true;
        
        if (result && result.duplicate) {
            showAlreadyDiagnosed(result.result);
            return;
        }
    }
    closeLiff();
}

async function handleSubmitContact() {
    var cName = document.getElementById('contact-name');
    var cPhone = document.getElementById('contact-phone');
    
    isConsultMode = true;
    const name = cName ? cName.value.trim() : '';
    const phone = cPhone ? cPhone.value.trim() : '';
    
    if (!name) {
        alert('お名前を入力してください');
        if (cName) cName.focus();
        return;
    }
    if (!phone) {
        alert('電話番号を入力してください');
        if (cPhone) cPhone.focus();
        return;
    }
    
    const phoneClean = phone.replace(/[-\s]/g, '');
    if (!/^[0-9]{10,11}$/.test(phoneClean)) {
        alert('正しい電話番号を入力してください');
        if (cPhone) cPhone.focus();
        return;
    }
    
    if (!apiSent) {
        const result = await sendToApi(lastResult, name, phone, '相談希望');
        apiSent = true;
        
        if (result && result.duplicate) {
            showAlreadyDiagnosed(result.result);
            return;
        }
    }
    goToStep3();
}

async function handleSkipContact() {
    isConsultMode = true;
    
    if (!apiSent) {
        const result = await sendToApi(lastResult, null, null, '相談希望');
        apiSent = true;
        
        if (result && result.duplicate) {
            showAlreadyDiagnosed(result.result);
            return;
        }
    }
    goToStep3();
}

function handleCloseFinal() {
    closeLiff();
}

function showAlreadyDiagnosed(existingResult) {
    const amountMan = existingResult?.borrowableAmountMan || Math.floor((existingResult?.borrowableAmount || 0) / 10000);
    
    document.querySelector('.container').innerHTML = 
        '<header class="header"><h1>住宅ローン簡易診断</h1></header>' +
        '<main class="main" style="text-align: center; padding: 40px 20px;">' +
        '<div style="font-size: 48px; margin-bottom: 20px;">✅</div>' +
        '<h2 style="color: #06c755; margin-bottom: 16px;">診断済みです</h2>' +
        '<p style="color: #666; margin-bottom: 24px; line-height: 1.6;">既に診断を完了されています。<br>結果はLINEトークをご確認ください。</p>' +
        '<div style="background: #f5f5f5; padding: 20px; border-radius: 12px; margin-bottom: 24px;">' +
        '<p style="color: #999; font-size: 14px; margin-bottom: 8px;">前回の診断結果</p>' +
        '<p style="font-size: 28px; font-weight: bold; color: #06c755;">' + amountMan.toLocaleString() + '万円</p></div>' +
        '<button onclick="closeLiff()" style="background: #06c755; color: white; border: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: bold; cursor: pointer;">閉じる</button></main>';
}

async function sendToApi(data, name, phone, consultType) {
    const profile = getUserProfile();
    
    if (!profile || !profile.userId) {
        console.error('No profile available');
        return null;
    }
    
    const payload = {
        lineUserId: profile.userId,
        lineDisplayName: profile.displayName || '',
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
    
    const accessToken = getLiffAccessToken();
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

document.addEventListener('DOMContentLoaded', initForm);
window.addEventListener('load', initForm);
setTimeout(initForm, 100);
setTimeout(initForm, 500);
