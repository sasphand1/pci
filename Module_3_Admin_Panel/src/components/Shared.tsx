'use client';
import {useCallback,useEffect,useState,type ReactNode} from 'react';
import {PageHeading,Notice,EmptyState} from '@pci/ui';
import {api,errorText} from '@/lib/api';
import {useAuth} from './AuthProvider';

export function AdminPage({title,description,children,action}:{title:string;description?:string;children:ReactNode;action?:ReactNode}){return <><PageHeading title={title} description={description} action={action}/><div className="admin-page-stack">{children}</div></>}
export function Status({error,ok}:{error?:string;ok?:string}){return <>{error&&<Notice tone="danger">{error}</Notice>}{ok&&<Notice>{ok}</Notice>}</>}
export function ConfirmButton({label,onConfirm,confirmText,variant='danger'}:{label:string;onConfirm:()=>Promise<void>;confirmText:string;variant?:'danger'|'secondary'}){
 const [busy,setBusy]=useState(false);
 return <button type="button" className={`btn btn-${variant}`} disabled={busy} onClick={async()=>{if(!window.confirm(confirmText))return;setBusy(true);try{await onConfirm();}finally{setBusy(false);}}}>{busy?'Working…':label}</button>;
}
export function useData<T>(path:string,enabled=true){
 const {identity}=useAuth();const [data,setData]=useState<T|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[revision,setRevision]=useState(0);
 const reload=useCallback(()=>setRevision(v=>v+1),[]);
 useEffect(()=>{if(!enabled||!identity){setLoading(false);return;}let active=true;setLoading(true);setError('');
  api<T>(path).then(d=>{if(active)setData(d);}).catch(e=>{if(active)setError(errorText(e));}).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[path,enabled,revision,identity?.id]);
 return {data,error,loading,reload,setData};
}
export function DataBlock({loading,error,empty,children}:{loading:boolean;error:string;empty:boolean;children:ReactNode}){if(loading)return <p role="status" className="muted">Loading live backend data…</p>;if(error)return <Notice tone="danger">{error}</Notice>;if(empty)return <EmptyState title="No records yet" message="No matching records are currently available from Module 1."/>;return <>{children}</>;}
export function RoleGate({roles,children}:{roles:('owner'|'editor'|'moderator')[];children:ReactNode}){const {identity}=useAuth();return identity&&roles.includes(identity.role)?<>{children}</>:<Notice tone="warning">Your administrator role cannot access this section.</Notice>}
export function Field({label,children,hint}:{label:string;children:ReactNode;hint?:string}){return <div className="field"><label>{label}</label>{children}{hint&&<span className="field-hint">{hint}</span>}</div>}
export function Fieldset({title,children}:{title:string;children:ReactNode}){return <fieldset className="admin-fieldset"><legend>{title}</legend>{children}</fieldset>}
export function TableWrap({children}:{children:ReactNode}){return <div className="table-wrap"><table className="data-table admin-table">{children}</table></div>}
export function BusyButton({busy,children}:{busy:boolean;children:ReactNode}){return <button className="btn btn-primary" type="submit" disabled={busy}>{busy?'Saving…':children}</button>}
