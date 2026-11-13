/** EXPERIMENTAL research helpers, NOT exposed by the public/admin APIs.
 * Use only with synthetic, independently consented, or otherwise authorized data.
 * A video view is not a movie rating and a YouTube like is not a positive/negative vote.
 */
function finite(x){return typeof x==='number' && Number.isFinite(x) && x>=0;}
export function bayesianMean({observedMean,sampleSize,priorMean,priorStrength}){
  if(![observedMean,sampleSize,priorMean,priorStrength].every(finite) || !Number.isInteger(sampleSize) || priorStrength<=0)throw Error('Invalid Bayesian parameters');
  return (sampleSize*observedMean+priorStrength*priorMean)/(sampleSize+priorStrength);
}
/** Wilson 95% lower confidence bound for independent binary assessments.
 * This cannot be applied directly to YouTube likes/views to obtain an approval rate.
 */
export function wilsonLowerBound({positive,total,z=1.959963984540054}){
  if(![positive,total,z].every(finite)||!Number.isInteger(positive)||!Number.isInteger(total)||positive>total||z<=0)throw Error('Invalid Wilson parameters');
  if(total===0)return 0;
  const p=positive/total, z2=z*z, den=1+z2/total;
  return (p+z2/(2*total)-z*Math.sqrt((p*(1-p)+z2/(4*total))/total))/den;
}
