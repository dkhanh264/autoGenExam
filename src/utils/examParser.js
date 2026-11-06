import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import * as pdfjsModule from 'pdfjs-dist';
import { autoFindMissingAnswers } from './answerFinder.js';

const pdfjsLib = pdfjsModule.default || pdfjsModule;

try {
  if (pdfjsLib?.GlobalWorkerOptions) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.js',
      import.meta.url
    ).toString();
  }
} catch {
  if (pdfjsLib?.GlobalWorkerOptions) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${
      pdfjsLib.version || '3.11.174'
    }/pdf.worker.min.js`;
  }
}

/**
 * Style Token Format: ⟦S:U,H,B,I,C=#FF0000⟧text⟦/S⟧
 * U = Underline
 * H = Highlight or Background Shading
 * B = Bold
 * I = Italic
 * C=#HEX = Non-black text color
 */
const STYLE_TOKEN_REGEX = /⟦S:([^⟧]*)⟧([\s\S]*?)⟦\/S⟧/g;

export function stripStyleTokens(str = '') {
  return String(str)
    .replace(/⟦S:[^⟧]*⟧/g, '')
    .replace(/⟦\/S⟧/g, '')
    .replace(/⟦\/?MARK⟧/g, '')
    .trim();
}

function wrapWithStyle(text, styleFlags) {
  if (!text || !text.trim()) return text;
  const parts = [];
  if (styleFlags.underline) parts.push('U');
  if (styleFlags.highlight) parts.push('H');
  if (styleFlags.bold) parts.push('B');
  if (styleFlags.italic) parts.push('I');
  if (styleFlags.color) parts.push(`C=${styleFlags.color}`);
  if (parts.length === 0) return text;
  return `⟦S:${parts.join(',')}⟧${text}⟦/S⟧`;
}

/**
 * Parse a raw option line containing ⟦S:...⟧...⟦/S⟧ tokens into character-level style metrics
 * separating prefix (e.g. "A.") from body (e.g. "Hà Nội") without ever breaking across token boundaries.
 */
function analyzeRawOptionLine(rawLine = '') {
  const chars = [];
  let activeFlags = { U: false, H: false, B: false, I: false, color: null };

  const tokenRegex = /⟦S:([^⟧]*)⟧|⟦\/S⟧/g;
  let lastIndex = 0;
  let match;

  const pushSegment = (segmentText, flags) => {
    for (const ch of segmentText) {
      chars.push({ ch, flags: { ...flags } });
    }
  };

  while ((match = tokenRegex.exec(rawLine)) !== null) {
    if (match.index > lastIndex) {
      pushSegment(rawLine.slice(lastIndex, match.index), activeFlags);
    }
    if (match[0] === '⟦/S⟧') {
      activeFlags = { U: false, H: false, B: false, I: false, color: null };
    } else {
      const parts = (match[1] || '').split(',');
      const colorPart = parts.find(p => p.startsWith('C='));
      activeFlags = {
        U: parts.includes('U'),
        H: parts.includes('H'),
        B: parts.includes('B'),
        I: parts.includes('I'),
        color: colorPart ? colorPart.slice(2) : null
      };
    }
    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < rawLine.length) {
    pushSegment(rawLine.slice(lastIndex), activeFlags);
  }

  const cleanFull = chars.map(c => c.ch).join('');
  const prefixMatch = cleanFull.match(/^(\s*(?:\*|\[x\]|\(x\)|✓|✔|->|=>)?\s*[A-F]\s*\*?[\.\)\:]\s*)/i);
  const prefixLen = prefixMatch ? prefixMatch[1].length : 0;

  const prefixChars = chars.slice(0, prefixLen);
  const bodyChars = chars.slice(prefixLen);
  const nonSpaceBody = bodyChars.filter(c => c.ch.trim() !== '');
  const prefixAlpha = prefixChars.filter(c => /[A-Za-z]/.test(c.ch));

  const allNonSpace = chars.filter(c => c.ch.trim() !== '');
  const hasHighlight = allNonSpace.some(c => c.flags.H);
  const hasUnderline = allNonSpace.some(c => c.flags.U);

  const colors = new Set();
  allNonSpace.forEach(c => {
    if (c.flags.color) colors.add(c.flags.color);
  });

  const prefixBold =
    prefixAlpha.length > 0 && prefixAlpha.every(c => c.flags.B);

  const boldBodyCount = nonSpaceBody.filter(c => c.flags.B).length;
  const italicBodyCount = nonSpaceBody.filter(c => c.flags.I).length;
  const bodyLen = Math.max(1, nonSpaceBody.length);

  return {
    cleanText: bodyChars.map(c => c.ch).join('').trim(),
    hasHighlight,
    hasUnderline,
    colors: Array.from(colors),
    prefixBold,
    bodyBoldRatio: boldBodyCount / bodyLen,
    bodyItalicRatio: italicBodyCount / bodyLen
  };
}

/**
 * Relative Style Differential Analysis across all options of a single question.
 * Compares options [A, B, C, D] against each other so ANY unique visual mark
 * (highlight/shading, underline, text color, bold body, bold letter, italic) is detected!
 */
function resolveQuestionOptionsByDifferential(rawOptions) {
  const analyzed = rawOptions.map((opt, idx) => {
    const style = analyzeRawOptionLine(opt.rawFullLine || opt.rawText || '');
    return {
      ...opt,
      label: String.fromCharCode(65 + idx),
      text: opt.cleanBodyText !== undefined ? opt.cleanBodyText : style.cleanText,
      style
    };
  });

  // 1. Check explicit symbol mark (*A., [x], (Đúng), HTML/Markdown explicit)
  const explicitHits = analyzed.filter(o => o.isExplicitCorrect);
  if (explicitHits.length >= 1) {
    return analyzed.map(o => ({
      label: o.label,
      text: o.text,
      isCorrect: Boolean(o.isExplicitCorrect),
      answerSource: o.isExplicitCorrect ? (o.explicitSource || 'Ký hiệu đánh dấu') : undefined
    }));
  }

  // 2. Check Highlight / Shading (exactly 1 option highlighted/shaded)
  const highlightHits = analyzed.filter(o => o.style.hasHighlight);
  if (highlightHits.length === 1) {
    const targetLabel = highlightHits[0].label;
    return analyzed.map(o => ({
      label: o.label,
      text: o.text,
      isCorrect: o.label === targetLabel,
      answerSource: o.label === targetLabel ? 'Tô nền / Highlight' : undefined
    }));
  }

  // 3. Check Underline (exactly 1 option underlined)
  const underlineHits = analyzed.filter(o => o.style.hasUnderline);
  if (underlineHits.length === 1) {
    const targetLabel = underlineHits[0].label;
    return analyzed.map(o => ({
      label: o.label,
      text: o.text,
      isCorrect: o.label === targetLabel,
      answerSource: o.label === targetLabel ? 'Gạch chân' : undefined
    }));
  }

  // 4. Check Text Color Differential
  const coloredHits = analyzed.filter(o => o.style.colors.length > 0);
  if (coloredHits.length === 1) {
    const targetLabel = coloredHits[0].label;
    return analyzed.map(o => ({
      label: o.label,
      text: o.text,
      isCorrect: o.label === targetLabel,
      answerSource: o.label === targetLabel ? 'Tô màu chữ' : undefined
    }));
  } else if (coloredHits.length === analyzed.length && analyzed.length >= 3) {
    // All options have color tags, check if 1 option has a unique color different from the rest
    const colorCounts = {};
    analyzed.forEach(o => {
      const c = o.style.colors[0] || 'DEFAULT';
      colorCounts[c] = (colorCounts[c] || 0) + 1;
    });
    const uniqueColorOpt = analyzed.find(o => colorCounts[o.style.colors[0] || 'DEFAULT'] === 1);
    if (uniqueColorOpt) {
      return analyzed.map(o => ({
        label: o.label,
        text: o.text,
        isCorrect: o.label === uniqueColorOpt.label,
        answerSource: o.label === uniqueColorOpt.label ? 'Tô màu chữ' : undefined
      }));
    }
  }

  // 5. Check Bold Body Text Differential (1 option body is bold, others are not)
  const boldBodyHits = analyzed.filter(o => o.style.bodyBoldRatio >= 0.45);
  const nonBoldBodyHits = analyzed.filter(o => o.style.bodyBoldRatio < 0.15);
  if (boldBodyHits.length === 1 && nonBoldBodyHits.length === analyzed.length - 1) {
    const targetLabel = boldBodyHits[0].label;
    return analyzed.map(o => ({
      label: o.label,
      text: o.text,
      isCorrect: o.label === targetLabel,
      answerSource: o.label === targetLabel ? 'In đậm nội dung' : undefined
    }));
  }

  // 6. Check Bold Prefix Letter Differential (1 option letter A/B/C/D is bold, others are not)
  const boldPrefixHits = analyzed.filter(o => o.style.prefixBold);
  if (boldPrefixHits.length === 1) {
    const targetLabel = boldPrefixHits[0].label;
    return analyzed.map(o => ({
      label: o.label,
      text: o.text,
      isCorrect: o.label === targetLabel,
      answerSource: o.label === targetLabel ? 'In đậm chữ cái' : undefined
    }));
  }

  // 7. Check Italic Differential (1 option is italic, others are not)
  const italicHits = analyzed.filter(o => o.style.bodyItalicRatio >= 0.45);
  const nonItalicHits = analyzed.filter(o => o.style.bodyItalicRatio < 0.15);
  if (italicHits.length === 1 && nonItalicHits.length === analyzed.length - 1) {
    const targetLabel = italicHits[0].label;
    return analyzed.map(o => ({
      label: o.label,
      text: o.text,
      isCorrect: o.label === targetLabel,
      answerSource: o.label === targetLabel ? 'In nghiêng' : undefined
    }));
  }

  // No style differential found
  return analyzed.map(o => ({
    label: o.label,
    text: o.text,
    isCorrect: false
  }));
}

/**
 * Entry point: Parse any uploaded File into a structured exam object.
 * Automatically resolves missing answers if autoSolve = true.
 */
export async function parseExamFile(file, { autoSolve = true, onProgress } = {}) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  const baseTitle = file.name.replace(/\.[^/.]+$/, '');

  let parsed;

  if (ext === 'json') {
    const text = await file.text();
    parsed = parseJsonExam(text, baseTitle);
  } else if (ext === 'xlsx' || ext === 'xls' || ext === 'csv' || ext === 'tsv') {
    const buffer = await file.arrayBuffer();
    parsed = parseSpreadsheetExam(buffer, baseTitle);
  } else if (ext === 'docx') {
    const buffer = await file.arrayBuffer();
    const rawStyledText = await extractDocxTextWithStyles(buffer);
    parsed = parseStructuredTextExam(rawStyledText, baseTitle);
  } else if (ext === 'pdf') {
    const buffer = await file.arrayBuffer();
    const rawStyledText = await extractPdfTextWithStyles(buffer);
    parsed = parseStructuredTextExam(rawStyledText, baseTitle);
  } else if (ext === 'html' || ext === 'htm') {
    const htmlText = await file.text();
    const rawStyledText = convertHtmlToStyledText(htmlText);
    parsed = parseStructuredTextExam(rawStyledText, baseTitle);
  } else {
    const text = await file.text();
    parsed = parseStructuredTextExam(text, baseTitle);
  }

  // If any questions are missing answers and autoSolve is enabled, automatically find the correct answers!
  if (autoSolve && parsed.questions.length > 0 && parsed.stats.missingAnswerCount > 0) {
    const solvedQuestions = await autoFindMissingAnswers(parsed.questions, {
      forceAll: false,
      onProgress
    });
    parsed = finalizeParsedExam(parsed.title, solvedQuestions, {
      autoSolvedCount: parsed.stats.missingAnswerCount
    });
  }

  return parsed;
}

/**
 * Convert HTML content into styled text tokens
 */
function convertHtmlToStyledText(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  function walk(node, inherited = {}) {
    if (node.nodeType === Node.TEXT_NODE) {
      return wrapWithStyle(node.textContent || '', inherited);
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    const tag = node.tagName.toLowerCase();
    const styleAttr = (node.getAttribute('style') || '').toLowerCase();
    const nextStyle = { ...inherited };

    if (tag === 'u' || tag === 'ins' || styleAttr.includes('underline')) {
      nextStyle.underline = true;
    }
    if (tag === 'b' || tag === 'strong' || /font-weight\s*:\s*(bold|[6-9]00)/.test(styleAttr)) {
      nextStyle.bold = true;
    }
    if (tag === 'i' || tag === 'em' || styleAttr.includes('italic')) {
      nextStyle.italic = true;
    }
    if (tag === 'mark' || /background(-color)?\s*:\s*(?!transparent|none|#fff|#ffffff|white)/i.test(styleAttr)) {
      nextStyle.highlight = true;
    }
    const colorMatch = styleAttr.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i) || [null, node.getAttribute('color')];
    if (colorMatch && colorMatch[1]) {
      const c = colorMatch[1].trim().toUpperCase();
      if (!['#000', '#000000', 'BLACK', ' RGB(0, 0, 0)', 'RGB(0,0,0)', 'INHERIT'].includes(c)) {
        nextStyle.color = c;
      }
    }

    let inner = '';
    for (const child of Array.from(node.childNodes)) {
      inner += walk(child, nextStyle);
    }

    if (['p', 'div', 'li', 'tr', 'br', 'h1', 'h2', 'h3', 'h4'].includes(tag)) {
      return inner + '\n';
    }
    if (['td', 'th'].includes(tag)) {
      return inner + '    ';
    }
    return inner;
  }

  return walk(doc.body || doc.documentElement);
}

/**
 * Parse JSON file
 */
function parseJsonExam(jsonText, fallbackTitle) {
  const data = JSON.parse(jsonText);
  const list = Array.isArray(data) ? data : (data.questions || []);
  const questions = list.map((q, idx) => {
    const options = (q.options || []).map((opt, oIdx) => {
      const label = String.fromCharCode(65 + oIdx);
      if (typeof opt === 'string') {
        const isCorrect = q.correctAnswer === label || q.correctIndex === oIdx;
        return {
          label,
          text: opt,
          isCorrect,
          answerSource: isCorrect ? 'File JSON' : undefined
        };
      }
      const isCorrect = Boolean(opt.isCorrect || q.correctAnswer === label);
      return {
        label,
        text: opt.text || '',
        isCorrect,
        answerSource: isCorrect ? 'File JSON' : undefined
      };
    });
    return {
      id: q.id || `q-${Date.now()}-${idx}`,
      number: idx + 1,
      question: q.question || q.text || `Câu hỏi ${idx + 1}`,
      options: options.length >= 2 ? options : defaultOptions(),
      explanation: q.explanation || '',
      answerSource: options.find(o => o.isCorrect)?.answerSource
    };
  });

  return finalizeParsedExam(data.title || fallbackTitle, questions);
}

/**
 * Parse Excel (.xlsx, .xls) or CSV (.csv) with full Cell Style inspection
 * (Detects background fill color, font color, bold, underline on option cells,
 *  explicit answer column, OR vertical document layout in Excel!)
 */
function parseSpreadsheetExam(arrayBuffer, fallbackTitle) {
  const workbook = XLSX.read(arrayBuffer, { type: 'array', cellStyles: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  // Extract rich cell matrix with styles
  const range = sheet['!ref'] ? XLSX.utils.decode_range(sheet['!ref']) : { s: { r: 0, c: 0 }, e: { r: 0, c: 0 } };
  const richRows = [];

  for (let r = range.s.r; r <= range.e.r; r++) {
    const rowCells = [];
    let hasContent = false;
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = sheet[addr];
      const text = cell && cell.v !== undefined ? String(cell.v).trim() : '';
      if (text !== '') hasContent = true;
      const cellStyle = extractExcelCellStyle(cell);
      rowCells.push({ text, style: cellStyle });
    }
    if (hasContent) {
      richRows.push(rowCells);
    }
  }

  if (richRows.length === 0) {
    return finalizeParsedExam(fallbackTitle, []);
  }

  // Check if this spreadsheet is actually a vertical list of questions (only 1 or 2 non-empty columns)
  const maxActiveCols = Math.max(
    ...richRows.map(r => r.filter(c => c.text !== '').length)
  );
  if (maxActiveCols <= 2) {
    const styledLines = richRows.map(r =>
      r
        .filter(c => c.text !== '')
        .map(c => wrapWithStyle(c.text, c.style))
        .join('    ')
    );
    return parseStructuredTextExam(styledLines.join('\n'), fallbackTitle);
  }

  // Otherwise, it's a tabular spreadsheet (1 question per row)
  const firstRow = richRows[0].map(c => c.text.toLowerCase());
  const isHeader = firstRow.some(h =>
    h.includes('câu hỏi') ||
    h.includes('nội dung') ||
    h.includes('question') ||
    h.includes('đề bài') ||
    h === 'đáp án a' ||
    h === 'a' ||
    h.includes('đáp án đúng') ||
    h.includes('answer')
  );

  let colMap = {
    question: 0,
    options: [1, 2, 3, 4],
    correct: 5,
    explanation: 6
  };

  let startRow = 0;
  if (isHeader) {
    startRow = 1;
    const qCol = firstRow.findIndex(h => h.includes('câu hỏi') || h.includes('nội dung') || h.includes('question') || h.includes('đề bài'));
    const aCol = firstRow.findIndex(h => h === 'a' || h === 'đáp án a' || h === 'lựa chọn a' || h === 'option a' || h === 'phương án a');
    const bCol = firstRow.findIndex(h => h === 'b' || h === 'đáp án b' || h === 'lựa chọn b' || h === 'option b' || h === 'phương án b');
    const cCol = firstRow.findIndex(h => h === 'c' || h === 'đáp án c' || h === 'lựa chọn c' || h === 'option c' || h === 'phương án c');
    const dCol = firstRow.findIndex(h => h === 'd' || h === 'đáp án d' || h === 'lựa chọn d' || h === 'option d' || h === 'phương án d');
    const eCol = firstRow.findIndex(h => h === 'e' || h === 'đáp án e' || h === 'lựa chọn e' || h === 'option e');
    const ansCol = firstRow.findIndex(h => h.includes('đáp án đúng') || h === 'đáp án' || h.includes('correct') || h === 'answer' || h === 'key' || h === 'kết quả');
    const expCol = firstRow.findIndex(h => h.includes('giải thích') || h.includes('lời giải') || h.includes('hướng dẫn') || h.includes('explanation'));

    const sttCol = firstRow.findIndex(h => h === 'stt' || h === 'số thứ tự' || h === 'no' || h === 'id' || h === 'câu');
    if (qCol !== -1) {
      colMap.question = qCol;
    } else if (sttCol === 0) {
      colMap.question = 1;
    }

    if (aCol !== -1 && bCol !== -1) {
      colMap.options = [aCol, bCol, cCol, dCol, eCol].filter(i => i !== -1);
    } else {
      const base = colMap.question + 1;
      colMap.options = [base, base + 1, base + 2, base + 3];
    }

    colMap.correct = ansCol !== -1 ? ansCol : Math.max(...colMap.options) + 1;
    colMap.explanation = expCol !== -1 ? expCol : colMap.correct + 1;
  } else {
    const firstColIsIndex = richRows.slice(0, 5).every(r => {
      const val = r[0]?.text || '';
      return /^\d+$/.test(val) || /^câu\s*\d+$/i.test(val);
    }) && richRows[0].length >= 5;

    if (firstColIsIndex) {
      colMap = {
        question: 1,
        options: [2, 3, 4, 5],
        correct: 6,
        explanation: 7
      };
    }
  }

  const questions = [];
  for (let i = startRow; i < richRows.length; i++) {
    const row = richRows[i];
    const qText = row[colMap.question]?.text || '';
    if (!qText) continue;

    const rawOptCells = colMap.options
      .map(colIdx => row[colIdx])
      .filter(cell => cell && cell.text !== '');

    if (rawOptCells.length < 2) continue;

    const rawCorrect = row[colMap.correct]?.text || '';
    const explanation = row[colMap.explanation]?.text || '';

    // Build raw options for differential style & explicit check
    const rawOptionsForDiff = rawOptCells.map((cell, idx) => {
      const label = String.fromCharCode(65 + idx);
      const cleanOpt = cell.text.replace(/^(?:\*|\[x\]|✓|✔)?\s*[A-F][\.\)\:]\s*/i, '').trim();
      const startsWithMarker = /^(?:\*|\[x\]|✓|✔)/.test(cell.text.trim()) || /\((?:đúng|correct)\)$/i.test(cell.text.trim());
      const matchesExplicitCol = isMatchingCorrectAnswer(rawCorrect, label, idx, cleanOpt);
      const finalBody = cleanOpt.replace(/\((?:đúng|correct)\)$/i, '').trim();

      return {
        rawFullLine: wrapWithStyle(`${label}. ${finalBody}`, cell.style),
        cleanBodyText: finalBody,
        isExplicitCorrect: startsWithMarker || matchesExplicitCol,
        explicitSource: matchesExplicitCol ? 'Cột đáp án Excel' : 'Ký hiệu đánh dấu'
      };
    });

    const resolvedOptions = resolveQuestionOptionsByDifferential(rawOptionsForDiff);
    const winningOpt = resolvedOptions.find(o => o.isCorrect);

    questions.push({
      id: `q-${Date.now()}-${questions.length}`,
      number: questions.length + 1,
      question: qText.replace(/^(?:Câu\s*\d+|Question\s*\d+|\d+)[\.\:\)\-]\s*/i, '').trim() || qText,
      options: resolvedOptions,
      explanation,
      answerSource: winningOpt?.answerSource
    });
  }

  return finalizeParsedExam(fallbackTitle, questions);
}

function extractExcelCellStyle(cell) {
  const flags = {
    underline: false,
    highlight: false,
    bold: false,
    italic: false,
    color: null
  };
  if (!cell || !cell.s) return flags;

  const s = cell.s;
  // Background fill in Excel
  const fgRgb = (s.fgColor?.rgb || s.fill?.fgColor?.rgb || '').toUpperCase();
  if (fgRgb && !['FFFFFF', '000000', 'AUTO', 'FF000000', 'FFFFFFFF'].includes(fgRgb)) {
    flags.highlight = true;
  }

  // Font styling in Excel
  const font = s.font || {};
  if (font.bold) flags.bold = true;
  if (font.italic) flags.italic = true;
  if (font.underline) flags.underline = true;

  const fontRgb = (font.color?.rgb || '').toUpperCase();
  if (fontRgb && !['000000', 'FF000000', 'FFFFFF', 'AUTO'].includes(fontRgb)) {
    flags.color = `#${fontRgb.slice(-6)}`;
  }

  return flags;
}

function isMatchingCorrectAnswer(rawCorrect, label, idx, cleanOptText) {
  if (!rawCorrect) return false;
  const norm = rawCorrect.trim().toUpperCase();
  if (norm === label) return true;
  if (norm === String(idx + 1)) return true;
  const letterMatch = norm.match(/^(?:ĐÁP\s*ÁN|PHƯƠNG\s*ÁN|CHỌN|OPTION|CÂU)?\s*([A-F])$/i);
  if (letterMatch && letterMatch[1].toUpperCase() === label) return true;
  if (cleanOptText && rawCorrect.trim().toLowerCase() === cleanOptText.toLowerCase()) return true;
  return false;
}

/**
 * Extract text and rich style tokens from .docx
 * Supports:
 * - Automatic Word Lists (<w:numPr> + word/numbering.xml)
 * - Word Tables (<w:tbl>) including cell background shading (<w:shd>)
 * - Run & Paragraph styles: <w:u>, <w:highlight>, <w:shd>, <w:color>, <w:b>, <w:i>
 */
async function extractDocxTextWithStyles(arrayBuffer) {
  const zip = await JSZip.loadAsync(arrayBuffer);
  const docFile = zip.file('word/document.xml');
  if (!docFile) {
    throw new Error('File .docx không hợp lệ hoặc bị hỏng.');
  }

  const xmlText = await docFile.async('string');
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'application/xml');

  // Parse numbering.xml if present to resolve automatic numbered questions & A/B/C/D options
  const numFormats = await parseDocxNumberingFormats(zip, parser);
  const numCounters = {};

  const body = xmlDoc.getElementsByTagName('w:body')[0];
  if (!body) return '';

  const lines = [];

  function processParagraph(p, inheritedShading = false) {
    const pPr = p.getElementsByTagName('w:pPr')[0];
    const pStyleFlags = extractPropertyStyleFlags(pPr, inheritedShading);

    // Check if paragraph uses automatic Word numbering (<w:numPr>)
    let autoPrefix = '';
    if (pPr) {
      const numPr = pPr.getElementsByTagName('w:numPr')[0];
      if (numPr) {
        const ilvl = numPr.getElementsByTagName('w:ilvl')[0]?.getAttribute('w:val') || '0';
        const numId = numPr.getElementsByTagName('w:numId')[0]?.getAttribute('w:val') || '1';
        const key = `${numId}-${ilvl}`;
        numCounters[key] = (numCounters[key] || 0) + 1;
        // Reset deeper levels
        Object.keys(numCounters).forEach(k => {
          const [nId, lvl] = k.split('-');
          if (nId === numId && Number(lvl) > Number(ilvl)) {
            numCounters[k] = 0;
          }
        });

        const count = numCounters[key];
        const fmt = numFormats[key] || (Number(ilvl) > 0 ? 'upperLetter' : 'decimal');
        if (fmt === 'upperLetter' || fmt === 'lowerLetter') {
          const letter = String.fromCharCode(64 + ((count - 1) % 6) + 1);
          autoPrefix = wrapWithStyle(`${letter}. `, pStyleFlags);
        } else if (fmt === 'decimal') {
          autoPrefix = `Câu ${count}: `;
        }
      }
    }

    let pText = '';
    for (const node of Array.from(p.childNodes)) {
      if (node.nodeName === 'w:r') {
        pText += extractDocxRun(node, pStyleFlags);
      } else if (node.nodeName === 'w:hyperlink' || node.nodeName === 'w:smartTag' || node.nodeName === 'w:sdt') {
        const innerRuns = Array.from(node.getElementsByTagName('w:r'));
        for (const r of innerRuns) {
          pText += extractDocxRun(r, pStyleFlags);
        }
      }
    }

    const cleanCheck = stripStyleTokens(pText);
    if (!cleanCheck) return '';

    // Only prepend autoPrefix if the text doesn't already start with a question or option label
    if (
      autoPrefix &&
      !/^(?:Câu\s*\d+|\d+[\.\)\:]|\*?[A-F][\.\)\:])/i.test(cleanCheck)
    ) {
      pText = autoPrefix + pText;
    }

    return pText;
  }

  // Walk direct children of <w:body> (paragraphs and tables)
  for (const child of Array.from(body.childNodes)) {
    if (child.nodeName === 'w:p') {
      const line = processParagraph(child, false);
      if (line) lines.push(line);
    } else if (child.nodeName === 'w:tbl') {
      const rows = Array.from(child.getElementsByTagName('w:tr'));
      for (const tr of rows) {
        const cellTexts = [];
        const cells = Array.from(tr.getElementsByTagName('w:tc'));
        for (const tc of cells) {
          const tcPr = tc.getElementsByTagName('w:tcPr')[0];
          const cellHasShading = hasNonWhiteShading(tcPr);
          const cellParas = Array.from(tc.getElementsByTagName('w:p'));
          const cellStr = cellParas
            .map(p => processParagraph(p, cellHasShading))
            .filter(Boolean)
            .join(' ');
          if (cellStr) cellTexts.push(cellStr);
        }
        if (cellTexts.length > 0) {
          lines.push(cellTexts.join('    '));
        }
      }
    }
  }

  return lines.join('\n');
}

async function parseDocxNumberingFormats(zip, parser) {
  const formats = {};
  const numFile = zip.file('word/numbering.xml');
  if (!numFile) return formats;

  try {
    const xmlText = await numFile.async('string');
    const doc = parser.parseFromString(xmlText, 'application/xml');

    const abstractMap = {};
    const abstractNums = Array.from(doc.getElementsByTagName('w:abstractNum'));
    for (const abs of abstractNums) {
      const absId = abs.getAttribute('w:abstractNumId');
      const lvls = Array.from(abs.getElementsByTagName('w:lvl'));
      for (const lvl of lvls) {
        const ilvl = lvl.getAttribute('w:ilvl') || '0';
        const numFmt = lvl.getElementsByTagName('w:numFmt')[0]?.getAttribute('w:val');
        if (absId && numFmt) {
          abstractMap[`${absId}-${ilvl}`] = numFmt;
        }
      }
    }

    const nums = Array.from(doc.getElementsByTagName('w:num'));
    for (const num of nums) {
      const numId = num.getAttribute('w:numId');
      const absId = num.getElementsByTagName('w:abstractNumId')[0]?.getAttribute('w:val');
      if (numId && absId) {
        for (let l = 0; l <= 4; l++) {
          const fmt = abstractMap[`${absId}-${l}`];
          if (fmt) formats[`${numId}-${l}`] = fmt;
        }
      }
    }
  } catch {
    // ignore numbering parse errors
  }

  return formats;
}

function hasNonWhiteShading(propNode) {
  if (!propNode) return false;
  const shd = propNode.getElementsByTagName('w:shd')[0];
  if (!shd) return false;
  const fill = (shd.getAttribute('w:fill') || '').toUpperCase();
  return Boolean(fill && !['AUTO', 'FFFFFF', 'NONE', '000000'].includes(fill));
}

function extractPropertyStyleFlags(propNode, inheritedHighlight = false) {
  const flags = {
    underline: false,
    highlight: Boolean(inheritedHighlight),
    bold: false,
    italic: false,
    color: null
  };

  if (!propNode) return flags;

  const uNode = propNode.getElementsByTagName('w:u')[0];
  if (uNode) {
    const uVal = uNode.getAttribute('w:val');
    if (!uVal || uVal !== 'none') flags.underline = true;
  }

  const hlNode = propNode.getElementsByTagName('w:highlight')[0];
  if (hlNode) {
    const hVal = hlNode.getAttribute('w:highlight') || hlNode.getAttribute('w:val');
    if (hVal && hVal !== 'none') flags.highlight = true;
  }

  if (hasNonWhiteShading(propNode)) {
    flags.highlight = true;
  }

  const bNode = propNode.getElementsByTagName('w:b')[0];
  if (bNode) {
    const bVal = bNode.getAttribute('w:val');
    if (!bVal || (bVal !== '0' && bVal !== 'false')) flags.bold = true;
  }

  const iNode = propNode.getElementsByTagName('w:i')[0];
  if (iNode) {
    const iVal = iNode.getAttribute('w:i') || iNode.getAttribute('w:val');
    if (!iVal || (iVal !== '0' && iVal !== 'false')) flags.italic = true;
  }

  const colorNode = propNode.getElementsByTagName('w:color')[0];
  if (colorNode) {
    const cVal = (colorNode.getAttribute('w:val') || '').toUpperCase();
    if (
      cVal &&
      !['AUTO', '000000', '111111', '222222', '333333', '2F3437', 'FFFFFF'].includes(cVal)
    ) {
      flags.color = `#${cVal}`;
    }
  }

  return flags;
}

function extractDocxRun(rNode, inheritedFlags = {}) {
  const rPr = rNode.getElementsByTagName('w:rPr')[0];
  const runFlags = extractPropertyStyleFlags(rPr, inheritedFlags.highlight);

  const mergedFlags = {
    underline: runFlags.underline || inheritedFlags.underline,
    highlight: runFlags.highlight || inheritedFlags.highlight,
    bold: runFlags.bold,
    italic: runFlags.italic,
    color: runFlags.color || inheritedFlags.color
  };

  let rawText = '';
  for (const child of Array.from(rNode.childNodes)) {
    if (child.nodeName === 'w:t') {
      rawText += child.textContent || '';
    } else if (child.nodeName === 'w:tab') {
      rawText += '    ';
    } else if (child.nodeName === 'w:br' || child.nodeName === 'w:cr') {
      rawText += '\n';
    }
  }

  return wrapWithStyle(rawText, mergedFlags);
}

/**
 * Extract text and font styles (Bold, Italic) from PDF
 */
async function extractPdfTextWithStyles(arrayBuffer) {
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const allLines = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const styles = content.styles || {};

    const rowBuckets = [];
    const tolerance = 3.5;

    for (const item of content.items) {
      if (!item.str) continue;
      const x = item.transform[4];
      const y = item.transform[5];
      const fontName = (item.fontName || '').toLowerCase();
      const fontFamily = (styles[item.fontName]?.fontFamily || '').toLowerCase();

      const isBold = fontName.includes('bold') || fontFamily.includes('bold');
      const isItalic = fontName.includes('italic') || fontName.includes('oblique') || fontFamily.includes('italic');

      const styledStr = wrapWithStyle(item.str, {
        bold: isBold,
        italic: isItalic
      });

      let bucket = rowBuckets.find(b => Math.abs(b.y - y) <= tolerance);
      if (!bucket) {
        bucket = { y, items: [] };
        rowBuckets.push(bucket);
      }
      bucket.items.push({ x, str: styledStr, rawLen: item.str.length });
    }

    rowBuckets.sort((a, b) => b.y - a.y);

    for (const bucket of rowBuckets) {
      bucket.items.sort((a, b) => a.x - b.x);
      let lineStr = '';
      let prevX = null;
      for (const it of bucket.items) {
        if (prevX !== null && it.x - prevX > 22) {
          lineStr += '    ';
        } else if (prevX !== null && !lineStr.endsWith(' ')) {
          lineStr += ' ';
        }
        lineStr += it.str;
        prevX = it.x + it.rawLen * 4;
      }
      if (stripStyleTokens(lineStr)) {
        allLines.push(lineStr.trim());
      }
    }
  }

  return allLines.join('\n');
}

/**
 * Parse structured or semi-structured text (with optional style tokens) into an Exam object
 */
export function parseStructuredTextExam(rawText, fallbackTitle = 'Đề thi mới') {
  if (!rawText || !stripStyleTokens(rawText)) {
    return finalizeParsedExam(fallbackTitle, []);
  }

  // Convert any inline HTML tags if user pasted HTML/Rich text into plain text
  let normalized = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (/<(?:u|b|strong|mark|span|font)\b/i.test(normalized)) {
    normalized = convertHtmlToStyledText(normalized);
  }

  // 1. Separate end-of-file Answer Key section if present
  const { bodyText, answerKeyMap, explanationMap } = splitBodyAndAnswerKey(normalized);

  // 2. Expand inline options onto separate logical lines
  const expandedLines = expandInlineOptions(bodyText);

  // 3. Group lines into question blocks and resolve option styles
  const rawQuestions = parseLinesIntoQuestions(expandedLines);

  // 4. Apply end-of-file answer keys and explanations
  const finalQuestions = rawQuestions.map((q, idx) => {
    const qNum = q.originalNumber || idx + 1;
    const keyLetter = answerKeyMap[qNum] || answerKeyMap[idx + 1];
    const hasAnyCorrect = q.options.some(o => o.isCorrect);

    const updatedOptions = q.options.map((opt, oIdx) => {
      const label = String.fromCharCode(65 + oIdx);
      const matchesKey = keyLetter && label === keyLetter.toUpperCase();
      const isCorrect = hasAnyCorrect ? opt.isCorrect : Boolean(matchesKey);
      return {
        label,
        text: opt.text,
        isCorrect,
        answerSource: isCorrect
          ? (opt.answerSource || (matchesKey ? 'Bảng đáp án cuối đề' : undefined))
          : undefined
      };
    });

    const winningOpt = updatedOptions.find(o => o.isCorrect);

    return {
      id: `q-${Date.now()}-${idx}`,
      number: idx + 1,
      question: q.question,
      options: updatedOptions,
      explanation: q.explanation || explanationMap[qNum] || explanationMap[idx + 1] || '',
      answerSource: winningOpt?.answerSource || q.answerSource
    };
  });

  return finalizeParsedExam(fallbackTitle, finalQuestions);
}

/**
 * Detect and extract end-of-file Answer Key section ("BẢNG ĐÁP ÁN", "ĐÁP ÁN", 2-row tables, etc.)
 */
function splitBodyAndAnswerKey(text) {
  const lines = text.split('\n');
  let keySectionStart = -1;

  for (let i = lines.length - 1; i >= 0; i--) {
    const clean = stripStyleTokens(lines[i]).trim();
    if (
      /^(?:I+\.?\s*)?(?:BẢNG\s+ĐÁP\s+ÁN|PHẦN\s+ĐÁP\s+ÁN|ĐÁP\s+ÁN\s+VÀ\s+(?:LỜI\s+GIẢI|HƯỚNG\s+DẪN)|ĐÁP\s+ÁN\s+THAM\s+KHẢO|ĐÁP\s+ÁN\s+ĐỀ\s+THI|ĐÁP\s+ÁN\s+CHẤM|ANSWER\s+KEY|ANSWERS|ĐÁP\s+ÁN)\s*[\:\-]?$/i.test(
        clean
      )
    ) {
      keySectionStart = i;
      break;
    }
  }

  const answerKeyMap = {};
  const explanationMap = {};

  if (keySectionStart === -1) {
    return { bodyText: text, answerKeyMap, explanationMap };
  }

  const bodyText = lines.slice(0, keySectionStart).join('\n');
  const keyCleanLines = lines
    .slice(keySectionStart + 1)
    .map(l => stripStyleTokens(l).trim())
    .filter(Boolean);
  const keyText = keyCleanLines.join('\n');

  // Pattern 1: "1.A 2.B 3-C 4:D 5A Câu 6: B"
  const pairRegex = /(?:Câu\s*)?(\d{1,3})\s*[\.\-\:\)\/]?\s*([A-F])\b/gi;
  let match;
  while ((match = pairRegex.exec(keyText)) !== null) {
    const num = parseInt(match[1], 10);
    const letter = match[2].toUpperCase();
    if (!answerKeyMap[num]) {
      answerKeyMap[num] = letter;
    }
  }

  // Pattern 2: Two-row aligned table ("1  2  3  4" on one line, "A  B  C  D" on next line)
  for (let i = 0; i < keyCleanLines.length - 1; i++) {
    const rowNums = keyCleanLines[i].replace(/^(?:Câu|STT)\s*/i, '').trim().split(/\s+/);
    const rowLets = keyCleanLines[i + 1].replace(/^(?:Đáp\s*án|Chọn)\s*/i, '').trim().split(/\s+/);
    if (
      rowNums.length >= 2 &&
      rowNums.length === rowLets.length &&
      rowNums.every(n => /^\d{1,3}$/.test(n)) &&
      rowLets.every(l => /^[A-F]$/i.test(l))
    ) {
      rowNums.forEach((n, idx) => {
        answerKeyMap[parseInt(n, 10)] = rowLets[idx].toUpperCase();
      });
    }
  }

  // Pattern 3: Detailed explanations per question in key section ("Câu 1: Chọn A. Vì...")
  for (const line of keyCleanLines) {
    const expMatch = line.match(
      /^(?:Câu\s*)?(\d{1,3})[\.\:\)]\s*(?:Chọn\s+|Đáp\s+án\s*)?([A-F])\b[\.\,\-\:\s]*(.*)$/i
    );
    if (expMatch) {
      const num = parseInt(expMatch[1], 10);
      answerKeyMap[num] = expMatch[2].toUpperCase();
      if (expMatch[3] && expMatch[3].trim()) {
        explanationMap[num] = expMatch[3].trim();
      }
    }
  }

  return { bodyText, answerKeyMap, explanationMap };
}

/**
 * Splits lines that have multiple options on the same row:
 * e.g. "A. Hà Nội    B. Huế    C. Đà Nẵng    D. TP.HCM"
 * Preserves style tokens around each split option!
 */
function expandInlineOptions(text) {
  const rawLines = text.split('\n');
  const resultLines = [];

  for (const rawLine of rawLines) {
    const line = rawLine.trim();
    if (!stripStyleTokens(line)) continue;

    // Split inline options separated by 2+ spaces or before B./C./D./E.
    const inlineSplit = line
      .replace(
        /(\S)\s{2,}(?=(?:⟦S:[^⟧]*⟧\s*)*(?:\*|\[x\]|✓|✔)?\s*[A-F]\s*\*?[\.\)\:]\s+)/g,
        '$1\n'
      )
      .replace(
        /(\S)\s+(?=(?:⟦S:[^⟧]*⟧\s*)*(?:\*|\[x\]|✓|✔)?\s*[B-F]\s*\*?[\.\)]\s+)/g,
        '$1\n'
      );

    const parts = inlineSplit.split('\n');
    for (const p of parts) {
      if (stripStyleTokens(p)) {
        resultLines.push(p.trim());
      }
    }
  }

  return resultLines;
}

/**
 * State machine to group lines into Question objects and run Relative Style Differential Analysis
 */
function parseLinesIntoQuestions(lines) {
  const questions = [];
  let currentQ = null;
  let currentOpt = null;
  let inExplanation = false;

  const questionHeaderRegex = /^(?:Câu\s+hỏi|Câu|Bài|Question|Q|Phần)\s*(\d+)\s*[\.\:\-\)\/]\s*(.*)$/i;
  const numberedQuestionRegex = /^(\d{1,3})\s*[\.\)\:]\s+(.+)$/;
  const cleanOptionRegex = /^(\*|\[x\]|\(x\)|✓|✔|->|=>|\s)*([A-F])\s*(\*)?[\.\)\:]\s*(.*)$/i;
  const markdownBoldOptRegex = /^\*\*([A-F])[\.\)\:]\s*(.*?)\*\*\s*(.*)$/i;
  const answerLineRegex = /^(?:Đáp\s*án(?:\s*đúng)?|Đ\/A|Chọn(?:\s*đáp\s*án)?|Answer|ANSWER|Key|ĐA|Kết\s*quả)\s*[\:\=\-\.]?\s*([A-F])\b/i;
  const explanationLineRegex = /^(?:Lời\s*giải|Giải\s*thích|Hướng\s*dẫn(?:\s*giải)?|HD|Explanation|Gợi\s*ý)\s*[\:\-]\s*(.*)$/i;

  const flushCurrent = () => {
    if (!currentQ) return;
    if (currentQ.options.length >= 2) {
      let resolvedOptions = resolveQuestionOptionsByDifferential(currentQ.options);

      // If an inline answer line ("Đáp án: B") was specified inside the question block, it takes precedence
      if (currentQ.inlineCorrectLetter) {
        resolvedOptions = resolvedOptions.map(o => ({
          ...o,
          isCorrect: o.label === currentQ.inlineCorrectLetter,
          answerSource:
            o.label === currentQ.inlineCorrectLetter ? 'Dòng Đáp án trong câu' : undefined
        }));
      }

      const winningOpt = resolvedOptions.find(o => o.isCorrect);

      questions.push({
        originalNumber: currentQ.originalNumber,
        question: stripStyleTokens(currentQ.question),
        options: resolvedOptions,
        explanation: stripStyleTokens(currentQ.explanation),
        answerSource: winningOpt?.answerSource
      });
    }
    currentQ = null;
    currentOpt = null;
    inExplanation = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const cleanLine = stripStyleTokens(rawLine);
    if (!cleanLine) continue;

    // 1. Check inline Answer key line ("Đáp án: B" or "ANSWER: C")
    const ansMatch = cleanLine.match(answerLineRegex);
    if (ansMatch && currentQ) {
      currentQ.inlineCorrectLetter = ansMatch[1].toUpperCase();
      continue;
    }

    // 2. Check Explanation line ("Lời giải: ...")
    const expMatch = cleanLine.match(explanationLineRegex);
    if (expMatch && currentQ) {
      inExplanation = true;
      currentOpt = null;
      if (expMatch[1]) {
        currentQ.explanation += (currentQ.explanation ? '\n' : '') + expMatch[1].trim();
      }
      continue;
    }

    // 3. Check Question Header ("Câu 1: ...", "Question 1: ...")
    const qHeaderMatch = cleanLine.match(questionHeaderRegex);
    if (qHeaderMatch) {
      flushCurrent();
      let qBody = qHeaderMatch[2].trim();
      // Check if inline "(Đáp án: B)" is embedded at the end of the question stem
      let inlineLetter = null;
      const stemAnsMatch = qBody.match(/\((?:Đáp\s*án|ĐA|Ans)\s*[\:\-]?\s*([A-F])\)\s*$/i);
      if (stemAnsMatch) {
        inlineLetter = stemAnsMatch[1].toUpperCase();
        qBody = qBody.replace(stemAnsMatch[0], '').trim();
      }

      currentQ = {
        originalNumber: parseInt(qHeaderMatch[1], 10),
        question: qBody,
        options: [],
        explanation: '',
        inlineCorrectLetter: inlineLetter
      };
      continue;
    }

    // 4. Check Option line ("A. ...", "*B. ...", "**C.** ...")
    const mdMatch = cleanLine.match(markdownBoldOptRegex);
    const optMatch = cleanLine.match(cleanOptionRegex);

    if (mdMatch || optMatch) {
      if (!currentQ && i > 0) {
        const prevClean = stripStyleTokens(lines[i - 1]);
        if (prevClean && !prevClean.match(cleanOptionRegex)) {
          currentQ = {
            originalNumber: questions.length + 1,
            question: prevClean,
            options: [],
            explanation: ''
          };
        }
      }

      if (currentQ) {
        inExplanation = false;
        if (mdMatch) {
          currentOpt = {
            rawLabel: mdMatch[1].toUpperCase(),
            rawFullLine: rawLine,
            cleanBodyText: `${mdMatch[2]} ${mdMatch[3]}`.trim(),
            isExplicitCorrect: true,
            explicitSource: 'In đậm Markdown (**)'
          };
        } else {
          const prefixPart = (optMatch[1] || '').trim();
          const letter = optMatch[2].toUpperCase();
          const starAfter = optMatch[3] || '';
          let bodyClean = optMatch[4] || '';

          const suffixCorrect = /(?:\(\s*đúng\s*\)|\(\s*correct\s*\)|\[\s*đ\s*\])\s*$/i.test(bodyClean);
          if (suffixCorrect) {
            bodyClean = bodyClean.replace(/(?:\(\s*đúng\s*\)|\(\s*correct\s*\)|\[\s*đ\s*\])\s*$/i, '').trim();
          }

          const hasExplicitMarker =
            prefixPart.includes('*') ||
            /\[x\]|\(x\)|✓|✔|->|=>/i.test(prefixPart) ||
            starAfter === '*' ||
            /^\s*\*/.test(bodyClean) ||
            suffixCorrect;

          currentOpt = {
            rawLabel: letter,
            rawFullLine: rawLine,
            cleanBodyText: bodyClean.replace(/^\s*\*\s*/, '').trim(),
            isExplicitCorrect: hasExplicitMarker,
            explicitSource: 'Ký hiệu đánh dấu (*)'
          };
        }
        currentQ.options.push(currentOpt);
        continue;
      }
    }

    // 5. Check Numbered Question ("1. Thủ đô của Việt Nam là gì?")
    const numMatch = cleanLine.match(numberedQuestionRegex);
    if (numMatch) {
      if (!currentQ || currentQ.options.length >= 2) {
        flushCurrent();
        currentQ = {
          originalNumber: parseInt(numMatch[1], 10),
          question: numMatch[2].trim(),
          options: [],
          explanation: ''
        };
        continue;
      }
    }

    // 6. Continuation line: append to explanation, current option, or question stem
    if (currentQ) {
      if (inExplanation) {
        currentQ.explanation += (currentQ.explanation ? '\n' : '') + cleanLine;
      } else if (currentOpt) {
        const nextClean = lines[i + 1] ? stripStyleTokens(lines[i + 1]) : '';
        if (currentQ.options.length >= 4 && cleanOptionRegex.test(nextClean)) {
          flushCurrent();
          currentQ = {
            originalNumber: questions.length + 1,
            question: cleanLine,
            options: [],
            explanation: ''
          };
        } else {
          currentOpt.rawFullLine += ' ' + rawLine;
          currentOpt.cleanBodyText += ' ' + cleanLine;
        }
      } else {
        currentQ.question += (currentQ.question ? '\n' : '') + cleanLine;
      }
    } else {
      const nextClean = lines[i + 1] ? stripStyleTokens(lines[i + 1]) : '';
      if (cleanOptionRegex.test(nextClean)) {
        currentQ = {
          originalNumber: questions.length + 1,
          question: cleanLine,
          options: [],
          explanation: ''
        };
      }
    }
  }

  flushCurrent();
  return questions;
}

function defaultOptions() {
  return [
    { label: 'A', text: 'Phương án A', isCorrect: true },
    { label: 'B', text: 'Phương án B', isCorrect: false },
    { label: 'C', text: 'Phương án C', isCorrect: false },
    { label: 'D', text: 'Phương án D', isCorrect: false }
  ];
}

export function finalizeParsedExam(title, questions, extraMeta = {}) {
  const normalizedQuestions = questions.map((q, idx) => {
    const winningOpt = q.options.find(o => o.isCorrect);
    return {
      ...q,
      id: q.id || `q-${Date.now()}-${idx}`,
      number: idx + 1,
      answerSource: q.answerSource || winningOpt?.answerSource || null,
      options: q.options.map((opt, oIdx) => ({
        ...opt,
        label: String.fromCharCode(65 + oIdx)
      }))
    };
  });

  const withAnswerCount = normalizedQuestions.filter(q =>
    q.options.some(o => o.isCorrect)
  ).length;
  const missingAnswerCount = normalizedQuestions.length - withAnswerCount;

  // Summarize how answers were detected
  const sourceBreakdown = {};
  normalizedQuestions.forEach(q => {
    if (q.answerSource) {
      sourceBreakdown[q.answerSource] = (sourceBreakdown[q.answerSource] || 0) + 1;
    }
  });

  return {
    id: `exam-${Date.now()}`,
    title: title || 'Đề thi trắc nghiệm',
    createdAt: new Date().toISOString(),
    questions: normalizedQuestions,
    stats: {
      total: normalizedQuestions.length,
      withAnswerCount,
      missingAnswerCount,
      autoSolvedCount: extraMeta.autoSolvedCount || 0,
      sourceBreakdown
    }
  };
}

/**
 * Shuffle exam questions and/or options to create a new Exam instance
 */
export function buildActiveExam(questions, config) {
  const {
    questionLimit = questions.length,
    shuffleQuestions = true,
    shuffleOptions = true,
    examCode = '101'
  } = config;

  let pool = questions.map(q => ({
    ...q,
    options: q.options.map(o => ({ ...o }))
  }));

  if (shuffleQuestions) {
    pool = fisherYatesShuffle(pool);
  }

  const limit = Math.min(Math.max(1, Number(questionLimit) || pool.length), pool.length);
  pool = pool.slice(0, limit);

  const finalQuestions = pool.map((q, idx) => {
    let opts = q.options.map(o => ({ ...o }));
    if (shuffleOptions) {
      opts = fisherYatesShuffle(opts);
    }
    opts = opts.map((o, oIdx) => ({
      ...o,
      label: String.fromCharCode(65 + oIdx)
    }));

    return {
      ...q,
      displayNumber: idx + 1,
      options: opts
    };
  });

  return {
    examCode,
    questions: finalQuestions
  };
}

function fisherYatesShuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
