const MODEL = 'claude-sonnet-5';
const API_URL = 'https://api.anthropic.com/v1/messages';

const SYSTEM_PROMPT = `당신은 이미지 속 흐름도/구성도/개념도를 분석해서 PowerPoint로 재구성할 수 있는 구조화된 JSON을 만드는 전문가입니다.
반드시 아래 JSON 스키마에 맞는 JSON "하나만" 출력하세요. 설명, 마크다운 코드펜스(\`\`\`), 그 외 다른 텍스트는 절대 포함하지 마세요.

스키마:
{
  "nodes": [
    { "id": "문자열(고유)", "text": "박스 안 텍스트", "shape": "rect|roundRect|diamond|ellipse|parallelogram", "x": 0~1000, "y": 0~562, "w": 0~1000, "h": 0~562 }
  ],
  "edges": [
    { "from": "노드id", "to": "노드id", "label": "화살표 위 텍스트(없으면 빈 문자열)", "dashed": false }
  ]
}

규칙:
- 좌표계는 가로 1000 x 세로 562 기준(16:9 슬라이드), 원점은 좌상단.
- 이미지 속 실제 배치·상대적 크기·순서를 최대한 그대로 반영하세요.
- 도형끼리 겹치지 않게 배치하고, 텍스트가 박스 폭을 넘지 않도록 텍스트 길이에 맞춰 w를 적절히 잡으세요(대략 한 글자당 22 정도, 최소 w 80).
- 화살표 방향(from→to)은 원본 이미지의 흐름 방향을 그대로 따르세요.
- 도형 종류를 정확히 구분하기 애매하면 rect를 기본값으로 사용하세요.
- 이미지에 없는 노드나 연결을 지어내지 마세요.
- 반드시 유효한 JSON 하나만 출력하세요. 다른 말은 절대 하지 마세요.`;

function extractJson(text) {
  let cleaned = text.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) cleaned = fenceMatch[1].trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('AI 응답에서 JSON을 찾지 못했습니다.');
  const jsonStr = cleaned.slice(start, end + 1);
  return JSON.parse(jsonStr);
}

async function analyzeImage({ apiKey, imageBase64, mediaType, previousJson, feedback }) {
  if (!apiKey) throw new Error('Anthropic API 키가 없습니다.');

  const userContent = [
    {
      type: 'image',
      source: { type: 'base64', media_type: mediaType, data: imageBase64 },
    },
  ];

  if (previousJson && feedback) {
    userContent.push({
      type: 'text',
      text: `이 이미지를 이전에 아래 JSON으로 분석했습니다.\n\n이전 JSON:\n${JSON.stringify(previousJson)}\n\n사용자가 다음과 같이 수정을 요청했습니다:\n"${feedback}"\n\n이미지를 다시 참고하여, 사용자 피드백을 반영한 새로운 전체 JSON을 스키마에 맞춰 출력하세요.`,
    });
  } else {
    userContent.push({
      type: 'text',
      text: '이 이미지를 분석해서 스키마에 맞는 JSON으로 변환해주세요.',
    });
  }

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    let message = `Anthropic API 오류 (${res.status})`;
    try {
      const parsed = JSON.parse(errBody);
      if (parsed?.error?.message) message = parsed.error.message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }

  const data = await res.json();
  const text = (data.content || []).map((c) => c.text || '').join('\n');
  const diagram = extractJson(text);

  if (!Array.isArray(diagram.nodes)) diagram.nodes = [];
  if (!Array.isArray(diagram.edges)) diagram.edges = [];

  return diagram;
}

module.exports = { analyzeImage };
