const pptxgen = require('pptxgenjs');

const CANVAS_W = 1000;
const CANVAS_H = 562;
const SLIDE_W = 13.333;
const SLIDE_H = 7.5;

const SHAPE_MAP = {
  rect: 'rect',
  roundRect: 'roundRect',
  diamond: 'diamond',
  ellipse: 'ellipse',
  parallelogram: 'parallelogram',
};

function toInchesX(v) {
  return (v / CANVAS_W) * SLIDE_W;
}
function toInchesY(v) {
  return (v / CANVAS_H) * SLIDE_H;
}

function nodeCenter(node) {
  return {
    x: node.x + node.w / 2,
    y: node.y + node.h / 2,
  };
}

// Point where the segment from the node center toward (tx,ty) crosses the node's rectangle boundary.
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

function buildPptx(diagram) {
  const pptx = new pptxgen();
  pptx.defineLayout({ name: 'CUSTOM_16X9', width: SLIDE_W, height: SLIDE_H });
  pptx.layout = 'CUSTOM_16X9';

  const slide = pptx.addSlide();
  const nodeById = {};
  (diagram.nodes || []).forEach((n) => {
    nodeById[n.id] = n;
  });

  // Edges first so shape borders sit on top of the connector lines.
  (diagram.edges || []).forEach((edge) => {
    const from = nodeById[edge.from];
    const to = nodeById[edge.to];
    if (!from || !to) return;

    const c1 = nodeCenter(from);
    const c2 = nodeCenter(to);
    const p1 = boundaryPoint(from, c2.x, c2.y);
    const p2 = boundaryPoint(to, c1.x, c1.y);

    const x1 = toInchesX(p1.x);
    const y1 = toInchesY(p1.y);
    const x2 = toInchesX(p2.x);
    const y2 = toInchesY(p2.y);

    const x = Math.min(x1, x2);
    const y = Math.min(y1, y2);
    const w = Math.max(Math.abs(x2 - x1), 0.01);
    const h = Math.max(Math.abs(y2 - y1), 0.01);

    slide.addShape('line', {
      x,
      y,
      w,
      h,
      flipH: x1 > x2,
      flipV: y1 > y2,
      line: {
        color: '595959',
        width: 1.5,
        dashType: edge.dashed ? 'dash' : 'solid',
        endArrowType: 'triangle',
      },
    });

    if (edge.label) {
      slide.addText(edge.label, {
        x: Math.min(x1, x2),
        y: Math.min(y1, y2) - 0.15,
        w: Math.max(Math.abs(x2 - x1), 0.8),
        h: 0.3,
        align: 'center',
        fontSize: 9,
        color: '595959',
        fill: { color: 'FFFFFF' },
      });
    }
  });

  (diagram.nodes || []).forEach((node) => {
    const shapeType = SHAPE_MAP[node.shape] || 'rect';
    slide.addShape(shapeType, {
      x: toInchesX(node.x),
      y: toInchesY(node.y),
      w: toInchesX(node.w),
      h: toInchesY(node.h),
      fill: { color: 'E9EFFB' },
      line: { color: '2F5597', width: 1.25 },
    });
    slide.addText(node.text || '', {
      x: toInchesX(node.x),
      y: toInchesY(node.y),
      w: toInchesX(node.w),
      h: toInchesY(node.h),
      align: 'center',
      valign: 'middle',
      fontSize: 12,
      color: '1F2933',
      wrap: true,
      fontFace: '맑은 고딕',
    });
  });

  return pptx.write('nodebuffer');
}

module.exports = { buildPptx };
