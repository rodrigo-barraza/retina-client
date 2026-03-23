// ============================================================
// Sun Service — Tool Schemas & API Execution
// ============================================================
// Defines tool schemas for Sun ecosystem APIs and provides
// execution logic for the Console's tool-calling orchestration.
//
// Every tool has a required `fields` parameter with an enum of
// all available fields for that specific endpoint. The LLM must
// explicitly choose which fields to return on every call.
// ============================================================

import { TOOLS_API_URL } from "../../config.js";

// ────────────────────────────────────────────────────────────
// Available Fields — per-tool field enums
// ────────────────────────────────────────────────────────────
// These are programmatically derived from the API response
// shapes (fetchers + caches). Nested objects use dot-notation.
// ────────────────────────────────────────────────────────────

const FIELDS = {
  // Weather current: from WeatherCache.getCurrent() → OpenMeteo + TomorrowIO + AirQuality merged
  WEATHER_CURRENT: [
    "temperature",
    "apparentTemperature",
    "humidity",
    "weatherCode",
    "weatherDescription",
    "cloudCover",
    "precipitation",
    "rain",
    "showers",
    "snowfall",
    "windSpeed",
    "windDirection",
    "windGust",
    "pressure",
    "isDay",
    "uvIndex",
    "sunrise",
    "sunset",
    "daylightDuration",
    "usAqi",
    "europeanAqi",
    "pm25",
    "pm10",
    "ozone",
    "carbonMonoxide",
    "nitrogenDioxide",
    "dust",
  ],

  // Weather forecast: arrays of hourly/daily forecast objects
  WEATHER_FORECAST: [
    "time",
    "temperature",
    "temperatureMax",
    "temperatureMin",
    "apparentTemperature",
    "humidity",
    "precipitationProbability",
    "precipitation",
    "weatherCode",
    "cloudCover",
    "windSpeed10m",
    "windGusts10m",
    "uvIndex",
    "sunrise",
    "sunset",
  ],

  // Air quality: from WeatherCache.getAirQuality()
  AIR_QUALITY: [
    "usAqi",
    "europeanAqi",
    "pm25",
    "pm10",
    "ozone",
    "carbonMonoxide",
    "nitrogenDioxide",
    "dust",
  ],

  // Earthquakes: from EarthquakeFetcher normalized shape
  EARTHQUAKES: [
    "usgsId",
    "magnitude",
    "magnitudeType",
    "magnitudeClass",
    "place",
    "time",
    "url",
    "felt",
    "alert",
    "tsunami",
    "significance",
    "title",
    "latitude",
    "longitude",
    "depth",
  ],

  // Space weather summary: from SpaceWeatherCache.getSpaceWeatherSummary()
  SOLAR_ACTIVITY: [
    "flareCount",
    "cmeCount",
    "stormCount",
    "strongestFlare",
    "fastestCme",
    "earthDirectedCmes",
    "earthDirectedDetails",
    "lastFetch",
  ],

  // Aurora/Kp index: from KpIndexCache.getCurrentKp()
  AURORA: [
    "current",
    "classification",
    "peak24h",
    "peakClassification",
    "lastFetch",
  ],

  // Twilight: from TwilightFetcher
  TWILIGHT: [
    "sunrise",
    "sunset",
    "solarNoon",
    "dayLength",
    "civilTwilightBegin",
    "civilTwilightEnd",
    "nauticalTwilightBegin",
    "nauticalTwilightEnd",
    "astronomicalTwilightBegin",
    "astronomicalTwilightEnd",
  ],

  // Tides: from TideCache.getTides() → predictions array items
  TIDES: [
    "time",
    "height",
    "type",
    "stationId",
  ],

  // Wildfires: from WildfireFetcher
  WILDFIRES: [
    "eonetId",
    "title",
    "description",
    "status",
    "coordinates",
    "magnitudeValue",
    "magnitudeUnit",
    "date",
    "sourceUrl",
  ],

  // ISS: from IssCache.getIssData()
  ISS: [
    "position",
    "astronauts",
    "lastPositionFetch",
    "lastAstrosFetch",
  ],

  // Events: from TicketmasterFetcher normalized schema (all sources share this)
  EVENTS: [
    "name",
    "description",
    "source",
    "category",
    "startDate",
    "endDate",
    "url",
    "imageUrl",
    "status",
    "genres",
    "priceRange",
    "venue.name",
    "venue.address",
    "venue.city",
    "venue.state",
    "venue.country",
    "venue.latitude",
    "venue.longitude",
    "mapImageUrl",
  ],

  // Commodities summary: from CommodityCache.getCommoditySummary()
  COMMODITIES_SUMMARY: [
    "total",
    "gainers",
    "losers",
    "byCategory",
    "lastFetch",
  ],

  // Commodity items: from CommodityCache (individual items)
  COMMODITY: [
    "ticker",
    "name",
    "price",
    "change",
    "changePercent",
    "category",
    "unit",
    "dayHigh",
    "dayLow",
    "previousClose",
    "volume",
  ],

  // Trends: from GoogleTrendsFetcher normalized schema
  TRENDS: [
    "name",
    "normalizedName",
    "source",
    "volume",
    "url",
    "context.subreddit",
    "context.author",
    "context.commentCount",
    "context.upvoteRatio",
    "context.flair",
    "context.created",
    "context.description",
    "context.views",
    "context.stars",
    "context.forks",
    "context.language",
    "context.publisher",
    "context.publishedAt",
    "category",
    "timestamp",
  ],

  // Products: from BestBuyFetcher normalized schema
  PRODUCTS: [
    "name",
    "source",
    "category",
    "price",
    "currency",
    "rating",
    "reviewCount",
    "imageUrl",
    "productUrl",
    "description",
    "trendingScore",
    "rank",
  ],

  // Finnhub quote: from FinnhubFetcher.fetchStockQuote()
  STOCK_QUOTE: [
    "symbol",
    "c",
    "d",
    "dp",
    "h",
    "l",
    "o",
    "pc",
    "t",
    "cached",
  ],

  // Finnhub company profile: from Finnhub API /stock/profile2
  COMPANY_PROFILE: [
    "country",
    "currency",
    "exchange",
    "finnhubIndustry",
    "ipo",
    "logo",
    "marketCapitalization",
    "name",
    "phone",
    "shareOutstanding",
    "ticker",
    "weburl",
  ],

  // Market news articles: from Finnhub /news
  MARKET_NEWS: [
    "category",
    "datetime",
    "headline",
    "id",
    "image",
    "related",
    "source",
    "summary",
    "url",
  ],

  // Earnings calendar: from Finnhub /calendar/earnings
  EARNINGS: [
    "date",
    "epsActual",
    "epsEstimate",
    "hour",
    "quarter",
    "revenueActual",
    "revenueEstimate",
    "symbol",
    "year",
  ],

  // Analyst recommendations: from Finnhub /stock/recommendation
  RECOMMENDATION: [
    "buy",
    "hold",
    "period",
    "sell",
    "strongBuy",
    "strongSell",
    "symbol",
  ],

  // Basic financials: from Finnhub /stock/metric
  FINANCIALS: [
    "symbol",
    "metric",
    "series",
  ],
};

// ────────────────────────────────────────────────────────────
// Tool Definitions — JSON Schema format for AI function calling
// ────────────────────────────────────────────────────────────

/**
 * Build a fields parameter definition with available field names in the description.
 * Uses `type: "string"` (comma-separated) for broad LLM compatibility.
 * The `fields` parameter is always required.
 */
function fieldsParam(fieldEnum) {
  return {
    fields: {
      type: "string",
      description: `Comma-separated list of fields to return. Available: ${fieldEnum.join(", ")}`,
    },
  };
}

const TOOL_DEFINITIONS = [
  // ── Weather / Environment ──
  {
    name: "get_current_weather",
    description:
      "Get current weather conditions including temperature, humidity, wind, UV index, feels-like temperature, precipitation, and air quality indicators.",
    parameters: {
      type: "object",
      properties: {
        ...fieldsParam(FIELDS.WEATHER_CURRENT),
      },
      required: ["fields"],
    },
  },
  {
    name: "get_weather_forecast",
    description:
      "Get multi-day weather forecast. Each forecast entry includes temperature highs/lows, precipitation probability, wind, and conditions.",
    parameters: {
      type: "object",
      properties: {
        days: {
          type: "number",
          description: "Number of forecast days (default: 7, max: 14)",
        },
        ...fieldsParam(FIELDS.WEATHER_FORECAST),
      },
      required: ["fields"],
    },
  },
  {
    name: "get_air_quality",
    description:
      "Get current air quality data including AQI (US and European), PM2.5, PM10, ozone, and pollutant concentrations.",
    parameters: {
      type: "object",
      properties: {
        ...fieldsParam(FIELDS.AIR_QUALITY),
      },
      required: ["fields"],
    },
  },
  {
    name: "get_earthquakes",
    description:
      "Get recent earthquake data. Each earthquake includes magnitude, location, depth, time, and alert level.",
    parameters: {
      type: "object",
      properties: {
        ...fieldsParam(FIELDS.EARTHQUAKES),
      },
      required: ["fields"],
    },
  },
  {
    name: "get_solar_activity",
    description:
      "Get current solar activity summary including solar flare count, CME count, geomagnetic storm count, strongest flare, fastest CME, and Earth-directed CME details.",
    parameters: {
      type: "object",
      properties: {
        ...fieldsParam(FIELDS.SOLAR_ACTIVITY),
      },
      required: ["fields"],
    },
  },
  {
    name: "get_aurora_forecast",
    description:
      "Get aurora/northern lights forecast including current Kp index, storm classification, and 24h peak.",
    parameters: {
      type: "object",
      properties: {
        ...fieldsParam(FIELDS.AURORA),
      },
      required: ["fields"],
    },
  },
  {
    name: "get_twilight",
    description:
      "Get sunrise, sunset, solar noon, day length, and civil/nautical/astronomical twilight times for today.",
    parameters: {
      type: "object",
      properties: {
        ...fieldsParam(FIELDS.TWILIGHT),
      },
      required: ["fields"],
    },
  },
  {
    name: "get_tides",
    description:
      "Get tidal predictions including high and low tide times, heights, and type.",
    parameters: {
      type: "object",
      properties: {
        ...fieldsParam(FIELDS.TIDES),
      },
      required: ["fields"],
    },
  },
  {
    name: "get_wildfires",
    description:
      "Get active wildfire data including fire title, location coordinates, magnitude, and status (open/closed).",
    parameters: {
      type: "object",
      properties: {
        ...fieldsParam(FIELDS.WILDFIRES),
      },
      required: ["fields"],
    },
  },
  {
    name: "get_iss_position",
    description:
      "Get the current position (lat/lng) of the International Space Station and the list of astronauts currently aboard.",
    parameters: {
      type: "object",
      properties: {
        ...fieldsParam(FIELDS.ISS),
      },
      required: ["fields"],
    },
  },

  // ── Events ──
  {
    name: "search_events",
    description:
      "Search for local events including concerts, sports games, festivals, community gatherings, and movie releases. Can filter by source, category, and text search.",
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
            "Filter by event source (e.g. ticketmaster, seatgeek, craigslist, ubc, sfu, city_of_vancouver, nhl, whitecaps, bc_lions, tmdb, google_places)",
        },
        category: {
          type: "string",
          description:
            "Filter by event category (music, sports, arts, comedy, family, film, food, tech, other)",
        },
        limit: {
          type: "number",
          description: "Maximum number of events to return (default: 20)",
        },
        ...fieldsParam(FIELDS.EVENTS),
      },
      required: ["fields"],
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
        ...fieldsParam(FIELDS.EVENTS),
      },
      required: ["fields"],
    },
  },

  // ── Commodities / Markets ──
  {
    name: "get_commodities_summary",
    description:
      "Get a summary of all commodity/market prices including top gainers, top losers, and breakdown by category. Each item shows ticker, name, price, change, and percent change.",
    parameters: {
      type: "object",
      properties: {
        ...fieldsParam(FIELDS.COMMODITIES_SUMMARY),
      },
      required: ["fields"],
    },
  },
  {
    name: "get_commodity_by_category",
    description:
      "Get commodity prices filtered by category. Returns an array of commodities with ticker, name, price, change, and percent change.",
    parameters: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description:
            "Commodity category: energy, precious_metals, industrial_metals, agriculture, softs, livestock, lumber, index_futures, indices, bonds, forex, crypto, volatility",
          enum: [
            "energy",
            "precious_metals",
            "industrial_metals",
            "agriculture",
            "softs",
            "livestock",
            "lumber",
            "index_futures",
            "indices",
            "bonds",
            "forex",
            "crypto",
            "volatility",
          ],
        },
        ...fieldsParam(FIELDS.COMMODITY),
      },
      required: ["category", "fields"],
    },
  },
  {
    name: "get_commodity_ticker",
    description:
      "Get detailed data for a specific commodity/market ticker symbol.",
    parameters: {
      type: "object",
      properties: {
        ticker: {
          type: "string",
          description:
            "Ticker symbol (e.g. CL=F for crude oil, GC=F for gold, SI=F for silver, BTC-USD for Bitcoin, ^GSPC for S&P 500)",
        },
        ...fieldsParam(FIELDS.COMMODITY),
      },
      required: ["ticker", "fields"],
    },
  },

  // ── Trends ──
  {
    name: "get_trends",
    description:
      "Get currently trending topics aggregated from multiple sources including Google Trends, Reddit, Wikipedia, Hacker News, X (Twitter), Bluesky, Mastodon, and news.",
    parameters: {
      type: "object",
      properties: {
        source: {
          type: "string",
          description:
            "Filter by trend source: google_trends, reddit, wikipedia, hackernews, x, mastodon, bluesky, google_news, producthunt, tv, github",
        },
        ...fieldsParam(FIELDS.TRENDS),
      },
      required: ["fields"],
    },
  },

  // ── Products ──
  {
    name: "search_products",
    description:
      "Search for products with pricing, ratings, and deal information from Best Buy, Amazon, eBay, Etsy, and Product Hunt.",
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
        ...fieldsParam(FIELDS.PRODUCTS),
      },
      required: ["fields"],
    },
  },

  // ── Finance / Stocks (Finnhub) ──
  {
    name: "get_stock_quote",
    description:
      "Get real-time stock quote. Fields: c=current price, d=change, dp=percent change, h=day high, l=day low, o=open, pc=previous close, t=timestamp.",
    parameters: {
      type: "object",
      properties: {
        symbol: {
          type: "string",
          description: "Stock ticker symbol (e.g. AAPL, MSFT, GOOGL)",
        },
        ...fieldsParam(FIELDS.STOCK_QUOTE),
      },
      required: ["symbol", "fields"],
    },
  },
  {
    name: "get_company_profile",
    description:
      "Get company profile including name, industry, market capitalization, shares outstanding, logo, and website.",
    parameters: {
      type: "object",
      properties: {
        symbol: {
          type: "string",
          description: "Stock ticker symbol (e.g. AAPL)",
        },
        ...fieldsParam(FIELDS.COMPANY_PROFILE),
      },
      required: ["symbol", "fields"],
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
        ...fieldsParam(FIELDS.MARKET_NEWS),
      },
      required: ["fields"],
    },
  },
  {
    name: "get_earnings_calendar",
    description:
      "Get upcoming earnings calendar showing which companies are reporting earnings, with estimated and actual EPS and revenue.",
    parameters: {
      type: "object",
      properties: {
        ...fieldsParam(FIELDS.EARNINGS),
      },
      required: ["fields"],
    },
  },
  {
    name: "get_stock_recommendation",
    description:
      "Get analyst recommendation trends for a stock, including buy/hold/sell/strongBuy/strongSell counts per period.",
    parameters: {
      type: "object",
      properties: {
        symbol: {
          type: "string",
          description: "Stock ticker symbol (e.g. AAPL)",
        },
        ...fieldsParam(FIELDS.RECOMMENDATION),
      },
      required: ["symbol", "fields"],
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
        ...fieldsParam(FIELDS.FINANCIALS),
      },
      required: ["symbol", "fields"],
    },
  },
];

// ────────────────────────────────────────────────────────────
// URL Builder — DRY helper for appending query params
// ────────────────────────────────────────────────────────────

/**
 * Build a URL from a base path, appending any non-empty args as query params.
 * Always passes `fields` through when present (joins array to comma-separated string).
 *
 * @param {string} path - Base URL path
 * @param {object} [queryArgs] - Key-value pairs to append as query params
 * @param {object} [allArgs] - Full args object (to pull `fields` from)
 * @returns {string} Complete URL with query string
 */
function buildUrl(path, queryArgs = {}, allArgs = {}) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(queryArgs)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, value);
    }
  }

  // Always forward fields if present (handles both string and array)
  if (allArgs.fields) {
    const fieldsStr = Array.isArray(allArgs.fields)
      ? allArgs.fields.join(",")
      : allArgs.fields;
    params.set("fields", fieldsStr);
  }

  const qs = params.toString();
  return `${TOOLS_API_URL}${path}${qs ? `?${qs}` : ""}`;
}

// ────────────────────────────────────────────────────────────
// Execution — maps tool names to Sun API calls
// ────────────────────────────────────────────────────────────

const TOOL_EXECUTORS = {
  // ── Weather / Environment ──
  get_current_weather: async (args) =>
    fetchJson(buildUrl("/weather/weather/current", {}, args)),

  get_weather_forecast: async (args) =>
    fetchJson(buildUrl("/weather/weather/forecast", { days: args.days }, args)),

  get_air_quality: async (args) =>
    fetchJson(buildUrl("/weather/weather/air", {}, args)),

  get_earthquakes: async (args) =>
    fetchJson(buildUrl("/weather/earthquakes", {}, args)),

  get_solar_activity: async (args) =>
    fetchJson(buildUrl("/weather/space-weather/summary", {}, args)),

  get_aurora_forecast: async (args) =>
    fetchJson(buildUrl("/weather/kp/current", {}, args)),

  get_twilight: async (args) =>
    fetchJson(buildUrl("/weather/twilight", {}, args)),

  get_tides: async (args) =>
    fetchJson(buildUrl("/weather/tides", {}, args)),

  get_wildfires: async (args) =>
    fetchJson(buildUrl("/weather/wildfires", {}, args)),

  get_iss_position: async (args) =>
    fetchJson(buildUrl("/weather/iss", {}, args)),

  // ── Events ──
  search_events: async (args) =>
    fetchJson(
      buildUrl(
        "/event/search",
        {
          q: args.query,
          source: args.source,
          category: args.category,
          limit: args.limit,
        },
        args,
      ),
    ),

  get_upcoming_events: async (args) =>
    fetchJson(
      buildUrl("/event/upcoming", { days: args.days, limit: args.limit }, args),
    ),

  // ── Commodities / Markets ──
  get_commodities_summary: async (args) =>
    fetchJson(buildUrl("/market/commodities/summary", {}, args)),

  get_commodity_by_category: async (args) =>
    fetchJson(
      buildUrl(`/market/commodities/category/${args.category}`, {}, args),
    ),

  get_commodity_ticker: async (args) =>
    fetchJson(
      buildUrl(
        `/market/commodities/ticker/${encodeURIComponent(args.ticker)}`,
        {},
        args,
      ),
    ),

  // ── Trends ──
  get_trends: async (args) => {
    if (args.source) {
      return fetchJson(
        buildUrl(`/trend/trends/source/${args.source}`, {}, args),
      );
    }
    return fetchJson(buildUrl("/trend/trends", {}, args));
  },

  // ── Products ──
  search_products: async (args) =>
    fetchJson(
      buildUrl(
        "/product/products/search",
        { q: args.query, category: args.category, limit: args.limit },
        args,
      ),
    ),

  // ── Finance / Stocks (Finnhub) ──
  get_stock_quote: async (args) =>
    fetchJson(
      buildUrl(
        `/finance/quote/${encodeURIComponent(args.symbol)}`,
        {},
        args,
      ),
    ),

  get_company_profile: async (args) =>
    fetchJson(
      buildUrl(
        `/finance/profile/${encodeURIComponent(args.symbol)}`,
        {},
        args,
      ),
    ),

  get_market_news: async (args) =>
    fetchJson(
      buildUrl("/finance/news", { symbol: args.symbol }, args),
    ),

  get_earnings_calendar: async (args) =>
    fetchJson(buildUrl("/finance/earnings", {}, args)),

  get_stock_recommendation: async (args) =>
    fetchJson(
      buildUrl(
        `/finance/recommendation/${encodeURIComponent(args.symbol)}`,
        {},
        args,
      ),
    ),

  get_stock_financials: async (args) =>
    fetchJson(
      buildUrl(
        `/finance/financials/${encodeURIComponent(args.symbol)}`,
        {},
        args,
      ),
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
   * Get available fields for a specific tool (useful for UI/debugging).
   * @param {string} toolName - Tool name
   * @returns {string[]|null} Available field names or null
   */
  static getToolFields(toolName) {
    const tool = TOOL_DEFINITIONS.find((t) => t.name === toolName);
    if (!tool) return null;
    return tool.parameters?.properties?.fields?.items?.enum || null;
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
