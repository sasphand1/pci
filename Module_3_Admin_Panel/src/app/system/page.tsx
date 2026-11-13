'use client';
import {Card,MetricCard,Notice,Badge} from '@pci/ui';
import {AdminPage,DataBlock,useData,RoleGate} from '@/components/Shared';
import {fmtDate,fmtNum} from '@/lib/api';
import type {Health} from '@/lib/types';
import {ADAPTER_API} from '@/lib/api';
export default function SystemPage(){const health=useData<Health>('/admin/system-health');
 return <RoleGate roles={['owner']}><AdminPage title="System health" description="Read-only operational health reported by Module 1. Refresh to request a current result." action={<button className="btn btn-secondary" onClick={health.reload}>Refresh checks</button>}>
 <DataBlock loading={health.loading} error={health.error} empty={!health.data}>{health.data&&<><div className="admin-overview"><MetricCard label="Database" value={health.data.database}/><MetricCard label="Redis" value={health.data.redis}/><MetricCard label="API quota, past 24h" value={fmtNum(health.data.quotaEstimatedLast24h)}/><MetricCard label="YouTube sync" value={health.data.syncEnabled?'Configured on':'Disabled'}/></div>
  <Card><h2 className="admin-box-title">Health checks</h2><div className="admin-list"><p>Database time: <strong>{fmtDate(health.data.databaseTime)}</strong></p><p>YouTube key: <Badge variant={health.data.youtubeKeyConfigured?'normal':'danger'}>{health.data.youtubeKeyConfigured?'Configured':'Missing'}</Badge></p><p>Redis: <Badge variant={health.data.redis==='ok'?'normal':'danger'}>{health.data.redis}</Badge></p><p>Backend API: <span className="admin-code">{ADAPTER_API}</span></p></div></Card></>}</DataBlock>
 <Notice tone="warning">This panel does not replace database backups, TLS, reverse-proxy access controls, live monitoring or security reviews. See the deployment checklist.</Notice>
 </AdminPage></RoleGate>;
}
