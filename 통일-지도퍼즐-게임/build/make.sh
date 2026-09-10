#!/usr/bin/env bash
# 한반도 도(道) 경계 → regions.json 파이프라인
# 사전: node fetch.js 로 ne10.geojson 준비
set -e
cd "$(dirname "$0")"

MS="npx -y mapshaper@0.6"
PROJ="+proj=tmerc +lat_0=38 +lon_0=127.8 +k=0.9996 +ellps=GRS80"

# 광역시 → 소속 도 매핑 + region(n/s) 부여
EACH='var M={"KP-01":"pnam","KP-02":"pnam","KP-03":"pbuk","KP-04":"jagang","KP-05":"hwnam","KP-06":"hwbuk","KP-07":"kangwonN","KP-08":"hnam","KP-09":"hbuk","KP-10":"ryang","KP-13":"hbuk","KR-11":"gyeonggi","KR-28":"gyeonggi","KR-41":"gyeonggi","KR-42":"gangwonS","KR-43":"chungbuk","KR-44":"chungnam","KR-30":"chungnam","KR-50":"chungnam","KR-45":"jeonbuk","KR-46":"jeonnam","KR-29":"jeonnam","KR-47":"gyeongbuk","KR-27":"gyeongbuk","KR-48":"gyeongnam","KR-26":"gyeongnam","KR-31":"gyeongnam","KR-49":"jeju"}; prov=M[iso_3166_2]||("X_"+iso_3166_2); region=(adm0_a3=="PRK")?"n":"s";'

# 1) 도 경계 (28 -> 18)
$MS ne10.geojson snap \
  -filter '["KOR","PRK"].indexOf(adm0_a3) > -1' \
  -each "$EACH" \
  -dissolve2 prov copy-fields=region \
  -proj "$PROJ" \
  -filter-islands min-area=20km2 \
  -simplify 18% keep-shapes \
  -o prov.geojson precision=1

# 2) 군사분계선 (남-북 내부 경계선)
$MS ne10.geojson snap \
  -filter '["KOR","PRK"].indexOf(adm0_a3) > -1' \
  -each "$EACH" \
  -dissolve2 region \
  -proj "$PROJ" \
  -simplify 18% keep-shapes \
  -innerlines \
  -o dmz.geojson precision=1

# 3a) 통일부 북한정보포털에서 북한 지명 공식 좌표 받기 → nkinfo.json
node nkinfo.js

# 3b) 도시 좌표를 같은 투영으로 (북한 도시 = 통일부 nkinfo.json, 남한 도시 = 시청 좌표)
node -e '
const fs=require("fs");
const NK=JSON.parse(fs.readFileSync("nkinfo.json"));
const SK=[["서울",126.978,37.566],["인천",126.705,37.456],["대전",127.385,36.351],["대구",128.601,35.872],["광주",126.851,35.160],["부산",129.075,35.180]];
const feats=[];
for(const n of ["평양","신의주","강계","혜산","청진","함흥","원산","개성"]){
  const d=NK[n]; feats.push({type:"Feature",properties:{name:n,region:"n",src:"통일부 북한정보포털",official:d.official},geometry:{type:"Point",coordinates:[d.lon,d.lat]}});
}
for(const [n,x,y] of SK) feats.push({type:"Feature",properties:{name:n,region:"s"},geometry:{type:"Point",coordinates:[x,y]}});
fs.writeFileSync("cities.geojson",JSON.stringify({type:"FeatureCollection",features:feats}));
fs.writeFileSync("deco.geojson",JSON.stringify({type:"FeatureCollection",features:[{type:"Feature",properties:{name:"백두산"},geometry:{type:"Point",coordinates:[128.055,42.005]}}]}));
'
$MS cities.geojson -proj "$PROJ" -o cities_proj.geojson precision=1
$MS deco.geojson   -proj "$PROJ" -o deco_proj.geojson   precision=1

# 4) SVG 좌표계로 매핑 -> regions.json
node build.js

echo
echo "=> build/regions.json 완성. 통일_지도퍼즐_게임.html 의 const REGIONS = {...} 에 반영하세요."
