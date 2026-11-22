import {siteOrigin} from '@/lib/seo';

/** WebSite markup only. Do not assert a registered legal entity or offer SearchAction without a verified search URL. */
export function SiteStructuredData() {
  const base = siteOrigin();
  const data = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${base}/#website`,
    name: 'Pakistan Creator Index',
    alternateName: 'PCI',
    url: `${base}/`,
    description: 'Independent Pakistani creator rankings, profiles and publicly reported statistics.',
    inLanguage: 'en-PK',
  };
  // Safeguard JSON injection in an HTML script element.
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return <script type="application/ld+json" dangerouslySetInnerHTML={{__html: json}} />;
}
