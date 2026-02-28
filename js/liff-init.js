/**
 * LIFF初期化
 */

// LIFF ID (本番環境で置き換え)
const LIFF_ID = 'YOUR_LIFF_ID';

// ユーザー情報格納用
let liffProfile = null;

/**
 * LIFF初期化
 */
async function initializeLiff() {
    try {
        await liff.init({ liffId: LIFF_ID });
        console.log('LIFF initialized');

        // ログイン状態確認
        if (!liff.isLoggedIn()) {
            // 未ログインの場合はログインページへ
            liff.login();
            return;
        }

        // プロフィール取得
        liffProfile = await liff.getProfile();
        console.log('Profile:', liffProfile);

    } catch (error) {
        console.error('LIFF init error:', error);
        // 開発環境用のフォールバック
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            console.log('Running in development mode without LIFF');
            liffProfile = {
                userId: 'dev_user_' + Date.now(),
                displayName: 'テストユーザー'
            };
        }
    }
}

/**
 * LINEメッセージ送信
 */
async function sendMessage(message) {
    if (!liff.isInClient()) {
        console.log('Not in LINE app, skip sending message');
        return;
    }

    try {
        await liff.sendMessages([
            {
                type: 'text',
                text: message
            }
        ]);
        console.log('Message sent');
    } catch (error) {
        console.error('Send message error:', error);
    }
}

/**
 * LIFFを閉じる
 */
function closeLiff() {
    if (liff.isInClient()) {
        liff.closeWindow();
    }
}

/**
 * ユーザー情報取得
 */
function getUserProfile() {
    return liffProfile;
}

// 初期化実行
document.addEventListener('DOMContentLoaded', initializeLiff);
