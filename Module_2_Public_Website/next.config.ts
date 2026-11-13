import type { NextConfig } from 'next';
const nextConfig: NextConfig={
  output:'standalone',transpilePackages:['@pci/ui'],poweredByHeader:false,
  async headers(){return [{source:'/(.*)',headers:[
    {key:'X-Content-Type-Options',value:'nosniff'},
    {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
    {key:'X-Frame-Options',value:'DENY'},
    {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'},
    {key:'X-Permitted-Cross-Domain-Policies',value:'none'}
  ]}];}
};
export default nextConfig;
