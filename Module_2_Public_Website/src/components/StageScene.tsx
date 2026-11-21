/** Background artwork only. The hero image supplies the full cinematic scene. */
export function StageScene(){
  return (
    <div className="stage-scene" aria-hidden="true">
      <div className="stage-art"/>
      <div className="stage-vignette"/>
      <div className="stage-floor-glow"/>
    </div>
  );
}
