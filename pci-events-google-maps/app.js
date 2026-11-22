'use strict';

// IMPORTANT: Every event below is a fictional example, not a verified event.
// Venue names and approximate coordinates are used only to demonstrate interaction.
// In production replace DEMO_EVENTS with PCI-verified events from your own backend.
const DEMO_EVENTS = [
  {id:'khi-expo', name:'Karachi Design Expo', city:'Karachi', category:'expos', date:'2027-01-17', time:'10:00 AM', venue:'Karachi Expo Centre', lat:24.9019, lng:67.0765, ticket:'paid', price:'PKR 1,500', x:32.0, y:67.0, description:'A fictional exhibition listing to preview how ticket details appear.'},
  {id:'khi-sport', name:'Karachi Cricket Day', city:'Karachi', category:'sports', date:'2027-02-05', time:'04:00 PM', venue:'National Bank Cricket Arena', lat:24.8936, lng:67.0658, ticket:'free', price:null, x:24.5, y:82.5, description:'A fictional sports event used for the interactive map prototype.'},
  {id:'lhe-arts', name:'Lahore Creative Week', city:'Lahore', category:'arts', date:'2027-01-22', time:'06:30 PM', venue:'Alhamra Arts Council', lat:31.5599, lng:74.3240, ticket:'free', price:null, x:67.0, y:56.5, description:'A fictional city arts gathering to demonstrate free-entry cards.'},
  {id:'lhe-forum', name:'Lahore Founders Forum', city:'Lahore', category:'conferences', date:'2027-02-10', time:'09:00 AM', venue:'Expo Centre Lahore', lat:31.4539, lng:74.2596, ticket:'paid', price:'PKR 2,500', x:79.0, y:67.0, description:'A fictional startup and business conference placeholder.'},
  {id:'isb-tech', name:'Capital Tech Showcase', city:'Islamabad', category:'conferences', date:'2027-01-28', time:'10:30 AM', venue:'Pak-China Friendship Centre', lat:33.7048, lng:73.0871, ticket:'paid', price:'PKR 3,000', x:70.0, y:33.8, description:'A fictional technology showcase used for the Google Maps demo.'},
  {id:'isb-heritage', name:'Islamabad Heritage Fair', city:'Islamabad', category:'community', date:'2027-02-12', time:'12:00 PM', venue:'Lok Virsa Museum', lat:33.6889, lng:73.0713, ticket:'free', price:null, x:83.0, y:45.6, description:'A fictional heritage fair; all sample details are placeholders.'},
];

const CATEGORIES = [
  {id:'all', label:'All Events'},
  {id:'sports',label:'Sports'},
  {id:'arts',label:'Arts & Culture'},
  {id:'expos',label:'Expos & Business'},
  {id:'conferences',label:'Conferences & Workshops'},
  {id:'community',label:'Community & Festivals'}
];
const CITY_LIST = ['All Cities','Karachi','Lahore','Islamabad'];
const CENTERS = {
  Karachi:{lat:24.8936,lng:67.0529},
  Lahore:{lat:31.5204,lng:74.3587},
  Islamabad:{lat:33.6844,lng:73.0479},
  Pakistan:{lat:29.1,lng:69.7}
};
const state = {category:'all',city:'All Cities',query:'',mode:'preview',map:null,overlays:[],pinnedId:null,previewScale:1,loading:false};
const $ = selector => document.querySelector(selector);

function escapeHtml(input){return String(input).replace(/[&<>"']/g, ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));}
function categoryLabel(id){return CATEGORIES.find(c=>c.id===id)?.label || 'Event';}
function eligibleEvents(){return DEMO_EVENTS.filter(event =>
  (state.category==='all'||event.category===state.category) &&
  (state.city==='All Cities'||event.city===state.city) &&
  `${event.name} ${event.venue} ${event.city}`.toLowerCase().includes(state.query)
);}
function countByCity(city){return DEMO_EVENTS.filter(event =>
  (state.category==='all'||event.category===state.category) &&
  (city==='All Cities'||event.city===city) &&
  `${event.name} ${event.venue} ${event.city}`.toLowerCase().includes(state.query)
).length;}
function cardTicket(event){
  if(event.ticket==='free') return '<span class="ticket-free">FREE ENTRY</span>';
  if(event.ticket==='paid') return `<span class="ticket-paid">PAID · ${escapeHtml(event.price)}</span>`;
  return '<span class="ticket-tba">TICKET DETAILS UNCONFIRMED</span>';
}
function createMarker(event){
  const root = document.createElement('div');
  root.className = 'event-marker';
  root.dataset.eventId = event.id;
  const hotspot = document.createElement('div');
  hotspot.className = 'event-marker__hotspot';
  hotspot.tabIndex=0;
  hotspot.setAttribute('role','button');
  hotspot.setAttribute('aria-label',`${event.name}, ${event.city}. Show event details`);
  const text = document.createElement('span');
  text.className = 'event-marker__title';
  text.textContent = event.name;
  const crystal = document.createElement('span');
  crystal.className='event-marker__diamond-wrap';
  crystal.innerHTML='<i class="event-marker__diamond"></i><i class="event-marker__beam"></i>';
  const date = new Date(`${event.date}T12:00:00`).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
  const card = document.createElement('div');
  card.className = 'event-marker__card';
  const googleUrl=`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${event.venue}, ${event.city}, Pakistan`)}`;
  card.innerHTML = `<div class="event-card-head"><span class="event-card-category">${escapeHtml(categoryLabel(event.category).toUpperCase())}</span><span class="event-card-demo">DEMO EVENT</span></div>
    <h3 class="event-card-title">${escapeHtml(event.name)}</h3>
    <p class="event-card-desc">${escapeHtml(event.description)}</p>
    <div class="event-card-divider"></div>
    <div class="event-card-grid">
      <span class="field">Date</span><span class="value">${escapeHtml(date)} · ${escapeHtml(event.time)}</span>
      <span class="field">City</span><span class="value">${escapeHtml(event.city)}, Pakistan</span>
      <span class="field">Venue</span><span class="value">${escapeHtml(event.venue)}</span>
      <span class="field">Admission</span><span class="value">${cardTicket(event)}</span>
    </div>
    <div class="event-card-bottom"><span class="event-card-source">SOURCE: DEMO PLACEHOLDER</span><a class="event-card-location" href="${googleUrl}" target="_blank" rel="noopener noreferrer">VIEW VENUE ↗</a></div>`;
  hotspot.append(text,crystal,card);
  root.append(hotspot);
  function show(){root.classList.add('is-open');}
  function hide(){if(state.pinnedId!==event.id)root.classList.remove('is-open');}
  hotspot.addEventListener('mouseenter',show);
  hotspot.addEventListener('mouseleave',hide);
  hotspot.addEventListener('focusin',show);
  hotspot.addEventListener('focusout',hide);
  hotspot.addEventListener('click',e=>{
    if(e.target.closest('a'))return;
    e.stopPropagation();
    state.pinnedId=state.pinnedId===event.id?null:event.id;
    updatePinned();
  });
  hotspot.addEventListener('keydown',e=>{
    if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();state.pinnedId=state.pinnedId===event.id?null:event.id;updatePinned();}
    if(e.key==='Escape'){state.pinnedId=null;updatePinned();}
  });
  return root;
}
function updatePinned(){document.querySelectorAll('.event-marker').forEach(marker=>{const isPinned=state.pinnedId===marker.dataset.eventId;marker.classList.toggle('is-open',isPinned);});}
function renderCategories(){
  $('#category-tabs').innerHTML='';
  CATEGORIES.forEach((cat,index)=>{
    const el=document.createElement('button');el.className='tab';el.type='button';el.setAttribute('role','tab');el.setAttribute('aria-selected',String(state.category===cat.id));
    el.innerHTML=`<span class="tab-num">0${index+1}</span>${escapeHtml(cat.label)}`;
    el.addEventListener('click',()=>{state.category=cat.id;state.pinnedId=null;refresh();});
    $('#category-tabs').append(el);
  });
}
function renderCities(){
  $('#city-list').innerHTML='';
  CITY_LIST.forEach(city=>{
    const count=countByCity(city);
    const el=document.createElement('button');el.type='button';el.className='city-item'+(state.city===city?' is-selected':'');
    el.setAttribute('aria-pressed',String(state.city===city));
    el.innerHTML=`<span class="city-item__icon">${city==='All Cities'?'◎':'⌖'}</span><span class="city-item__name">${escapeHtml(city)}</span><span class="city-item__count">${count}</span>`;
    el.addEventListener('click',()=>{state.city=city;state.pinnedId=null;refresh();focusMap();});
    $('#city-list').append(el);
  });
}
function renderPreviewPins(){
  const container=$('#preview-markers');container.innerHTML='';
  eligibleEvents().forEach(event=>{
    const marker=createMarker(event);
    marker.style.left=event.x+'%';marker.style.top=event.y+'%';
    container.append(marker);
  });
}
function updateSummary(){
  const count=eligibleEvents().length;
  $('#results-summary').textContent=`${count} DEMO EVENT${count===1?'':'S'} FOUND`;
  $('#map-location-label').textContent=`PAKISTAN / ${state.city==='All Cities'?'ALL CITIES':state.city.toUpperCase()}`;
}
function refresh(){renderCategories();renderCities();renderPreviewPins();renderGooglePins();updateSummary();}
function fitEvents(){
  if(!state.map)return;
  const visible=eligibleEvents();
  if(!visible.length){state.map.panTo(CENTERS[state.city]||CENTERS.Pakistan);state.map.setZoom(state.city==='All Cities'?6:11);return;}
  const bounds=new google.maps.LatLngBounds();visible.forEach(event=>bounds.extend({lat:event.lat,lng:event.lng}));
  if(visible.length===1){state.map.panTo({lat:visible[0].lat,lng:visible[0].lng});state.map.setZoom(11);}
  else if(state.city!=='All Cities'){state.map.panTo(CENTERS[state.city]);state.map.setZoom(11);}
  else {state.map.fitBounds(bounds,{top:100,right:110,bottom:110,left:110});}
}
function focusMap(){
  if(state.mode==='google'){fitEvents();}
  else{state.previewScale=1;$('#preview-world').style.setProperty('--preview-scale','1');}
}
function makeGoogleOverlayClass(){
  return class CrystalOverlay extends google.maps.OverlayView{
    constructor(event){super();this.event=event;this.div=null;}
    onAdd(){this.div=createMarker(this.event);this.getPanes().overlayMouseTarget.appendChild(this.div);}
    draw(){if(!this.div)return;const point=this.getProjection().fromLatLngToDivPixel(new google.maps.LatLng(this.event.lat,this.event.lng));if(point){this.div.style.left=`${point.x}px`;this.div.style.top=`${point.y}px`;}}
    onRemove(){if(this.div){this.div.remove();this.div=null;}}
  };
}
let GoogleCrystalOverlay=null;
function renderGooglePins(){
  state.overlays.forEach(o=>o.setMap(null));state.overlays=[];
  if(state.mode!=='google'||!state.map)return;
  eligibleEvents().forEach(event=>{const overlay=new GoogleCrystalOverlay(event);overlay.setMap(state.map);state.overlays.push(overlay);});
}
const darkStyles=[
  {elementType:'geometry',stylers:[{color:'#0b1e2c'}]},
  {elementType:'labels.text.fill',stylers:[{color:'#7d9fb7'}]},
  {elementType:'labels.text.stroke',stylers:[{color:'#102436'}]},
  {featureType:'administrative',elementType:'geometry.stroke',stylers:[{color:'#31516a'}]},
  {featureType:'administrative.country',elementType:'geometry.stroke',stylers:[{color:'#3f6883'},{weight:1.3}]},
  {featureType:'poi',stylers:[{visibility:'off'}]},
  {featureType:'transit',stylers:[{visibility:'off'}]},
  {featureType:'road',elementType:'geometry',stylers:[{color:'#173348'}]},
  {featureType:'road',elementType:'geometry.stroke',stylers:[{color:'#1c4561'}]},
  {featureType:'road.highway',elementType:'geometry',stylers:[{color:'#21495f'}]},
  {featureType:'water',elementType:'geometry',stylers:[{color:'#061320'}]},
  {featureType:'landscape.natural',elementType:'geometry',stylers:[{color:'#0a2334'}]}
];
function startRealGoogleMap(){
  GoogleCrystalOverlay=makeGoogleOverlayClass();
  const div=$('#google-map');div.style.display='block';
  state.map=new google.maps.Map(div,{
    center:CENTERS.Pakistan,zoom:6,styles:darkStyles,
    disableDefaultUI:true,clickableIcons:false,gestureHandling:'greedy',
    mapTypeControl:false,streetViewControl:false,fullscreenControl:false,
    minZoom:4, maxZoom:17,backgroundColor:'#061321',keyboardShortcuts:true
  });
  state.mode='google';
  $('#preview-map').style.display='none';
  $('#engine-status').textContent='GOOGLE MAPS CONNECTED';
  $('#open-key-dialog').innerHTML='GOOGLE MAPS CONNECTED <span>✓</span>';
  state.map.addListener('click',()=>{state.pinnedId=null;updatePinned();});
  renderGooglePins();
  window.setTimeout(fitEvents,350);
  closeDialog();
}
function setKeyError(message){$('#key-error').textContent=message;}
function loadGoogleMaps(key){
  if(state.mode==='google'){closeDialog();return;}
  if(!key){setKeyError('Enter your Google Maps JavaScript API key.');return;}
  if(state.loading)return;
  state.loading=true;
  const btn=$('#connect-key');btn.disabled=true;btn.firstChild.textContent='CONNECTING… ';
  setKeyError('');
  const script=document.createElement('script');
  window.__pciGoogleMapsReady=()=>{
    state.loading=false;btn.disabled=false;btn.firstChild.textContent='LOAD GOOGLE MAPS ';
    if(!window.google?.maps){setKeyError('Google Maps did not initialize. Check your key and connection.');return;}
    startRealGoogleMap();
  };
  window.gm_authFailure=()=>{
    state.loading=false;btn.disabled=false;btn.firstChild.textContent='LOAD GOOGLE MAPS ';
    setKeyError('Google Maps rejected this key. Verify Maps JavaScript API, HTTP referrer restrictions and billing setup.');
  };
  script.onerror=()=>{state.loading=false;btn.disabled=false;btn.firstChild.textContent='LOAD GOOGLE MAPS ';setKeyError('Could not load Google Maps. Check your internet connection or browser blocking.');};
  script.src=`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&loading=async&v=weekly&callback=__pciGoogleMapsReady`;
  document.head.appendChild(script);
}
function openDialog(){const modal=$('#key-dialog');modal.classList.add('is-open');modal.setAttribute('aria-hidden','false');$('#api-key').focus();}
function closeDialog(){const modal=$('#key-dialog');modal.classList.remove('is-open');modal.setAttribute('aria-hidden','true');}
function init(){
  refresh();
  $('#search-input').addEventListener('input',e=>{state.query=e.target.value.trim().toLowerCase();state.pinnedId=null;refresh();});
  $('#zoom-in').addEventListener('click',()=>zoom(1));
  $('#zoom-out').addEventListener('click',()=>zoom(-1));
  $('#map-reset').addEventListener('click',()=>{state.city='All Cities';state.pinnedId=null;refresh();focusMap();});
  $('#preview-map').addEventListener('click',e=>{if(e.target.closest('.event-marker'))return;state.pinnedId=null;updatePinned();});
  $('#open-key-dialog').addEventListener('click',()=>state.mode==='google'?void 0:openDialog());
  $('#close-key-dialog').addEventListener('click',closeDialog);
  $('#key-dialog').addEventListener('click',e=>{if(e.target.id==='key-dialog')closeDialog();});
  $('#connect-key').addEventListener('click',()=>loadGoogleMaps($('#api-key').value.trim()));
  $('#api-key').addEventListener('keydown',e=>{if(e.key==='Enter')loadGoogleMaps(e.target.value.trim());});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){state.pinnedId=null;updatePinned();closeDialog();}});
  const suppliedKey=window.PCI_GOOGLE_MAPS_API_KEY?.trim();
  if(suppliedKey)loadGoogleMaps(suppliedKey);
}
function zoom(direction){
  if(state.mode==='google'&&state.map){state.map.setZoom(Math.max(4,Math.min(17,state.map.getZoom()+direction)));return;}
  state.previewScale=Math.max(.78,Math.min(1.55,state.previewScale+(direction*.15)));
  $('#preview-world').style.setProperty('--preview-scale',String(state.previewScale));
}
init();
