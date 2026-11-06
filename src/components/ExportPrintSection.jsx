import React, { useState } from 'react';
import {
  IconPrinter,
  IconDownload,
  IconShuffle,
  IconArrowLeft
} from './Icons';
import {
  exportToDocx,
  exportToExcel,
  exportToTxt,
  exportToJson
} from '../utils/examExporter';

export default function ExportPrintSection({
  examTitle,
  activeExam,
  examConfig,
  onReshuffleNewVariant,
  onBackToEditor
}) {
  const [schoolName, setSchoolName] = useState('TRƯỜNG ĐẠI HỌC / THPT CHUYÊN');
  const [subjectName, setSubjectName] = useState('KIỂM TRA ĐÁNH GIÁ ĐỊNH KỲ');
  const [showStudentBox, setShowStudentBox] = useState(true);
  const [showAnswerSheet, setShowAnswerSheet] = useState(true);
  const [showAnswerKey, setShowAnswerKey] = useState(true);
  const [highlightInlineCorrect, setHighlightInlineCorrect] = useState(false);

  const questions = activeExam?.questions || [];
  const examCode = activeExam?.examCode || examConfig.examCode || '101';
  const duration = examConfig.duration;

  const safeSlug = (examTitle || 'De-thi')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadDocx = () => {
    exportToDocx({
      title: examTitle,
      examCode,
      duration,
      questions,
      includeAnswerKey: showAnswerKey,
      underlineCorrectInline: highlightInlineCorrect,
      filename: `${safeSlug}-MaDe-${examCode}.docx`
    });
  };

  const handleDownloadXlsx = () => {
    exportToExcel({
      questions,
      filename: `${safeSlug}-MaDe-${examCode}.xlsx`
    });
  };

  const handleDownloadTxt = () => {
    exportToTxt({
      title: examTitle,
      examCode,
      questions,
      markStarInline: highlightInlineCorrect,
      includeAnswerKey: showAnswerKey,
      filename: `${safeSlug}-MaDe-${examCode}.txt`
    });
  };

  const handleDownloadJson = () => {
    exportToJson({
      title: examTitle,
      examCode,
      questions,
      filename: `${safeSlug}-MaDe-${examCode}.json`
    });
  };

  return (
    <div>
      {/* Control Panel (Hidden when printing) */}
      <div className="card no-print" style={{ marginBottom: 28 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16,
            paddingBottom: 20,
            borderBottom: '1px solid var(--border-color)'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <button type="button" className="btn btn-sm" onClick={onBackToEditor}>
                <IconArrowLeft size={14} />
                <span>Quay lại soạn thảo</span>
              </button>
              <span className="badge badge-mono">MÃ ĐỀ HIỆN TẠI: {examCode}</span>
            </div>
            <h2 className="card-title" style={{ marginBottom: 0 }}>
              In đề thi & Xuất file đa định dạng
            </h2>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn" onClick={onReshuffleNewVariant}>
              <IconShuffle size={15} />
              <span>Trộn mã đề mới</span>
            </button>
            <button type="button" className="btn" onClick={handleDownloadDocx}>
              <IconDownload size={15} />
              <span>Tải Word (.DOCX)</span>
            </button>
            <button type="button" className="btn" onClick={handleDownloadXlsx}>
              <IconDownload size={15} />
              <span>Tải Excel (.XLSX)</span>
            </button>
            <button type="button" className="btn" onClick={handleDownloadTxt}>
              <IconDownload size={15} />
              <span>Tải Text (.TXT)</span>
            </button>
            <button type="button" className="btn" onClick={handleDownloadJson}>
              <IconDownload size={15} />
              <span>Tải JSON</span>
            </button>
            <button type="button" className="btn btn-primary" onClick={handlePrint}>
              <IconPrinter size={16} />
              <span>In đề thi / Xuất PDF</span>
            </button>
          </div>
        </div>

        {/* Print Customization Controls */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 16,
            marginTop: 18
          }}
        >
          <div>
            <label className="field-label">Tên đơn vị / Trường học</label>
            <input
              type="text"
              className="input"
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
            />
          </div>

          <div>
            <label className="field-label">Kỳ thi / Học phần</label>
            <input
              type="text"
              className="input"
              value={subjectName}
              onChange={(e) => setSubjectName(e.target.value)}
            />
          </div>

          <div style={{ display: 'grid', gap: 8, alignContent: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showStudentBox}
                onChange={(e) => setShowStudentBox(e.target.checked)}
              />
              <span>Hiển thị khung Họ tên & Số báo danh</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showAnswerSheet}
                onChange={(e) => setShowAnswerSheet(e.target.checked)}
              />
              <span>Kèm Phiếu trả lời trắc nghiệm</span>
            </label>
          </div>

          <div style={{ display: 'grid', gap: 8, alignContent: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showAnswerKey}
                onChange={(e) => setShowAnswerKey(e.target.checked)}
              />
              <span>Kèm Bảng đáp án chấm thi ở cuối đề</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={highlightInlineCorrect}
                onChange={(e) => setHighlightInlineCorrect(e.target.checked)}
              />
              <span>Gạch chân đáp án đúng ngay trên câu hỏi (Bản GV)</span>
            </label>
          </div>
        </div>
      </div>

      {/* Live A4 Paper Sheet Preview */}
      <div className="print-paper">
        {/* Paper Top Header */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1.2fr',
            gap: 16,
            borderBottom: '1.5px solid #000000',
            paddingBottom: 14,
            marginBottom: 16
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase' }}>
              {schoolName}
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 600, marginTop: 2 }}>
              ĐỀ CHÍNH THỨC
            </div>
            <div style={{ fontSize: 12, fontStyle: 'italic', marginTop: 4 }}>
              (Đề thi gồm có {questions.length} câu)
            </div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase' }}>
              {subjectName}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>
              Môn: {examTitle}
            </div>
            <div style={{ fontSize: 12.5, marginTop: 2 }}>
              Thời gian làm bài: {duration > 0 ? `${duration} phút` : 'Không giới hạn'}
            </div>
            <div
              style={{
                display: 'inline-block',
                marginTop: 6,
                padding: '2px 10px',
                border: '1.5px solid #000000',
                fontWeight: 700,
                fontSize: 13
              }}
            >
              Mã đề thi: {examCode}
            </div>
          </div>
        </div>

        {/* Candidate Information Box */}
        {showStudentBox && (
          <div
            style={{
              border: '1px solid #000000',
              padding: '10px 14px',
              marginBottom: 20,
              fontSize: 13.5,
              display: 'grid',
              gridTemplateColumns: '1.6fr 1fr',
              gap: 12
            }}
          >
            <div>Họ và tên thí sinh: ........................................................................</div>
            <div>Số báo danh / Lớp: ......................................</div>
          </div>
        )}

        {/* Questions List */}
        <div style={{ display: 'grid', gap: 16 }}>
          {questions.map((q, idx) => {
            const hasLongOption = q.options.some(o => o.text.length > 42);
            return (
              <div key={q.id} style={{ pageBreakInside: 'avoid', fontSize: 14.5 }}>
                <div>
                  <strong>Câu {idx + 1}: </strong>
                  <span style={{ whiteSpace: 'pre-line' }}>{q.question}</span>
                </div>

                <div
                  className="print-options-grid"
                  style={{
                    gridTemplateColumns: hasLongOption ? '1fr' : 'repeat(2, 1fr)'
                  }}
                >
                  {q.options.map((opt, oIdx) => {
                    const markCorrect = highlightInlineCorrect && opt.isCorrect;
                    return (
                      <div key={oIdx} style={{ fontSize: 14 }}>
                        <strong
                          style={{
                            textDecoration: markCorrect ? 'underline' : 'none'
                          }}
                        >
                          {opt.label}.
                        </strong>{' '}
                        <span
                          style={{
                            textDecoration: markCorrect ? 'underline' : 'none',
                            fontWeight: markCorrect ? 700 : 400
                          }}
                        >
                          {opt.text}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ textAlign: 'center', marginTop: 28, fontWeight: 700, fontSize: 13 }}>
          ——— HẾT ———
        </div>

        {/* Answer Bubble Grid Sheet */}
        {showAnswerSheet && (
          <div style={{ marginTop: 32, paddingTop: 20, borderTop: '1px dashed #000000', pageBreakInside: 'avoid' }}>
            <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 14, marginBottom: 12 }}>
              PHIẾU TRẢ LỜI TRẮC NGHIỆM (Mã đề: {examCode})
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                gap: 8
              }}
            >
              {questions.map((q, idx) => (
                <div
                  key={q.id}
                  style={{
                    border: '1px solid #000000',
                    padding: '5px 8px',
                    fontSize: 12.5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <strong>{idx + 1}.</strong>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {q.options.map(opt => (
                      <span
                        key={opt.label}
                        style={{
                          width: 19,
                          height: 19,
                          borderRadius: '50%',
                          border: '1px solid #000000',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 10.5
                        }}
                      >
                        {opt.label}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Answer Key Table */}
        {showAnswerKey && (
          <div style={{ marginTop: 32, paddingTop: 20, borderTop: '1.5px solid #000000', pageBreakInside: 'avoid' }}>
            <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 14, marginBottom: 12 }}>
              BẢNG ĐÁP ÁN CHẤM THI — MÃ ĐỀ {examCode}
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(75px, 1fr))',
                border: '1px solid #000000'
              }}
            >
              {questions.map((q, idx) => {
                const correctOpt = q.options.find(o => o.isCorrect);
                return (
                  <div
                    key={q.id}
                    style={{
                      border: '0.5px solid #000000',
                      padding: '6px 8px',
                      textAlign: 'center',
                      fontSize: 13
                    }}
                  >
                    <strong>{idx + 1}</strong>: {correctOpt ? correctOpt.label : '?'}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
