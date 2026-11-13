'use client';
import {Card} from '@pci/ui';
import {AdminPage,DataBlock,TableWrap,useData,RoleGate} from '@/components/Shared';
import {fmtDate} from '@/lib/api';
import type {AuditEntry} from '@/lib/types';
export default function AuditPage(){const list=useData<AuditEntry[]>('/admin/audit-logs?limit=200');return <RoleGate roles={['owner']}><AdminPage title="Administrative audit log" description="Security-relevant operations recorded by Module 1. This page is read-only." action={<button className="btn btn-secondary" onClick={list.reload}>Reload</button>}>
 <Card><DataBlock loading={list.loading} error={list.error} empty={!list.data?.length}><TableWrap><thead><tr><th>Time (PKT)</th><th>Operation</th><th>Actor</th><th>Subject</th><th>Metadata</th></tr></thead><tbody>{list.data?.map(entry=><tr key={entry.id}><td>{fmtDate(entry.created_at)}</td><td><strong>{entry.action}</strong></td><td className="admin-code small">{entry.actor_id||'system'}</td><td className="small">{entry.subject||'—'}</td><td><pre className="admin-json">{JSON.stringify(entry.metadata,null,2)}</pre></td></tr>)}</tbody></TableWrap></DataBlock></Card>
 </AdminPage></RoleGate>}
