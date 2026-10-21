# Stock Forecasting System

The project is implemented backend-first. It contains an Express public API
and an internal FastAPI forecasting service. The React frontend will be added
after the backend milestone is validated.

## Backend local setup

1. Copy `backend/.env.example` to `backend/.env`.
2. For local development without an external API key, set
   `MARKET_DATA_PROVIDER=fixture`.
3. Install and run the API:

```powershell
cd backend
npm install
npm run build
npm start
```

Run the forecasting service in another terminal:

```powershell
cd forecasting
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8000
```

Health checks:

- `GET http://localhost:3000/api/v1/health`
- `GET http://localhost:8000/health`

The Alpha Vantage key is server-side only. Provider data is labeled
`latest_available`; this application does not claim real-time quotes.

### Backend environment variables

The complete `backend/.env.example` file contains:

```dotenv
NODE_ENV=development
PORT=3000
DATABASE_URL=******localhost:5432/stock_forecasting
FRONTEND_ORIGIN=http://localhost:5173
FORECAST_SERVICE_URL=http://localhost:8000
MARKET_DATA_PROVIDER=alpha_vantage
ALPHA_VANTAGE_API_KEY=replace_me
```

For local development:

- Set `MARKET_DATA_PROVIDER=fixture` if you do not want to use Alpha Vantage.
- Set `MARKET_DATA_PROVIDER=alpha_vantage` and replace
  `ALPHA_VANTAGE_API_KEY` when using live market data.
- Set `DATABASE_URL` to your PostgreSQL or Supabase connection string when
  database persistence is enabled.
- Keep `FRONTEND_ORIGIN` aligned with the URL serving the frontend.
- Keep `FORECAST_SERVICE_URL` aligned with the address of the FastAPI service.

Do not commit `backend/.env`. The Alpha Vantage key and database connection
string must remain server-side secrets.

### Forecasting environment variables

Copy `forecasting/.env.example` to `forecasting/.env`. It contains:

```dotenv
PYTHON_ENV=development
FORECAST_SERVICE_PORT=8000
FORECAST_SERVICE_HOST=127.0.0.1
```

For local development, the forecasting service runs on
`http://127.0.0.1:8000`. When deploying it to a hosting provider, bind it to
all interfaces and use the provider-assigned port:

```dotenv
PYTHON_ENV=production
FORECAST_SERVICE_HOST=0.0.0.0
FORECAST_SERVICE_PORT=$PORT
```

The backend's `FORECAST_SERVICE_URL` must point to the deployed forecasting
service URL.

## Validation

```powershell
cd backend
npm test
npm run build
cd ..\forecasting
python -m pytest tests -q
```

The backend uses an in-memory cache in this first milestone so it can run
without PostgreSQL; `database/migrations/001_initial.sql` defines the
PostgreSQL persistence schema for the persistence integration milestone.
Python package installation and test execution must use the same interpreter
environment; if `pytest` is not importable, activate the environment created
for `forecasting` before running the command.

To enable PostgreSQL persistence with Supabase, add the direct PostgreSQL
connection string from Supabase to `.env`:

```dotenv
USE_DATABASE=true
DATABASE_URL=postgresql://postgres:URL_ENCODED_PASSWORD@db.your-project.supabase.co:5432/postgres
DATABASE_POOL_MAX=5
```

Then apply the migrations:

```powershell
cd backend
npm run build
npm run migrate
```

The API health endpoint reports `database: "connected"` when Supabase is
available. Password characters must be percent-encoded in `DATABASE_URL`;
for example `^` becomes `%5E`, `@` becomes `%40`, and `#` becomes `%23`.

## Frontend

The application is intentionally public for this release; it has no login,
registration, or user-account requirement.

```powershell
cd frontend
npm install
npm run dev
```

The Vite development server runs at `http://localhost:5173` and proxies
`/api` requests to the Express server at `http://localhost:3000`.

For a deployed frontend, copy `frontend/.env.example` to `frontend/.env` and
set `VITE_API_BASE_URL` to the public URL of the deployed Express backend:

```dotenv
VITE_API_BASE_URL=https://your-backend-service.onrender.com
```

`VITE_API_BASE_URL` is a public browser setting and must not contain API keys,
database credentials, or other secrets.

Frontend features include stock search, quote and history range selection,
historical/forecast charting, all supported forecast methods and horizons,
model comparison, accessible data-table fallback, and CSV export.

On a fresh stock load, the frontend requests the quote first and waits five
seconds before requesting history. This spacing helps stay within Alpha
Vantage's free one-request-per-second burst limit; the initial dashboard load
can therefore take several seconds.

The frontend forecast horizons are limited to 1 day, 1 week, and 1 month so
backtest metrics remain meaningful with the provider's available history.

History ranges include 1 day, 5 days, 1 month, 3 months, and 6 months. These
are daily market observations;
the 1-day option means the latest completed daily session and does not provide
intraday/hourly data.

The tested Alpha Vantage plan returns compact daily history (up to 100
observations). Until a provider plan or data source with full history is
configured, ranges older than the returned coverage will display the same
available observations and the frontend will show a coverage notice.
