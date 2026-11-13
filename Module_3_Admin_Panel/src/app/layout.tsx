import type {Metadata} from 'next';
import '@pci/ui/styles.css';
import {AuthProvider} from '@/components/AuthProvider';
import {AdminShell} from '@/components/AdminShell';
export const metadata:Metadata={title:'Management | Pakistan Creator Index',description:'Authorized administration only',robots:{index:false,follow:false}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><a className="skip-link" href="#main">Skip to administration</a><AuthProvider><AdminShell>{children}</AdminShell></AuthProvider></body></html>}
