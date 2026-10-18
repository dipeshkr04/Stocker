from datetime import date
from forecasting.app.dates import future_weekdays
from forecasting.app.evaluation import mae, rmse
from forecasting.app.models import forecast
from forecasting.app.evaluation import backtest

def test_mean_returns_requested_length():
    assert forecast([1, 2, 3], "mean", {}, 4) == [2.0] * 4

def test_moving_average_is_recursive():
    assert forecast([1, 2, 3, 4, 5], "moving_average", {"window": 5}, 2) == [3.0, 3.4]

def test_dates_skip_weekends():
    assert future_weekdays(date(2026, 10, 16), 2) == [date(2026, 10, 19), date(2026, 10, 20)]

def test_metrics():
    assert mae([1, 3], [2, 1]) == 1.5
    assert rmse([1, 3], [2, 1]) == (2.5) ** 0.5

def test_all_methods_return_requested_length():
    values = [100 + index * 0.2 for index in range(40)]
    for method in ("mean", "moving_average", "exponential_smoothing", "trend_projection", "linear_regression", "arima"):
        parameters = {"window": 10} if method == "moving_average" else {}
        assert len(forecast(values, method, parameters, 5)) == 5

def test_exponential_smoothing_returns_requested_length():
    values = [100 + index * 0.2 for index in range(40)]
    assert len(forecast(values, "exponential_smoothing", {}, 5)) == 5

def test_backtest_includes_naive_baseline():
    metrics = backtest([100 + index * 0.2 for index in range(40)], "mean", 1, {})
    assert metrics["naiveMae"] >= 0
    assert metrics["naiveRmse"] >= metrics["naiveMae"]

def test_long_horizon_backtest_reports_unavailable_instead_of_failing():
    metrics = backtest([100 + index * 0.2 for index in range(100)], "trend_projection", 126, {})
    assert metrics["available"] is False
    assert metrics["windows"] == 0
