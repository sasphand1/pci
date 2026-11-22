import type {Metadata} from 'next';
import {PageHeading} from '@pci/ui';

export const metadata:Metadata={title:'Contact'};
export default function Contact(){return <div className="container"><PageHeading eyebrow="Reach us" title="Contact & corrections"/><article className="card readable">
<p>For creator listing corrections, data questions, partnership enquiries or moderation concerns, contact the Pakistan Creator Index team through Rackelto Technologies.</p>
<p><strong>Email:</strong> <a href="mailto:info@rackeltotechnologies.com">info@rackeltotechnologies.com</a></p>
<p><strong>Website:</strong> <a href="https://www.rackeltotechnologies.com/" target="_blank" rel="noopener noreferrer">rackeltotechnologies.com</a></p>
<p><strong>WhatsApp contact:</strong> @rackelto</p>
<p>Live wall messages can also be reported using the built-in reporting function.</p>
</article></div>}
