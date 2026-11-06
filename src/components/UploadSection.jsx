import React, { useState, useRef } from 'react';
import {
  IconUpload,
  IconFileText,
  IconCheck,
  IconDownload,
  IconBook,
  IconTrash,
  IconPlay,
  IconPlus
} from './Icons';
import {
  SAMPLE_QUESTIONS,
  exportToDocx,
  exportToExcel,
  exportToTxt
} from '../utils/examExporter';

const SAMPLE_RAW_TEXT = `Câu 1: Giao thức nào sau đây sử dụng cổng mặc định 443 để truyền tải dữ liệu web an toàn?
A. HTTP
*B. HTTPS
C. FTP
D. Telnet
Lời giải: HTTPS (Hypertext Transfer Protocol Secure) kết hợp HTTP với TLS/SSL và hoạt động mặc định trên cổng 443.

Câu 2: Trong hệ quản trị cơ sở dữ liệu quan hệ, khóa ngoại (Foreign Key) dùng để làm gì?
A. Đảm bảo giá trị cột không trùng lặp trong cùng một bảng
B. Tăng tốc độ truy vấn văn bản toàn cục
*C. Thiết lập liên kết và đảm bảo toàn vẹn tham chiếu giữa hai bảng
D. Mã hóa dữ liệu nhạy cảm của người dùng
Lời giải: Khóa ngoại tham chiếu đến khóa chính của bảng khác nhằm đảm bảo tính toàn vẹn tham chiếu (Referential Integrity).

Câu 3: Đơn vị đo tốc độ xung nhịp của bộ vi xử lý (CPU) thường được tính bằng gì?
*A. Gigahertz (GHz)
B. Gigabyte (GB)
C. Megabit trên giây (Mbps)
D. Milliampere-giờ (mAh)
Lời giải: Tần số xung nhịp CPU biểu thị số chu kỳ lệnh mỗi giây và được đo bằng Hertz (MHz, GHz).`;

export default function UploadSection({
  onFilesSelected,
  onParseRawText,
  onLoadSampleExam,
  savedExams,
  onOpenSavedExam,
  onDeleteSavedExam,
  isParsing,
  parseError
}) {
  const [inputMode, setInputMode] = useState('file'); // 'file' | 'paste'
  const [dragActive, setDragActive] = useState(false);
  const [pasteTitle, setPasteTitle] = useState('Đề kiểm tra nhanh');
  const [pasteText, setPasteText] = useState(SAMPLE_RAW_TEXT);
  const [openGuideIndex, setOpenGuideIndex] = useState(0);
  const fileInputRef = useRef(null);

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
      onFilesSelected(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const handleDownloadSampleDocx = () => {
    exportToDocx({
      title: 'Đề thi mẫu Tin học Đại cương',
      examCode: '101',
      duration: 30,
      questions: SAMPLE_QUESTIONS,
      includeAnswerKey: true,
      underlineCorrectInline: true,
      filename: 'De-mau-Azota-Chuan.docx'
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
          <span>Bóc tách đề tự động kiểu Azota</span>
        </div>
        <h1 className="editorial-title">
          Tải file đề cương, khởi tạo bài thi trắc nghiệm trong tích tắc.
        </h1>
        <p className="editorial-desc">
          Hỗ trợ đọc trực tiếp từ <strong>Word (.docx)</strong>, <strong>PDF (.pdf)</strong>,{' '}
          <strong>Excel / CSV (.xlsx, .csv)</strong> và <strong>Văn bản (.txt)</strong>. Tự động nhận diện
          câu hỏi, các phương án A/B/C/D, đáp án gạch chân, tô màu hoặc bảng đáp án cuối trang.
        </p>
      </div>

      <div className="bento-grid-2">
        {/* Left Column: Upload or Paste */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 className="card-title" style={{ marginBottom: 2 }}>Nguồn dữ liệu câu hỏi</h2>
              <p className="card-subtitle" style={{ marginBottom: 0 }}>
                Chọn tải file từ máy tính hoặc dán trực tiếp nội dung văn bản
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
                  accept=".docx,.pdf,.xlsx,.xls,.csv,.txt,.md,.json"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />
                <div className="dropzone-icon-box">
                  <IconUpload size={22} />
                </div>
                <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                  {isParsing ? 'Đang phân tích và bóc tách câu hỏi...' : 'Kéo thả file đề thi vào đây, hoặc nhấp để chọn file'}
                </p>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 18 }}>
                  Chấp nhận nhiều file cùng lúc để gộp thành một ngân hàng đề thi
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span className="badge badge-blue">Word .DOCX</span>
                  <span className="badge badge-red">PDF .PDF</span>
                  <span className="badge badge-green">Excel .XLSX / .CSV</span>
                  <span className="badge badge-mono">Text .TXT / .JSON</span>
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
                    Chưa có sẵn file trên máy?
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                    Dùng thử ngay bộ đề mẫu hoặc tải file mẫu chuẩn về máy để kiểm thử
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={onLoadSampleExam}
                  >
                    <IconPlay size={14} />
                    <span>Dùng thử đề mẫu ngay (10 câu)</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={handleDownloadSampleDocx}
                    title="Tải file Word mẫu có gạch chân đáp án và bảng đáp án"
                  >
                    <IconDownload size={14} />
                    <span>Mẫu .DOCX</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={handleDownloadSampleXlsx}
                    title="Tải file Excel mẫu"
                  >
                    <IconDownload size={14} />
                    <span>Mẫu .XLSX</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={handleDownloadSampleTxt}
                    title="Tải file Text mẫu"
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
                  Nội dung câu hỏi (Đặt dấu * trước đáp án đúng hoặc thêm BẢNG ĐÁP ÁN ở cuối)
                </label>
                <textarea
                  className="textarea"
                  rows={11}
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder="Câu 1: Nội dung câu hỏi?&#10;*A. Đáp án đúng&#10;B. Đáp án sai..."
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
                  onClick={() => onParseRawText(pasteText, pasteTitle)}
                  disabled={!pasteText.trim()}
                >
                  <IconCheck size={16} />
                  <span>Tách câu hỏi & Tạo đề</span>
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

        {/* Right Column: Formatting Rules & Azota Compatibility Guide */}
        <div className="card">
          <h2 className="card-title">Quy chuẩn nhận diện thông minh</h2>
          <p className="card-subtitle">
            Hệ thống tương thích hoàn toàn với cách trình bày đề thi phổ thông và đại học tại Việt Nam
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
                <span>1. Định dạng file Word (.docx) & Văn bản (.txt)</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16 }}>
                  {openGuideIndex === 0 ? '−' : '+'}
                </span>
              </button>
              {openGuideIndex === 0 && (
                <div style={{ paddingBottom: 16, fontSize: 13, color: 'var(--text-body)' }}>
                  <p style={{ marginBottom: 8 }}>
                    Mỗi câu bắt đầu bằng <kbd>Câu 1:</kbd>, <kbd>Câu 1.</kbd>, <kbd>1.</kbd> hoặc <kbd>Question 1:</kbd>.
                    Đáp án đúng được tự động nhận diện qua <strong>1 trong 4 cách</strong>:
                  </p>
                  <ul style={{ paddingLeft: 18, marginBottom: 10, display: 'grid', gap: 4 }}>
                    <li>
                      <strong>Gạch chân</strong> (<u>A.</u>), <strong>Tô màu chữ đỏ/xanh</strong> hoặc <strong>Tô sáng (Highlight)</strong> phương án đúng trong Word.
                    </li>
                    <li>
                      Đặt dấu sao trước phương án đúng: <kbd>*A.</kbd> hoặc <kbd>*B.</kbd>
                    </li>
                    <li>
                      Ghi dòng <kbd>Đáp án: B</kbd> và <kbd>Lời giải: ...</kbd> ngay dưới câu hỏi.
                    </li>
                    <li>
                      Đặt mục <strong>BẢNG ĐÁP ÁN</strong> ở cuối đề (<kbd>1.A 2.B 3.C 4.D...</kbd>).
                    </li>
                  </ul>
                  <div
                    style={{
                      background: 'var(--bg-canvas)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 6,
                      padding: 10,
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11.5,
                      lineHeight: 1.5
                    }}
                  >
                    Câu 1: Thủ đô của Việt Nam là thành phố nào?<br />
                    *A. Hà Nội &nbsp;&nbsp;&nbsp; B. Huế<br />
                    C. Đà Nẵng &nbsp;&nbsp;&nbsp; D. TP. Hồ Chí Minh<br />
                    Lời giải: Hà Nội là thủ đô của nước CHXHCN Việt Nam.
                  </div>
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
                <span>2. Định dạng bảng tính Excel (.xlsx, .csv)</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16 }}>
                  {openGuideIndex === 1 ? '−' : '+'}
                </span>
              </button>
              {openGuideIndex === 1 && (
                <div style={{ paddingBottom: 16, fontSize: 13, color: 'var(--text-body)' }}>
                  <p style={{ marginBottom: 8 }}>
                    Hỗ trợ bảng tính có dòng tiêu đề hoặc không có tiêu đề theo thứ tự cột:
                  </p>
                  <div
                    style={{
                      background: 'var(--bg-canvas)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 6,
                      padding: 10,
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11.5
                    }}
                  >
                    | Câu hỏi | Đáp án A | Đáp án B | Đáp án C | Đáp án D | Đáp án đúng | Giải thích |
                  </div>
                  <p style={{ marginTop: 8, color: 'var(--text-muted)', fontSize: 12.5 }}>
                    Cột <strong>Đáp án đúng</strong> có thể điền chữ cái (<kbd>A</kbd>, <kbd>B</kbd>, <kbd>C</kbd>, <kbd>D</kbd>), số thứ tự (<kbd>1</kbd>-<kbd>4</kbd>) hoặc nội dung phương án đúng.
                  </p>
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
                <span>3. File PDF (.pdf) & Chọn đáp án bổ sung</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16 }}>
                  {openGuideIndex === 2 ? '−' : '+'}
                </span>
              </button>
              {openGuideIndex === 2 && (
                <div style={{ paddingBottom: 16, fontSize: 13, color: 'var(--text-body)' }}>
                  <p>
                    Với các file PDF hoặc Word chưa được đánh dấu sẵn đáp án đúng, hệ thống vẫn tự động tách toàn bộ câu hỏi và phương án A/B/C/D. Sau đó bạn có thể <strong>nhấp chuột chọn đáp án đúng cho từng câu</strong> hoặc <strong>dán nhanh chuỗi đáp án (1A 2B 3C...)</strong> ngay trên giao diện chỉnh sửa.
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
