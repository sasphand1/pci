import type {Metadata} from 'next';
import {PageHeading} from '@pci/ui';
import {WallRoom} from '@/components/WallRoom';
export const metadata:Metadata={title:'Pakistan Live Wall',description:'One shared public chat wall for the Pakistan Creator Index community.'};
export default function WallPage(){return <div className="container"><PageHeading eyebrow="Live community" title="Pakistan Live Wall" description="One national conversation space. Guests and registered members can participate; this is not YouTube chat or video comments."/><WallRoom/></div>}
