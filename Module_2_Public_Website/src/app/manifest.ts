import type {MetadataRoute} from 'next';

/** Web-app identity, without claiming installable/offline support. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Pakistan Creator Index',
    short_name: 'PCI',
    description: 'Independent Pakistani creator rankings, profiles and public statistics.',
    start_url: '/',
    scope: '/',
    display: 'browser',
    background_color: '#ffffff',
    theme_color: '#10293a',
    lang: 'en-PK',
  };
}
