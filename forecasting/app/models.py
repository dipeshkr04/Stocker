import warnings
import numpy as np
from sklearn.linear_model import LinearRegression
from statsmodels.tsa.arima.model import ARIMA
from statsmodels.tsa.holtwinters import SimpleExpSmoothing

def forecast(values: list[float], method: str, parameters: dict[str, object], steps: int) -> list[float]:
    series = np.asarray(values, dtype=float)
    if method == "mean":
        return [float(series.mean())] * steps
    if method == "moving_average":
        window = int(parameters.get("window", 10))
        if window not in (5, 10, 20) or len(series) < window:
            raise ValueError("moving_average window must be 5, 10, or 20 and fit the history")
        work = list(series[-window:])
        result = []
        for _ in range(steps):
            value = float(np.mean(work[-window:]))
            result.append(value)
            work.append(value)
        return result
    if method == "exponential_smoothing":
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            model = SimpleExpSmoothing(series, initialization_method="estimated")
            return [float(value) for value in model.fit(optimized=True).forecast(steps)]
    if method in ("trend_projection", "linear_regression"):
        x = np.arange(len(series)).reshape(-1, 1)
        model = LinearRegression().fit(x, series)
        return [float(value) for value in model.predict(np.arange(len(series), len(series) + steps).reshape(-1, 1))]
    if method == "arima":
        order = parameters.get("order", [5, 1, 0])
        if not isinstance(order, list) or len(order) != 3 or any(not isinstance(item, int) or item < 0 for item in order):
            raise ValueError("arima order must be a list of three non-negative integers")
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            return [float(value) for value in ARIMA(series, order=tuple(order)).fit().forecast(steps)]
    raise ValueError(f"unsupported method: {method}")
