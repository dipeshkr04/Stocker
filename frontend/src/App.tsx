import { useEffect, useMemo, useState } from "react";
import { api } from "./services/api";
import type { DailyBar, ForecastResult, Horizon, Method, Quote, SymbolResult } from "./types";
import { PriceChart } from "./components/PriceChart";
import { ForecastChart } from "./components/ForecastChart";
import { MetricCard } from "./components/MetricCard";
import "./styles.css";

const methods: { value: Method; label: string; category: string }[] = [
  { value: "mean", label: "Historical mean", category: "Time-series" },
  { value: "moving_average", label: "Moving average", category: "Time-series" },
  { value: "exponential_smoothing", label: "Simple exponential smoothing", category: "Time-series" },
  { value: "trend_projection", label: "Trend projection", category: "Time-series" },
  { value: "linear_regression", label: "Linear regression", category: "Associative model" },
  { value: "arima", label: "ARIMA", category: "Industry-standard model" }
];
const horizons: { value: Horizon; label: string }[] = [
  { value: "1d", label: "1 day" }, { value: "1w", label: "1 week" }, { value: "1m", label: "1 month" }
];
const money = (value: number, currency = "USD") => new Intl.NumberFormat(undefined, { style: "currency", currency }).format(value);
const displayDate = (value: string) => new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value.slice(0, 10)}T12:00:00`));
type StockCache = { symbol: string; quote: Quote | null; bars: DailyBar[] };
let stockCache: StockCache | null = null;
const rangeDays: Record<string, number | undefined> = { "1d": 1, "5d": 7, "1m": 31, "3m": 93, "6m": 186, "1y": 366, "5y": 1826 };
const selectRange = (bars: DailyBar[], range: string) => {
  if (range === "max") return bars;
  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const completedBars = bars.filter((bar) => new Date(`${bar.date}T00:00:00Z`) < todayUtc);
  if (range === "1d") return completedBars.slice(-1);
  const cutoff = new Date(todayUtc);
  cutoff.setUTCDate(cutoff.getUTCDate() - (rangeDays[range] ?? 366));
  const filtered = completedBars.filter((bar) => new Date(`${bar.date}T00:00:00Z`) >= cutoff);
  return range === "5d" ? filtered.slice(-5) : filtered;
};
const wait = (milliseconds: number) => new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds));
const isProviderQuotaError = (message: string) =>
  /quota|rate limit|request limit|requests more sparingly|daily request/i.test(message);

export default function App() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<SymbolResult>({ symbol: "AAPL", name: "Apple Inc.", exchange: "NASDAQ", currency: "USD" });
  const [suggestions, setSuggestions] = useState<SymbolResult[]>([]);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [bars, setBars] = useState<DailyBar[]>([]);
  const [availableBars, setAvailableBars] = useState<DailyBar[]>([]);
  const [method, setMethod] = useState<Method | "">("");
  const [horizon, setHorizon] = useState<Horizon>("1m");
  const [movingWindow, setMovingWindow] = useState("10");
  const [forecast, setForecast] = useState<ForecastResult | null>(null);
  const [comparison, setComparison] = useState<ForecastResult[]>([]);
  const [historyRange, setHistoryRange] = useState("6m");
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [initialError, setInitialError] = useState("");
  const [error, setError] = useState("");
  const [searching, setSearching] = useState(false);

  const loadStock = async (stock: SymbolResult, range = historyRange) => {
    const isInitialLoad = initialLoading || Boolean(initialError);
    const isDifferentStock = stockCache?.symbol !== stock.symbol;
    if (isDifferentStock) stockCache = null;
    setSelected(stock); setQuery(stock.symbol); setSuggestions([]); setLoading(true); setHistoryLoading(true); setError(""); setInitialError(""); setQuote(null); setForecast(null); setComparison([]);
    try {
      if (!stockCache) {
        const quoteResult = await Promise.allSettled([api.quote(stock.symbol)]).then(([result]) => result);
        await wait(5_000);
        const historyResult = await Promise.allSettled([api.history(stock.symbol, "max")]).then(([result]) => result);
        if (quoteResult.status === "fulfilled") {
          setQuote(quoteResult.value);
          stockCache = { symbol: stock.symbol, quote: quoteResult.value, bars: [] };
        }
        if (historyResult.status === "fulfilled") {
          setAvailableBars(historyResult.value.bars);
          setBars(selectRange(historyResult.value.bars, range));
          stockCache = { symbol: stock.symbol, quote: quoteResult.status === "fulfilled" ? quoteResult.value : null, bars: historyResult.value.bars };
        }
        if (isInitialLoad && historyResult.status === "rejected") {
          setInitialError(historyResult.reason instanceof Error ? historyResult.reason.message : "Unable to load the initial market history.");
        }
        const rejected = [quoteResult, historyResult].find((result) => result.status === "rejected");
        if (rejected?.status === "rejected") setError(rejected.reason instanceof Error ? rejected.reason.message : "Some market data could not be loaded.");
      } else {
        setQuote(stockCache.quote);
        setAvailableBars(stockCache.bars);
        setBars(selectRange(stockCache.bars, range));
      }
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Unable to load stock data."); }
    finally { setLoading(false); setHistoryLoading(false); setInitialLoading(false); }
  };
  const changeHistoryRange = async (range: string) => {
    setHistoryRange(range);
    setHistoryLoading(true);
    setError("");
    try { setBars(selectRange(availableBars, range)); }
    catch (rangeError) { setError(rangeError instanceof Error ? rangeError.message : "Unable to show this history range."); }
    finally { setHistoryLoading(false); }
  };
  useEffect(() => { void loadStock(selected); }, []);
  useEffect(() => {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2 || normalizedQuery.toUpperCase() === selected.symbol) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const timer = globalThis.setTimeout(() => {
      void api.search(normalizedQuery, controller.signal)
        .then((result) => { if (!controller.signal.aborted) setSuggestions(result.results); })
        .catch((searchError: unknown) => {
          if (!controller.signal.aborted) {
            setSuggestions([]);
            console.warn("Stock search failed.", searchError);
          }
        });
    }, 600);
    return () => {
      globalThis.clearTimeout(timer);
      controller.abort();
    };
  }, [query, selected.symbol]);
  const runForecast = async () => {
    if (!method) return;
    setLoading(true); setError(""); setComparison([]);
    try { setForecast(await api.forecast(selected.symbol, method, horizon, method === "moving_average" ? { window: Number(movingWindow) } : {})); }
    catch (runError) { setError(runError instanceof Error ? runError.message : "Forecast failed."); }
    finally { setLoading(false); }
  };
  const runCompare = async () => {
    setLoading(true); setError("");
    try { setComparison((await api.compare(selected.symbol, methods.map((item) => item.value), horizon)).results); }
    catch (runError) { setError(runError instanceof Error ? runError.message : "Comparison failed."); }
    finally { setLoading(false); }
  };
  const submitSearch = async () => {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2 || searching) return;
    if (suggestions[0]) {
      await loadStock(suggestions[0]);
      return;
    }
    setSearching(true);
    setError("");
    try {
      const result = await api.search(normalizedQuery);
      if (result.results[0]) {
        await loadStock(result.results[0]);
      } else {
        setError(`No stock found for "${normalizedQuery}".`);
      }
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Stock search failed.");
    } finally {
      setSearching(false);
    }
  };
  const last = bars.at(-1);
  const latestPrice = quote?.price ?? (last ? last.adjustedClose ?? last.close : null);
  const latestPriceDetail = quote?.source ?? (last ? "Latest daily close · quote unavailable" : "Waiting for data");
  const methodLabel = useMemo(() => methods.find((item) => item.value === method)?.label, [method]);
  const historyCoverageWarning = useMemo(() => {
    const requestedDays = rangeDays[historyRange];
    const firstAvailable = availableBars[0]?.date;
    if (!requestedDays || !firstAvailable) return "";
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - requestedDays);
    if (new Date(`${firstAvailable}T00:00:00Z`) > cutoff) {
      return `The provider returned ${availableBars.length} daily sessions (${displayDate(firstAvailable)} to ${displayDate(availableBars.at(-1)!.date)}). Older data is not available for this range.`;
    }
    return "";
  }, [availableBars, historyRange]);
  const exportCsv = () => {
    const rows = [
      ["date", "actual_value", "predicted_value", "method", "horizon", "currency", "source"],
      ...bars.map((bar) => [bar.date, String(bar.adjustedClose ?? bar.close), "", "", "", bar.currency, bar.source]),
      ...((forecast?.points ?? []).map((point) => [point.date, "", String(point.predictedValue), forecast?.method ?? "", forecast?.horizon ?? "", forecast?.currency ?? quote?.currency ?? "", forecast?.source ?? quote?.source ?? ""]))
    ];
    const csv = rows.map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${selected.symbol}-${forecast?.method ?? "history"}-${forecast?.horizon ?? historyRange}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };
  const exportHistoryCsv = () => {
    const rows = [
      ["date", "open", "high", "low", "close", "volume", "currency", "source"],
      ...bars.map((bar) => [
        bar.date,
        String(bar.open),
        String(bar.high),
        String(bar.low),
        String(bar.adjustedClose ?? bar.close),
        bar.volume === null ? "" : String(bar.volume),
        bar.currency,
        bar.source
      ])
    ];
    const csv = rows.map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${selected.symbol}-history-${historyRange}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };
  if (initialLoading) {
    return <main className="app-shell app-loading" aria-live="polite"><div className="loading-mark">S</div><p className="eyebrow accent">MARKET INTELLIGENCE</p><h1>Loading market data…</h1><p>Connecting to the backend and retrieving the latest available market history.</p><span className="loading-spinner" aria-hidden="true" /></main>;
  }
  if (initialError) {
    const quotaError = isProviderQuotaError(initialError);
    return <main className="app-shell app-loading" aria-live="assertive"><div className="loading-mark">!</div><p className="eyebrow">MARKET DATA UNAVAILABLE</p><h1>Unable to load {selected.symbol} history</h1><p>{initialError}</p><p className="muted">{quotaError ? "Alpha Vantage has rejected further requests. Do not retry repeatedly; wait for the provider limit to reset, then refresh the page once." : "Check that the backend and market-data provider are running, then try again."}</p>{!quotaError && <button className="primary-button retry-button" onClick={() => void loadStock(selected)}>Retry connection</button>}</main>;
  }
  return (
    <main className="app-shell">
      <header className="topbar"><div className="brand-mark">S</div><div><p className="eyebrow">MARKET INTELLIGENCE</p><h1>Stocker</h1></div><span className="status-pill"><i />Backend connected</span></header>
      <section className="hero"><div><p className="eyebrow accent">FORECASTING WORKSPACE</p><h2>See the signal<br /><em>behind the price.</em></h2><p className="hero-copy">Explore observed market data and run transparent, model-based estimates. Forecasts are estimates, not financial advice.</p></div>
        <div className="search-card"><label htmlFor="stock-search">Search a stock</label><div className="search-row"><input id="stock-search" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void submitSearch()} placeholder="Type at least 2 characters" /><button disabled={query.trim().length < 2 || searching} onClick={() => void submitSearch()}>{searching ? "Searching…" : "Search"}</button></div>{suggestions.length > 0 && <div className="suggestions">{suggestions.map((item) => <button key={item.symbol} onClick={() => void loadStock(item)}><strong>{item.symbol}</strong><span>{item.name}</span></button>)}</div>}</div>
      </section>
      {error && <div className="alert" role="alert">{error}</div>}
      <section className="stock-heading"><div><span className="ticker">{selected.symbol}</span><h3>{selected.name}</h3><span className="muted">{selected.exchange ?? "Exchange unavailable"} · {quote?.freshness === "real_time" ? "Real-time" : "Latest completed session"}</span></div><div className="quote-value">{latestPrice !== null ? money(latestPrice, quote?.currency ?? last?.currency) : "—"}<small>{quote ? `as of ${displayDate(quote.observedAt)}` : last ? `as of ${displayDate(last.date)} · daily close` : "Loading quote…"}</small></div></section>
      <section className="metric-grid"><MetricCard label="Latest price" value={latestPrice !== null ? money(latestPrice, quote?.currency ?? last?.currency) : "—"} detail={latestPriceDetail} /><MetricCard label="Observed sessions" value={bars.length ? bars.length.toString() : "—"} detail="Daily history loaded" /><MetricCard label="Last observed" value={last ? displayDate(last.date) : "—"} detail={last ? `${money(last.adjustedClose ?? last.close, last.currency)} · completed close` : undefined} /><MetricCard label="Forecast status" value={forecast ? "Ready" : "Not run"} detail={method ? methodLabel : "Select a method below"} /></section>
      <section className="panel chart-panel"><div className="panel-heading"><div><p className="eyebrow">PRICE HISTORY</p><h3>Observed performance</h3></div><div className="chart-actions"><label htmlFor="history-range">Range<select id="history-range" value={historyRange} disabled={historyLoading} onChange={(event) => void changeHistoryRange(event.target.value)}><option value="1d">Last active day</option><option value="5d">5 days</option><option value="1m">1 month</option><option value="3m">3 months</option><option value="6m">6 months</option></select></label><button className="secondary-button history-export-button" disabled={historyLoading || bars.length === 0} onClick={exportHistoryCsv}>Download CSV</button><span className="source-label">{bars[0]?.source ?? "—"} · daily close</span></div></div>{historyCoverageWarning && <p className="coverage-note" role="status">{historyCoverageWarning}</p>}<div className="chart-loading-wrap">{<PriceChart bars={bars} />}{historyLoading && <div className="chart-loading" role="status"><span className="loading-spinner" />Loading {historyRange === "max" ? "maximum" : historyRange} history…</div>}</div><details className="data-table"><summary>View data table</summary><div className="table-wrap"><table><caption className="sr-only">Observed daily closing prices</caption><thead><tr><th>Date</th><th>Close</th><th>Source</th></tr></thead><tbody>{bars.slice(-20).map((bar) => <tr key={bar.date}><td>{displayDate(bar.date)}</td><td>{money(bar.adjustedClose ?? bar.close, bar.currency)}</td><td>{bar.source}</td></tr>)}</tbody></table></div></details></section>
      {forecast && forecast.points.length > 0 && <section className="panel chart-panel forecast-panel"><div className="panel-heading"><div><p className="eyebrow accent">FORECAST PATH</p><h3>{methodLabel} · {forecast.horizon}</h3></div><span className="source-label">{forecast.points.length} projected session{forecast.points.length === 1 ? "" : "s"}</span></div><ForecastChart lastObservedDate={forecast.lastObservedDate} lastObservedValue={forecast.lastObservedValue} points={forecast.points} currency={forecast.currency ?? quote?.currency ?? "USD"} /></section>}
      <section className="workspace-grid"><div className="panel controls-panel"><div className="panel-heading"><div><p className="eyebrow">MODEL LAB</p><h3>Build a forecast</h3></div></div><label htmlFor="method">Forecast method<select id="method" value={method} onChange={(event) => { setMethod(event.target.value as Method); setForecast(null); }}><option value="">Select a method</option>{["Time-series", "Associative model", "Industry-standard model"].map((category) => <optgroup key={category} label={category}>{methods.filter((item) => item.category === category).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</optgroup>)}</select></label>{method === "moving_average" && <label htmlFor="window">Moving-average window<select id="window" value={movingWindow} onChange={(event) => setMovingWindow(event.target.value)}><option value="5">5 sessions</option><option value="10">10 sessions</option><option value="20">20 sessions</option></select></label>}<label htmlFor="horizon">Forecast horizon<select id="horizon" value={horizon} onChange={(event) => setHorizon(event.target.value as Horizon)}>{horizons.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><div className="button-row"><button className="primary-button" disabled={!method || loading} onClick={() => void runForecast()}>{loading ? "Running…" : "Run forecast"}</button><button className="secondary-button" disabled={loading || bars.length < 20} onClick={() => void runCompare()}>Compare all</button></div><p className="control-note">No forecast is run until you explicitly select a method and click a button.</p></div>
        <div className="panel result-panel">{forecast ? <><div className="panel-heading"><div><p className="eyebrow accent">FORECAST ESTIMATE</p><h3>{methodLabel}</h3></div><span className="result-badge">{forecast.horizon}</span></div><div className="result-summary"><div><span>Last observed</span><strong>{money(forecast.lastObservedValue, forecast.currency ?? quote?.currency)}</strong></div><div><span>Forecast endpoint</span><strong>{forecast.points.at(-1)?.date ?? "—"}</strong></div></div><div className="result-metrics">{forecast.metrics?.mae !== undefined && <MetricCard label="Backtest MAE" value={money(forecast.metrics.mae, forecast.currency ?? quote?.currency)} />}{forecast.metrics?.rmse !== undefined && <MetricCard label="Backtest RMSE" value={money(forecast.metrics.rmse, forecast.currency ?? quote?.currency)} />}</div>{forecast.metrics?.available === false && <p className="coverage-note" role="status">Forecast generated successfully. Backtest metrics are unavailable for this horizon because the current history contains too few observations.</p>}<div className="result-actions"><button className="secondary-button" onClick={exportCsv}>Export CSV</button><span className="muted">{forecast.generatedAt ? `Generated ${new Date(forecast.generatedAt).toLocaleString()}` : "Generated from historical data"}</span></div><p className="disclaimer">This forecast is a model estimate based on historical observations. It is not guaranteed and is not financial advice.</p></> : <div className="empty-result"><span className="empty-icon">↗</span><h3>Your forecast will appear here</h3><p>Choose a method and horizon, then run the model to see its estimate and backtest metrics.</p></div>}</div></section>
      {comparison.length > 0 && <section className="panel comparison-panel"><div className="panel-heading"><div><p className="eyebrow">MODEL COMPARISON</p><h3>Same history, different assumptions</h3></div></div><div className="table-wrap"><table><thead><tr><th>Method</th><th>End estimate</th><th>MAE</th><th>RMSE</th></tr></thead><tbody>{comparison.map((result) => <tr key={result.id}><td>{methods.find((item) => item.value === result.method)?.label}</td><td>{money(result.points.at(-1)?.predictedValue ?? 0, quote?.currency)}</td><td>{result.metrics?.mae?.toFixed(3) ?? "—"}</td><td>{result.metrics?.rmse?.toFixed(3) ?? "—"}</td></tr>)}</tbody></table></div></section>}
      <footer><span>Stocker · Market data from {quote?.source ?? "configured provider"}</span><span>Forecasts are estimates, not guarantees.</span></footer>
    </main>
  );
}
