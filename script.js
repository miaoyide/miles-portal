/* ─── Theme ───────────────────────────────────── */

/* ─── Supabase ────────────────────────────────── */

// SUPABASE_URL and SUPABASE_ANON_KEY come from config.js
const PORTAL_SECRET = '3a81f5833dc5973c011454c8fd538af1405410dc885230ae';

const sbHeaders = {
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'x-portal-secret': PORTAL_SECRET,
};

const UNSPLASH_QUERY = 'query=landscape,nature&orientation=landscape';

const themeBtns      = document.querySelectorAll('.theme-btn');
const refreshPhotoBtn = document.getElementById('refreshPhotoBtn');

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    document.body.className = theme === 'photo' ? 'theme-photo' : '';

    themeBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.theme === theme));
    refreshPhotoBtn.classList.toggle('hidden', theme !== 'photo');

    localStorage.setItem('theme', theme);

    if (theme === 'photo') {
        loadUnsplashPhoto();
    } else {
        document.body.style.backgroundImage = '';
    }
}

async function loadUnsplashPhoto() {
    refreshPhotoBtn.classList.add('spinning');

    try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/unsplash?${UNSPLASH_QUERY}`, {
            headers: sbHeaders,
        });
        if (!res.ok) throw new Error();
        const data = await res.json();

        // 預載圖片，載完再切換，避免閃爍
        const img = new Image();
        img.src = data.urls.full;
        img.onload = () => {
            document.body.style.backgroundImage = `url('${data.urls.full}')`;
            refreshPhotoBtn.classList.remove('spinning');
        };
        img.onerror = () => refreshPhotoBtn.classList.remove('spinning');
    } catch {
        console.warn('Unsplash 圖片載入失敗，請確認 Access Key 是否正確');
        refreshPhotoBtn.classList.remove('spinning');
    }
}

// 初始化主題（從 localStorage 讀取，預設 dark）
applyTheme(localStorage.getItem('theme') || 'dark');

themeBtns.forEach(btn => btn.addEventListener('click', () => applyTheme(btn.dataset.theme)));
refreshPhotoBtn.addEventListener('click', loadUnsplashPhoto);


/* ─── Weather ─────────────────────────────────── */

const WEATHER_FN = `${SUPABASE_URL}/functions/v1/weather`;

const WEATHER_TABS = [
    { id: 'local',     label: '當前位置', type: 'geo' },
    { id: 'taipei',    label: 'Taipei',   type: 'city', q: 'Taipei,TW' },
    { id: 'taichung',  label: 'Taichung', type: 'city', q: 'Taichung,TW' },
    { id: 'tainan',    label: 'Tainan',   type: 'city', q: 'Tainan,TW' },
];

const weatherCache = {}; // { tabId: { current, forecast } }
let activeWeatherTab = 'local';

async function fetchWeatherData(params) {
    const query = new URLSearchParams({ ...params, units: 'metric', lang: 'zh_tw', endpoint: 'weather' });
    const res = await fetch(`${WEATHER_FN}?${query}`, {
        headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
    });
    if (!res.ok) {
        const msg = res.status === 404 ? '找不到城市資料'
                  : res.status === 401 ? 'API Key 無效'
                  : `查詢失敗（${res.status}）`;
        throw new Error(msg);
    }
    return res.json();
}

function showWeatherPanel(state, errMsg = '') {
    document.getElementById('weatherLoading').classList.toggle('hidden', state !== 'loading');
    document.getElementById('weatherError').classList.toggle('hidden',   state !== 'error');
    document.getElementById('weatherResult').classList.toggle('hidden',  state !== 'result');
    if (state === 'error') document.getElementById('weatherError').textContent = errMsg;
}

function renderWeatherPanel(data) {
    document.getElementById('weatherIcon').src           = `https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png`;
    document.getElementById('weatherIcon').alt           = data.weather[0].description;
    document.getElementById('weatherCityName').textContent = `${data.name}, ${data.sys.country}`;
    document.getElementById('weatherDesc').textContent     = data.weather[0].description;
    document.getElementById('weatherTemp').textContent     = `${Math.round(data.main.temp)}°C`;
    document.getElementById('weatherHumidity').textContent = data.main.humidity;
    document.getElementById('weatherWind').textContent     = data.wind.speed;
}

const DAY_NAMES = ['日', '一', '二', '三', '四', '五', '六'];

function renderForecastPanel(forecastData) {
    const forecastLoading = document.getElementById('forecastLoading');
    const forecastList    = document.getElementById('forecastList');

    if (!forecastData) { forecastList.classList.add('hidden'); return; }

    const days = {};
    forecastData.list.forEach(item => {
        const date = item.dt_txt.split(' ')[0];
        if (!days[date]) days[date] = { temps: [], noon: null };
        days[date].temps.push(item.main.temp);
        if (item.dt_txt.includes('12:00') || !days[date].noon) days[date].noon = item;
    });

    const today = new Date().toISOString().split('T')[0];
    const entries = Object.entries(days).filter(([d]) => d !== today).slice(0, 5);

    forecastList.innerHTML = '';
    entries.forEach(([date, info]) => {
        const d   = new Date(date + 'T12:00:00');
        const row = document.createElement('div');
        row.className = 'forecast-row';
        row.innerHTML = `
            <span class="forecast-day">週${DAY_NAMES[d.getDay()]}</span>
            <img src="https://openweathermap.org/img/wn/${info.noon.weather[0].icon}.png" alt="${info.noon.weather[0].description}" />
            <span class="forecast-desc">${info.noon.weather[0].description}</span>
            <div class="forecast-temps">
                <span class="hi">${Math.round(Math.max(...info.temps))}°</span>
                <span class="lo">${Math.round(Math.min(...info.temps))}°</span>
            </div>
        `;
        forecastList.appendChild(row);
    });

    forecastLoading.classList.add('hidden');
    forecastList.classList.remove('hidden');
}

async function fetchForecastData(lat, lon) {
    const query = new URLSearchParams({ lat, lon, units: 'metric', lang: 'zh_tw', cnt: 40, endpoint: 'forecast' });
    const res = await fetch(`${WEATHER_FN}?${query}`, {
        headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
    });
    if (!res.ok) return null;
    return res.json();
}

async function loadWeatherTab(tabId) {
    const tab = WEATHER_TABS.find(t => t.id === tabId);

    // 有 cache 直接渲染
    if (weatherCache[tabId]) {
        renderWeatherPanel(weatherCache[tabId].current);
        showWeatherPanel('result');
        renderForecastPanel(weatherCache[tabId].forecast);
        return;
    }

    if (tab.type === 'geo') {
        if (!navigator.geolocation) {
            showWeatherPanel('error', '瀏覽器不支援定位');
            return;
        }
        showWeatherPanel('loading');
        navigator.geolocation.getCurrentPosition(
            async pos => {
                try {
                    const { latitude: lat, longitude: lon } = pos.coords;
                    const current  = await fetchWeatherData({ lat, lon });
                    const forecast = await fetchForecastData(lat, lon);
                    weatherCache[tabId] = { current, forecast };
                    if (activeWeatherTab !== tabId) return;
                    renderWeatherPanel(current);
                    showWeatherPanel('result');
                    renderForecastPanel(forecast);
                } catch (err) {
                    if (activeWeatherTab === tabId) showWeatherPanel('error', err.message);
                }
            },
            () => { if (activeWeatherTab === tabId) showWeatherPanel('error', '無法取得位置，請確認定位授權'); }
        );
    } else {
        showWeatherPanel('loading');
        try {
            const current  = await fetchWeatherData({ q: tab.q });
            const forecast = await fetchForecastData(current.coord.lat, current.coord.lon);
            weatherCache[tabId] = { current, forecast };
            if (activeWeatherTab !== tabId) return;
            renderWeatherPanel(current);
            showWeatherPanel('result');
            renderForecastPanel(forecast);
        } catch (err) {
            if (activeWeatherTab === tabId) showWeatherPanel('error', err.message);
        }
    }
}

// Tab 切換
document.querySelectorAll('.weather-tab').forEach(btn => {
    btn.addEventListener('click', () => {
        const tabId = btn.dataset.tab;
        if (tabId === activeWeatherTab) return;
        activeWeatherTab = tabId;
        document.querySelectorAll('.weather-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
        document.getElementById('forecastList').classList.add('hidden');
        loadWeatherTab(tabId);
    });
});

loadWeatherTab('local');

// ── 查詢城市 ──
const cityInput = document.getElementById('cityInput');
const searchBtn = document.getElementById('searchBtn');
const clearBtn  = document.getElementById('clearBtn');

async function searchCity() {
    const city = cityInput.value.trim();
    if (!city) return;
    document.getElementById('searchLoading').classList.remove('hidden');
    document.getElementById('searchError').classList.add('hidden');
    document.getElementById('searchResult').classList.add('hidden');
    try {
        const query = new URLSearchParams({ q: city, units: 'metric', lang: 'zh_tw', endpoint: 'weather' });
        const res = await fetch(`${WEATHER_FN}?${query}`, {
            headers: sbHeaders,
        });
        if (!res.ok) throw new Error(res.status === 404 ? '找不到該城市，請確認英文拼寫' : `查詢失敗（${res.status}）`);
        const data = await res.json();
        document.getElementById('searchIcon').src            = `https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png`;
        document.getElementById('searchCityName').textContent = `${data.name}, ${data.sys.country}`;
        document.getElementById('searchDesc').textContent     = data.weather[0].description;
        document.getElementById('searchTemp').textContent     = `${Math.round(data.main.temp)}°C`;
        document.getElementById('searchHumidity').textContent = data.main.humidity;
        document.getElementById('searchWind').textContent     = data.wind.speed;
        document.getElementById('searchLoading').classList.add('hidden');
        document.getElementById('searchResult').classList.remove('hidden');
        clearBtn.classList.remove('hidden');
    } catch (err) {
        document.getElementById('searchLoading').classList.add('hidden');
        document.getElementById('searchError').textContent = err.message;
        document.getElementById('searchError').classList.remove('hidden');
        clearBtn.classList.remove('hidden');
    }
}

function clearSearch() {
    cityInput.value = '';
    document.getElementById('searchResult').classList.add('hidden');
    document.getElementById('searchError').classList.add('hidden');
    clearBtn.classList.add('hidden');
    cityInput.focus();
}

searchBtn.addEventListener('click', searchCity);
cityInput.addEventListener('keydown', e => { if (e.key === 'Enter') searchCity(); });
clearBtn.addEventListener('click', clearSearch);


/* ─── Currency ────────────────────────────────── */

const BOT_CSV_URL = `${SUPABASE_URL}/functions/v1/taiwan-rates`;

const DISPLAY_CURRENCIES = ['USD', 'JPY', 'EUR', 'CNY', 'GBP', 'HKD', 'THB'];
const CURRENCY_NAMES = { USD: '美元', JPY: '日圓', EUR: '歐元', CNY: '人民幣', GBP: '英鎊', HKD: '港幣', THB: '泰銖' };

const twdInput           = document.getElementById('twdInput');
const foreignAmountInput = document.getElementById('foreignAmountInput');
const foreignSelect      = document.getElementById('foreignCurrencySelect');
const currencyResult     = document.getElementById('currencyResult');
const currencyError      = document.getElementById('currencyError');
const currencyLoading    = document.getElementById('currencyLoading');
const rateList           = document.getElementById('rateList');
const rateUpdated        = document.getElementById('rateUpdated');
const twdModeInput       = document.getElementById('twdModeInput');
const foreignModeInput   = document.getElementById('foreignModeInput');

let ratesCache    = null;
let currencyMode  = 'twd'; // 'twd' | 'foreign'

function showCurrency(state) {
    currencyLoading.classList.toggle('hidden', state !== 'loading');
    currencyError.classList.toggle('hidden',   state !== 'error');
    currencyResult.classList.toggle('hidden',  state !== 'result');
}

function parseBotCsv(csv) {
    const result = {};
    csv.trim().split(/\r?\n/).slice(1).forEach(line => {
        const cols = line.split(',');
        if (cols.length < 14) return;
        const code = cols[0].trim();
        if (!DISPLAY_CURRENCIES.includes(code)) return;
        const buy  = parseFloat(cols[3]);
        const sell = parseFloat(cols[13]);
        if (!isNaN(buy) && !isNaN(sell)) result[code] = { buy, sell };
    });
    return result;
}

async function fetchRates() {
    showCurrency('loading');
    try {
        const res = await fetch(BOT_CSV_URL, { headers: sbHeaders });
        if (!res.ok) throw new Error(`台銀 API 失敗（${res.status}）`);
        const csv = await res.text();
        ratesCache = parseBotCsv(csv);
        if (Object.keys(ratesCache).length === 0) throw new Error('匯率資料解析失敗');

        // 初始化外幣選單
        foreignSelect.innerHTML = DISPLAY_CURRENCIES
            .map(c => `<option value="${c}">${c}</option>`).join('');

        rateUpdated.textContent = `台灣銀行牌告匯率・${new Date().toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
        renderRates();
    } catch (err) {
        currencyError.textContent = err.message;
        showCurrency('error');
    }
}

// ── TWD 換算模式 ──
function renderTwdMode() {
    if (!ratesCache) return;
    const twd = parseFloat(twdInput.value) || 0;
    rateList.classList.remove('rate-list--foreign');
    rateList.innerHTML = '';

    DISPLAY_CURRENCIES.forEach(code => {
        const r = ratesCache[code];
        if (!r) return;
        const foreignAmt = twd > 0 ? twd / r.sell : null;
        const row = document.createElement('div');
        row.className = 'rate-row';
        row.innerHTML = `
            <span class="currency-code">${code}</span>
            <span class="currency-name">${CURRENCY_NAMES[code] ?? code}</span>
            <div class="rate-buy-sell">
                <div><span class="label">買入</span><span class="buy">${r.buy.toFixed(3)}</span></div>
                <div><span class="label">賣出</span><span class="sell">${r.sell.toFixed(3)}</span></div>
            </div>
            <span class="rate-converted">${foreignAmt !== null ? '≈ ' + formatForeignAmt(code, foreignAmt) : ''}</span>
        `;
        rateList.appendChild(row);
    });

    showCurrency('result');
}

// ── 外幣換算模式 ──

// 邏輯：持有外幣 A → 賣給銀行（用 buy 率）→ 得到 TWD → 買外幣 B（用 sell 率）
function renderForeignMode() {
    if (!ratesCache) return;
    rateList.classList.add('rate-list--foreign');
    const srcCode = foreignSelect.value;
    const amount  = parseFloat(foreignAmountInput.value) || 0;
    const srcRate = ratesCache[srcCode];
    if (!srcRate) return;

    // 換算成 TWD（銀行買入外幣）
    const twdAmt = amount * srcRate.buy;

    rateList.innerHTML = '';

    // TWD 列
    const twdRow = document.createElement('div');
    twdRow.className = 'rate-row rate-row-highlight';
    twdRow.innerHTML = `
        <span class="currency-code">TWD</span>
        <span class="currency-name">新台幣</span>
        <span class="rate-foreign-result">${twdAmt.toLocaleString('zh-TW', { maximumFractionDigits: 0 })}</span>
    `;
    rateList.appendChild(twdRow);

    // 其他外幣列
    DISPLAY_CURRENCIES.forEach(code => {
        if (code === srcCode) return;
        const r = ratesCache[code];
        if (!r) return;
        const converted = twdAmt / r.sell;
        const row = document.createElement('div');
        row.className = 'rate-row';
        row.innerHTML = `
            <span class="currency-code">${code}</span>
            <span class="currency-name">${CURRENCY_NAMES[code] ?? code}</span>
            <span class="rate-foreign-result">${formatForeignAmt(code, converted)}</span>
        `;
        rateList.appendChild(row);
    });

    showCurrency('result');
}

function formatForeignAmt(code, amt) {
    // 日圓、韓圓不顯示小數
    const decimals = ['JPY', 'THB'].includes(code) ? 0 : 2;
    return amt.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function renderRates() {
    currencyMode === 'twd' ? renderTwdMode() : renderForeignMode();
}

// ── 模式切換 ──
document.querySelectorAll('.currency-mode-tab').forEach(btn => {
    btn.addEventListener('click', () => {
        currencyMode = btn.dataset.mode;
        document.querySelectorAll('.currency-mode-tab').forEach(b => b.classList.toggle('active', b.dataset.mode === currencyMode));
        twdModeInput.classList.toggle('hidden',     currencyMode !== 'twd');
        foreignModeInput.classList.toggle('hidden', currencyMode !== 'foreign');
        renderRates();
    });
});

twdInput.addEventListener('input', renderRates);
foreignAmountInput.addEventListener('input', renderRates);
foreignSelect.addEventListener('change', renderRates);

fetchRates();


/* ─── Stocks ──────────────────────────────────── */

const STOCKS_FN    = `${SUPABASE_URL}/functions/v1/taiwan-stocks`;
const TWSE_ALL_URL = `${STOCKS_FN}?api=tse-all`;
const TWSE_IDX_URL = `${STOCKS_FN}?api=tse-idx`;
const TPEX_ALL_URL = `${STOCKS_FN}?api=tpex-all`;

const WATCH_LIST = [
    { code: '2330', name: '台積電',     market: 'tse' },
    { code: '0050', name: '元大台灣50', market: 'tse' },
    { code: '2308', name: '台達電',     market: 'tse' },
    { code: '8996', name: '高力',       market: 'otc' },
    { code: '2353', name: '宏碁',       market: 'tse' },
    { code: '2027', name: '大成鋼',     market: 'tse' },
    { code: '1313', name: '聯成',       market: 'tse' },
    { code: '4927', name: '泰鼎-KY',   market: 'otc' },
];

const stockLoading = document.getElementById('stockLoading');
const stockError   = document.getElementById('stockError');
const stockResult  = document.getElementById('stockResult');
const stockList    = document.getElementById('stockList');
const stockUpdated = document.getElementById('stockUpdated');

function showStock(state) {
    stockLoading.classList.toggle('hidden', state !== 'loading');
    stockError.classList.toggle('hidden',   state !== 'error');
    stockResult.classList.toggle('hidden',  state !== 'result');
}

async function safeJson(res) {
    try { return res.ok ? await res.json() : []; } catch { return []; }
}

// 個股月資料回傳陣列，取最後一筆（最近交易日）
async function fetchTseFallback() {
    const tseStocks = WATCH_LIST.filter(s => s.market === 'tse');
    const results = await Promise.allSettled(
        tseStocks.map(({ code }) =>
            fetch(`${STOCKS_FN}?api=tse-stock&stockNo=${code}`, { headers: sbHeaders }).then(safeJson)
        )
    );
    return results.flatMap((r, i) => {
        if (r.status !== 'fulfilled' || r.value.length === 0) return [];
        const latest = r.value[r.value.length - 1];
        return [{ ...latest, Code: tseStocks[i].code }];
    });
}

// TPEx 個股月資料 fallback
async function fetchTpexFallback() {
    const otcStocks = WATCH_LIST.filter(s => s.market === 'otc');
    const results = await Promise.allSettled(
        otcStocks.map(({ code }) =>
            fetch(`${STOCKS_FN}?api=tpex-stock&stockNo=${code}`, { headers: sbHeaders }).then(safeJson)
        )
    );
    return results.flatMap((r, i) => {
        if (r.status !== 'fulfilled' || r.value.length === 0) return [];
        const latest = r.value[r.value.length - 1];
        return [{ ...latest, SecuritiesCompanyCode: otcStocks[i].code }];
    });
}

async function fetchStocks() {
    showStock('loading');
    try {
        const [tseRes, tpexRes, idxRes] = await Promise.allSettled([
            fetch(TWSE_ALL_URL, { headers: sbHeaders }),
            fetch(TPEX_ALL_URL, { headers: sbHeaders }),
            fetch(TWSE_IDX_URL, { headers: sbHeaders }),
        ]);

        let tseData   = tseRes.status  === 'fulfilled' ? await safeJson(tseRes.value)  : [];
        let tpexData  = tpexRes.status === 'fulfilled' ? await safeJson(tpexRes.value) : [];
        const idxData = idxRes.status  === 'fulfilled' ? await safeJson(idxRes.value)  : [];

        // 無資料時撈前一交易日個股資料
        if (tseData.length  === 0) tseData  = await fetchTseFallback();
        if (tpexData.length === 0) tpexData = await fetchTpexFallback();

        const tseMap  = Object.fromEntries(tseData.map(s => [s.Code, s]));
        const tpexMap = Object.fromEntries(tpexData.map(s => [s.SecuritiesCompanyCode ?? s.Code, s]));
        const taiex   = idxData.find(i => i.Index?.includes('加權'));
        const dataDate = tseData[0]?.Date ?? '';

        renderStocks(tseMap, tpexMap, taiex, dataDate);
    } catch (err) {
        stockError.textContent = err.message;
        showStock('error');
    }
}

function formatChange(change, pct) {
    if (!change || change === '--' || change === '') return { text: '—', cls: 'stock-flat' };
    const num = parseFloat(change);
    if (isNaN(num) || num === 0) return { text: '0.00 (0.00%)', cls: 'stock-flat' };
    const sign  = num > 0 ? '+' : '';
    const pctStr = pct ? ` (${pct})` : '';
    return {
        text: `${sign}${num.toFixed(2)}${pctStr}`,
        cls: num > 0 ? 'stock-up' : 'stock-down',
    };
}

function renderStocks(tseMap, tpexMap, taiex, dataDate) {
    stockList.innerHTML = '';

    // 加權指數
    if (taiex) {
        const chg = formatChange(taiex.Change, taiex.ChangePer);
        const row = document.createElement('div');
        row.className = 'stock-row index-row';
        row.innerHTML = `
            <div>
                <span class="stock-code">加權指數</span>
            </div>
            <span class="stock-price">${parseFloat(taiex.Indices).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            <span class="${chg.cls}">${chg.text}</span>
        `;
        stockList.appendChild(row);
    }

    // 個股
    WATCH_LIST.forEach(({ code, name, market }) => {
        const s = market === 'tse' ? tseMap[code] : tpexMap[code];

        const price  = s ? parseFloat(s.ClosingPrice ?? s.Close ?? 0) : null;
        const change = s ? (s.Change ?? s.PriceChange ?? '') : '';
        const chg    = formatChange(change);

        const row = document.createElement('div');
        row.className = 'stock-row';
        row.innerHTML = `
            <div class="stock-row-top">
                <span class="stock-code">${code}</span>
                <span class="stock-name">${name}</span>
            </div>
            <div class="stock-row-bottom" style="justify-content:space-between; align-items:baseline;">
                <span class="stock-price">${price !== null ? price.toFixed(2) : '—'}</span>
                <span class="${chg.cls}">${chg.text}</span>
            </div>
        `;
        stockList.appendChild(row);
    });

    const dateLabel = dataDate ? `資料日期：${dataDate}・` : '';
    stockUpdated.textContent = `${dateLabel}載入於 ${new Date().toLocaleString('zh-TW', { hour: '2-digit', minute: '2-digit' })}`;
    showStock('result');
}

fetchStocks();


/* ─── Crypto ──────────────────────────────────── */

const BINANCE_URL = 'https://api.binance.com/api/v3/ticker/24hr';
const CRYPTO_SYMBOLS = ['BTCUSDT', 'ETHUSDT'];

const cryptoLoading = document.getElementById('cryptoLoading');
const cryptoError   = document.getElementById('cryptoError');
const cryptoResult  = document.getElementById('cryptoResult');
const cryptoList    = document.getElementById('cryptoList');
const cryptoUpdated = document.getElementById('cryptoUpdated');

function showCrypto(state) {
    cryptoLoading.classList.toggle('hidden', state !== 'loading');
    cryptoError.classList.toggle('hidden',   state !== 'error');
    cryptoResult.classList.toggle('hidden',  state !== 'result');
}

async function fetchCrypto() {
    showCrypto('loading');
    try {
        const params = `symbols=${encodeURIComponent(JSON.stringify(CRYPTO_SYMBOLS))}`;
        const res = await fetch(`${BINANCE_URL}?${params}`);
        if (!res.ok) throw new Error(`Binance API 失敗（${res.status}）`);
        const data = await res.json();
        renderCrypto(data);
    } catch (err) {
        cryptoError.textContent = err.message;
        showCrypto('error');
    }
}

function renderCrypto(tickers) {
    cryptoList.innerHTML = '';

    // BTC/USDT、ETH/USDT
    tickers.forEach(t => {
        const base  = t.symbol.replace('USDT', '');
        const price = parseFloat(t.lastPrice);
        const change = parseFloat(t.priceChangePercent);
        const isUp  = change >= 0;

        const row = document.createElement('div');
        row.className = 'rate-row';
        row.innerHTML = `
            <span class="currency-code">${base}</span>
            <span class="currency-name crypto-pair">/ USDT</span>
            <div class="crypto-price-block">
                <span class="crypto-price">${price.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
                <span class="crypto-change ${isUp ? 'up' : 'down'}">${isUp ? '▲' : '▼'} ${Math.abs(change).toFixed(2)}%</span>
            </div>
        `;
        cryptoList.appendChild(row);
    });

    cryptoUpdated.textContent = `更新時間：${new Date().toLocaleString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
    showCrypto('result');
}

fetchCrypto();


/* ─── Reminders ───────────────────────────────── */

// ── Telegram ──

async function sendTelegram(text) {
    try {
        await fetch(`${SUPABASE_URL}/functions/v1/send-telegram`, {
            method: 'POST',
            headers: { ...sbHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ text }),
        });
    } catch {}
}

// ── 通知 ──
function sendNotification(title, body) {
    sendTelegram(`${title}\n${body}`);
}

// ── 提醒（Supabase DB）──
const DB_URL = `${SUPABASE_URL}/rest/v1/reminders`;
// dbHeaders comes from config.js

let allReminders = [];

function normalizeReminder(r) {
    return { ...r, id: String(r.id), intervalMs: r.interval_min ? r.interval_min * 60_000 : undefined };
}

async function syncReminders() {
    try {
        const res = await fetch(`${DB_URL}?order=id.asc`, { headers: dbHeaders });
        if (!res.ok) throw new Error(res.status);
        allReminders = (await res.json()).map(normalizeReminder);
        allReminders.forEach(r => {
            if (r.type === 'interval' && r.active && !runningIntervals.has(r.id)) startIntervalTimer(r);
        });
        renderAllReminders();
    } catch (err) { console.error('syncReminders failed', err); }
}

async function dbAdd(data) {
    const res = await fetch(DB_URL, {
        method: 'POST',
        headers: { ...dbHeaders, 'Prefer': 'return=representation' },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(res.status);
    return normalizeReminder((await res.json())[0]);
}

async function dbDelete(id) {
    await fetch(`${DB_URL}?id=eq.${id}`, { method: 'DELETE', headers: dbHeaders });
}

async function dbToggle(id, active) {
    await fetch(`${DB_URL}?id=eq.${id}`, {
        method: 'PATCH',
        headers: { ...dbHeaders, 'Prefer': 'return=representation' },
        body: JSON.stringify({ active }),
    });
}

// ── 間隔計時器 Map<id, { handle, nextFire }> ──
const runningIntervals = new Map();

function formatIntervalBadge(ms) {
    const mins = ms / 60000;
    return mins >= 60 ? `${mins / 60}h` : `${mins}m`;
}

function formatCountdown(nextFire) {
    const diff = nextFire - Date.now();
    if (diff <= 0) return '即將觸發';
    const s = Math.floor(diff / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${sec}s`;
    return `${sec}s`;
}

function startIntervalTimer(r) {
    if (runningIntervals.has(r.id)) return;
    const nextFire = Date.now() + r.intervalMs;
    const handle = setInterval(() => {
        sendNotification('⏱ 間隔提醒', r.label);
        runningIntervals.set(r.id, { handle, nextFire: Date.now() + r.intervalMs });
    }, r.intervalMs);
    runningIntervals.set(r.id, { handle, nextFire });
}

function stopIntervalTimer(id) {
    const entry = runningIntervals.get(id);
    if (entry) { clearInterval(entry.handle); runningIntervals.delete(id); }
}

// ── 統一列表渲染 ──
const unifiedListEl  = document.getElementById('unifiedReminderList');
const unifiedEmptyEl = document.getElementById('unifiedReminderEmpty');

const firedSet = new Set();

function renderAllReminders() {
    unifiedListEl.innerHTML = '';
    unifiedEmptyEl.classList.toggle('hidden', allReminders.length > 0);

    allReminders.forEach(r => {
        const isInterval = r.type === 'interval';
        const entry = runningIntervals.get(r.id);
        const badge = isInterval ? `每${formatIntervalBadge(r.intervalMs)}` : r.time;
        const countdown = isInterval && r.active && entry ? formatCountdown(entry.nextFire) : '';

        const item = document.createElement('div');
        item.className = `reminder-item${r.active ? ' active' : ''}`;
        item.dataset.id = r.id;
        item.innerHTML = `
            <span class="reminder-type-badge">${isInterval ? '間隔' : '每日'}</span>
            <span class="reminder-time-badge">${badge}</span>
            <span class="reminder-label-text" title="${r.label}">${r.label}</span>
            ${isInterval ? `<span class="reminder-countdown">${countdown}</span>` : ''}
            <button class="reminder-toggle">${r.active ? '開啟' : '關閉'}</button>
            <button class="reminder-delete">✕</button>
        `;

        item.querySelector('.reminder-toggle').addEventListener('click', async () => {
            const newActive = !r.active;
            await dbToggle(r.id, newActive);
            r.active = newActive;
            if (r.type === 'interval') newActive ? startIntervalTimer(r) : stopIntervalTimer(r.id);
            renderAllReminders();
        });

        item.querySelector('.reminder-delete').addEventListener('click', async () => {
            if (isInterval) stopIntervalTimer(r.id);
            await dbDelete(r.id);
            allReminders = allReminders.filter(x => x.id !== r.id);
            renderAllReminders();
        });

        unifiedListEl.appendChild(item);
    });
}

function updateAllCountdowns() {
    allReminders.forEach(r => {
        if (r.type !== 'interval' || !r.active) return;
        const el = unifiedListEl.querySelector(`[data-id="${r.id}"] .reminder-countdown`);
        const entry = runningIntervals.get(r.id);
        if (el && entry) el.textContent = formatCountdown(entry.nextFire);
    });
}

// ── 每日提醒輪詢 ──
function checkDailyReminders() {
    const now  = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    allReminders.forEach(r => {
        if (r.type !== 'daily' || !r.active || r.time !== hhmm) return;
        const key = `${r.id}-${hhmm}`;
        if (firedSet.has(key)) return;
        firedSet.add(key);
        sendNotification('⏰ 每日提醒', r.label);
    });
}

// ── Modal ──
const modal              = document.getElementById('reminderModal');
const openModalBtn       = document.getElementById('openReminderModalBtn');
const closeModalBtn      = document.getElementById('closeReminderModalBtn');
const cancelBtn          = document.getElementById('cancelReminderBtn');
const confirmBtn         = document.getElementById('confirmReminderBtn');
const modalTabs          = document.querySelectorAll('.modal-tab');
const modalDailyFields   = document.getElementById('modalDailyFields');
const modalIntervalFields= document.getElementById('modalIntervalFields');
const modalLabelInput    = document.getElementById('modalLabel');
const modalTimeInput     = document.getElementById('modalTime');
const modalIntervalValue = document.getElementById('modalIntervalValue');
const modalIntervalUnit  = document.getElementById('modalIntervalUnit');

let modalType = 'daily';

function openModal() {
    modalLabelInput.value = '';
    modalTimeInput.value  = '';
    modalIntervalValue.value = '30';
    modal.classList.remove('hidden');
    setTimeout(() => modalLabelInput.focus(), 50);
}

function closeModal() {
    modal.classList.add('hidden');
}

function switchTab(type) {
    modalType = type;
    modalTabs.forEach(t => t.classList.toggle('active', t.dataset.type === type));
    modalDailyFields.classList.toggle('hidden', type !== 'daily');
    modalIntervalFields.classList.toggle('hidden', type !== 'interval');
}

async function confirmAddReminder() {
    const label = modalLabelInput.value.trim();
    if (!label) { modalLabelInput.focus(); return; }

    let data;
    if (modalType === 'daily') {
        const time = modalTimeInput.value;
        if (!time) { modalTimeInput.focus(); return; }
        data = { type: 'daily', label, time, active: true };
    } else {
        const value = parseInt(modalIntervalValue.value, 10);
        const unit  = parseInt(modalIntervalUnit.value, 10);
        if (isNaN(value) || value < 1) { modalIntervalValue.focus(); return; }
        data = { type: 'interval', label, interval_min: (value * unit) / 60_000, active: true };
    }

    try {
        const r = await dbAdd(data);
        allReminders.push(r);
        if (r.type === 'interval' && r.active) startIntervalTimer(r);
        renderAllReminders();
        closeModal();
    } catch (err) { console.error('新增失敗', err); }
}

openModalBtn.addEventListener('click', openModal);
closeModalBtn.addEventListener('click', closeModal);
cancelBtn.addEventListener('click', closeModal);
confirmBtn.addEventListener('click', confirmAddReminder);
modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
modalTabs.forEach(t => t.addEventListener('click', () => switchTab(t.dataset.type)));
modalLabelInput.addEventListener('keydown', e => { if (e.key === 'Enter') confirmAddReminder(); });

// ── 初始化 ──
syncReminders();
setInterval(syncReminders, 30_000);

setInterval(checkDailyReminders, 10_000);
checkDailyReminders();

setInterval(updateAllCountdowns, 1_000);
