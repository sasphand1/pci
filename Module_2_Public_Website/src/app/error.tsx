'use client';
import {useEffect} from 'react';
export default function ErrorPage({error,reset}:{error:Error&{digest?:string};reset:()=>void}){useEffect(()=>{console.error('Public UI error',error.message);},[error]);return <div className="container section"><div className="empty" role="alert"><h2>Something went wrong</h2><p>This view could not be loaded. No information has been changed.</p><button className="btn btn-primary" onClick={reset}>Try again</button></div></div>}
