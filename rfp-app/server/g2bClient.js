// 조달청 나라장터 입찰공고정보서비스(공공데이터포털) 조회 클라이언트.
// 참고: 조달청_OpenAPI참고자료_나라장터_입찰공고정보서비스_1.2.docx (사용자 제공, data.go.kr 공식 문서)
// 실제 경로에는 "/ad/" 세그먼트가 들어가야 하며(참고자료 예시 기준), dminsttNm(수요기관명)·bidNtceNm(공고명)은
// 둘 다 부분 일치 검색을 지원하는 옵션 파라미터임.
// 인증키는 사용자가 화면에서 직접 입력한 값을 그 요청에서만 사용한다 (서버에 저장하지 않음).

const BASE_URL =
  'http://apis.data.go.kr/1230000/ad/BidPublicInfoService/getBidPblancListInfoServcPPSSrch';

const WINDOW_DAYS = 30; // 이 API는 조회기간이 약 30일을 넘으면 "입력범위값 초과 에러"(resultCode 07)를 반환함
const MIN_RESULTS = 2; // 이만큼 모일 때까지 검색기간을 이전 구간으로 넓혀감
const MAX_WINDOWS = 6; // 안전장치: 최대 6구간(약 6개월) 넘게는 뒤로 확장하지 않음 (일일 호출한도 보호)
const REQUEST_TIMEOUT_MS = 10000; // 나라장터 서버가 응답 없이 멈추는 경우를 대비한 타임아웃

// 공고명 기준으로 "정보화사업"인지 걸러내는 키워드 (제목 기반 휴리스틱이라 완벽하지 않음)
// "개발", "구축", "고도화", "데이터" 처럼 IT 외 정책·연구용역에도 흔히 쓰이는 일반 단어는
// 오탐(false positive)이 잦아 제외하고, IT 맥락에서만 주로 쓰이는 단어 위주로 구성한다.
const IT_PROJECT_KEYWORDS = [
  '정보시스템', '정보화', '전산', '소프트웨어', 'SW', '시스템', '홈페이지', '웹사이트', '웹서비스',
  '플랫폼', '포털', '앱', 'App', 'APP', '어플리케이션', '데이터베이스', 'DB', '빅데이터',
  '인공지능', 'AI', 'ICT', '클라우드', '네트워크망', '서버', '정보보안', '정보보호', '전자정부',
  '감리', 'ISP', '정보화전략계획', '통신망', '망분리',
];

function isItProject(bidNtceNm) {
  const name = bidNtceNm || '';
  return IT_PROJECT_KEYWORDS.some((kw) => name.includes(kw));
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

// 서비스키가 없을 때 사용하는 목업 데이터 (프로토타입 동작 확인용)
function mockResults(type) {
  const samples = {
    build: [
      { bidNtceNm: '(예시-목업) 동북아평화자료원(가칭) 정보시스템 구축 1차 사업', ntceInsttNm: '통일부', dminsttNm: '통일부', bidNtceDt: '2026-01-15', bidNtceNo: 'MOCK-0001' },
      { bidNtceNm: '(예시-목업) 통일교육정보시스템 고도화 사업', ntceInsttNm: '통일부', dminsttNm: '통일부', bidNtceDt: '2025-11-03', bidNtceNo: 'MOCK-0002' },
      { bidNtceNm: '(예시-목업) 북한이탈주민 지원시스템 구축 사업', ntceInsttNm: '통일부', dminsttNm: '통일부', bidNtceDt: '2025-08-20', bidNtceNo: 'MOCK-0003' },
    ],
  };
  return samples[type] || samples.build;
}

// 특정 [begin, end] 구간 하나를 조회한다 (최대 약 30일 폭이라는 API 제약을 지키는 것은 호출부 책임)
async function fetchWindow({ begin, end, serviceKey, dminsttNm }) {
  const params = new URLSearchParams({
    ServiceKey: serviceKey,
    type: 'json',
    inqryDiv: '1',
    inqryBgnDt: `${formatDate(begin)}0000`,
    inqryEndDt: `${formatDate(end)}2359`,
    numOfRows: '100',
    pageNo: '1',
  });
  // dminsttNm(수요기관명)만 서버 필터로 걸어 후보군을 받아오고, bidNtceNm까지 동시에 걸면
  // 교집합이 너무 좁아 0건이 되기 쉬우므로 공고명 키워드는 클라이언트 측 재정렬에서만 반영한다.
  if (dminsttNm) params.set('dminsttNm', dminsttNm);

  const url = `${BASE_URL}?${params.toString()}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(url, { signal: controller.signal });
  } catch (e) {
    if (e.name === 'AbortError') {
      throw new Error(`나라장터 서버 응답이 ${REQUEST_TIMEOUT_MS / 1000}초 동안 없어 요청을 중단했습니다. 호출량이 많아 일시적으로 지연되는 경우일 수 있으니 잠시 후 다시 시도해주세요.`);
    }
    const cause = e.cause ? ` (원인: ${e.cause.code || e.cause.message || e.cause})` : '';
    throw new Error(`나라장터 서버 연결 실패: ${e.message}${cause}`);
  } finally {
    clearTimeout(timer);
  }
  const text = await res.text();

  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    const ct = res.headers.get('content-type') || '';
    throw new Error(`OpenAPI 응답을 해석할 수 없습니다 (JSON 아님). status=${res.status} content-type=${ct} 응답 앞부분: ${text.slice(0, 500)}`);
  }

  const header = json?.response?.header;
  if (header && header.resultCode && header.resultCode !== '00') {
    throw new Error(`OpenAPI 오류: [${header.resultCode}] ${header.resultMsg}`);
  }

  const body = json?.response?.body;
  // 이 API는 body.items가 곧바로 배열임 (다른 일부 data.go.kr API처럼 body.items.item 형태가 아님)
  const rawItems = Array.isArray(body?.items) ? body.items : body?.items?.item;
  return Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];
}

async function searchSimilarRfps({ type, keywords, serviceKey, dminsttNm = '통일부' }) {
  if (!serviceKey) {
    return { mocked: true, items: mockResults(type) };
  }

  // 최근 30일 구간부터 시작해서, 모인 건수가 MIN_RESULTS에 못 미치면 그 이전 30일 구간을
  // 추가로 조회해서 합치는 방식으로 최대 MAX_WINDOWS 구간까지 확장한다.
  const collected = [];
  const seenNo = new Set();
  let windowsUsed = 0;
  let windowEnd = new Date();

  for (let i = 0; i < MAX_WINDOWS; i += 1) {
    const windowBegin = new Date(windowEnd);
    windowBegin.setDate(windowBegin.getDate() - WINDOW_DAYS);

    const items = await fetchWindow({ begin: windowBegin, end: windowEnd, serviceKey, dminsttNm });
    windowsUsed += 1;
    for (const it of items) {
      if (!isItProject(it.bidNtceNm)) continue; // 정보화사업으로 보이지 않는 공고(학술대회, 실태조사 등)는 제외
      const key = it.bidNtceNo || `${it.bidNtceNm}-${it.bidNtceDt}`;
      if (!seenNo.has(key)) {
        seenNo.add(key);
        collected.push(it);
      }
    }

    if (collected.length >= MIN_RESULTS) break;
    windowEnd = windowBegin; // 다음 반복에서 그 이전 30일 구간을 조회
  }

  // 공고명에 유형별 키워드가 얼마나 포함되는지로 재랭킹 (첨부파일 본문까지의 정밀 유사도 분석은 아님)
  const scored = collected.map((it) => {
    const name = it.bidNtceNm || '';
    const hit = (keywords || []).reduce((acc, kw) => acc + (name.includes(kw) ? 1 : 0), 0);
    return { item: it, score: hit };
  });
  scored.sort((a, b) => b.score - a.score || new Date(b.item.bidNtceDt) - new Date(a.item.bidNtceDt));

  const top3 = scored.slice(0, 3).map((s) => s.item);
  return {
    mocked: false,
    items: top3,
    totalFetched: collected.length,
    searchedDays: windowsUsed * WINDOW_DAYS,
    windowsUsed,
  };
}

module.exports = { searchSimilarRfps };
