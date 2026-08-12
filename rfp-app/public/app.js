const state = {
  types: [],
  selectedType: null,
  results: [],
  selectedReference: null,
  searchTimer: null,
  referenceChoice: null, // null(아직 안 물어봄) | 'auto' | 'upload' | 'skip'
  pendingSearchName: '',
};

const el = {
  layout: document.getElementById('layout'),
  typeList: document.getElementById('type-list'),
  emptyHint: document.getElementById('empty-hint'),
  formArea: document.getElementById('form-area'),
  selectedTypeTitle: document.getElementById('selected-type-title'),
  nameFieldSlot: document.getElementById('name-field-slot'),
  restFields: document.getElementById('rest-fields'),
  similarPanel: document.getElementById('similar-panel'),
  searchLoadingBox: document.getElementById('search-loading-box'),
  resultList: document.getElementById('result-list'),
  resultNote: document.getElementById('result-note'),
  btnGenerate: document.getElementById('btn-generate'),
  status: document.getElementById('status'),
  fieldTooltip: document.getElementById('field-tooltip'),
  helpModal: document.getElementById('help-modal'),
  helpTypeList: document.getElementById('help-type-list'),
  tabAuto: document.getElementById('tab-auto'),
  tabUpload: document.getElementById('tab-upload'),
  refAutoPanel: document.getElementById('ref-auto-panel'),
  refUploadPanel: document.getElementById('ref-upload-panel'),
  refFileInput: document.getElementById('ref-file-input'),
  uploadStatus: document.getElementById('upload-status'),
  uploadResult: document.getElementById('upload-result'),
  choiceModal: document.getElementById('choice-modal'),
};

function openChoiceModal() {
  el.choiceModal.classList.remove('hidden');
}
function closeChoiceModal() {
  el.choiceModal.classList.add('hidden');
}
document.getElementById('choice-auto').addEventListener('click', () => {
  state.referenceChoice = 'auto';
  closeChoiceModal();
  switchRefTab('auto');
  if (state.pendingSearchName) runAutoSearch(state.pendingSearchName);
});
document.getElementById('choice-upload').addEventListener('click', () => {
  state.referenceChoice = 'upload';
  closeChoiceModal();
  switchRefTab('upload');
});
document.getElementById('choice-skip').addEventListener('click', () => {
  state.referenceChoice = 'skip';
  closeChoiceModal();
  el.resultNote.textContent = '참고 없이 진행합니다. 아래 항목을 계속 입력하시면 됩니다.';
});

el.tabAuto.addEventListener('click', () => {
  state.referenceChoice = 'auto';
  switchRefTab('auto');
});
el.tabUpload.addEventListener('click', () => {
  state.referenceChoice = 'upload';
  switchRefTab('upload');
});

function switchRefTab(which) {
  el.tabAuto.classList.toggle('active', which === 'auto');
  el.tabUpload.classList.toggle('active', which === 'upload');
  el.refAutoPanel.classList.toggle('hidden', which !== 'auto');
  el.refUploadPanel.classList.toggle('hidden', which !== 'upload');
}

el.refFileInput.addEventListener('change', async () => {
  const file = el.refFileInput.files[0];
  if (!file) return;
  el.uploadStatus.textContent = '파일을 분석하는 중입니다...';
  el.uploadResult.innerHTML = '';

  const formData = new FormData();
  formData.append('file', file);
  try {
    const res = await fetch('/api/upload-reference', { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '업로드 실패');

    // 나라장터 검색탭에서 체크해둔 항목이 있다면 해제 (참고자료는 한 번에 하나만 사용)
    document.querySelectorAll('#result-list .result-card').forEach((c) => {
      c.classList.remove('selected');
      const cb = c.querySelector('input[type="checkbox"]');
      if (cb) cb.checked = false;
    });

    state.selectedReference = {
      source: 'upload',
      fileName: data.fileName,
      supported: data.supported,
      textExcerpt: data.textExcerpt,
    };
    el.uploadStatus.textContent = data.note || '등록되었습니다. 이 파일을 참고 자료로 사용합니다.';
    const card = document.createElement('div');
    card.className = 'upload-card';
    card.innerHTML = `
      <div class="r-name">📎 ${escapeHtml(data.fileName)}</div>
      <div class="r-meta">${(data.sizeBytes / 1024).toFixed(0)}KB · ${data.supported ? '본문 인식됨' : '본문 미인식(파일명만 참고)'}</div>
    `;
    el.uploadResult.appendChild(card);
  } catch (e) {
    el.uploadStatus.textContent = `오류: ${e.message}`;
    state.selectedReference = null;
  }
});

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function labelHtml(label, help, required) {
  const safeLabel = escapeHtml(label);
  const requiredHtml = required
    ? '<span class="required-mark" aria-hidden="true">*</span><span class="sr-only">(필수)</span>'
    : '';
  const helpHtml = help
    ? ` <button type="button" class="help-btn" data-help="${escapeHtml(help)}">？</button>`
    : '';
  return `<label>${safeLabel}${requiredHtml}${helpHtml}</label>`;
}

// 필드 도움말 말풍선 (버튼 하나 공유)
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.help-btn');
  if (!btn) {
    el.fieldTooltip.classList.add('hidden');
    document.querySelectorAll('.help-btn.active').forEach((b) => b.classList.remove('active'));
    return;
  }
  const wasActive = btn.classList.contains('active');
  document.querySelectorAll('.help-btn.active').forEach((b) => b.classList.remove('active'));
  if (wasActive) {
    el.fieldTooltip.classList.add('hidden');
    return;
  }
  btn.classList.add('active');
  el.fieldTooltip.textContent = btn.dataset.help;
  el.fieldTooltip.classList.remove('hidden');
  const rect = btn.getBoundingClientRect();
  const tipWidth = 300;
  let left = rect.left;
  if (left + tipWidth > window.innerWidth - 16) left = window.innerWidth - tipWidth - 16;
  el.fieldTooltip.style.left = `${Math.max(8, left)}px`;
  el.fieldTooltip.style.top = `${rect.bottom + 8}px`;
});

function openHelpModal() {
  el.helpModal.classList.remove('hidden');
}
function closeHelpModal() {
  el.helpModal.classList.add('hidden');
}
document.getElementById('btn-help-2').addEventListener('click', openHelpModal);
document.getElementById('btn-help-close').addEventListener('click', closeHelpModal);
el.helpModal.addEventListener('click', (e) => {
  if (e.target === el.helpModal) closeHelpModal();
});

const STATUS_PREFIX = { ok: '완료', err: '오류', warn: '주의', info: '안내' };
function showStatus(msg, kind) {
  const prefix = STATUS_PREFIX[kind] || '';
  el.status.textContent = prefix ? `${prefix}: ${msg}` : msg;
  el.status.className = `status ${kind}`;
}
function hideStatus() {
  el.status.className = 'status hidden';
}

async function loadTypes() {
  const res = await fetch('/api/types');
  state.types = await res.json();
  renderTypeList();

  el.helpTypeList.innerHTML = state.types
    .map((t) => `<div class="help-type-item"><div class="ht-name">${escapeHtml(t.label)}</div><div class="ht-desc">${escapeHtml(t.desc || t.hint)}</div></div>`)
    .join('');

}

function renderTypeList() {
  el.typeList.innerHTML = '';
  state.types.forEach((t, idx) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'type-card';
    card.dataset.typeId = t.id;
    card.setAttribute('aria-pressed', 'false');
    const restLabel = t.label.replace(/^[①-⑩]\s*/, '');
    card.innerHTML = `
      <span class="t-badge">${idx + 1}</span>
      <div class="t-info">
        <div class="t-label" title="${escapeHtml(restLabel)}">${restLabel}</div>
        <div class="t-hint">${t.hint}</div>
      </div>`;
    card.addEventListener('click', () => selectType(t));
    el.typeList.appendChild(card);
  });
}

// 어느 화면에 있든(2단계 입력 중이라도) 메인화면(1단계 유형 선택 전 상태)으로 되돌린다.
function goHome() {
  clearTimeout(state.searchTimer);
  state.selectedType = null;
  state.results = [];
  state.selectedReference = null;
  state.referenceChoice = null;
  state.pendingSearchName = '';

  document.querySelectorAll('.type-card').forEach((c) => {
    c.classList.remove('selected');
    c.setAttribute('aria-pressed', 'false');
  });
  el.typeList.classList.remove('compact');
  el.layout.classList.add('pre-select');

  const introBanner = document.querySelector('.intro-banner');
  if (introBanner) introBanner.classList.remove('hidden');

  el.formArea.classList.add('hidden');
  el.emptyHint.classList.remove('hidden');
  hideStatus();
  closeChoiceModal();
  closeHelpModal();
}

function selectType(type) {
  state.selectedType = type;
  state.results = [];
  state.selectedReference = null;

  document.querySelectorAll('.type-card').forEach((c) => {
    const isSelected = c.dataset.typeId === type.id;
    c.classList.toggle('selected', isSelected);
    c.setAttribute('aria-pressed', String(isSelected));
  });
  el.typeList.classList.add('compact');
  el.layout.classList.remove('pre-select');

  const introBanner = document.querySelector('.intro-banner');
  if (introBanner) introBanner.classList.add('hidden');

  el.emptyHint.classList.add('hidden');
  el.formArea.classList.remove('hidden');
  el.selectedTypeTitle.textContent = `[2단계] 사업 정보 입력 — ${type.label.replace(/^[①-⑩]\s*/, '')}`;

  renderForm(type);
  hideStatus();
}

function renderForm(type) {
  el.similarPanel.classList.remove('hidden');
  el.resultList.innerHTML = '';
  el.resultNote.textContent = '사업명을 입력하면 어떻게 참고할지 안내해드립니다.';
  el.uploadResult.innerHTML = '';
  el.uploadStatus.textContent = '';
  el.refFileInput.value = '';
  el.searchLoadingBox.classList.add('hidden');
  state.referenceChoice = null;
  state.pendingSearchName = '';
  switchRefTab('auto');

  const nameQ = type.questions.find((q) => q.id === 'name');
  const restQs = type.questions.filter((q) => q.id !== 'name');

  el.nameFieldSlot.innerHTML = '';
  if (nameQ) {
    const row = document.createElement('div');
    row.className = 'form-row';
    row.innerHTML = `
      ${labelHtml(nameQ.label, nameQ.help, true)}
      <input data-id="name" type="text" placeholder="${escapeHtml(nameQ.placeholder || '')}" aria-describedby="name-field-error" />
      <p id="name-field-error" class="field-error hidden" role="alert">사업명을 입력해주세요.</p>
    `;
    el.nameFieldSlot.appendChild(row);
    const input = row.querySelector('input');
    const errorEl = row.querySelector('#name-field-error');
    input.addEventListener('input', () => {
      if (input.value.trim()) {
        input.removeAttribute('aria-invalid');
        errorEl.classList.add('hidden');
      }
      clearTimeout(state.searchTimer);
      const val = input.value.trim();
      if (val.length < 2) {
        el.resultList.innerHTML = '';
        el.resultNote.textContent = '사업명을 입력하면 어떻게 참고할지 안내해드립니다.';
        return;
      }
      state.searchTimer = setTimeout(() => {
        state.pendingSearchName = val;
        if (state.referenceChoice === null) {
          openChoiceModal();
        } else if (state.referenceChoice === 'auto') {
          runAutoSearch(val);
        }
        // referenceChoice === 'upload' 또는 'skip'인 경우는 다시 묻지 않고 자동검색도 하지 않음
      }, 700);
    });
  }

  el.restFields.innerHTML = '';
  restQs.forEach((q) => {
    const row = document.createElement('div');
    row.className = 'form-row';
    const isLong = q.id === 'requirements' || q.id === 'background';
    row.innerHTML = `
      <div class="label-row">
        ${labelHtml(q.label, q.help)}
        <label class="unknown-check">
          <input type="checkbox" data-unknown-for="${q.id}" /> 모름
        </label>
      </div>
      ${isLong
        ? `<textarea data-id="${q.id}" placeholder="${escapeHtml(q.placeholder || '')}"></textarea>`
        : `<input data-id="${q.id}" type="text" placeholder="${escapeHtml(q.placeholder || '')}" />`}
    `;
    const fieldEl = row.querySelector(`[data-id="${q.id}"]`);
    const unknownCb = row.querySelector('[data-unknown-for]');
    let savedValue = '';
    unknownCb.addEventListener('change', () => {
      if (unknownCb.checked) {
        savedValue = fieldEl.value;
        fieldEl.value = '';
        fieldEl.disabled = true;
        fieldEl.placeholder = '모름 처리됨 — 참고자료가 있으면 그 내용을 바탕으로 채워집니다';
      } else {
        fieldEl.disabled = false;
        fieldEl.value = savedValue;
        fieldEl.placeholder = q.placeholder || '';
      }
    });
    el.restFields.appendChild(row);
  });
}

async function runAutoSearch(nameText) {
  if (!state.selectedType) return;
  el.similarPanel.classList.remove('hidden');
  el.searchLoadingBox.classList.remove('hidden');
  el.resultNote.textContent = '';
  el.resultList.innerHTML = '';

  try {
    const qs = new URLSearchParams({ typeId: state.selectedType.id, q: nameText });
    const res = await fetch(`/api/search?${qs.toString()}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '검색 실패');
    state.results = data.items || [];
    renderResults(data.mocked, data.usedSharedKey, data.searchedDays);
  } catch (e) {
    el.resultNote.textContent = `검색 중 오류: ${e.message}`;
  } finally {
    el.searchLoadingBox.classList.add('hidden');
  }
}

function renderResults(mocked, usedSharedKey, searchedDays) {
  if (mocked) {
    el.resultNote.textContent = '인증키가 없어 예시(목업) 데이터로 보여드립니다. 관리자에게 공용 키 설정을 요청하거나, 개인 키를 입력하세요.';
  } else {
    const keySource = usedSharedKey ? '(관리자 공용 키 사용)' : '(개인 키 사용)';
    const rangeNote = searchedDays ? ` 결과가 적어 최근 ${searchedDays}일 범위까지 넓혀서 조회했습니다.` : '';
    el.resultNote.textContent = `사업명·유형 키워드 일치도 기준 상위 결과입니다 ${keySource}.${rangeNote} 첨부파일 본문까지 분석한 정밀 유사도는 아니므로 참고용으로만 활용하세요. 마음에 드는 사업이 없으면 그냥 아래 항목을 계속 입력하시면 됩니다.`;
  }

  el.resultList.innerHTML = '';
  if (state.results.length === 0) {
    el.resultList.innerHTML = '<p class="note">일치하는 공고를 찾지 못했습니다. 참고 없이 계속 입력하시면 됩니다.</p>';
    return;
  }
  state.results.forEach((r, idx) => {
    const card = document.createElement('div');
    card.className = 'result-card';
    card.innerHTML = `
      <label class="result-check">
        <input type="checkbox" data-idx="${idx}" />
        <div>
          <div class="r-name">${escapeHtml(r.bidNtceNm || '(제목 없음)')}</div>
          <div class="r-meta">${escapeHtml(r.ntceInsttNm || r.dminsttNm || '')} · 게시일 ${escapeHtml(r.bidNtceDt || '-')} · 공고번호 ${escapeHtml(r.bidNtceNo || '-')}</div>
        </div>
      </label>`;
    const checkbox = card.querySelector('input[type="checkbox"]');
    const applySelection = (checked) => {
      document.querySelectorAll('#result-list .result-card').forEach((c) => {
        c.classList.remove('selected');
        c.querySelector('input[type="checkbox"]').checked = false;
      });
      if (checked) {
        card.classList.add('selected');
        checkbox.checked = true;
        state.selectedReference = r;
        // 업로드탭에 등록해둔 파일이 있다면 해제 표시 (참고자료는 한 번에 하나만 사용)
        el.uploadResult.innerHTML = '';
        el.uploadStatus.textContent = '';
        el.refFileInput.value = '';
      } else {
        state.selectedReference = null;
      }
    };
    checkbox.addEventListener('change', () => applySelection(checkbox.checked));
    card.addEventListener('click', (e) => {
      if (e.target === checkbox) return; // 체크박스 자체 클릭은 change 이벤트에서 이미 처리
      applySelection(!checkbox.checked);
    });
    el.resultList.appendChild(card);
  });
}

el.btnGenerate.addEventListener('click', async () => {
  if (!state.selectedType) {
    showStatus('먼저 왼쪽에서 사업 유형을 선택하세요.', 'err');
    return;
  }

  const nameInput = document.querySelector('#name-field-slot [data-id="name"]');
  if (nameInput && !nameInput.value.trim()) {
    hideStatus();
    nameInput.setAttribute('aria-invalid', 'true');
    const errorEl = document.getElementById('name-field-error');
    if (errorEl) errorEl.classList.remove('hidden');
    nameInput.focus();
    return;
  }

  hideStatus();
  const answers = {};
  document.querySelectorAll('#name-field-slot [data-id], #rest-fields [data-id]').forEach((input) => {
    answers[input.dataset.id] = input.value;
  });
  answers.contactDept = document.getElementById('contact-dept').value;
  answers.contactName = document.getElementById('contact-name').value;
  answers.contactPhone = document.getElementById('contact-phone').value;
  answers.contactEmail = document.getElementById('contact-email').value;

  el.btnGenerate.disabled = true;
  el.btnGenerate.textContent = '생성 중...';
  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        typeId: state.selectedType.id,
        answers,
        reference: state.selectedReference,
      }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || '생성 실패');
    }
    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename\*=UTF-8''(.+)$/);
    const filename = match ? decodeURIComponent(match[1]) : 'RFP_초안.docx';

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    showStatus('초안 파일을 생성해서 다운로드했습니다.', 'ok');
  } catch (e) {
    showStatus(`초안 생성 중 문제가 발생했습니다 — ${e.message}`, 'err');
  } finally {
    el.btnGenerate.disabled = false;
    el.btnGenerate.textContent = '제안요청서 초안 생성';
  }
});

document.getElementById('btn-home-logo').addEventListener('click', goHome);
document.getElementById('btn-home-crumb').addEventListener('click', goHome);

loadTypes();
