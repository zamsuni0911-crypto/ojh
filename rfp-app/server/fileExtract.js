// 업로드된 참고 파일에서 텍스트를 뽑아내는 유틸.
// 지원: .hwpx(zip+xml), .pdf, .docx / 미지원(.hwp 구버전 등): 파일명만 기록

const AdmZip = require('adm-zip');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

const MAX_EXCERPT = 4000; // 초안에 참고용으로 보여줄 앞부분 길이 제한

function extractHwpx(buffer) {
  const zip = new AdmZip(buffer);
  const entry = zip.getEntries().find((e) => e.entryName === 'Contents/section0.xml');
  if (!entry) return '';
  const xml = entry.getData().toString('utf8');

  const paragraphs = xml.split('<hp:p ');
  const lines = [];
  for (const para of paragraphs) {
    const matches = para.match(/<hp:t[^>]*>([\s\S]*?)<\/hp:t>/g);
    if (!matches) continue;
    const text = matches
      .map((m) => m.replace(/<[^>]+>/g, ''))
      .join('')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
    if (text.trim()) lines.push(text);
  }
  return lines.join('\n');
}

async function extractPdf(buffer) {
  const data = await pdfParse(buffer);
  return data.text || '';
}

async function extractDocx(buffer) {
  const result = await mammoth.extractRawText({ buffer });
  return result.value || '';
}

async function extractText(originalName, buffer) {
  const lower = originalName.toLowerCase();
  try {
    if (lower.endsWith('.hwpx')) {
      return { supported: true, text: extractHwpx(buffer) };
    }
    if (lower.endsWith('.pdf')) {
      return { supported: true, text: await extractPdf(buffer) };
    }
    if (lower.endsWith('.docx')) {
      return { supported: true, text: await extractDocx(buffer) };
    }
    // .hwp(구버전 바이너리) 등은 본문 추출 미지원 — 파일명만 참고로 기록
    return { supported: false, text: '' };
  } catch (e) {
    return { supported: false, text: '', error: e.message };
  }
}

function excerpt(text) {
  const clean = (text || '').replace(/\n{3,}/g, '\n\n').trim();
  return clean.length > MAX_EXCERPT ? clean.slice(0, MAX_EXCERPT) + '\n...(이하 생략)' : clean;
}

module.exports = { extractText, excerpt };
