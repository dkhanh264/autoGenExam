import React, { useState } from 'react';
import {
  IconCheck,
  IconEdit,
  IconPlus,
  IconTrash,
  IconPlay,
  IconShuffle,
  IconPrinter,
  IconKey,
  IconSearch,
  IconAlert,
  IconUpload
} from './Icons';

export default function EditorSection({
  exam,
  onUpdateExam,
  examConfig,
  onUpdateConfig,
  onStartExam,
  onGoToExport,
  onAddMoreFiles
}) {
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'missing'
  const [searchQuery, setSearchQuery] = useState('');
  const [editingQuestionId, setEditingQuestionId] = useState(null);
  const [showQuickKeyModal, setShowQuickKeyModal] = useState(false);
  const [quickKeyString, setQuickKeyString] = useState('');

  const questions = exam.questions || [];
  const withAnswerCount = questions.filter(q => q.options.some(o => o.isCorrect)).length;
  const missingCount = questions.length - withAnswerCount;

  const handleTitleChange = (newTitle) => {
    onUpdateExam({
      ...exam,
      title: newTitle
    });
  };

  const handleSelectCorrectOption = (qId, optIndex) => {
    const updated = questions.map(q => {
      if (q.id !== qId) return q;
      return {
        ...q,
        options: q.options.map((o, idx) => ({
          ...o,
          isCorrect: idx === optIndex
        }))
      };
    });
    onUpdateExam({ ...exam, questions: updated });
  };

  const handleQuestionFieldChange = (qId, field, value) => {
    const updated = questions.map(q => (q.id === qId ? { ...q, [field]: value } : q));
    onUpdateExam({ ...exam, questions: updated });
  };

  const handleOptionTextChange = (qId, optIndex, newText) => {
    const updated = questions.map(q => {
      if (q.id !== qId) return q;
      const newOpts = q.options.map((o, idx) =>
        idx === optIndex ? { ...o, text: newText } : o
      );
      return { ...q, options: newOpts };
    });
    onUpdateExam({ ...exam, questions: updated });
  };

  const handleAddOption = (qId) => {
    const updated = questions.map(q => {
      if (q.id !== qId || q.options.length >= 6) return q;
      const nextLabel = String.fromCharCode(65 + q.options.length);
      return {
        ...q,
        options: [
          ...q.options,
          { label: nextLabel, text: `Phương án ${nextLabel}`, isCorrect: false }
        ]
      };
    });
    onUpdateExam({ ...exam, questions: updated });
  };

  const handleRemoveOption = (qId, optIndex) => {
    const updated = questions.map(q => {
      if (q.id !== qId || q.options.length <= 2) return q;
      const filtered = q.options
        .filter((_, idx) => idx !== optIndex)
        .map((o, idx) => ({ ...o, label: String.fromCharCode(65 + idx) }));
      return { ...q, options: filtered };
    });
    onUpdateExam({ ...exam, questions: updated });
  };

  const handleDeleteQuestion = (qId) => {
    const updated = questions
      .filter(q => q.id !== qId)
      .map((q, idx) => ({ ...q, number: idx + 1 }));
    onUpdateExam({ ...exam, questions: updated });
  };

  const handleAddQuestion = () => {
    const newId = `q-${Date.now()}`;
    const newQ = {
      id: newId,
      number: questions.length + 1,
      question: 'Nhập nội dung câu hỏi mới tại đây...',
      options: [
        { label: 'A', text: 'Phương án A', isCorrect: true },
        { label: 'B', text: 'Phương án B', isCorrect: false },
        { label: 'C', text: 'Phương án C', isCorrect: false },
        { label: 'D', text: 'Phương án D', isCorrect: false }
      ],
      explanation: ''
    };
    const updated = [...questions, newQ];
    onUpdateExam({ ...exam, questions: updated });
    setEditingQuestionId(newId);
  };

  const handleApplyQuickKey = () => {
    if (!quickKeyString.trim()) return;
    const keyMap = {};
    // Support formats: "1A 2B 3C" or "1.A, 2.B" OR pure letters "ABCDABCD"
    const pairRegex = /(?:Câu\s*)?(\d{1,3})\s*[\.\-\:\)]?\s*([A-F])\b/gi;
    let match;
    let foundPairs = false;
    while ((match = pairRegex.exec(quickKeyString)) !== null) {
      foundPairs = true;
      keyMap[parseInt(match[1], 10)] = match[2].toUpperCase();
    }

    if (!foundPairs) {
      const lettersOnly = quickKeyString.toUpperCase().replace(/[^A-F]/g, '');
      for (let i = 0; i < lettersOnly.length; i++) {
        keyMap[i + 1] = lettersOnly[i];
      }
    }

    const updated = questions.map((q, idx) => {
      const target = keyMap[idx + 1];
      if (!target) return q;
      return {
        ...q,
        options: q.options.map((o, oIdx) => ({
          ...o,
          isCorrect: String.fromCharCode(65 + oIdx) === target
        }))
      };
    });

    onUpdateExam({ ...exam, questions: updated });
    setShowQuickKeyModal(false);
    setQuickKeyString('');
  };

  const filteredQuestions = questions.filter(q => {
    if (filterMode === 'missing' && q.options.some(o => o.isCorrect)) {
      return false;
    }
    if (searchQuery.trim()) {
      const s = searchQuery.toLowerCase();
      const inQ = q.question.toLowerCase().includes(s);
      const inOpts = q.options.some(o => o.text.toLowerCase().includes(s));
      return inQ || inOpts;
    }
    return true;
  });

  const randomizeExamCode = () => {
    const randomCode = String(Math.floor(100 + Math.random() * 900));
    onUpdateConfig({ ...examConfig, examCode: randomCode });
  };

  return (
    <div>
      {/* Top Summary & Exam Title Card */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 20,
            flexWrap: 'wrap'
          }}
        >
          <div style={{ flex: 1, minWidth: 280 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <span className="badge badge-mono">{questions.length} CÂU HỎI</span>
              {missingCount === 0 ? (
                <span className="badge badge-green">
                  <IconCheck size={12} /> ĐÃ ĐỦ ĐÁP ÁN ({withAnswerCount}/{questions.length})
                </span>
              ) : (
                <span className="badge badge-yellow">
                  <IconAlert size={12} /> THIẾU {missingCount} ĐÁP ÁN ĐÚNG
                </span>
              )}
            </div>
            <input
              type="text"
              className="input"
              value={exam.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 24,
                fontWeight: 500,
                padding: '6px 10px',
                marginBottom: 4
              }}
              placeholder="Tên đề thi..."
            />
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
              Mẹo: Nhấp trực tiếp vào ô chữ cái <kbd>A</kbd> <kbd>B</kbd> <kbd>C</kbd> <kbd>D</kbd> ở từng câu bên dưới để đổi nhanh đáp án đúng.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              className="btn"
              onClick={() => setShowQuickKeyModal(!showQuickKeyModal)}
            >
              <IconKey size={16} />
              <span>Nhập nhanh bảng đáp án</span>
            </button>
            <button
              type="button"
              className="btn"
              onClick={onGoToExport}
            >
              <IconPrinter size={16} />
              <span>In đề / Xuất file</span>
            </button>
            <button
              type="button"
              className="btn btn-primary btn-lg"
              onClick={onStartExam}
              disabled={questions.length === 0}
            >
              <IconPlay size={16} />
              <span>Bắt đầu làm bài thi</span>
            </button>
          </div>
        </div>

        {/* Quick Answer Key Input Panel */}
        {showQuickKeyModal && (
          <div
            style={{
              marginTop: 18,
              padding: 16,
              background: 'var(--bg-canvas)',
              border: '1px solid var(--border-color)',
              borderRadius: 8
            }}
          >
            <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 6, color: 'var(--text-primary)' }}>
              Dán nhanh chuỗi đáp án cho toàn bộ đề thi
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 10 }}>
              Hỗ trợ nhập kiểu <kbd>1A 2B 3C 4D...</kbd> hoặc <kbd>1.A, 2.B, 3.C</kbd> hoặc chuỗi liền nhau <kbd>ABCDABCD...</kbd>
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <input
                type="text"
                className="input"
                style={{ flex: 1, fontFamily: 'var(--font-mono)' }}
                placeholder="Ví dụ: 1B 2C 3B 4D 5A 6C 7B 8D 9B 10C"
                value={quickKeyString}
                onChange={(e) => setQuickKeyString(e.target.value)}
              />
              <button type="button" className="btn btn-primary" onClick={handleApplyQuickKey}>
                Áp dụng đáp án
              </button>
              <button type="button" className="btn" onClick={() => setShowQuickKeyModal(false)}>
                Đóng
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="exam-layout">
        {/* Left: Question Bank Editor List */}
        <div>
          {/* Filter & Search Toolbar */}
          <div
            className="card card-compact"
            style={{
              marginBottom: 16,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap'
            }}
          >
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button
                type="button"
                className={`btn btn-sm ${filterMode === 'all' ? 'btn-primary' : ''}`}
                onClick={() => setFilterMode('all')}
              >
                Tất cả ({questions.length})
              </button>
              <button
                type="button"
                className={`btn btn-sm ${filterMode === 'missing' ? 'btn-primary' : ''}`}
                onClick={() => setFilterMode('missing')}
              >
                Chưa có đáp án ({missingCount})
              </button>
              <button
                type="button"
                className="btn btn-sm"
                onClick={handleAddQuestion}
              >
                <IconPlus size={14} />
                <span>Thêm câu hỏi</span>
              </button>
            </div>

            <div style={{ position: 'relative', minWidth: 230, flex: '0 1 280px' }}>
              <input
                type="text"
                className="input"
                style={{ paddingLeft: 32, paddingTop: 6, paddingBottom: 6, fontSize: 13 }}
                placeholder="Tìm kiếm câu hỏi..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <span
                style={{
                  position: 'absolute',
                  left: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                  display: 'flex'
                }}
              >
                <IconSearch size={15} />
              </span>
            </div>
          </div>

          {/* Question Cards */}
          <div style={{ display: 'grid', gap: 14 }}>
            {filteredQuestions.map((q) => {
              const isEditing = editingQuestionId === q.id;
              const hasCorrect = q.options.some(o => o.isCorrect);

              return (
                <div
                  key={q.id}
                  className="card card-compact"
                  style={{
                    borderColor: !hasCorrect ? 'var(--pastel-yellow-border)' : 'var(--border-color)'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: 12,
                      marginBottom: 12
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 12,
                          fontWeight: 600,
                          padding: '3px 9px',
                          borderRadius: 6,
                          background: 'var(--text-primary)',
                          color: '#FFFFFF'
                        }}
                      >
                        Câu {q.number}
                      </span>
                      {!hasCorrect && (
                        <span className="badge badge-yellow">Chưa chọn đáp án đúng</span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        className={`btn btn-sm ${isEditing ? 'btn-primary' : ''}`}
                        onClick={() => setEditingQuestionId(isEditing ? null : q.id)}
                      >
                        <IconEdit size={14} />
                        <span>{isEditing ? 'Xong' : 'Chỉnh sửa'}</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDeleteQuestion(q.id)}
                        title="Xóa câu hỏi"
                      >
                        <IconTrash size={14} />
                      </button>
                    </div>
                  </div>

                  {isEditing ? (
                    <div style={{ display: 'grid', gap: 12 }}>
                      <div>
                        <label className="field-label">Nội dung câu hỏi</label>
                        <textarea
                          className="textarea"
                          rows={2}
                          value={q.question}
                          onChange={(e) => handleQuestionFieldChange(q.id, 'question', e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="field-label">
                          Các phương án trả lời (Nhấp vào chữ cái để đặt làm đáp án đúng)
                        </label>
                        <div style={{ display: 'grid', gap: 8 }}>
                          {q.options.map((opt, oIdx) => (
                            <div key={oIdx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              <button
                                type="button"
                                onClick={() => handleSelectCorrectOption(q.id, oIdx)}
                                className="option-letter"
                                style={{
                                  cursor: 'pointer',
                                  background: opt.isCorrect ? 'var(--pastel-green-text)' : 'var(--bg-canvas)',
                                  color: opt.isCorrect ? '#FFFFFF' : 'var(--text-primary)',
                                  borderColor: opt.isCorrect ? 'var(--pastel-green-text)' : 'var(--border-color)'
                                }}
                                title="Đặt làm đáp án đúng"
                              >
                                {opt.label}
                              </button>
                              <input
                                type="text"
                                className="input"
                                value={opt.text}
                                onChange={(e) => handleOptionTextChange(q.id, oIdx, e.target.value)}
                              />
                              {q.options.length > 2 && (
                                <button
                                  type="button"
                                  className="btn btn-sm"
                                  onClick={() => handleRemoveOption(q.id, oIdx)}
                                  title="Xóa phương án này"
                                >
                                  ×
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                        {q.options.length < 6 && (
                          <button
                            type="button"
                            className="btn btn-sm"
                            style={{ marginTop: 8 }}
                            onClick={() => handleAddOption(q.id)}
                          >
                            <IconPlus size={13} /> Thêm phương án
                          </button>
                        )}
                      </div>

                      <div>
                        <label className="field-label">Lời giải / Giải thích chi tiết (tùy chọn)</label>
                        <textarea
                          className="textarea"
                          rows={2}
                          placeholder="Giải thích vì sao đáp án này đúng..."
                          value={q.explanation || ''}
                          onChange={(e) => handleQuestionFieldChange(q.id, 'explanation', e.target.value)}
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <div
                        style={{
                          fontSize: 15.5,
                          fontWeight: 500,
                          color: 'var(--text-primary)',
                          marginBottom: 14,
                          whiteSpace: 'pre-line'
                        }}
                      >
                        {q.question}
                      </div>

                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                          gap: 8
                        }}
                      >
                        {q.options.map((opt, oIdx) => (
                          <button
                            key={oIdx}
                            type="button"
                            className={`option-item ${opt.isCorrect ? 'correct' : ''}`}
                            onClick={() => handleSelectCorrectOption(q.id, oIdx)}
                            title="Nhấp để chọn làm đáp án đúng"
                          >
                            <span className="option-letter">{opt.label}</span>
                            <span style={{ fontSize: 14, color: 'var(--text-primary)', flex: 1 }}>
                              {opt.text}
                            </span>
                            {opt.isCorrect && (
                              <span
                                style={{
                                  fontFamily: 'var(--font-mono)',
                                  fontSize: 11,
                                  color: 'var(--pastel-green-text)',
                                  fontWeight: 600
                                }}
                              >
                                ĐÚNG
                              </span>
                            )}
                          </button>
                        ))}
                      </div>

                      {q.explanation && (
                        <div
                          style={{
                            marginTop: 12,
                            padding: '8px 12px',
                            borderRadius: 6,
                            background: 'var(--bg-canvas)',
                            border: '1px solid var(--border-color)',
                            fontSize: 13,
                            color: 'var(--text-body)'
                          }}
                        >
                          <strong style={{ color: 'var(--text-primary)' }}>Lời giải: </strong>
                          {q.explanation}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Sticky Sidebar: Exam Shuffle & Settings */}
        <div className="sticky-sidebar">
          <div className="card card-compact">
            <h3 className="card-title" style={{ fontSize: 18 }}>
              <span>Cấu hình & Trộn đề</span>
              <IconShuffle size={17} />
            </h3>
            <p className="card-subtitle" style={{ marginBottom: 16 }}>
              Thiết lập thông số phòng thi và thuật toán đảo ngẫu nhiên trước khi bắt đầu
            </p>

            <div style={{ marginBottom: 14 }}>
              <label className="field-label">Mã đề thi</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  className="input"
                  style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}
                  value={examConfig.examCode}
                  onChange={(e) => onUpdateConfig({ ...examConfig, examCode: e.target.value })}
                />
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={randomizeExamCode}
                  title="Tạo mã đề ngẫu nhiên"
                >
                  Đổi mã
                </button>
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label className="field-label">Thời gian làm bài (phút)</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 8 }}>
                {[15, 30, 45, 60].map(mins => (
                  <button
                    key={mins}
                    type="button"
                    className={`btn btn-sm ${Number(examConfig.duration) === mins ? 'btn-primary' : ''}`}
                    onClick={() => onUpdateConfig({ ...examConfig, duration: mins })}
                  >
                    {mins}p
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="number"
                  min="0"
                  max="300"
                  className="input"
                  value={examConfig.duration}
                  onChange={(e) => onUpdateConfig({ ...examConfig, duration: Math.max(0, Number(e.target.value)) })}
                />
                <button
                  type="button"
                  className={`btn btn-sm ${Number(examConfig.duration) === 0 ? 'btn-primary' : ''}`}
                  onClick={() => onUpdateConfig({ ...examConfig, duration: 0 })}
                >
                  Không giới hạn
                </button>
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label className="field-label">
                Số câu lấy ra thi (Tối đa: {questions.length} câu)
              </label>
              <input
                type="number"
                min="1"
                max={questions.length || 1}
                className="input"
                value={examConfig.questionLimit || questions.length}
                onChange={(e) =>
                  onUpdateConfig({
                    ...examConfig,
                    questionLimit: Math.min(questions.length, Math.max(1, Number(e.target.value)))
                  })
                }
              />
            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', marginTop: 10, paddingTop: 6 }}>
              <div className="toggle-row">
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>
                    Đảo thứ tự câu hỏi
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Xáo trộn ngẫu nhiên vị trí các câu
                  </div>
                </div>
                <button
                  type="button"
                  className={`switch ${examConfig.shuffleQuestions ? 'on' : ''}`}
                  onClick={() =>
                    onUpdateConfig({ ...examConfig, shuffleQuestions: !examConfig.shuffleQuestions })
                  }
                >
                  <span className="switch-knob" />
                </button>
              </div>

              <div className="toggle-row">
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>
                    Đảo thứ tự đáp án A, B, C, D
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Tự động cập nhật lại nhãn đúng
                  </div>
                </div>
                <button
                  type="button"
                  className={`switch ${examConfig.shuffleOptions ? 'on' : ''}`}
                  onClick={() =>
                    onUpdateConfig({ ...examConfig, shuffleOptions: !examConfig.shuffleOptions })
                  }
                >
                  <span className="switch-knob" />
                </button>
              </div>

              <div className="toggle-row">
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>
                    Chế độ Luyện tập (Báo đúng/sai ngay)
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Hiện đáp án & lời giải ngay khi chọn
                  </div>
                </div>
                <button
                  type="button"
                  className={`switch ${examConfig.instantFeedback ? 'on' : ''}`}
                  onClick={() =>
                    onUpdateConfig({ ...examConfig, instantFeedback: !examConfig.instantFeedback })
                  }
                >
                  <span className="switch-knob" />
                </button>
              </div>
            </div>

            <div style={{ marginTop: 18, display: 'grid', gap: 8 }}>
              <button
                type="button"
                className="btn btn-primary btn-lg"
                style={{ width: '100%' }}
                onClick={onStartExam}
                disabled={questions.length === 0}
              >
                <IconPlay size={16} />
                <span>Vào phòng thi ngay</span>
              </button>
              <button
                type="button"
                className="btn"
                style={{ width: '100%' }}
                onClick={onGoToExport}
              >
                <IconPrinter size={16} />
                <span>Xem bản in & Xuất đề</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
