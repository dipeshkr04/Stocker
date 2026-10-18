# Stock Forecasting System --- Implementation Plan for Codex

> **Purpose:** Build a working full-stack stock-market forecasting web
> application with current/latest available prices, historical charts,
> selectable forecasting methods, five forecast horizons, model
> comparison, and chronological backtesting.
>
> **Instructions for Codex:** Implement this project incrementally.
> First inspect the existing repository and preserve its conventions
> where possible. Do not overwrite working code without understanding
> it. Work phase by phase, run the relevant tests after each phase, and
> report changed files, commands run, and remaining issues. Do not claim
> an API is real-time unless the selected provider and plan actually
> supply real-time quotes.

------------------------------------------------------------------------

## 1. Product scope

### Core user experience

1.  The user searches for and selects a stock by symbol.
2.  The app displays the latest available quote, currency, exchange,
    source, and timestamp.
3.  The app displays historical daily closing prices.
4.  With no forecasting method selected, the app displays quote and
    historical data only. It must not run a forecast implicitly.
5.  The user selects a forecast category, a method within that category,
    and a horizon.
6.  The user runs the forecast and sees a method-specific result,
    including predicted values, chart, and evaluation metrics when
    available.
7.  The user can run multiple methods and compare their outputs and
    historical backtest metrics.
8.  The UI distinguishes observed prices from predicted prices and
    labels forecasts as estimates, not guaranteed future prices.

### Forecast categories and methods

-   **Time-series**
    -   Historical mean baseline
    -   Moving average
    -   Simple exponential smoothing
    -   Trend projection
-   **Associative model**
    -   Linear regression
-   **Industry-standard statistical model**
    -   ARIMA
    -   Keep SARIMA optional and out of the first release unless data
        shows meaningful seasonality.

Each method must be independently selectable and produce a separate
result. The API must use a validated method identifier rather than
accepting arbitrary code or Python expressions.

### Forecast horizons

-   1 day
-   1 week
-   1 month
-   6 months
-   1 year

Use daily observations initially. Approximate horizons are 1, 5, 21,
126, and 252 trading sessions respectively. These are trading-session
counts, not calendar-day counts. Generate future trading dates and
account for weekends and exchange holidays where a reliable exchange
calendar is available. Do not represent these approximate counts as
exact calendar durations.

### Explicit non-goals for the first release

-   Automated trading, brokerage integration, or investment
    recommendations
-   Guaranteed prediction accuracy
-   Tick-level or minute-level forecasting
-   Deep learning models
-   User accounts, watchlists, or portfolio tracking unless added later
-   Predicting a stock's price from unrelated news or sentiment

------------------------------------------------------------------------

## 2. Recommended stack

Prefer these technologies unless the existing repository has an
established equivalent:

### Frontend

-   React + TypeScript + Vite
-   Tailwind CSS
-   Recharts for historical and forecast charts
-   Axios or a small typed `fetch` wrapper
-   React Router only if multiple routes are needed

### Main backend

-   Node.js + Express + TypeScript
-   Zod (or an equivalent validator) for request validation
-   A PostgreSQL driver/ORM consistent with the existing repository

### Forecasting service

-   Python 3.11+ with FastAPI and Pydantic
-   pandas and NumPy for data handling
-   scikit-learn for linear regression and time-series cross-validation
    utilities
-   statsmodels for exponential smoothing and ARIMA
-   pytest for tests

### Storage and infrastructure

-   PostgreSQL for normalized daily price data and forecast run metadata
-   Optional Redis cache only after the core app works
-   Docker Compose for local development
-   Environment variables for all secrets and service URLs

**Service responsibilities:** React renders the UI; Express handles
public application APIs, provider access, caching policy, and request
orchestration; FastAPI performs model fitting, forecasting, and
backtesting; PostgreSQL stores normalized market data and persisted run
metadata.

Avoid duplicating forecasting logic in Node.js. The Python service is
the single source of truth for numerical models.

------------------------------------------------------------------------

## 3. Market data provider

Start with **Alpha Vantage** as the first provider candidate. Use its
official documentation to select the appropriate daily time-series and
quote endpoints: - https://www.alphavantage.co/documentation/

Before committing to it, verify the current free-plan request limits,
historical coverage, symbol/exchange support, and whether quote data is
delayed or real-time for the intended use. If it cannot cover required
markets or limits are too restrictive, isolate provider integration
behind an adapter so another provider can be added without rewriting the
application.

Possible alternative to evaluate: Twelve Data, subject to its current
free-tier quotas, exchange coverage, and display/licensing terms.

### Provider implementation requirements

-   API keys must exist only in server-side environment variables.
-   Never expose provider credentials in frontend bundles, API
    responses, logs, or committed files.
-   Normalize provider responses into a provider-independent internal
    format.
-   Persist the source and source timestamp for every observation/quote.
-   Distinguish `latest_available` from `real_time`; never label delayed
    or end-of-day data as live.
-   Cache historical daily bars in PostgreSQL and avoid fetching the
    same range on every page load.
-   Respect provider quotas and terms. Handle HTTP 429 responses with a
    useful retry message and do not aggressively retry.
-   Validate symbols and limit history ranges before calling the
    provider.
-   Add deterministic fixture data for tests so the test suite does not
    depend on network access or an API key.

Define a `MarketDataProvider` interface with operations similar to: -
`searchSymbols(query)` - `getLatestQuote(symbol)` -
`getDailyHistory(symbol, startDate, endDate)`

Implement the first provider in its own module. A second provider should
be possible without changing UI or forecasting code.

------------------------------------------------------------------------

## 4. Architecture and data flow

1.  Frontend requests stock search, quote, or historical data from
    Express.
2.  Express validates the request and checks PostgreSQL/cache.
3.  If data is missing or stale, Express requests the provider through
    the adapter, normalizes the response, and stores it.
4.  If the user has not selected a method, the frontend only displays
    quote and historical data.
5.  When the user requests a forecast, Express validates the symbol,
    method, horizon, and parameters, loads sufficient historical
    observations, and calls FastAPI.
6.  FastAPI validates the time series, runs the selected model, and
    returns forecast points plus metadata and any supported interval
    estimates.
7.  Express returns a stable response contract to React and may persist
    the run and points.
8.  Comparison and backtesting use the same model implementation and
    consistent evaluation procedures.

Suggested local ports (change if the repository already uses other
ports): - Frontend: `5173` - Express: `3000` - FastAPI: `8000` -
PostgreSQL: `5432`

Do not let the browser call the market-data provider directly.

------------------------------------------------------------------------

## 5. Repository structure

Adapt to the existing repository rather than blindly creating duplicate
folders. For a new monorepo, use:

``` text
stock-forecasting/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── StockSearch.tsx
│   │   │   ├── QuoteSummary.tsx
│   │   │   ├── PriceChart.tsx
│   │   │   ├── ForecastControls.tsx
│   │   │   ├── ForecastChart.tsx
│   │   │   ├── ModelResultCard.tsx
│   │   │   └── ModelComparisonTable.tsx
│   │   ├── pages/
│   │   │   └── DashboardPage.tsx
│   │   ├── services/
│   │   │   └── api.ts
│   │   ├── types/
│   │   │   └── api.ts
│   │   └── App.tsx
│   ├── package.json
│   └── .env.example
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── providers/
│   │   ├── repositories/
│   │   ├── middleware/
│   │   ├── schemas/
│   │   └── app.ts
│   ├── tests/
│   ├── package.json
│   └── .env.example
├── forecasting/
│   ├── app/
│   │   ├── main.py
│   │   ├── schemas.py
│   │   ├── validation.py
│   │   ├── dates.py
│   │   ├── models/
│   │   │   ├── mean.py
│   │   │   ├── moving_average.py
│   │   │   ├── exponential_smoothing.py
│   │   │   ├── trend_projection.py
│   │   │   ├── linear_regression.py
│   │   │   └── arima.py
│   │   └── evaluation/
│   │       ├── metrics.py
│   │       └── backtesting.py
│   ├── tests/
│   ├── requirements.txt
│   └── .env.example
├── database/
│   └── migrations/
├── docker-compose.yml
├── .env.example
├── .gitignore
├── README.md
└── plan.md
```

Keep each model in a separate module, but expose all models through one
registry/factory so API routing does not contain model-specific
implementation details.

------------------------------------------------------------------------

## 6. Data contracts and database schema

### Normalized daily bar

Use a consistent internal representation:

``` json
{
  "symbol": "AAPL",
  "date": "2026-10-09",
  "open": 0.0,
  "high": 0.0,
  "low": 0.0,
  "close": 0.0,
  "adjustedClose": 0.0,
  "volume": 0,
  "currency": "USD",
  "source": "alpha_vantage"
}
```

The example numbers are placeholders. Store missing optional provider
fields as null; do not fabricate market data. Use adjusted close for
model input when the chosen provider supplies it consistently, and
clearly label whether charts show close or adjusted close. Do not mix
adjusted and unadjusted prices within a series.

### Tables

**`stocks`** - `symbol` (primary key, normalized according to
provider/exchange conventions) - `name` - `exchange` - `currency` -
`provider_symbol` if mapping is needed - `created_at`, `updated_at`

**`stock_prices`** - `id` - `symbol` (foreign key) - `trading_date` -
`open`, `high`, `low`, `close` - `adjusted_close` nullable - `volume`
nullable - `source` - `fetched_at` - Unique constraint on
`(symbol, trading_date, source)` or a documented canonical-source policy

**`forecast_runs`** - `id` - `symbol` - `method` - `horizon` -
`input_field` - `parameters` JSONB - `training_start_date` -
`training_end_date` - `generated_at` - `model_version` - `metrics` JSONB
nullable - `status` and `error_code` as appropriate

**`forecast_points`** - `id` - `forecast_run_id` (foreign key) -
`forecast_date` - `predicted_value` - `lower_bound` nullable -
`upper_bound` nullable - Unique constraint on
`(forecast_run_id, forecast_date)`

Store UTC timestamps for system events. Trading dates should be
represented as dates rather than arbitrary UTC instants.

------------------------------------------------------------------------

## 7. API contracts

Use `/api/v1` for public Express routes. Return consistent JSON errors
with a machine-readable `code` and a human-readable `message`. Validate
all parameters and set reasonable request timeouts and history-size
limits.

### Public Express API

-   `GET /api/v1/stocks/search?q={query}`
    -   Returns symbol, display name, exchange, currency when available.
-   `GET /api/v1/stocks/:symbol/quote`
    -   Returns latest available price, currency, exchange, source,
        observation timestamp, and a freshness/status label.
-   `GET /api/v1/stocks/:symbol/history?range=1y`
    -   Returns normalized historical daily bars, range, source, and
        timestamp metadata.
-   `POST /api/v1/forecasts`
    -   Runs one selected method and returns forecast points and
        metadata.
-   `POST /api/v1/forecasts/compare`
    -   Runs a bounded list of supported methods for the same symbol,
        input range, and horizon.
-   `GET /api/v1/forecasts/:id`
    -   Retrieves a persisted forecast run if persistence is enabled.
-   `GET /api/v1/health`
    -   Returns service health without exposing secrets.

### Forecast request

``` json
{
  "symbol": "AAPL",
  "method": "arima",
  "horizon": "1m",
  "priceField": "adjusted_close",
  "parameters": {}
}
```

Allowed method identifiers: - `mean` - `moving_average` -
`exponential_smoothing` - `trend_projection` - `linear_regression` -
`arima`

Allowed horizon identifiers: - `1d` - `1w` - `1m` - `6m` - `1y`

The API should resolve horizon identifiers to trading-session counts in
one shared, tested utility. Never trust arbitrary session counts sent by
the client.

### Forecast response

Return: - symbol, method, horizon, currency - price field and data
source - last observed date and last observed value - training range and
generation timestamp - forecast points: date, predicted value, optional
lower/upper bounds - evaluation metrics when computed - warnings such as
insufficient data or unstable fit

Do not return fake metrics, fabricated prices, or confidence bounds that
the model does not support. If an interval is unavailable, return
null/omit it and let the UI explain that no interval is available.

### Internal Python service

Provide internal endpoints such as: - `POST /internal/forecast` -
`POST /internal/backtest` - `GET /health`

Keep the Python service internal in deployment where possible. Validate
every payload with Pydantic and restrict CORS/network access. If exposed
outside a private network, add service authentication.

------------------------------------------------------------------------

## 8. Forecast model requirements

All model functions should accept a validated, chronologically ordered
series of finite numeric observations and a positive forecast-step
count. Return exactly the requested number of forecast points or a clear
validation/model error. Do not silently return fewer points.

### Shared data preparation

-   Sort observations by trading date ascending.
-   Remove duplicate dates using a documented deterministic rule.
-   Reject non-finite prices and invalid negative/zero values where
    incompatible with the chosen transform.
-   Handle missing dates as market-calendar gaps, not automatically as
    missing observations.
-   Do not interpolate across long missing ranges without explicit
    policy.
-   Enforce a configurable minimum history requirement per model.
-   Keep the final observed date/value in all responses.
-   Never use future observations in model fitting, feature engineering,
    scaling, or evaluation.

### Model definitions

**Mean** - Forecast every future step as the mean of the training
observations. - Use as a simple baseline; document that it is a weak
extrapolation model for prices.

**Moving average** - Compute the mean of the last `window`
observations. - Define and document recursive multi-step behavior. A
straightforward approach is to forecast the last-window mean and append
each predicted value before calculating the next step. - Validate the
window and require enough training observations. - Default window: 10
sessions; allow 5, 10, and 20 sessions initially.

**Simple exponential smoothing** - Use `statsmodels`
`SimpleExpSmoothing`. - Fit only on training data. - Return the
requested number of steps. - Expose only safe, supported parameters such
as trend/seasonality options if actually implemented. The first release
should keep this method simple. - Use Holt's method as a separate future
enhancement if trend support is needed; do not mislabel Holt as simple
exponential smoothing.

**Trend projection** - Fit a least-squares linear trend using a
chronological integer time index. - Forecast future indices beyond the
training endpoint. - Use NumPy or scikit-learn; keep implementation
deterministic. - Explain that extrapolating a linear trend far into the
future can be unreliable.

**Linear regression** - Implement a well-defined baseline using time
index as the initial feature. - Optionally add lagged returns/price and
volume only when those features are available at forecast time and are
built without leakage. - For multi-step prediction, define recursive or
direct forecasting behavior explicitly. Do not create future features
using actual future prices. - Do not shuffle time-series data. - Report
feature definition and training period in metadata.

**ARIMA** - Use `statsmodels.tsa.arima.model.ARIMA`. - Start with a
conservative, configurable default order such as `(5, 1, 0)` only if it
fits the dataset; document the chosen order in the result. - Add
parameter validation and robust handling for convergence failures,
warnings, and insufficient history. - Automatic order selection can be a
later enhancement; do not add an expensive parameter grid to every
request. - Do not claim ARIMA is universally superior to baselines.

### Forecast dates

-   Forecast points begin on the next valid trading session after the
    last observation.
-   Use an exchange calendar when available; otherwise use weekdays and
    clearly document that holidays may not be excluded.
-   Do not generate a forecast point on the same date as the last
    observed bar.

### Intervals

-   Return prediction intervals only when supported and correctly
    computed for that model.
-   Clearly distinguish prediction intervals from confidence intervals.
-   Never fabricate intervals by applying arbitrary percentages to the
    forecast.

------------------------------------------------------------------------

## 9. Backtesting and evaluation

Backtesting is a first-class requirement, not a cosmetic metric.

-   Use chronological expanding-window or rolling-window evaluation.
-   At each cutoff, fit the model using only observations available up
    to that cutoff.
-   Evaluate the next `h` trading sessions for a selected horizon.
-   Repeat over several cutoffs where enough data exists.
-   Compare models on the same evaluation windows whenever possible.
-   Include a naive persistence baseline: predict the latest observed
    price for each future step.
-   Never randomly shuffle time-series observations.
-   Keep hyperparameter tuning separate from final evaluation to reduce
    leakage.
-   Clearly label whether metrics come from historical backtesting or
    from an unavailable future ground truth.

Implement: - MAE - RMSE - MAPE only when its limitations are handled;
prefer sMAPE or MAE for series where percentage metrics are
unsuitable. - Optional directional accuracy as a supplementary metric,
not a replacement for price error.

Metric definitions: - `MAE = mean(abs(actual - predicted))` -
`RMSE = sqrt(mean((actual - predicted)^2))`

Do not compare raw MAE/RMSE across different stocks or currencies as if
they were directly equivalent. For cross-stock comparisons, add
normalized metrics only with clearly defined formulas.

------------------------------------------------------------------------

## 10. Frontend behavior and UI states

### Dashboard

-   Stock symbol/name search with loading and empty states.
-   Quote card with latest available price, currency, source, timestamp,
    and freshness label.
-   Historical chart with date range controls.
-   Loading, no-data, API-limit, network-error, and invalid-symbol
    states.
-   If no method is selected, show quote/history only and no forecast
    line.

### Forecast controls

-   Category selector:
    -   Time-series
    -   Associative model
    -   Industry-standard model
-   Method selector changes according to the category.
-   Horizon selector: 1 day, 1 week, 1 month, 6 months, 1 year.
-   Method-specific parameters, such as moving-average window.
-   Explicit **Run Forecast** button. Do not run a costly forecast on
    every filter change.
-   Disable the button while the request is pending and prevent
    accidental duplicate requests.

### Results

-   Historical actuals as a solid line.
-   Forecast as a distinct dashed line, starting after the final
    observed point.
-   Optional model-specific interval band only if valid bounds are
    returned.
-   Forecast summary: last observed value/date, end date, horizon,
    method, generation timestamp.
-   Model result card for each selected method.
-   Comparison table for MAE/RMSE and any other computed metrics.
-   CSV export should include dates, actual values where applicable,
    predicted values, method, horizon, currency, and source metadata.
-   Include a clear disclaimer that forecasts are estimates, not
    financial advice.

### Accessibility and quality

-   Use labels for all inputs, keyboard-accessible controls, visible
    focus indicators, and sufficient contrast.
-   Format dates and currency based on returned market metadata.
-   Do not hardcode USD formatting for all symbols.
-   Keep charts responsive and provide a tabular alternative or
    accessible summary.

------------------------------------------------------------------------

## 11. Security, reliability, and performance

-   Store provider keys and database credentials in environment
    variables.
-   Commit `.env.example`, never actual `.env` files or keys.
-   Validate all user input and whitelist method/horizon identifiers.
-   Apply rate limits to public API endpoints.
-   Set provider and internal service timeouts.
-   Handle upstream quota exhaustion and return a useful retry message.
-   Avoid logging credentials or full secret-bearing URLs.
-   Add request IDs and structured server-side logs.
-   Use parameterized database queries.
-   Configure CORS for the actual frontend origin rather than allowing
    all origins in production.
-   Limit history size and number of models per comparison request.
-   Cache historical bars and latest quotes according to provider terms
    and freshness.
-   Make database migrations repeatable and safe.
-   Use graceful errors for ARIMA convergence failures and model input
    errors.
-   Do not silently substitute a different algorithm after a model
    fails. Return an explicit error or a clearly labeled fallback.

------------------------------------------------------------------------

## 12. Testing strategy

### Python unit tests

-   One test module per forecasting model.
-   Verify output length equals requested horizon.
-   Verify forecast dates are strictly increasing and after the final
    observed date.
-   Verify deterministic methods on simple known series.
-   Test short series, NaN/infinite values, duplicates, empty input,
    constant series, and invalid parameters.
-   Verify no future data is used during backtesting.
-   Verify metric calculations against hand-computed examples.
-   Test ARIMA fitting failures and warning paths.

### Express/API tests

-   Valid and invalid symbols, methods, and horizons.
-   Provider success, empty response, timeout, quota exhaustion, and
    malformed response.
-   Database cache hit/miss behavior.
-   Python service timeout and error mapping.
-   API response schemas and status codes.
-   No secrets in responses or logs.

### Frontend tests

-   Selecting a stock updates quote and historical chart.
-   No selected method means no forecast request and no forecast series.
-   Selecting a category updates available methods correctly.
-   Horizon changes are included in the request.
-   Loading, empty, error, and success states render correctly.
-   Forecast chart separates actual and predicted values.
-   Compare results render each selected model independently.

### Integration and acceptance tests

-   Run all services locally with documented commands.
-   Use deterministic fixture data and mocked provider responses.
-   Verify an end-to-end flow from stock search to quote/history to a
    forecast result.
-   Confirm no API key is required for unit tests.
-   Add a manual smoke-test checklist to the README.

------------------------------------------------------------------------

## 13. Environment configuration

Create `.env.example` files with placeholders only. Names can be
adjusted to existing conventions.

``` dotenv
# Main backend
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/stock_forecasting
FRONTEND_ORIGIN=http://localhost:5173
FORECAST_SERVICE_URL=http://localhost:8000
MARKET_DATA_PROVIDER=alpha_vantage
ALPHA_VANTAGE_API_KEY=replace_me

# Forecasting service
PYTHON_ENV=development
FORECAST_SERVICE_PORT=8000
```

If the services use separate credentials or database access patterns,
document them. Never place a real API key in this file or in source
code.

------------------------------------------------------------------------

## 14. Implementation phases and completion criteria

Codex should work in this order. Do not start later phases before the
earlier phase passes its checks.

### Phase 0 --- Repository inspection and plan

-   Inspect existing files, scripts, dependencies, and conventions.
-   Identify whether this is an empty repository or an existing app.
-   Summarize the current state and any conflicts with this plan.
-   Preserve useful existing code.
-   Create or update `plan.md` with the agreed implementation plan.

**Done when:** repository structure and commands are understood and a
short implementation checklist is recorded.

### Phase 1 --- Skeleton and local infrastructure

-   Create or adapt frontend, Express, FastAPI, and database structure.
-   Add environment examples, `.gitignore`, health endpoints, Docker
    Compose, and README setup instructions.
-   Add database migrations and connection checks.

**Done when:** all services start locally, health endpoints work, and no
secrets are committed.

### Phase 2 --- Provider adapter and market history

-   Implement provider interface and first adapter.
-   Add symbol search, quote, and daily history endpoints.
-   Normalize and persist market data.
-   Add caching, quota handling, and mocked provider tests.

**Done when:** a configured API key enables the app to load a supported
symbol's quote/history; fixture tests pass without network access.

### Phase 3 --- Forecasting service and baseline models

-   Define Pydantic request/response schemas and common validation.
-   Implement mean and moving average first.
-   Implement exponential smoothing, trend projection, linear
    regression, and ARIMA.
-   Add trading-session date generation and clear model errors.

**Done when:** every method returns the correct number of forecast
points for valid fixtures and rejects invalid inputs with useful errors.

### Phase 4 --- Backtesting

-   Implement MAE/RMSE and naive baseline.
-   Implement chronological rolling/expanding-window backtesting.
-   Prevent data leakage and test with deterministic fixtures.
-   Attach evaluation metadata to API responses.

**Done when:** metrics are reproducible and all training/test cutoffs
are chronological.

### Phase 5 --- Frontend dashboard

-   Build stock search, quote card, history chart,
    category/method/horizon controls, and Run Forecast action.
-   Connect to Express API.
-   Render actual and predicted series separately.
-   Add loading, empty, error, responsive, and accessible states.

**Done when:** users can complete the main flow in the browser and no
forecast is run until requested.

### Phase 6 --- Comparison and export

-   Add bounded multi-model comparison.
-   Display separate result cards and backtest metrics.
-   Add CSV export and clear data-source/freshness labels.

**Done when:** several selected models can be compared on the same
symbol/horizon with consistent evaluation rules.

### Phase 7 --- Hardening and documentation

-   Run unit, API, frontend, and integration tests.
-   Fix security, validation, timeouts, CORS, and quota handling.
-   Document setup, environment variables, provider limitations,
    architecture, algorithms, evaluation, and deployment.
-   Provide a final implementation report listing tests actually run and
    known limitations.

**Done when:** all automated tests pass or any remaining failures are
clearly documented; a new developer can start the app from the README.

------------------------------------------------------------------------

## 15. Definition of done

The project is complete when all of the following are true:

-   [ ] A user can search and select supported stock symbols.
-   [ ] Quote responses show source, timestamp, currency, and freshness
    accurately.
-   [ ] Historical daily prices are displayed on a working chart.
-   [ ] No forecast runs unless a method is explicitly selected and
    requested.
-   [ ] All six methods are selectable and return independent forecasts.
-   [ ] All five forecast horizons work and generate future
    trading-session dates.
-   [ ] Forecast requests are validated on both backend boundaries.
-   [ ] The chart clearly distinguishes historical and predicted values.
-   [ ] MAE/RMSE are calculated from chronological backtesting, not
    invented.
-   [ ] A naive baseline is included in evaluation.
-   [ ] The UI handles missing data, API quotas, network errors, and
    model failures.
-   [ ] Provider secrets remain server-side.
-   [ ] PostgreSQL persistence and migrations work.
-   [ ] Unit and integration tests are documented and run successfully.
-   [ ] README setup instructions allow a new developer to run the
    project locally.
-   [ ] Forecasts are clearly labeled as estimates and not guaranteed
    outcomes.

------------------------------------------------------------------------

## 16. Instructions for Codex execution

1.  Inspect the repository before modifying anything.
2.  If an existing stack differs, explain the difference and adapt this
    plan instead of creating a conflicting second application.
3.  Implement one phase at a time, in the order above.
4.  Before each phase, list the files you intend to create or modify and
    the acceptance criteria.
5.  After each phase, run relevant formatters, linters, type checks, and
    tests. Fix failures before proceeding where practical.
6.  Never fake successful provider calls, prices, metrics, or model
    outputs. Use clearly labeled fixtures only in development and tests.
7.  Do not silently skip tests. Report commands run and results
    honestly.
8.  Keep dependencies minimal and pin compatible versions where
    appropriate.
9.  Update README and this plan when actual implementation decisions
    materially differ.
10. At completion, summarize implemented functionality, setup/run
    commands, environment variables required, tests executed, and known
    limitations.

**Start now with Phase 0 only:** inspect the repository and report the
existing structure, relevant scripts, and any decisions needed. Do not
attempt to implement every phase in one giant change.
