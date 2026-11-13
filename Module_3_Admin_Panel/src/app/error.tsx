'use client';
import {Notice} from '@pci/ui';
export default function ErrorPage({reset}:{error:Error&{digest?:string};reset:()=>void}){return <Notice tone="danger">The management page failed to render. <button className="btn btn-secondary" onClick={reset}>Retry</button></Notice>}
