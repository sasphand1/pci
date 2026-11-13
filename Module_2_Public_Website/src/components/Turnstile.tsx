'use client';
import {useEffect,useRef} from 'react';
type CaptchaApi={render:(element:HTMLElement,options:{sitekey:string;callback:(token:string)=>void;'expired-callback':()=>void;'error-callback':()=>void})=>string;remove:(id:string)=>void};
declare global{interface Window{turnstile?:CaptchaApi}}
const siteKey=process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY||'';
export function Turnstile({onToken}:{onToken:(token:string)=>void}){const host=useRef<HTMLDivElement|null>(null);
 useEffect(()=>{if(!siteKey)return;let active=true;let widget:string|undefined;const render=()=>{if(!active||!host.current||!window.turnstile||widget)return;widget=window.turnstile.render(host.current,{sitekey:siteKey,callback:onToken,'expired-callback':()=>onToken(''),'error-callback':()=>onToken('')});};
 const existing=document.getElementById('pci-turnstile-script') as HTMLScriptElement|null;
 let script=existing;if(!script){script=document.createElement('script');script.id='pci-turnstile-script';script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;document.head.appendChild(script);}
 script.addEventListener('load',render);render();return()=>{active=false;script?.removeEventListener('load',render);if(widget&&window.turnstile)window.turnstile.remove(widget);};
 },[onToken]);
 return <div className="turnstile-widget" aria-label="Bot verification">{siteKey?<div ref={host}/>:<p className="fineprint">Bot verification is not configured in this frontend. Production sign-in requires a Cloudflare Turnstile site key and server-side validation.</p>}</div>;
}
