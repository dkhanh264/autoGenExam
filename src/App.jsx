import React, { useState, useEffect } from 'react';
import UploadSection from './components/UploadSection';
import EditorSection from './components/EditorSection';
import ExamRunnerSection from './components/ExamRunnerSection';
import ExportPrintSection from './components/ExportPrintSection';
import {
  parseExamFile,
  parseStructuredTextExam,
  finalizeParsedExam,
  buildActiveExam
} from './utils/examParser';
import { SAMPLE_QUESTIONS } from './utils/examExporter';

const STORAGE_KEY = 'autogen_exam_library_v1';

export default function App() {
  const [activeTab, setActiveTab] = useState('upload'); // 'upload' | 'edit' | 'exam' | 'export'
  const [currentExam, setCurrentExam] = useState(null);
  const [activeExamInstance, setActiveExamInstance] = useState(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState('');

  const [examConfig, setExamConfig] = useState({
    examCode: '101',
    duration: 30,
    questionLimit: 10,
    shuffleQuestions: true,
    shuffleOptions: true,
    instantFeedback: false
  });

  const [savedExams, setSavedExams] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedExams));
    } catch {
      // ignore storage quota errors
    }
  }, [savedExams]);

  const upsertExamToLibrary = (examObj) => {
    setSavedExams(prev => {
      const exists = prev.some(item => item.id === examObj.id);
      if (exists) {
        return prev.map(item => (item.id === examObj.id ? examObj : item));
      }
      return [examObj, ...prev].slice(0, 25);
    });
  };

  const loadExamIntoWorkspace = (examObj, targetTab = 'edit') => {
    setCurrentExam(examObj);
    upsertExamToLibrary(examObj);

    const newConfig = {
      ...examConfig,
      questionLimit: examObj.questions.length
    };
    setExamConfig(newConfig);

    const shuffled = buildActiveExam(examObj.questions, newConfig);
    setActiveExamInstance(shuffled);
    setActiveTab(targetTab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFilesSelected = async (files) => {
    setIsParsing(true);
    setParseError('');
    try {
      let mergedQuestions = [];
      let titleParts = [];

      for (const file of files) {
        const parsed = await parseExamFile(file);
        titleParts.push(parsed.title);
        mergedQuestions = [...mergedQuestions, ...parsed.questions];
      }

      if (mergedQuestions.length === 0) {
        setParseError(
          'Không tìm thấy câu hỏi trắc nghiệm hợp lệ trong file đã chọn. Hãy kiểm tra lại định dạng (Câu 1: ... A. ... B. ... C. ... D. ...) hoặc thử tải File mẫu.'
        );
        setIsParsing(false);
        return;
      }

      const combinedTitle =
        titleParts.length === 1 ? titleParts[0] : `Đề tổng hợp (${titleParts.join(' + ')})`;
      const finalExam = finalizeParsedExam(combinedTitle, mergedQuestions);
      loadExamIntoWorkspace(finalExam, 'edit');
    } catch (err) {
      setParseError(err?.message || 'Không thể đọc file. Vui lòng thử lại.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleParseRawText = (rawText, customTitle) => {
    setParseError('');
    const parsed = parseStructuredTextExam(rawText, customTitle || 'Đề thi từ văn bản');
    if (parsed.questions.length === 0) {
      setParseError(
        'Không nhận diện được câu hỏi nào từ đoạn văn bản. Hãy đảm bảo có các phương án A. B. C. D.'
      );
      return;
    }
    loadExamIntoWorkspace(parsed, 'edit');
  };

  const handleLoadSampleExam = () => {
    setParseError('');
    const sampleExam = finalizeParsedExam(
      'Đề thi mẫu: Kiến thức nền tảng Công nghệ thông tin',
      SAMPLE_QUESTIONS
    );
    loadExamIntoWorkspace(sampleExam, 'edit');
  };

  const handleUpdateExam = (updatedExam) => {
    const finalized = {
      ...updatedExam,
      createdAt: new Date().toISOString()
    };
    setCurrentExam(finalized);
    upsertExamToLibrary(finalized);
  };

  const handleStartExam = () => {
    if (!currentExam || currentExam.questions.length === 0) return;
    const instance = buildActiveExam(currentExam.questions, examConfig);
    setActiveExamInstance(instance);
    setActiveTab('exam');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleReshuffleAndRestart = () => {
    if (!currentExam) return;
    const newCode = String(Math.floor(100 + Math.random() * 900));
    const nextConfig = { ...examConfig, examCode: newCode };
    setExamConfig(nextConfig);
    const instance = buildActiveExam(currentExam.questions, nextConfig);
    setActiveExamInstance(instance);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRetrySameExam = () => {
    if (!activeExamInstance) return;
    setActiveExamInstance({
      ...activeExamInstance,
      questions: activeExamInstance.questions.map(q => ({ ...q }))
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleGoToExport = () => {
    if (!currentExam) return;
    if (!activeExamInstance) {
      setActiveExamInstance(buildActiveExam(currentExam.questions, examConfig));
    }
    setActiveTab('export');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteSavedExam = (id) => {
    setSavedExams(prev => prev.filter(item => item.id !== id));
    if (currentExam?.id === id) {
      setCurrentExam(null);
      setActiveExamInstance(null);
      setActiveTab('upload');
    }
  };

  return (
    <div className="app-shell">
      <div className="ambient-canvas" />

      {/* Top Navigation Header */}
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand" onClick={() => setActiveTab('upload')}>
            <div className="brand-mark">K</div>
            <div>
              <div className="brand-title">Khảo Thí Số</div>
              <div className="brand-subtitle">AutoGen Exam Studio</div>
            </div>
          </div>

          <nav className="nav-steps">
            <button
              type="button"
              className={`nav-step-btn ${activeTab === 'upload' ? 'active' : ''}`}
              onClick={() => setActiveTab('upload')}
            >
              <span className="step-num">01</span>
              <span>Tải file đề</span>
            </button>

            <button
              type="button"
              className={`nav-step-btn ${activeTab === 'edit' ? 'active' : ''}`}
              disabled={!currentExam}
              onClick={() => setActiveTab('edit')}
            >
              <span className="step-num">02</span>
              <span>
                Soạn & Trộn đề {currentExam ? `(${currentExam.questions.length})` : ''}
              </span>
            </button>

            <button
              type="button"
              className={`nav-step-btn ${activeTab === 'exam' ? 'active' : ''}`}
              disabled={!currentExam}
              onClick={handleStartExam}
            >
              <span className="step-num">03</span>
              <span>Làm bài thi</span>
            </button>

            <button
              type="button"
              className={`nav-step-btn ${activeTab === 'export' ? 'active' : ''}`}
              disabled={!currentExam}
              onClick={handleGoToExport}
            >
              <span className="step-num">04</span>
              <span>In & Xuất file</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-container">
        {activeTab === 'upload' && (
          <UploadSection
            onFilesSelected={handleFilesSelected}
            onParseRawText={handleParseRawText}
            onLoadSampleExam={handleLoadSampleExam}
            savedExams={savedExams}
            onOpenSavedExam={(item, mode) =>
              loadExamIntoWorkspace(item, mode === 'config' ? 'exam' : 'edit')
            }
            onDeleteSavedExam={handleDeleteSavedExam}
            isParsing={isParsing}
            parseError={parseError}
          />
        )}

        {activeTab === 'edit' && currentExam && (
          <EditorSection
            exam={currentExam}
            onUpdateExam={handleUpdateExam}
            examConfig={examConfig}
            onUpdateConfig={setExamConfig}
            onStartExam={handleStartExam}
            onGoToExport={handleGoToExport}
          />
        )}

        {activeTab === 'exam' && currentExam && activeExamInstance && (
          <ExamRunnerSection
            examTitle={currentExam.title}
            activeExam={activeExamInstance}
            examConfig={examConfig}
            onReshuffleAndRestart={handleReshuffleAndRestart}
            onRetrySameExam={handleRetrySameExam}
            onBackToEditor={() => setActiveTab('edit')}
            onGoToExport={() => setActiveTab('export')}
          />
        )}

        {activeTab === 'export' && currentExam && activeExamInstance && (
          <ExportPrintSection
            examTitle={currentExam.title}
            activeExam={activeExamInstance}
            examConfig={examConfig}
            onReshuffleNewVariant={handleReshuffleAndRestart}
            onBackToEditor={() => setActiveTab('edit')}
          />
        )}
      </main>
    </div>
  );
}
