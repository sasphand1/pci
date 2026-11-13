'use client';
import {useState} from 'react';
import {Card,Badge} from '@pci/ui';
import {AdminPage,DataBlock,Status,TableWrap,useData,BusyButton,RoleGate} from '@/components/Shared';
import {api,errorText} from '@/lib/api';
import {useAuth} from '@/components/AuthProvider';
import type {Category} from '@/lib/types';
type Form={slug:string;label:string;description:string;displayOrder:number;active:boolean};
const initial:Form={slug:'',label:'',description:'',displayOrder:0,active:true};
export default function CategoriesPage(){
 const {identity}=useAuth();const list=useData<Category[]>('/admin/categories');const [id,setId]=useState<string|null>(null),[form,setForm]=useState<Form>(initial),[saving,setSaving]=useState(false),[error,setError]=useState(''),[ok,setOk]=useState('');
 function edit(c:Category){setId(c.id);setForm({slug:c.slug,label:c.label,description:c.description,displayOrder:c.display_order,active:c.active});}
 function reset(){setId(null);setForm(initial);}
 async function submit(e:React.FormEvent){e.preventDefault();setSaving(true);setError('');setOk('');try{await api(id?`/admin/categories/${id}`:'/admin/categories',{method:id?'PATCH':'POST',csrf:identity?.csrfToken,body:form});setOk(id?'Category updated.':'Category created.');list.reload();reset();}catch(e){setError(errorText(e));}finally{setSaving(false);}}
 return <RoleGate roles={['owner','editor']}><AdminPage title="Editorial categories" description="Maintain the seven starting sections, their names, ordering and availability. Changes appear on the public website.">
  <Status error={error} ok={ok}/>
  <div className="admin-panel-grid"><Card><h2 className="admin-box-title">{id?'Edit category':'Create category'}</h2><form className="form" onSubmit={submit}>
   <div className="admin-form-grid">
    <div className="field"><label htmlFor="cat-label">Name</label><input id="cat-label" required minLength={2} maxLength={100} value={form.label} onChange={e=>setForm(p=>({...p,label:e.target.value}))}/></div>
    <div className="field"><label htmlFor="cat-slug">Slug</label><input id="cat-slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" minLength={2} maxLength={100} value={form.slug} onChange={e=>setForm(p=>({...p,slug:e.target.value}))}/></div>
    <div className="field admin-form-wide"><label htmlFor="cat-desc">Description</label><textarea id="cat-desc" maxLength={1000} value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))}/></div>
    <div className="field"><label htmlFor="cat-order">Display order</label><input id="cat-order" type="number" min={0} max={999} value={form.displayOrder} onChange={e=>setForm(p=>({...p,displayOrder:Number(e.target.value)}))}/></div>
    <label className="admin-check"><input type="checkbox" checked={form.active} onChange={e=>setForm(p=>({...p,active:e.target.checked}))}/>Visible to visitors</label>
   </div><div className="admin-inline-actions"><BusyButton busy={saving}>{id?'Save changes':'Add category'}</BusyButton>{id&&<button type="button" className="btn btn-secondary" onClick={reset}>Cancel edit</button>}</div>
  </form></Card><Card><h2 className="admin-box-title">Publication rules</h2><p className="muted">Categories are editorial navigation labels, not automated assessments of a creator’s private beliefs or political affiliation.</p><p className="muted">Disabling a category removes it from public navigation. Existing creator associations remain available to administrators.</p></Card></div>
  <Card><h2 className="admin-box-title">Category directory</h2><DataBlock loading={list.loading} error={list.error} empty={!list.data?.length}><TableWrap><thead><tr><th>Label</th><th>Slug</th><th>Order</th><th>Availability</th><th>Action</th></tr></thead><tbody>{list.data?.map(c=><tr key={c.id}><td>{c.label}</td><td>{c.slug}</td><td>{c.display_order}</td><td><Badge variant={c.active?'normal':'danger'}>{c.active?'Visible':'Hidden'}</Badge></td><td><button className="btn btn-secondary" onClick={()=>edit(c)}>Edit</button></td></tr>)}</tbody></TableWrap></DataBlock></Card>
 </AdminPage></RoleGate>;
}
