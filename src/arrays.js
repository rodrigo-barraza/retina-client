// ============================================================
// Console — Prompt Suggestion Pool
// ============================================================
// ~200 example prompts organized by API category. A random
// subset is shown in the Console's empty state on each load.
// ============================================================

// ── Weather / Environment (Nimbus) ──────────────────────────

export const WEATHER_PROMPTS = [
  "What's the weather like right now?",
  "What's the temperature outside?",
  "Is it going to rain today?",
  "What's the UV index right now?",
  "How humid is it outside?",
  "What does the weather look like this week?",
  "Will it be sunny this weekend?",
  "What's the wind speed right now?",
  "Is it a good day for a run outside?",
  "What's the feels-like temperature?",
  "How's the weather looking for the next 3 days?",
  "Should I bring an umbrella today?",
  "What's the weather forecast for the next 5 days?",
  "Is it colder than yesterday?",
  "What's the dew point right now?",
  "What's the 14-day weather forecast?",
  "What's the precipitation chance today?",
  "Is it warm enough for the beach?",
  "How much rain is expected this week?",
  "What's the barometric pressure?",
];

export const AIR_QUALITY_PROMPTS = [
  "What's the current air quality?",
  "Is the air quality safe for outdoor exercise?",
  "What are the PM2.5 levels right now?",
  "How's the pollen count today?",
  "Is it safe to go for a walk with allergies?",
  "What are the current pollutant levels?",
  "How bad are allergens today?",
  "What's the AQI right now?",
  "Should I wear a mask outside today?",
  "Is air quality better today than yesterday?",
];

export const EARTHQUAKE_PROMPTS = [
  "Have there been any recent earthquakes?",
  "Were there any earthquakes today?",
  "What was the strongest recent earthquake?",
  "Any seismic activity near the coast?",
  "What magnitude was the last earthquake?",
  "How deep was the most recent earthquake?",
  "Where was the last earthquake located?",
  "Any significant earthquakes this week?",
  "How many earthquakes happened today?",
  "Is there any earthquake activity in the Pacific?",
];

export const SOLAR_PROMPTS = [
  "What's the current solar activity?",
  "Have there been any solar flares recently?",
  "Are there any geomagnetic storms happening?",
  "What's the solar wind speed?",
  "Any coronal mass ejections detected?",
  "How active is the sun right now?",
  "Is there any space weather affecting Earth?",
  "What's the current geomagnetic storm level?",
  "Are there any solar storm warnings?",
  "How strong is the latest solar flare?",
];

export const AURORA_PROMPTS = [
  "Can I see the northern lights tonight?",
  "What's the current Kp index?",
  "Is the aurora visible tonight?",
  "What's the aurora forecast for this week?",
  "How far south can the aurora be seen?",
  "Is it a good night for aurora viewing?",
  "What are the chances of seeing northern lights?",
  "When's the next aurora event?",
  "Is the Kp index high enough for aurora?",
  "Where's the best place to see aurora tonight?",
];

export const TWILIGHT_PROMPTS = [
  "When is sunset today?",
  "What time is sunrise tomorrow?",
  "How many hours of daylight are left?",
  "When does golden hour start today?",
  "What time is twilight?",
  "When does it get dark tonight?",
  "How long until sunrise?",
  "What's the civil twilight time?",
  "When is the best time for sunset photos?",
  "Is the sun already up?",
];

export const TIDE_PROMPTS = [
  "What are today's tide times?",
  "When is the next high tide?",
  "When is low tide today?",
  "What's the current tide level?",
  "Is it high tide or low tide right now?",
  "When should I go tidepooling?",
  "What are tomorrow's tides?",
  "How high will the tide get today?",
  "Is it safe to walk the beach right now?",
  "When's the best time for surfing today?",
];

export const WILDFIRE_PROMPTS = [
  "Are there any active wildfires nearby?",
  "Where are the current wildfires?",
  "How many active wildfires are there?",
  "Is there any wildfire smoke in the area?",
  "What's the largest active wildfire?",
  "Are there any new wildfires today?",
  "Is there a fire danger warning?",
  "How big is the nearest wildfire?",
  "Are any wildfires contained?",
  "What's the wildfire situation this week?",
];

export const ISS_PROMPTS = [
  "Where is the ISS right now?",
  "What's the current position of the space station?",
  "Who is on the ISS right now?",
  "How many people are in space?",
  "Is the ISS flying over us right now?",
  "When can I see the ISS tonight?",
  "What country is the ISS over?",
  "How fast is the ISS moving?",
  "How many crew members are on the ISS?",
  "What orbit is the ISS on?",
];

// ── Events (Beacon) ─────────────────────────────────────────

export const EVENT_PROMPTS = [
  "Are there any events this weekend?",
  "What concerts are coming up?",
  "Any free events happening today?",
  "What's happening this Friday night?",
  "Are there any food festivals soon?",
  "What live music is on tonight?",
  "Any sports events this week?",
  "What events are happening downtown?",
  "Are there any outdoor events coming up?",
  "What community events are this month?",
  "Any art exhibitions opening soon?",
  "What comedy shows are this week?",
  "Are there any tech meetups coming up?",
  "What family-friendly events are on?",
  "Any holiday events happening soon?",
  "What's the biggest event this weekend?",
  "Are there any markets this Saturday?",
  "What festivals are coming up?",
  "Any theatre performances this week?",
  "What events can I go to for free tonight?",
];

// ── Commodities / Markets ───────────────────────────────────

export const COMMODITY_PROMPTS = [
  "What are the top commodity movers today?",
  "What's the current gold price?",
  "How are oil prices doing?",
  "What's the silver price per ounce?",
  "Are energy commodities up or down?",
  "What's natural gas trading at?",
  "How are agricultural commodities performing?",
  "What's the price of wheat today?",
  "Are precious metals up this week?",
  "What's copper trading at?",
  "How's the commodity market overall?",
  "What are the biggest commodity losers today?",
  "Is platinum up or down?",
  "What's the corn futures price?",
  "How are coffee prices trending?",
  "What's crude oil at right now?",
  "Are metal commodities bullish?",
  "What's the soybean price?",
  "How is lumber performing?",
  "What are the best performing commodities this week?",
];

// ── Trends ──────────────────────────────────────────────────

export const TREND_PROMPTS = [
  "What's trending on Reddit?",
  "What are today's Google trends?",
  "What's trending on Hacker News?",
  "What are the top Wikipedia articles today?",
  "What's going viral right now?",
  "What are people searching for today?",
  "What's the most talked about topic?",
  "What tech topics are trending?",
  "Are there any breaking news trends?",
  "What's trending in entertainment?",
  "What topics are viral on social media?",
  "What are the top stories today?",
  "What's the biggest news trend right now?",
  "What are people excited about today?",
  "Is anything unusual trending?",
  "What memes are trending?",
  "What sports topics are trending?",
  "What's the top trend in tech right now?",
  "Any political topics trending today?",
  "What's trending in science?",
];

// ── Products ────────────────────────────────────────────────

export const PRODUCT_PROMPTS = [
  "Search for wireless headphones",
  "What mechanical keyboards are available?",
  "Find me a good standing desk",
  "Search for USB-C hubs",
  "What monitors are available?",
  "Find webcams for streaming",
  "Search for ergonomic mice",
  "What laptop stands do you have?",
  "Find portable chargers",
  "Search for noise-cancelling earbuds",
  "What smart home devices are there?",
  "Find a good external SSD",
  "Search for LED desk lamps",
  "What gaming chairs are available?",
  "Find a good microphone for podcasting",
  "Search for tablet stands",
  "What Bluetooth speakers are there?",
  "Find a good router",
  "Search for drawing tablets",
  "What e-readers are available?",
];

// ── Cross-API / General ─────────────────────────────────────

export const GENERAL_PROMPTS = [
  "Give me a full status of everything right now",
  "What's the most interesting thing happening today?",
  "Summarize today's weather, events, and trends",
  "Is tonight good for stargazing?",
  "What should I do this weekend?",
  "What's the best outdoor activity today?",
  "Give me a morning briefing",
  "Anything exciting happening in the world?",
  "What's going on today worth knowing about?",
  "Is today a good day to be outside?",
];

// ── All prompts combined ────────────────────────────────────

export const ALL_CONSOLE_PROMPTS = [
  ...WEATHER_PROMPTS,
  ...AIR_QUALITY_PROMPTS,
  ...EARTHQUAKE_PROMPTS,
  ...SOLAR_PROMPTS,
  ...AURORA_PROMPTS,
  ...TWILIGHT_PROMPTS,
  ...TIDE_PROMPTS,
  ...WILDFIRE_PROMPTS,
  ...ISS_PROMPTS,
  ...EVENT_PROMPTS,
  ...COMMODITY_PROMPTS,
  ...TREND_PROMPTS,
  ...PRODUCT_PROMPTS,
  ...GENERAL_PROMPTS,
];
