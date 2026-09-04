/**
 * 우측 툴바 · 레이어 관리자 · 검토 패널 등 cad-simple-ui-plugin 의 UI 문구를 한국어로.
 *
 * cad-simple-viewer 의 AcApI18n 은 'ko' 로케일 버킷이 없고, 플러그인은 영어('en')
 * 버킷에 `simpleUi.*` 를 등록한다. 그래서 여기서는 **'en' 버킷의 해당 값을 한국어로
 * 덮어써서** 로케일 전환 없이 툴바만 한글로 보이게 한다(app.ts 에서 플러그인 등록
 * 직후 merge). 나머지(진행 메시지 등)는 영어 그대로 둔다.
 */
export const koUiMessages = {
  command: {
    ACAD: {
      layer: { description: '레이어 관리자 패널을 엽니다' },
      markuppanel: { description: '검토 목록 패널을 엽니다' }
    }
  },
  simpleUi: {
    toolbar: {
      select: '선택',
      pan: '화면 이동',
      zoomExtent: '전체 보기',
      zoomWindow: '창 확대',
      layer: '레이어 관리자',
      measure: '측정',
      measureDistance: '거리 측정',
      measureAngle: '각도 측정',
      measureArea: '면적 측정',
      measureArc: '호 길이 측정',
      measurePoint: '점 좌표 측정',
      showMeasurements: '측정값 표시',
      hideMeasurements: '측정값 숨기기',
      measurementImport: '측정 가져오기',
      measurementExport: '측정 내보내기',
      clearMeasurements: '측정 지우기',
      switchBg: '배경색 전환',
      annotation: '검토 도구',
      markupCloud: '구름형 표시',
      markupCallout: '지시선',
      markupText: '텍스트',
      markupRect: '사각형',
      markupCircle: '원',
      markupArrow: '화살표',
      markupStamp: '스탬프',
      markupPanel: '검토 목록',
      markupImport: '검토 가져오기',
      markupExport: '검토 내보내기',
      clearMarkups: '검토 표시 지우기',
      showMarkup: '검토 표시 보기',
      hideMarkup: '검토 표시 숨기기',
      export: '내보내기',
      exportHtml: 'HTML 내보내기',
      exportPdf: 'PDF 내보내기',
      exportSvg: 'SVG 내보내기',
      placement: '툴바 위치',
      placementTop: '위',
      placementBottom: '아래',
      placementLeft: '왼쪽',
      placementRight: '오른쪽',
      themeLight: '어두운 테마로 전환',
      themeDark: '밝은 테마로 전환',
      localeEn: '언어 전환',
      localeZh: '언어 전환',
      collapse: '툴바 접기',
      expand: '툴바 펼치기'
    },
    layerManager: {
      title: '레이어 관리자',
      name: '이름',
      on: '켜기',
      color: '색상',
      currentLayer: '현재 레이어',
      zoomToLayer: '레이어로 확대: {layer}',
      sortByNameAsc: '이름 오름차순 정렬',
      sortByNameDesc: '이름 내림차순 정렬',
      sortByNameNone: '이름 정렬 해제'
    },
    colorPicker: {
      title: '색상 선택',
      index: '색상 번호: ',
      rgb: 'RGB: ',
      input: '색상',
      inputPlaceholder: '1-255 또는 #RRGGBB',
      ok: '확인',
      cancel: '취소'
    },
    dockPanel: {
      close: '패널 닫기',
      dockSide: '도킹 위치',
      dockTop: '위에 도킹',
      dockBottom: '아래에 도킹',
      dockLeft: '왼쪽에 도킹',
      dockRight: '오른쪽에 도킹',
      moreTabs: '탭 더보기',
      tab: { layers: '레이어', review: '검토' }
    },
    reviewPalette: {
      searchPlaceholder: '검토 표시 검색',
      empty: '검토 표시 없음',
      type: '종류',
      status: '상태',
      author: '작성자',
      summary: '요약',
      details: '상세',
      closeDetails: '상세 닫기',
      label: '라벨',
      comment: '설명',
      zoomTo: '해당 위치로 확대',
      delete: '삭제',
      clear: '전체 지우기',
      statusValues: {
        open: '열림',
        question: '질문',
        answered: '답변됨',
        closed: '닫힘'
      },
      typeValues: {
        cloud: '구름형',
        callout: '지시선',
        text: '텍스트',
        rect: '사각형',
        circle: '원',
        arrow: '화살표',
        stamp: '스탬프',
        line: '선',
        highlight: '강조',
        symbol: '기호'
      }
    }
  }
}
