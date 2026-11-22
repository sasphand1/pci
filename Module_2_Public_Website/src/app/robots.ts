import type {MetadataRoute} from 'next';
import {canonicalPath} from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {userAgent: '*', allow: '/', disallow: ['/account', '/wall', '/api/', '/admin/', '/verify-email', '/reset-password']},
    sitemap: canonicalPath('/sitemap.xml'),
  };
}
