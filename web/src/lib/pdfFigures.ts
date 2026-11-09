export type TextBox = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type FigureBox = {
  x: number;
  y: number;
  w: number;
  h: number;
};

const STEP = 2;
const MIN_SIDE = 36;

function mergeBoxes(boxes: FigureBox[], gap: number): FigureBox[] {
  const items = boxes.map((box) => ({ ...box }));
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < items.length; i += 1) {
      for (let j = i + 1; j < items.length; j += 1) {
        const a = items[i];
        const b = items[j];
        const close =
          a.x - gap < b.x + b.w &&
          a.x + a.w + gap > b.x &&
          a.y - gap < b.y + b.h &&
          a.y + a.h + gap > b.y;
        if (!close) continue;
        const x = Math.min(a.x, b.x);
        const y = Math.min(a.y, b.y);
        items[i] = {
          x,
          y,
          w: Math.max(a.x + a.w, b.x + b.w) - x,
          h: Math.max(a.y + a.h, b.y + b.h) - y,
        };
        items.splice(j, 1);
        changed = true;
        break;
      }
      if (changed) break;
    }
  }
  return items;
}

function textCoverage(box: FigureBox, textBoxes: TextBox[]): number {
  const area = box.w * box.h;
  if (area <= 0) return 1;
  let covered = 0;
  for (const text of textBoxes) {
    const left = Math.max(box.x, text.left);
    const top = Math.max(box.y, text.top);
    const right = Math.min(box.x + box.w, text.right);
    const bottom = Math.min(box.y + box.h, text.bottom);
    if (right > left && bottom > top) covered += (right - left) * (bottom - top);
  }
  return covered / area;
}

export function figureBoxesFromPixels(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  textBoxes: TextBox[],
): FigureBox[] {
  const cols = Math.ceil(width / STEP);
  const rows = Math.ceil(height / STEP);
  const textGrid = new Uint8Array(cols * rows);
  const pad = 6;
  for (const box of textBoxes) {
    const x0 = Math.max(0, Math.floor((box.left - pad) / STEP));
    const y0 = Math.max(0, Math.floor((box.top - pad) / STEP));
    const x1 = Math.min(cols - 1, Math.floor((box.right + pad) / STEP));
    const y1 = Math.min(rows - 1, Math.floor((box.bottom + pad) / STEP));
    for (let y = y0; y <= y1; y += 1) {
      const row = y * cols;
      for (let x = x0; x <= x1; x += 1) textGrid[row + x] = 1;
    }
  }

  const ink = new Uint8Array(cols * rows);
  for (let gy = 0; gy < rows; gy += 1) {
    for (let gx = 0; gx < cols; gx += 1) {
      const index = gy * cols + gx;
      if (textGrid[index]) continue;
      const sx = Math.min(width - 1, gx * STEP + 1);
      const sy = Math.min(height - 1, gy * STEP + 1);
      const offset = (sy * width + sx) * 4;
      const alpha = pixels[offset + 3];
      if (alpha < 16) continue;
      if (pixels[offset] > 248 && pixels[offset + 1] > 248 && pixels[offset + 2] > 248) continue;
      ink[index] = 1;
    }
  }

  const seen = new Uint8Array(cols * rows);
  const stack = new Int32Array(cols * rows);
  const found: FigureBox[] = [];

  for (let start = 0; start < ink.length; start += 1) {
    if (!ink[start] || seen[start]) continue;
    let pointer = 0;
    stack[pointer] = start;
    pointer += 1;
    seen[start] = 1;
    let minX = cols;
    let minY = rows;
    let maxX = 0;
    let maxY = 0;
    let count = 0;
    while (pointer > 0) {
      pointer -= 1;
      const current = stack[pointer];
      const gx = current % cols;
      const gy = Math.floor(current / cols);
      count += 1;
      if (gx < minX) minX = gx;
      if (gy < minY) minY = gy;
      if (gx > maxX) maxX = gx;
      if (gy > maxY) maxY = gy;
      if (gx > 0) {
        const next = current - 1;
        if (ink[next] && !seen[next]) {
          seen[next] = 1;
          stack[pointer] = next;
          pointer += 1;
        }
      }
      if (gx + 1 < cols) {
        const next = current + 1;
        if (ink[next] && !seen[next]) {
          seen[next] = 1;
          stack[pointer] = next;
          pointer += 1;
        }
      }
      if (gy > 0) {
        const next = current - cols;
        if (ink[next] && !seen[next]) {
          seen[next] = 1;
          stack[pointer] = next;
          pointer += 1;
        }
      }
      if (gy + 1 < rows) {
        const next = current + cols;
        if (ink[next] && !seen[next]) {
          seen[next] = 1;
          stack[pointer] = next;
          pointer += 1;
        }
      }
    }

    const box = {
      x: minX * STEP,
      y: minY * STEP,
      w: (maxX - minX + 1) * STEP,
      h: (maxY - minY + 1) * STEP,
    };
    if (box.w < MIN_SIDE || box.h < MIN_SIDE) continue;
    if (box.w > width * 0.92 && box.h > height * 0.85) continue;
    if (count < 30) continue;
    found.push(box);
  }

  return mergeBoxes(found, 18)
    .filter((box) => box.w >= MIN_SIDE && box.h >= MIN_SIDE)
    .filter((box) => !(box.w > width * 0.92 && box.h > height * 0.85))
    .filter((box) => textCoverage(box, textBoxes) < 0.35)
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .slice(0, 6);
}
