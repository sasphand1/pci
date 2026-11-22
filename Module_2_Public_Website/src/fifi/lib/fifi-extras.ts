export type Drama = {
  id: string;
  title: string;
  network: string;
  genre: string;
  leadCast: string;
  weeklyViewsM: number;
  monthlyViewsM: number;
  trp: number;
  sentiment: number;
  weeklyChange: string;
  episodesAired: number;
  summary: string;
  series: Array<{ week: string; viewsM: number; trp: number }>;
};

export const dramas: Drama[] = [
  {
    id: "kabhi-main-kabhi-tum",
    title: "Kabhi Main Kabhi Tum",
    network: "ARY Digital",
    genre: "Family Drama",
    leadCast: "Fahad Mustafa, Hania Aamir",
    weeklyViewsM: 28.4,
    monthlyViewsM: 108.6,
    trp: 14.2,
    sentiment: 94,
    weeklyChange: "+19%",
    episodesAired: 24,
    summary: "Modern marriage, quiet resilience and sharp dialogue driving record YouTube replays.",
    series: [
      { week: "W1", viewsM: 16.2, trp: 9.8 },
      { week: "W2", viewsM: 19.4, trp: 11.1 },
      { week: "W3", viewsM: 22.1, trp: 12.0 },
      { week: "W4", viewsM: 24.8, trp: 12.9 },
      { week: "W5", viewsM: 26.5, trp: 13.6 },
      { week: "W6", viewsM: 28.4, trp: 14.2 },
    ],
  },
  {
    id: "jaafaa",
    title: "Jafaa",
    network: "Hum TV",
    genre: "Social Drama",
    leadCast: "Mawra Hocane, Usman Mukhtar",
    weeklyViewsM: 21.8,
    monthlyViewsM: 82.4,
    trp: 11.6,
    sentiment: 88,
    weeklyChange: "+14%",
    episodesAired: 20,
    summary: "Intertwined family stories tackling trust, therapy and generational expectations.",
    series: [
      { week: "W1", viewsM: 13.5, trp: 8.4 },
      { week: "W2", viewsM: 15.1, trp: 9.1 },
      { week: "W3", viewsM: 16.9, trp: 9.8 },
      { week: "W4", viewsM: 18.4, trp: 10.5 },
      { week: "W5", viewsM: 20.2, trp: 11.1 },
      { week: "W6", viewsM: 21.8, trp: 11.6 },
    ],
  },
  {
    id: "iqtidar",
    title: "Iqtidar",
    network: "Green Entertainment",
    genre: "Political Romance",
    leadCast: "Anmol Baloch, Ali Raza",
    weeklyViewsM: 19.6,
    monthlyViewsM: 71.2,
    trp: 9.8,
    sentiment: 91,
    weeklyChange: "+27%",
    episodesAired: 16,
    summary: "Fast-rising prime-time breakout pairing sharp political stakes with strong chemistry.",
    series: [
      { week: "W1", viewsM: 9.4, trp: 6.2 },
      { week: "W2", viewsM: 11.8, trp: 7.0 },
      { week: "W3", viewsM: 13.9, trp: 7.8 },
      { week: "W4", viewsM: 15.7, trp: 8.5 },
      { week: "W5", viewsM: 17.5, trp: 9.1 },
      { week: "W6", viewsM: 19.6, trp: 9.8 },
    ],
  },
  {
    id: "sunn-mere-dil",
    title: "Sunn Mere Dil",
    network: "Geo Entertainment",
    genre: "Romantic Drama",
    leadCast: "Wahaj Ali, Maya Ali",
    weeklyViewsM: 18.2,
    monthlyViewsM: 76.5,
    trp: 10.9,
    sentiment: 79,
    weeklyChange: "+6%",
    episodesAired: 14,
    summary: "High-production romantic saga with heavy overseas diaspora viewership.",
    series: [
      { week: "W1", viewsM: 15.8, trp: 10.1 },
      { week: "W2", viewsM: 16.4, trp: 10.3 },
      { week: "W3", viewsM: 17.0, trp: 10.5 },
      { week: "W4", viewsM: 17.3, trp: 10.6 },
      { week: "W5", viewsM: 17.9, trp: 10.8 },
      { week: "W6", viewsM: 18.2, trp: 10.9 },
    ],
  },
  {
    id: "noor-jahan",
    title: "Noor Jahan",
    network: "ARY Digital",
    genre: "Family Saga",
    leadCast: "Saba Hamid, Kubra Khan",
    weeklyViewsM: 15.9,
    monthlyViewsM: 68.1,
    trp: 11.2,
    sentiment: 93,
    weeklyChange: "+11%",
    episodesAired: 28,
    summary: "Critically acclaimed matriarchal drama with consistently strong household TRP.",
    series: [
      { week: "W1", viewsM: 12.1, trp: 9.4 },
      { week: "W2", viewsM: 12.9, trp: 9.8 },
      { week: "W3", viewsM: 13.8, trp: 10.2 },
      { week: "W4", viewsM: 14.5, trp: 10.6 },
      { week: "W5", viewsM: 15.1, trp: 10.9 },
      { week: "W6", viewsM: 15.9, trp: 11.2 },
    ],
  },
  {
    id: "qarz-e-jaan",
    title: "Qarz-e-Jaan",
    network: "Hum TV",
    genre: "Legal Drama",
    leadCast: "Yumna Zaidi, Usama Khan",
    weeklyViewsM: 14.4,
    monthlyViewsM: 52.8,
    trp: 8.9,
    sentiment: 95,
    weeklyChange: "+31%",
    episodesAired: 10,
    summary: "Grounded courtroom storytelling earning the highest audience sentiment this month.",
    series: [
      { week: "W1", viewsM: 7.2, trp: 5.8 },
      { week: "W2", viewsM: 8.8, trp: 6.4 },
      { week: "W3", viewsM: 10.1, trp: 7.0 },
      { week: "W4", viewsM: 11.6, trp: 7.7 },
      { week: "W5", viewsM: 13.0, trp: 8.3 },
      { week: "W6", viewsM: 14.4, trp: 8.9 },
    ],
  },
];

export type SatelliteModuleId = "farm" | "water" | "solar" | "city";

export type SatelliteModule = {
  id: SatelliteModuleId;
  label: string;
  headline: string;
  summary: string;
  metricUnit: string;
  regions: Record<
    string,
    {
      status: string;
      indexValue: string;
      indexLabel: string;
      advisory: string;
      secondaryValue: string;
      secondaryLabel: string;
      trend: Array<{ month: string; value: number; baseline: number }>;
    }
  >;
};

export const satelliteRegions = ["Punjab", "Sindh", "Islamabad & Potohar", "KP"] as const;

export const satelliteModules: SatelliteModule[] = [
  {
    id: "farm",
    label: "Farm Doctor",
    headline: "Crop health & vegetation vigor (NDVI)",
    summary: "Sentinel-2 multispectral readings translated into plain-language sowing and irrigation guidance.",
    metricUnit: "NDVI × 100",
    regions: {
      Punjab: {
        status: "Healthy wheat emergence",
        indexValue: "0.74",
        indexLabel: "Mean NDVI score",
        secondaryValue: "+8% vs 5-yr avg",
        secondaryLabel: "Canopy vigor",
        advisory: "Central Punjab canal-fed belts show strong early vigor; monitor southern Multan pockets for mild moisture stress.",
        trend: [
          { month: "Jun", value: 48, baseline: 46 },
          { month: "Jul", value: 56, baseline: 54 },
          { month: "Aug", value: 64, baseline: 60 },
          { month: "Sep", value: 68, baseline: 63 },
          { month: "Oct", value: 71, baseline: 66 },
          { month: "Nov", value: 74, baseline: 68 },
        ],
      },
      Sindh: {
        status: "Moderate moisture watch",
        indexValue: "0.61",
        indexLabel: "Mean NDVI score",
        secondaryValue: "-3% vs 5-yr avg",
        secondaryLabel: "Canopy vigor",
        advisory: "Lower Sindh tail-end districts benefit from staggered irrigation scheduling over the next 10 days.",
        trend: [
          { month: "Jun", value: 44, baseline: 45 },
          { month: "Jul", value: 52, baseline: 53 },
          { month: "Aug", value: 58, baseline: 59 },
          { month: "Sep", value: 60, baseline: 61 },
          { month: "Oct", value: 59, baseline: 62 },
          { month: "Nov", value: 61, baseline: 63 },
        ],
      },
      "Islamabad & Potohar": {
        status: "Rain-fed optimal",
        indexValue: "0.69",
        indexLabel: "Mean NDVI score",
        secondaryValue: "+5% vs 5-yr avg",
        secondaryLabel: "Canopy vigor",
        advisory: "Recent post-monsoon soil moisture supports strong barani germination across Rawalpindi and Chakwal.",
        trend: [
          { month: "Jun", value: 45, baseline: 44 },
          { month: "Jul", value: 55, baseline: 52 },
          { month: "Aug", value: 66, baseline: 61 },
          { month: "Sep", value: 68, baseline: 64 },
          { month: "Oct", value: 67, baseline: 65 },
          { month: "Nov", value: 69, baseline: 66 },
        ],
      },
      KP: {
        status: "Stable valley orchards",
        indexValue: "0.71",
        indexLabel: "Mean NDVI score",
        secondaryValue: "+6% vs 5-yr avg",
        secondaryLabel: "Canopy vigor",
        advisory: "Peshawar and Swat agricultural corridors remain well above seasonal baseline with low frost risk this week.",
        trend: [
          { month: "Jun", value: 52, baseline: 50 },
          { month: "Jul", value: 61, baseline: 58 },
          { month: "Aug", value: 68, baseline: 64 },
          { month: "Sep", value: 70, baseline: 66 },
          { month: "Oct", value: 71, baseline: 67 },
          { month: "Nov", value: 71, baseline: 67 },
        ],
      },
    },
  },
  {
    id: "water",
    label: "Water Guardian",
    headline: "Reservoir & rainfall anomalies",
    summary: "Tracks surface water extent, Tarbela/Mangla catchment runoff and seasonal rainfall departure.",
    metricUnit: "Rainfall (mm)",
    regions: {
      Punjab: {
        status: "Normal canal supply",
        indexValue: "82%",
        indexLabel: "Catchment storage",
        secondaryValue: "+11 mm",
        secondaryLabel: "30-day rainfall delta",
        advisory: "Upper Indus inflows remain steady; groundwater recharge in northern districts is tracking above last winter.",
        trend: [
          { month: "Jun", value: 52, baseline: 48 },
          { month: "Jul", value: 148, baseline: 132 },
          { month: "Aug", value: 162, baseline: 145 },
          { month: "Sep", value: 74, baseline: 68 },
          { month: "Oct", value: 28, baseline: 24 },
          { month: "Nov", value: 19, baseline: 16 },
        ],
      },
      Sindh: {
        status: "Conservation advised",
        indexValue: "68%",
        indexLabel: "Barrage storage",
        secondaryValue: "-6 mm",
        secondaryLabel: "30-day rainfall delta",
        advisory: "Dry spell persists across Tharparkar and Badin; prioritize lined-channel delivery for winter crops.",
        trend: [
          { month: "Jun", value: 18, baseline: 22 },
          { month: "Jul", value: 84, baseline: 90 },
          { month: "Aug", value: 92, baseline: 98 },
          { month: "Sep", value: 34, baseline: 40 },
          { month: "Oct", value: 8, baseline: 12 },
          { month: "Nov", value: 4, baseline: 10 },
        ],
      },
      "Islamabad & Potohar": {
        status: "Strong reservoir levels",
        indexValue: "89%",
        indexLabel: "Simly & Rawal fill",
        secondaryValue: "+18 mm",
        secondaryLabel: "30-day rainfall delta",
        advisory: "Twin-city reservoirs hold comfortable winter reserves with low turbidity readings.",
        trend: [
          { month: "Jun", value: 78, baseline: 68 },
          { month: "Jul", value: 245, baseline: 220 },
          { month: "Aug", value: 268, baseline: 240 },
          { month: "Sep", value: 112, baseline: 98 },
          { month: "Oct", value: 42, baseline: 34 },
          { month: "Nov", value: 31, baseline: 22 },
        ],
      },
      KP: {
        status: "High glacial melt buffer",
        indexValue: "85%",
        indexLabel: "Basin index",
        secondaryValue: "+9 mm",
        secondaryLabel: "30-day rainfall delta",
        advisory: "Kabul and Swat river flows are within normal seasonal bands with no flash-flood alerts.",
        trend: [
          { month: "Jun", value: 64, baseline: 60 },
          { month: "Jul", value: 136, baseline: 128 },
          { month: "Aug", value: 144, baseline: 135 },
          { month: "Sep", value: 78, baseline: 72 },
          { month: "Oct", value: 36, baseline: 32 },
          { month: "Nov", value: 29, baseline: 24 },
        ],
      },
    },
  },
  {
    id: "solar",
    label: "Solar Advisor",
    headline: "Rooftop solar yield & payback",
    summary: "Irradiance estimates helping Pakistani households and SMEs size net-metered solar systems.",
    metricUnit: "kWh / kWp / day",
    regions: {
      Punjab: {
        status: "High winter yield",
        indexValue: "4.9",
        indexLabel: "Avg kWh / kWp / day",
        secondaryValue: "3.1 yrs",
        secondaryLabel: "Est. 10kW payback",
        advisory: "Clear skies across Lahore and Faisalabad keep rooftop efficiency strong; schedule bi-weekly dust cleaning.",
        trend: [
          { month: "Jun", value: 6.2, baseline: 6.0 },
          { month: "Jul", value: 5.5, baseline: 5.4 },
          { month: "Aug", value: 5.4, baseline: 5.3 },
          { month: "Sep", value: 5.6, baseline: 5.5 },
          { month: "Oct", value: 5.2, baseline: 5.0 },
          { month: "Nov", value: 4.9, baseline: 4.7 },
        ],
      },
      Sindh: {
        status: "Peak national irradiance",
        indexValue: "5.6",
        indexLabel: "Avg kWh / kWp / day",
        secondaryValue: "2.7 yrs",
        secondaryLabel: "Est. 10kW payback",
        advisory: "Karachi and Hyderabad maintain Pakistan's highest winter solar generation; coastal breeze aids panel cooling.",
        trend: [
          { month: "Jun", value: 6.4, baseline: 6.3 },
          { month: "Jul", value: 5.8, baseline: 5.7 },
          { month: "Aug", value: 5.7, baseline: 5.6 },
          { month: "Sep", value: 6.0, baseline: 5.8 },
          { month: "Oct", value: 5.8, baseline: 5.6 },
          { month: "Nov", value: 5.6, baseline: 5.4 },
        ],
      },
      "Islamabad & Potohar": {
        status: "Consistent generation",
        indexValue: "4.6",
        indexLabel: "Avg kWh / kWp / day",
        secondaryValue: "3.3 yrs",
        secondaryLabel: "Est. 10kW payback",
        advisory: "30° south-facing tilt maximizes winter sun angle across Islamabad sectors.",
        trend: [
          { month: "Jun", value: 6.1, baseline: 5.9 },
          { month: "Jul", value: 5.2, baseline: 5.1 },
          { month: "Aug", value: 5.1, baseline: 5.0 },
          { month: "Sep", value: 5.4, baseline: 5.3 },
          { month: "Oct", value: 5.0, baseline: 4.9 },
          { month: "Nov", value: 4.6, baseline: 4.5 },
        ],
      },
      KP: {
        status: "Strong daytime clarity",
        indexValue: "4.7",
        indexLabel: "Avg kWh / kWp / day",
        secondaryValue: "3.2 yrs",
        secondaryLabel: "Est. 10kW payback",
        advisory: "Hybrid inverter setups with 4-hour lithium backup offer the best reliability for Peshawar SMEs.",
        trend: [
          { month: "Jun", value: 6.3, baseline: 6.1 },
          { month: "Jul", value: 5.4, baseline: 5.3 },
          { month: "Aug", value: 5.3, baseline: 5.2 },
          { month: "Sep", value: 5.5, baseline: 5.4 },
          { month: "Oct", value: 5.1, baseline: 5.0 },
          { month: "Nov", value: 4.7, baseline: 4.6 },
        ],
      },
    },
  },
  {
    id: "city",
    label: "City Health",
    headline: "Air quality & urban heat tracking",
    summary: "Combines aerosol optical depth with ground stations to give families clear daily outdoor guidance.",
    metricUnit: "AQI Index",
    regions: {
      Punjab: {
        status: "Smog watch — morning hours",
        indexValue: "184",
        indexLabel: "Regional AQI",
        secondaryValue: "N95 advised",
        secondaryLabel: "Outdoor guidance",
        advisory: "Thermal inversion traps particulates between 6–10 AM in Lahore; afternoon wind dispersion improves air quality.",
        trend: [
          { month: "Jun", value: 112, baseline: 118 },
          { month: "Jul", value: 94, baseline: 98 },
          { month: "Aug", value: 88, baseline: 92 },
          { month: "Sep", value: 118, baseline: 122 },
          { month: "Oct", value: 164, baseline: 170 },
          { month: "Nov", value: 184, baseline: 192 },
        ],
      },
      Sindh: {
        status: "Moderate sea-breeze air",
        indexValue: "96",
        indexLabel: "Regional AQI",
        secondaryValue: "Fair outdoors",
        secondaryLabel: "Outdoor guidance",
        advisory: "Southwest coastal winds keep Karachi's afternoon air noticeably clearer than inland plains.",
        trend: [
          { month: "Jun", value: 78, baseline: 82 },
          { month: "Jul", value: 72, baseline: 76 },
          { month: "Aug", value: 74, baseline: 78 },
          { month: "Sep", value: 84, baseline: 88 },
          { month: "Oct", value: 92, baseline: 95 },
          { month: "Nov", value: 96, baseline: 102 },
        ],
      },
      "Islamabad & Potohar": {
        status: "Good to moderate",
        indexValue: "78",
        indexLabel: "Regional AQI",
        secondaryValue: "Safe for parks",
        secondaryLabel: "Outdoor guidance",
        advisory: "Margalla tree cover and light northerly breezes keep daytime air comfortable for outdoor activity.",
        trend: [
          { month: "Jun", value: 68, baseline: 72 },
          { month: "Jul", value: 58, baseline: 62 },
          { month: "Aug", value: 54, baseline: 58 },
          { month: "Sep", value: 66, baseline: 70 },
          { month: "Oct", value: 74, baseline: 78 },
          { month: "Nov", value: 78, baseline: 82 },
        ],
      },
      KP: {
        status: "Moderate valley haze",
        indexValue: "126",
        indexLabel: "Regional AQI",
        secondaryValue: "Limit evening jogs",
        secondaryLabel: "Outdoor guidance",
        advisory: "Evening traffic corridors in Peshawar see brief spikes; midday hours offer the cleanest window.",
        trend: [
          { month: "Jun", value: 92, baseline: 96 },
          { month: "Jul", value: 82, baseline: 85 },
          { month: "Aug", value: 79, baseline: 82 },
          { month: "Sep", value: 96, baseline: 100 },
          { month: "Oct", value: 114, baseline: 118 },
          { month: "Nov", value: 126, baseline: 130 },
        ],
      },
    },
  },
];