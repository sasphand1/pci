'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {useAuth} from './AuthProvider';
import {errorText} from '@/lib/api';
import {DEFAULT_IDLE_SECONDS,clock,idleState,type IdleState} from '@/lib/session';

const ACTIVITY=['pointerdown','keydown','wheel','touchstart'] as const;

/**
 * Ends the session after inactivity, warns one minute before, and warns before the absolute session limit.
 * Background polling is not activity. Only the person's own clicks, keys, scrolling and touches are.
 * Time is held in memory only; nothing is written to browser storage.
 */
export function SessionGuard(){
 const {identity,logout,keepAlive}=useAuth();
 const last=useRef(Date.now());
 const [state,setState]=useState<IdleState>({kind:'active'});
 const [error,setError]=useState('');
 const idleSeconds=identity?.session?.idleSeconds??DEFAULT_IDLE_SECONDS;
 const expiresAt=identity?.session?.expiresAt?Date.parse(identity.session.expiresAt):null;
 const warning=state.kind==='idle-warning'||state.kind==='limit-warning';
 const warningRef=useRef(false);
 useEffect(()=>{warningRef.current=warning;},[warning]);

 const check=useCallback(()=>{
  const next=idleState(Date.now(),last.current,idleSeconds,expiresAt);
  if(next.kind==='idle-expired'){void logout('You were signed out after a period of inactivity.').catch(()=>undefined);return;}
  if(next.kind==='limit-expired'){void logout('Your session reached its time limit. Sign in again.').catch(()=>undefined);return;}
  setState(prev=>prev.kind===next.kind&&('secondsLeft' in prev?prev.secondsLeft:0)===('secondsLeft' in next?next.secondsLeft:0)?prev:next);
 },[idleSeconds,expiresAt,logout]);

 useEffect(()=>{
  if(!identity)return;
  last.current=Date.now();
  // While the warning is open, ordinary activity does not silently dismiss it: the person must choose.
  const touch=()=>{if(!warningRef.current)last.current=Date.now();};
  for(const e of ACTIVITY)window.addEventListener(e,touch,{passive:true});
  const timer=setInterval(check,1000);
  const visible=()=>{if(document.visibilityState==='visible')check();};
  document.addEventListener('visibilitychange',visible);
  return()=>{for(const e of ACTIVITY)window.removeEventListener(e,touch);clearInterval(timer);document.removeEventListener('visibilitychange',visible);};
 },[identity,check]);

 async function stay(){
  setError('');
  try{await keepAlive();last.current=Date.now();setState({kind:'active'});}
  catch(e){setError(errorText(e));}
 }
 if(!identity||!warning)return null;
 const left=state.kind==='idle-warning'||state.kind==='limit-warning'?state.secondsLeft:0;
 const idle=state.kind==='idle-warning';
 return <div className="glass-overlay" role="presentation"><div className="glass-dialog" role="alertdialog" aria-modal="true" aria-labelledby="session-title" aria-describedby="session-text">
  <h2 id="session-title">{idle?'Still there?':'Session ending soon'}</h2>
  <p id="session-text">{idle?`You will be signed out for your security in ${clock(left)} because there has been no activity.`:`Your session reaches its maximum length in ${clock(left)}. Finish what you are doing, then sign in again.`}</p>
  {error&&<p className="glass-error" role="alert">{error}</p>}
  <div className="glass-actions">
   {idle&&<button type="button" className="btn btn-primary" autoFocus onClick={stay}>Stay signed in</button>}
   <button type="button" className="btn btn-secondary" autoFocus={!idle} onClick={()=>{void logout('You signed out.').catch(()=>undefined);}}>Sign out now</button>
  </div>
 </div></div>;
}
