/**
 * 借入可能額 計算ロジック
 */

// 100万円あたりの月返済額テーブル（金利1.5%）
const MONTHLY_PAYMENT_TABLE = {
    35: 3061,
    34: 3116,
    33: 3174,
    32: 3236,
    31: 3301,
    30: 3451,
    29: 3522,
    28: 3597,
    27: 3677,
    26: 3762,
    25: 3999,
    24: 4094,
    23: 4194,
    22: 4300,
    21: 4413,
    20: 4825,
    19: 4952,
    18: 5087,
    17: 5231,
    16: 5385,
    15: 5551
};

/**
 * 借入可能額を計算
 * 
 * @param {number} income - 年収（円）
 * @param {number} age - 年齢
 * @param {number} monthlyPayment - 他社月返済額（円）
 * @returns {object} 計算結果
 */
function calculateBorrowableAmount(income, age, monthlyPayment) {
    // 入力値のバリデーション
    if (income <= 0 || age < 18 || age > 80) {
        return {
            success: false,
            error: '入力値が不正です'
        };
    }

    // 返済負担率
    const repaymentRatio = income < 4000000 ? 0.30 : 0.35;

    // 返済期間（35年 or 80歳-年齢 の短い方）
    const maxPeriodByAge = 80 - age;
    const loanPeriod = Math.min(35, maxPeriodByAge);

    // 返済期間が15年未満の場合は計算不可
    if (loanPeriod < 15) {
        return {
            success: false,
            error: '返済期間が短すぎます',
            loanPeriod: loanPeriod
        };
    }

    // 100万円あたりの月返済額を取得
    const monthlyPerMillion = MONTHLY_PAYMENT_TABLE[loanPeriod] || MONTHLY_PAYMENT_TABLE[15];

    // 他社年間返済額
    const annualOtherPayment = monthlyPayment * 12;

    // 年間返済可能額
    const availableAnnual = income * repaymentRatio - annualOtherPayment;

    // 月あたり返済可能額
    const availableMonthly = availableAnnual / 12;

    // 借入可能額
    let borrowable = (availableMonthly / monthlyPerMillion) * 1000000;

    // 万円単位で切り捨て、マイナスは0に
    borrowable = Math.max(0, Math.floor(borrowable / 10000) * 10000);

    // 上限を1億円に
    borrowable = Math.min(borrowable, 100000000);

    return {
        success: true,
        borrowableAmount: borrowable,
        repaymentRatio: repaymentRatio,
        loanPeriod: loanPeriod,
        monthlyPerMillion: monthlyPerMillion
    };
}

/**
 * 金額をカンマ区切りでフォーマット（万円）
 * 
 * @param {number} amount - 金額（円）
 * @returns {string} フォーマット済み文字列
 */
function formatAmountInMan(amount) {
    const man = Math.floor(amount / 10000);
    return man.toLocaleString('ja-JP');
}

/**
 * 金額をカンマ区切りでフォーマット（円）
 * 
 * @param {number} amount - 金額（円）
 * @returns {string} フォーマット済み文字列
 */
function formatAmount(amount) {
    return amount.toLocaleString('ja-JP');
}
