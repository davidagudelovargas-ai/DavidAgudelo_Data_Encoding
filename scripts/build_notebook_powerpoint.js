const fs = require("fs");
const path = require("path");
const PptxGenJS = require("pptxgenjs");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "..");
const NOTEBOOK_DIR = path.join(ROOT, "notebooks");
const EXPORT_DIR = path.join(ROOT, "exports");
const ASSET_DIR = path.join(EXPORT_DIR, "ppt_assets_notebooks_01_08");
const OUT = path.join(EXPORT_DIR, "BioSpatial_Intelligence_Notebooks_01_08.pptx");

const SLIDE_W = 13.333;
const SLIDE_H = 7.5;
const COLORS = {
  ink: "17212B",
  muted: "5D6875",
  pale: "F7F4EC",
  paper: "FFFDF8",
  line: "D8D1C3",
  green: "2E6F55",
  blue: "2F5E8F",
  amber: "A66A2C",
  plum: "6D4B7C",
};

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function xmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function decodeEntities(value) {
  return String(value ?? "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function normalizeSource(source) {
  return Array.isArray(source) ? source.join("") : String(source ?? "");
}

function firstHeading(markdown) {
  const line = markdown.split(/\r?\n/).find((item) => /^#{1,4}\s+/.test(item.trim()));
  return line ? line.replace(/^#{1,4}\s+/, "").trim() : "";
}

function plainMarkdown(markdown) {
  const lines = markdown
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```/g, ""))
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);

  return lines
    .map((line) => {
      const trimmed = line.trim();
      if (/^#{1,4}\s+/.test(trimmed)) return trimmed.replace(/^#{1,4}\s+/, "");
      return trimmed
        .replace(/\*\*([^*]+)\*\*/g, "$1")
        .replace(/`([^`]+)`/g, "$1");
    })
    .join("\n");
}

function chunkText(text, maxChars = 1150) {
  const paras = text.split(/\n{1,}/).map((p) => p.trim()).filter(Boolean);
  const chunks = [];
  let current = "";
  for (const para of paras) {
    const candidate = current ? `${current}\n${para}` : para;
    if (candidate.length > maxChars && current) {
      chunks.push(current);
      current = para;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks.length ? chunks : [""];
}

function cleanCell(html) {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function parseHtmlTable(html) {
  const source = Array.isArray(html) ? html.join("") : String(html ?? "");
  const rows = [];
  const trRe = /<tr[\s\S]*?<\/tr>/gi;
  let trMatch;
  while ((trMatch = trRe.exec(source))) {
    const rowHtml = trMatch[0];
    const cells = [];
    const cellRe = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi;
    let cellMatch;
    while ((cellMatch = cellRe.exec(rowHtml))) {
      cells.push(cleanCell(cellMatch[1]));
    }
    if (cells.length) rows.push(cells);
  }
  return rows;
}

function tableChunks(rows) {
  if (!rows.length) return [];
  return [{ rows, label: "" }];
}

function fitText(text, maxLen = 46) {
  const value = String(text ?? "");
  return value.length > maxLen ? `${value.slice(0, maxLen - 1)}…` : value;
}

async function renderTable(rows, outPath) {
  const colCount = Math.max(1, Math.max(...rows.map((row) => row.length)));
  const rowCount = rows.length;
  const width = Math.max(900, colCount * 190);
  const rowH = 42;
  const height = Math.max(170, rowCount * rowH + 38);
  const colW = width / colCount;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
  svg += `<rect width="100%" height="100%" fill="#FFFFFF"/>`;
  svg += `<rect x="0" y="0" width="${width}" height="${rowH}" fill="#EAF1ED"/>`;

  for (let r = 0; r < rowCount; r++) {
    const y = r * rowH;
    if (r > 0 && r % 2 === 0) {
      svg += `<rect x="0" y="${y}" width="${width}" height="${rowH}" fill="#FAF8F1"/>`;
    }
    for (let c = 0; c < colCount; c++) {
      const x = c * colW;
      svg += `<rect x="${x}" y="${y}" width="${colW}" height="${rowH}" fill="none" stroke="#D8D1C3" stroke-width="1"/>`;
      const text = fitText(rows[r][c] ?? "", Math.max(12, Math.floor(colW / 7.6)));
      svg += `<text x="${x + 9}" y="${y + 26}" font-family="Arial, Helvetica, sans-serif" font-size="${r === 0 ? 16 : 14}" font-weight="${r === 0 ? 700 : 400}" fill="#17212B">${xmlEscape(text)}</text>`;
    }
  }
  svg += `</svg>`;

  await sharp(Buffer.from(svg)).png().toFile(outPath);
}

function addFooter(pptx, slide, notebookLabel, slideNo) {
  slide.addShape(pptx.ShapeType.line, {
    x: 0.48,
    y: 7.05,
    w: 12.35,
    h: 0,
    line: { color: COLORS.line, width: 0.7 },
  });
  slide.addText(notebookLabel, {
    x: 0.55,
    y: 7.12,
    w: 7,
    h: 0.18,
    fontFace: "Aptos",
    fontSize: 7.8,
    color: COLORS.muted,
    margin: 0,
  });
  slide.addText(String(slideNo).padStart(2, "0"), {
    x: 12.08,
    y: 7.12,
    w: 0.7,
    h: 0.18,
    fontFace: "Aptos",
    fontSize: 7.8,
    color: COLORS.muted,
    align: "right",
    margin: 0,
  });
}

function addHeader(slide, kicker, title) {
  slide.background = { color: COLORS.paper };
  slide.addText(kicker.toUpperCase(), {
    x: 0.58,
    y: 0.32,
    w: 3.1,
    h: 0.22,
    fontFace: "Aptos",
    fontSize: 8.6,
    bold: true,
    color: COLORS.green,
    margin: 0,
    breakLine: false,
  });
  slide.addText(title, {
    x: 0.55,
    y: 0.68,
    w: 12,
    h: 0.46,
    fontFace: "Aptos Display",
    fontSize: title.length > 78 ? 21 : 25,
    bold: true,
    color: COLORS.ink,
    margin: 0,
    fit: "shrink",
  });
}

function addTextSlide(pptx, block, text, partLabel) {
  const slide = pptx.addSlide();
  addHeader(slide, block.notebookLabel, partLabel ? `${block.title} (${partLabel})` : block.title);
  const lines = text.split(/\r?\n/);
  const body = lines
    .map((line) => line.replace(/^[-*]\s+/, "• ").replace(/^\d+\.\s+/, (m) => m))
    .join("\n");
  slide.addText(body, {
    x: 0.72,
    y: 1.36,
    w: 11.9,
    h: 5.25,
    fontFace: "Aptos",
    fontSize: body.length > 950 ? 14 : body.length > 650 ? 16 : 18,
    color: COLORS.ink,
    breakLine: false,
    valign: "top",
    fit: "shrink",
    margin: 0.04,
    paraSpaceAfterPt: 5,
  });
  return slide;
}

async function containedImagePlacement(assetPath, box) {
  const meta = await sharp(assetPath).metadata();
  const imageW = meta.width || 1;
  const imageH = meta.height || 1;
  const imageRatio = imageW / imageH;
  const boxRatio = box.w / box.h;

  let w = box.w;
  let h = box.h;
  if (imageRatio > boxRatio) {
    h = w / imageRatio;
  } else {
    w = h * imageRatio;
  }

  return {
    x: box.x + (box.w - w) / 2,
    y: box.y + (box.h - h) / 2,
    w,
    h,
    imageW,
    imageH,
  };
}

async function addArtifactSlide(pptx, block, artifact, assetPath, caption, artifactIndex) {
  const slide = pptx.addSlide();
  addHeader(slide, block.notebookLabel, `${block.title}`);
  const text = plainMarkdown(block.markdown);
  const body = chunkText(text, 620)[0].split(/\r?\n/).slice(1).join("\n") || text;
  slide.addText(body, {
    x: 0.62,
    y: 1.38,
    w: 4.05,
    h: 4.95,
    fontFace: "Aptos",
    fontSize: body.length > 520 ? 11.8 : 13.2,
    color: COLORS.ink,
    valign: "top",
    fit: "shrink",
    margin: 0.03,
    paraSpaceAfterPt: 3,
  });

  slide.addShape(pptx.ShapeType.line, {
    x: 4.92,
    y: 1.33,
    w: 0,
    h: 5.25,
    line: { color: COLORS.line, width: 0.8 },
  });

  const box = {
    x: 5.22,
    y: 1.35,
    w: 7.43,
    h: artifact.kind === "table" ? 5.18 : 4.95,
  };
  const placement = await containedImagePlacement(assetPath, box);

  slide.addImage({
    path: assetPath,
    x: placement.x,
    y: placement.y,
    w: placement.w,
    h: placement.h,
  });

  slide.addText(caption || `${artifact.kind === "figure" ? "Chart" : "Table"} ${artifactIndex}`, {
    x: 5.23,
    y: 6.52,
    w: 7.4,
    h: 0.28,
    fontFace: "Aptos",
    fontSize: 9.5,
    italic: true,
    color: COLORS.muted,
    margin: 0,
  });
  return slide;
}

function addConsoleSlide(pptx, block, text) {
  const slide = pptx.addSlide();
  addHeader(slide, block.notebookLabel, `${block.title} · console output`);
  slide.addText(text.slice(0, 3500), {
    x: 0.7,
    y: 1.32,
    w: 11.9,
    h: 5.55,
    fontFace: "Consolas",
    fontSize: text.length > 2100 ? 10 : 12,
    color: COLORS.ink,
    fill: { color: "F2EFE6", transparency: 5 },
    line: { color: COLORS.line, width: 0.8 },
    valign: "top",
    fit: "shrink",
    margin: 0.12,
    breakLine: false,
  });
  return slide;
}

function extractBlocks(notebookPath, notebookIndex) {
  const nb = JSON.parse(fs.readFileSync(notebookPath, "utf8"));
  const name = path.basename(notebookPath, ".ipynb");
  const notebookLabel = `Notebook ${String(notebookIndex).padStart(2, "0")} · ${name.replace(/^\d+_/, "").replace(/_/g, " ")}`;
  const blocks = [];
  let current = null;

  for (const cell of nb.cells || []) {
    if (cell.cell_type === "markdown") {
      const markdown = normalizeSource(cell.source).trim();
      if (!markdown) continue;
      const heading = firstHeading(markdown);
      if (heading) {
        current = { notebookLabel, title: heading, markdown, artifacts: [], console: [] };
        blocks.push(current);
      } else if (current) {
        current.markdown += `\n\n${markdown}`;
      }
      continue;
    }

    if (cell.cell_type === "code" && current) {
      for (const output of cell.outputs || []) {
        const data = output.data || {};
        if (data["image/png"]) {
          current.artifacts.push({ kind: "figure", data: data["image/png"] });
        }
        if (data["text/html"]) {
          const rows = parseHtmlTable(data["text/html"]);
          if (rows.length) current.artifacts.push({ kind: "table", rows });
        }
        if (output.output_type === "stream" && output.text) {
          const text = normalizeSource(output.text).trim();
          if (text && !/^\s*$/.test(text)) current.console.push(text);
        }
      }
    }
  }
  return blocks;
}

function addCover(pptx) {
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.pale };
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 0.24,
    h: SLIDE_H,
    fill: { color: COLORS.green },
    line: { color: COLORS.green },
  });
  slide.addText("BioSpatial Intelligence", {
    x: 0.82,
    y: 1.05,
    w: 11.2,
    h: 0.72,
    fontFace: "Aptos Display",
    fontSize: 43,
    bold: true,
    color: COLORS.ink,
    margin: 0,
  });
  slide.addText("Academic Machine Learning Workflow", {
    x: 0.85,
    y: 1.92,
    w: 9.2,
    h: 0.36,
    fontFace: "Aptos",
    fontSize: 19,
    color: COLORS.green,
    margin: 0,
  });
  slide.addText("Editable presentation generated from notebooks 01-08", {
    x: 0.86,
    y: 5.84,
    w: 8.8,
    h: 0.28,
    fontFace: "Aptos",
    fontSize: 13,
    color: COLORS.muted,
    margin: 0,
  });
}

function addSection(pptx, notebookLabel, title, idx) {
  const slide = pptx.addSlide();
  const accent = [COLORS.green, COLORS.blue, COLORS.amber, COLORS.plum][idx % 4];
  slide.background = { color: COLORS.ink };
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 6.98,
    w: SLIDE_W,
    h: 0.52,
    fill: { color: accent },
    line: { color: accent },
  });
  slide.addText(String(idx).padStart(2, "0"), {
    x: 0.72,
    y: 1.05,
    w: 2,
    h: 0.82,
    fontFace: "Aptos Display",
    fontSize: 38,
    bold: true,
    color: "FFFFFF",
    margin: 0,
  });
  slide.addText(title, {
    x: 0.78,
    y: 2.05,
    w: 10.8,
    h: 1.08,
    fontFace: "Aptos Display",
    fontSize: 34,
    bold: true,
    color: "FFFFFF",
    fit: "shrink",
    margin: 0,
  });
  slide.addText(notebookLabel, {
    x: 0.82,
    y: 5.85,
    w: 10.2,
    h: 0.26,
    fontFace: "Aptos",
    fontSize: 12,
    color: "C7D3CF",
    margin: 0,
  });
}

async function main() {
  ensureDir(EXPORT_DIR);
  fs.rmSync(ASSET_DIR, { recursive: true, force: true });
  ensureDir(ASSET_DIR);

  const notebookFiles = fs
    .readdirSync(NOTEBOOK_DIR)
    .filter((name) => /^\d{2}_.*\.ipynb$/.test(name))
    .sort()
    .map((name) => path.join(NOTEBOOK_DIR, name));

  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Codex";
  pptx.company = "OpenAI";
  pptx.subject = "BioSpatial Intelligence notebooks 01-08";
  pptx.title = "BioSpatial Intelligence - Notebooks 01-08";
  pptx.lang = "en-US";
  pptx.theme = {
    headFontFace: "Aptos Display",
    bodyFontFace: "Aptos",
    lang: "en-US",
  };

  addCover(pptx);

  let slideCounter = 1;
  const summary = [];
  for (let i = 0; i < notebookFiles.length; i++) {
    const notebookPath = notebookFiles[i];
    const blocks = extractBlocks(notebookPath, i + 1);
    const notebookTitle = blocks[0]?.title || path.basename(notebookPath, ".ipynb");
    const notebookLabel = blocks[0]?.notebookLabel || `Notebook ${String(i + 1).padStart(2, "0")}`;
    addSection(pptx, notebookLabel, notebookTitle, i + 1);
    slideCounter++;

    let blockSlides = 0;
    let figures = 0;
    let tables = 0;
    for (let b = 0; b < blocks.length; b++) {
      const block = blocks[b];
      const text = plainMarkdown(block.markdown);
      const textChunks = chunkText(text, 1200);
      for (let t = 0; t < textChunks.length; t++) {
        const slide = addTextSlide(pptx, block, textChunks[t], textChunks.length > 1 ? `text ${t + 1}/${textChunks.length}` : "");
        addFooter(pptx, slide, block.notebookLabel, ++slideCounter);
        blockSlides++;
      }

      let artifactIndex = 0;
      for (const artifact of block.artifacts) {
        artifactIndex++;
        if (artifact.kind === "figure") {
          figures++;
          const assetPath = path.join(ASSET_DIR, `${String(i + 1).padStart(2, "0")}_${String(b + 1).padStart(2, "0")}_fig_${artifactIndex}.png`);
          fs.writeFileSync(assetPath, Buffer.from(artifact.data, "base64"));
          const slide = await addArtifactSlide(pptx, block, artifact, assetPath, `Chart extracted from the notebook · movable object`, artifactIndex);
          addFooter(pptx, slide, block.notebookLabel, ++slideCounter);
          blockSlides++;
        } else if (artifact.kind === "table") {
          tables++;
          const chunks = tableChunks(artifact.rows);
          for (let c = 0; c < chunks.length; c++) {
            const assetPath = path.join(ASSET_DIR, `${String(i + 1).padStart(2, "0")}_${String(b + 1).padStart(2, "0")}_table_${artifactIndex}_${c + 1}.png`);
            await renderTable(chunks[c].rows, assetPath);
            const caption = chunks[c].label
              ? `Table extracted from the notebook · ${chunks[c].label}`
              : "Table extracted from the notebook · movable object";
            const slide = await addArtifactSlide(pptx, block, artifact, assetPath, caption, artifactIndex);
            addFooter(pptx, slide, block.notebookLabel, ++slideCounter);
            blockSlides++;
          }
        }
      }

      for (const consoleText of block.console) {
        if (consoleText.length < 4) continue;
        const slide = addConsoleSlide(pptx, block, consoleText);
        addFooter(pptx, slide, block.notebookLabel, ++slideCounter);
        blockSlides++;
      }
    }
    summary.push({
      notebook: path.basename(notebookPath),
      blocks: blocks.length,
      slides: blockSlides + 1,
      figures,
      tables,
    });
  }

  await pptx.writeFile({ fileName: OUT });
  fs.writeFileSync(path.join(EXPORT_DIR, "BioSpatial_Intelligence_Notebooks_01_08_manifest.json"), JSON.stringify({ output: OUT, slideCount: pptx._slides.length, notebooks: summary }, null, 2), "utf8");
  console.log(JSON.stringify({ output: OUT, slideCount: pptx._slides.length, notebooks: summary }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
