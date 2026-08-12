const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  WidthType, BorderStyle, ShadingType, AlignmentType, TableOfContents, PageBreak,
} = require('docx');
const { getType, COMMON_BID_METHOD, TECH_SCORE_TABLE, PROPOSAL_TOC } = require('./rfpTypes');
const { buildHints } = require('./referenceHints');
const { ATTACHMENTS, FORMS_BIDDER, FORMS_CONTRACT } = require('./formTemplates');
const { runSelfCheck } = require('./selfCheck');

const BORDER = { style: BorderStyle.SINGLE, size: 4, color: 'BFBFBF' };
const CELL_BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };

// [대괄호]로 표시된 부분(확정 필요한 수치 등)은 파란색 굵게, 참고자료 기반 추정 표시는 주황색으로
// 구분해서 화면상 바로 눈에 띄게 만든다.
const HIGHLIGHT_COLOR = '1B6EC2';
const HINT_MARKER = '(참고자료 기반 추정 - 확인 필요)';
function runsWithHighlight(text) {
  const raw = String(text || '');
  if (!raw) return [];
  const pattern = /(\[[^\]]*\]|\(참고자료 기반 추정 - 확인 필요\))/g;
  return raw
    .split(pattern)
    .filter((s) => s !== '')
    .map((part) => {
      if (part.startsWith('[') && part.endsWith(']')) {
        return new TextRun({ text: part, color: HIGHLIGHT_COLOR, bold: true });
      }
      if (part === HINT_MARKER) {
        return new TextRun({ text: part, color: 'B7791F', italic: true, size: 18 });
      }
      return new TextRun({ text: part });
    });
}

function cell(text, opts = {}) {
  const children = opts.header ? [new TextRun({ text: text || '', bold: true })] : runsWithHighlight(text);
  return new TableCell({
    width: { size: opts.width || 3000, type: WidthType.DXA },
    borders: CELL_BORDERS,
    shading: opts.header ? { type: ShadingType.CLEAR, fill: 'E7EEF6' } : undefined,
    children: [new Paragraph({ children })],
  });
}

function table(widths, headers, rows) {
  return new Table({
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      new TableRow({ children: headers.map((h, i) => cell(h, { width: widths[i], header: true })) }),
      ...rows.map((r) => new TableRow({ children: r.map((c, i) => cell(c, { width: widths[i] })) })),
    ],
  });
}

// 국가법령정보센터에서 받은 실제 .hwp 별지 서식을 파싱한 결과(server/hwpParser.js가 만든
// {rowCount, colCount, cells:[{row,col,rowSpan,colSpan,width,text}]} 구조)를 실제 병합 셀 그대로
// docx 표로 재현한다. 손으로 흉내 낸 표가 아니라 원본 서식의 행/열/병합 구조를 그대로 사용하므로
// 실제 서식과 동일한 모양이 된다.
function computeRealColumnWidths(realTable, totalDxa) {
  const known = new Array(realTable.colCount).fill(0);
  realTable.cells.forEach((c) => {
    if (c.colSpan === 1 && !known[c.col]) known[c.col] = c.width;
  });
  const avg = realTable.cells.reduce((s, c) => s + c.width / c.colSpan, 0) / realTable.cells.length || 1;
  for (let i = 0; i < known.length; i += 1) if (!known[i]) known[i] = avg;
  const sum = known.reduce((a, b) => a + b, 0);
  return known.map((w) => Math.max(300, Math.round((w / sum) * totalDxa)));
}
function renderRealFormTable(realTable, totalDxa = 9638) {
  const colWidths = computeRealColumnWidths(realTable, totalDxa);
  const grid = new Map(); // "row,col" -> cell데이터, 병합으로 덮인 칸인지 조회용
  realTable.cells.forEach((c) => grid.set(`${c.row},${c.col}`, c));

  const rows = [];
  for (let r = 0; r < realTable.rowCount; r += 1) {
    const rowCells = [];
    for (let c = 0; c < realTable.colCount; c += 1) {
      const cellData = grid.get(`${r},${c}`);
      if (!cellData) continue; // 위쪽 rowSpan에 덮여 이 행에서는 셀을 만들지 않음 (docx가 자동으로 이어붙임)
      const widthSum = colWidths.slice(c, c + cellData.colSpan).reduce((a, b) => a + b, 0);
      rowCells.push(
        new TableCell({
          width: { size: widthSum, type: WidthType.DXA },
          borders: CELL_BORDERS,
          rowSpan: cellData.rowSpan > 1 ? cellData.rowSpan : undefined,
          columnSpan: cellData.colSpan > 1 ? cellData.colSpan : undefined,
          children: [new Paragraph({ children: runsWithHighlight(cellData.text) })],
        })
      );
    }
    rows.push(new TableRow({ children: rowCells }));
  }
  // columnWidths를 명시하지 않으면 docx가 실제 셀 너비와 무관한 임시 tblGrid를 만들어
  // 워드에서 표가 깨지거나(재계산 무한 루프로 응답 없음) 열리는 문제가 생길 수 있으므로 반드시 지정한다.
  return new Table({ width: { size: totalDxa, type: WidthType.DXA }, columnWidths: colWidths, rows });
}

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    shading: { type: ShadingType.CLEAR, fill: '0C447C' },
    spacing: { before: 300, after: 150 },
    children: [new TextRun({ text, bold: true, color: 'FFFFFF' })],
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 200, after: 100 },
    children: [new TextRun({ text, bold: true, color: '333333' })],
  });
}
function p(text) {
  return new Paragraph({ spacing: { after: 140 }, children: runsWithHighlight(text) });
}
function bullet(text) {
  return new Paragraph({ spacing: { after: 60 }, children: [new TextRun('- '), ...runsWithHighlight(text)] });
}
function placeholder(label) {
  return `[${label}을(를) 입력하세요]`;
}
// 임의로 채우기 어려운 항목은 "무엇을 어떻게 쓰면 되는지" 안내하는 예시 불릿을 남긴다 (완전한 빈칸보다 사용자 편의를 위함)
function templateHint(...lines) {
  return lines.map((l) => bullet(`(작성 예시) ${l}`));
}

// formTemplates.js에 정의된 서식 데이터 한 건을 문서 요소로 변환한다.
// (표가 있으면 표로, 없으면 안내문만) — 서식 내용을 고칠 때는 formTemplates.js만 수정하면 되고
// 이 렌더링 로직은 그대로 재사용된다.
// 서식 표 안에 "사업명" 같은 식별 항목이 빈칸으로 있으면, 사용자가 입력한 사업 정보로 미리 채워 넣는다.
// (유사사업/등록사업 참고 여부와 무관하게 항상 존재하는 사업명 answers.name을 활용)
const FORM_AUTO_FILL_FIELDS = { 사업명: (answers) => answers.name || '' };
function autofillRows(rows, answers) {
  if (!answers) return rows;
  return rows.map((r) => {
    const fill = r.length >= 2 && !r[1] && FORM_AUTO_FILL_FIELDS[String(r[0]).trim()];
    if (!fill) return r;
    const val = fill(answers);
    return val ? [r[0], val] : r;
  });
}

function renderTemplateItem(item, answers) {
  const out = [h2(item.title)];
  if (item.source) out.push(p(`근거: ${item.source}`));
  if (item.note) out.push(p(item.note));
  if (item.realTable) out.push(renderRealFormTable(item.realTable));
  else if (item.headers && item.rows) out.push(table(item.widths, item.headers, autofillRows(item.rows, answers)));
  return out;
}
function renderTemplateList(items, answers) {
  return items.flatMap((item) => renderTemplateItem(item, answers));
}

// 사용자가 입력한 값이 있으면 그걸 그대로 쓰고, 없으면(=모름) 참고자료에서 뽑은 힌트를
// "(참고자료 기반 추정 - 확인 필요)" 표시와 함께 쓰고, 힌트도 없으면 빈 템플릿으로 남긴다.
function valueOrHint(answers, fieldId, label, hints) {
  if (answers[fieldId]) return answers[fieldId];
  if (hints && hints[fieldId]) return `${hints[fieldId]} (참고자료 기반 추정 - 확인 필요)`;
  return placeholder(label);
}

// "337,300,000원", "20억원", "3억 7천만원" 같은 한국식 금액 표기를 숫자(원)로 변환한다.
// 조달청 e-제안요청 도움의 "기본정보 입력만으로 관련 조항 자동생성" 방식을 참고해, 사업예산 답변을
// 직접 해석해서 아래 대기업 참여제한 문구를 자동으로 골라주는 데 사용한다. 해석 실패 시 null 반환.
function parseKoreanWon(text) {
  if (!text) return null;
  let cleaned = String(text).replace(/[,\s]/g, '');
  let total = 0;
  let matched = false;

  const eokMatch = cleaned.match(/([\d.]+)억/);
  if (eokMatch) {
    total += parseFloat(eokMatch[1]) * 1_0000_0000;
    cleaned = cleaned.replace(eokMatch[0], '');
    matched = true;
  }
  const cheonManMatch = cleaned.match(/([\d.]+)천만/);
  if (cheonManMatch) {
    total += parseFloat(cheonManMatch[1]) * 1000_0000;
    matched = true;
  } else {
    const manMatch = cleaned.match(/([\d.]+)만/);
    if (manMatch) {
      total += parseFloat(manMatch[1]) * 1_0000;
      matched = true;
    }
  }
  if (matched) return Math.round(total);

  const digitsOnly = cleaned.match(/\d+/);
  if (digitsOnly && digitsOnly[0].length >= 6) return Number(digitsOnly[0]); // 자릿수가 너무 짧으면(전화번호 등) 오인식 방지
  return null;
}

// 사업예산 답변을 해석해 「소프트웨어 진흥법」 제48조에 따른 대기업 참여제한 구간(20억/40억/80억)을
// 자동으로 판별한다. 예산을 해석할 수 없으면 발주기관이 직접 확인하도록 대괄호 안내로 남긴다.
function bigCorpRestrictionText(budgetAnswer) {
  const won = parseKoreanWon(budgetAnswer);
  if (won === null) {
    return '대기업 참여제한(「소프트웨어 진흥법」 제48조): [사업예산 확정 후 20억·40억·80억원 구간에 따라 대기업·중견기업 참여제한 여부를 확인하세요]';
  }
  const eok = won / 1_0000_0000;
  if (eok < 20) {
    return `대기업 참여제한(「소프트웨어 진흥법」 제48조, 사업예산 ${eok.toFixed(1)}억원 기준 — 20억원 미만): 중소 소프트웨어사업자만 입찰 참여 가능하며, 대기업·중견기업인 소프트웨어사업자의 참여는 제한됨`;
  }
  if (eok < 40) {
    return `대기업 참여제한(「소프트웨어 진흥법」 제48조, 사업예산 ${eok.toFixed(1)}억원 기준 — 20억원 이상 40억원 미만): 중소기업 및 중견기업 전환 5년 이내 기업까지만 참여 가능하며, 그 외 대기업은 참여할 수 없음`;
  }
  if (eok < 80) {
    return `대기업 참여제한(「소프트웨어 진흥법」 제48조, 사업예산 ${eok.toFixed(1)}억원 기준 — 40억원 이상 80억원 미만): 매출액 8천억원 이상 대기업 및 상호출자제한기업집단 소속회사의 참여가 제한되며, 그 외 기업은 참여 가능`;
  }
  return `대기업 참여제한(「소프트웨어 진흥법」 제48조, 사업예산 ${eok.toFixed(1)}억원 기준 — 80억원 이상): 참여제한 없이 모든 소프트웨어사업자가 입찰 참여 가능`;
}

// 전자정부 표준프레임워크 요구사항정의서 양식의 11개 표준 분류.
// 사용자는 "분류: 요구사항명"만 입력하면 되고, 설명(작성 가이드)은 분류별로 자동 완성된다.
const REQUIREMENT_CATEGORIES = [
  { code: 'SFR', label: '기능요구사항', short: '기능', guide: '해당 기능의 세부 처리조건·입력값·처리로직·화면 구성 등 구체적인 동작 방식을 기술' },
  { code: 'PER', label: '성능요구사항', short: '성능', guide: '목표 응답시간, 동시사용자수, 처리량(TPS) 등 정량적 성능 목표치를 기술' },
  { code: 'ECR', label: '시스템장비구성요구사항', short: '시스템', guide: '필요한 서버·네트워크·상용SW 등 장비 규격과 구성방식을 기술' },
  { code: 'INR', label: '인터페이스요구사항', short: '인터페이스', guide: '연계 대상 시스템·기관명, 연계 방식(API·파일·DB 연계 등) 및 연계 데이터 항목을 기술' },
  { code: 'DAR', label: '데이터요구사항', short: '데이터', guide: '관리 대상 데이터의 종류·구조·보존기간, DB 표준 준수 방안을 기술' },
  { code: 'TER', label: '테스트요구사항', short: '테스트', guide: '테스트 범위, 테스트 방법(단위·통합·인수시험), 테스트 완료 기준을 기술' },
  { code: 'SER', label: '보안요구사항', short: '보안', guide: '개인정보·중요정보 보호를 위한 암호화, 접근통제, 인증 방식 등 보안대책을 기술' },
  { code: 'QUR', label: '품질요구사항', short: '품질', guide: '가용성, 신뢰성, 사용성 등 품질 목표치와 검증 방법을 기술' },
  { code: 'COR', label: '제약사항', short: '제약', guide: '기술적·법적 제약사항과 그에 따른 대응방안을 기술' },
  { code: 'PMR', label: '프로젝트관리요구사항', short: '관리', guide: '일정관리, 위험관리, 형상관리 등 프로젝트 관리 방법을 기술' },
  { code: 'PSR', label: '프로젝트지원요구사항', short: '지원', guide: '교육훈련, 기술지원, 하자보수 등 프로젝트 지원 방안을 기술' },
];
const DEFAULT_REQ_CATEGORY = REQUIREMENT_CATEGORIES[0];
const REQ_ALIAS_MAP = new Map();
REQUIREMENT_CATEGORIES.forEach((c) => {
  [c.code, c.label, c.short].forEach((alias) => REQ_ALIAS_MAP.set(alias.toLowerCase(), c));
});
function findReqCategory(prefix) {
  if (!prefix) return null;
  return REQ_ALIAS_MAP.get(prefix.trim().toLowerCase()) || null;
}
function reqDescTemplate(category) {
  return `[${category.guide}]`;
}

// answers.requirements: 한 줄에 "분류: 요구사항명" 형식(분류 생략 시 기능요구사항으로 처리).
// 사용자는 요구사항명만 적으면 되고, 분류 코드·ID·설명(작성 가이드)은 자동으로 채워진다.
function buildRequirementRows(answers, hints) {
  const rawLines = (answers.requirements || '').split('\n').map((s) => s.trim()).filter(Boolean);
  const counters = {};
  const nextId = (category) => {
    counters[category.code] = (counters[category.code] || 0) + 1;
    return `${category.code}-${String(counters[category.code]).padStart(3, '0')}`;
  };

  if (rawLines.length > 0) {
    return rawLines.map((line) => {
      const m = line.match(/^([^:：\-]{1,12})[:：\-]\s*(.+)$/);
      const found = m ? findReqCategory(m[1]) : null;
      const category = found || DEFAULT_REQ_CATEGORY;
      const name = found ? m[2].trim() : line;
      return [category.label, nextId(category), name, reqDescTemplate(category)];
    });
  }
  if (hints.requirements) {
    return [[
      DEFAULT_REQ_CATEGORY.label,
      nextId(DEFAULT_REQ_CATEGORY),
      `${hints.requirements} (참고자료 기반 추정 - 확인 필요)`,
      reqDescTemplate(DEFAULT_REQ_CATEGORY),
    ]];
  }
  const sample = (code, name) => {
    const category = REQUIREMENT_CATEGORIES.find((c) => c.code === code);
    return [category.label, nextId(category), placeholder(name), reqDescTemplate(category)];
  };
  return [
    sample('SFR', '핵심 기능 요구사항 명칭 1'),
    sample('SFR', '핵심 기능 요구사항 명칭 2'),
    sample('PER', '성능 요구사항 명칭 (예: 응답시간)'),
    sample('SER', '보안 요구사항 명칭 (예: 개인정보 암호화)'),
    sample('DAR', '데이터 요구사항 명칭 (예: 회원DB 설계)'),
  ];
}

function buildBuildTypeBody(answers, hints) {
  const reqRows = buildRequirementRows(answers, hints);

  return [
    h1('I. 사업개요'),
    h2('1. 일반사항'),
    table(
      [2400, 7238],
      ['항목', '내용'],
      [
        ['사업명', answers.name || placeholder('사업명')],
        ['사업기간', valueOrHint(answers, 'period', '사업기간', hints)],
        ['사업예산', valueOrHint(answers, 'budget', '사업예산 (부가세 포함/별도 명시)', hints)],
        ['계약방법', '공개경쟁입찰 / ' + COMMON_BID_METHOD],
      ]
    ),
    h2('2. 추진배경 및 필요성'),
    p(valueOrHint(answers, 'background', '추진배경 및 필요성', hints)),
    h2('3. 사업범위'),
    p(valueOrHint(answers, 'scope', '사업범위', hints)),
    h2('4. 기대효과'),
    ...templateHint(
      '(정량적 효과) 업무처리시간 OO% 단축, 민원 처리건수 OO건/년 증가 등 수치로 제시',
      '(정성적 효과) 이용자 만족도 제고, 행정 신뢰도 향상 등 정성적 기대효과 제시'
    ),
    h1('II. 시스템 현황'),
    h2('1. 현행 시스템 개요'),
    p(valueOrHint(answers, 'currentStatus', '현행 시스템/기관 현황', hints)),
    h2('2. 현행 시스템 현황'),
    table(
      [1400, 3000, 2938, 1900],
      ['구분', '품목', '규격/모델', '수량'],
      [
        ['H/W', placeholder('예: 웹서버, DB서버 등'), placeholder('규격'), placeholder('수량')],
        ['H/W', '', '', ''],
        ['S/W', placeholder('예: WAS, 상용SW 등'), placeholder('규격'), placeholder('수량')],
        ['S/W', '', '', ''],
      ]
    ),
    ...templateHint('현행 시스템 구성도(최종 사용자·통신망·장비·소프트웨어·DB 구성)를 별도 이미지로 첨부 — 보안상 공개가 어려운 경우 해당 항목은 제외'),
    h2('3. 현황 및 문제점'),
    ...templateHint(
      '기존 시스템의 노후화·기술지원 종료 등 기술적 문제점',
      '업무 처리 과정에서 확인된 비효율·민원 사항',
      '법령·정책 변경에 따라 새로 반영해야 하는 요구사항'
    ),
    h2('4. 개선방안'),
    ...templateHint(
      '위 문제점 각각에 대응하는 개선 방향을 문제점과 1:1로 대응시켜 제시',
      '단기(이번 사업 범위)와 중장기(향후 로드맵) 개선과제를 구분하여 제시'
    ),
    h1('III. 사업 추진방안'),
    h2('1. 추진목표'),
    ...templateHint('사업을 통해 달성하려는 목표를 구체적인 지표나 상태로 제시 (예: 처리시간 OO% 단축, 시스템 가용성 99.9% 확보)'),
    h2('2. 추진전략'),
    ...templateHint('위험요소(일정 지연, 데이터 이관 오류 등)를 고려한 단계적 추진 전략 제시 (예: 단계적 오픈, 기존 시스템 병행운영 후 전환)'),
    h2('3. 추진체계'),
    ...templateHint('발주기관·수행사·이해관계자(유관부서, 외부기관 등)의 역할과 책임을 조직도 형태로 제시할 것을 권장'),
    h2('4. 추진일정'),
    table(
      [2200, 2200, 2338, 2000],
      ['단계', '주요 활동', '기간(예시)', '산출물'],
      [
        ['분석·설계', '요구사항 정의, 화면·데이터 설계', '착수 후 1~2개월', '요구사항정의서, 설계서'],
        ['구현', '기능 개발, 단위시험', placeholder('기간'), '소스코드, 단위시험결과서'],
        ['통합시험', '통합시험, 데이터 이관', placeholder('기간'), '시험결과서, 이관검증결과서'],
        ['이행·검수', '운영이관, 교육, 검수', '검수 전 1개월', '매뉴얼, 검수조서'],
      ]
    ),
    h2('5. 추진방안'),
    ...templateHint('단계별(분석·설계·구현·시험·이행) 세부 추진방안을 구체적으로 서술'),
    h1('IV. 제안요청 내용'),
    h2('1. 정보시스템 개발 및 도입 범위'),
    p(valueOrHint(answers, 'scope', '개발·도입 범위', hints)),
    h2('2. 목표시스템 구성도'),
    ...templateHint(
      '구성도(다이어그램)는 별도 파일로 첨부하는 것을 권장하며, 아래 계층을 포함해 설명',
      '① 이용자 서비스 계층(웹/모바일 화면) ② 업무처리 계층(응용프로그램) ③ 데이터베이스 계층 ④ 외부 연계 인터페이스'
    ),
    h2('3. 상세 요구사항'),
    table([1800, 1300, 2538, 4000], ['분류', 'ID', '요구사항명', '요구사항 설명(작성 가이드)'], reqRows),
    h2('4. 특수사항'),
    bullet('DB 표준 준수(공공기관의 데이터베이스 표준화 지침 등 행정안전부 고시)'),
    bullet('인공지능·빅데이터 활용 시 관련 가이드 준수(해당 시)'),
    bullet('웹사이트 구축·운영 가이드 준수(행정안전부)'),
    h2('공동수급·하도급 계획'),
    p(valueOrHint(answers, 'coBid', '공동수급·하도급 계획 여부', hints)),
    ...commonProposalSections(answers),
  ];
}

// 실제 접수된 정보화사업 제안요청서(통일부 사례 등)의 "제안서 세부 작성지침"을 준용한 표
const PROPOSAL_DETAIL_GUIDE = [
  ['1. 일반현황', '제안사의 일반현황, 주요 연혁, 조직 및 인원, 주요 사업 분야 등을 제시'],
  ['2. 경영상태', '재무구조, 대외 인지도 및 신용도. 최근 3년간 자본금, 매출액, 당기순이익 등을 제시하고 재무제표를 별첨'],
  ['3. 사업 수행실적', '최근 3년간 관련 주요 사업실적 및 금액 제시 (실적증명서가 첨부된 자료만 인정)'],
  ['4. 수행조직 및 업무분장', '사업을 수행할 조직 및 업무분장을 제시. 공동수급 시 구성원별 참여비율을 명시'],
  ['5. 사업 이해도', '제안요청 내용을 명확히 이해하고 본 제안의 목적·범위·전제조건·특징 및 장점을 요약 제시'],
  ['6. 추진 전략', '위험요소를 고려하여 사업을 효과적으로 수행하기 위한 창의적이고 타당한 대안 제시'],
  ['7. 적용기술', '사업수행을 위한 주요 적용기술(신기술 등)과 실현가능성을 제시'],
  ['8. 표준프레임워크 적용', '적용 여부와 적용 시 예상되는 문제점, 실현 가능한 대응 방안을 제시'],
  ['9. 개발 방법론', '적용할 방법론의 절차·기법과 활용방안, 단계별 산출물의 종류·시기를 제시'],
  ['10. 시스템 장비구성 요구사항', '하드웨어·소프트웨어·기타 부문별 사양, 설치·공급 계획, 유지보수 방안을 제시'],
  ['11. 기능 요구사항', '기능 요구사항별 개발 방안과 기술 적용 방안을 제시'],
  ['12. 보안 요구사항', '보안 대책, 인원·자료·사무실·매체·장비·네트워크 보안 관리 방안, 보안 약점 제거방안을 제시'],
  ['13. 데이터 요구사항', 'DB 설계·관리 방안 및 관련 산출물을 제시'],
  ['14. 제약사항', '기능·품질 등 요구사항 구현 시 제약사항과 대응방안을 제시'],
  ['15. 성능·품질·인터페이스', '성능 진단·테스트 방안, 품질관리 방안, 화면 디자인 및 웹표준·접근성 준수 방안을 제시'],
  ['16. 프로젝트 관리', '일정·위험·보안·형상관리 방법과 문제 발생 시 보고체계를 제시'],
  ['17. 프로젝트 지원', '품질보증(SP인증 등), 시험운영, 교육훈련, 유지관리, 하자보수, 기밀보안, 비상대책 방안을 제시'],
  ['18. 상생협력 및 하도급', '중소기업 참여비율, 하도급 대상 기술 적합성 및 대금지급 방식의 적정성을 제시'],
  ['19. 기타', '안정화 방안 등 위 항목에 포함되지 않은 사항을 기술'],
];

function commonProposalSections(answers) {
  return [
    h1('V. 제안서 작성요령'),
    h2('1. 제안서의 효력'),
    p('제안서에 제시된 내용과 발주기관 요구에 따라 수정·보완·변경된 제안내용은 계약서에 명시하지 않더라도 계약서와 같은 효력을 가짐(다만 계약서에 명시된 경우는 계약서 우선). 발주기관은 필요시 제안사에 자료를 요구할 수 있으며 제출된 자료는 제안서와 동일한 효력을 가짐. 제출된 제안서 내용은 발주기관이 요청하지 않는 한 변경할 수 없으며 계약조건의 일부로 간주함'),
    h2('2. 제안서 작성지침 및 유의사항'),
    bullet('제안서는 제안요청서에서 요구하는 모든 사항이 기술되어야 하며, 향상된 내용으로 제안 가능'),
    bullet('제안서는 제시된 목차 및 세부작성지침을 준용하여 세분화하여 누락 없이 작성하고, 제안요청서 요구항목들이 제안서 어느 부분에 기술되었는지 대응 페이지를 표시한 "제안서 평가 조견표(3단 비교)"를 제안서 첫 페이지에 첨부'),
    bullet('A4 규격 전자문서(PDF)로 작성 권고, 종 방향 작성 원칙(부득이한 경우 횡 방향 일부 허용)'),
    bullet('본문 내용은 양면인쇄 기준 [250]장 이내로 작성 권고, 전자파일 용량은 [300]MB 이내로 준수'),
    bullet('제안서 각 페이지 하단 중앙에 일련번호를 부여하되, 장별로 번호를 새로 부여'),
    bullet('제안서는 한글(국어) 작성이 원칙이며, 사용된 영문약어에 대해서는 별도 약어표를 제공'),
    bullet('제안서 내용은 명확한 용어로 표현해야 함 — "사용 가능하다", "할 수 있다", "고려하고 있다" 등 모호한 표현은 평가 시 불가능한 것으로 간주하며, 계량화 가능한 사항은 반드시 계량화'),
    bullet('제안서 내용을 객관적으로 입증할 수 있는 관련 자료는 별첨으로 제출하고, 인용 자료는 출처를 명확히 표기'),
    bullet('새로운 기술·이론·장비를 제안하는 경우 그 배경과 적용 사례, 본 사업 적용 가능성을 충분히 제시'),
    bullet('제안요청서 내용 중 제안서에 명시되지 않은 부분은 제안하지 않은 것으로 간주하여 평가 가능'),
    bullet('제출된 제안서는 일체 반환하지 않으며, 제안과 관련된 일체의 비용은 제안사 부담'),
    bullet('KS, 관련 법규, 표준규격 등 관련 지침을 고려하여 작성하고 적용 근거를 명시'),
    bullet('본 사업과 관련된 업무를 수행하면서 취득한 정보에 대해서는 비밀을 유지해야 함'),
    h2('3. 제안서 목차'),
    table([2400, 7238], ['목차', '작성요령'], PROPOSAL_TOC),
    h2('4. 제안서 세부 작성지침'),
    table([2600, 6838], ['항목', '작성방법'], PROPOSAL_DETAIL_GUIDE),
    h1('VI. 제안 안내사항'),
    h2('1. 입찰방식'),
    bullet('기본방침: 객관적이고 공정한 기준과 절차를 적용하여 경쟁에 의한 우수 사업자를 선정'),
    bullet(`사업자 선정 방식(계약방법): ${COMMON_BID_METHOD}`),
    bullet('입찰참가자격: 조달청 경쟁입찰참가자격 등록증 소지, 「소프트웨어 진흥법」 제24조에 따른 소프트웨어사업자 등록, 국가계약법 시행령 제76조상 부정당업자 제한에 해당하지 않는 자'),
    bullet(bigCorpRestrictionText(answers.budget)),
    bullet('공동수급: 공동이행방식 허용, 구성원은 대표사 포함 [5]인 이하, 구성원별 최소 지분율 [10]% 이상'),
    bullet('낙찰자 결정 이후에는 공동수급체 구성원을 변경할 수 없으며, 동일 구성원이 다른 공동수급체에 중복 참가 불가'),
    h2('2. 제안서 평가 방법'),
    p('기술평가(90%)와 가격평가(10%)를 실시하여 종합평가점수로 평가. 기술평가위원회를 구성하여 각 위원 점수 중 최고·최저 1개씩 제외한 뒤 산술평균하여 90점 만점으로 환산하며, 기술능력평가 배점한도의 [85]% 이상을 획득한 자를 협상적격자로 선정. 평가점수는 소수점 다섯째자리에서 반올림'),
    p('우선협상대상자와 협상이 결렬되면 차순위자와 순차적으로 협상하며, 모든 협상대상자와 결렬 시 재공고 입찰을 실시'),
    h2('3. 기술성 평가기준'),
    table(
      [2600, 4200, 1600],
      ['평가항목', '세부평가항목', '배점'],
      TECH_SCORE_TABLE.map((r) => [r.item, r.detail, r.score])
    ),
    h2('4. 제출서류'),
    bullet('나라장터에서 출력한 경쟁입찰참가자격등록증 1부'),
    bullet('법인 등기부등본(개인사업자는 사업자등록증) 1부'),
    bullet('소프트웨어사업자 일반 현황 관리확인서 1부'),
    bullet('제안서 전자파일: 정성제안서·정량제안서·발표자료 각 1식'),
    h2('5. 기타 유의사항'),
    bullet('과업심의위원회: 본 사업은 「소프트웨어 진흥법」 제50조에 따른 과업내용 확정을 위해 과업심의위원회를 개최한 사업이며, 향후 과업내용 변경 시에도 동 위원회를 통해 계약금액·기간 조정 심의'),
    bullet('하도급 관리감독: 발주기관은 「소프트웨어 진흥법」 제51조에 따라 하도급 제한규정 준수 여부를 지속 관리·감독'),
    bullet('하도급 사전승인: 하도급계약 전 발주기관으로부터 반드시 사전승인을 받아야 함 (「소프트웨어 진흥법 시행규칙」 제14조)'),
    bullet('하도급 비율제한: 사업금액의 100분의 50 초과 금지, 재하도급은 원칙적으로 불허'),
    bullet('공동수급 구성 의무: 하도급 비율이 전체 사업금액의 10%를 초과하는 경우, 하도급이 아닌 공동수급체 구성으로 참여해야 함'),
    bullet('SW사업 작업장소(원격지 개발): 계약당사자 간 상호 협의로 결정하며, 원격개발 시 관리적·물리적·기술적 보안대책을 구체적으로 제시해야 함'),
    bullet('지식재산권 귀속: 계약목적물의 지식재산권은 발주기관과 계약상대자가 공동 소유하는 것을 원칙으로 하되(균등 지분), 협의를 통해 달리 정할 수 있음'),
    bullet('개발SW 공동활용: 타 기관과의 공동활용 계획이 있는 경우 사전에 명시'),
    bullet('하자담보 책임기간: 시스템 구축 완료(검수) 후 [1]년으로 하며, 동 기간 중 하자 발생 시 즉시 보완'),
    bullet('제안서 보상: 제출된 제안서는 반환하지 않으며, 별도의 제안서 보상 예산을 책정하지 않은 경우 보상을 실시하지 않음'),
    bullet('적정사업기간 산정: 「소프트웨어사업 계약 및 관리감독에 관한 지침」 제10조에 따른 소프트웨어 개발사업 적정 사업기간 산정 기준을 적용'),
    bullet('투입인력 요구관리 금지: 사업대가를 기능점수(FP) 방식으로 산정한 경우 투입인력 요구 및 관리는 금지 대상'),
    bullet('SW사업 영향평가: 「소프트웨어 진흥법」 제43조에 따라 사업발주 전 소프트웨어사업 영향평가를 실시'),
    bullet('SW사업정보 제출: 「소프트웨어 진흥법」 제46조에 따라 SW사업정보(수행 및 실적정보)를 SW사업정보저장소(www.spir.kr)에 제출'),
    bullet('DB 표준 준수: 공공기관의 데이터베이스 표준화 지침, 공공데이터 관리지침·품질관리 매뉴얼(행정안전부)을 준수'),
    bullet('특정규격 명시 금지: 「정부 입찰·계약 집행기준」 제5조에 따라 특정상표·특정규격·모델을 부당하게 지정하여 입찰에 부치거나, 규격·품질·성능이 동등 이상인 물품을 특정상표·모델이 아니라는 이유로 납품 거부하거나 참가자격을 제한할 수 없음'),
    ...buildAttachmentsChapter(answers),
    ...buildFormsChapter(answers),
  ];
}

// 별지 제4호 - 평가항목 참조표: TECH_SCORE_TABLE(기술성 평가기준표)을 그대로 재사용해 만든다.
// 데이터를 두 곳에 따로 유지하지 않도록, "VI.3 기술성 평가기준" 표와 항상 같은 내용을 갖는다.
function buildEvalReferenceTable() {
  return {
    id: 'form_eval_ref',
    title: '평가항목 참조표',
    note: '평가항목 및 평가요소는 제안요청서 상의 평가표(VI.3 기술성 평가기준)와 동일하게 작성하며, 제안사가 제안서 어느 부분에서 각 항목을 다루었는지 표시한다.',
    widths: [2600, 4200, 1600, 1238],
    headers: ['평가항목', '세부평가항목', '배점', '제안서 대응 위치'],
    rows: TECH_SCORE_TABLE.map((r) => [r.item, r.detail, r.score, '']),
  };
}

// VII. 별첨 — 「공공SW사업 제안요청서 작성 예시(2022.07)」의 별첨 구성을 그대로 따른다.
// 서식 자체(양식)는 법령상 고정된 표준 서식이므로 유사사업 유무와 무관하게 항상 같은 기본서식을 붙이되,
// 사업명 등 이미 입력된 사업 정보가 있으면 그 값으로 미리 채워 넣는다.
function buildAttachmentsChapter(answers) {
  return [h1('VII. 별첨'), ...renderTemplateList(ATTACHMENTS, answers)];
}

// VIII. 서식 — 가.제안서 제출용 서식(별지) / 나.계약이행 중 사용 서식으로 구분
function buildFormsChapter(answers) {
  // 별지 제7호(기술능력평가표) 바로 다음에 (TECH_SCORE_TABLE에서 생성한) 평가항목 참조표를 끼워 넣는다.
  const evalIdx = FORMS_BIDDER.findIndex((f) => f.id === 'form_b7');
  const insertAt = evalIdx === -1 ? FORMS_BIDDER.length : evalIdx + 1;
  const bidderItems = [...FORMS_BIDDER.slice(0, insertAt), buildEvalReferenceTable(), ...FORMS_BIDDER.slice(insertAt)];
  return [
    h1('VIII. 서식'),
    h2('가. 제안서 제출용 서식 (별지)'),
    ...renderTemplateList(bidderItems, answers),
    h2('나. 계약이행 중 사용 서식'),
    ...renderTemplateList(FORMS_CONTRACT, answers),
  ];
}

function buildGenericTypeBody(typeId, answers, hints) {
  const type = getType(typeId);
  const rows = type.questions.map((q) => [
    q.label,
    q.id === 'name' ? (answers.name || placeholder(q.label)) : valueOrHint(answers, q.id, q.label, hints),
  ]);
  return [
    h1('I. 사업개요'),
    table([2400, 7238], ['항목', '내용'], rows),
    h1('II. 시스템 현황'),
    ...templateHint('현행 업무·시스템 현황과 문제점, 그에 따른 개선방안을 위 사업개요 답변을 바탕으로 서술'),
    h1('III. 사업 추진방안'),
    ...templateHint('추진목표, 추진전략, 추진체계, 추진일정을 구체적으로 서술'),
    h1('IV. 제안요청 내용'),
    ...templateHint('사업범위 및 상세 요구사항을 위 사업개요 답변을 바탕으로 구체화하여 서술'),
    ...commonProposalSections(answers),
  ];
}

// 조달청 e-제안요청 도움의 "AI 자가진단"을 참고한 간단한 규칙 기반 점검 결과를 문서 앞머리에 넣는다.
const SELF_CHECK_TYPE_LABEL = { vague: '모호한 표현', brand: '특정 상표·제품명 언급 우려' };
function buildSelfCheckSection(answers) {
  const issues = runSelfCheck(answers);
  const heading = new Paragraph({
    spacing: { before: 100, after: 80 },
    children: [
      new TextRun({ text: '자가진단 결과  ', bold: true, size: 22, color: '0C447C' }),
      new TextRun({ text: '(입력하신 서술형 답변을 자동으로 점검한 결과입니다)', size: 15, italic: true, color: '888888' }),
    ],
  });
  if (!issues.length) {
    return [
      heading,
      new Paragraph({
        spacing: { after: 200 },
        children: [new TextRun({ text: '✓ 검토 결과: 모호한 표현이나 특정 상표·제품명 언급이 검출되지 않았습니다.', color: '2F6610', size: 18 })],
      }),
    ];
  }
  const rows = issues.flatMap((issue) => issue.excerpts.map((ex) => [issue.label, SELF_CHECK_TYPE_LABEL[issue.type], ex]));
  return [
    heading,
    p('⚠ 다음 문구를 검토해주세요. 자동 검출이므로 실제로 문제가 없는 표현이면 그대로 두어도 됩니다.'),
    table([2000, 2400, 5238], ['입력 항목', '점검 유형', '해당 문구'], rows),
  ];
}

async function generateDocx({ typeId, answers, reference }) {
  const type = getType(typeId);
  if (!type) throw new Error('알 수 없는 사업 유형입니다.');

  const title = (answers.name || `[${type.label}] 제안요청서`) + ' 제안요청서 (초안)';
  const children = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 100 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: '0C447C', space: 8 } },
      children: [new TextRun({ text: title, bold: true, size: 36, color: '0C447C' })],
    }),
  ];

  // 표지 담당자 정보 (실제 「소프트웨어사업 계약 및 관리감독에 관한 지침」 별지 제5호서식의
  // "담당 소속/직위/성명/전화번호/e-mail" 표지 항목을 참고한 형식)
  const contactParts = [answers.contactDept, answers.contactName, answers.contactPhone, answers.contactEmail].filter(Boolean);
  if (contactParts.length) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 100 },
        children: [new TextRun({ text: `담당: ${contactParts.join(' / ')}`, size: 18, color: '555555' })],
      })
    );
  }

  if (reference) {
    const refLine =
      reference.source === 'upload'
        ? `※ 참고한 유사 사업 자료: 사용자 등록 파일 "${reference.fileName || ''}"${reference.supported ? ' (본문 자동 인식됨)' : ' (본문 미인식 — 파일명만 참고)'}`
        : `※ 참고한 유사 사업 공고: ${reference.bidNtceNm || ''} (${reference.ntceInsttNm || ''}, ${reference.bidNtceDt || ''})`;
    children.push(
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun({ italic: true, color: '9C6500', size: 18, text: refLine })],
      })
    );
  }

  // 색상 범례: 문서 전체에서 파란 굵은 글씨/주황 기울임 글씨가 어떤 의미인지 한 번만 안내
  children.push(
    new Paragraph({
      spacing: { after: 300 },
      children: [
        new TextRun({ text: '범례  ', bold: true, size: 18, color: '555555' }),
        new TextRun({ text: '[대괄호] 굵은 파란 글씨', bold: true, color: HIGHLIGHT_COLOR, size: 18 }),
        new TextRun({ text: ' = 발주기관이 실제 수치로 확정·확인해야 하는 부분   ', size: 18, color: '555555' }),
        new TextRun({ text: '주황 기울임 글씨', italic: true, color: 'B7791F', size: 18 }),
        new TextRun({ text: ' = 참고자료에서 자동 추정한 값(검토 필요)', size: 18, color: '555555' }),
      ],
    })
  );

  children.push(...buildSelfCheckSection(answers));

  // 목차 (워드에서 열람 시 "필드 업데이트"를 하면 아래 I~VIII 제목이 자동으로 채워짐)
  children.push(
    new Paragraph({ spacing: { before: 100, after: 80 }, children: [new TextRun({ text: '목  차', bold: true, size: 28, color: '0C447C' })] }),
    new Paragraph({
      spacing: { after: 100 },
      children: [new TextRun({ italic: true, size: 16, color: '888888', text: '※ 워드에서 이 문서를 열고 마우스 오른쪽 버튼으로 아래 영역을 클릭 → "필드 업데이트"를 누르면 목차가 자동으로 채워집니다.' })],
    }),
    new TableOfContents('목차', { hyperlink: true, headingStyleRange: '1-2' }),
    new Paragraph({ children: [new PageBreak()] })
  );

  const hints = buildHints(reference);
  const body = typeId === 'build' ? buildBuildTypeBody(answers, hints) : buildGenericTypeBody(typeId, answers, hints);
  children.push(...body);

  const doc = new Document({
    sections: [{ properties: {}, children }],
  });

  return Packer.toBuffer(doc);
}

module.exports = { generateDocx };
