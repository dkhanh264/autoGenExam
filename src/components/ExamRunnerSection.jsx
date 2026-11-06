import React, { useState, useEffect, useCallback } from 'react';
import {
  IconClock,
  IconFlag,
  IconCheck,
  IconX,
  IconShuffle,
  IconRefresh,
  IconArrowLeft,
  IconArrowRight,
  IconPrinter
} from './Icons';

export default function ExamRunnerSection({
  examTitle,
  activeExam,
  examConfig,
  onReshuffleAndRestart,
  onRetrySameExam,
  onBackToEditor,
  onGoToExport
}) {
  const questions = activeExam?.questions || [];
  const totalQuestions = questions.length;

  const [answers, setAnswers] = useState({}); // { [questionId]: optionIndex }
  const [flagged, setFlagged] = useState({}); // { [questionId]: boolean }
  const [viewMode, setViewMode] = useState('scroll'); // 'scroll' | 'single'
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [confirmingSubmit, setConfirmingSubmit] = useState(false);
  const [reviewFilter, setReviewFilter] = useState('all'); // 'all' | 'wrong' | 'correct' | 'unanswered'

  const durationSeconds = (Number(examConfig.duration) || 0) * 60;
  const [secondsLeft, setSecondsLeft] = useState(durationSeconds);
  const [secondsElapsed, setSecondsElapsed] = useState(0);

  // Reset state whenever activeExam changes
  useEffect(() => {
    setAnswers({});
    setFlagged({});
    setCurrentIndex(0);
    setIsSubmitted(false);
    setConfirmingSubmit(false);
    setReviewFilter('all');
    setSecondsLeft((Number(examConfig.duration) || 0) * 60);
    setSecondsElapsed(0);
  }, [activeExam, examConfig.duration]);

  // Timer interval
  useEffect(() => {
    if (isSubmitted) return;
    const timer = setInterval(() => {
      setSecondsElapsed(prev => prev + 1);
      if (durationSeconds > 0) {
        setSecondsLeft(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            setIsSubmitted(true);
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isSubmitted, durationSeconds]);

  const handleSelectOption = useCallback((qId, optIndex) => {
    if (isSubmitted) return;
    setAnswers(prev => ({
      ...prev,
      [qId]: optIndex
    }));
  }, [isSubmitted]);

  const handleToggleFlag = useCallback((qId) => {
    setFlagged(prev => ({
      ...prev,
      [qId]: !prev[qId]
    }));
  }, []);

  // Keyboard shortcuts in single question mode
  useEffect(() => {
    if (isSubmitted || viewMode !== 'single') return;
    const currentQ = questions[currentIndex];
    if (!currentQ) return;

    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      const key = e.key.toUpperCase();
      if (['A', 'B', 'C', 'D', 'E', 'F'].includes(key)) {
        const optIdx = key.charCodeAt(0) - 65;
        if (optIdx < currentQ.options.length) {
          handleSelectOption(currentQ.id, optIdx);
        }
      } else if (['1', '2', '3', '4', '5', '6'].includes(key)) {
        const optIdx = parseInt(key, 10) - 1;
        if (optIdx < currentQ.options.length) {
          handleSelectOption(currentQ.id, optIdx);
        }
      } else if (e.key === 'ArrowRight') {
        setCurrentIndex(prev => Math.min(totalQuestions - 1, prev + 1));
      } else if (e.key === 'ArrowLeft') {
        setCurrentIndex(prev => Math.max(0, prev - 1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSubmitted, viewMode, currentIndex, questions, totalQuestions, handleSelectOption]);

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const answeredCount = Object.keys(answers).length;
  const unansweredCount = totalQuestions - answeredCount;

  // Compute Grading Results
  let correctCount = 0;
  let wrongCount = 0;
  let skippedCount = 0;

  questions.forEach(q => {
    const chosenIdx = answers[q.id];
    if (chosenIdx === undefined) {
      skippedCount++;
    } else if (q.options[chosenIdx]?.isCorrect) {
      correctCount++;
    } else {
      wrongCount++;
    }
  });

  const score10 = totalQuestions > 0 ? ((correctCount / totalQuestions) * 10).toFixed(2) : '0.00';
  const accuracyPercent = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

  const handleJumpToQuestion = (idx, qId) => {
    setCurrentIndex(idx);
    if (viewMode === 'scroll') {
      const el = document.getElementById(`exam-q-${qId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  const handleRequestSubmit = () => {
    if (unansweredCount > 0 && !confirmingSubmit) {
      setConfirmingSubmit(true);
      return;
    }
    setIsSubmitted(true);
    setConfirmingSubmit(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderQuestionCard = (q, idx) => {
    const chosenIdx = answers[q.id];
    const isAnswered = chosenIdx !== undefined;
    const showFeedback = isSubmitted || (examConfig.instantFeedback && isAnswered);
    const isFlagged = Boolean(flagged[q.id]);

    return (
      <div
        key={q.id}
        id={`exam-q-${q.id}`}
        className="card card-compact"
        style={{
          marginBottom: 16,
          borderColor: isFlagged ? 'var(--pastel-yellow-border)' : 'var(--border-color)'
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
            gap: 10
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12.5,
                fontWeight: 600,
                padding: '3px 10px',
                borderRadius: 6,
                background: 'var(--text-primary)',
                color: '#FFFFFF'
              }}
            >
              Câu {idx + 1}
            </span>

            {showFeedback && (
              isAnswered ? (
                q.options[chosenIdx]?.isCorrect ? (
                  <span className="badge badge-green">
                    <IconCheck size={12} /> Chính xác
                  </span>
                ) : (
                  <span className="badge badge-red">
                    <IconX size={12} /> Chưa đúng
                  </span>
                )
              ) : (
                <span className="badge badge-yellow">Bỏ trống</span>
              )
            )}
          </div>

          <button
            type="button"
            className="btn btn-sm"
            onClick={() => handleToggleFlag(q.id)}
            style={{
              background: isFlagged ? 'var(--pastel-yellow-bg)' : 'var(--bg-surface)',
              color: isFlagged ? 'var(--pastel-yellow-text)' : 'var(--text-muted)',
              borderColor: isFlagged ? 'var(--pastel-yellow-border)' : 'var(--border-color)'
            }}
          >
            <IconFlag size={14} />
            <span>{isFlagged ? 'Đã đánh dấu' : 'Đánh dấu xem lại'}</span>
          </button>
        </div>

        <div
          style={{
            fontSize: 16,
            fontWeight: 500,
            color: 'var(--text-primary)',
            marginBottom: 16,
            whiteSpace: 'pre-line',
            lineHeight: 1.55
          }}
        >
          {q.question}
        </div>

        <div style={{ display: 'grid', gap: 9 }}>
          {q.options.map((opt, oIdx) => {
            const isSelected = chosenIdx === oIdx;
            let stateClass = '';

            if (showFeedback) {
              if (opt.isCorrect) {
                stateClass = 'correct';
              } else if (isSelected && !opt.isCorrect) {
                stateClass = 'wrong';
              }
            } else if (isSelected) {
              stateClass = 'selected';
            }

            return (
              <button
                key={oIdx}
                type="button"
                className={`option-item ${stateClass}`}
                onClick={() => handleSelectOption(q.id, oIdx)}
                disabled={isSubmitted}
              >
                <span className="option-letter">{opt.label}</span>
                <span style={{ fontSize: 14.5, color: 'var(--text-primary)', flex: 1 }}>
                  {opt.text}
                </span>

                {showFeedback && opt.isCorrect && (
                  <span className="badge badge-green">Đáp án đúng</span>
                )}
                {showFeedback && isSelected && !opt.isCorrect && (
                  <span className="badge badge-red">Bạn chọn</span>
                )}
              </button>
            );
          })}
        </div>

        {showFeedback && q.explanation && (
          <div
            style={{
              marginTop: 14,
              padding: '10px 14px',
              borderRadius: 6,
              background: 'var(--bg-canvas)',
              border: '1px solid var(--border-color)',
              fontSize: 13.5,
              color: 'var(--text-body)'
            }}
          >
            <strong style={{ color: 'var(--text-primary)' }}>Giải thích chi tiết: </strong>
            {q.explanation}
          </div>
        )}
      </div>
    );
  };

  const filteredReviewQuestions = questions
    .map((q, idx) => ({ q, idx }))
    .filter(({ q }) => {
      if (!isSubmitted || reviewFilter === 'all') return true;
      const chosenIdx = answers[q.id];
      if (reviewFilter === 'unanswered') return chosenIdx === undefined;
      if (reviewFilter === 'correct') return chosenIdx !== undefined && q.options[chosenIdx]?.isCorrect;
      if (reviewFilter === 'wrong') return chosenIdx !== undefined && !q.options[chosenIdx]?.isCorrect;
      return true;
    });

  return (
    <div>
      {/* Grading Summary Banner when Submitted */}
      {isSubmitted && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 20,
              paddingBottom: 20,
              borderBottom: '1px solid var(--border-color)'
            }}
          >
            <div>
              <div className="eyebrow-badge" style={{ marginBottom: 8 }}>
                KẾT QUẢ CHẤM THI TỰ ĐỘNG • MÃ ĐỀ {activeExam.examCode}
              </div>
              <h2 className="editorial-title" style={{ fontSize: 30, marginBottom: 4 }}>
                {examTitle}
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                Hoàn thành trong <strong>{formatTime(secondsElapsed)}</strong> • Đạt tỷ lệ chính xác{' '}
                <strong>{accuracyPercent}%</strong>
              </p>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 8,
                padding: '14px 24px',
                borderRadius: 10,
                background: 'var(--bg-canvas)',
                border: '1px solid var(--border-color)'
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: 44,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  lineHeight: 1
                }}
              >
                {score10}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text-muted)' }}>
                / 10 ĐIỂM
              </span>
            </div>
          </div>

          {/* Stats Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: 12,
              marginTop: 20,
              marginBottom: 20
            }}
          >
            <div
              style={{
                padding: 14,
                borderRadius: 8,
                background: 'var(--pastel-green-bg)',
                color: 'var(--pastel-green-text)'
              }}
            >
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase' }}>
                Số câu trả lời đúng
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                {correctCount} / {totalQuestions}
              </div>
            </div>

            <div
              style={{
                padding: 14,
                borderRadius: 8,
                background: 'var(--pastel-red-bg)',
                color: 'var(--pastel-red-text)'
              }}
            >
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase' }}>
                Số câu trả lời sai
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                {wrongCount}
              </div>
            </div>

            <div
              style={{
                padding: 14,
                borderRadius: 8,
                background: 'var(--pastel-yellow-bg)',
                color: 'var(--pastel-yellow-text)'
              }}
            >
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase' }}>
                Số câu chưa làm
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                {skippedCount}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button
                type="button"
                className={`btn btn-sm ${reviewFilter === 'all' ? 'btn-primary' : ''}`}
                onClick={() => setReviewFilter('all')}
              >
                Tất cả ({totalQuestions})
              </button>
              <button
                type="button"
                className={`btn btn-sm ${reviewFilter === 'wrong' ? 'btn-primary' : ''}`}
                onClick={() => setReviewFilter('wrong')}
              >
                Câu làm sai ({wrongCount})
              </button>
              <button
                type="button"
                className={`btn btn-sm ${reviewFilter === 'correct' ? 'btn-primary' : ''}`}
                onClick={() => setReviewFilter('correct')}
              >
                Câu làm đúng ({correctCount})
              </button>
              <button
                type="button"
                className={`btn btn-sm ${reviewFilter === 'unanswered' ? 'btn-primary' : ''}`}
                onClick={() => setReviewFilter('unanswered')}
              >
                Bỏ trống ({skippedCount})
              </button>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="btn" onClick={onRetrySameExam}>
                <IconRefresh size={15} />
                <span>Làm lại đề này</span>
              </button>
              <button type="button" className="btn btn-primary" onClick={onReshuffleAndRestart}>
                <IconShuffle size={15} />
                <span>Đảo mã đề mới & Thi lại</span>
              </button>
              <button type="button" className="btn" onClick={onGoToExport}>
                <IconPrinter size={15} />
                <span>In / Xuất mã đề này</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Exam Control Bar (Before Submit) */}
      {!isSubmitted && (
        <div
          className="card card-compact"
          style={{
            marginBottom: 20,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="badge badge-mono">MÃ ĐỀ {activeExam.examCode}</span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 16 }}>
                {examTitle}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="nav-steps">
              <button
                type="button"
                className={`nav-step-btn ${viewMode === 'scroll' ? 'active' : ''}`}
                onClick={() => setViewMode('scroll')}
              >
                Xem toàn bộ
              </button>
              <button
                type="button"
                className={`nav-step-btn ${viewMode === 'single' ? 'active' : ''}`}
                onClick={() => setViewMode('single')}
              >
                Từng câu một
              </button>
            </div>

            <button type="button" className="btn btn-sm" onClick={onReshuffleAndRestart}>
              <IconShuffle size={14} />
              <span>Trộn đề lại</span>
            </button>
          </div>
        </div>
      )}

      <div className="exam-layout">
        {/* Main Question Area */}
        <div>
          {!isSubmitted && viewMode === 'single' ? (
            <div>
              {questions[currentIndex] && renderQuestionCard(questions[currentIndex], currentIndex)}

              <div
                className="card card-compact"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                  flexWrap: 'wrap'
                }}
              >
                <button
                  type="button"
                  className="btn"
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                >
                  <IconArrowLeft size={16} />
                  <span>Câu trước</span>
                </button>

                <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                  Phím tắt: <kbd>A</kbd> <kbd>B</kbd> <kbd>C</kbd> <kbd>D</kbd> chọn đáp án •{' '}
                  <kbd>←</kbd> <kbd>→</kbd> chuyển câu
                </div>

                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={currentIndex >= totalQuestions - 1}
                  onClick={() => setCurrentIndex(prev => Math.min(totalQuestions - 1, prev + 1))}
                >
                  <span>Câu tiếp theo</span>
                  <IconArrowRight size={16} />
                </button>
              </div>
            </div>
          ) : (
            <div>
              {filteredReviewQuestions.map(({ q, idx }) => renderQuestionCard(q, idx))}
            </div>
          )}
        </div>

        {/* Right Sticky Sidebar: Timer & Question Palette */}
        <div className="sticky-sidebar">
          <div className="card card-compact">
            {/* Timer Box */}
            <div
              style={{
                padding: '14px 16px',
                borderRadius: 8,
                background:
                  !isSubmitted && durationSeconds > 0 && secondsLeft < 120
                    ? 'var(--pastel-red-bg)'
                    : 'var(--bg-canvas)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 16
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <IconClock size={18} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>
                  {durationSeconds > 0 ? 'Thời gian còn lại' : 'Thời gian làm bài'}
                </span>
              </div>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 20,
                  fontWeight: 700,
                  color:
                    !isSubmitted && durationSeconds > 0 && secondsLeft < 120
                      ? 'var(--pastel-red-text)'
                      : 'var(--text-primary)'
                }}
              >
                {durationSeconds > 0 ? formatTime(secondsLeft) : formatTime(secondsElapsed)}
              </span>
            </div>

            {/* Progress Bar */}
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 12.5,
                  marginBottom: 6,
                  color: 'var(--text-muted)'
                }}
              >
                <span>Tiến độ hoàn thành</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {answeredCount} / {totalQuestions} câu
                </span>
              </div>
              <div
                style={{
                  height: 6,
                  borderRadius: 999,
                  background: 'var(--bg-canvas)',
                  overflow: 'hidden',
                  border: '1px solid var(--border-color)'
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0}%`,
                    background: 'var(--text-primary)',
                    transition: 'width 0.2s ease'
                  }}
                />
              </div>
            </div>

            {/* Question Palette */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
                Bảng điều hướng câu hỏi
              </div>
              <div className="palette-grid">
                {questions.map((q, idx) => {
                  const chosenIdx = answers[q.id];
                  const isAnswered = chosenIdx !== undefined;
                  const isFlagged = Boolean(flagged[q.id]);

                  let statusClass = '';
                  if (isSubmitted) {
                    if (isAnswered && q.options[chosenIdx]?.isCorrect) {
                      statusClass = 'res-correct';
                    } else {
                      statusClass = 'res-wrong';
                    }
                  } else if (isAnswered) {
                    statusClass = 'answered';
                  }

                  return (
                    <button
                      key={q.id}
                      type="button"
                      className={`palette-cell ${statusClass} ${isFlagged ? 'flagged' : ''} ${
                        viewMode === 'single' && currentIndex === idx ? 'current' : ''
                      }`}
                      onClick={() => handleJumpToQuestion(idx, q.id)}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Legend */}
            <div
              style={{
                display: 'flex',
                gap: 12,
                flexWrap: 'wrap',
                fontSize: 11.5,
                color: 'var(--text-muted)',
                paddingTop: 10,
                borderTop: '1px solid var(--border-color)',
                marginBottom: 16
              }}
            >
              <span>■ Đã chọn</span>
              <span>□ Chưa làm</span>
              <span style={{ color: '#D97706' }}>● Đánh dấu</span>
            </div>

            {/* Submit or Post-Submit Actions */}
            {!isSubmitted ? (
              <div>
                {confirmingSubmit && unansweredCount > 0 && (
                  <div
                    style={{
                      padding: 10,
                      borderRadius: 6,
                      background: 'var(--pastel-yellow-bg)',
                      color: 'var(--pastel-yellow-text)',
                      border: '1px solid var(--pastel-yellow-border)',
                      fontSize: 12.5,
                      marginBottom: 10
                    }}
                  >
                    Bạn còn <strong>{unansweredCount} câu chưa trả lời</strong>. Nhấn lại nút bên dưới để xác nhận nộp bài.
                  </div>
                )}

                <button
                  type="button"
                  className="btn btn-primary btn-lg"
                  style={{ width: '100%' }}
                  onClick={handleRequestSubmit}
                >
                  <IconCheck size={16} />
                  <span>{confirmingSubmit ? 'Xác nhận nộp bài ngay' : 'Nộp bài & Chấm điểm'}</span>
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                  onClick={onReshuffleAndRestart}
                >
                  <IconShuffle size={15} />
                  <span>Đảo đề mới & Làm lại</span>
                </button>
                <button
                  type="button"
                  className="btn"
                  style={{ width: '100%' }}
                  onClick={onBackToEditor}
                >
                  <span>Quay lại chỉnh sửa đề</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
