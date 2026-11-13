'use client';
import Link from 'next/link';
import {Card,MetricCard,Badge,Notice} from '@pci/ui';
import {AdminPage,DataBlock,useData} from '@/components/Shared';
import {fmtDate,fmtNum} from '@/lib/api';
import {useAuth} from '@/components/AuthProvider';
import type {Dashboard} from '@/lib/types';
export default function DashboardPage(){
 const {data,error,loading,reload}=useData<Dashboard>('/admin/dashboard');const {identity}=useAuth();
 return <AdminPage title="Operations overview" description="Live backend counts and the latest synchronization status. No placeholder numbers are shown." action={<button className="btn btn-secondary" onClick={reload}>Refresh</button>}>
  <DataBlock loading={loading} error={error} empty={!data}>{data&&<>
   <section className="admin-overview" aria-label="Platform statistics">
    <MetricCard label="Creators" value={fmtNum(data.creators.total)} note={`${fmtNum(data.creators.enabled)} enabled`}/>
    <MetricCard label="Channel snapshots" value={fmtNum(data.statistics.total)} note={`Latest: ${fmtDate(data.statistics.newest)}`}/>
    <MetricCard label="Tracked videos" value={fmtNum(data.videos.total)}/>
    <MetricCard label="Pending wall reports" value={fmtNum(data.pendingReports)} note={`${fmtNum(data.wallMessages24h)} wall messages in 24 h`}/>
   </section>
   <div className="admin-panel-grid">
    <Card><div className="admin-section-header"><h2>Recent sync jobs</h2>{identity?.role!=='moderator'&&<Link className="btn btn-secondary" href="/sync">Manage sync</Link>}</div>
     {data.recentSyncRuns.length===0?<Notice tone="warning">No sync jobs have been executed.</Notice>:<div className="admin-card-stack">{data.recentSyncRuns.map(run=><div className="admin-toolbar" key={run.id}><div><strong>{run.source}</strong><p className="fineprint">{fmtDate(run.created_at)} · {fmtNum(run.quota_used)} quota units</p></div><Badge variant={run.status==='failed'?'danger':'muted'}>{run.status}</Badge></div>)}</div>}
    </Card>
    <Card><h2 className="admin-box-title">Quick operations</h2><div className="admin-card-stack">{identity?.role!=='moderator'&&<Link className="btn btn-secondary" href="/creators">Manage creator registry</Link>}{identity?.role!=='editor'&&<Link className="btn btn-secondary" href="/wall">Review live wall</Link>}<Link className="btn btn-secondary" href="/settings">Review site settings</Link></div><p className="fineprint">Active administrator accounts: {fmtNum(data.activeAdmins)}</p></Card>
   </div>
  </>}</DataBlock>
 </AdminPage>;
}
