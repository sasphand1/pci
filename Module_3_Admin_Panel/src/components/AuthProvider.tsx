'use client';
import {createContext,useContext,useState,useEffect,useCallback,useMemo,type ReactNode} from 'react';
import {api,ApiError} from '@/lib/api';
import type {AdminIdentity} from '@/lib/types';

type State={identity:AdminIdentity|null;loading:boolean;login:(email:string,password:string,totp:string)=>Promise<void>;logout:()=>Promise<void>;refresh:()=>Promise<void>};
const Context=createContext<State|null>(null);
export function AuthProvider({children}:{children:ReactNode}){
 const [identity,setIdentity]=useState<AdminIdentity|null>(null);
 const [loading,setLoading]=useState(true);
 const refresh=useCallback(async()=>{try{setIdentity(await api<AdminIdentity>('/admin/auth/me'));}catch{setIdentity(null);}finally{setLoading(false);}},[]);
 useEffect(()=>{void refresh();},[refresh]);
 const login=useCallback(async(email:string,password:string,totp:string)=>{
  const user=await api<AdminIdentity>('/admin/auth/login',{method:'POST',body:{email,password,totp}});
  setIdentity(user);setLoading(false);
 },[]);
 const logout=useCallback(async()=>{if(identity){try{await api('/admin/auth/logout',{method:'POST',csrf:identity.csrfToken});}catch(e){if(!(e instanceof ApiError && e.status===401))throw e;}}setIdentity(null);},[identity]);
 const value=useMemo(()=>({identity,loading,login,logout,refresh}),[identity,loading,login,logout,refresh]);
 return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useAuth(){const value=useContext(Context);if(!value)throw new Error('AuthProvider missing');return value;}
