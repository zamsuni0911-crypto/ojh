const express = require('express');
const multer = require('multer');
const path = require('path');
const { exec } = require('child_process');
const { analyzeImage } = require('./claudeVision');
const { buildPptx } = require('./pptxBuilder');

// exe로 패키징된 경우 public 폴더는 exe와 같은 위치에 나란히 놓인다.
const baseDir = process.pkg ? path.dirname(process.execPath) : path.join(__dirname, '..');
const publicDir = path.join(baseDir, 'public');

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

app.use(express.json({ limit: '10mb' }));
app.use(express.static(publicDir));

app.post('/api/analyze', upload.single('image'), async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!req.file) return res.status(400).json({ error: '이미지 파일이 없습니다.' });

    const previousJson = req.body.previousJson ? JSON.parse(req.body.previousJson) : null;
    const feedback = req.body.feedback || null;

    const diagram = await analyzeImage({
      apiKey,
      imageBase64: req.file.buffer.toString('base64'),
      mediaType: req.file.mimetype,
      previousJson,
      feedback,
    });

    res.json(diagram);
  } catch (err) {
    res.status(500).json({ error: err.message || '분석 중 오류가 발생했습니다.' });
  }
});

app.post('/api/export', async (req, res) => {
  try {
    const diagram = req.body.diagram;
    if (!diagram) return res.status(400).json({ error: '변환할 데이터가 없습니다.' });

    const buffer = await buildPptx(diagram);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    res.setHeader('Content-Disposition', 'attachment; filename="diagram.pptx"');
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message || 'PPTX 생성 중 오류가 발생했습니다.' });
  }
});

const PORT = process.env.PORT || 4210;
const server = app.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log('========================================');
  console.log(' 이미지 → PPTX 변환기가 실행되었습니다');
  console.log(` 주소: ${url}`);
  console.log(' 브라우저가 자동으로 열리지 않으면 위 주소를 직접 입력하세요.');
  console.log(' 이 창을 닫으면 프로그램이 종료됩니다.');
  console.log('========================================');
  if (process.platform === 'win32') {
    exec(`start "" "${url}"`);
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`포트 ${PORT}가 이미 사용 중입니다. 다른 프로그램을 종료하거나 잠시 후 다시 실행해주세요.`);
  } else {
    console.error('서버 실행 중 오류가 발생했습니다:', err.message);
  }
  console.log('아무 키나 누르면 창이 닫힙니다...');
  process.stdin.resume();
  process.stdin.once('data', () => process.exit(1));
});
