/**
 * LIFF初期化
 */

const LIFF_ID = '2009326338-A4LLVEOM';
const API_ENDPOINT = 'https://loan-diagnosis-api-247001240932.asia-northeast1.run.app';

let liffProfile = null;
let liffAccessToken = null;
let liffInitialized = false;

async function initializeLiff() {
    const submitBtn = document.querySelector('.btn-submit');
    
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = '読み込み中...';
    }
    
    try {
        await liff.init({ liffId: LIFF_ID });
        console.log('LIFF initialized');

        if (!liff.isLoggedIn()) {
            liff.login();
            return;
        }

        liffProfile = await liff.getProfile();
        console.log('Profile:', liffProfile);
        
        liffAccessToken = liff.getAccessToken();
        console.log('Access token obtained');
        
        // 既存診断チェック（API経由）
        const checkResult = await checkExistingDiagnosis(liffProfile.userId);
        if (checkResult && checkResult.exists) {
            showAlreadyDiagnosedScreen(checkResult.result);
            return;
        }
        
        liffInitialized = true;
        
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = '診断する';
        }
        
        window.dispatchEvent(new Event('liffReady'));

    } catch (error) {
        console.error('LIFF init error:', error);
        
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            liffProfile = {
                userId: 'dev_user_' + Date.now(),
                displayName: 'テストユーザー'
            };
            liffInitialized = true;
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = '診断する';
            }
        } else {
            if (submitBtn) {
                submitBtn.textContent = 'エラーが発生しました';
            }
        }
    }
}

async function checkExistingDiagnosis(userId) {
    try {
        const headers = {};
        if (liffAccessToken) {
            headers['X-LIFF-Access-Token'] = liffAccessToken;
        }
        
        const response = await fetch(`${API_ENDPOINT}/api/diagnose/check/${userId}`, {
            method: 'GET',
            headers: headers
        });
        
        if (!response.ok) {
            console.log('Check API returned non-ok status:', response.status);
            return null;
        }
        
        const data = await response.json();
        console.log('Check result:', data);
        return data;
    } catch (error) {
        console.error('Check existing error:', error);
        return null;
    }
}

function showAlreadyDiagnosedScreen(existingResult) {
    const container = document.querySelector('.container');
    const amountMan = existingResult?.borrowableAmountMan || Math.floor((existingResult?.borrowableAmount || 0) / 10000);
    
    container.innerHTML = `
        <header class="header">
            <h1>住宅ローン簡易診断</h1>
        </header>
        <main class="main" style="text-align: center; padding: 40px 20px;">
            <div style="font-size: 48px; margin-bottom: 20px;">✅</div>
            <h2 style="color: #06c755; margin-bottom: 16px;">診断済みです</h2>
            <p style="color: #666; margin-bottom: 24px; line-height: 1.6;">
                既に診断を完了されています。<br>
                結果はLINEトークをご確認ください。
            </p>
            <div style="background: #f5f5f5; padding: 20px; border-radius: 12px; margin-bottom: 24px;">
                <p style="color: #999; font-size: 14px; margin-bottom: 8px;">前回の診断結果</p>
                <p style="font-size: 28px; font-weight: bold; color: #06c755;">${amountMan.toLocaleString()}万円</p>
            </div>
            <button onclick="closeLiff()" style="background: #06c755; color: white; border: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: bold; cursor: pointer;">
                閉じる
            </button>
        </main>
    `;
}

function closeLiff() {
    if (liff.isInClient()) {
        liff.closeWindow();
    }
}

function getUserProfile() {
    return liffProfile;
}

function getLiffAccessToken() {
    return liffAccessToken;
}

function isLiffReady() {
    return liffInitialized;
}

document.addEventListener('DOMContentLoaded', initializeLiff);
