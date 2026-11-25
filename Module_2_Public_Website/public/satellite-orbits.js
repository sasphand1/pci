// PCI orbit positions for the satellite globe.
// Two-body Kepler propagation from CelesTrak mean elements with J2 drift of the node and perigee.
// Good to tens of kilometres within a day of the element epoch: fine for a live map dot,
// not for collision or pass-time work (that needs full SGP4).
'use strict';
(function(root){
 const MU=398600.4418,RE=6378.137,J2=1.08262668e-3,D=Math.PI/180;
 const finite=v=>typeof v==='number'&&Number.isFinite(v);
 function gmst(tMs){const jd=tMs/86400000+2440587.5;return ((280.46061837+360.98564736629*(jd-2451545))%360+360)%360;}
 /** Returns {latitude, longitude, altitudeKm} or null for invalid elements. */
 function position(el,tMs){
  if(!el||![el.meanMotion,el.eccentricity,el.inclination,el.raOfAscNode,el.argOfPericenter,el.meanAnomaly].every(finite))return null;
  const epoch=Date.parse(el.epoch);if(!Number.isFinite(epoch)||el.meanMotion<=0||el.eccentricity<0||el.eccentricity>=1)return null;
  const n=el.meanMotion*2*Math.PI/86400,a=Math.cbrt(MU/(n*n)),e=el.eccentricity,inc=el.inclination*D;
  const dt=(tMs-epoch)/1000,p=a*(1-e*e),k=n*J2*(RE/p)**2;
  const raan=el.raOfAscNode*D-1.5*k*Math.cos(inc)*dt,argp=el.argOfPericenter*D+0.75*k*(5*Math.cos(inc)**2-1)*dt;
  let M=(el.meanAnomaly*D+n*dt)%(2*Math.PI),E=M;
  for(let i=0;i<12;i++){const d=(E-e*Math.sin(E)-M)/(1-e*Math.cos(E));E-=d;if(Math.abs(d)<1e-10)break;}
  const nu=2*Math.atan2(Math.sqrt(1+e)*Math.sin(E/2),Math.sqrt(1-e)*Math.cos(E/2)),r=a*(1-e*Math.cos(E)),u=argp+nu;
  const x=r*(Math.cos(raan)*Math.cos(u)-Math.sin(raan)*Math.sin(u)*Math.cos(inc));
  const y=r*(Math.sin(raan)*Math.cos(u)+Math.cos(raan)*Math.sin(u)*Math.cos(inc));
  const z=r*Math.sin(u)*Math.sin(inc);
  let lon=(Math.atan2(y,x)/D-gmst(tMs))%360;if(lon>180)lon-=360;if(lon<-180)lon+=360;
  return {latitude:Math.atan2(z,Math.hypot(x,y))/D,longitude:lon,altitudeKm:r-RE};
 }
 /** Ground track as line segments, split where it crosses the antimeridian. */
 function track(el,t0,minutes=95,stepS=60){
  const lines=[];let cur=[],prev=null;
  for(let s=0;s<=minutes*60;s+=stepS){const q=position(el,t0+s*1000);if(!q)return [];
   if(prev!==null&&Math.abs(q.longitude-prev)>180){if(cur.length>1)lines.push(cur);cur=[];}
   cur.push([q.longitude,q.latitude]);prev=q.longitude;}
  if(cur.length>1)lines.push(cur);return lines;
 }
 root.PCIOrbits={position,track,gmst};
})(typeof window!=='undefined'?window:globalThis);
