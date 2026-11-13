import type {MetadataRoute} from 'next';
export default function sitemap():MetadataRoute.Sitemap{const root=process.env.NEXT_PUBLIC_SITE_URL||'http://localhost:3000';return ['','creators','rankings','categories','compare','videos','wall','methodology','about','privacy','terms','contact'].map(p=>({url:`${root}/${p}`,changeFrequency:'daily' as const,priority:p?0.7:1}));}
