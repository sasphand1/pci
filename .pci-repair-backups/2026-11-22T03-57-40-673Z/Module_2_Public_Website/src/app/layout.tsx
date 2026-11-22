import type {Metadata} from 'next';
import '@pci/ui/styles.css';
import './public-glass.css';
import './public-stage.css';
import {SiteHeader} from '@/components/SiteHeader';
import {SiteFooter} from '@/components/SiteFooter';
const site=process.env.NEXT_PUBLIC_SITE_URL||'http://localhost:3000';
export const metadata:Metadata={metadataBase:new URL(site),title:{default:'Pakistan Creator Index — Pakistani YouTube creators',template:'%s | Pakistan Creator Index'},description:'A curated independent directory of Pakistani YouTube creators, public channel statistics, and a shared community wall.',robots:{index:true,follow:true},openGraph:{type:'website',locale:'en_PK',siteName:'Pakistan Creator Index'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><div className="site-shell"><a className="skip-link" href="#main">Skip to content</a><SiteHeader/><main id="main" className="site-main">{children}</main><SiteFooter/></div></body></html>}
