import Link from 'next/link';

type IconName = 'layers' | 'info' | 'rocket' | 'globe' | 'mail' | 'whatsapp' | 'pin' | 'document' | 'scale' | 'shield' | 'check';
function FooterIcon({name, size = 20}: {name: IconName; size?: number}) {
  const common = {width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true as const};
  switch (name) {
    case 'layers': return <svg {...common}><path d="m12 2 9 6-9 6-9-6 9-6Z"/><path d="m3 12 9 6 9-6M3 16l9 6 9-6"/></svg>;
    case 'info': return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/></svg>;
    case 'rocket': return <svg {...common}><path d="M4.5 15.5 8 12c1-5 5.5-8.5 12-9-0.5 6.5-4 11-9 12l-3.5 3.5-1-4-4-1Z"/><circle cx="15.5" cy="8.5" r="1.5"/><path d="M5 19c-1 0-2 1.5-2 3 1.5 0 3-1 3-2"/></svg>;
    case 'globe': return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c-5 4.5-5 13.5 0 18M12 3c5 4.5 5 13.5 0 18"/></svg>;
    case 'mail': return <svg {...common}><rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="m3 7 9 7 9-7"/></svg>;
    case 'whatsapp': return <svg {...common}><path d="M20 11.5a8.2 8.2 0 0 1-11.9 7.3L3 20l1.3-4.8A8.2 8.2 0 1 1 20 11.5Z"/><path d="M8.5 8.4c.2-.5.5-.5.9-.3l1 .8c.2.2.2.5.1.7l-.5.8c.6 1.3 1.6 2.2 2.9 2.8l.8-.6c.2-.1.5-.1.7.1l.8 1c.2.3.1.7-.2.9-2 1.4-6.3-1.9-7.1-4.4-.3-.8 0-1.4.6-1.8Z"/></svg>;
    case 'pin': return <svg {...common}><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2"/></svg>;
    case 'document': return <svg {...common}><path d="M6 2h8l4 4v16H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z"/><path d="M14 2v5h5M8 12h8M8 16h8"/></svg>;
    case 'scale': return <svg {...common}><path d="M12 3v18M5 6h14M8 6 4 14h8L8 6ZM16 6l-4 8h8l-4-8ZM8 21h8"/></svg>;
    case 'shield': return <svg {...common}><path d="M12 2 20 5v6c0 5-3 8-8 11-5-3-8-6-8-11V5l8-3Z"/><path d="m9 12 2 2 4-4"/></svg>;
    default: return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></svg>;
  }
}

const companyUrl = 'https://www.rackeltotechnologies.com/';

export function SiteFooter() {
  return (
    <footer className="footer pci-panel-footer">
      <div className="container pci-panel-footer-inner">
        <div className="pci-footer-hero">
          <div className="pci-footer-identity">
            <div className="pci-footer-brand-mark" aria-hidden="true"><span>P</span></div>
            <strong>Pakistan<br/>Creator Index</strong>
          </div>
          <p>Independent creator rankings, public statistics, trends and intelligence for Pakistan&apos;s digital ecosystem.</p>
        </div>

        <div className="pci-footer-cards">
          <nav className="pci-footer-panel" aria-label="Explore">
            <h3><FooterIcon name="layers"/> Explore</h3>
            <div className="pci-footer-links">
              <Link href="/rankings">Rankings</Link>
              <Link href="/creators">Directory</Link>
              <Link href="/categories">Categories</Link>
              <Link href="/videos">Recent videos</Link>
              <Link href="/events">Events</Link>
              <Link href="/wall">Community wall</Link>
              <Link href="/satellite">Satellite intelligence</Link>
            </div>
          </nav>
          <nav className="pci-footer-panel" aria-label="Information">
            <h3><FooterIcon name="info"/> Information</h3>
            <div className="pci-footer-links">
              <Link href="/methodology">Methodology</Link>
              <Link href="/about">About</Link>
              <Link href="/contact">Contact</Link>
            </div>
          </nav>
          <div className="pci-footer-panel pci-footer-rackelto">
            <h3><FooterIcon name="rocket"/> Rackelto Technologies Ltd.</h3>
            <p>Platform technology &amp; data solutions</p>
            <div className="pci-footer-socials" aria-label="Rackelto contact links">
              <a href={companyUrl} target="_blank" rel="noopener noreferrer" aria-label="Rackelto Technologies website" title="Website"><FooterIcon name="globe" size={22}/></a>
              <a href="mailto:info@rackeltotechnologies.com" aria-label="Email Rackelto Technologies" title="Email"><FooterIcon name="mail" size={22}/></a>
              <span className="pci-footer-social-placeholder" role="img" aria-label="WhatsApp handle: @rackelto" title="WhatsApp: @rackelto"><FooterIcon name="whatsapp" size={22}/></span>
              <span className="pci-footer-social-placeholder" role="img" aria-label="Located in the United Kingdom" title="United Kingdom"><FooterIcon name="pin" size={22}/></span>
            </div>
            <span className="pci-footer-location">United Kingdom</span>
          </div>
        </div>

        <nav className="pci-footer-legal" aria-label="Legal links">
          <Link href="/license"><FooterIcon name="document" size={18}/> License</Link>
          <Link href="/terms"><FooterIcon name="scale" size={18}/> Terms of Service</Link>
          <Link href="/privacy"><FooterIcon name="shield" size={18}/> Privacy Policy</Link>
          <Link href="/legal-notice"><FooterIcon name="check" size={18}/> Legal Notice</Link>
        </nav>

        <div className="pci-footer-fineprint">
          <span>© {new Date().getFullYear()} Pakistan Creator Index. All rights reserved.</span>
          <span>Built with <a href={companyUrl} target="_blank" rel="noopener noreferrer">Rackelto Technologies Ltd.</a></span>
        </div>
        <p className="pci-footer-disclaimer">Independent platform. Not affiliated with or endorsed by YouTube or Google. Public source statistics may be delayed, rounded or revised.</p>
      </div>
    </footer>
  );
}
