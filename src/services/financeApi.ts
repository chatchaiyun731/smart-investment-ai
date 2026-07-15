import fetch from "node-fetch"; // ensure fetch is available
import { getCache, setCache } from "../cacheManager.js";
export interface Asset {
  symbol: string;
  name: string;
  type: 'stock' | 'fund';
  sector: string;
  price: number;
  prevClose: number;
  change: number;
  changePercent: number;
  lastUpdated: string;
}

export interface ApiConfig {
  useMock: boolean;
  secApiKey: string;
  yahooApiKey: string;
  geminiApiKey: string;
  selectedModel: string;
  billingTier: 'free' | 'paid';
  useFreePriceMode?: boolean;
}

// Initial mock market database
const MOCK_MARKET_DATABASE: Record<string, Omit<Asset, 'change' | 'changePercent' | 'lastUpdated'>> = {
  // Thai Stocks
  'PTT': { symbol: 'PTT', name: 'PTT Public Company Limited', type: 'stock', sector: 'Energy', price: 34.25, prevClose: 34.00 },
  'CPALL': { symbol: 'CPALL', name: 'CP ALL Public Company Limited', type: 'stock', sector: 'Commerce', price: 57.50, prevClose: 58.00 },
  'AOT': { symbol: 'AOT', name: 'Airports of Thailand Public Company Limited', type: 'stock', sector: 'Transportation', price: 62.25, prevClose: 61.50 },
  'KBANK': { symbol: 'KBANK', name: 'Kasikornbank Public Company Limited', type: 'stock', sector: 'Banking', price: 148.50, prevClose: 147.00 },
  'ADVANC': { symbol: 'ADVANC', name: 'Advanced Info Service Public Company Limited', type: 'stock', sector: 'ICT', price: 357.00, prevClose: 352.00 },
  
  // Global Stocks
  'AAPL': { symbol: 'AAPL', name: 'Apple Inc.', type: 'stock', sector: 'Technology', price: 185.50, prevClose: 184.20 },
  'TSLA': { symbol: 'TSLA', name: 'Tesla, Inc.', type: 'stock', sector: 'Automotive', price: 178.90, prevClose: 182.10 },
  'NVDA': { symbol: 'NVDA', name: 'NVIDIA Corporation', type: 'stock', sector: 'Technology', price: 920.50, prevClose: 900.00 },

  // Thai Mutual Funds
  'ONE-UGG-RA': { symbol: 'ONE-UGG-RA', name: 'One Ultimate Global Growth Fund', type: 'fund', sector: 'Global Equity', price: 18.4520, prevClose: 18.2500 },
  'K-CHANGE-A(A)': { symbol: 'K-CHANGE-A(A)', name: 'K Positive Change Fund', type: 'fund', sector: 'ESG Equity', price: 12.8420, prevClose: 12.9200 },
  'SCBGP': { symbol: 'SCBGP', name: 'SCB Global Population Fund', type: 'fund', sector: 'Global Equity', price: 10.3524, prevClose: 10.2800 },
  'B-INNOTECH': { symbol: 'B-INNOTECH', name: 'Bualuang Global Innovation Technology Fund', type: 'fund', sector: 'Technology Equity', price: 24.1205, prevClose: 23.9500 },
  'TMBCOF': { symbol: 'TMBCOF', name: 'TMB China Opportunity Fund', type: 'fund', sector: 'China Equity', price: 8.5240, prevClose: 8.6500 }
};

class FinanceApiService {
  private config: ApiConfig = {
    useMock: false, // Default to false to show real prices immediately
    secApiKey: '',
    yahooApiKey: '',
    geminiApiKey: '',
    selectedModel: 'gemini-3.1-flash-lite',
    billingTier: 'free',
    useFreePriceMode: true
  };

  private marketData: Record<string, Asset> = {};
  private listeners: Set<(updatedData: Record<string, Asset>, updatedSymbol?: string) => void> = new Set();
  private intervalId: number | null = null;
  private realTimeIntervalId: number | null = null;

  constructor() {
    this.loadConfig();
    this.initializeMarketData();
    if (this.config.useMock) {
      this.startMockEngine();
    } else {
      this.fetchRealPrices();
      if (this.isAutoRefreshEnabled()) {
        this.startRealTimeRefresh();
      }
    }
  }

  private loadConfig() {
    const saved = localStorage.getItem('portfolio_tracker_api_config');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        
        // ย้ายรุ่นโมเดลที่ถูกยกเลิกบริการแล้ว (เช่น gemini-2.5-flash หรือ gemini-1.5-flash) ไปใช้ gemini-3.1-flash-lite อัตโนมัติ
        if (parsed.selectedModel === 'gemini-2.5-flash' || parsed.selectedModel === 'gemini-1.5-flash' || parsed.selectedModel === 'flash') {
          parsed.selectedModel = 'gemini-3.1-flash-lite';
          localStorage.setItem('portfolio_tracker_api_config', JSON.stringify(parsed));
          console.log('Automatically migrated deprecated Gemini model to gemini-3.1-flash-lite');
        }
        
        // Clean default overrides if user has saved values, keeping the new default
        this.config = { ...this.config, ...parsed };
      } catch (e) {
        console.error('Failed to parse API config', e);
      }
    } else {
      this.config.useMock = false;
    }
  }

  public saveConfig(newConfig: Partial<ApiConfig>) {
    this.config = { ...this.config, ...newConfig };
    localStorage.setItem('portfolio_tracker_api_config', JSON.stringify(this.config));
    
    // ล้างเวลาและข้อผิดพลาดของการดึงราคาล่าสุดออก เพื่อให้กดบันทึกแล้วดึงราคาทันทีด้วยคีย์ใหม่
    localStorage.removeItem('portfolio_tracker_last_fetch_time');
    localStorage.removeItem('portfolio_tracker_price_fetch_error');
    
    // Restart engine based on config
    if (this.config.useMock) {
      this.stopRealTimeRefresh();
      this.startMockEngine();
    } else {
      this.stopMockEngine();
      this.fetchRealPrices();
      if (this.isAutoRefreshEnabled()) {
        this.startRealTimeRefresh();
      } else {
        this.stopRealTimeRefresh();
      }
    }
  }

  public getConfig(): ApiConfig {
    return { ...this.config };
  }

  // เช็คว่าเปิดใช้งานการรีเฟรชราคาอัตโนมัติอยู่หรือไม่ (ค่าเริ่มต้นปิดเพื่อเซฟงบ)
  public isAutoRefreshEnabled(): boolean {
    const saved = localStorage.getItem('portfolio_tracker_auto_refresh');
    return saved === 'true'; // คืนค่าจริงหากมีการตั้งเป็น true (ค่าเริ่มต้นเป็น false หากไม่มีการตั้งค่า)
  }

  // สลับสถานะเปิด/ปิดการรีเฟรชราคาอัตโนมัติ
  public setAutoRefresh(enabled: boolean) {
    localStorage.setItem('portfolio_tracker_auto_refresh', String(enabled));
    if (enabled && !this.config.useMock) {
      this.startRealTimeRefresh();
    } else {
      this.stopRealTimeRefresh();
    }
    this.notify(); // แจ้งเตือนเพื่อให้ UI รีเรนเดอร์อัปเดตสวิตช์ Toggle
  }

  public async fetchSingleAssetPrice(symbol: string): Promise<{ price: number; prevClose: number } | null> {
    const sym = symbol.toUpperCase().trim();
    if (!sym) return null;
    const cacheKey = `price:${sym}`;
    // Try cache first
    const cached = await getCache(cacheKey);
    if (cached) {
      return { price: cached.price, prevClose: cached.prevClose };
    }
    const isFund = sym.includes('-') || sym.length > 6 || sym.includes('RMF') || sym.includes('SSF');
    try {
      let result;
      if (isFund) {
        // Try Finnomena first
        const finData = await this.fetchFinnomenaFundNav(sym);
        if (finData) result = finData;
        else result = await this.fetchYahooPrice(sym);
      } else {
        // Stock path
        result = await this.fetchYahooPrice(sym);
      }
      if (result) {
        // Store in cache (default TTL 5 min)
        await setCache(cacheKey, result, 24 * 60 * 60 * 1000); // 24 hours (1 day)
        return result;
      }
    } catch (e) {
      console.warn('fetchSingleAssetPrice error, attempting fallback', e);
    }
    // Final fallback to any cached asset data
    const asset = this.getAsset(sym);
    if (asset) return { price: asset.price, prevClose: asset.prevClose };
    return null;
  }


  // กดปุ่มรีเฟรชราคาเรียลไทม์เองแบบแมนนวล (ข้ามลิมิต 65 วินาทีเพราะเกิดจาก action ของผู้ใช้ตรงๆ)
  public async refreshPricesManually() {
    localStorage.removeItem('portfolio_tracker_last_fetch_time');
    localStorage.removeItem('portfolio_tracker_price_fetch_error');
    await this.fetchRealPrices();
  }

  private initializeMarketData() {
    Object.keys(MOCK_MARKET_DATABASE).forEach((symbol) => {
      const base = MOCK_MARKET_DATABASE[symbol];
      const change = base.price - base.prevClose;
      const changePercent = (change / base.prevClose) * 100;
      
      this.marketData[symbol] = {
        ...base,
        change,
        changePercent,
        lastUpdated: new Date().toLocaleTimeString()
      };
    });

    // Load custom assets from LocalStorage
    const savedCustoms = localStorage.getItem('portfolio_tracker_custom_assets');
    if (savedCustoms) {
      try {
        const customs = JSON.parse(savedCustoms);
        Object.keys(customs).forEach((symbol) => {
          const base = customs[symbol];
          const change = base.price - base.prevClose;
          const changePercent = base.prevClose > 0 ? (change / base.prevClose) * 100 : 0;
          
          this.marketData[symbol] = {
            ...base,
            change,
            changePercent,
            lastUpdated: new Date().toLocaleTimeString()
          };
        });
      } catch (e) {
        console.error('Failed to parse saved custom assets', e);
      }
    }

    // ระบบค้นหาและลงทะเบียนสินทรัพย์ในพอร์ตอัตโนมัติ (Holding Auto-Discovery)
    // ช่วยให้แม้กู้คืนจากไฟล์สำรองเก่าที่ไม่มีเมทาดาต้าของสินทรัพย์ ระบบก็ยังดึงราคาจริงได้ทันที
    const savedHoldings = localStorage.getItem('portfolio_tracker_holdings');
    if (savedHoldings) {
      try {
        const holdingsList = JSON.parse(savedHoldings);
        if (Array.isArray(holdingsList)) {
          holdingsList.forEach((holding: any) => {
            if (holding && holding.symbol) {
              const sym = holding.symbol.toUpperCase().trim();
              if (!this.marketData[sym]) {
                console.log(`Auto-discovered custom symbol from holdings: ${sym}`);
                const isFund = sym.includes('-') || sym.length > 6;
                this.marketData[sym] = {
                  symbol: sym,
                  name: holding.name || sym,
                  type: isFund ? 'fund' : 'stock',
                  sector: 'Other',
                  price: Number(holding.avgCost) || 0,
                  prevClose: Number(holding.avgCost) || 0,
                  change: 0,
                  changePercent: 0,
                  lastUpdated: new Date().toLocaleTimeString()
                };
              }
            }
          });
        }
      } catch (e) {
        console.error('Failed to parse holdings for asset auto-discovery', e);
      }
    }
  }

  // Real-time listener registration
  public subscribe(callback: (updatedData: Record<string, Asset>, updatedSymbol?: string) => void) {
    this.listeners.add(callback);
    // Emit initial load
    callback(this.marketData);
    return () => this.listeners.delete(callback);
  }

  private notify(updatedSymbol?: string) {
    this.listeners.forEach(callback => callback(this.marketData, updatedSymbol));
  }

  // Start mock engine that fluctuates prices every 3 seconds to simulate real-time for all assets
  private startMockEngine() {
    if (this.intervalId) return;

    this.intervalId = window.setInterval(() => {
      Object.keys(this.marketData).forEach((symbol) => {
        const asset = this.marketData[symbol];
        
        // Mutual funds change slower than stocks
        const volatility = asset.type === 'stock' ? 0.005 : 0.001;
        const percentChange = (Math.random() - 0.49) * 2 * volatility; // slightly positive drift
        
        const newPrice = asset.price * (1 + percentChange);
        const roundedPrice = asset.type === 'stock' 
          ? Math.round(newPrice * 100) / 100 
          : Math.round(newPrice * 10000) / 10000;
          
        const change = roundedPrice - asset.prevClose;
        const changePercent = asset.prevClose > 0 ? (change / asset.prevClose) * 100 : 0;

        this.marketData[symbol] = {
          ...asset,
          price: roundedPrice,
          change,
          changePercent,
          lastUpdated: new Date().toLocaleTimeString()
        };
      });

      this.notify();
    }, 3000);
  }

  private stopMockEngine() {
    if (this.intervalId) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private startRealTimeRefresh() {
    this.stopRealTimeRefresh();
    this.realTimeIntervalId = window.setInterval(() => {
      this.fetchRealPrices();
    }, 300000); // Auto-refresh real prices every 5 minutes (300,000 ms) to save API Search Grounding quota
  }

  private stopRealTimeRefresh() {
    if (this.realTimeIntervalId) {
      window.clearInterval(this.realTimeIntervalId);
      this.realTimeIntervalId = null;
    }
  }

  // Fetch real NAV prices from Finnomena via AllOrigins CORS proxy
  private async fetchFinnomenaFundNav(symbol: string): Promise<{ price: number; prevClose: number } | null> {
    const sym = symbol.toUpperCase().trim();
    try {
      const url = `https://api.finnomena.com/fund/api/v1/fund/detail/NAV?symbol=${sym}`;
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
      
      const response = await fetch(proxyUrl);
      if (!response.ok) return null;
      
      const data = await response.json();
      const rawJson = JSON.parse(data.contents);
      if (Array.isArray(rawJson) && rawJson.length > 0) {
        const latest = rawJson[rawJson.length - 1];
        const previous = rawJson.length > 1 ? rawJson[rawJson.length - 2] : latest;
        
        const price = Number(latest.nav);
        const prevClose = Number(previous.nav);
        if (!isNaN(price) && !isNaN(prevClose)) {
          return { price, prevClose };
        }
      }
      return null;
    } catch (e) {
      console.error(`Failed to fetch Finnomena NAV for ${symbol}`, e);
      return null;
    }
  }

  // Fetch real stock prices from Yahoo Finance (direct with proxy fallback)
  private async fetchYahooPrice(symbol: string): Promise<{ price: number; prevClose: number } | null> {
    let ticker = symbol.toUpperCase().trim();
    const thaiStocks = ['PTT', 'CPALL', 'AOT', 'KBANK', 'ADVANC'];
    if (thaiStocks.includes(ticker) || (!ticker.includes('.') && ticker.length <= 6 && !['AAPL', 'TSLA', 'NVDA', 'MSFT', 'GOOG', 'AMZN'].includes(ticker))) {
      ticker = `${ticker}.BK`;
    }

    // Try direct fetch first
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}`;
      const response = await fetch(url);
      if (response.ok) {
        const rawJson = await response.json();
        const result = rawJson.chart?.result?.[0];
        if (result) {
          const price = Number(result.meta.regularMarketPrice);
          const prevClose = Number(result.meta.previousClose);
          if (!isNaN(price) && !isNaN(prevClose)) {
            return { price, prevClose };
          }
        }
      }
    } catch (e) {
      console.warn(`Direct fetch to Yahoo Finance failed for ${symbol}, trying proxy...`);
    }

    // Fallback: Try AllOrigins proxy
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}`;
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
      
      const response = await fetch(proxyUrl);
      if (!response.ok) return null;
      
      const data = await response.json();
      const rawJson = JSON.parse(data.contents);
      const result = rawJson.chart?.result?.[0];
      if (result) {
        const price = Number(result.meta.regularMarketPrice);
        const prevClose = Number(result.meta.previousClose);
        if (!isNaN(price) && !isNaN(prevClose)) {
          return { price, prevClose };
        }
      }
      return null;
    } catch (e) {
      console.error(`Failed to fetch Yahoo price via proxy for ${symbol}`, e);
      return null;
    }
  }

  // Fetch prices of multiple assets using Gemini API with Google Search grounding
  private async fetchPricesViaGemini(symbols: string[]): Promise<Record<string, { price: number; prevClose: number }> | null> {
    const apiKey = this.config.geminiApiKey;
    if (!apiKey) return null;

    const model = this.config.selectedModel || 'gemini-3.1-flash-lite';
    
    // Group symbols by their asset type dynamically to help Google Search target correct endpoints
    const stockSymbols: string[] = [];
    const fundSymbols: string[] = [];
    
    symbols.forEach(sym => {
      const asset = this.marketData[sym];
      if (asset?.type === 'fund') {
        fundSymbols.push(sym);
      } else {
        stockSymbols.push(sym);
      }
    });

    const prompt = `You are a real-time financial price lookup assistant. Use Google Search to find the current stock prices (last close or regular market price) for stocks, and the latest NAV prices (Net Asset Value) for mutual funds, along with their previous day's closing/NAV prices.
The list of STOCKS to look up is: ${stockSymbols.join(', ')}. (For Thai stocks, search on the Stock Exchange of Thailand, and fimport { getCache, setCache } from "../cacheManager.js";
import fetch from "node-fetch"; // ensure fetch is available).
The list of MUTUAL FUNDS to look up is: ${fundSymbols.join(', ')}. (For Thai mutual funds, search specifically for their latest NAV prices on finnomena.com by typing e.g. "SYMBOL site:finnomena.com/fund". This is critical to get the correct NAV value, e.g. around 7.38 for KFGG-A, instead of looking up other share classes or outdated info).
Reply ONLY with a valid JSON object matching this schema: { "TICKER": { "price": number, "prevClose": number } }. 
Do not include any markdown formatting, backticks, or explanatory text - return ONLY the raw JSON string. 
Ensure keys match the input symbols exactly (e.g. if the input is K-EQD, the key in JSON must be "K-EQD", and for KFGG-A it must be "KFGG-A").`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            tools: [{ googleSearch: {} }] // Enable Google Search grounding!
          })
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Gemini API Price Fetch error status ${response.status}:`, errorText);
        localStorage.setItem('portfolio_tracker_price_fetch_error', `Gemini API Error ${response.status}: ${errorText}`);
        return null;
      }

      const data = await response.json();
      let text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      // ดึงเฉพาะส่วนที่เป็น JSON ด้วย Regex ป้องกันกรณีโมเดลใส่ข้อความอธิบายอื่นมาด้วย
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        text = jsonMatch[0];
      }
      
      const parsed = JSON.parse(text);
      localStorage.removeItem('portfolio_tracker_price_fetch_error'); // Clear error on success
      return parsed;
    } catch (e: any) {
      console.error('Failed to fetch prices via Gemini Google Search', e);
      localStorage.setItem('portfolio_tracker_price_fetch_error', `Fetch error: ${e.message || e}`);
      return null;
    }
  }

  // Method to fetch real prices from Gemini (first) or Yahoo Finance/Finnomena (second)
  private async fetchRealPrices() {
    if (this.config.useMock) return;

    // จำกัดการดึงราคาห้ามเกิน 1 ครั้งต่อ 65 วินาที เพื่อไม่ให้เกินโควต้า Google Search Grounding ของสายฟรี
    const lastFetch = localStorage.getItem('portfolio_tracker_last_fetch_time');
    const now = Date.now();
    if (lastFetch && now - Number(lastFetch) < 65000) {
      console.log('Skipping real-time price fetch to respect Gemini Search Grounding rate limit (1 request/min)');
      return;
    }
    localStorage.setItem('portfolio_tracker_last_fetch_time', now.toString());

    console.log('Fetching real-time prices...');
    
    // ดึงเฉพาะตัวย่อที่มีการถือครองอยู่จริงในพอร์ตมาอัปเดตก่อน เพื่อจำกัดขนาดคำสั่งให้ AI ไม่สับสน
    let symbols = Object.keys(this.marketData);
    const savedHoldings = localStorage.getItem('portfolio_tracker_holdings');
    if (savedHoldings) {
      try {
        const holdingsList = JSON.parse(savedHoldings);
        if (Array.isArray(holdingsList) && holdingsList.length > 0) {
          const activeSymbols = new Set<string>();
          holdingsList.forEach((h: any) => {
            if (h && h.symbol) activeSymbols.add(h.symbol.toUpperCase().trim());
          });
          if (activeSymbols.size > 0) {
            symbols = Array.from(activeSymbols);
          }
        }
      } catch (e) {
        console.error('Failed to parse holdings for active symbols filter', e);
      }
    }
    
    // Stage 1: Try fetching via Gemini API Google Search grounding
    const successfulSymbols = new Set<string>();
    
    if (this.config.geminiApiKey && !this.config.useFreePriceMode) {
      console.log('Attempting to fetch prices via Gemini Google Search...');
      const geminiData = await this.fetchPricesViaGemini(symbols);
      if (geminiData) {
        console.log('Successfully fetched prices via Gemini Google Search:', geminiData);
        let updated = false;
        symbols.forEach((symbol) => {
          const sym = symbol.toUpperCase();
          const match = geminiData[sym] || geminiData[symbol];
          
          // ป้องกันราคา 0 หรือค่าว่างที่เกิดจากข้อผิดพลาดของผลการค้นหา
          if (match && typeof match.price === 'number' && match.price > 0 && typeof match.prevClose === 'number' && match.prevClose > 0) {
            const asset = this.marketData[sym];
            const change = match.price - match.prevClose;
            const changePercent = match.prevClose > 0 ? (change / match.prevClose) * 100 : 0;
            
            this.marketData[sym] = {
              ...asset,
              price: match.price,
              prevClose: match.prevClose,
              change,
              changePercent,
              lastUpdated: new Date().toLocaleTimeString()
            };
            successfulSymbols.add(sym);
            updated = true;
          }
        });
        if (updated) {
          this.notify();
        }
      }
    }

    // Stage 2: Fallback to Yahoo Finance and Finnomena API for symbols not successfully fetched by Gemini
    const remainingSymbols = symbols.filter(sym => !successfulSymbols.has(sym.toUpperCase()));
    if (remainingSymbols.length > 0) {
      console.log(`Falling back to Yahoo/Finnomena for remaining symbols: ${remainingSymbols.join(', ')}`);
      let updated = false;
      await Promise.all(
        remainingSymbols.map(async (symbol) => {
          const sym = symbol.toUpperCase();
          const asset = this.marketData[sym];
          if (!asset) return;
          
          let data: { price: number; prevClose: number } | null = null;
          if (asset.type === 'fund') {
            data = await this.fetchFinnomenaFundNav(sym);
          } else {
            data = await this.fetchYahooPrice(sym);
          }
          
          // ป้องกันราคา 0 เช่นเดียวกัน
          if (data && data.price > 0 && data.prevClose > 0) {
            const change = data.price - data.prevClose;
            const changePercent = data.prevClose > 0 ? (change / data.prevClose) * 100 : 0;
            
            this.marketData[sym] = {
              ...asset,
              price: data.price,
              prevClose: data.prevClose,
              change,
              changePercent,
              lastUpdated: new Date().toLocaleTimeString()
            };
            updated = true;
          }
        })
      );
      
      if (updated) {
        this.notify();
      }
    }
  }

  public getAsset(symbol: string): Asset | undefined {
    return this.marketData[symbol.toUpperCase()];
  }

  public getAllAssets(): Asset[] {
    return Object.values(this.marketData);
  }

  // Allow users to add custom stocks/funds that are not in the default list
  public addCustomAsset(symbol: string, name: string, type: 'stock' | 'fund', sector: string, initialPrice: number) {
    const sym = symbol.toUpperCase();
    const prevClose = this.marketData[sym]?.prevClose || initialPrice;
    
    this.marketData[sym] = {
      symbol: sym,
      name,
      type,
      sector,
      price: initialPrice,
      prevClose,
      change: initialPrice - prevClose,
      changePercent: prevClose > 0 ? ((initialPrice - prevClose) / prevClose) * 100 : 0,
      lastUpdated: new Date().toLocaleTimeString()
    };

    // Save custom asset metadata to LocalStorage
    const savedCustoms = localStorage.getItem('portfolio_tracker_custom_assets');
    let customsList: Record<string, any> = {};
    if (savedCustoms) {
      try { customsList = JSON.parse(savedCustoms); } catch (e) {}
    }
    customsList[sym] = {
      symbol: sym,
      name,
      type,
      sector,
      price: initialPrice,
      prevClose
    };
    localStorage.setItem('portfolio_tracker_custom_assets', JSON.stringify(customsList));
    
    this.notify(sym);
    return true;
  }

  private requestTimestamps: number[] = [];
  private quotaListeners: Set<() => void> = new Set();

  public subscribeQuota(callback: () => void) {
    this.quotaListeners.add(callback);
    return () => this.quotaListeners.delete(callback);
  }

  private notifyQuota() {
    this.quotaListeners.forEach(callback => callback());
  }

  public incrementApiUsage() {
    const now = Date.now();
    this.requestTimestamps.push(now);

    const todayStr = new Date().toISOString().split('T')[0];
    const savedUsage = localStorage.getItem('portfolio_tracker_api_usage');
    let usage = { date: todayStr, count: 0 };
    if (savedUsage) {
      try {
        const parsed = JSON.parse(savedUsage);
        if (parsed.date === todayStr) {
          usage = parsed;
        }
      } catch (e) {
        console.error(e);
      }
    }
    usage.count += 1;
    localStorage.setItem('portfolio_tracker_api_usage', JSON.stringify(usage));

    this.notifyQuota();
  }

  public getApiUsage() {
    const now = Date.now();
    this.requestTimestamps = this.requestTimestamps.filter(t => now - t < 60000);
    const rpm = this.requestTimestamps.length;

    const todayStr = new Date().toISOString().split('T')[0];
    const savedUsage = localStorage.getItem('portfolio_tracker_api_usage');
    let rpd = 0;
    if (savedUsage) {
      try {
        const parsed = JSON.parse(savedUsage);
        if (parsed.date === todayStr) {
          rpd = parsed.count;
        }
      } catch (e) {
        console.error(e);
      }
    }

    const model = this.config.selectedModel || 'gemini-3.5-flash';
    const isPro = model.toLowerCase().includes('pro');
    const isPaid = this.config.billingTier === 'paid';

    const maxRpm = isPaid ? Infinity : (isPro ? 2 : 15);
    const maxRpd = isPaid ? Infinity : (isPro ? 50 : 1500);

    let modelName = model;
    if (model === 'gemini-3.5-flash') modelName = 'Gemini 3.5 Flash';
    else if (model === 'gemini-3.1-pro') modelName = 'Gemini 3.1 Pro';
    else if (model === 'gemini-3.1-flash-lite') modelName = 'Gemini 3.1 Flash-Lite';
    else modelName = model;

    return {
      rpm,
      rpd,
      maxRpm,
      maxRpd,
      modelName,
      tierName: isPaid ? 'Paid Tier (Pay-as-you-go)' : 'Free Tier (จำกัดโควต้าฟรี)',
      isPaid
    };
  }
}

export const financeApi = new FinanceApiService();
