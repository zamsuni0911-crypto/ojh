require('dotenv').config();
const express = require('express');
const path = require('path');
const multer = require('multer');
const { TYPES, getType } = require('./rfpTypes');
const { searchSimilarRfps } = require('./g2bClient');
const { generateDocx } = require('./docGenerator');
const { extractText, excerpt } = require('./fileExtract');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));


const ALLOWED_EXT = ['.hwpx', '.hwp', '.pdf', '.docx'];
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) {
      return cb(new Error('지원하지 않는 파일 형식입니다. (.hwpx, .hwp, .pdf, .docx만 가능)'));
    }
    cb(null, true);
  },
});

const SHARED_KEY = (process.env.G2B_SERVICE_KEY || '').trim();

app.get('/api/types', (req, res) => {
  res.json(TYPES.map((t) => ({ id: t.id, label: t.label, hint: t.hint, desc: t.desc, questions: t.questions })));
});

// 프론트엔드가 "관리자가 설정한 공용 키가 있는지"만 확인하는 용도 (키 값 자체는 내려주지 않음)
app.get('/api/config', (req, res) => {
  res.json({ hasSharedKey: !!SHARED_KEY });
});

app.get('/api/search', async (req, res) => {
  const { typeId, serviceKey, q } = req.query;
  const type = getType(typeId);
  if (!type) return res.status(400).json({ error: '알 수 없는 사업 유형입니다.' });

  // 개인 키(브라우저 입력)가 있으면 그것을 우선 사용하고, 없으면 서버 공용 키를 사용
  const effectiveKey = (serviceKey || '').trim() || SHARED_KEY;

  // 사용자가 입력 중인 사업명에서 2글자 이상 토큰을 뽑아 유형 키워드에 더해 랭킹에 반영
  const nameTokens = (q || '')
    .split(/\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2);
  const keywords = [...type.searchKeywords, ...nameTokens];

  try {
    const result = await searchSimilarRfps({
      type: typeId,
      keywords,
      serviceKey: effectiveKey,
    });
    result.usedSharedKey = !serviceKey && !!SHARED_KEY;
    res.json(result);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

app.post('/api/upload-reference', (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: '파일이 없습니다.' });

    try {
      const { supported, text, error } = await extractText(req.file.originalname, req.file.buffer);
      res.json({
        fileName: req.file.originalname,
        sizeBytes: req.file.size,
        supported,
        textExcerpt: supported ? excerpt(text) : '',
        note: supported
          ? null
          : '이 파일 형식은 본문 자동 인식을 지원하지 않습니다. 파일명만 참고 정보로 기록됩니다. (지원: .hwpx, .pdf, .docx)',
        warning: error || null,
      });
    } catch (e) {
      res.status(500).json({ error: `파일 분석 중 오류: ${e.message}` });
    }
  });
});

app.post('/api/generate', async (req, res) => {
  const { typeId, answers, reference } = req.body;
  const type = getType(typeId);
  if (!type) return res.status(400).json({ error: '알 수 없는 사업 유형입니다.' });

  try {
    const buffer = await generateDocx({ typeId, answers: answers || {}, reference });
    const filename = encodeURIComponent(`${(answers && answers.name) || type.label}_제안요청서_초안.docx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${filename}`);
    res.send(buffer);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 5175;
app.listen(PORT, () => {
  console.log(`RFP 초안 도우미 서버 실행 중: http://localhost:${PORT}`);
});
