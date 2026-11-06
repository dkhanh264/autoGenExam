import React, { useState, useRef } from 'react';
import {
  IconUpload,
  IconFileText,
  IconCheck,
  IconDownload,
  IconBook,
  IconTrash,
  IconPlay,
  IconSliders
} from './Icons';
import {
  SAMPLE_QUESTIONS,
  exportToDocx,
  exportToExcel,
  exportToTxt
} from '../utils/examExporter';
import { getAiSettings, saveAiSettings } from '../utils/answerFinder';

const SAMPLE_RAW_TEXT = `Câu 1: Giao thức nào sau đây sử dụng cổng mặc định 443 để truyền tải dữ liệu web an toàn?
A. HTTP
*B. HTTPS
C. FTP
D. Telnet
Lời giải: HTTPS (Hypertext Transfer Protocol Secure) kết hợp HTTP với TLS/SSL và hoạt động mặc định trên cổng 443.

Câu 2: Trong hệ quản trị cơ sở dữ liệu quan hệ, khóa ngoại (Foreign Key) dùng để làm gì?
A. Đảm bảo giá trị cột không trùng lặp trong cùng một bảng
B. Tăng tốc độ truy vấn văn bản toàn cục
<u>C. Thiết lập liên kết và đảm bảo toàn vẹn tham chiếu giữa hai bảng</u>
D. Mã hóa dữ liệu nhạy cảm của người dùng

Câu 3: Đơn vị đo tốc độ xung nhịp của bộ vi xử lý (CPU) thường được tính bằng gì?
A. Gigahertz (GHz)
B. Gigabyte (GB)
C. Megabit trên giây (Mbps)
D. Milliampere-giờ (mAh)
(Câu 3 cố tình không đánh dấu đáp án để hệ thống tự động tìm đáp án đúng!)`;

export default function UploadSection({
  onFilesSelected,
  onParseRawText,
  onLoadSampleExam,
  savedExams,
  onOpenSavedExam,
  onDeleteSavedExam,
  isParsing,
  parseProgressText,
  parseError
}) {
  const [inputMode, setInputMode] = useState('file'); // 'file' | 'paste'
  const [dragActive, setDragActive] = useState(false);
  const [pasteTitle, setPasteTitle] = useState('Đề kiểm tra nhanh');
  const [pasteText, setPasteText] = useState(SAMPLE_RAW_TEXT);
  const [openGuideIndex, setOpenGuideIndex] = useState(0);
  const [showAiConfig, setShowAiConfig] = useState(false);
  const [aiSettings, setAiSettings] = useState(() => getAiSettings());

  const fileInputRef = useRef(null);

  const handleUpdateAiSettings = (patch) => {
    const next = { ...aiSettings, ...patch };
    setAiSettings(next);
    saveAiSettings(next);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesSelected(Array.from(e.dataTransfer.files), aiSettings.autoSolveOnUpload);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(Array.from(e.target.files), aiSettings.autoSolveOnUpload);
      e.target.value = '';
    }
  };

  const handleDownloadSampleDocx = () => {
    exportToDocx({
      title: 'Đề thi mẫu Tin học Đại cương (Có gạch chân & màu đỏ)',
      examCode: '101',
      duration: 30,
      questions: SAMPLE_QUESTIONS,
      includeAnswerKey: true,
      underlineCorrectInline: true,
      filename: 'De-mau-Co-Dap-An-Word.docx'
    });
  };

  const handleDownloadNoAnswerDocx = () => {
    exportToDocx({
      title: 'Đề thi mẫu CHƯA CÓ ĐÁP ÁN (Test tự động tìm đáp án)',
      examCode: '102',
      duration: 30,
      questions: SAMPLE_QUESTIONS.map(q => ({
        ...q,
        explanation: '',
        options: q.options.map(o => ({ ...o, isCorrect: false }))
      })),
      includeAnswerKey: false,
      underlineCorrectInline: false,
      filename: 'De-mau-Chua-Co-Dap-An.docx'
    });
  };

  const handleDownloadSampleXlsx = () => {
    exportToExcel({
      questions: SAMPLE_QUESTIONS,
      filename: 'De-mau-Excel-Chuan.xlsx'
    });
  };

  const handleDownloadSampleTxt = () => {
    exportToTxt({
      title: 'Đề thi mẫu Tin học Đại cương',
      examCode: '101',
      questions: SAMPLE_QUESTIONS,
      markStarInline: true,
      includeAnswerKey: true,
      filename: 'De-mau-Azota.txt'
    });
  };

  return (
    <div>
      <div className="hero-header">
        <div className="eyebrow-badge">
          <span>Bóc tách đa định dạng & Tự động tìm đáp án đúng</span>
        </div>
        <h1 className="editorial-title">
          Tải lên bất kỳ file câu hỏi nào — Tự nhận diện mọi kiểu đánh dấu hoặc tự giải đề.
        </h1>
        <p className="editorial-desc">
          Đọc trực tiếp <strong>Word (.docx)</strong>, <strong>PDF (.pdf)</strong>,{' '}
          <strong>Excel / CSV (.xlsx, .csv)</strong>, <strong>HTML</strong> và <strong>Text (.txt)</strong>.
          Tự động đối chiếu <strong>tô màu chữ, tô nền (highlight/shading), gạch chân, in đậm, in nghiêng, dấu *, bảng đáp án</strong> — và tự động tìm đáp án đúng nếu file chưa có đáp án.
        </p>
      </div>

      <div className="bento-grid-2">
        {/* Left Column: Upload or Paste */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 className="card-title" style={{ marginBottom: 2 }}>Nguồn dữ liệu câu hỏi</h2>
              <p className="card-subtitle" style={{ marginBottom: 0 }}>
                Tải lên một hoặc nhiều file đề thi bất kỳ hoặc dán văn bản
              </p>
            </div>

            <div className="nav-steps">
              <button
                type="button"
                className={`nav-step-btn ${inputMode === 'file' ? 'active' : ''}`}
                onClick={() => setInputMode('file')}
              >
                <IconUpload size={15} />
                <span>Tải file lên</span>
              </button>
              <button
                type="button"
                className={`nav-step-btn ${inputMode === 'paste' ? 'active' : ''}`}
                onClick={() => setInputMode('paste')}
              >
                <IconFileText size={15} />
                <span>Dán văn bản</span>
              </button>
            </div>
          </div>

          {/* Auto-Solve Bar & Optional AI Key Configuration */}
          <div
            style={{
              padding: '12px 16px',
              background: 'var(--bg-canvas)',
              border: '1px solid var(--border-color)',
              borderRadius: 8,
              marginBottom: 18
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>
                <input
                  type="checkbox"
                  checked={aiSettings.autoSolveOnUpload}
                  onChange={(e) => handleUpdateAiSettings({ autoSolveOnUpload: e.target.checked })}
                />
                <span>Tự động tìm đáp án đúng nếu câu hỏi trong file chưa có đáp án</span>
              </label>

              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setShowAiConfig(!showAiConfig)}
              >
                <IconSliders size={14} />
                <span>{aiSettings.apiKey ? 'Đã kết nối AI Key' : 'Cấu hình AI nâng cao'}</span>
              </button>
            </div>

            {showAiConfig && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-color)', display: 'grid', gap: 10 }}>
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                  Mặc định hệ thống tự động giải đề bằng <strong>Tri thức tích hợp + Tra cứu Wikipedia trực tuyến + Phân tích toán/logic</strong> (không cần khóa API). Nếu muốn giải chuyên sâu bằng AI LLM, bạn có thể nhập <strong>Gemini API Key</strong> hoặc <strong>OpenAI API Key</strong>:
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <select
                    className="select"
                    style={{ width: 170 }}
                    value={aiSettings.provider}
                    onChange={(e) => handleUpdateAiSettings({ provider: e.target.value })}
                  >
                    <option value="gemini">Google Gemini API</option>
                    <option value="openai">OpenAI API</option>
                  </select>
                  <input
                    type="password"
                    className="input"
                    style={{ flex: 1, minWidth: 220, fontFamily: 'var(--font-mono)', fontSize: 13 }}
                    placeholder="Dán API Key (AIza... hoặc sk-...) — Lưu cục bộ trên trình duyệt"
                    value={aiSettings.apiKey}
                    onChange={(e) => handleUpdateAiSettings({ apiKey: e.target.value })}
                  />
                </div>
              </div>
            )}
          </div>

          {parseError && (
            <div
              style={{
                padding: '12px 16px',
                background: 'var(--pastel-red-bg)',
                color: 'var(--pastel-red-text)',
                border: '1px solid var(--pastel-red-border)',
                borderRadius: 8,
                marginBottom: 18,
                fontSize: 13.5
              }}
            >
              <strong>Lỗi đọc file:</strong> {parseError}
            </div>
          )}

          {inputMode === 'file' ? (
            <>
              <div
                className={`dropzone ${dragActive ? 'drag-active' : ''}`}
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".docx,.pdf,.xlsx,.xls,.csv,.tsv,.txt,.md,.html,.htm,.json"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />
                <div className="dropzone-icon-box">
                  <IconUpload size={22} />
                </div>
                <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                  {isParsing
                    ? (parseProgressText || 'Đang phân tích cấu trúc file và xác định đáp án...')
                    : 'Kéo thả file câu hỏi vào đây, hoặc nhấp để chọn file'}
                </p>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 18 }}>
                  Hỗ trợ mọi kiểu đánh dấu đáp án (tô màu chữ, tô nền, gạch chân, in đậm, bảng đáp án) hoặc file trắng chưa có đáp án
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span className="badge badge-blue">Word .DOCX</span>
                  <span className="badge badge-red">PDF .PDF</span>
                  <span className="badge badge-green">Excel .XLSX / .CSV</span>
                  <span className="badge badge-mono">HTML / .TXT / .JSON</span>
                </div>
              </div>

              {/* Quick Demo & Sample Files Bar */}
              <div
                style={{
                  marginTop: 22,
                  paddingTop: 20,
                  borderTop: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 12
                }}
              >
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>
                    Bộ đề mẫu kiểm thử nhanh
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                    Tải về file mẫu có đáp án (tô màu/gạch chân) hoặc file mẫu <strong>chưa có đáp án</strong> để thử tính năng tự giải đề
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={onLoadSampleExam}
                  >
                    <IconPlay size={14} />
                    <span>Dùng thử đề mẫu ngay</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={handleDownloadSampleDocx}
                    title="Tải file Word mẫu có gạch chân & tô màu đỏ đáp án"
                  >
                    <IconDownload size={14} />
                    <span>Word Có đáp án (.DOCX)</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={handleDownloadNoAnswerDocx}
                    title="Tải file Word mẫu KHÔNG có đáp án để thử tính năng tự động tìm đáp án đúng"
                  >
                    <IconDownload size={14} />
                    <span>Word Chưa có đáp án (.DOCX)</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={handleDownloadSampleXlsx}
                  >
                    <IconDownload size={14} />
                    <span>Mẫu .XLSX</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={handleDownloadSampleTxt}
                  >
                    <IconDownload size={14} />
                    <span>Mẫu .TXT</span>
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div>
              <div style={{ marginBottom: 14 }}>
                <label className="field-label">Tên đề thi</label>
                <input
                  type="text"
                  className="input"
                  value={pasteTitle}
                  onChange={(e) => setPasteTitle(e.target.value)}
                  placeholder="Nhập tên bài thi..."
                />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label className="field-label">
                  Nội dung câu hỏi (Có thể đánh dấu *, <u>gạch chân</u>, **in đậm**, hoặc để trống đáp án để hệ thống tự giải)
                </label>
                <textarea
                  className="textarea"
                  rows={11}
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder="Câu 1: Nội dung câu hỏi?&#10;A. Phương án 1&#10;B. Phương án 2..."
                  style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setPasteText('')}
                >
                  Xóa trắng
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => onParseRawText(pasteText, pasteTitle, aiSettings.autoSolveOnUpload)}
                  disabled={!pasteText.trim() || isParsing}
                >
                  <IconCheck size={16} />
                  <span>{isParsing ? 'Đang xử lý & tìm đáp án...' : 'Tách câu hỏi & Tạo đề'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Saved Exams Library */}
          {savedExams && savedExams.length > 0 && (
            <div style={{ marginTop: 28, paddingTop: 22, borderTop: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <h3 style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <IconBook size={16} />
                  <span>Thư viện đề đã lưu trên trình duyệt ({savedExams.length})</span>
                </h3>
              </div>

              <div style={{ display: 'grid', gap: 8 }}>
                {savedExams.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      border: '1px solid var(--border-color)',
                      borderRadius: 8,
                      background: 'var(--bg-subtle)',
                      gap: 12,
                      flexWrap: 'wrap'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>
                        {item.title}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {item.questions?.length || 0} câu hỏi • Cập nhật:{' '}
                        {new Date(item.createdAt).toLocaleDateString('vi-VN')}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => onOpenSavedExam(item, 'edit')}
                      >
                        Chỉnh sửa
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => onOpenSavedExam(item, 'config')}
                      >
                        Vào thi / Trộn đề
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => onDeleteSavedExam(item.id)}
                        title="Xóa đề này"
                      >
                        <IconTrash size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Universal Detection Capabilities */}
        <div className="card">
          <h2 className="card-title">Cơ chế nhận diện đa tầng</h2>
          <p className="card-subtitle">
            Phân tích vi sai định dạng (Relative Style Differential) giúp đọc chính xác mọi kiểu đánh dấu
          </p>

          <div style={{ borderTop: '1px solid var(--border-color)' }}>
            {/* Accordion 1 */}
            <div style={{ borderBottom: '1px solid var(--border-color)' }}>
              <button
                type="button"
                onClick={() => setOpenGuideIndex(openGuideIndex === 0 ? -1 : 0)}
                style={{
                  width: '100%',
                  padding: '14px 0',
                  background: 'none',
                  border: 'none',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  fontSize: 14
                }}
              >
                <span>1. Nhận diện mọi kiểu đánh dấu trong Word, Excel, PDF</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16 }}>
                  {openGuideIndex === 0 ? '−' : '+'}
                </span>
              </button>
              {openGuideIndex === 0 && (
                <div style={{ paddingBottom: 16, fontSize: 13, color: 'var(--text-body)' }}>
                  <p style={{ marginBottom: 8 }}>
                    Trong mỗi câu hỏi, hệ thống tự động so sánh đối chiếu 4 phương án <kbd>A</kbd> <kbd>B</kbd> <kbd>C</kbd> <kbd>D</kbd> để phát hiện phương án nổi bật theo thứ tự ưu tiên:
                  </p>
                  <ul style={{ paddingLeft: 18, display: 'grid', gap: 5 }}>
                    <li>
                      <strong>Tô nền / Highlight / Shading:</strong> Tô sáng chữ hoặc đổ màu nền ô bảng trong Word & Excel.
                    </li>
                    <li>
                      <strong>Gạch chân (Underline):</strong> Gạch chân chữ cái đầu (<u>A.</u>) hoặc gạch chân toàn bộ phương án đúng.
                    </li>
                    <li>
                      <strong>Tô màu chữ (Text Color):</strong> Chữ màu đỏ, xanh, cam... khác biệt với 3 phương án còn lại.
                    </li>
                    <li>
                      <strong>In đậm / In nghiêng vi sai:</strong> Chỉ in đậm phương án đúng (hoặc chỉ in đậm chữ cái đầu của phương án đúng).
                    </li>
                    <li>
                      <strong>Ký hiệu & Bảng đáp án:</strong> Dấu <kbd>*A.</kbd>, <kbd>[x]</kbd>, <kbd>(Đúng)</kbd>, dòng <kbd>Đáp án: A</kbd> hoặc <strong>Bảng đáp án</strong> ở cuối file.
                    </li>
                  </ul>
                </div>
              )}
            </div>

            {/* Accordion 2 */}
            <div style={{ borderBottom: '1px solid var(--border-color)' }}>
              <button
                type="button"
                onClick={() => setOpenGuideIndex(openGuideIndex === 1 ? -1 : 1)}
                style={{
                  width: '100%',
                  padding: '14px 0',
                  background: 'none',
                  border: 'none',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  fontSize: 14
                }}
              >
                <span>2. Tự động tìm đáp án đúng khi file không có đáp án</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16 }}>
                  {openGuideIndex === 1 ? '−' : '+'}
                </span>
              </button>
              {openGuideIndex === 1 && (
                <div style={{ paddingBottom: 16, fontSize: 13, color: 'var(--text-body)' }}>
                  <p style={{ marginBottom: 8 }}>
                    Khi tải lên một đề thi trắng (chưa đánh dấu đáp án), hệ thống kích hoạt chuỗi <strong>Auto-Solver 3 tầng</strong>:
                  </p>
                  <ul style={{ paddingLeft: 18, display: 'grid', gap: 5 }}>
                    <li>
                      <strong>Tầng 1 (AI Giải đề):</strong> Sử dụng Gemini / OpenAI API (nếu được cấu hình) để giải chính xác kèm lời giải chi tiết.
                    </li>
                    <li>
                      <strong>Tầng 2 (Tra cứu Tri thức Wikipedia trực tuyến):</strong> Tự động truy vấn đối chiếu dữ kiện câu hỏi trên Wikipedia tiếng Việt & tiếng Anh.
                    </li>
                    <li>
                      <strong>Tầng 3 (Bộ giải Toán/Logic & Tri thức tích hợp):</strong> Tính toán biểu thức số học, cơ số và đối chiếu ngân hàng quy tắc học thuật.
                    </li>
                  </ul>
                </div>
              )}
            </div>

            {/* Accordion 3 */}
            <div style={{ borderBottom: '1px solid var(--border-color)' }}>
              <button
                type="button"
                onClick={() => setOpenGuideIndex(openGuideIndex === 2 ? -1 : 2)}
                style={{
                  width: '100%',
                  padding: '14px 0',
                  background: 'none',
                  border: 'none',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  fontSize: 14
                }}
              >
                <span>3. Hỗ trợ danh sách tự động (Auto-Numbering) & Bảng biểu</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16 }}>
                  {openGuideIndex === 2 ? '−' : '+'}
                </span>
              </button>
              {openGuideIndex === 2 && (
                <div style={{ paddingBottom: 16, fontSize: 13, color: 'var(--text-body)' }}>
                  <p>
                    Đọc được cả các file Word dùng <strong>Numbering / Bullet tự động</strong> của Microsoft Word (<kbd>1, 2, 3</kbd> hoặc <kbd>A, B, C, D</kbd> tự động), câu hỏi nằm trong bảng biểu (<kbd>Table</kbd>) và file Excel tô màu ô đáp án mà không cần cột Đáp án riêng.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
