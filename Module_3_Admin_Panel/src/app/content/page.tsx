'use client';
import Link from 'next/link';
import {Card,Notice} from '@pci/ui';
import {AdminPage,RoleGate} from '@/components/Shared';
import {useAuth} from '@/components/AuthProvider';
export default function ContentPage(){const {identity}=useAuth();return <RoleGate roles={['owner','editor']}><AdminPage title="Public website content" description="Editorial controls supported by Module 1. The website reads these settings dynamically and uses the shared design template.">
 <div className="admin-panel-grid"><Card><h2 className="admin-box-title">Homepage announcement</h2><p className="muted">Edit the 500-character announcement from Platform Settings. The public homepage displays it automatically.</p><p><Link className="btn btn-secondary" href="/settings">Open settings</Link></p><p className="fineprint">The adapter currently permits Owner-only updates. {identity?.role==='editor'?'Editors can request an Owner to change it.':''}</p></Card>
 <Card><h2 className="admin-box-title">Featured creators</h2><p className="muted">Set the Featured flag on any creator record; the public homepage reads the featured list from Module 1.</p><p><Link className="btn btn-secondary" href="/creators">Manage creators</Link></p></Card></div>
 <Notice tone="warning">The current adapter does not provide a content-management API for legal pages, header logos or website navigation. Those files are managed in Module 2 using the shared template. No non-functional editing controls are displayed here.</Notice>
 </AdminPage></RoleGate>}
