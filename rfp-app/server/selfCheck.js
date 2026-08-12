// 조달청 "e-제안요청 도움" 시스템의 "AI 자가진단"(작성된 제안요청서의 법제도 위반 여부 사전 검출)
// 기능을 참고해 만든 간단한 규칙 기반 자가진단. 완벽한 자연어 분석은 아니지만, 실무에서 가장 자주
// 지적되는 두 가지 — 모호한 표현, 특정 상표·규격 명시 — 를 사용자가 입력한 문장에서 찾아 알려준다.

// 「소프트웨어사업 계약 및 관리감독에 관한 지침」과 V.2 작성지침에서 "평가 시 불가능한 것으로 간주"
// 한다고 명시한 모호한 표현들
const VAGUE_PATTERNS = [
  /할\s*수\s*있다/g,
  /가능하다/g,
  /고려하고\s*있다/g,
  /검토\s*중이다/g,
  /예정이다/g,
  /할\s*방침이다/g,
];

// 「정부 입찰·계약 집행기준」 제5조에 따라 특정상표·특정규격 명시가 금지되는, 실무에서 자주 등장하는
// 상용 제품·브랜드명 (일반 기술 용어인 "윈도우"·"리눅스"·"데이터베이스" 등은 제외)
const BRAND_KEYWORDS = [
  '오라클', 'Oracle', 'MS-SQL', 'SQL Server', 'SAP', '한글과컴퓨터', '한컴오피스',
  'AWS', '아마존웹서비스', 'Azure', '애저', 'VMware', '브이엠웨어', 'Cisco', '시스코',
  'Microsoft 365', '마이크로소프트',
];

// 자유 서술형 답변 필드만 검사 대상으로 한다 (사업기간·예산처럼 정형 데이터인 필드는 제외)
const CHECKABLE_FIELDS = {
  background: '추진배경 및 필요성',
  scope: '사업범위',
  currentStatus: '현행 시스템/기관 현황',
  requirements: '상세 요구사항',
  coBid: '공동수급·하도급 계획',
};

function excerptAround(text, index, matchLen, radius = 15) {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + matchLen + radius);
  return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`;
}

function findMatches(text, patterns) {
  const found = [];
  patterns.forEach((pattern) => {
    const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
    let m;
    while ((m = re.exec(text)) !== null) {
      found.push(excerptAround(text, m.index, m[0].length));
      if (m.index === re.lastIndex) re.lastIndex += 1; // 무한루프 방지
    }
  });
  return found;
}

// answers: 사용자가 입력한 전체 답변 객체. 반환: [{ field, label, type: 'vague'|'brand', excerpts: [] }]
function runSelfCheck(answers) {
  const issues = [];
  Object.entries(CHECKABLE_FIELDS).forEach(([fieldId, label]) => {
    const text = (answers[fieldId] || '').trim();
    if (!text) return;

    const vagueHits = findMatches(text, VAGUE_PATTERNS);
    if (vagueHits.length) {
      issues.push({ field: fieldId, label, type: 'vague', excerpts: [...new Set(vagueHits)].slice(0, 5) });
    }

    const brandHits = BRAND_KEYWORDS.filter((kw) => text.includes(kw));
    if (brandHits.length) {
      issues.push({ field: fieldId, label, type: 'brand', excerpts: brandHits });
    }
  });
  return issues;
}

module.exports = { runSelfCheck };
