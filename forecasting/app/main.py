from fastapi import FastAPI
from fastapi.responses import JSONResponse
from .dates import future_weekdays
from .models import forecast
from .schemas import ForecastRequest, ForecastResponse, ForecastPoint, HORIZON_STEPS
from .schemas import BacktestRequest
from .evaluation import backtest

app = FastAPI(title="Stock Forecasting Service", version="1.0.0")

@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "forecasting"}

@app.post("/internal/forecast", response_model=ForecastResponse)
def run_forecast(request: ForecastRequest) -> ForecastResponse | JSONResponse:
    try:
        steps = HORIZON_STEPS[request.horizon]
        if len(request.observations) < (20 if request.method in ("arima", "exponential_smoothing") else 2):
            raise ValueError(f"{request.method} requires more historical observations")
        values = [item.value for item in request.observations]
        predictions = forecast(values, request.method, request.parameters, steps)
        dates = future_weekdays(request.observations[-1].date, steps)
        return ForecastResponse(
            symbol=request.symbol.upper(), method=request.method, horizon=request.horizon, steps=steps,
            lastObservedDate=request.observations[-1].date, lastObservedValue=values[-1],
            points=[ForecastPoint(date=day, predictedValue=value) for day, value in zip(dates, predictions)],
            modelVersion="1.0.0",
        )
    except ValueError as error:
        return JSONResponse(status_code=422, content={"error": {"code": "MODEL_INPUT_ERROR", "message": str(error)}})

@app.post("/internal/backtest", response_model=None)
def run_backtest(request: BacktestRequest) -> dict[str, object] | JSONResponse:
    try:
        metrics = backtest(
            [item.value for item in request.observations],
            request.method,
            HORIZON_STEPS[request.horizon],
            request.parameters,
        )
        return {"symbol": request.symbol.upper(), "method": request.method, "horizon": request.horizon, "metrics": metrics}
    except ValueError as error:
        return JSONResponse(status_code=422, content={"error": {"code": "BACKTEST_ERROR", "message": str(error)}})
