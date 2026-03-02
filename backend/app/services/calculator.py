"""
借入可能額計算ロジック
"""


def get_monthly_payment_per_million(rate: float, years: int) -> float:
    """
    100万円あたりの月返済額を計算（元利均等返済）
    
    Args:
        rate: 年利（%）
        years: 返済期間（年）
    
    Returns:
        月返済額（円）
    """
    # エッジケース: 返済期間が0以下
    if years <= 0:
        return float('inf')  # 借入不可を示す
    
    if rate == 0:
        return 1_000_000 / (years * 12)
    
    monthly_rate = rate / 100 / 12
    n = years * 12
    
    # 元利均等返済の計算式
    payment = 1_000_000 * monthly_rate * (1 + monthly_rate) ** n / ((1 + monthly_rate) ** n - 1)
    return payment


def calculate_borrowable_amount(
    income: int,
    age: int,
    monthly_payment: float  # 万円
) -> dict:
    """
    借入可能額を計算
    
    Args:
        income: 年収（円）
        age: 年齢
        monthly_payment: 他社月返済額（万円）
    
    Returns:
        計算結果のdict
    """
    # 返済負担率（年収400万未満: 30%, 400万以上: 35%）
    ratio = 0.30 if income < 4_000_000 else 0.35
    
    # 返済期間（35年 or 80歳-年齢 の短い方）
    loan_period = min(35, 80 - age)
    
    # エッジケース: 返済期間が0以下（80歳以上）
    if loan_period <= 0:
        return {
            "borrowableAmount": 0,
            "borrowableAmountMan": 0,
            "repaymentRatio": ratio,
            "loanPeriod": 0
        }
    
    # 審査金利1.5%での100万円あたり月返済額
    monthly_per_million = get_monthly_payment_per_million(1.5, loan_period)
    
    # エッジケース: 月返済額が計算できない
    if monthly_per_million <= 0 or monthly_per_million == float('inf'):
        return {
            "borrowableAmount": 0,
            "borrowableAmountMan": 0,
            "repaymentRatio": ratio,
            "loanPeriod": loan_period
        }
    
    # 他社年間返済額（万円→円に変換）
    annual_other_payment = monthly_payment * 10000 * 12
    
    # 年間返済可能額
    available_annual = income * ratio - annual_other_payment
    
    # 借入可能額計算
    if available_annual <= 0:
        borrowable = 0
    else:
        borrowable = (available_annual / 12) / monthly_per_million * 1_000_000
    
    # 万円単位で切り捨て、負の値は0に
    borrowable = max(0, int(borrowable / 10000) * 10000)
    
    return {
        "borrowableAmount": borrowable,
        "borrowableAmountMan": borrowable // 10000,
        "repaymentRatio": ratio,
        "loanPeriod": loan_period
    }
