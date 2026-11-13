import type {Metadata} from 'next';
import {PageHeading} from '@pci/ui';
import {AccountControls} from '@/components/AccountControls';
export const metadata:Metadata={title:'Community account',robots:{index:false,follow:false}};
export default function AccountPage(){return <div className="container"><PageHeading eyebrow="Community" title="Your wall account" description="Register, verify your email, sign in, recover your password, or participate as a guest."/><AccountControls/></div>}
