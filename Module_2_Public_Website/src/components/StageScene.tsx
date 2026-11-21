/** Decorative backdrop for the landing stage: floodlights, flags and four landmark silhouettes.
 *  Drop a finished artwork at /public/images/hero-stage.webp (2400 x 1350) to replace it; see .pci-stage in public-stage.css. */
export function StageScene(){
 return <div className="stage-scene" aria-hidden="true">
  <div className="stage-art"/>
  <div className="stage-lights"><i data-side="left"/><i data-side="right"/></div>
  <div className="stage-flag" data-side="left"><span>☾</span></div><div className="stage-flag" data-side="right"><span>☾</span></div>
 </div>;
}
