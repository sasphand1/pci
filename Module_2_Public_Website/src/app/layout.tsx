import type {Metadata} from 'next';
import '@pci/ui/styles.css';
import './public-glass.css';
import './public-stage.css';
import './public-header.css';
import './mobile-app.css';
import './fifi.css';
import {FifiPage} from '@/fifi/FifiPage';
import {SiteHeader,SiteFooter} from '@/fifi/components/site-layout';
import {Toaster} from '@/fifi/components/ui/sonner';
import {siteOrigin} from '@/lib/seo';
import {SiteStructuredData} from '@/components/SiteStructuredData';

export const metadata:Metadata = {
  metadataBase: new URL(siteOrigin()),
  title: {default: 'Fifi — Pakistan Creator Index', template: '%s | Fifi'},
  description: 'Explore independently curated Pakistani YouTube and Instagram creators, public ranking statistics, categories and creator profiles.',
  applicationName: 'Fifi',
  robots: {index: true, follow: true},
  openGraph: {type: 'website', locale: 'en_PK', siteName: 'Fifi', title: 'Fifi — Pakistan Creator Index', description: 'Explore Pakistani creator rankings, public statistics and creator profiles.', url: '/'},
  twitter: {card: 'summary_large_image'},
  verification: {google: process.env.GOOGLE_SITE_VERIFICATION || undefined, other: process.env.BING_SITE_VERIFICATION ? {'msvalidate.01': process.env.BING_SITE_VERIFICATION} : undefined},
};
export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="en"><head><link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous"/><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&display=swap"/></head><body><FifiPage contents><SiteHeader/></FifiPage>{children}<FifiPage><SiteFooter/></FifiPage><FifiPage><Toaster/></FifiPage><SiteStructuredData/></body></html>;
}
