// Natural Earth 10m admin_1 (Public Domain) 내려받기
// 이 PC에서는 curl HTTPS 가 막혀 있어 Node fetch 사용
const fs = require("fs");
const URL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson";
fetch(URL)
  .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.arrayBuffer(); })
  .then(b => { fs.writeFileSync(__dirname + "/ne10.geojson", Buffer.from(b)); console.log("saved ne10.geojson", (b.byteLength / 1e6).toFixed(1), "MB"); })
  .catch(e => { console.error("FAIL", e.message); process.exit(1); });
