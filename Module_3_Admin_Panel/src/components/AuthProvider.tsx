'use client';
import {createContext,useContext,useState,useEffect,useCallback,useMemo,useRef,type ReactNode} from 'react';
import {api,ApiError,SESSION_EXPIRED_EVENT} from '@/lib/api';
import type {AdminIdentity} from '@/lib/types';

const CHANNEL='pci-admin-session';
type State={
 identity:AdminIdentity|null;loading:boolean;notice:string;clearNotice:()=>void;
 login:(email:string,password:string,totp:string)=>Promise<void>;
 logout:(notice?:string)=>Promise<void>;
 refresh:()=>Promise<void>;
 /** Asks the server to extend the idle window. Only for an explicit user action. */
 keepAlive:()=>Promise<void>;
};
const Context=createContext<State|null>(null);
export function AuthProvider({children}:{children:ReactNode}){
 const [identity,setIdentity]=useState<AdminIdentity|null>(null);
 const [loading,setLoading]=useState(true);
 const [notice,setNotice]=useState('');
 const channel=useRef<BroadcastChannel|null>(null);
 const tell=useCallback((message:'login'|'logout')=>{try{channel.current?.postMessage(message);}catch{/* other tabs just stay as they are */}},[]);
 const refresh=useCallback(async()=>{try{setIdentity(await api<AdminIdentity>('/admin/auth/me'));}catch{setIdentity(null);}finally{setLoading(false);}},[]);
 useEffect(()=>{void refresh();},[refresh]);

 // Any request answered with 401 means the server ended the session: go back to the sign-in screen.
 useEffect(()=>{
  const ended=()=>{setIdentity(null);setLoading(false);setNotice('Your session ended. Sign in again.');};
  window.addEventListener(SESSION_EXPIRED_EVENT,ended);
  return()=>window.removeEventListener(SESSION_EXPIRED_EVENT,ended);
 },[]);

 // Several tabs share one session cookie. Signing out in one signs out all; signing in refreshes the others (new CSRF token).
 useEffect(()=>{
  if(typeof BroadcastChannel==='undefined')return;
  const c=new BroadcastChannel(CHANNEL);channel.current=c;
  c.onmessage=(e:MessageEvent)=>{
   if(e.data==='logout'){setIdentity(null);setLoading(false);setNotice('You signed out in another tab.');}
   else if(e.data==='login'){void refresh();}
  };
  return()=>{c.close();channel.current=null;};
 },[refresh]);

 const login=useCallback(async(email:string,password:string,totp:string)=>{
  const user=await api<AdminIdentity>('/admin/auth/login',{method:'POST',body:{email,password,totp}});
  setIdentity(user);setLoading(false);setNotice('');tell('login');
 },[tell]);
 const logout=useCallback(async(message?:string)=>{
  const current=identity;
  setIdentity(null);setNotice(message??'');tell('logout');
  if(current){try{await api('/admin/auth/logout',{method:'POST',csrf:current.csrfToken});}catch(e){if(!(e instanceof ApiError&&e.status===401))throw e;}}
 },[identity,tell]);
 const keepAlive=useCallback(async()=>{
  const fresh=await api<AdminIdentity>('/admin/auth/me');
  setIdentity(prev=>prev?{...prev,session:fresh.session}:fresh);
 },[]);
 const clearNotice=useCallback(()=>setNotice(''),[]);
 const value=useMemo(()=>({identity,loading,notice,clearNotice,login,logout,refresh,keepAlive}),[identity,loading,notice,clearNotice,login,logout,refresh,keepAlive]);
 return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useAuth(){const value=useContext(Context);if(!value)throw new Error('AuthProvider missing');return value;}
