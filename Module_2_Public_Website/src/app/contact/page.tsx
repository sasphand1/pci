import type {Metadata} from 'next';
import {PageHeading,Notice} from '@pci/ui';
export const metadata:Metadata={title:'Contact'};
export default function Contact(){return <div className="container"><PageHeading eyebrow="Reach us" title="Contact & corrections"/><Notice tone="warning">The operator&apos;s verified support email must be configured before launch. No email address has been invented for this placeholder.</Notice><article className="card readable"><p>For a missing creator, a channel attribution correction, or a moderation concern, use the published operator contact details once the site is deployed. Live wall messages should be reported through the built-in report function.</p></article></div>}
