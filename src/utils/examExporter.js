import JSZip from 'jszip';
import * as XLSX from 'xlsx';

export const SAMPLE_QUESTIONS = [
  {
    id: 'sample-1',
    number: 1,
    question: 'Trong kiến trúc mạng máy tính TCP/IP, giao thức nào hoạt động ở tầng Giao vận (Transport Layer) và đảm bảo truyền dữ liệu tin cậy, có kết nối?',
    options: [
      { label: 'A', text: 'UDP (User Datagram Protocol)', isCorrect: false },
      { label: 'B', text: 'TCP (Transmission Control Protocol)', isCorrect: true },
      { label: 'C', text: 'ICMP (Internet Control Message Protocol)', isCorrect: false },
      { label: 'D', text: 'ARP (Address Resolution Protocol)', isCorrect: false }
    ],
    explanation: 'TCP là giao thức hướng kết nối (connection-oriented), đảm bảo truyền dữ liệu tin cậy thông qua cơ chế bắt tay 3 bước (3-way handshake), kiểm soát luồng và truyền lại gói tin lỗi.'
  },
  {
    id: 'sample-2',
    number: 2,
    question: 'Cấu trúc dữ liệu nào hoạt động theo nguyên tắc LIFO (Last In, First Out — Vào sau, Ra trước)?',
    options: [
      { label: 'A', text: 'Hàng đợi (Queue)', isCorrect: false },
      { label: 'B', text: 'Danh sách liên kết đơn (Singly Linked List)', isCorrect: false },
      { label: 'C', text: 'Ngăn xếp (Stack)', isCorrect: true },
      { label: 'D', text: 'Cây nhị phân tìm kiếm (Binary Search Tree)', isCorrect: false }
    ],
    explanation: 'Ngăn xếp (Stack) tuân theo nguyên lý LIFO: phần tử được đưa vào cuối cùng (push) sẽ là phần tử đầu tiên được lấy ra (pop).'
  },
  {
    id: 'sample-3',
    number: 3,
    question: 'Độ phức tạp thời gian trung bình của thuật toán Tìm kiếm nhị phân (Binary Search) trên mảng đã sắp xếp có n phần tử là bao nhiêu?',
    options: [
      { label: 'A', text: 'O(n)', isCorrect: false },
      { label: 'B', text: 'O(log n)', isCorrect: true },
      { label: 'C', text: 'O(n log n)', isCorrect: false },
      { label: 'D', text: 'O(1)', isCorrect: false }
    ],
    explanation: 'Mỗi bước tìm kiếm nhị phân chia đôi không gian tìm kiếm, do đó số phép so sánh tối đa tỷ lệ với log2(n), tức O(log n).'
  },
  {
    id: 'sample-4',
    number: 4,
    question: 'Trong cơ sở dữ liệu quan hệ (SQL), câu lệnh nào dùng để lọc các nhóm dữ liệu sau khi đã gom nhóm bằng mệnh đề GROUP BY?',
    options: [
      { label: 'A', text: 'WHERE', isCorrect: false },
      { label: 'B', text: 'ORDER BY', isCorrect: false },
      { label: 'C', text: 'DISTINCT', isCorrect: false },
      { label: 'D', text: 'HAVING', isCorrect: true }
    ],
    explanation: 'WHERE lọc từng bản ghi trước khi gom nhóm (GROUP BY), còn HAVING dùng để đặt điều kiện lọc trên các nhóm dữ liệu đã tổng hợp.'
  },
  {
    id: 'sample-5',
    number: 5,
    question: 'Mã trạng thái HTTP (HTTP Status Code) nào biểu thị lỗi "Không tìm thấy tài nguyên yêu cầu trên máy chủ" (Not Found)?',
    options: [
      { label: 'A', text: '404 Not Found', isCorrect: true },
      { label: 'B', text: '401 Unauthorized', isCorrect: false },
      { label: 'C', text: '500 Internal Server Error', isCorrect: false },
      { label: 'D', text: '403 Forbidden', isCorrect: false }
    ],
    explanation: 'Mã 404 Not Found cho biết máy chủ không tìm thấy tài nguyên theo đường dẫn URI mà trình duyệt yêu cầu.'
  },
  {
    id: 'sample-6',
    number: 6,
    question: 'Trong hệ điều hành, hiện tượng hai hay nhiều tiến trình chờ đợi lẫn nhau giải phóng tài nguyên dẫn đến không tiến trình nào có thể tiếp tục thực thi được gọi là gì?',
    options: [
      { label: 'A', text: 'Phân mảnh bộ nhớ (Fragmentation)', isCorrect: false },
      { label: 'B', text: 'Đói tài nguyên (Starvation)', isCorrect: false },
      { label: 'C', text: 'Bế tắc (Deadlock)', isCorrect: true },
      { label: 'D', text: 'Chuyển ngữ cảnh (Context Switch)', isCorrect: false }
    ],
    explanation: 'Deadlock (Bế tắc) xảy ra khi các tiến trình giữ tài nguyên và chờ tài nguyên đang bị tiến trình khác nắm giữ theo chu trình khép kín.'
  },
  {
    id: 'sample-7',
    number: 7,
    question: 'Trong lập trình hướng đối tượng (OOP), tính chất nào cho phép một lớp con định nghĩa lại (override) phương thức đã có ở lớp cha?',
    options: [
      { label: 'A', text: 'Tính đóng gói (Encapsulation)', isCorrect: false },
      { label: 'B', text: 'Tính đa hình (Polymorphism)', isCorrect: true },
      { label: 'C', text: 'Tính trừu tượng (Abstraction)', isCorrect: false },
      { label: 'D', text: 'Tính tuần tự (Serialization)', isCorrect: false }
    ],
    explanation: 'Tính đa hình (Polymorphism) thông qua cơ chế ghi đè (Method Overriding) cho phép đối tượng thuộc lớp con thực thi hành vi riêng khi gọi cùng một tên phương thức của lớp cha.'
  },
  {
    id: 'sample-8',
    number: 8,
    question: 'Chuẩn mã hóa ký tự nào hiện nay được sử dụng phổ biến nhất trên Web để biểu diễn đầy đủ tiếng Việt và đa ngôn ngữ?',
    options: [
      { label: 'A', text: 'ASCII 7-bit', isCorrect: false },
      { label: 'B', text: 'ISO-8859-1', isCorrect: false },
      { label: 'C', text: 'Windows-1252', isCorrect: false },
      { label: 'D', text: 'UTF-8 (Unicode)', isCorrect: true }
    ],
    explanation: 'UTF-8 là bảng mã độ dài thay đổi (1 đến 4 byte) tương thích ngược với ASCII và biểu diễn được toàn bộ ký tự Unicode bao gồm tiếng Việt.'
  },
  {
    id: 'sample-9',
    number: 9,
    question: 'Trong ngôn ngữ JavaScript, phương thức mảng nào trả về một mảng mới chỉ chứa các phần tử thỏa mãn điều kiện kiểm tra?',
    options: [
      { label: 'A', text: 'Array.prototype.map()', isCorrect: false },
      { label: 'B', text: 'Array.prototype.filter()', isCorrect: true },
      { label: 'C', text: 'Array.prototype.forEach()', isCorrect: false },
      { label: 'D', text: 'Array.prototype.reduce()', isCorrect: false }
    ],
    explanation: 'Phương thức filter() duyệt qua mảng và trả về mảng mới gồm các phần tử mà hàm callback trả về giá trị truthy.'
  },
  {
    id: 'sample-10',
    number: 10,
    question: 'Thuật toán sắp xếp nào sau đây hoạt động theo chiến lược Chia để trị (Divide and Conquer)?',
    options: [
      { label: 'A', text: 'Sắp xếp nổi bọt (Bubble Sort)', isCorrect: false },
      { label: 'B', text: 'Sắp xếp chèn (Insertion Sort)', isCorrect: false },
      { label: 'C', text: 'Sắp xếp trộn (Merge Sort)', isCorrect: true },
      { label: 'D', text: 'Sắp xếp chọn (Selection Sort)', isCorrect: false }
    ],
    explanation: 'Merge Sort chia mảng thành hai nửa đệ quy, sắp xếp từng nửa và trộn (merge) hai nửa đã sắp xếp lại với nhau với độ phức tạp O(n log n).'
  }
];

function escapeXml(unsafe = '') {
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Generate a real .docx file from questions and download it
 */
export async function exportToDocx({
  title = 'Đề thi trắc nghiệm',
  examCode = '101',
  duration = 45,
  questions = [],
  includeAnswerKey = true,
  underlineCorrectInline = false,
  filename = 'De-thi-trac-nghiem.docx'
}) {
  const zip = new JSZip();

  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
  );

  zip.folder('_rels').file(
    '.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  );

  const paragraphsXml = [];

  // Header
  paragraphsXml.push(`
    <w:p>
      <w:r>
        <w:rPr><w:b/><w:sz w:val="28"/></w:rPr>
        <w:t>${escapeXml(title.toUpperCase())}</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:rPr><w:i/><w:sz w:val="22"/></w:rPr>
        <w:t>Mã đề: ${escapeXml(String(examCode))} — Thời gian làm bài: ${duration > 0 ? `${duration} phút` : 'Không giới hạn'} — Số câu: ${questions.length} câu</w:t>
      </w:r>
    </w:p>
    <w:p><w:r><w:t></w:t></w:r></w:p>
  `);

  // Questions
  questions.forEach((q, idx) => {
    const qNum = q.displayNumber || q.number || idx + 1;
    paragraphsXml.push(`
      <w:p>
        <w:r>
          <w:rPr><w:b/></w:rPr>
          <w:t xml:space="preserve">Câu ${qNum}: </w:t>
        </w:r>
        <w:r>
          <w:t>${escapeXml(q.question)}</w:t>
        </w:r>
      </w:p>
    `);

    q.options.forEach(opt => {
      const isMarked = underlineCorrectInline && opt.isCorrect;
      const rPr = isMarked
        ? '<w:rPr><w:b/><w:u w:val="single"/><w:color w:val="C00000"/></w:rPr>'
        : '<w:rPr><w:b/></w:rPr>';
      paragraphsXml.push(`
        <w:p>
          <w:r>
            ${rPr}
            <w:t xml:space="preserve">${escapeXml(opt.label)}. </w:t>
          </w:r>
          <w:r>
            ${isMarked ? '<w:rPr><w:u w:val="single"/></w:rPr>' : ''}
            <w:t>${escapeXml(opt.text)}</w:t>
          </w:r>
        </w:p>
      `);
    });

    paragraphsXml.push(`<w:p><w:r><w:t></w:t></w:r></w:p>`);
  });

  // Answer Key section at the end
  if (includeAnswerKey) {
    paragraphsXml.push(`
      <w:p>
        <w:r>
          <w:rPr><w:b/><w:sz w:val="24"/></w:rPr>
          <w:t>BẢNG ĐÁP ÁN</w:t>
        </w:r>
      </w:p>
    `);

    const keyPairs = questions.map((q, idx) => {
      const qNum = q.displayNumber || q.number || idx + 1;
      const correctOpt = q.options.find(o => o.isCorrect);
      return `${qNum}.${correctOpt ? correctOpt.label : '?'}`;
    });

    paragraphsXml.push(`
      <w:p>
        <w:r>
          <w:t>${escapeXml(keyPairs.join('    '))}</w:t>
        </w:r>
      </w:p>
    `);

    const hasExplanations = questions.some(q => q.explanation && q.explanation.trim());
    if (hasExplanations) {
      paragraphsXml.push(`
        <w:p>
          <w:r>
            <w:rPr><w:b/></w:rPr>
            <w:t>HƯỚNG DẪN GIẢI CHI TIẾT</w:t>
          </w:r>
        </w:p>
      `);

      questions.forEach((q, idx) => {
        if (!q.explanation) return;
        const qNum = q.displayNumber || q.number || idx + 1;
        const correctOpt = q.options.find(o => o.isCorrect);
        paragraphsXml.push(`
          <w:p>
            <w:r>
              <w:rPr><w:b/></w:rPr>
              <w:t xml:space="preserve">Câu ${qNum} (Chọn ${correctOpt ? correctOpt.label : '?'}): </w:t>
            </w:r>
            <w:r>
              <w:t>${escapeXml(q.explanation)}</w:t>
            </w:r>
          </w:p>
        `);
      });
    }
  }

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphsXml.join('\n')}
  </w:body>
</w:document>`;

  zip.folder('word').file('document.xml', documentXml);
  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  });

  triggerBlobDownload(blob, filename);
}

/**
 * Export to Excel (.xlsx)
 */
export function exportToExcel({
  questions = [],
  filename = 'De-thi-trac-nghiem.xlsx'
}) {
  const rows = [
    ['STT', 'Câu hỏi', 'Đáp án A', 'Đáp án B', 'Đáp án C', 'Đáp án D', 'Đáp án đúng', 'Giải thích']
  ];

  questions.forEach((q, idx) => {
    const qNum = q.displayNumber || q.number || idx + 1;
    const correctOpt = q.options.find(o => o.isCorrect);
    rows.push([
      qNum,
      q.question,
      q.options[0]?.text || '',
      q.options[1]?.text || '',
      q.options[2]?.text || '',
      q.options[3]?.text || '',
      correctOpt ? correctOpt.label : '',
      q.explanation || ''
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 6 },
    { wch: 50 },
    { wch: 24 },
    { wch: 24 },
    { wch: 24 },
    { wch: 24 },
    { wch: 14 },
    { wch: 45 }
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'DeThi');
  XLSX.writeFile(wb, filename);
}

/**
 * Export to Azota-compatible Text (.txt)
 */
export function exportToTxt({
  title = 'Đề thi trắc nghiệm',
  examCode = '101',
  questions = [],
  markStarInline = true,
  includeAnswerKey = true,
  filename = 'De-thi-trac-nghiem.txt'
}) {
  const lines = [
    `${title.toUpperCase()} (Mã đề: ${examCode})`,
    '--------------------------------------------------',
    ''
  ];

  questions.forEach((q, idx) => {
    const qNum = q.displayNumber || q.number || idx + 1;
    lines.push(`Câu ${qNum}: ${q.question}`);
    q.options.forEach(opt => {
      const prefix = markStarInline && opt.isCorrect ? `*${opt.label}.` : `${opt.label}.`;
      lines.push(`${prefix} ${opt.text}`);
    });
    if (q.explanation) {
      lines.push(`Lời giải: ${q.explanation}`);
    }
    lines.push('');
  });

  if (includeAnswerKey) {
    lines.push('BẢNG ĐÁP ÁN');
    const keys = questions.map((q, idx) => {
      const qNum = q.displayNumber || q.number || idx + 1;
      const correctOpt = q.options.find(o => o.isCorrect);
      return `${qNum}.${correctOpt ? correctOpt.label : '?'}`;
    });
    lines.push(keys.join('  '));
  }

  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  triggerBlobDownload(blob, filename);
}

/**
 * Export to JSON (.json)
 */
export function exportToJson({
  title = 'Đề thi trắc nghiệm',
  examCode = '101',
  questions = [],
  filename = 'De-thi-trac-nghiem.json'
}) {
  const payload = {
    title,
    examCode,
    exportedAt: new Date().toISOString(),
    questions
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  triggerBlobDownload(blob, filename);
}
