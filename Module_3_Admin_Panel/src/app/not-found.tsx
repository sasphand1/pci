import Link from 'next/link';
export default function Missing(){return <div className="card"><h1>Page not found</h1><p className="muted">This management page does not exist.</p><Link className="btn btn-secondary" href="/">Return to dashboard</Link></div>}
