'use client';
import {createContext,useCallback,useContext,useEffect,useMemo,useState,type ReactNode} from 'react';
import {api,errorText} from '@/lib/api';
import {useAuth} from './AuthProvider';
import type {Overview} from '@/lib/types';

const REFRESH_MS=60_000;
type State={data:Overview|null;error:string;loading:boolean;reload:()=>void};
const Context=createContext<State|null>(null);

/** One shared, read-only overview for the top-bar badge and the home page. Polls quietly while the tab is visible. */
export function OverviewProvider({children}:{children:ReactNode}){
 const {identity}=useAuth();const signedIn=identity?.id;
 const [data,setData]=useState<Overview|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 const load=useCallback(async(background:boolean)=>{
  if(!signedIn)return;
  if(!background)setLoading(true);
  try{setData(await api<Overview>('/admin/overview',{background}));setError('');}
  catch(e){setError(errorText(e));}
  finally{setLoading(false);}
 },[signedIn]);
 useEffect(()=>{
  if(!signedIn){setData(null);return;}
  void load(false);
  const timer=setInterval(()=>{if(document.visibilityState==='visible')void load(true);},REFRESH_MS);
  return()=>clearInterval(timer);
 },[signedIn,load]);
 const reload=useCallback(()=>{void load(false);},[load]);
 const value=useMemo(()=>({data,error,loading,reload}),[data,error,loading,reload]);
 return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useOverview(){const v=useContext(Context);if(!v)throw new Error('OverviewProvider missing');return v;}
