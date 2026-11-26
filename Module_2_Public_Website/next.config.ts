import type { NextConfig } from 'next';
const nextConfig: NextConfig={
  output:'standalone',transpilePackages:['@pci/ui'],poweredByHeader:false,
  async redirects(){return [{source:'/events.html',destination:'/events',permanent:true},{source:'/satellite',destination:'/satify',permanent:true}];},
  async headers(){return [{source:'/(.*)',headers:[
    {key:'X-Content-Type-Options',value:'nosniff'},
    {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
    {key:'X-Frame-Options',value:'SAMEORIGIN'},
    {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=(self)'},
    {key:'X-Permitted-Cross-Domain-Policies',value:'none'}
  ]},
  {source:'/:path(events-radar.html|satellite-map.html)',headers:[{key:'X-Robots-Tag',value:'noindex, follow'}]},
  {source:'/:path(account|wall|verify-email|reset-password|admin)',headers:[{key:'X-Robots-Tag',value:'noindex, nofollow'}]},
  {source:'/(.*)',headers:[{key:'Strict-Transport-Security',value:'max-age=31536000'}]}];}
};
export default nextConfig;
