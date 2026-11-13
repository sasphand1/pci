import type {NextConfig} from 'next';
const nextConfig:NextConfig={
  output:'standalone',transpilePackages:['@pci/ui'],poweredByHeader:false,
  async headers(){return [{source:'/(.*)',headers:[
    {key:'Cache-Control',value:'no-store, max-age=0'},
    {key:'X-Frame-Options',value:'DENY'},
    {key:'X-Content-Type-Options',value:'nosniff'},
    {key:'Referrer-Policy',value:'no-referrer'},
    {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'},
    {key:'Content-Security-Policy',value:"default-src 'self'; img-src 'self' https://i.ytimg.com https://yt3.ggpht.com data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'" + (process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : '') + "; connect-src 'self' " + (process.env.NEXT_PUBLIC_ADAPTER_API_URL || 'http://localhost:8081') + "; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'"}
  ]}];}
};
export default nextConfig;


