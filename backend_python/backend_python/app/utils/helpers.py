def format_currency(value: float) -> str:
    return f"Rp {value:,.0f}".replace(",", ".")
