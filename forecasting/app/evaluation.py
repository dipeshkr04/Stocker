import math
from .models import forecast

def mae(actual: list[float], predicted: list[float]) -> float:
    return sum(abs(a - p) for a, p in zip(actual, predicted)) / len(actual)

def rmse(actual: list[float], predicted: list[float]) -> float:
    return math.sqrt(sum((a - p) ** 2 for a, p in zip(actual, predicted)) / len(actual))

def backtest(values: list[float], method: str, horizon: int, parameters: dict[str, object]) -> dict[str, float | int | bool | str]:
    if len(values) < max(30, horizon * 2):
        return {
            "available": False,
            "reason": f"At least {max(30, horizon * 2)} observations are required for a {horizon}-step backtest; {len(values)} were available.",
            "windows": 0,
        }
    actual: list[float] = []
    predicted: list[float] = []
    naive_predicted: list[float] = []
    first_cutoff = max(20, len(values) - min(5, horizon) - horizon * 3)
    for cutoff in range(first_cutoff, len(values) - horizon + 1, horizon):
        training = values[:cutoff]
        target = values[cutoff:cutoff + horizon]
        prediction = forecast(training, method, parameters, len(target))
        actual.extend(target)
        predicted.extend(prediction)
        naive_predicted.extend([training[-1]] * len(target))
    return {
        "mae": mae(actual, predicted),
        "rmse": rmse(actual, predicted),
        "naiveMae": mae(actual, naive_predicted),
        "naiveRmse": rmse(actual, naive_predicted),
        "windows": len(actual) // horizon,
    }
