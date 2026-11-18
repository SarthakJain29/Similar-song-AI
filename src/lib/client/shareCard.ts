/** Renders a shareable playlist card (PNG) on a canvas. No dependencies, works offline. */
import { displayTitle } from "../music/normalize";
import type { PlaylistTrack } from "../types";

export const CARD_W = 1080;
export const CARD_H = 1350;

function proxied(url?: string): string | undefined {
  if (!url) return undefined;
  return /^https?:\/\//i.test(url) ? `/api/img?u=${encodeURIComponent(url)}` : url;
}

function loadImage(url?: string): Promise<HTMLImageElement | null> {
  const src = proxied(url);
  if (!src) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fit(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + "…").width > maxW) t = t.slice(0, -1);
  return t.trimEnd() + "…";
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = fit(ctx, kept[maxLines - 1] + "…", maxW);
    return kept;
  }
  return lines;
}

/** "Blur" by downscaling then upscaling with smoothing: cheap, and works in browsers without ctx.filter. */
function drawBlurredCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement | null) {
  if (!img) {
    const g = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
    g.addColorStop(0, "#ff5e7e");
    g.addColorStop(1, "#3b1d6e");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CARD_W, CARD_H);
    return;
  }
  const tiny = document.createElement("canvas");
  tiny.width = tiny.height = 28;
  const tctx = tiny.getContext("2d")!;
  tctx.drawImage(img, 0, 0, 28, 28);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  const scale = CARD_H / 28;
  if ("filter" in ctx) ctx.filter = "saturate(1.7) brightness(1.05)";
  ctx.drawImage(tiny, (CARD_W - 28 * scale) / 2, 0, 28 * scale, CARD_H);
  if ("filter" in ctx) ctx.filter = "none";
}

export async function renderShareCard(name: string, subtitle: string, tracks: PlaylistTrack[]): Promise<Blob> {
  if (document.fonts?.ready) await document.fonts.ready;
  const covers = await Promise.all(tracks.slice(0, 5).map((t) => loadImage(t.artwork)));
  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d")!;
  const font = (w: number, px: number) => `${w} ${px}px "Inter Variable", Inter, system-ui, -apple-system, "Segoe UI", sans-serif`;

  drawBlurredCover(ctx, covers.find(Boolean) ?? null);
  const shade = ctx.createLinearGradient(0, 0, 0, CARD_H);
  shade.addColorStop(0, "rgba(8,8,14,.18)");
  shade.addColorStop(0.5, "rgba(8,8,14,.42)");
  shade.addColorStop(1, "rgba(8,8,14,.86)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  const PAD = 72;
  // brand
  const lg = ctx.createLinearGradient(PAD, 70, PAD + 52, 122);
  lg.addColorStop(0, "#ff5e7e");
  lg.addColorStop(1, "#ff9f5a");
  ctx.fillStyle = lg;
  roundRect(ctx, PAD, 70, 52, 52, 15);
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(PAD + 20, 96, 11, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.arc(PAD + 32, 96, 11, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = "rgba(255,255,255,.9)";
  ctx.font = font(650, 30);
  ctx.textBaseline = "middle";
  ctx.fillText("Similar Song AI", PAD + 70, 97);

  // title
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#fff";
  // shrink the title until it fits on two lines (long journey names)
  let titlePx = 92;
  let lines: string[] = [];
  for (; titlePx >= 56; titlePx -= 8) {
    ctx.font = font(800, titlePx);
    lines = wrap(ctx, name, CARD_W - PAD * 2, 3);
    if (lines.length <= 2 && lines.every((l) => ctx.measureText(l).width <= CARD_W - PAD * 2)) break;
  }
  ctx.font = font(800, titlePx);
  lines = wrap(ctx, name, CARD_W - PAD * 2, 2);
  let y = 250;
  for (const l of lines) {
    ctx.fillText(fit(ctx, l, CARD_W - PAD * 2), PAD, y);
    y += Math.round(titlePx * 1.09);
  }
  ctx.font = font(500, 34);
  ctx.fillStyle = "rgba(255,255,255,.66)";
  ctx.fillText(subtitle, PAD, y - 18);

  // cover collage
  const gap = 20;
  const n = Math.min(5, tracks.length);
  const tile = Math.min(300, Math.floor((CARD_W - PAD * 2 - gap * (Math.max(n, 3) - 1)) / Math.max(n, 3)));
  const cy = y + 36;
  for (let i = 0; i < n; i++) {
    const x = PAD + i * (tile + gap);
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,.45)";
    ctx.shadowBlur = 36;
    ctx.shadowOffsetY = 14;
    roundRect(ctx, x, cy, tile, tile, 22);
    ctx.fillStyle = "#222";
    ctx.fill();
    ctx.restore();
    ctx.save();
    roundRect(ctx, x, cy, tile, tile, 22);
    ctx.clip();
    const img = covers[i];
    if (img) ctx.drawImage(img, x, cy, tile, tile);
    else {
      const g = ctx.createLinearGradient(x, cy, x + tile, cy + tile);
      g.addColorStop(0, `hsl(${(i * 67) % 360} 60% 45%)`);
      g.addColorStop(1, `hsl(${(i * 67 + 50) % 360} 65% 22%)`);
      ctx.fillStyle = g;
      ctx.fillRect(x, cy, tile, tile);
    }
    ctx.restore();
    ctx.strokeStyle = "rgba(255,255,255,.18)";
    ctx.lineWidth = 2;
    roundRect(ctx, x, cy, tile, tile, 22);
    ctx.stroke();
  }

  // track list
  const listTop = cy + tile + 78;
  const rowH = 74;
  const maxRows = Math.max(3, Math.floor((CARD_H - 125 - listTop) / rowH));
  const shown = tracks.slice(0, maxRows);
  shown.forEach((t, i) => {
    const ry = listTop + i * rowH;
    ctx.fillStyle = "rgba(255,255,255,.4)";
    ctx.font = font(600, 28);
    ctx.fillText(String(i + 1).padStart(2, "0"), PAD, ry + 8);
    ctx.fillStyle = "#fff";
    ctx.font = font(650, 36);
    ctx.fillText(fit(ctx, displayTitle(t.title), CARD_W - PAD * 2 - 80), PAD + 76, ry - 6);
    ctx.fillStyle = "rgba(255,255,255,.58)";
    ctx.font = font(450, 28);
    ctx.fillText(fit(ctx, t.artist, CARD_W - PAD * 2 - 80), PAD + 76, ry + 28);
  });
  const more = tracks.length - shown.length;
  ctx.fillStyle = "rgba(255,255,255,.55)";
  ctx.font = font(500, 28);
  ctx.fillText(more > 0 ? `+ ${more} more` : "", PAD, CARD_H - 92);
  ctx.textAlign = "right";
  ctx.fillText("Find your next song · similar-song-ai", CARD_W - PAD, CARD_H - 92);
  ctx.textAlign = "left";

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't render the card"))), "image/png"));
}
