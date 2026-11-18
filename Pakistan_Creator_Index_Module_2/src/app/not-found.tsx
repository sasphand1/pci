import Link from 'next/link';
import {EmptyState} from '@pci/ui';
export default function NotFound(){return <div className="container section"><EmptyState title="Page not found" message="This page may have moved, or the link may be incorrect."><Link href="/" className="btn btn-primary">Back to homepage</Link></EmptyState></div>}
