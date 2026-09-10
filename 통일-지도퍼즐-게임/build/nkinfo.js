/* ============================================================
   통일부 북한정보포털(nkinfo.unikorea.go.kr) NKMap 검색 API 로
   북한 도(道)·도시·백두산의 공식 지명·좌표·개요를 받아 nkinfo.json 생성.
   · API: GET /nkp/search/nkmapSearchFastApi.do?q=<이름>   (키·로그인 불필요)
   · 좌표계: EPSG:5186 (TM 중부원점, GRS80) → proj4 로 WGS84 변환
   · 이 데이터는 공공데이터포털 "통일부_북한지도 … 지명 및 위치 정보"(15088900)의 원본 시스템
   ============================================================ */
const fs = require("fs");
const proj4 = require("proj4");
proj4.defs("EPSG:5186", "+proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=600000 +ellps=GRS80 +units=m +no_defs");

const API = "https://nkinfo.unikorea.go.kr/nkp/search/nkmapSearchFastApi.do?q=";
const HEAD = { "User-Agent": "Mozilla/5.0", "Accept": "application/json",
               "Referer": "https://nkinfo.unikorea.go.kr/NKMap/" };

// 게임에서 쓰는 북한 지명 → 검색어(정확도 위해 '시' 등 명시) + 원하는 분류
const WANT = [
  // 9개 도 (행정구역 지명)
  { key:"평안북도", q:"평안북도", cat:"행정구역" },
  { key:"자강도",   q:"자강도",   cat:"행정구역" },
  { key:"양강도",   q:"량강도",   cat:"행정구역" },
  { key:"함경북도", q:"함경북도", cat:"행정구역" },
  { key:"함경남도", q:"함경남도", cat:"행정구역" },
  { key:"평안남도", q:"평안남도", cat:"행정구역" },
  { key:"황해북도", q:"황해북도", cat:"행정구역" },
  { key:"황해남도", q:"황해남도", cat:"행정구역" },
  { key:"강원도",   q:"강원도",   cat:"행정구역" },
  // 도시 (2단계에서 찾는 곳)
  { key:"평양",   q:"평양직할시", cat:"행정구역" },
  { key:"신의주", q:"신의주시",   cat:"행정구역" },
  { key:"강계",   q:"강계시",     cat:"행정구역" },
  { key:"혜산",   q:"혜산시",     cat:"행정구역" },
  { key:"청진",   q:"청진시",     cat:"행정구역" },
  { key:"함흥",   q:"함흥시",     cat:"행정구역" },
  { key:"원산",   q:"원산시",     cat:"행정구역" },
  { key:"개성",   q:"개성특별시", cat:"행정구역" },
  // (백두산은 API 검색 결과 위치가 부정확하여 게임 기본 좌표 유지)
];

function pickItem(items, w){
  if(!items || !items.length) return null;
  return items.find(x => x.data_ttl === w.q)
      || items.find(x => (x.ctgry_nm || "").includes(w.cat))
      || items.find(x => (x.data_ttl || "").startsWith(w.key))
      || items[0];
}
function overview(it){
  const a = it.attrbs || [];
  const g = k => (a.find(x => x.attrb_nm === k) || {}).attrb_val || "";
  return (g("개요") || g("지리적위치") || "").replace(/[⁽⁾¹²³⁴]/g, "").trim().slice(0, 140);
}

(async () => {
  const out = {};
  for(const w of WANT){
    try{
      const r = await fetch(API + encodeURIComponent(w.q), { headers: HEAD });
      const j = await r.json();
      const it = pickItem(j.items, w);
      if(!it){ console.log("  ✗", w.key, "(no match)"); continue; }
      const [lon, lat] = proj4("EPSG:5186", "WGS84", [it.x_crdnt, it.y_crdnt]);
      out[w.key] = {
        official: it.data_ttl,
        lon: +lon.toFixed(5), lat: +lat.toFixed(5),
        category: it.ctgry_nm || "",
        addr: (it.addr || "").trim(),
        overview: overview(it)
      };
      console.log("  ✓", w.key.padEnd(7), "→", it.data_ttl.padEnd(10),
                  lon.toFixed(4) + "," + lat.toFixed(4));
    }catch(e){ console.log("  ✗", w.key, "ERR", e.message); }
    await new Promise(r => setTimeout(r, 120));
  }
  fs.writeFileSync(__dirname + "/nkinfo.json", JSON.stringify(out, null, 1));
  console.log("\nwrote nkinfo.json —", Object.keys(out).length, "곳 (출처: 통일부 북한정보포털)");
})();
