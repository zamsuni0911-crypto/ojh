// 참고자료(업로드 파일 본문 또는 나라장터 검색결과 메타데이터)에서
// 사용자가 "모름"으로 남긴 항목을 최대한 채워주기 위한 추출 로직.
// 어디까지나 휴리스틱(키워드 인접 텍스트 추출)이라 완벽하지 않으므로,
// 채워진 값에는 항상 "(참고자료 기반 추정)" 표시를 남겨 검토를 유도한다.
//
// 업로드 문서 기반 추출은 한 줄짜리 힌트가 아니라, 키워드가 등장한 지점부터
// "다음 섹션이 시작되기 전까지"를 통째로 가져오는 섹션 단위 추출을 사용한다.
// (예: "추진배경 및 필요성" 아래 여러 줄의 설명 문단을 전부 가져옴)

// 필드별로 업로드 문서 본문에서 찾을 제목/키워드 후보
// (「공공SW사업 제안요청서 작성 예시」의 장/절 제목을 우선순위로 반영)
const FIELD_TEXT_KEYWORDS = {
  background: ['추진배경 및 필요성', '추진배경', '배경 및 필요성', '필요성', '추진 배경'],
  period: ['사업기간', '계약기간', '수행기간'],
  budget: ['사업예산', '사업금액', '사업비', '예산액', '계약금액'],
  currentStatus: ['현행 시스템 개요', '현행 시스템 현황', '현황 및 문제점', '현행 시스템', '현황'],
  scope: ['사업 범위', '사업범위', '서비스 내용', '과업범위'],
  requirements: ['요구사항 총괄표', '상세 요구사항', '요구사항 정의', '기능 요구사항', '요구사항'],
  coBid: ['공동수급', '하도급'],
  scopeMaint: ['유지보수 범위'],
  scopeOps: ['운영범위', '운영 범위'],
  focus: ['중점', '점검 영역'],
  items: ['구매 품목', '품목 및 수량'],
  method: ['전환방식', '전환 방식'],
  dataGrade: ['데이터 등급', '망분리'],
};

// 한 필드당 가져올 수 있는 최대 분량 — 한 줄짜리 힌트가 아니라 문단(섹션) 단위로 채우기 위해 넉넉하게 잡는다.
const MAX_SECTION_CHARS = 700;
const MAX_SECTION_LINES = 30;

// "I.", "1.", "가." 같은 장/절 번호로 시작하는 짧은 줄은 새로운 챕터 제목으로 간주해 섹션의 끝으로 본다.
const HEADING_PATTERN = /^([IVXLC]+\s*[.)]|[0-9]+\s*[.)]|[가나다라마바사]\s*[.)])\s*\S/;

// 지금 채우는 필드가 아닌 "다른 필드"의 키워드로 시작하는 줄이 나오면, 다음 섹션이 시작된 것으로 보고 멈춘다.
function looksLikeNewSection(line, currentFieldId) {
  if (line.length < 30 && HEADING_PATTERN.test(line)) return true;
  return Object.entries(FIELD_TEXT_KEYWORDS).some(
    ([fieldId, keywords]) => fieldId !== currentFieldId && keywords.some((kw) => line.startsWith(kw))
  );
}

// text: 줄바꿈으로 구분된 문서 본문 전체
function extractHintsFromText(text) {
  if (!text) return {};
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const hints = {};

  for (const [fieldId, keywords] of Object.entries(FIELD_TEXT_KEYWORDS)) {
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      const hitKw = keywords.find((kw) => line.includes(kw));
      if (!hitKw) continue;

      // 키워드가 있는 줄 자체에 이어지는 내용이 있으면 그것부터 시작하고,
      // 이후 줄들은 "다음 섹션이 시작되기 전까지" 계속 이어 붙인다(섹션 단위 추출).
      const afterKw = line.slice(line.indexOf(hitKw) + hitKw.length).replace(/^[:：\s\-–]+/, '').trim();
      const collected = afterKw ? [afterKw] : [];

      let j = i + 1;
      let charCount = afterKw.length;
      while (j < lines.length && j - i <= MAX_SECTION_LINES && charCount < MAX_SECTION_CHARS) {
        const next = lines[j];
        if (looksLikeNewSection(next, fieldId)) break;
        collected.push(next);
        charCount += next.length + 1;
        j += 1;
      }

      const snippet = collected.join(' ').replace(/\s+/g, ' ').trim().slice(0, MAX_SECTION_CHARS).trim();
      if (snippet && !hints[fieldId]) {
        hints[fieldId] = snippet;
      }
      break;
    }
  }
  return hints;
}

// 나라장터 검색결과(메타데이터)에서 뽑을 수 있는 정도만 최소한으로 추출
// (검색 API는 문서 본문이 아닌 공고 메타데이터만 제공하므로 섹션 단위 추출 대상이 아님)
function extractHintsFromG2bItem(item) {
  if (!item) return {};
  const hints = {};
  const budget = item.asignBdgtAmt || item.presmptPrce;
  if (budget && Number(budget) > 0) {
    const won = Number(budget).toLocaleString('ko-KR');
    hints.budget = `${won}원 (참고사업 "${item.bidNtceNm || ''}"의 배정예산·추정가격 기준)`;
  }
  if (item.bidNtceNm) {
    hints.scope = `참고사업명 "${item.bidNtceNm}"의 사업 범위를 참고하여 유사하게 구성 가능`;
  }
  return hints;
}

function buildHints(reference) {
  if (!reference) return {};
  if (reference.source === 'upload') {
    return reference.supported && reference.textExcerpt ? extractHintsFromText(reference.textExcerpt) : {};
  }
  return extractHintsFromG2bItem(reference);
}

module.exports = { buildHints };
