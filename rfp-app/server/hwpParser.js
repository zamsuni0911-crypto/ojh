// 국가법령정보센터에서 받은 실제 .hwp 별지 서식 파일을 열어서, 안에 있는 표(TABLE)의
// 실제 행/열/병합 구조와 텍스트를 그대로 뽑아낸다. (node-hwp로 HWP → HWPML(XML) 변환 후,
// TABLE/ROW/CELL 구조를 파싱해 docx 표로 그대로 재현할 수 있는 형태로 정규화한다)
//
// node-hwp는 초기 단계(alpha) 라이브러리라 일부 파일은 파싱에 실패할 수 있으므로,
// 실패하면 호출부에서 잡아서 손으로 만든 대체 서식(formTemplates.js)을 대신 쓰도록 한다.
const hwp = require('node-hwp');
const xml2js = require('xml2js');

function textOfChar(charNode) {
  if (typeof charNode === 'string') return charNode;
  if (charNode && typeof charNode === 'object' && typeof charNode._ === 'string') return charNode._;
  return '';
}

function extractCellText(cell) {
  const paralist = cell.PARALIST && cell.PARALIST[0];
  if (!paralist || !paralist.P) return '';
  const paras = Array.isArray(paralist.P) ? paralist.P : [paralist.P];
  const lines = paras.map((p) => {
    if (!p.TEXT) return '';
    const texts = Array.isArray(p.TEXT) ? p.TEXT : [p.TEXT];
    return texts
      .map((t) => {
        if (!t.CHAR) return '';
        const chars = Array.isArray(t.CHAR) ? t.CHAR : [t.CHAR];
        return chars.map(textOfChar).join('');
      })
      .join('');
  });
  return lines.join(' ').replace(/\s+/g, ' ').trim();
}

// HWPML(xml) 전체에서 TABLE들을 찾아 { rowCount, colCount, cells:[{row,col,rowSpan,colSpan,text}] } 배열로 정규화
function parseTablesFromHml(hmlXml) {
  return new Promise((resolve, reject) => {
    xml2js.parseString(hmlXml, { explicitArray: true }, (err, result) => {
      if (err) return reject(err);
      try {
        const tables = [];
        const visit = (node) => {
          if (!node || typeof node !== 'object') return;
          if (node.TABLE) {
            const tbls = Array.isArray(node.TABLE) ? node.TABLE : [node.TABLE];
            tbls.forEach((t) => {
              const rows = Array.isArray(t.ROW) ? t.ROW : t.ROW ? [t.ROW] : [];
              const cells = [];
              rows.forEach((row) => {
                const rowCells = Array.isArray(row.CELL) ? row.CELL : row.CELL ? [row.CELL] : [];
                rowCells.forEach((cell) => {
                  const attrs = cell.$ || {};
                  cells.push({
                    row: Number(attrs.RowAddr) || 0,
                    col: Number(attrs.ColAddr) || 0,
                    rowSpan: Number(attrs.RowSpan) || 1,
                    colSpan: Number(attrs.ColSpan) || 1,
                    width: Number(attrs.Width) || 0,
                    text: extractCellText(cell),
                  });
                });
              });
              if (cells.length) {
                const rowCount = Math.max(...cells.map((c) => c.row + c.rowSpan));
                const colCount = Math.max(...cells.map((c) => c.col + c.colSpan));
                // 표 하나가 셀 1개짜리(RowCount=1,ColCount=1)인 경우는 표 틀 자체가 아니라
                // 텍스트박스/장식용인 경우가 많으므로 최소 2x2 이상인 표만 실제 서식표로 취급
                if (rowCount >= 2 && colCount >= 2) tables.push({ rowCount, colCount, cells });
              }
            });
          }
          // 실제 내용표가 "장식용 1x1 표"의 셀 안에 한 번 더 감싸여 있는 경우가 흔하므로,
          // TABLE을 이미 처리했더라도 그 안(셀 내부)에 중첩된 표가 있는지 계속 내려가며 찾는다.
          Object.keys(node).forEach((k) => {
            if (k === '$') return;
            const v = node[k];
            if (Array.isArray(v)) v.forEach(visit);
            else if (typeof v === 'object') visit(v);
          });
        };
        visit(result);
        resolve(tables);
      } catch (e) {
        reject(e);
      }
    });
  });
}

// filePath: 실제 .hwp 파일 경로. 반환: 표 배열(파싱 실패 시 reject)
function parseHwpTables(filePath) {
  return new Promise((resolve, reject) => {
    hwp.open(filePath, (err, doc) => {
      if (err) return reject(err);
      let hml;
      try {
        hml = doc.toHML();
      } catch (e) {
        return reject(e);
      }
      parseTablesFromHml(hml).then(resolve).catch(reject);
    });
  });
}

module.exports = { parseHwpTables };
