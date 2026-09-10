const fs = require("fs");
const prov = JSON.parse(fs.readFileSync("prov.geojson"));
const dmz  = JSON.parse(fs.readFileSync("dmz.geojson"));
const cin  = JSON.parse(fs.readFileSync("cities_proj.geojson"));
const din  = JSON.parse(fs.readFileSync("deco_proj.geojson"));
const craw = JSON.parse(fs.readFileSync("cities.geojson"));   // 투영 전 경위도
const NKINFO = fs.existsSync("nkinfo.json") ? JSON.parse(fs.readFileSync("nkinfo.json")) : {};
const CITY_LL = {}, CITY_META = {};
for(const f of craw.features){
  CITY_LL[f.properties.name] = f.geometry.coordinates.map(n => +n.toFixed(4));
  CITY_META[f.properties.name] = { src: f.properties.src || null, official: f.properties.official || null };
}
// 도 id → 통일부 지명 key
const PROV_NKKEY = {
  pbuk:"평안북도", jagang:"자강도", ryang:"양강도", hbuk:"함경북도", hnam:"함경남도",
  pnam:"평안남도", hwbuk:"황해북도", hwnam:"황해남도", kangwonN:"강원도"
};

const META = {
 pbuk:{name:"평안북도",color:"#4C9F70",region:"n",ll:[124.398,40.100],blurb:"압록강을 사이에 두고 중국과 마주한 서북쪽 도예요. 중심 도시는 신의주."},
 jagang:{name:"자강도",color:"#E4B363",region:"n",ll:[126.585,40.966],blurb:"산이 많은 내륙 도예요. 1949년에 새로 생겼고 중심 도시는 강계."},
 ryang:{name:"양강도",color:"#7BB5E0",region:"n",ll:[128.183,41.400],blurb:"우리나라에서 가장 높은 백두산과 넓은 개마고원이 있어요. 중심 도시는 혜산."},
 hbuk:{name:"함경북도",color:"#C97B84",region:"n",ll:[129.775,41.795],blurb:"가장 북동쪽 도예요. 두만강 건너로 러시아와 닿고 청진·라선이 있어요."},
 hnam:{name:"함경남도",color:"#E8896B",region:"n",ll:[127.536,39.918],blurb:"동해를 따라 길게 뻗은 도예요. 중심 도시는 함흥이고 흥남 항구가 있어요."},
 pnam:{name:"평안남도",color:"#6C8EBF",region:"n",ll:[125.738,39.019],blurb:"평양을 둘러싼 도예요. 대동강이 흐르고 들판이 넓어요. 도청은 평성."},
 hwbuk:{name:"황해북도",color:"#9B7EBD",region:"n",ll:[125.757,38.507],blurb:"한가운데 자리한 도로 중심 도시는 사리원. 남쪽 끝에 개성이 있어요."},
 hwnam:{name:"황해남도",color:"#5FBFA8",region:"n",ll:[125.715,38.040],blurb:"서해로 툭 튀어나온 반도예요. 쌀이 많이 나는 곡창 지대, 중심 도시는 해주."},
 kangwonN:{name:"강원도",color:"#D98CB3",region:"n",ll:[127.444,39.147],blurb:"남한과 북한에 이름이 똑같은 하나뿐인 도예요. 북쪽 강원도의 중심은 원산."},
 gyeonggi:{name:"경기도",color:"#7FB77E",region:"s",ll:[127.010,37.263],blurb:"서울과 인천을 둘러싼 도예요. 사람이 가장 많이 살고, 군사분계선과 맞닿아 있어요."},
 gangwonS:{name:"강원특별자치도",short:"강원",color:"#8FBBD9",region:"s",ll:[127.729,37.881],blurb:"남쪽 강원도예요. 태백산맥과 설악산, 강릉·속초 같은 동해안 도시가 있어요."},
 chungbuk:{name:"충청북도",short:"충북",color:"#E7C46B",region:"s",ll:[127.489,36.635],blurb:"바다와 닿지 않은 내륙 도예요. 청주가 중심이고 충주호가 있어요."},
 chungnam:{name:"충청남도",short:"충남",color:"#D9A15B",region:"s",ll:[126.660,36.600],blurb:"서해로 태안반도가 튀어나온 도예요. 대전·세종이 가깝고 중심 도시는 홍성."},
 jeonbuk:{name:"전북특별자치도",short:"전북",color:"#C98BB0",region:"s",ll:[127.109,35.821],blurb:"드넓은 호남평야가 있는 곡창 지대예요. 중심 도시는 전주, 비빔밥으로 유명해요."},
 jeonnam:{name:"전라남도",short:"전남",color:"#6FC0AC",region:"s",ll:[126.463,34.812],blurb:"섬이 가장 많은 도예요. 한반도 육지의 남쪽 끝(땅끝)이 있고 중심 도시는 무안·목포."},
 gyeongbuk:{name:"경상북도",short:"경북",color:"#E4977A",region:"s",ll:[128.729,36.569],blurb:"남한에서 가장 넓은 도예요. 대구가 가깝고 경주·안동에 옛 문화재가 많아요."},
 gyeongnam:{name:"경상남도",short:"경남",color:"#B39CD0",region:"s",ll:[128.681,35.228],blurb:"부산·울산·창원 같은 큰 산업 도시가 모여 있어요. 남해안 경치가 아름다워요."},
 jeju:{name:"제주특별자치도",short:"제주",color:"#F0A868",region:"s",ll:[126.531,33.499],blurb:"가장 큰 섬이자 가장 남쪽 도예요. 한라산과 화산 지형, 돌·바람·귤로 유명해요."},
};
const CITY_NOTE = {
 평양:"북한의 수도예요.", 신의주:"압록강 철교로 중국과 이어져요.", 강계:"자강도의 중심 도시예요.",
 혜산:"백두산으로 가는 길목이에요.", 청진:"함경북도의 큰 항구예요.", 함흥:"함경남도의 중심 도시예요.",
 원산:"북쪽 강원도의 중심 도시이자 동해의 항구예요.", 개성:"고려의 옛 수도, 군사분계선과 맞닿아 있어요.",
 서울:"대한민국의 수도예요.", 인천:"서해의 큰 항구이자 국제공항이 있어요.",
 대전:"충청 지방의 중심, 철도가 만나는 도시예요.", 대구:"경상북도의 중심 도시, 분지라 여름이 더워요.",
 광주:"전라남도 지방의 중심 도시예요.", 부산:"두 번째로 큰 도시이자 우리나라 제일의 항구예요.",
};

// ---- global bbox over all province coords ----
function polysOf(g){ return g.type === "Polygon" ? [g.coordinates] : g.coordinates; }
let minx=1e18,miny=1e18,maxx=-1e18,maxy=-1e18;
for(const f of prov.features)
  for(const poly of polysOf(f.geometry))
    for(const ring of poly)
      for(const [x,y] of ring){ if(x<minx)minx=x; if(x>maxx)maxx=x; if(y<miny)miny=y; if(y>maxy)maxy=y; }

const MARGIN = 12, W = 460;
const scale = (W - 2*MARGIN) / (maxx - minx);
const H = Math.round((maxy - miny) * scale + 2*MARGIN);
const sx = x => +( MARGIN + (x - minx) * scale ).toFixed(1);
const sy = y => +( MARGIN + (maxy - y) * scale ).toFixed(1);   // flip Y

function ringPath(ring){
  let d = "M" + sx(ring[0][0]) + "," + sy(ring[0][1]);
  for(let i=1;i<ring.length;i++) d += "L" + sx(ring[i][0]) + "," + sy(ring[i][1]);
  return d + "Z";
}
function featPath(f){
  let d = "";
  for(const poly of polysOf(f.geometry)) for(const ring of poly) d += ringPath(ring);
  return d;
}
// polygon centroid (SVG space) of the largest-area ring
function ringCentroidArea(ring){
  let a=0,cx=0,cy=0;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const x0=sx(ring[j][0]), y0=sy(ring[j][1]), x1=sx(ring[i][0]), y1=sy(ring[i][1]);
    const f=x0*y1 - x1*y0; a+=f; cx+=(x0+x1)*f; cy+=(y0+y1)*f;
  }
  a*=0.5;
  const fx = sx(ring[0][0]), fy = sy(ring[0][1]);
  return { area:Math.abs(a), c:[ a?cx/(6*a):fx, a?cy/(6*a):fy ] };
}
function pointInRing(px,py,ring){
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const xi=sx(ring[i][0]), yi=sy(ring[i][1]), xj=sx(ring[j][0]), yj=sy(ring[j][1]);
    if(((yi>py)!==(yj>py)) && (px < (xj-xi)*(py-yi)/(yj-yi)+xi)) inside=!inside;
  }
  return inside;
}
function labelPoint(f){
  // biggest ring
  let big=null, bigA=-1;
  for(const poly of polysOf(f.geometry)) for(const ring of poly){
    const {area,c} = ringCentroidArea(ring);
    if(area>bigA){ bigA=area; big={ring,c}; }
  }
  let [lx,ly] = big.c;
  if(pointInRing(lx,ly,big.ring)) return [ +lx.toFixed(1), +ly.toFixed(1) ];
  // fallback: grid search farthest-from-edge inside ring bbox
  let bx0=1e9,by0=1e9,bx1=-1e9,by1=-1e9;
  for(const [x,y] of big.ring){ const X=sx(x),Y=sy(y); if(X<bx0)bx0=X; if(X>bx1)bx1=X; if(Y<by0)by0=Y; if(Y>by1)by1=Y; }
  let best=null,bestD=-1;
  for(let gx=bx0+2; gx<bx1; gx+=(bx1-bx0)/24)
    for(let gy=by0+2; gy<by1; gy+=(by1-by0)/24){
      if(!pointInRing(gx,gy,big.ring)) continue;
      // distance to nearest edge (approx via vertices)
      let dmin=1e9;
      for(const [x,y] of big.ring){ const d=Math.hypot(gx-sx(x),gy-sy(y)); if(d<dmin)dmin=d; }
      if(dmin>bestD){ bestD=dmin; best=[gx,gy]; }
    }
  return best ? [ +best[0].toFixed(1), +best[1].toFixed(1) ] : [ +lx.toFixed(1), +ly.toFixed(1) ];
}
function bboxOf(f){
  let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  for(const poly of polysOf(f.geometry)) for(const ring of poly) for(const [x,y] of ring){
    const X=sx(x),Y=sy(y); if(X<x0)x0=X; if(X>x1)x1=X; if(Y<y0)y0=Y; if(Y>y1)y1=Y;
  }
  return [ +x0.toFixed(1), +y0.toFixed(1), +(x1-x0).toFixed(1), +(y1-y0).toFixed(1) ];
}

const provinces = prov.features.map(f=>{
  const id = f.properties.prov;
  const m = META[id];
  if(!m){ throw new Error("no meta for "+id); }
  const nk = NKINFO[PROV_NKKEY[id]];   // 통일부 북한정보포털 데이터(북한 도만)
  return {
    id, name:m.name, short:m.short||null, color:m.color, region:m.region, blurb:m.blurb,
    ll: nk ? [nk.lon, nk.lat] : m.ll,
    src: nk ? "통일부 북한정보포털" : null,
    official: nk ? nk.official : null,
    nknote: nk && nk.overview ? nk.overview : null,
    d: featPath(f), label: labelPoint(f), bbox: bboxOf(f)
  };
}).sort((a,b)=>{
  if(a.region!==b.region) return a.region==="n" ? -1 : 1;
  return a.label[1]-b.label[1];
});

// DMZ path (innerlines) — accept GeometryCollection / FeatureCollection / Feature
let dmzGeoms = [];
if(dmz.type === "GeometryCollection") dmzGeoms = dmz.geometries;
else if(dmz.type === "FeatureCollection") dmzGeoms = dmz.features.map(f=>f.geometry);
else if(dmz.type === "Feature") dmzGeoms = [dmz.geometry];
else dmzGeoms = [dmz];
let dmzPath = "";
for(const g of dmzGeoms){
  const lines = g.type === "LineString" ? [g.coordinates] : g.coordinates;
  for(const ln of lines){
    dmzPath += "M" + sx(ln[0][0]) + "," + sy(ln[0][1]);
    for(let i=1;i<ln.length;i++) dmzPath += "L" + sx(ln[i][0]) + "," + sy(ln[i][1]);
  }
}

const cities = cin.features.map(f=>({
  name: f.properties.name, region: f.properties.region,
  x: sx(f.geometry.coordinates[0]), y: sy(f.geometry.coordinates[1]),
  ll: CITY_LL[f.properties.name] || null,
  src: (CITY_META[f.properties.name] || {}).src || null,
  official: (CITY_META[f.properties.name] || {}).official || null,
  note: CITY_NOTE[f.properties.name] || ""
}));

const deco = {};
for(const f of din.features) deco[f.properties.name] = [ sx(f.geometry.coordinates[0]), sy(f.geometry.coordinates[1]) ];

const out = { viewBox:`0 0 ${W} ${H}`, w:W, h:H, provinces, dmz:dmzPath, cities, deco };
fs.writeFileSync("regions.json", JSON.stringify(out));
console.log("viewBox", out.viewBox);
console.log("provinces", provinces.length, "| total path chars", provinces.reduce((s,p)=>s+p.d.length,0));
console.log("cities", cities.length, "| dmz chars", dmzPath.length);
console.log("regions.json bytes", fs.statSync("regions.json").size);
console.log("\nlabel points:");
for(const p of provinces) console.log("  "+p.id.padEnd(10), p.region, JSON.stringify(p.label), "bbox", JSON.stringify(p.bbox));
