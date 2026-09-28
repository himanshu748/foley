// Original Foley wordmark assets, drawn from the product's self-hosted OFL fonts.
// This generates launcher artwork, not a website mockup or a device screenshot.
import { chromium } from "playwright";
import { readFile, writeFile, mkdir } from "node:fs/promises";
const fonts = await Promise.all([
  readFile(
    "node_modules/@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-700-normal.woff2",
  ),
  readFile(
    "node_modules/@fontsource/dm-sans/files/dm-sans-latin-500-normal.woff2",
  ),
]);
const b = await chromium.launch({ headless: true });
try {
  const page = await b.newPage();
  await page.evaluate(
    async (fonts) => {
      for (const [i, family] of ["FoleyDisplay", "FoleyBody"].entries()) {
        const font = await new FontFace(
          family,
          "url(data:font/woff2;base64," + fonts[i] + ")",
        ).load();
        document.fonts.add(font);
      }
    },
    fonts.map((f) => f.toString("base64")),
  );
  for (const [kind, w, h, path] of [
    [
      "banner",
      320,
      180,
      "android/app/src/main/res/drawable-xhdpi/tv_banner.png",
    ],
    ["icon", 512, 512, "android/app/src/main/res/mipmap-nodpi/ic_launcher.png"],
  ]) {
    const data = await page.evaluate(
      ({ kind, w, h }) => {
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        const g = c.getContext("2d");
        g.fillStyle = "#f3ecdf";
        g.fillRect(0, 0, w, h);
        g.fillStyle = "#292c27";
        g.textBaseline = "middle";
        g.textAlign = "center";
        g.font = `${kind === "banner" ? 70 : 335}px FoleyDisplay`;
        const text = kind === "banner" ? "foley" : "f";
        g.fillText(
          text,
          w / 2 - (kind === "banner" ? 7 : 16),
          h / 2 - (kind === "banner" ? 8 : 13),
        );
        const width = g.measureText(text).width;
        g.fillStyle = "#b74028";
        g.beginPath();
        g.arc(
          w / 2 + width / 2 + (kind === "banner" ? 2 : 5),
          h / 2 + (kind === "banner" ? 17 : 91),
          kind === "banner" ? 5 : 21,
          0,
          Math.PI * 2,
        );
        g.fill();
        if (kind === "banner") {
          g.fillStyle = "#63655a";
          g.font = "12px FoleyBody";
          g.fillText("Make a little movie noise.", w / 2, 139);
        }
        return c.toDataURL("image/png");
      },
      { kind, w, h },
    );
    await mkdir(path.slice(0, path.lastIndexOf("/")), { recursive: true });
    await writeFile(path, Buffer.from(data.split(",")[1], "base64"));
  }
  console.log(
    "Created original Foley launcher banner (320x180) and icon (512x512).",
  );
} finally {
  await b.close();
}
