from datetime import date, timedelta

def future_weekdays(last_date: date, steps: int) -> list[date]:
    result: list[date] = []
    current = last_date
    while len(result) < steps:
        current += timedelta(days=1)
        if current.weekday() < 5:
            result.append(current)
    return result
