import { useEffect, useRef } from "react";
const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
function ellipse(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  color: string,
) {
  c.fillStyle = color;
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  c.fill();
}
export function FlatFilm({
  time = 0,
  playing = false,
  reduced = false,
}: {
  time?: number;
  playing?: boolean;
  reduced?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const c = canvas.getContext("2d")!;
    const w = 1200,
      h = 675;
    canvas.width = w;
    canvas.height = h;
    c.clearRect(0, 0, w, h);
    c.fillStyle = "#202642";
    c.fillRect(0, 0, w, h);
    // A deliberately authored, flat-colour animated film. Every frame derives only from time.
    ellipse(c, 953, 136, 79, 79, "#f1b972");
    ellipse(c, 920, 112, 76, 77, "#202642");
    for (let i = 0; i < 44; i++) {
      const x = (i * 163 + 58) % 1200,
        y = (i * 79 + 32) % 280;
      c.fillStyle = i % 3 ? "#53607a" : "#98a0b2";
      c.fillRect(x, y, i % 3 ? 2 : 3, i % 3 ? 2 : 3);
    }
    c.fillStyle = "#2b3551";
    c.beginPath();
    c.moveTo(0, 440);
    c.bezierCurveTo(260, 200, 340, 280, 575, 417);
    c.bezierCurveTo(820, 172, 1010, 280, 1200, 355);
    c.lineTo(1200, 675);
    c.lineTo(0, 675);
    c.fill();
    c.fillStyle = "#384653";
    c.beginPath();
    c.moveTo(0, 509);
    c.bezierCurveTo(240, 363, 415, 494, 657, 459);
    c.bezierCurveTo(863, 411, 1039, 416, 1200, 490);
    c.lineTo(1200, 675);
    c.lineTo(0, 675);
    c.fill();
    const tree = (x: number, y: number, s: number) => {
      c.fillStyle = "#253743";
      c.fillRect(x - 4 * s, y - 75 * s, 8 * s, 98 * s);
      for (let k = 0; k < 3; k++) {
        c.beginPath();
        c.moveTo(x, y - (195 - k * 40) * s);
        c.lineTo(x - (39 + k * 9) * s, y - (95 - k * 32) * s);
        c.lineTo(x + (39 + k * 9) * s, y - (95 - k * 32) * s);
        c.closePath();
        c.fill();
      }
    };
    tree(1080, 500, 1.3);
    tree(1034, 517, 0.8);
    tree(95, 458, 0.9);
    tree(30, 485, 1.2);
    tree(628, 458, 0.55);
    // Warm cabin; smoke and window belong to the same twenty-second clock.
    c.fillStyle = "#d5a568";
    c.fillRect(741, 367, 190, 145);
    c.fillStyle = "#946154";
    c.fillRect(875, 291, 28, 61);
    c.fillStyle = "#b86e59";
    c.beginPath();
    c.moveTo(706, 382);
    c.lineTo(836, 280);
    c.lineTo(967, 382);
    c.closePath();
    c.fill();
    c.strokeStyle = "#e59c70";
    c.lineWidth = 7;
    c.beginPath();
    c.moveTo(707, 382);
    c.lineTo(836, 280);
    c.lineTo(967, 382);
    c.stroke();
    c.fillStyle = "#714f48";
    c.fillRect(820, 425, 39, 87);
    c.fillStyle = "#ffdd93";
    c.fillRect(759, 404, 40, 48);
    c.fillRect(879, 404, 34, 48);
    c.strokeStyle = "#9c714e";
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(779, 403);
    c.lineTo(779, 452);
    c.moveTo(759, 428);
    c.lineTo(799, 428);
    c.moveTo(896, 403);
    c.lineTo(896, 453);
    c.stroke();
    ellipse(c, 849, 469, 3, 3, "#f1c985");
    c.fillStyle = "#465256";
    c.beginPath();
    c.moveTo(0, 561);
    c.bezierCurveTo(300, 491, 660, 557, 1200, 509);
    c.lineTo(1200, 675);
    c.lineTo(0, 675);
    c.fill();
    // The visitor walks in, speaks, and lifts an umbrella over the cabin.
    const walk = clamp((time - 1) / 10),
      x = 196 + walk * 398,
      bob = !reduced && time > 1 && time < 11 ? Math.sin(time * 4.5) * 7 : 0,
      y = 425 + bob;
    ellipse(c, x, 534, 108, 18, "#293d43");
    const leg = Math.sin(time * 4.5) * (time > 1 && time < 11 ? 13 : 0);
    ellipse(c, x - 43, y + 81 + leg, 23, 39, "#6abbb0");
    ellipse(c, x + 42, y + 81 - leg, 23, 39, "#6abbb0");
    c.fillStyle = "#84cbb7";
    c.beginPath();
    c.moveTo(x - 89, y + 55);
    c.bezierCurveTo(x - 98, y - 5, x - 83, y - 71, x - 49, y - 89);
    c.lineTo(x - 45, y - 131);
    c.quadraticCurveTo(x - 20, y - 133, x - 8, y - 100);
    c.quadraticCurveTo(x + 15, y - 106, x + 33, y - 101);
    c.lineTo(x + 56, y - 134);
    c.quadraticCurveTo(x + 83, y - 128, x + 66, y - 82);
    c.bezierCurveTo(x + 98, y - 58, x + 105, y + 31, x + 79, y + 66);
    c.quadraticCurveTo(x, y + 99, x - 89, y + 55);
    c.fill();
    ellipse(c, x - 10, y - 31, 17, 21, "#eff0da");
    ellipse(c, x + 40, y - 32, 17, 21, "#eff0da");
    ellipse(c, x - 5, y - 30, 6, 9, "#23323c");
    ellipse(c, x + 45, y - 31, 6, 9, "#23323c");
    const talking = time > 12.7 && time < 15;
    ellipse(
      c,
      x + 20,
      y + 7,
      talking ? 17 : 11,
      talking ? 14 + Math.sin(time * 22) * 5 : 5,
      "#2c5654",
    );
    c.strokeStyle = "#6abbb0";
    c.lineWidth = 23;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(x - 73, y + 5);
    c.lineTo(x - 105, y + 37);
    c.stroke();
    c.beginPath();
    c.moveTo(x + 81, y + 3);
    c.lineTo(x + 123, y - (time > 16 ? 42 : 0));
    c.stroke();
    if (time > 16) {
      const scale = clamp((time - 16) * 2);
      c.save();
      c.translate(x + 123, y - 51);
      c.scale(scale, scale);
      c.strokeStyle = "#d6b17d";
      c.lineWidth = 7;
      c.beginPath();
      c.moveTo(0, 10);
      c.lineTo(0, -201);
      c.stroke();
      c.fillStyle = "#ef976c";
      c.beginPath();
      c.moveTo(-178, -129);
      c.bezierCurveTo(-146, -255, 145, -255, 180, -129);
      c.quadraticCurveTo(145, -157, 106, -129);
      c.quadraticCurveTo(54, -158, 0, -129);
      c.quadraticCurveTo(-54, -157, -107, -129);
      c.quadraticCurveTo(-145, -157, -178, -129);
      c.fill();
      c.restore();
    }
    // Rain never requires external assets or random state.
    if (time < 17) {
      c.strokeStyle = "#a9c2d344";
      c.lineWidth = 2;
      for (let i = 0; i < 58; i++) {
        const rainTime = reduced ? 9 : time;
        const rx = (i * 173 + rainTime * 66) % 1250,
          ry = (i * 71 + rainTime * 295) % 680;
        c.beginPath();
        c.moveTo(rx, ry);
        c.lineTo(rx - 8, ry + 23);
        c.stroke();
      }
    }
    if (
      !reduced &&
      ((time > 5.35 && time < 5.48) || (time > 10.5 && time < 10.62))
    ) {
      c.fillStyle = "#fff9de55";
      c.fillRect(0, 0, w, h);
    }
    c.fillStyle = "#e8d9b5";
    for (let i = 0; i < 12; i++) {
      const px = 70 + i * 101,
        py = 592 + (i % 3) * 22;
      c.save();
      c.translate(px, py);
      c.rotate(-0.3);
      c.fillRect(0, 0, 2, 9);
      c.restore();
    }
  }, [time, playing, reduced]);
  return (
    <canvas
      ref={ref}
      className="film-canvas"
      role="img"
      aria-label="Original animated film: a mint-green monster approaches a warm cabin during a storm, then offers an umbrella."
    />
  );
}
