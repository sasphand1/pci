export type Creator = {
  id: number;
  slug?: string;
  name: string;
  handle: string;
  category: string;
  city: string;
  followers: string;
  growth: string;
  image: string;
  bio: string;
};

export const creators: Creator[] = [
  { id: 1, name: "Zainab Faisal", handle: "@zainabfaisal", category: "Lifestyle", city: "Lahore", followers: "1.2M", growth: "+18%", image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=85", bio: "Everyday style, honest routines and a softer side of city life." },
  { id: 2, name: "Ducky Bhai", handle: "@duckybhai", category: "Entertainment", city: "Lahore", followers: "3.4M", growth: "+12%", image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=85", bio: "Games, internet culture and comedy with a distinctly local voice." },
  { id: 3, name: "Miraal Fatima", handle: "@miraal", category: "Fashion", city: "Karachi", followers: "842K", growth: "+24%", image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=85", bio: "Modern Pakistani fashion, independent labels and thoughtful styling." },
  { id: 4, name: "Shayan Jahangir", handle: "@shayanTalks", category: "Sports", city: "Islamabad", followers: "620K", growth: "+16%", image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=85", bio: "Cricket analysis that goes beyond the scoreboard and the headlines." },
  { id: 5, name: "Rabeeca Khan", handle: "@rabeecakhan", category: "Entertainment", city: "Karachi", followers: "510K", growth: "+9%", image: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=400&q=85", bio: "Music, positive stories and light-hearted entertainment." },
  { id: 6, name: "Hamza Bhatti", handle: "@hamzaeats", category: "Food", city: "Lahore", followers: "388K", growth: "+31%", image: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=85", bio: "Street food trails and family kitchens across Punjab." },
  { id: 7, name: "Areeba Shah", handle: "@areebareads", category: "Education", city: "Islamabad", followers: "294K", growth: "+21%", image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=85", bio: "Books, study habits and accessible explainers for curious minds." },
  { id: 8, name: "Bilal Munir", handle: "@bilalbuilds", category: "Technology", city: "Karachi", followers: "276K", growth: "+27%", image: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=400&q=85", bio: "Practical technology reviews and Pakistan's startup ecosystem." },
  { id: 9, name: "Noor Ul Ain", handle: "@noortravels", category: "Travel", city: "Gilgit", followers: "231K", growth: "+34%", image: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=400&q=85", bio: "Responsible travel guides from the mountains to the coast." },
  { id: 10, name: "Danish Ali", handle: "@danishfinance", category: "Business", city: "Islamabad", followers: "198K", growth: "+14%", image: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=400&q=85", bio: "Personal finance and small-business ideas explained simply." },
  { id: 11, name: "Hina Khawaja", handle: "@hinacreates", category: "Art & Culture", city: "Lahore", followers: "176K", growth: "+19%", image: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=400&q=85", bio: "Contemporary art, craft traditions and creative studio visits." },
  { id: 12, name: "Saad Rehman", handle: "@saadframes", category: "Travel", city: "Peshawar", followers: "154K", growth: "+22%", image: "https://images.unsplash.com/photo-1507591064344-4c6ce005b128?auto=format&fit=crop&w=400&q=85", bio: "Documentary photography and overlooked stories from Khyber Pakhtunkhwa." },
];

export type EventItem = {
  id: number;
  title: string;
  day: string;
  month: string;
  dateLabel: string;
  city: string;
  venue: string;
  category: string;
  price: string;
  image: string;
  description: string;
};

export const events: EventItem[] = [
  { id: 1, title: "Karachi Food Festival", day: "28", month: "NOV", dateLabel: "Saturday, 28 November", city: "Karachi", venue: "Beach Luxury Hotel", category: "Food", price: "Rs. 800", image: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=900&q=85", description: "Regional kitchens, independent food makers and live music by the sea." },
  { id: 2, title: "Coke Studio Live: Lahore", day: "29", month: "NOV", dateLabel: "Sunday, 29 November", city: "Lahore", venue: "Alhamra Arts Council", category: "Music", price: "Rs. 2,500", image: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=900&q=85", description: "An evening of contemporary sounds and timeless Pakistani voices." },
  { id: 3, title: "Lok Virsa Craft Bazaar", day: "04", month: "DEC", dateLabel: "Friday, 4 December", city: "Islamabad", venue: "Lok Virsa Museum", category: "Culture", price: "Free entry", image: "https://images.unsplash.com/photo-1528698827591-e19ccd7bc23d?auto=format&fit=crop&w=900&q=85", description: "Meet artisans and discover textiles, pottery and traditional craft." },
  { id: 4, title: "Future of Work: Pakistan", day: "06", month: "DEC", dateLabel: "Sunday, 6 December", city: "Lahore", venue: "NIC Lahore", category: "Technology", price: "Free entry", image: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=900&q=85", description: "Founders and operators discuss practical skills for a changing economy." },
  { id: 5, title: "Sunday at the Bookshop", day: "06", month: "DEC", dateLabel: "Sunday, 6 December", city: "Islamabad", venue: "Old Books, F-6", category: "Books", price: "Free entry", image: "https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=900&q=85", description: "A quiet afternoon of readings, recommendations and conversation." },
  { id: 6, title: "PSL Fan Park", day: "11", month: "DEC", dateLabel: "Friday, 11 December", city: "Rawalpindi", venue: "Ayub National Park", category: "Sports", price: "Rs. 500", image: "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&w=900&q=85", description: "Big-screen cricket, food stalls and activities for the whole family." },
  { id: 7, title: "Design Karachi Meetup", day: "13", month: "DEC", dateLabel: "Sunday, 13 December", city: "Karachi", venue: "TDF Ghar", category: "Design", price: "Rs. 1,000", image: "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=900&q=85", description: "A practical exchange for designers, illustrators and creative studios." },
  { id: 8, title: "Hunza Winter Photography Walk", day: "18", month: "DEC", dateLabel: "Friday, 18 December", city: "Hunza", venue: "Karimabad Bazaar", category: "Travel", price: "Rs. 3,500", image: "https://images.unsplash.com/photo-1486911278844-a81c5267e227?auto=format&fit=crop&w=900&q=85", description: "A small-group guided walk through winter landscapes and old streets." },
  { id: 9, title: "Women in Business Breakfast", day: "20", month: "DEC", dateLabel: "Sunday, 20 December", city: "Islamabad", venue: "The Loft, Blue Area", category: "Business", price: "Rs. 1,800", image: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=900&q=85", description: "Honest conversations with founders building resilient local companies." },
];

export type Business = {
  id: number;
  name: string;
  category: string;
  city: string;
  area: string;
  rating: string;
  reviews: string;
  offer: string;
  image: string;
  description: string;
};

export const businesses: Business[] = [
  { id: 1, name: "Chai Galli", category: "Café", city: "Lahore", area: "Gulberg III", rating: "4.7", reviews: "2.3K", offer: "10% off evening chai", image: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=900&q=85", description: "A relaxed neighbourhood café for desi breakfasts and unhurried conversations." },
  { id: 2, name: "Nisa Sultan", category: "Restaurant", city: "Lahore", area: "MM Alam Road", rating: "4.6", reviews: "1.8K", offer: "Complimentary dessert", image: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=900&q=85", description: "Traditional Lahori recipes served in a warm, contemporary dining room." },
  { id: 3, name: "The Sweet Affair", category: "Bakery", city: "Karachi", area: "DHA Phase 6", rating: "4.8", reviews: "1.9K", offer: "Free delivery over Rs. 1,500", image: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=900&q=85", description: "Small-batch cakes and pastries made fresh every morning." },
  { id: 4, name: "Kitab Ghar", category: "Books", city: "Islamabad", area: "F-6 Markaz", rating: "4.9", reviews: "980", offer: "Buy 2, get 1 free", image: "https://images.unsplash.com/photo-1526243741027-444d633d7365?auto=format&fit=crop&w=900&q=85", description: "An independent bookshop championing Pakistani writers and curious readers." },
  { id: 5, name: "The Wardrobe Co.", category: "Fashion", city: "Karachi", area: "Zamzama", rating: "4.6", reviews: "1.4K", offer: "15% off selected pieces", image: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=900&q=85", description: "Independent Pakistani labels and everyday pieces with a point of view." },
  { id: 6, name: "Coco's Den", category: "Restaurant", city: "Lahore", area: "Walled City", rating: "4.5", reviews: "1.1K", offer: "Sunset high tea for two", image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=85", description: "Classic food and a remarkable rooftop view of the old city." },
  { id: 7, name: "Tinker's Studio", category: "Services", city: "Islamabad", area: "I-8 Markaz", rating: "4.8", reviews: "640", offer: "Free device diagnosis", image: "https://images.unsplash.com/photo-1588702547923-7093a6c3ba33?auto=format&fit=crop&w=900&q=85", description: "Straightforward repairs and practical advice for your everyday technology." },
  { id: 8, name: "Terra Ceramics", category: "Shopping", city: "Karachi", area: "Clifton Block 4", rating: "4.9", reviews: "420", offer: "Gift wrapping included", image: "https://images.unsplash.com/photo-1610701596007-11502861dcfa?auto=format&fit=crop&w=900&q=85", description: "Hand-thrown tableware made in small batches by local ceramic artists." },
];

export type Story = {
  id: number;
  title: string;
  category: string;
  readTime: string;
  date: string;
  excerpt: string;
  image: string;
};

export const stories: Story[] = [
  { id: 1, title: "The new language of Pakistani food content", category: "Digital Culture", readTime: "6 min read", date: "22 Nov 2026", excerpt: "Why a new generation of cooks is swapping spectacle for memory, place and genuinely useful recipes.", image: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=1200&q=85" },
  { id: 2, title: "What Pakistan's creator economy looks like beyond the big numbers", category: "Creators", readTime: "8 min read", date: "20 Nov 2026", excerpt: "A closer look at niche communities, regional voices and the sustainable middle of the creator economy.", image: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?auto=format&fit=crop&w=1200&q=85" },
  { id: 3, title: "A practical guide to Lahore's independent bookshops", category: "City Guide", readTime: "5 min read", date: "18 Nov 2026", excerpt: "Where to browse, what to ask for and the small shops keeping the city's reading culture alive.", image: "https://images.unsplash.com/photo-1526243741027-444d633d7365?auto=format&fit=crop&w=1200&q=85" },
  { id: 4, title: "The small businesses finding customers through community", category: "Local Business", readTime: "7 min read", date: "16 Nov 2026", excerpt: "Three neighbourhood businesses show why trust can be more valuable than reach.", image: "https://images.unsplash.com/photo-1556740749-887f6717d7e4?auto=format&fit=crop&w=1200&q=85" },
  { id: 5, title: "Pakistan's regional travel creators worth following", category: "Travel", readTime: "4 min read", date: "14 Nov 2026", excerpt: "Guides who add context, care and local knowledge to every journey.", image: "https://images.unsplash.com/photo-1486911278844-a81c5267e227?auto=format&fit=crop&w=1200&q=85" },
  { id: 6, title: "How to read an online trend without losing the plot", category: "Fifi Explains", readTime: "6 min read", date: "12 Nov 2026", excerpt: "Reach, growth and engagement are useful signals—but only when you understand what sits behind them.", image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=85" },
];

export const cities = ["All Pakistan", "Karachi", "Lahore", "Islamabad", "Rawalpindi", "Hunza"];
