import type {Metadata} from 'next';
import '@pci/ui/styles.css';
import './public-glass.css';
import './public-stage.css';
import './public-header.css';
import './mobile-app.css';
import {SiteHeader} from '@/components/SiteHeader';
import {SiteFooter} from '@/components/SiteFooter';
import {siteOrigin} from '@/lib/seo';

export const metadata:Metadata = {
  metadataBase: new URL(siteOrigin()),
  title: {default: 'Pakistan Creator Index — Pakistani Creator Rankings', template: '%s | Pakistan Creator Index'},
  description: 'Explore independently curated Pakistani YouTube and Instagram creators, public ranking statistics, categories and creator profiles.',
  applicationName: 'Pakistan Creator Index',
  robots: {index: true, follow: true},
  openGraph: {type: 'website', locale: 'en_PK', siteName: 'Pakistan Creator Index', title: 'Pakistan Creator Index — Pakistani Creator Rankings', description: 'Explore Pakistani creator rankings, public statistics and creator profiles.', url: '/'},
  twitter: {card: 'summary_large_image'},
};
export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="en"><body><div className="site-shell"><a className="skip-link" href="#main">Skip to content</a><SiteHeader/><main id="main" className="site-main">{children}</main><SiteFooter/></div></body></html>;
}
