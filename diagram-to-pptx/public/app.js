const apiKeyInput = document.getElementById('apiKey');
const imageInput = document.getElementById('imageInput');
const imagePreview = document.getElementById('imagePreview');
const imagePreviewWrap = document.getElementById('imagePreviewWrap');
const analyzeBtn = document.getElementById('analyzeBtn');
const statusEl = document.getElementById('status');
const resultCard = document.getElementById('resultCard');
const previewSvg = document.getElementById('previewSvg');
const downloadBtn = document.getElementById('downloadBtn');
const feedbackText = document.getElementById('feedbackText');
const regenBtn = document.getElementById('regenBtn');

let selectedFile = null;
let currentDiagram = null;

apiKeyInput.value = localStorage.getItem('diagramToPptxApiKey') || '';
apiKeyInput.addEventListener('input', () => {
  localStorage.setItem('diagramToPptxApiKey', apiKeyInput.value.trim());
});

imageInput.addEventListener('change', () => {
  const file = imageInput.files[0];
  if (!file) return;
  selectedFile = file;
  imagePreview.src = URL.createObjectURL(file);
  imagePreviewWrap.classList.remove('hidden');
  analyzeBtn.disabled = false;
  resultCard.classList.add('hidden');
  currentDiagram = null;
});

function setStatus(msg, isError) {
  statusEl.textContent = msg;
  statusEl.classList.toggle('error', !!isError);
}

async function runAnalyze({ feedback } = {}) {
  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) {
    setStatus('Anthropic API 키를 입력해주세요.', true);
    return;
  }
  if (!selectedFile) {
    setStatus('이미지를 먼저 선택해주세요.', true);
    return;
  }

  const busyBtn = feedback ? regenBtn : analyzeBtn;
  busyBtn.disabled = true;
  setStatus(feedback ? '피드백을 반영해서 다시 분석하는 중...' : '이미지를 분석하는 중...');

  try {
    const form = new FormData();
    form.append('image', selectedFile);
    if (feedback && currentDiagram) {
      form.append('previousJson', JSON.stringify(currentDiagram));
      form.append('feedback', feedback);
    }

    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'x-api-key': apiKey },
      body: form,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '분석 실패');

    currentDiagram = data;
    renderPreview(data);
    resultCard.classList.remove('hidden');
    setStatus(`분석 완료 — 노드 ${data.nodes.length}개, 연결선 ${data.edges.length}개`);
  } catch (err) {
    setStatus('오류: ' + err.message, true);
  } finally {
    busyBtn.disabled = false;
  }
}

analyzeBtn.addEventListener('click', () => runAnalyze());
regenBtn.addEventListener('click', () => {
  const fb = feedbackText.value.trim();
  if (!fb) {
    setStatus('수정할 내용을 입력해주세요.', true);
    return;
  }
  runAnalyze({ feedback: fb });
});

downloadBtn.addEventListener('click', async () => {
  if (!currentDiagram) return;
  downloadBtn.disabled = true;
  setStatus('PPTX 생성 중...');
  try {
    const res = await fetch('/api/export', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ diagram: currentDiagram }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'PPTX 생성 실패');
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'diagram.pptx';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setStatus('PPTX 다운로드 완료');
  } catch (err) {
    setStatus('오류: ' + err.message, true);
  } finally {
    downloadBtn.disabled = false;
  }
});

const SVG_NS = 'http://www.w3.org/2000/svg';

function nodeCenter(n) {
  return { x: n.x + n.w / 2, y: n.y + n.h / 2 };
}

function boundaryPoint(node, tx, ty) {
  const cx = node.x + node.w / 2;
  const cy = node.y + node.h / 2;
  const dx = tx - cx;
  const dy = ty - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const halfW = node.w / 2 || 1;
  const halfH = node.h / 2 || 1;
  const scaleX = dx !== 0 ? halfW / Math.abs(dx) : Infinity;
  const scaleY = dy !== 0 ? halfH / Math.abs(dy) : Infinity;
  const scale = Math.min(scaleX, scaleY);
  return { x: cx + dx * scale, y: cy + dy * scale };
}

function wrapText(text, maxChars) {
  const words = (text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  words.forEach((w) => {
    if ((line + ' ' + w).trim().length > maxChars && line) {
      lines.push(line.trim());
      line = w;
    } else {
      line = (line + ' ' + w).trim();
    }
  });
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

function makeShapeEl(node) {
  const { shape, x, y, w, h } = node;
  if (shape === 'diamond') {
    const points = [
      [x + w / 2, y],
      [x + w, y + h / 2],
      [x + w / 2, y + h],
      [x, y + h / 2],
    ].map((p) => p.join(',')).join(' ');
    const el = document.createElementNS(SVG_NS, 'polygon');
    el.setAttribute('points', points);
    return el;
  }
  if (shape === 'ellipse') {
    const el = document.createElementNS(SVG_NS, 'ellipse');
    el.setAttribute('cx', x + w / 2);
    el.setAttribute('cy', y + h / 2);
    el.setAttribute('rx', w / 2);
    el.setAttribute('ry', h / 2);
    return el;
  }
  if (shape === 'parallelogram') {
    const skew = Math.min(w * 0.2, 30);
    const points = [
      [x + skew, y],
      [x + w, y],
      [x + w - skew, y + h],
      [x, y + h],
    ].map((p) => p.join(',')).join(' ');
    const el = document.createElementNS(SVG_NS, 'polygon');
    el.setAttribute('points', points);
    return el;
  }
  const el = document.createElementNS(SVG_NS, 'rect');
  el.setAttribute('x', x);
  el.setAttribute('y', y);
  el.setAttribute('width', w);
  el.setAttribute('height', h);
  if (shape === 'roundRect') el.setAttribute('rx', Math.min(w, h) * 0.12);
  return el;
}

function renderPreview(diagram) {
  while (previewSvg.firstChild) previewSvg.removeChild(previewSvg.firstChild);

  const defs = document.createElementNS(SVG_NS, 'defs');
  defs.innerHTML = `
    <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="#595959" />
    </marker>`;
  previewSvg.appendChild(defs);

  const nodeById = {};
  diagram.nodes.forEach((n) => { nodeById[n.id] = n; });

  const edgeLayer = document.createElementNS(SVG_NS, 'g');
  (diagram.edges || []).forEach((edge) => {
    const from = nodeById[edge.from];
    const to = nodeById[edge.to];
    if (!from || !to) return;
    const c1 = nodeCenter(from);
    const c2 = nodeCenter(to);
    const p1 = boundaryPoint(from, c2.x, c2.y);
    const p2 = boundaryPoint(to, c1.x, c1.y);

    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', p1.x);
    line.setAttribute('y1', p1.y);
    line.setAttribute('x2', p2.x);
    line.setAttribute('y2', p2.y);
    line.setAttribute('stroke', '#595959');
    line.setAttribute('stroke-width', '2');
    if (edge.dashed) line.setAttribute('stroke-dasharray', '6,4');
    line.setAttribute('marker-end', 'url(#arrow)');
    edgeLayer.appendChild(line);

    if (edge.label) {
      const label = document.createElementNS(SVG_NS, 'text');
      label.setAttribute('x', (p1.x + p2.x) / 2);
      label.setAttribute('y', (p1.y + p2.y) / 2 - 6);
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('font-size', '13');
      label.setAttribute('fill', '#595959');
      label.textContent = edge.label;
      edgeLayer.appendChild(label);
    }
  });
  previewSvg.appendChild(edgeLayer);

  const nodeLayer = document.createElementNS(SVG_NS, 'g');
  diagram.nodes.forEach((node) => {
    const shapeEl = makeShapeEl(node);
    shapeEl.setAttribute('fill', '#E9EFFB');
    shapeEl.setAttribute('stroke', '#2F5597');
    shapeEl.setAttribute('stroke-width', '1.5');
    nodeLayer.appendChild(shapeEl);

    const maxChars = Math.max(6, Math.floor(node.w / 11));
    const lines = wrapText(node.text, maxChars);
    const lineHeight = 15;
    const startY = node.y + node.h / 2 - ((lines.length - 1) * lineHeight) / 2;

    lines.forEach((ln, i) => {
      const t = document.createElementNS(SVG_NS, 'text');
      t.setAttribute('x', node.x + node.w / 2);
      t.setAttribute('y', startY + i * lineHeight);
      t.setAttribute('text-anchor', 'middle');
      t.setAttribute('dominant-baseline', 'middle');
      t.setAttribute('font-size', '13');
      t.setAttribute('fill', '#1F2933');
      t.textContent = ln;
      nodeLayer.appendChild(t);
    });
  });
  previewSvg.appendChild(nodeLayer);
}
