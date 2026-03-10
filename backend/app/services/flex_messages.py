"""
LINE Flex Message Templates
診断完了後のカードメッセージなど
"""

DIAGNOSIS_URL = "https://loan.free-up.jp"


def get_diagnosis_card_message() -> dict:
    """診断開始カードのFlex Message（画像なし版）"""
    return {
        "type": "flex",
        "altText": "住宅ローン簡易診断",
        "contents": {
            "type": "bubble",
            "body": {
                "type": "box",
                "layout": "vertical",
                "contents": [
                    {
                        "type": "text",
                        "text": "🏠",
                        "size": "xxl",
                        "align": "center"
                    },
                    {
                        "type": "text",
                        "text": "住宅ローン簡易診断",
                        "weight": "bold",
                        "size": "xl",
                        "color": "#1a1a1a",
                        "align": "center",
                        "margin": "md"
                    },
                    {
                        "type": "text",
                        "text": "あなたの借入可能額を簡単診断！",
                        "size": "sm",
                        "color": "#666666",
                        "margin": "lg",
                        "align": "center",
                        "wrap": True
                    },
                    {
                        "type": "text",
                        "text": "約1分で完了します",
                        "size": "xs",
                        "color": "#999999",
                        "margin": "md",
                        "align": "center"
                    }
                ]
            },
            "footer": {
                "type": "box",
                "layout": "vertical",
                "spacing": "sm",
                "contents": [
                    {
                        "type": "button",
                        "style": "primary",
                        "height": "sm",
                        "action": {
                            "type": "uri",
                            "label": "診断を開始する",
                            "uri": DIAGNOSIS_URL
                        },
                        "color": "#2563eb"
                    }
                ],
                "flex": 0
            }
        }
    }


def get_result_card_message() -> dict:
    """診断完了後の結果確認カードのFlex Message"""
    return {
        "type": "flex",
        "altText": "診断が完了しました",
        "contents": {
            "type": "bubble",
            "body": {
                "type": "box",
                "layout": "vertical",
                "contents": [
                    {
                        "type": "text",
                        "text": "✅ 診断完了",
                        "weight": "bold",
                        "size": "lg",
                        "color": "#22c55e"
                    },
                    {
                        "type": "text",
                        "text": "診断が完了しました。",
                        "size": "sm",
                        "color": "#666666",
                        "margin": "md",
                        "wrap": True
                    },
                    {
                        "type": "text",
                        "text": "下のボタンをタップして結果を確認してください。",
                        "size": "xs",
                        "color": "#999999",
                        "margin": "md",
                        "wrap": True
                    }
                ]
            },
            "footer": {
                "type": "box",
                "layout": "vertical",
                "spacing": "sm",
                "contents": [
                    {
                        "type": "button",
                        "style": "primary",
                        "height": "sm",
                        "action": {
                            "type": "message",
                            "label": "結果を見る",
                            "text": "結果を見る"
                        },
                        "color": "#2563eb"
                    }
                ],
                "flex": 0
            }
        }
    }


def get_consult_response_message() -> dict:
    """相談希望への返信メッセージ"""
    return {
        "type": "text",
        "text": """ご相談のご希望ありがとうございます。

担当者より改めてご連絡させていただきます。
今しばらくお待ちくださいませ。"""
    }


def get_diagnosis_result_message(
    borrowable_amount: int,
    display_name: str = "",
    consult_type: str = ""
) -> dict:
    """診断結果のメッセージ"""
    amount_man = borrowable_amount // 10000
    name_display = display_name if display_name else "お客"
    
    if consult_type == "相談希望":
        text = f"""🏠 住宅ローン診断結果

{name_display}様

診断が完了しました。

💰 借入可能額（目安）
約 {amount_man:,} 万円

ご相談のご希望をいただきありがとうございます。
担当者より改めてご連絡させていただきます。

※この金額はあくまで目安です。
実際の審査結果とは異なる場合がございます。"""
    else:
        text = f"""🏠 住宅ローン診断結果

{name_display}様

診断が完了しました。

💰 借入可能額（目安）
約 {amount_man:,} 万円

詳しいご相談をご希望の場合は、
「詳細希望」とお送りください。

※この金額はあくまで目安です。
実際の審査結果とは異なる場合がございます。"""
    
    return {
        "type": "text",
        "text": text
    }
