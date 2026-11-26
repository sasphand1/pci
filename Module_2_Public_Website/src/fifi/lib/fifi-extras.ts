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
