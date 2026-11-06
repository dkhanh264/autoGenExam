import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import * as pdfjsModule from 'pdfjs-dist';

const pdfjsLib = pdfjsModule.default || pdfjsModule;

// Configure PDF.js worker using CDN/local fallback safe for Vite
try {
  if (pdfjsLib?.GlobalWorkerOptions) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.js',
      import.meta.url
    ).toString();
  }
} catch {
  if (pdfjsLib?.GlobalWorkerOptions) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '3.11.174'}/pdf.worker.min.js`;
  }
}

const MARK_OPEN = '⟦MARK⟧';
const MARK_CLOSE = '⟦/MARK⟧';

function stripMarks(str = '') {
  return str.replace(/⟦\/?MARK⟧/g, '').trim();
}

function hasMark(str = '') {
  return str.includes(MARK_OPEN);
}

/**
 * Entry point: Parse any uploaded File into a structured exam object
 * Returns { title, questions: [{ id, number, question, options: [{ label, text, isCorrect }], explanation }], warnings: [], stats: {} }
 */
export async function parseExamFile(file) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  const baseTitle = file.name.replace(/\.[^/.]+$/, '');

  if (ext === 'json') {
    const text = await file.text();
    return parseJsonExam(text, baseTitle);
  }

  if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
    const buffer = await file.arrayBuffer();
    return parseSpreadsheetExam(buffer, baseTitle);
  }

  if (ext === 'docx') {
    const buffer = await file.arrayBuffer();
    const rawText = await extractDocxTextWithMarks(buffer);
    return parseStructuredTextExam(rawText, baseTitle);
  }

  if (ext === 'pdf') {
    const buffer = await file.arrayBuffer();
    const rawText = await extractPdfText(buffer);
    return parseStructuredTextExam(rawText, baseTitle);
  }

  // Default: .txt, .md, etc.
  const text = await file.text();
  return parseStructuredTextExam(text, baseTitle);
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
        return {
          label,
          text: opt,
          isCorrect: q.correctAnswer === label || q.correctIndex === oIdx
        };
      }
      return {
        label,
        text: opt.text || '',
        isCorrect: Boolean(opt.isCorrect || q.correctAnswer === label)
      };
    });
    return {
      id: q.id || `q-${Date.now()}-${idx}`,
      number: idx + 1,
      question: q.question || q.text || `Câu hỏi ${idx + 1}`,
      options: options.length >= 2 ? options : defaultOptions(),
      explanation: q.explanation || ''
    };
  });

  return finalizeParsedExam(data.title || fallbackTitle, questions);
}

/**
 * Parse Excel (.xlsx, .xls) or CSV (.csv)
 */
function parseSpreadsheetExam(arrayBuffer, fallbackTitle) {
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  const nonEmptyRows = rows.filter(r => r.some(cell => String(cell).trim() !== ''));
  if (nonEmptyRows.length === 0) {
    return finalizeParsedExam(fallbackTitle, []);
  }

  // Detect if row 0 is a header row
  const firstRow = nonEmptyRows[0].map(c => String(c).trim().toLowerCase());
  const isHeader = firstRow.some(h =>
    h.includes('câu hỏi') ||
    h.includes('nội dung') ||
    h.includes('question') ||
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
    const ansCol = firstRow.findIndex(h => h.includes('đáp án đúng') || h === 'đáp án' || h.includes('correct') || h === 'answer' || h === 'key');
    const expCol = firstRow.findIndex(h => h.includes('giải thích') || h.includes('lời giải') || h.includes('hướng dẫn') || h.includes('explanation'));

    // If first column is STT / Số thứ tự and second is question
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
    // Check if column 0 is just sequential numbers (1, 2, 3...)
    const firstColIsIndex = nonEmptyRows.slice(0, 5).every((r, idx) => {
      const val = String(r[0]).trim();
      return /^\d+$/.test(val) || /^câu\s*\d+$/i.test(val);
    }) && nonEmptyRows[0].length >= 6;

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
  for (let i = startRow; i < nonEmptyRows.length; i++) {
    const row = nonEmptyRows[i];
    const qText = String(row[colMap.question] ?? '').trim();
    if (!qText) continue;

    const rawOpts = colMap.options
      .map(colIdx => String(row[colIdx] ?? '').trim())
      .filter(val => val !== '');

    if (rawOpts.length === 0) continue;

    const rawCorrect = String(row[colMap.correct] ?? '').trim();
    const explanation = String(row[colMap.explanation] ?? '').trim();

    const options = rawOpts.map((optText, idx) => {
      const label = String.fromCharCode(65 + idx);
      const cleanOpt = optText.replace(/^\*?\s*[A-F][\.\)\:]\s*/i, '').trim();
      const startsWithStar = /^\*/.test(optText.trim());
      const isCorrect =
        startsWithStar ||
        isMatchingCorrectAnswer(rawCorrect, label, idx, cleanOpt);

      return {
        label,
        text: cleanOpt,
        isCorrect
      };
    });

    questions.push({
      id: `q-${Date.now()}-${questions.length}`,
      number: questions.length + 1,
      question: qText.replace(/^(?:Câu\s*\d+|Question\s*\d+|\d+)[\.\:\)\-]\s*/i, '').trim() || qText,
      options,
      explanation
    });
  }

  return finalizeParsedExam(fallbackTitle, questions);
}

function isMatchingCorrectAnswer(rawCorrect, label, idx, cleanOptText) {
  if (!rawCorrect) return false;
  const norm = rawCorrect.trim().toUpperCase();
  if (norm === label) return true;
  if (norm === String(idx + 1)) return true;
  const letterMatch = norm.match(/^(?:ĐÁP ÁN|PHƯƠNG ÁN|CHỌN|OPTION)?\s*([A-F])$/i);
  if (letterMatch && letterMatch[1].toUpperCase() === label) return true;
  if (cleanOptText && rawCorrect.trim().toLowerCase() === cleanOptText.toLowerCase()) return true;
  return false;
}

/**
 * Extract text from .docx with formatting markers (underline, highlight, color, bold option letters)
 */
async function extractDocxTextWithMarks(arrayBuffer) {
  const zip = await JSZip.loadAsync(arrayBuffer);
  const docFile = zip.file('word/document.xml');
  if (!docFile) {
    throw new Error('File .docx không hợp lệ hoặc bị hỏng.');
  }

  const xmlText = await docFile.async('string');
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'application/xml');

  const lines = [];
  const body = xmlDoc.getElementsByTagName('w:body')[0];
  if (!body) return '';

  const paragraphs = Array.from(body.getElementsByTagName('w:p'));

  for (const p of paragraphs) {
    let pText = '';
    const children = Array.from(p.childNodes);

    for (const node of children) {
      if (node.nodeName === 'w:r') {
        const { text, marked } = extractRunTextAndStyle(node);
        if (text) {
          pText += marked ? `${MARK_OPEN}${text}${MARK_CLOSE}` : text;
        }
      } else if (node.nodeName === 'w:hyperlink') {
        const innerRuns = Array.from(node.getElementsByTagName('w:r'));
        for (const r of innerRuns) {
          const { text, marked } = extractRunTextAndStyle(r);
          if (text) {
            pText += marked ? `${MARK_OPEN}${text}${MARK_CLOSE}` : text;
          }
        }
      }
    }

    // Merge adjacent mark tags
    pText = pText.replace(new RegExp(`${MARK_CLOSE}${MARK_OPEN}`, 'g'), '');
    if (pText.trim()) {
      lines.push(pText);
    }
  }

  return lines.join('\n');
}

function extractRunTextAndStyle(rNode) {
  let text = '';
  const rPr = rNode.getElementsByTagName('w:rPr')[0];
  let marked = false;

  if (rPr) {
    const uNode = rPr.getElementsByTagName('w:u')[0];
    if (uNode) {
      const uVal = uNode.getAttribute('w:val');
      if (!uVal || uVal !== 'none') marked = true;
    }

    const highlightNode = rPr.getElementsByTagName('w:highlight')[0];
    if (highlightNode) {
      const hVal = highlightNode.getAttribute('w:val');
      if (hVal && hVal !== 'none') marked = true;
    }

    const colorNode = rPr.getElementsByTagName('w:color')[0];
    if (colorNode) {
      const cVal = (colorNode.getAttribute('w:val') || '').toUpperCase();
      if (
        cVal &&
        cVal !== 'AUTO' &&
        cVal !== '000000' &&
        cVal !== '111111' &&
        cVal !== '222222' &&
        cVal !== '333333'
      ) {
        marked = true;
      }
    }
  }

  for (const child of Array.from(rNode.childNodes)) {
    if (child.nodeName === 'w:t') {
      text += child.textContent || '';
    } else if (child.nodeName === 'w:tab') {
      text += '    ';
    } else if (child.nodeName === 'w:br' || child.nodeName === 'w:cr') {
      text += '\n';
    }
  }

  return { text, marked };
}

/**
 * Extract text from PDF preserving visual lines
 */
async function extractPdfText(arrayBuffer) {
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const allLines = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();

    // Group items by approximate Y coordinate
    const rowBuckets = [];
    const tolerance = 3.5;

    for (const item of content.items) {
      if (!item.str) continue;
      const x = item.transform[4];
      const y = item.transform[5];

      let bucket = rowBuckets.find(b => Math.abs(b.y - y) <= tolerance);
      if (!bucket) {
        bucket = { y, items: [] };
        rowBuckets.push(bucket);
      }
      bucket.items.push({ x, str: item.str });
    }

    // Sort top-to-bottom (higher Y is higher on PDF page)
    rowBuckets.sort((a, b) => b.y - a.y);

    for (const bucket of rowBuckets) {
      bucket.items.sort((a, b) => a.x - b.x);
      let lineStr = '';
      let prevX = null;
      for (const it of bucket.items) {
        if (prevX !== null && it.x - prevX > 25) {
          lineStr += '    ';
        } else if (prevX !== null && !lineStr.endsWith(' ') && !it.str.startsWith(' ')) {
          lineStr += ' ';
        }
        lineStr += it.str;
        prevX = it.x + it.str.length * 4;
      }
      if (lineStr.trim()) {
        allLines.push(lineStr.trim());
      }
    }
  }

  return allLines.join('\n');
}

/**
 * Parse structured or semi-structured text (Azota style, Aiken style, Vietnamese school exam style)
 */
export function parseStructuredTextExam(rawText, fallbackTitle = 'Đề thi mới') {
  if (!rawText || !rawText.trim()) {
    return finalizeParsedExam(fallbackTitle, []);
  }

  // Normalize line endings
  const normalized = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 1. Separate end-of-file Answer Key section if present ("BẢNG ĐÁP ÁN", "ĐÁP ÁN - THANG ĐIỂM", "PHẦN ĐÁP ÁN")
  const { bodyText, answerKeyMap, explanationMap } = splitBodyAndAnswerKey(normalized);

  // 2. Expand inline options onto separate logical lines for clean parsing
  const expandedLines = expandInlineOptions(bodyText);

  // 3. Group lines into question blocks
  const rawQuestions = parseLinesIntoQuestions(expandedLines);

  // 4. Apply end-of-file answer keys and explanations
  const finalQuestions = rawQuestions.map((q, idx) => {
    const qNum = q.originalNumber || idx + 1;
    const keyLetter = answerKeyMap[qNum] || answerKeyMap[idx + 1];
    const hasAnyCorrect = q.options.some(o => o.isCorrect);

    const updatedOptions = q.options.map((opt, oIdx) => {
      const label = String.fromCharCode(65 + oIdx);
      const matchesKey = keyLetter && label === keyLetter.toUpperCase();
      return {
        label,
        text: opt.text,
        isCorrect: hasAnyCorrect ? opt.isCorrect : Boolean(matchesKey)
      };
    });

    return {
      id: `q-${Date.now()}-${idx}`,
      number: idx + 1,
      question: q.question,
      options: updatedOptions,
      explanation: q.explanation || explanationMap[qNum] || explanationMap[idx + 1] || ''
    };
  });

  return finalizeParsedExam(fallbackTitle, finalQuestions);
}

/**
 * Detect and extract end-of-file Answer Key section ("BẢNG ĐÁP ÁN", "ĐÁP ÁN:")
 */
function splitBodyAndAnswerKey(text) {
  const lines = text.split('\n');
  let keySectionStart = -1;

  for (let i = lines.length - 1; i >= 0; i--) {
    const clean = stripMarks(lines[i]).trim();
    if (/^(?:BẢNG\s+ĐÁP\s+ÁN|PHẦN\s+ĐÁP\s+ÁN|ĐÁP\s+ÁN\s+VÀ\s+LỜI\s+GIẢI|ĐÁP\s+ÁN\s+THAM\s+KHẢO|ĐÁP\s+ÁN\s+ĐỀ\s+THI|ANSWER\s+KEY|ĐÁP\s+ÁN)$/i.test(clean)) {
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
  const keyText = stripMarks(lines.slice(keySectionStart + 1).join('\n'));

  // Pattern 1: "1.A 2.B 3-C 4:D 5A Câu 6: B"
  const pairRegex = /(?:Câu\s*)?(\d{1,3})\s*[\.\-\:\)]?\s*([A-F])\b/gi;
  let match;
  while ((match = pairRegex.exec(keyText)) !== null) {
    const num = parseInt(match[1], 10);
    const letter = match[2].toUpperCase();
    if (!answerKeyMap[num]) {
      answerKeyMap[num] = letter;
    }
  }

  // Pattern 2: Detailed explanations per question in key section ("Câu 1: Chọn A. Vì...")
  const keyLines = keyText.split('\n');
  for (const line of keyLines) {
    const expMatch = line.match(/^(?:Câu\s*)?(\d{1,3})[\.\:\)]\s*(?:Chọn\s+|Đáp\s+án\s*)?([A-F])\b[\.\,\-\:\s]*(.*)$/i);
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
 */
function expandInlineOptions(text) {
  const rawLines = text.split('\n');
  const resultLines = [];

  for (const rawLine of rawLines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Split inline options separated by at least 2 spaces or tab or preceding option
    // Matches boundary before (* or ⟦MARK⟧)? A. / B. / C. / D. / E.
    const inlineSplit = line.replace(
      /(\S)\s{2,}(?=(?:\*|\⟦MARK\⟧\s*)*[A-F][\.\)\:]\s+)/g,
      '$1\n'
    ).replace(
      /(\S)\s+(?=(?:\*|\⟦MARK\⟧\s*)*[B-F][\.\)]\s+)/g,
      '$1\n'
    );

    const parts = inlineSplit.split('\n');
    for (const p of parts) {
      if (p.trim()) resultLines.push(p.trim());
    }
  }

  return resultLines;
}

/**
 * State machine to group lines into Question objects
 */
function parseLinesIntoQuestions(lines) {
  const questions = [];
  let currentQ = null;
  let currentOpt = null;
  let inExplanation = false;

  const questionHeaderRegex = /^(?:⟦MARK⟧\s*)*(?:Câu\s+hỏi|Câu|Bài|Question|Q)\s*(\d+)\s*[\.\:\-\)\/]\s*(.*)$/i;
  const numberedQuestionRegex = /^(?:⟦MARK⟧\s*)*(\d{1,3})\s*[\.\)\:]\s+(.+)$/;
  const optionLineRegex = /^(\*|⟦MARK⟧|\s)*([A-F])\s*(\*)?[\.\)\:]\s*(.*)$/i;
  const htmlUnderlineOptRegex = /^<(?:u|b|strong|mark)>\s*([A-F])[\.\)\:]\s*(.*?)<\/(?:u|b|strong|mark)>\s*(.*)$/i;
  const markdownBoldOptRegex = /^\*\*([A-F])[\.\)\:]\s*(.*?)\*\*\s*(.*)$/i;
  const answerLineRegex = /^(?:Đáp\s*án(?:\s*đúng)?|Đ\/A|Chọn|Answer|ANSWER|Key|ĐA)\s*[\:\=\-]?\s*([A-F])\b/i;
  const explanationLineRegex = /^(?:Lời\s*giải|Giải\s*thích|Hướng\s*dẫn(?:\s*giải)?|HD|Explanation|Gợi\s*ý)\s*[\:\-]\s*(.*)$/i;

  const flushCurrent = () => {
    if (!currentQ) return;
    if (currentQ.options.length >= 2) {
      // Determine marked options from DOCX formatting marks
      const markedCount = currentQ.options.filter(o => o.hasDocxMark).length;
      const anyExplicitCorrect = currentQ.options.some(o => o.isCorrect);

      currentQ.options = currentQ.options.map((opt, idx) => ({
        label: String.fromCharCode(65 + idx),
        text: stripMarks(opt.text),
        isCorrect: anyExplicitCorrect
          ? opt.isCorrect
          : (markedCount === 1 ? opt.hasDocxMark : false)
      }));

      currentQ.question = stripMarks(currentQ.question);
      currentQ.explanation = stripMarks(currentQ.explanation);
      questions.push(currentQ);
    }
    currentQ = null;
    currentOpt = null;
    inExplanation = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const cleanLine = stripMarks(rawLine);

    // 1. Check inline Answer key line ("Đáp án: B" or "ANSWER: C")
    const ansMatch = cleanLine.match(answerLineRegex);
    if (ansMatch && currentQ) {
      const targetLetter = ansMatch[1].toUpperCase();
      currentQ.options.forEach((opt, idx) => {
        const label = String.fromCharCode(65 + idx);
        if (label === targetLetter) opt.isCorrect = true;
      });
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
      currentQ = {
        originalNumber: parseInt(qHeaderMatch[1], 10),
        question: qHeaderMatch[2].trim(),
        options: [],
        explanation: ''
      };
      continue;
    }

    // 4. Check Option line ("A. ...", "*B. ...", "**C.** ...")
    const htmlMatch = cleanLine.match(htmlUnderlineOptRegex);
    const mdMatch = cleanLine.match(markdownBoldOptRegex);
    const optMatch = rawLine.match(optionLineRegex);

    if (htmlMatch || mdMatch || optMatch) {
      // If we don't have a currentQ yet, maybe the previous unnumbered line was the question stem!
      if (!currentQ && i > 0) {
        const prevClean = stripMarks(lines[i - 1]);
        if (prevClean && !prevClean.match(optionLineRegex)) {
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
        if (htmlMatch) {
          currentOpt = {
            rawLabel: htmlMatch[1].toUpperCase(),
            text: `${htmlMatch[2]} ${htmlMatch[3]}`.trim(),
            isCorrect: true,
            hasDocxMark: true
          };
        } else if (mdMatch) {
          currentOpt = {
            rawLabel: mdMatch[1].toUpperCase(),
            text: `${mdMatch[2]} ${mdMatch[3]}`.trim(),
            isCorrect: true,
            hasDocxMark: true
          };
        } else {
          const prefixPart = optMatch[1] || '';
          const letter = optMatch[2].toUpperCase();
          const starAfter = optMatch[3] || '';
          const bodyPart = optMatch[4] || '';

          // Check if option has * or [x] or DOCX mark
          const hasStar = prefixPart.includes('*') || starAfter === '*' || /^\s*\*/.test(bodyPart);
          const docxMarked = hasMark(prefixPart) || hasMark(rawLine);

          currentOpt = {
            rawLabel: letter,
            text: bodyPart.replace(/^\s*\*\s*/, '').trim(),
            isCorrect: hasStar,
            hasDocxMark: docxMarked
          };
        }
        currentQ.options.push(currentOpt);
        continue;
      }
    }

    // 5. Check Numbered Question ("1. Thủ đô của Việt Nam là gì?")
    const numMatch = cleanLine.match(numberedQuestionRegex);
    if (numMatch) {
      // Start a new question if currentQ already has options or doesn't exist
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
        // Wait: if currentQ already has 4 options and this line looks like a new unnumbered question (Aiken format), check next line!
        const nextLine = lines[i + 1] ? stripMarks(lines[i + 1]) : '';
        if (currentQ.options.length >= 4 && optionLineRegex.test(nextLine)) {
          flushCurrent();
          currentQ = {
            originalNumber: questions.length + 1,
            question: cleanLine,
            options: [],
            explanation: ''
          };
        } else {
          currentOpt.text += ' ' + cleanLine;
        }
      } else {
        currentQ.question += (currentQ.question ? '\n' : '') + cleanLine;
      }
    } else {
      // Check if next line is Option A (Aiken format where questions have no number prefix)
      const nextLine = lines[i + 1] || '';
      if (optionLineRegex.test(nextLine)) {
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

export function finalizeParsedExam(title, questions) {
  const normalizedQuestions = questions.map((q, idx) => ({
    ...q,
    id: q.id || `q-${Date.now()}-${idx}`,
    number: idx + 1,
    options: q.options.map((opt, oIdx) => ({
      ...opt,
      label: String.fromCharCode(65 + oIdx)
    }))
  }));

  const withAnswerCount = normalizedQuestions.filter(q =>
    q.options.some(o => o.isCorrect)
  ).length;
  const missingAnswerCount = normalizedQuestions.length - withAnswerCount;

  const warnings = [];
  if (normalizedQuestions.length === 0) {
    warnings.push('Không tìm thấy câu hỏi trắc nghiệm nào khớp định dạng. Vui lòng kiểm tra lại cấu trúc file (Câu 1: ... A. ... B. ... C. ... D. ...).');
  } else if (missingAnswerCount > 0) {
    warnings.push(`Có ${missingAnswerCount}/${normalizedQuestions.length} câu hỏi chưa được đánh dấu đáp án đúng. Bạn có thể nhấp trực tiếp vào phương án A, B, C, D bên dưới để chọn đáp án đúng.`);
  }

  return {
    id: `exam-${Date.now()}`,
    title: title || 'Đề thi trắc nghiệm',
    createdAt: new Date().toISOString(),
    questions: normalizedQuestions,
    warnings,
    stats: {
      total: normalizedQuestions.length,
      withAnswerCount,
      missingAnswerCount
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
