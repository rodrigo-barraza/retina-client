// ============================================================
// Sun Service — Tool Schemas & API Execution
// ============================================================
// Defines tool schemas for Sun ecosystem APIs and provides
// execution logic for the Console's tool-calling orchestration.
// ============================================================

import { TOOLS_API_URL } from "../../config.js";

// ────────────────────────────────────────────────────────────
// Tool Definitions — JSON Schema format for AI function calling
// ────────────────────────────────────────────────────────────

const TOOL_DEFINITIONS = [
  // ── Weather / Environment (Nimbus) ──
  {
    name: "get_current_weather",
    description:
      "Get current weather conditions including temperature, humidity, wind, UV index, feels-like temperature, and precipitation. Returns real-time weather data.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "get_weather_forecast",
    description:
      "Get multi-day weather forecast including daily high/low temperatures, precipitation probability, and conditions.",
    parameters: {
      type: "object",
      properties: {
        days: {
          type: "number",
          description: "Number of forecast days (default: 7, max: 14)",
        },
      },
      required: [],
    },
  },
  {
    name: "get_air_quality",
    description:
      "Get current air quality data including AQI, PM2.5, PM10, pollen levels, and pollutant concentrations.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "get_earthquakes",
    description:
      "Get recent earthquake data including magnitude, location, depth, and time.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "get_solar_activity",
    description:
      "Get current solar activity data including solar flares, coronal mass ejections, geomagnetic storms, and solar wind.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "get_aurora_forecast",
    description:
      "Get aurora/northern lights forecast including Kp index and visibility predictions.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "get_twilight",
    description: "Get sunrise, sunset, and twilight times for today.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "get_tides",
    description:
      "Get tidal predictions including high and low tide times and heights.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "get_wildfires",
    description:
      "Get active wildfire data including fire locations, size, and containment status.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "get_iss_position",
    description:
      "Get the current position of the International Space Station and crew information.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },

  // ── Events (Beacon) ──
  {
    name: "search_events",
    description:
      "Search for local events including concerts, sports games, festivals, community gatherings, and movie releases. Can filter by source, category, date range, and text search.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Text search query for event names or descriptions",
        },
        source: {
          type: "string",
          description:
            "Filter by event source (e.g. ticketmaster, stubhub, craigslist, eventbrite, meetup, university, city, movies)",
        },
        category: {
          type: "string",
          description:
            "Filter by event category (e.g. music, sports, arts, family, food, community, film)",
        },
        limit: {
          type: "number",
          description: "Maximum number of events to return (default: 20)",
        },
        startDate: {
          type: "string",
          description: "Filter events starting from this ISO date string",
        },
        endDate: {
          type: "string",
          description: "Filter events up to this ISO date string",
        },
      },
      required: [],
    },
  },
  {
    name: "get_upcoming_events",
    description:
      "Get upcoming events in chronological order. Good for 'what's happening this weekend' type questions.",
    parameters: {
      type: "object",
      properties: {
        days: {
          type: "number",
          description: "Number of days ahead to look (default: 7)",
        },
        limit: {
          type: "number",
          description: "Maximum number of events to return (default: 20)",
        },
      },
      required: [],
    },
  },

  // ── Commodities / Markets ──
  {
    name: "get_commodities_summary",
    description:
      "Get a summary of all commodity futures prices including energy, metals, agriculture, and livestock. Shows current price, daily change, and percentage change.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "get_commodity_by_category",
    description: "Get commodity prices filtered by category.",
    parameters: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description:
            "Commodity category: energy, metals, agriculture, livestock, softs, or grains",
          enum: [
            "energy",
            "metals",
            "agriculture",
            "livestock",
            "softs",
            "grains",
          ],
        },
      },
      required: ["category"],
    },
  },
  {
    name: "get_commodity_ticker",
    description:
      "Get detailed data for a specific commodity ticker symbol including current price, historical data, and changes.",
    parameters: {
      type: "object",
      properties: {
        ticker: {
          type: "string",
          description:
            "The commodity ticker symbol (e.g. CL=F for crude oil, GC=F for gold, SI=F for silver, NG=F for natural gas)",
        },
      },
      required: ["ticker"],
    },
  },

  // ── Trends ──
  {
    name: "get_trends",
    description:
      "Get currently trending topics aggregated from multiple sources including Google Trends, Reddit, Wikipedia, Hacker News, and X (Twitter).",
    parameters: {
      type: "object",
      properties: {
        source: {
          type: "string",
          description:
            "Filter by trend source: google, reddit, wikipedia, hackernews, x, mastodon, news",
        },
      },
      required: [],
    },
  },

  // ── Products ──
  {
    name: "search_products",
    description:
      "Search for products with pricing and deal information. Returns product names, prices, ratings, and availability.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Product search query",
        },
        category: {
          type: "string",
          description: "Product category filter",
        },
        limit: {
          type: "number",
          description: "Maximum number of products to return (default: 20)",
        },
      },
      required: [],
    },
  },

  // ── Finance / Stocks (Finnhub) ──
  {
    name: "get_stock_quote",
    description:
      "Get real-time stock quote for one or more symbols. Returns current price, daily change, percent change, day high/low, open, and previous close.",
    parameters: {
      type: "object",
      properties: {
        symbol: {
          type: "string",
          description:
            "Stock ticker symbol (e.g. AAPL, MSFT, GOOGL). For a single stock lookup.",
        },
      },
      required: ["symbol"],
    },
  },
  {
    name: "get_company_profile",
    description:
      "Get company profile information including name, industry, sector, market capitalization, outstanding shares, logo URL, and website.",
    parameters: {
      type: "object",
      properties: {
        symbol: {
          type: "string",
          description: "Stock ticker symbol (e.g. AAPL)",
        },
      },
      required: ["symbol"],
    },
  },
  {
    name: "get_market_news",
    description:
      "Get latest market news articles. Can optionally filter by company symbol for company-specific news.",
    parameters: {
      type: "object",
      properties: {
        symbol: {
          type: "string",
          description:
            "Optional stock symbol to get company-specific news instead of general market news",
        },
      },
      required: [],
    },
  },
  {
    name: "get_earnings_calendar",
    description:
      "Get upcoming earnings calendar showing which companies are reporting earnings in the next 2 weeks, with estimated and actual EPS.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "get_stock_recommendation",
    description:
      "Get analyst recommendation trends for a stock, including buy/sell/hold counts and period-over-period changes.",
    parameters: {
      type: "object",
      properties: {
        symbol: {
          type: "string",
          description: "Stock ticker symbol (e.g. AAPL)",
        },
      },
      required: ["symbol"],
    },
  },
  {
    name: "get_stock_financials",
    description:
      "Get basic financial metrics for a stock including P/E ratio, EPS, 52-week high/low, beta, dividend yield, market cap, revenue, and profit margins.",
    parameters: {
      type: "object",
      properties: {
        symbol: {
          type: "string",
          description: "Stock ticker symbol (e.g. AAPL)",
        },
      },
      required: ["symbol"],
    },
  },
];

// ────────────────────────────────────────────────────────────
// Execution — maps tool names to Sun API calls
// ────────────────────────────────────────────────────────────

const TOOL_EXECUTORS = {
  // ── Weather / Environment ──
  get_current_weather: async () =>
    fetchJson(`${TOOLS_API_URL}/weather/weather/current`),

  get_weather_forecast: async (args) => {
    const days = args.days || 7;
    return fetchJson(`${TOOLS_API_URL}/weather/weather/forecast?days=${days}`);
  },

  get_air_quality: async () =>
    fetchJson(`${TOOLS_API_URL}/weather/weather/air`),

  get_earthquakes: async () =>
    fetchJson(`${TOOLS_API_URL}/weather/earthquakes`),

  get_solar_activity: async () =>
    fetchJson(`${TOOLS_API_URL}/weather/space-weather/summary`),

  get_aurora_forecast: async () =>
    fetchJson(`${TOOLS_API_URL}/weather/kp/current`),

  get_twilight: async () => fetchJson(`${TOOLS_API_URL}/weather/twilight`),

  get_tides: async () => fetchJson(`${TOOLS_API_URL}/weather/tides`),

  get_wildfires: async () => fetchJson(`${TOOLS_API_URL}/weather/wildfires`),

  get_iss_position: async () => fetchJson(`${TOOLS_API_URL}/weather/iss`),

  // ── Events ──
  search_events: async (args) => {
    const params = new URLSearchParams();
    if (args.query) params.set("query", args.query);
    if (args.source) params.set("source", args.source);
    if (args.category) params.set("category", args.category);
    if (args.limit) params.set("limit", args.limit);
    if (args.startDate) params.set("startDate", args.startDate);
    if (args.endDate) params.set("endDate", args.endDate);
    const qs = params.toString();
    return fetchJson(
      `${TOOLS_API_URL}/event/search${qs ? `?${qs}` : ""}`,
    );
  },

  get_upcoming_events: async (args) => {
    const params = new URLSearchParams();
    if (args.days) params.set("days", args.days);
    if (args.limit) params.set("limit", args.limit);
    const qs = params.toString();
    return fetchJson(
      `${TOOLS_API_URL}/event/upcoming${qs ? `?${qs}` : ""}`,
    );
  },

  // ── Commodities / Markets ──
  get_commodities_summary: async () =>
    fetchJson(`${TOOLS_API_URL}/market/commodities/summary`),

  get_commodity_by_category: async (args) =>
    fetchJson(
      `${TOOLS_API_URL}/market/commodities/category/${args.category}`,
    ),

  get_commodity_ticker: async (args) =>
    fetchJson(
      `${TOOLS_API_URL}/market/commodities/ticker/${encodeURIComponent(args.ticker)}`,
    ),

  // ── Trends ──
  get_trends: async (args) => {
    if (args.source) {
      return fetchJson(
        `${TOOLS_API_URL}/trend/trends/source/${args.source}`,
      );
    }
    return fetchJson(`${TOOLS_API_URL}/trend/trends`);
  },

  // ── Products ──
  search_products: async (args) => {
    const params = new URLSearchParams();
    if (args.query) params.set("q", args.query);
    if (args.category) params.set("category", args.category);
    if (args.limit) params.set("limit", args.limit);
    const qs = params.toString();
    return fetchJson(
      `${TOOLS_API_URL}/product/products/search${qs ? `?${qs}` : ""}`,
    );
  },

  // ── Finance / Stocks (Finnhub) ──
  get_stock_quote: async (args) =>
    fetchJson(
      `${TOOLS_API_URL}/finance/quote/${encodeURIComponent(args.symbol)}`,
    ),

  get_company_profile: async (args) =>
    fetchJson(
      `${TOOLS_API_URL}/finance/profile/${encodeURIComponent(args.symbol)}`,
    ),

  get_market_news: async (args) => {
    const params = new URLSearchParams();
    if (args.symbol) params.set("symbol", args.symbol);
    const qs = params.toString();
    return fetchJson(
      `${TOOLS_API_URL}/finance/news${qs ? `?${qs}` : ""}`,
    );
  },

  get_earnings_calendar: async () =>
    fetchJson(`${TOOLS_API_URL}/finance/earnings`),

  get_stock_recommendation: async (args) =>
    fetchJson(
      `${TOOLS_API_URL}/finance/recommendation/${encodeURIComponent(args.symbol)}`,
    ),

  get_stock_financials: async (args) =>
    fetchJson(
      `${TOOLS_API_URL}/finance/financials/${encodeURIComponent(args.symbol)}`,
    ),
};

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

async function fetchJson(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      return { error: `API returned ${res.status}: ${res.statusText}` };
    }
    return await res.json();
  } catch (err) {
    return { error: `Failed to reach API: ${err.message}` };
  }
}

// ────────────────────────────────────────────────────────────
// Tool → API mapping (for health checks)
// ────────────────────────────────────────────────────────────

const TOOL_API_MAP = {
  get_current_weather: TOOLS_API_URL,
  get_weather_forecast: TOOLS_API_URL,
  get_air_quality: TOOLS_API_URL,
  get_earthquakes: TOOLS_API_URL,
  get_solar_activity: TOOLS_API_URL,
  get_aurora_forecast: TOOLS_API_URL,
  get_twilight: TOOLS_API_URL,
  get_tides: TOOLS_API_URL,
  get_wildfires: TOOLS_API_URL,
  get_iss_position: TOOLS_API_URL,
  search_events: TOOLS_API_URL,
  get_upcoming_events: TOOLS_API_URL,
  get_commodities_summary: TOOLS_API_URL,
  get_commodity_by_category: TOOLS_API_URL,
  get_commodity_ticker: TOOLS_API_URL,
  get_trends: TOOLS_API_URL,
  search_products: TOOLS_API_URL,
  get_stock_quote: TOOLS_API_URL,
  get_company_profile: TOOLS_API_URL,
  get_market_news: TOOLS_API_URL,
  get_earnings_calendar: TOOLS_API_URL,
  get_stock_recommendation: TOOLS_API_URL,
  get_stock_financials: TOOLS_API_URL,
};

// ────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────

export default class SunService {
  /**
   * Get all tool schemas for passing to Prism.
   * @returns {Array} Tool definition objects
   */
  static getToolSchemas() {
    return TOOL_DEFINITIONS;
  }

  /**
   * Check which APIs are online by hitting their health endpoints.
   * Returns a Set of tool names whose backing API is offline.
   * @returns {Promise<{ offline: Set<string>, apiStatus: Record<string, boolean> }>}
   */
  static async checkApiHealth() {
    const uniqueApis = [...new Set(Object.values(TOOL_API_MAP))];

    const statuses = await Promise.all(
      uniqueApis.map(async (baseUrl) => {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 3000);
          const res = await fetch(`${baseUrl}/health`, {
            signal: controller.signal,
          });
          clearTimeout(timeout);
          return { url: baseUrl, online: res.ok };
        } catch {
          return { url: baseUrl, online: false };
        }
      }),
    );

    const apiStatus = {};
    for (const s of statuses) {
      apiStatus[s.url] = s.online;
    }

    const offline = new Set();
    for (const [toolName, apiUrl] of Object.entries(TOOL_API_MAP)) {
      if (!apiStatus[apiUrl]) {
        offline.add(toolName);
      }
    }

    return { offline, apiStatus };
  }

  /**
   * Execute a tool call by name with given arguments.
   * @param {string} name - Tool function name
   * @param {object} args - Arguments for the tool
   * @returns {Promise<object>} Tool execution result
   */
  static async executeTool(name, args = {}) {
    const executor = TOOL_EXECUTORS[name];
    if (!executor) {
      return { error: `Unknown tool: ${name}` };
    }
    return executor(args);
  }

  /**
   * Execute multiple tool calls in parallel.
   * @param {Array<{ name: string, args: object }>} toolCalls
   * @returns {Promise<Array<{ name: string, result: object }>>}
   */
  static async executeToolCalls(toolCalls) {
    return Promise.all(
      toolCalls.map(async (tc) => ({
        name: tc.name,
        id: tc.id,
        result: await SunService.executeTool(tc.name, tc.args),
      })),
    );
  }

  /**
   * Execute a custom user-defined tool by calling its configured endpoint.
   * @param {object} toolDef - { endpoint, method, parameters, name }
   * @param {object} args - Arguments from the AI
   * @returns {Promise<object>} JSON result
   */
  static async executeCustomTool(toolDef, args = {}) {
    try {
      const headers = { "Content-Type": "application/json" };
      if (toolDef.bearerToken) {
        headers["Authorization"] = `Bearer ${toolDef.bearerToken}`;
      }

      if (toolDef.method === "POST") {
        const res = await fetch(toolDef.endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify(args),
        });
        if (!res.ok) {
          return { error: `API returned ${res.status}: ${res.statusText}` };
        }
        return await res.json();
      }

      // GET — append args as query params
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(args)) {
        if (value !== undefined && value !== null && value !== "") {
          params.set(key, value);
        }
      }
      const qs = params.toString();
      const url = `${toolDef.endpoint}${qs ? `?${qs}` : ""}`;
      const res = await fetch(url, { headers });
      if (!res.ok) {
        return { error: `API returned ${res.status}: ${res.statusText}` };
      }
      return await res.json();
    } catch (err) {
      return { error: `Failed to reach API: ${err.message}` };
    }
  }
}
