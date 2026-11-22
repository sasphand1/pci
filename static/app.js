'use strict';
const token = document.querySelector('meta[name="csrf-token"]').content;
const form = document.querySelector('#proxy-form');
const rows = document.querySelector('#proxy-rows');
const alerts = document.querySelector('#alert');
const addButton = document.querySelector('#add-button');
const testAllButton = document.querySelector('#test-all');
const cancelEditButton = document.querySelector('#cancel-edit');
let profiles = [];
let hostIP = null;
let loading = new Set();
let editingId = null;
let editingNoteId = null;
let launchBusy = new Set();

const h = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const message = (msg, hide = false) => {
  alerts.textContent = msg;
  alerts.classList.toggle('hidden', hide || !msg);
};
async function api(url, options={}) {
  const response = await fetch(url, {
    ...options,
    headers: { 'X-Local-Token': token, ...(options.body ? {'Content-Type': 'application/json'} : {}), ...(options.headers || {}) },
    cache: 'no-store'
  });
  let data;
  try { data = await response.json(); } catch { data = {}; }
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}
function upsert(updated) {
  const index = profiles.findIndex(p => p.id === updated.id);
  if(index === -1) profiles.push(updated);
  else profiles[index] = updated;
  render();
}
function drawStatus(p) {
  const statuses = {connected:'Connected', failed:'Failed', checking:'Checking', untested:'Not tested'};
  const status = loading.has(p.id) ? 'checking' : p.status;
  return `<span class="status ${h(status)}">${h(statuses[status] || 'Unknown')}</span>`;
}
function render() {
  const connected = profiles.filter(p => p.status === 'connected');
  const ips = connected.filter(p => p.ip).map(p => p.ip);
  const counts = new Map();
  ips.forEach(ip => counts.set(ip, (counts.get(ip) || 0) + 1));
  document.querySelector('#stat-total').textContent = profiles.length;
  document.querySelector('#stat-connected').textContent = connected.length;
  document.querySelector('#stat-unique').textContent = counts.size;
  document.querySelector('#count-tag').textContent = profiles.length;
  document.querySelector('#empty-state').classList.toggle('hidden', profiles.length > 0);
  document.querySelector('#duplicate-warning').textContent = counts.size < ips.length ? '⚠ Two or more profiles share the same exit IP' : (hostIP && ips.includes(hostIP) ? '⚠ At least one proxy uses your direct public IP' : '');
  rows.innerHTML = profiles.map(p => {
    const loc = [p.city, p.country].filter(Boolean).join(', ') || '—';
    const ip = p.ip || '—';
    const time = p.latency_ms == null ? '—' : `${p.latency_ms} ms`;
    const pBusy = loading.has(p.id);
    return `<tr>
      <td><div class="profile-title">${h(p.name)}</div><div class="endpoint" title="${h(p.server)}">${h(p.server)}</div></td>
      <td>${drawStatus(p)}</td>
      <td><div class="ip">${h(ip)}</div>${(p.status === 'failed' || (hostIP && ip === hostIP)) ? `<span class="isp">${p.status === 'failed' ? h(p.error || '') : 'Matches host IP'}</span>` : ''}</td>
      <td><div class="location">${h(loc)}</div><span class="isp">${h(p.isp || '')}</span></td>
      <td>${h(time)}</td>
      <td class="note-cell">${editingNoteId === p.id ? `
        <div class="note-editor"><textarea class="note-input" maxlength="300" rows="2" placeholder="Optional QA comment">${h(p.note || '')}</textarea>
        <div class="note-actions"><button class="table-button" data-action="save-note" data-id="${h(p.id)}">Save</button><button class="table-button" data-action="cancel-note" data-id="${h(p.id)}">Cancel</button></div></div>` : `
        <div class="note-display" title="${h(p.note || '')}">${h(p.note || 'No comment')}</div>
        <div class="note-actions"><button class="table-button" data-action="edit-note" data-id="${h(p.id)}">${p.note ? 'Edit' : 'Add'}</button>${p.note ? `<button class="table-button delete" data-action="delete-note" data-id="${h(p.id)}">Delete note</button>` : ''}</div>`}</td>
      <td><div class="buttons"><button class="table-button" data-action="check" data-id="${h(p.id)}" ${pBusy ? 'disabled' : ''}>${pBusy ? 'Testing...' : 'Test'}</button><button class="table-button" data-action="edit" data-id="${h(p.id)}">Edit</button><button class="table-button launch" title="Open Chromium through this proxy" data-action="launch" data-id="${h(p.id)}" ${p.status !== 'connected' || pBusy || launchBusy.has(p.id + ':chromium') ? 'disabled' : ''}>${launchBusy.has(p.id + ':chromium') ? 'Launching...' : 'Open Chromium'}</button><button class="table-button launch" title="Open normal Microsoft Edge with a dedicated profile and US proxy" data-action="launch-youtube" data-id="${h(p.id)}" ${p.status !== 'connected' || pBusy || launchBusy.has(p.id + ':msedge') ? 'disabled' : ''}>${launchBusy.has(p.id + ':msedge') ? 'Launching...' : 'Open Edge (US proxy)'}</button><button class="table-button delete" title="Remove proxy (does not delete browser data)" data-action="delete" data-id="${h(p.id)}">Remove</button></div></td>
    </tr>`;
  }).join('');
}
async function testProxy(id) {
  loading.add(id); render();
  try {
    const updated = await api(`/api/proxies/${encodeURIComponent(id)}/check`, {method:'POST'});
    upsert(updated);
    if(updated.status === 'failed') message(`${updated.name}: ${updated.error}`);
  } catch(e) {
    message(e.message);
  } finally {
    loading.delete(id); render();
  }
}
form.addEventListener('submit', async event => {
  event.preventDefault();
  addButton.disabled = true;
  message('', true);
  const fd = new FormData(form);
  const data = Object.fromEntries(fd.entries());
  try {
    const saved = editingId
      ? await api(`/api/proxies/${editingId}`, {method:'PUT', body:JSON.stringify(data)})
      : await api('/api/proxies', {method:'POST', body:JSON.stringify(data)});
    resetEdit();
    upsert(saved);
    await testProxy(saved.id);
  } catch(e) {
    message(e.message);
  } finally {
    addButton.disabled = false;
  }
});
function resetEdit() {
  editingId = null;
  form.reset();
  addButton.textContent = '+ Add & test proxy';
  cancelEditButton.classList.add('hidden');
}
cancelEditButton.addEventListener('click', resetEdit);
rows.addEventListener('click', async e => {
  const button = e.target.closest('button[data-action]');
  if (!button) return;
  const {id,action} = button.dataset;
  if (action === 'check') return testProxy(id);
  if (action === 'edit') {
    const item = profiles.find(p => p.id === id);
    if (!item) return;
    editingId = id;
    form.elements['name'].value = item.name;
    form.elements['server'].value = item.server;
    form.elements['username'].value = '';
    form.elements['password'].value = '';
    addButton.textContent = 'Save & test proxy';
    cancelEditButton.classList.remove('hidden');
    document.querySelector('.add-panel').scrollIntoView({behavior:'smooth'});
    message('Edit the endpoint if needed, and reenter proxy credentials. Passwords are not saved.');
    return;
  }
  if (action === 'edit-note') {
    editingNoteId = id; render();
    const input = rows.querySelector('button[data-action="save-note"][data-id="'+id+'"]')?.closest('.note-cell')?.querySelector('textarea');
    input?.focus();
    return;
  }
  if (action === 'cancel-note') { editingNoteId = null; render(); return; }
  if (action === 'save-note') {
    const textarea = button.closest('.note-cell')?.querySelector('textarea');
    try {
      const updated = await api(`/api/proxies/${id}/note`, {method:'PUT', body:JSON.stringify({note:textarea?.value ?? ''})});
      editingNoteId = null; upsert(updated); message('Comment saved.');
    } catch (err) { message(err.message); }
    return;
  }
  if (action === 'delete-note') {
    try {
      const updated = await api(`/api/proxies/${id}/note`, {method:'DELETE'});
      editingNoteId = null; upsert(updated); message('Comment deleted.');
    } catch (err) { message(err.message); }
    return;
  }
  if (action === 'launch' || action === 'launch-youtube') {
    const browser = action === 'launch-youtube' ? 'msedge' : 'chromium';
    const key = id + ':' + browser;
    if(launchBusy.has(key)) return;
    launchBusy.add(key); render();
    message(browser === 'msedge' ? 'Starting normal Edge and checking the US proxy before launch...' : 'Starting Chromium and verifying its proxy IP...');
    try {
      const result = await api(`/api/proxies/${id}/launch`, {method:'POST', body:JSON.stringify({browser})});
      message(browser === 'msedge' ? `Normal Edge opened. Proxy precheck: ${result.exit_ip}. Check its IP tab, then sign in normally.` : `Chromium opened in an independent profile. Verified public IP: ${result.exit_ip}`);
    } catch(err) {
      message(err.message);
    } finally {
      launchBusy.delete(key); render();
    }
    return;
  }
  if (action === 'delete') {
    try {
      await api(`/api/proxies/${id}`, {method:'DELETE'});
      profiles = profiles.filter(p => p.id !== id);
      if (editingId === id) resetEdit();
      render();
    } catch(err) { message(err.message); }
  }
});
testAllButton.addEventListener('click', async () => {
  testAllButton.disabled = true;
  message('', true);
  const ids = profiles.map(p => p.id);
  // Limit checks to 3 at once to avoid unnecessary load on small laptops.
  let offset = 0;
  async function worker() {
    while(offset < ids.length) {
      const id = ids[offset++];
      await testProxy(id);
    }
  }
  await Promise.all(Array.from({length:Math.min(3, ids.length)}, worker));
  testAllButton.disabled = false;
});
document.querySelector('#check-host').addEventListener('click', async () => {
  const display = document.querySelector('#host-ip');
  display.textContent = 'Checking...';
  try {
    const data = await api('/api/host-ip');
    hostIP = data.ip; display.textContent = hostIP; render();
  } catch(err) {
    display.textContent = 'Unavailable'; message(err.message);
  }
});
(async () => {
  try { profiles = await api('/api/proxies'); render(); }
  catch(err) { message('Could not load profiles: ' + err.message); }
})();
