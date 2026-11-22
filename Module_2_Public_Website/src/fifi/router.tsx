'use client';
import NextLink from 'next/link';
import {usePathname} from 'next/navigation';
import type {AnchorHTMLAttributes, ReactNode} from 'react';

type LinkProps=Omit<AnchorHTMLAttributes<HTMLAnchorElement>,'href'>&{to:string;params?:Record<string,string>;children?:ReactNode};

/** Small stand-in for the design's router Link, so the design's JSX can stay as written. */
export function Link({to,params,children,...rest}:LinkProps){
  let href=to;
  if(params){for(const [k,v] of Object.entries(params))href=href.replace(`$${k}`,encodeURIComponent(v));}
  return <NextLink href={href} {...rest}>{children}</NextLink>;
}
export function useRouterState<T>({select}:{select:(state:{location:{pathname:string}})=>T}):T{
  const pathname=usePathname()||'/';
  return select({location:{pathname}});
}
