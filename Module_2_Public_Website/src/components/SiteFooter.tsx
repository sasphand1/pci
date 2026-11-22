import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="footer pci-corporate-footer">
      <div className="container footer-grid">
        <div className="pci-footer-intro">
          <h3>Pakistan Creator Index</h3>
          <p>Independent creator rankings, public statistics, trends and intelligence for Pakistan&apos;s digital ecosystem.</p>
          <p className="pci-footer-disclaimer">An independent platform. Not affiliated with or endorsed by YouTube or Google. Source statistics may change after refresh.</p>
        </div>
        <nav className="pci-footer-column" aria-label="Footer explore">
          <h3>Explore</h3>
          <Link href="/rankings">Rankings</Link>
          <Link href="/creators">Directory</Link>
          <Link href="/categories">Categories</Link>
          <Link href="/videos">Recent videos</Link>
          <Link href="/events">Events</Link>
          <Link href="/wall">Community wall</Link>
          <Link href="/satellite">Satellite intelligence</Link>
        </nav>
        <nav className="pci-footer-column" aria-label="Footer information">
          <h3>Information</h3>
          <Link href="/methodology">Methodology</Link>
          <Link href="/about">About</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/contact">Contact</Link>
        </nav>
        <div className="pci-footer-column pci-footer-company">
          <h3>Rackelto Technologies</h3>
          <p>Platform technology &amp; data solutions</p>
          <a href="https://www.rackeltotechnologies.com/" target="_blank" rel="noopener noreferrer">rackeltotechnologies.com</a>
          <a href="mailto:info@rackeltotechnologies.com">info@rackeltotechnologies.com</a>
          <span className="pci-footer-contact">WhatsApp: @rackelto</span>
          <span className="pci-footer-contact">United Kingdom</span>
        </div>
      </div>
      <div className="footer-bottom">
        <div className="container pci-footer-bottom-inner">
          <span>© {new Date().getFullYear()} Pakistan Creator Index. All rights reserved.</span>
          <span>Technology by <a href="https://www.rackeltotechnologies.com/" target="_blank" rel="noopener noreferrer">Rackelto Technologies</a></span>
        </div>
      </div>
    </footer>
  );
}
