/**
 * Multi-tier Automatic Answer Finder for Multiple-Choice Questions
 * When an uploaded exam file has NO marked answers (or partial answers),
 * this engine finds the most accurate answer for each question using:
 *   Tier 1: LLM AI API (Gemini / OpenAI / Compatible API if configured, or free endpoint)
 *   Tier 2: Live Wikipedia Knowledge Retrieval (vi.wikipedia.org & en.wikipedia.org CORS APIs)
 *   Tier 3: Math/Number/Base Evaluator + Offline Academic Knowledge & Structural Heuristics
 */

const AI_SETTINGS_KEY = 'autogen_exam_ai_settings_v1';

export function getAiSettings() {
  try {
    const raw = localStorage.getItem(AI_SETTINGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return {
    provider: 'auto', // 'auto' | 'gemini' | 'openai'
    apiKey: '',
    model: 'gemini-2.5-flash',
    autoSolveOnUpload: true
  };
}

export function saveAiSettings(settings) {
  try {
    localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

/**
 * Automatically find answers for all questions that are missing a correct answer
 * (or all questions if forceAll = true).
 * Calls onProgress(solvedCount, totalToSolve) as it progresses.
 */
export async function autoFindMissingAnswers(questions, { forceAll = false, onProgress } = {}) {
  const settings = getAiSettings();
  const targetIndices = [];

  questions.forEach((q, idx) => {
    const hasCorrect = q.options.some(o => o.isCorrect);
    if (forceAll || !hasCorrect) {
      targetIndices.push(idx);
    }
  });

  if (targetIndices.length === 0) {
    return questions;
  }

  const updated = questions.map(q => ({
    ...q,
    options: q.options.map(o => ({ ...o }))
  }));

  let completed = 0;
  const reportProgress = (inc = 1) => {
    completed = Math.min(targetIndices.length, completed + inc);
    if (onProgress) onProgress(completed, targetIndices.length);
  };

  // Tier 1: If user provided a Gemini or OpenAI API key, batch solve with LLM first
  let remainingIndices = [...targetIndices];

  if (settings.apiKey && settings.apiKey.trim()) {
    try {
      const batchSize = 10;
      const stillUnsolved = [];

      for (let i = 0; i < remainingIndices.length; i += batchSize) {
        const chunkIndices = remainingIndices.slice(i, i + batchSize);
        const chunkQuestions = chunkIndices.map(idx => updated[idx]);
        const aiResults = await solveBatchWithConfiguredLLM(chunkQuestions, settings);

        for (const qIdx of chunkIndices) {
          const q = updated[qIdx];
          const res = aiResults[q.id];
          if (res && res.letter) {
            applyAnswerToQuestion(q, res.letter, res.explanation, 'AI giải đề');
            reportProgress(1);
          } else {
            stillUnsolved.push(qIdx);
          }
        }
      }
      remainingIndices = stillUnsolved;
    } catch (err) {
      console.warn('Configured LLM fallback to Wiki/Heuristic solver:', err);
    }
  }

  // Tier 2 & Tier 3: For any remaining questions, run Math/Domain + Wikipedia Search + Structural Heuristic
  const concurrency = 4;
  for (let i = 0; i < remainingIndices.length; i += concurrency) {
    const slice = remainingIndices.slice(i, i + concurrency);
    await Promise.all(
      slice.map(async (qIdx) => {
        const q = updated[qIdx];
        const solved = await solveSingleQuestionSmart(q);
        applyAnswerToQuestion(q, solved.letter, solved.explanation, solved.method);
        reportProgress(1);
      })
    );
  }

  return updated;
}

function applyAnswerToQuestion(questionObj, letter, explanation, methodLabel) {
  const upper = (letter || 'A').toUpperCase();
  let matched = false;

  questionObj.options = questionObj.options.map((opt, idx) => {
    const optLabel = String.fromCharCode(65 + idx);
    const isMatch = optLabel === upper;
    if (isMatch) matched = true;
    return {
      ...opt,
      isCorrect: isMatch
    };
  });

  if (!matched && questionObj.options.length > 0) {
    questionObj.options[0].isCorrect = true;
  }

  questionObj.answerSource = methodLabel || 'Tự động tìm đáp án';
  if (explanation && !questionObj.explanation) {
    questionObj.explanation = explanation;
  }
}

/**
 * Solve a batch of questions using Gemini or OpenAI compatible API
 */
async function solveBatchWithConfiguredLLM(questionsChunk, settings) {
  const promptItems = questionsChunk.map((q, idx) => {
    const opts = q.options.map(o => `${o.label}. ${o.text}`).join('\n');
    return `ID: "${q.id}"\nCâu ${idx + 1}: ${q.question}\n${opts}`;
  }).join('\n\n---\n\n');

  const systemInstruction = `Bạn là chuyên gia giải đề thi trắc nghiệm đa lĩnh vực.
Hãy xác định đáp án đúng nhất (A, B, C, D...) và giải thích ngắn gọn (1-2 câu) cho từng câu hỏi.
Trả về đúng định dạng JSON thuần túy là một mảng:
[{"id": "...", "letter": "A", "explanation": "..."}]`;

  const apiKey = settings.apiKey.trim();
  const isGemini = settings.provider === 'gemini' || apiKey.startsWith('AIza');

  let rawJsonText = '';

  if (isGemini) {
    const model = settings.model || 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: `${systemInstruction}\n\n${promptItems}` }]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json'
        }
      })
    });
    if (!resp.ok) throw new Error(`Gemini API HTTP ${resp.status}`);
    const data = await resp.json();
    rawJsonText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
  } else {
    const url = 'https://api.openai.com/v1/chat/completions';
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: settings.model || 'gpt-4o-mini',
        temperature: 0.1,
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: promptItems }
        ]
      })
    });
    if (!resp.ok) throw new Error(`OpenAI API HTTP ${resp.status}`);
    const data = await resp.json();
    rawJsonText = data?.choices?.[0]?.message?.content || '[]';
  }

  const cleanJson = rawJsonText.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(cleanJson);
  const map = {};
  if (Array.isArray(parsed)) {
    for (const item of parsed) {
      if (item && item.id && item.letter) {
        map[item.id] = {
          letter: String(item.letter).trim().toUpperCase()[0],
          explanation: item.explanation || ''
        };
      }
    }
  }
  return map;
}

/**
 * Smart Single Question Solver combining:
 * 1. "All of the above" / Explicit self-indicating options
 * 2. Math & Base conversion evaluator
 * 3. Built-in Academic Knowledge Rules
 * 4. Live Wikipedia Search & Snippet Cross-Scoring (vi.wikipedia.org + en.wikipedia.org)
 * 5. Structural Option Analysis Fallback
 */
async function solveSingleQuestionSmart(q) {
  const stem = (q.question || '').trim();
  const options = q.options || [];
  if (options.length === 0) {
    return { letter: 'A', explanation: '', method: 'Mặc định' };
  }

  // Step 1: Check for Math / Arithmetic / Binary / Hex expressions
  const mathRes = trySolveMathQuestion(stem, options);
  if (mathRes) return mathRes;

  // Step 2: Check Built-in High-Frequency Exam Knowledge Patterns
  const domainRes = trySolveDomainKnowledge(stem, options);
  if (domainRes) return domainRes;

  // Step 3: Check "Tất cả các đáp án đều đúng" / "Cả A, B, C đều đúng" when appropriate
  const allOfAboveOpt = options.find(o =>
    /^(?:cả\s+a\s*,\s*b(?:\s*,\s*c)?\s*(?:và\s*c\s*)?đều\s+đúng|tất\s+cả\s+(?:các\s+)?(?:phương\s+án|đáp\s+án|ý)\s+(?:trên\s+)?đều\s+đúng|all\s+of\s+the\s+above)/i.test(
      o.text.trim()
    )
  );
  if (allOfAboveOpt) {
    return {
      letter: allOfAboveOpt.label,
      explanation: 'Phương án tổng hợp bao quát tất cả các mệnh đề đúng nêu trên.',
      method: 'Suy luận logic'
    };
  }

  // Step 4: Live Wikipedia Retrieval & Evidence Scoring
  try {
    const wikiRes = await trySolveViaWikipedia(stem, options);
    if (wikiRes && wikiRes.confidence >= 0.25) {
      return wikiRes;
    }
  } catch {
    // Ignore network errors and proceed to structural heuristic
  }

  // Step 5: Structural & Linguistic Heuristic Scoring
  return solveByStructuralHeuristics(stem, options);
}

/**
 * Step 1: Math & Calculation Solver
 */
function trySolveMathQuestion(stem, options) {
  // Detect simple arithmetic or power expressions like "2^10", "15 * 24", "100 / 4"
  const powerMatch = stem.match(/\b(\d{1,4})\s*\^\s*(\d{1,2})\b/);
  if (powerMatch) {
    const val = Math.pow(Number(powerMatch[1]), Number(powerMatch[2]));
    const hit = options.find(o => o.text.replace(/[\.,\s]/g, '').includes(String(val)));
    if (hit) {
      return {
        letter: hit.label,
        explanation: `Kết quả phép tính ${powerMatch[1]}^${powerMatch[2]} = ${val}.`,
        method: 'Tính toán tự động'
      };
    }
  }

  // Detect math expression before "= ?" or "bằng bao nhiêu"
  const exprMatch = stem.match(/([0-9]+(?:\s*[\+\-\*\/x\:]\s*[0-9]+)+)\s*(?:\=\s*\?|bằng\s+bao\s+nhiêu|có\s+giá\s+trị)/i);
  if (exprMatch) {
    try {
      const normalizedExpr = exprMatch[1].replace(/x/gi, '*').replace(/:/g, '/');
      if (/^[0-9\+\-\*\/\s\(\)\.]+$/.test(normalizedExpr)) {
        // eslint-disable-next-line no-new-func
        const val = Function(`"use strict"; return (${normalizedExpr});`)();
        const hit = options.find(o => Number(o.text.trim().replace(/,/g, '.')) === val);
        if (hit) {
          return {
            letter: hit.label,
            explanation: `Giá trị biểu thức ${exprMatch[1]} = ${val}.`,
            method: 'Tính toán tự động'
          };
        }
      }
    } catch {
      // ignore
    }
  }

  return null;
}

/**
 * Step 2: High-confidence domain knowledge matcher
 */
function trySolveDomainKnowledge(stem, options) {
  const s = stem.toLowerCase();

  const rules = [
    {
      test: () => s.includes('lifo') || s.includes('last in, first out') || s.includes('vào sau, ra trước'),
      matchOpt: o => /stack|ngăn xếp/i.test(o),
      exp: 'Ngăn xếp (Stack) hoạt động theo cơ chế LIFO (Last In, First Out).'
    },
    {
      test: () => s.includes('fifo') || s.includes('first in, first out') || s.includes('vào trước, ra trước'),
      matchOpt: o => /queue|hàng đợi/i.test(o),
      exp: 'Hàng đợi (Queue) hoạt động theo cơ chế FIFO (First In, First Out).'
    },
    {
      test: () => s.includes('tìm kiếm nhị phân') || s.includes('binary search'),
      matchOpt: o => /log\s*n/i.test(o) && !/n\s*log/i.test(o),
      exp: 'Tìm kiếm nhị phân có độ phức tạp thời gian trung bình và xấu nhất là O(log n).'
    },
    {
      test: () => s.includes('group by') && (s.includes('lọc') || s.includes('điều kiện')),
      matchOpt: o => /\bhaving\b/i.test(o),
      exp: 'Mệnh đề HAVING dùng để lọc dữ liệu sau khi đã gom nhóm bằng GROUP BY.'
    },
    {
      test: () => s.includes('cổng') && s.includes('443'),
      matchOpt: o => /\bhttps\b/i.test(o),
      exp: 'Giao thức HTTPS sử dụng cổng mặc định 443.'
    },
    {
      test: () => s.includes('cổng') && s.includes('80') && !s.includes('8080'),
      matchOpt: o => /\bhttp\b/i.test(o) && !/https/i.test(o),
      exp: 'Giao thức HTTP sử dụng cổng mặc định 80.'
    },
    {
      test: () => s.includes('không tìm thấy') && s.includes('http'),
      matchOpt: o => /\b404\b/.test(o),
      exp: 'Mã trạng thái HTTP 404 Not Found biểu thị không tìm thấy tài nguyên.'
    },
    {
      test: () => s.includes('giao vận') && s.includes('tin cậy'),
      matchOpt: o => /\btcp\b/i.test(o),
      exp: 'TCP là giao thức tầng Giao vận đảm bảo truyền dữ liệu tin cậy, hướng kết nối.'
    },
    {
      test: () => s.includes('khóa ngoại') || s.includes('foreign key'),
      matchOpt: o => /liên kết|toàn vẹn tham chiếu|tham chiếu/i.test(o),
      exp: 'Khóa ngoại (Foreign Key) dùng để liên kết và đảm bảo toàn vẹn tham chiếu giữa các bảng.'
    },
    {
      test: () => s.includes('xung nhịp') && s.includes('cpu'),
      matchOpt: o => /hz|gigahertz|megahertz/i.test(o),
      exp: 'Tốc độ xung nhịp CPU được đo bằng đơn vị Hertz (MHz, GHz).'
    },
    {
      test: () =>
        s.includes('chờ đợi lẫn nhau') ||
        (s.includes('tiến trình') && s.includes('chờ')) ||
        s.includes('bế tắc'),
      matchOpt: o => /deadlock|bế tắc/i.test(o),
      exp: 'Deadlock (Bế tắc) xảy ra khi các tiến trình chờ tài nguyên của nhau tạo thành vòng lặp.'
    },
    {
      test: () => (s.includes('ghi đè') || s.includes('override')) && (s.includes('oop') || s.includes('hướng đối tượng') || s.includes('lớp con')),
      matchOpt: o => /đa hình|polymorphism/i.test(o),
      exp: 'Tính đa hình (Polymorphism) cho phép lớp con định nghĩa lại (override) phương thức của lớp cha.'
    },
    {
      test: () => s.includes('chia để trị') || s.includes('divide and conquer'),
      matchOpt: o => /merge sort|quick sort|sắp xếp trộn|sắp xếp nhanh/i.test(o),
      exp: 'Merge Sort và Quick Sort là các thuật toán sắp xếp tiêu biểu theo chiến lược Chia để trị.'
    }
  ];

  for (const rule of rules) {
    if (rule.test()) {
      const hit = options.find(o => rule.matchOpt(o.text));
      if (hit) {
        return {
          letter: hit.label,
          explanation: rule.exp,
          method: 'Tri thức tích hợp'
        };
      }
    }
  }

  return null;
}

/**
 * Step 4: Wikipedia Live Knowledge Retrieval & Evidence Scoring
 */
async function trySolveViaWikipedia(stem, options) {
  const isNegativeQuestion = /\b(?:không\s+phải|không\s+đúng|sai|ngoại\s+trừ|trừ\s+trường\s+hợp|not\s+true|incorrect|except)\b/i.test(stem);

  // Clean question stem to form a focused search query (5-6 core keywords)
  const cleanQuery = stem
    .replace(/^(?:Câu\s*\d+|Question\s*\d+|\d+)[\.\:\)\-]\s*/i, '')
    .replace(
      /\b(?:là\s+gì|nào\s+sau\s+đây|nào\s+dưới\s+đây|được\s+gọi\s+là|trong\s+các\s+phương\s+án|hãy\s+chọn|đúng\s+nhất|phương\s+án\s+nào|cho\s+biết|khu\s+vực|lãnh\s+thổ|hiện\s+tượng|quá\s+trình|chảy\s+qua|nằm\s+ở|thuộc\s+về|dùng\s+để|có\s+tác\s+dụng|thường\s+được|tính\s+bằng|bao\s+nhiêu|nào)\b/gi,
      ' '
    )
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 6)
    .join(' ');

  if (cleanQuery.length < 3) return null;

  const wikiSnippets = await fetchWikiEvidence(cleanQuery, 'vi');
  const enSnippets = wikiSnippets.length === 0 ? await fetchWikiEvidence(cleanQuery, 'en') : [];
  const corpus = [...wikiSnippets, ...enSnippets].join(' ').toLowerCase();

  if (!corpus || corpus.length < 20) return null;

  const stemWords = new Set(
    stem
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 2)
  );

  const scores = options.map(opt => {
    const optClean = opt.text.toLowerCase().trim();
    if (!optClean) return 0;

    let score = 0;
    // Full option phrase match
    if (optClean.length >= 2 && corpus.includes(optClean)) {
      score += 6.0;
    }

    const allTokens = optClean
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter(t => t.length >= 2);

    const novelTokens = allTokens.filter(t => !stemWords.has(t));
    const novelPhrase = novelTokens.join(' ').trim();

    // Exact match of the novel phrase (e.g. "mê kông" after stripping "sông" which is in stem)
    if (novelPhrase.length >= 2 && corpus.includes(novelPhrase)) {
      score += 5.0;
    }

    const tokensToCheck = novelTokens.length > 0 ? novelTokens : allTokens;

    if (tokensToCheck.length > 0) {
      let matchedTokens = 0;
      for (const tok of tokensToCheck) {
        if (corpus.includes(tok)) matchedTokens++;
      }
      score += (matchedTokens / tokensToCheck.length) * 2.5;
    }

    return score;
  });

  const maxScore = Math.max(...scores);
  const minScore = Math.min(...scores);
  if (maxScore === 0) return null;

  const chosenIndex = isNegativeQuestion
    ? scores.indexOf(minScore)
    : scores.indexOf(maxScore);

  const chosenOpt = options[chosenIndex] || options[0];

  return {
    letter: chosenOpt.label,
    confidence: maxScore / 6.5,
    explanation: `Đối chiếu tự động từ cơ sở dữ liệu tri thức với nội dung câu hỏi.`,
    method: 'Tra cứu tri thức'
  };
}

async function fetchWikiEvidence(query, lang = 'vi') {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3200);
  try {
    const url = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
      query
    )}&srlimit=6&format=json&origin=*`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return [];
    const data = await res.json();
    const items = data?.query?.search || [];
    return items.map(it =>
      `${it.title} ${(it.snippet || '').replace(/<[^>]+>/g, ' ')}`
    );
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Step 5: Structural & Linguistic Heuristics when offline or specialized question
 */
function solveByStructuralHeuristics(stem, options) {
  const stemTokens = new Set(
    stem
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3)
  );

  // Score options based on:
  // 1. Informative specificity & balanced length (correct answers in teacher-authored MCQs are often more specific/detailed)
  // 2. Semantic overlap with stem keywords
  // 3. Penalty for extreme absolutes ("luôn luôn", "tuyệt đối không bao giờ")
  const lengths = options.map(o => o.text.trim().length);
  const avgLen = lengths.reduce((a, b) => a + b, 0) / (lengths.length || 1);

  let bestIdx = 0;
  let bestScore = -Infinity;

  options.forEach((opt, idx) => {
    const text = opt.text.trim();
    const lower = text.toLowerCase();
    let score = 0;

    // Specificity bonus
    if (text.length >= avgLen) {
      score += 1.2;
    }

    // Keyword overlap with stem
    const words = lower.replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/);
    for (const w of words) {
      if (stemTokens.has(w)) score += 0.8;
    }

    // Bonus for explanatory qualifiers ("bao gồm", "đảm bảo", "thông qua", "cho phép")
    if (/\b(?:đảm bảo|thông qua|cho phép|kết hợp|bao gồm|xác định|tương ứng)\b/i.test(lower)) {
      score += 1.5;
    }

    // Penalty for overly absolute distractors
    if (/\b(?:chỉ\s+duy\s+nhất|tuyệt\s+đối\s+không|không\s+bao\s+giờ\s+có\s+thể)\b/i.test(lower)) {
      score -= 1.5;
    }

    if (score > bestScore) {
      bestScore = score;
      bestIdx = idx;
    }
  });

  return {
    letter: options[bestIdx]?.label || 'A',
    explanation: 'Đáp án được gợi ý tự động dựa trên phân tích cấu trúc câu hỏi (Bạn có thể kiểm tra và nhấp chọn lại nếu cần).',
    method: 'Tự động suy luận'
  };
}
