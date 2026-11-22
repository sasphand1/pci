import {ImageResponse} from 'next/og';

export const alt = 'Pakistan Creator Index — independent Pakistani creator rankings';
export const size = {width: 1200, height: 630};
export const contentType = 'image/png';

/** Self-contained sharing artwork: no external fonts or assets to fail at runtime. */
export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{width:'100%',height:'100%',display:'flex',flexDirection:'column',justifyContent:'center',padding:78,backgroundColor:'#10293a',color:'#ffffff',fontFamily:'Arial, sans-serif'}}>
      <div style={{fontSize:29,letterSpacing:7,color:'#8ed5df',fontWeight:700}}>PCI / PAKISTAN</div>
      <div style={{fontSize:82,fontWeight:800,letterSpacing:-3,lineHeight:1.08,marginTop:26}}>Creator Index</div>
      <div style={{fontSize:31,color:'#e3f2f4',marginTop:27}}>Independent rankings · Public creator statistics</div>
      <div style={{display:'flex',height:6,width:224,backgroundColor:'#43b7cb',marginTop:50,borderRadius:5}} />
    </div>,
    {...size},
  );
}
