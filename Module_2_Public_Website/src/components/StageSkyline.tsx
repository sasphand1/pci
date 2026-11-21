/** Four landmark silhouettes (Badshahi Mosque, Mazar-e-Quaid, Rohtas Fort, Quetta clock tower), drawn in gold on the stage. */
export function StageSkyline(){
 return <svg className="stage-skyline" aria-hidden="true" viewBox="0 0 1600 260" preserveAspectRatio="xMidYMax meet" focusable="false">
   <defs><linearGradient id="gl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F2C46B"/><stop offset="1" stop-color="#8A5A1C"/></linearGradient></defs>
   <g fill="url(#gl)" opacity=".92">
    {/* Badshahi Mosque, Lahore */}
    <g transform="translate(130 40)"><rect x="10" y="60" width="12" height="150"/><rect x="6" y="52" width="20" height="10"/><path d="M8 52q8-26 16 0Z"/><rect x="198" y="60" width="12" height="150"/><rect x="194" y="52" width="20" height="10"/><path d="M196 52q8-26 16 0Z"/><rect x="40" y="130" width="140" height="80"/><path d="M62 130q48-96 96 0Z"/><path d="M12 130q22-62 44 0Z"/><path d="M164 130q22-62 44 0Z"/><rect x="104" y="64" width="3" height="20"/></g>
    {/* Mazar-e-Quaid, Karachi */}
    <g transform="translate(520 90)"><rect x="20" y="70" width="120" height="100"/><path d="M40 70q40-76 80 0Z"/><path d="M62 84q18 40 36 0v86H62Z" fill="#0b2a2a"/><rect x="78" y="0" width="3" height="16"/></g>
    {/* Rohtas Fort, Peshawar */}
    <g transform="translate(930 120)"><path d="M0 140V70h18v-12h14v12h20v-12h14v12h20v-12h14v12h20v-12h14v12h20v-12h14v12h20v-12h14v12h20v-12h14v12h18v70Z"/><rect x="100" y="30" width="26" height="110"/><rect x="96" y="22" width="34" height="10"/></g>
    {/* Clock tower, Quetta */}
    <g transform="translate(1300 30)"><rect x="40" y="70" width="44" height="140"/><rect x="30" y="52" width="64" height="22"/><path d="M34 52 62 6l28 46Z"/><circle cx="62" cy="108" r="14" fill="#0b2a2a"/><rect x="28" y="190" width="68" height="20"/></g>
   </g>
  </svg>;
}
