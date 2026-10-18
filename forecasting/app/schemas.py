from datetime import date
import math
from typing import Literal
from pydantic import BaseModel, Field, field_validator

Method = Literal["mean", "moving_average", "exponential_smoothing", "trend_projection", "linear_regression", "arima"]
Horizon = Literal["1d", "1w", "1m", "6m", "1y"]
HORIZON_STEPS = {"1d": 1, "1w": 5, "1m": 21, "6m": 126, "1y": 252}

class Observation(BaseModel):
    date: date
    value: float

class ForecastRequest(BaseModel):
    symbol: str = Field(min_length=1, max_length=20, pattern=r"^[A-Za-z0-9.-]+$")
    method: Method
    horizon: Horizon
    priceField: Literal["close", "adjusted_close"] = "adjusted_close"
    parameters: dict[str, object] = Field(default_factory=dict)
    observations: list[Observation] = Field(min_length=2)

    @field_validator("observations")
    @classmethod
    def validate_observations(cls, values: list[Observation]) -> list[Observation]:
        ordered = sorted(values, key=lambda item: item.date)
        if len({item.date for item in ordered}) != len(ordered):
            raise ValueError("observation dates must be unique")
        if any(not math.isfinite(item.value) or item.value <= 0 for item in ordered):
            raise ValueError("observation values must be positive")
        return ordered

class ForecastPoint(BaseModel):
    date: date
    predictedValue: float
    lowerBound: float | None = None
    upperBound: float | None = None

class ForecastResponse(BaseModel):
    symbol: str
    method: Method
    horizon: Horizon
    steps: int
    lastObservedDate: date
    lastObservedValue: float
    points: list[ForecastPoint]
    warnings: list[str] = Field(default_factory=list)
    modelVersion: str = "1.0.0"

class BacktestRequest(BaseModel):
    symbol: str = Field(min_length=1, max_length=20, pattern=r"^[A-Za-z0-9.-]+$")
    method: Method
    horizon: Horizon
    parameters: dict[str, object] = Field(default_factory=dict)
    observations: list[Observation] = Field(min_length=2)

    @field_validator("observations")
    @classmethod
    def validate_observations(cls, values: list[Observation]) -> list[Observation]:
        ordered = sorted(values, key=lambda item: item.date)
        if len({item.date for item in ordered}) != len(ordered):
            raise ValueError("observation dates must be unique")
        if any(not math.isfinite(item.value) or item.value <= 0 for item in ordered):
            raise ValueError("observation values must be positive")
        return ordered
