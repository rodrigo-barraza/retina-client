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
    "strongestFlare.flrId",
    "strongestFlare.beginTime",
    "strongestFlare.peakTime",
    "strongestFlare.classType",
    "strongestFlare.sourceLocation",
    "fastestCme.activityId",
    "fastestCme.startTime",
    "fastestCme.speed",
    "fastestCme.type",
    "fastestCme.isEarthDirected",
    "fastestCme.estimatedArrival",
    "earthDirectedCmes",
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
  TIDES: ["time", "height", "type", "stationId"],

  // Wildfires: from WildfireFetcher
  WILDFIRES: [
    "eonetId",
    "title",
    "description",
    "status",
    "coordinates.lat",
    "coordinates.lng",
    "magnitudeValue",
    "magnitudeUnit",
    "date",
    "sourceUrl",
  ],

  // ISS: from IssCache.getIssData()
  ISS: [
    "position.latitude",
    "position.longitude",
    "position.timestamp",
    "astronauts.total",
    "astronauts.people",
    "lastPositionFetch",
    "lastAstrosFetch",
  ],

  // NEO: from NeoCache.getNeoSummary()
  NEO: [
    "total",
    "hazardousCount",
    "closest.name",
    "closest.missDistanceKm",
    "closest.missDistanceLunar",
    "closest.isPotentiallyHazardous",
    "closest.estimatedDiameterMaxKm",
    "closest.relativeVelocityKmPerSec",
    "largest.name",
    "largest.estimatedDiameterMaxKm",
    "lastFetch",
  ],

  // Solar Wind: from SolarWindCache.getSolarWindLatest()
  SOLAR_WIND: [
    "time",
    "speed",
    "density",
    "temperature",
    "bz",
    "bt",
    "bx",
    "by",
    "lastFetch",
  ],

  // Pollen: from PollenCache.getPollenToday()
  POLLEN: [
    "date",
    "grass.displayName",
    "grass.indexInfo.value",
    "grass.indexInfo.category",
    "grass.inSeason",
    "tree.displayName",
    "tree.indexInfo.value",
    "tree.indexInfo.category",
    "tree.inSeason",
    "weed.displayName",
    "weed.indexInfo.value",
    "weed.indexInfo.category",
    "weed.inSeason",
    "regionCode",
    "lastFetch",
  ],

  // APOD: from ApodCache.getApod()
  APOD: [
    "title",
    "explanation",
    "date",
    "url",
    "hdUrl",
    "mediaType",
    "copyright",
    "lastFetch",
  ],

  // Launches: from LaunchCache.getLaunchSummary()
  LAUNCHES: [
    "count",
    "upcomingCount",
    "next.name",
    "next.status",
    "next.net",
    "next.provider",
    "next.rocket",
    "next.mission",
    "next.missionType",
    "next.missionDescription",
    "next.padName",
    "next.padLocation",
    "next.imageUrl",
    "providers",
    "lastFetch",
  ],

  // Weather Warnings: from EnvironmentCanadaCache.getWarnings()
  WEATHER_WARNINGS: [
    "count",
    "warnings",
    "lastFetch",
  ],

  // Avalanche: from AvalancheCache.getAvalanche()
  AVALANCHE: [
    "count",
    "forecasts",
    "lastFetch",
  ],

  // Google Air Quality: from GoogleAirQualityCache.getGoogleAirQuality()
  GOOGLE_AIR_QUALITY: [
    "universalAqi",
    "universalAqiCategory",
    "universalAqiDominantPollutant",
    "usEpaAqi",
    "usEpaCategory",
    "usEpaDominantPollutant",
    "pollutants",
    "healthRecommendations",
    "regionCode",
    "lastFetch",
  ],

  // Event Summary: from EventCache.getEventSummary()
  EVENT_SUMMARY: [
    "total",
    "today",
    "upcoming",
    "byCategory",
    "bySource",
    "lastFetch",
  ],

  // Product Availability: from BestBuyCAAvailabilityCache
  PRODUCT_AVAILABILITY: [
    "count",
    "lastCheck",
    "inStockCount",
    "results",
  ],

  // Commodity History: from CommoditySnapshot model
  COMMODITY_HISTORY: [
    "ticker",
    "hours",
    "count",
    "snapshots",
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
    "priceRange.min",
    "priceRange.max",
    "priceRange.currency",
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
  STOCK_QUOTE: ["symbol", "c", "d", "dp", "h", "l", "o", "pc", "t", "cached"],

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
    "metric.52WeekHigh",
    "metric.52WeekLow",
    "metric.beta",
    "metric.peAnnual",
    "metric.peNTM",
    "metric.epsAnnual",
    "metric.epsGrowthTTMYoy",
    "metric.dividendYieldIndicatedAnnual",
    "metric.marketCapitalization",
    "metric.revenuePerShareAnnual",
    "metric.roaRfy",
    "metric.roeRfy",
    "metric.currentRatioAnnual",
    "metric.debtEquityAnnual",
    "metric.10DayAverageTradingVolume",
    "metric.3MonthAverageTradingVolume",
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
  {
    name: "get_near_earth_objects",
    description:
      "Get today's near-Earth objects (asteroids) summary including total count, hazardous count, closest approach, and largest object.",
    parameters: {
      type: "object",
      properties: {
        ...fieldsParam(FIELDS.NEO),
      },
      required: ["fields"],
    },
  },
  {
    name: "get_solar_wind",
    description:
      "Get latest solar wind conditions including plasma speed, density, temperature, and interplanetary magnetic field (Bz, Bt). Important for aurora and space weather assessment.",
    parameters: {
      type: "object",
      properties: {
        ...fieldsParam(FIELDS.SOLAR_WIND),
      },
      required: ["fields"],
    },
  },
  {
    name: "get_pollen",
    description:
      "Get today's pollen forecast including grass, tree, and weed pollen index values, categories, and whether each type is in season.",
    parameters: {
      type: "object",
      properties: {
        ...fieldsParam(FIELDS.POLLEN),
      },
      required: ["fields"],
    },
  },
  {
    name: "get_apod",
    description:
      "Get NASA's Astronomy Picture of the Day including title, explanation, image URL, and copyright information.",
    parameters: {
      type: "object",
      properties: {
        ...fieldsParam(FIELDS.APOD),
      },
      required: ["fields"],
    },
  },
  {
    name: "get_launches",
    description:
      "Get upcoming rocket launch summary including next launch details, provider, rocket, mission, pad location, and launch window.",
    parameters: {
      type: "object",
      properties: {
        ...fieldsParam(FIELDS.LAUNCHES),
      },
      required: ["fields"],
    },
  },
  {
    name: "get_weather_warnings",
    description:
      "Get active Environment Canada weather warnings, watches, advisories, and special weather statements for Metro Vancouver.",
    parameters: {
      type: "object",
      properties: {
        ...fieldsParam(FIELDS.WEATHER_WARNINGS),
      },
      required: ["fields"],
    },
  },
  {
    name: "get_avalanche_forecast",
    description:
      "Get Avalanche Canada forecast for BC regions including danger ratings (alpine/treeline/below treeline), problems, and highlights.",
    parameters: {
      type: "object",
      properties: {
        ...fieldsParam(FIELDS.AVALANCHE),
      },
      required: ["fields"],
    },
  },
  {
    name: "get_google_air_quality",
    description:
      "Get detailed air quality from Google's Air Quality API including universal AQI, US EPA AQI, dominant pollutant, pollutant concentrations, and health recommendations.",
    parameters: {
      type: "object",
      properties: {
        ...fieldsParam(FIELDS.GOOGLE_AIR_QUALITY),
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
  {
    name: "get_events_today",
    description:
      "Get all events happening today. Returns events with venue, category, and timing information.",
    parameters: {
      type: "object",
      properties: {
        ...fieldsParam(FIELDS.EVENTS),
      },
      required: ["fields"],
    },
  },
  {
    name: "get_event_summary",
    description:
      "Get a statistical summary of all cached events: total count, today's count, upcoming count, breakdown by category and source.",
    parameters: {
      type: "object",
      properties: {
        ...fieldsParam(FIELDS.EVENT_SUMMARY),
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
  {
    name: "get_hot_trends",
    description:
      "Get cross-platform correlated trending topics — topics appearing in 2+ sources simultaneously. Shows which topics are truly viral across Google, Reddit, X, news, etc.",
    parameters: {
      type: "object",
      properties: {
        ...fieldsParam(FIELDS.TRENDS),
      },
      required: ["fields"],
    },
  },
  {
    name: "get_top_trends",
    description:
      "Get the highest-volume trending topics from the database over a configurable time window. Aggregated across all sources.",
    parameters: {
      type: "object",
      properties: {
        hours: {
          type: "number",
          description: "Time window in hours (default: 24)",
        },
        limit: {
          type: "number",
          description: "Maximum number of trends to return (default: 20)",
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
  {
    name: "get_trending_products",
    description:
      "Get currently trending products ranked by trending score. Shows top deals and popular items.",
    parameters: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of products to return (default: 50)",
        },
        ...fieldsParam(FIELDS.PRODUCTS),
      },
      required: ["fields"],
    },
  },
  {
    name: "get_product_availability",
    description:
      "Get Best Buy Canada product availability for all monitored watchlist items. Shows in-stock/out-of-stock status.",
    parameters: {
      type: "object",
      properties: {
        ...fieldsParam(FIELDS.PRODUCT_AVAILABILITY),
      },
      required: ["fields"],
    },
  },
  {
    name: "check_product_availability",
    description:
      "Check Best Buy Canada availability for specific SKUs on demand. Useful for checking arbitrary products not on the watchlist.",
    parameters: {
      type: "object",
      properties: {
        skus: {
          type: "string",
          description: "Comma-separated list of Best Buy SKU numbers to check",
        },
        ...fieldsParam(FIELDS.PRODUCT_AVAILABILITY),
      },
      required: ["skus", "fields"],
    },
  },

  // ── Market ──
  {
    name: "get_commodity_categories",
    description:
      "Get a list of all available commodity categories (energy, precious_metals, crypto, forex, etc.).",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_commodity_history",
    description:
      "Get price history snapshots for a specific commodity ticker over a time window.",
    parameters: {
      type: "object",
      properties: {
        ticker: {
          type: "string",
          description: "Ticker symbol (e.g. GC=F for gold, BTC-USD for Bitcoin)",
        },
        hours: {
          type: "number",
          description: "Time window in hours (default: 24)",
        },
        ...fieldsParam(FIELDS.COMMODITY_HISTORY),
      },
      required: ["ticker", "fields"],
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

  get_tides: async (args) => fetchJson(buildUrl("/weather/tides", {}, args)),

  get_wildfires: async (args) =>
    fetchJson(buildUrl("/weather/wildfires", {}, args)),

  get_iss_position: async (args) =>
    fetchJson(buildUrl("/weather/iss", {}, args)),

  get_near_earth_objects: async (args) =>
    fetchJson(buildUrl("/weather/neo/summary", {}, args)),

  get_solar_wind: async (args) =>
    fetchJson(buildUrl("/weather/solar-wind/latest", {}, args)),

  get_pollen: async (args) =>
    fetchJson(buildUrl("/weather/pollen/today", {}, args)),

  get_apod: async (args) =>
    fetchJson(buildUrl("/weather/apod", {}, args)),

  get_launches: async (args) =>
    fetchJson(buildUrl("/weather/launches/summary", {}, args)),

  get_weather_warnings: async (args) =>
    fetchJson(buildUrl("/weather/warnings", {}, args)),

  get_avalanche_forecast: async (args) =>
    fetchJson(buildUrl("/weather/avalanche", {}, args)),

  get_google_air_quality: async (args) =>
    fetchJson(buildUrl("/weather/airquality/google", {}, args)),

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

  get_events_today: async (args) =>
    fetchJson(buildUrl("/event/today", {}, args)),

  get_event_summary: async (args) =>
    fetchJson(buildUrl("/event/summary", {}, args)),

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

  get_hot_trends: async (args) =>
    fetchJson(buildUrl("/trend/trends/hot", {}, args)),

  get_top_trends: async (args) =>
    fetchJson(
      buildUrl(
        "/trend/trends/top",
        { hours: args.hours, limit: args.limit },
        args,
      ),
    ),

  // ── Products ──
  search_products: async (args) =>
    fetchJson(
      buildUrl(
        "/product/products/search",
        { q: args.query, category: args.category, limit: args.limit },
        args,
      ),
    ),

  get_trending_products: async (args) =>
    fetchJson(
      buildUrl("/product/products/trending", { limit: args.limit }, args),
    ),

  get_product_availability: async (args) =>
    fetchJson(buildUrl("/product/products/availability", {}, args)),

  check_product_availability: async (args) =>
    fetchJson(
      buildUrl("/product/products/availability/check", { skus: args.skus }, args),
    ),

  // ── Market (extended) ──
  get_commodity_categories: async () =>
    fetchJson(`${TOOLS_API_URL}/market/commodities/categories`),

  get_commodity_history: async (args) =>
    fetchJson(
      buildUrl(
        `/market/commodities/history/${encodeURIComponent(args.ticker)}`,
        { hours: args.hours },
        args,
      ),
    ),

  // ── Finance / Stocks (Finnhub) ──
  get_stock_quote: async (args) =>
    fetchJson(
      buildUrl(`/finance/quote/${encodeURIComponent(args.symbol)}`, {}, args),
    ),

  get_company_profile: async (args) =>
    fetchJson(
      buildUrl(`/finance/profile/${encodeURIComponent(args.symbol)}`, {}, args),
    ),

  get_market_news: async (args) =>
    fetchJson(buildUrl("/finance/news", { symbol: args.symbol }, args)),

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
  get_events_today: TOOLS_API_URL,
  get_event_summary: TOOLS_API_URL,
  get_commodities_summary: TOOLS_API_URL,
  get_commodity_by_category: TOOLS_API_URL,
  get_commodity_ticker: TOOLS_API_URL,
  get_commodity_categories: TOOLS_API_URL,
  get_commodity_history: TOOLS_API_URL,
  get_trends: TOOLS_API_URL,
  get_hot_trends: TOOLS_API_URL,
  get_top_trends: TOOLS_API_URL,
  search_products: TOOLS_API_URL,
  get_trending_products: TOOLS_API_URL,
  get_product_availability: TOOLS_API_URL,
  check_product_availability: TOOLS_API_URL,
  get_near_earth_objects: TOOLS_API_URL,
  get_solar_wind: TOOLS_API_URL,
  get_pollen: TOOLS_API_URL,
  get_apod: TOOLS_API_URL,
  get_launches: TOOLS_API_URL,
  get_weather_warnings: TOOLS_API_URL,
  get_avalanche_forecast: TOOLS_API_URL,
  get_google_air_quality: TOOLS_API_URL,
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
