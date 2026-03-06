/**
 * LIFF初期化
 */

const LIFF_ID = '2009326338-A4LLVEOM';

let liffProfile = null;
let liffAccessToken = null;
let liffInitialized = false;

async function initializeLiff() {
    try {
        await liff.init({ liffId: LIFF_ID });
        console.log('LIFF initialized');

        if (!liff.isLoggedIn()) {
            liff.login();
            return;
        }

        liffProfile = await liff.getProfile();
        liffAccessToken = liff.getAccessToken();
        liffInitialized = true;
        console.log('Profile:', liffProfile);

    } catch (error) {
        console.error('LIFF init error:', error);
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            console.log('Running in development mode without LIFF');
            liffProfile = {
                userId: 'dev_user_' + Date.now(),
                displayName: 'テストユーザー'
            };
            liffInitialized = true;
        }
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

function closeLiff() {
    if (typeof liff !== 'undefined' && liff.isInClient && liff.isInClient()) {
        liff.closeWindow();
    } else {
        window.close();
    }
}

document.addEventListener('DOMContentLoaded', initializeLiff);
