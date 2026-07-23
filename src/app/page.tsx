'use client';

import { useState, useEffect, useRef } from 'react';
import { useSessionStore } from '@/stores/useSessionStore';
import { useCharacterStore } from '@/stores/useCharacterStore';
import { useUserStore } from '@/stores/useUserStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useCortisolStore } from '@/stores/useCortisolStore';

// Components
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Modal from '@/components/ui/Modal';
import WelcomeClock from '@/components/ui/WelcomeClock';
import CharacterDialogue from '@/components/character/CharacterDialogue';
import CharacterAvatar from '@/components/character/CharacterAvatar';
import MoodMeter from '@/components/mood/MoodMeter';
import StudyTimer from '@/components/timer/StudyTimer';
import TimerControls from '@/components/timer/TimerControls';
import DocumentUploader from '@/components/study/DocumentUploader';
import StudyMaterials from '@/components/study/StudyMaterials';
import QuizModal from '@/components/quiz/QuizModal';
import FocusWarning from '@/components/focus/FocusWarning';
import CassettePlayer from '@/components/music/CassettePlayer';
import AchievementPopup from '@/components/gamification/AchievementPopup';
import ProfileCard from '@/components/gamification/ProfileCard';
import DashboardView from '@/components/dashboard/DashboardView';
import StudyHub from '@/components/study/StudyHub';

// Focus monitor
import { FocusMonitor } from '@/lib/focus/focus-monitor';
import { QuizEngine } from '@/lib/quiz/quiz-engine';

// Types
import type { StudyDocument, QuizQuestion, QuizResult, DocumentType, TimerMode } from '@/types';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'study' | 'dashboard' | 'browser'>('study');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const isSelectingFileRef = useRef(false);
  
  // RAG & Quiz states
  const [documents, setDocuments] = useState<StudyDocument[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [quizOpen, setQuizOpen] = useState(false);
  const [isLoadingQuiz, setIsLoadingQuiz] = useState(false);
  const [quizResults, setQuizResults] = useState<QuizResult[]>([]);

  // Stores
  const { setWindowFocused, setIdle, incrementTabSwitch, recordActivity, isRunning, isBreak } = useSessionStore();
  const { idleTimeoutSeconds, openaiApiKey, updateSettings, defaultTimerMode, quizIntervalMinutes, quizDifficulty, voice, enableBGM, bgmVolume } = useSettingsStore();
  const { currentEmotion, setEmotion, setDialogue, adjustMood } = useCharacterStore();
  const { addXP, checkAchievements, updateStreak } = useUserStore();

  // Load documents and quiz results from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedDocs = localStorage.getItem('dazai_documents');
      if (storedDocs) setDocuments(JSON.parse(storedDocs));

      const storedResults = localStorage.getItem('dazai_quiz_results');
      if (storedResults) setQuizResults(JSON.parse(storedResults));

      const storedApiKey = localStorage.getItem('dazai_openai_api_key');
      if (storedApiKey) {
        useSettingsStore.getState().setApiKey(storedApiKey);
      }

      // Sync initial timer mode with settings
      const initialMode = useSettingsStore.getState().defaultTimerMode;
      useSessionStore.getState().setTimerMode(initialMode);
    }
  }, []);

  // Sync state changes with localStorage
  const saveDocuments = (docs: StudyDocument[]) => {
    setDocuments(docs);
    localStorage.setItem('dazai_documents', JSON.stringify(docs));
  };

  const saveQuizResults = (results: QuizResult[]) => {
    setQuizResults(results);
    localStorage.setItem('dazai_quiz_results', JSON.stringify(results));
  };

  // Reset file selection flag when window gets focus (in case cancel was clicked)
  useEffect(() => {
    const handleFocus = () => {
      isSelectingFileRef.current = false;
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  // Setup focus monitoring
  useEffect(() => {
    const monitor = new FocusMonitor(
      {
        onFocusLost: () => {
          if (isSelectingFileRef.current) {
            // Ignore focus loss when user is selecting study materials
            return;
          }
          setWindowFocused(false);
        },
        onFocusRegained: (away) => {
          isSelectingFileRef.current = false;
          setWindowFocused(true);
          if (isRunning && !isBreak && away > 10) {
            setEmotion('concerned');
            setDialogue(`Ah, welcome back. I was beginning to think you'd abandoned your study session altogether~`);
            adjustMood(-5);
          }
        },
        onIdle: () => setIdle(true),
        onActivity: () => recordActivity(),
      },
      idleTimeoutSeconds
    );

    monitor.start();

    const handleVisibility = () => {
      if (document.hidden) {
        incrementTabSwitch();
        if (isRunning && !isBreak) {
          adjustMood(-3);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      monitor.stop();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [setWindowFocused, setIdle, recordActivity, incrementTabSwitch, idleTimeoutSeconds, isRunning, isBreak, setEmotion, setDialogue, adjustMood]);

  // Synchronize focus lock state in Electron (stay on top, prevent exit/cheating during timer)
  useEffect(() => {
    const win = window as any;
    if (typeof window !== 'undefined' && win.electronAPI && win.electronAPI.setFocusLock) {
      const isStudyActive = isRunning && !isBreak;
      win.electronAPI.setFocusLock(isStudyActive).catch((err: unknown) => {
        console.error('Failed to set focus lock:', err);
      });
    }
  }, [isRunning, isBreak]);

  // Periodic Dazai Cheer Up lines during active study sessions (every 45 seconds - visual only)
  useEffect(() => {
    if (!isRunning || isBreak || quizOpen) return;

    const CHEER_LINES = [
      "You're doing amazing! Let's finish this section, and then maybe we can go get some crab together~",
      "Keep going! Even I am impressed by how hard you're working today.",
      "Ah, you look so focused! Truly, my favorite student.",
      "Don't give up! Just a little bit more, and then you can take a sweet break.",
      "You've got this! I'm right here by your side watching you succeed.",
      "Such diligence! It makes me want to study too... well, almost~",
      "Keep it up! Your efforts today are truly beautiful.",
      "Don't strain yourself too hard, okay? I'd hate to see you get tired.",
      "Watching you study so hard makes me feel quite motivated myself!"
    ];

    const interval = setInterval(() => {
      const line = CHEER_LINES[Math.floor(Math.random() * CHEER_LINES.length)];
      setDialogue(line);
      setEmotion(Math.random() > 0.5 ? 'motivated' : 'happy');
      adjustMood(2);
      // NOTE: We do NOT call triggerVoice() here so that these frequent text changes remain silent (visual only).
    }, 45000);

    return () => clearInterval(interval);
  }, [isRunning, isBreak, quizOpen, setDialogue, setEmotion, adjustMood]);

  // Periodic Dazai Neutral voice lines during active study sessions (every 10 to 15 minutes - plays audio)
  useEffect(() => {
    if (!isRunning || isBreak || quizOpen) return;

    const NEUTRAL_LINES = [
      "Hmm, you're studying quite diligently. Don't push yourself too hard~",
      "A relaxed study pace is the best, isn't it? Just keep going.",
      "Still working? How admirable. I suppose I'll keep you company.",
      "I'm just sitting here, watching you work. Let me know if you need anything.",
      "Just floating around... don't mind me, focus on your notes.",
      "Steady progress is key. Let's keep a relaxed, neutral focus.",
      "No rush, no stress. Just take it step by step."
    ];

    const triggerPeriodicNeutralLine = () => {
      const line = NEUTRAL_LINES[Math.floor(Math.random() * NEUTRAL_LINES.length)];
      setDialogue(line);
      setEmotion('neutral');
      adjustMood(1);
      // Trigger voice playback synchronously (since this is triggered by the interval, we call triggerVoice)
      useCharacterStore.getState().triggerVoice();
    };

    // Schedule next trigger at a random time between 10 and 15 minutes (600,000 to 900,000 ms)
    const getNextInterval = () => Math.floor(Math.random() * (900000 - 600000 + 1)) + 600000;
    
    let timerId: NodeJS.Timeout;

    const scheduleNext = () => {
      timerId = setTimeout(() => {
        triggerPeriodicNeutralLine();
        scheduleNext();
      }, getNextInterval());
    };

    scheduleNext();

    return () => clearTimeout(timerId);
  }, [isRunning, isBreak, quizOpen, setDialogue, setEmotion, adjustMood]);

  // Handle Document Upload
  const handleUpload = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    const headers: Record<string, string> = {};
    if (openaiApiKey) {
      headers['x-api-key'] = openaiApiKey;
    }

    try {
      setDialogue("Analyzing document... Dazai is scanning the pages for knowledge.");
      setEmotion('motivated');

      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Upload failed with status ${res.status}`);
      }

      const data = await res.json();
      
      const fileExt = file.name.split('.').pop()?.toLowerCase();
      const docType: DocumentType = 
        fileExt === 'pdf' || fileExt === 'docx' || fileExt === 'txt' || fileExt === 'pptx'
          ? fileExt
          : 'txt';

      const newDoc: StudyDocument = {
        id: `doc_${Date.now()}`,
        name: file.name,
        type: docType,
        uploadedAt: Date.now(),
        extractedText: data.text,
        topics: data.topics || [],
        summary: data.summary || '',
        isProcessed: true,
      };

      const updatedDocs = [...documents, newDoc];
      saveDocuments(updatedDocs);
      setSelectedDocId(newDoc.id);

      setEmotion('proud');
      setDialogue(`I've absorbed "${file.name}". Let's see if you can master it as easily as I did~`);
      
      // Award XP for uploading material
      addXP({
        type: 'achievement',
        amount: 15,
        description: 'Uploaded study material',
        timestamp: Date.now(),
      });
      checkAchievements();
    } catch (err: any) {
      console.error(err);
      setEmotion('annoyed');
      setDialogue(`Oh dear, that didn't go well: ${err.message || 'Are you sure the file isn\'t corrupted?'}`);
    }
  };

  const handleAddYoutubeUrl = async (url: string) => {
    let videoId = '';
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.hostname.includes('youtube.com')) {
        videoId = parsedUrl.searchParams.get('v') || '';
      } else if (parsedUrl.hostname.includes('youtu.be')) {
        videoId = parsedUrl.pathname.slice(1);
      }
    } catch (e) {
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
      const match = url.match(regExp);
      if (match && match[2].length === 11) {
        videoId = match[2];
      }
    }

    if (!videoId) {
      setDialogue("That doesn't look like a valid YouTube URL. Let's try to paste a correct link!");
      setEmotion('concerned');
      return;
    }

    try {
      setDialogue("Analyzing YouTube video... Dazai is reading the video details.");
      setEmotion('motivated');

      const res = await fetch('/api/youtube/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      if (!res.ok) {
        throw new Error('Analysis failed');
      }

      const data = await res.json();

      const newDoc: StudyDocument = {
        id: `yt_${Date.now()}`,
        name: data.title || `YouTube Video: ${videoId}`,
        type: 'youtube',
        uploadedAt: Date.now(),
        extractedText: `YouTube Video: ${data.title}\nVideo ID: ${videoId}\nURL: ${url}\n\nDescription:\n${data.description}\n\nSummary:\n${data.summary}`,
        topics: ['Video', 'YouTube'],
        summary: data.description ? (data.description.length > 200 ? data.description.substring(0, 200) + '...' : data.description) : 'Linked YouTube Video',
        isProcessed: true,
      };

      const updatedDocs = [...documents, newDoc];
      saveDocuments(updatedDocs);
      setSelectedDocId(newDoc.id);

      setEmotion('happy');
      setDialogue(`Linked "${data.title || 'video'}"! I've analyzed its details, so you can test yourself on it now~`);
    } catch (err) {
      console.error(err);
      
      const newDoc: StudyDocument = {
        id: `yt_${Date.now()}`,
        name: `YouTube Video: ${videoId}`,
        type: 'youtube',
        uploadedAt: Date.now(),
        extractedText: `YouTube Video URL: ${url}\nVideo ID: ${videoId}\n\nStudy concepts related to this topic.`,
        topics: ['Video'],
        summary: 'Linked YouTube Video Link',
        isProcessed: true,
      };

      const updatedDocs = [...documents, newDoc];
      saveDocuments(updatedDocs);
      setSelectedDocId(newDoc.id);

      setEmotion('concerned');
      setDialogue("I couldn't fetch the video details automatically, but I've linked the URL anyway. You can still watch it!");
    }
  };

  const handleDeleteDoc = (id: string) => {
    const updated = documents.filter((d) => d.id !== id);
    saveDocuments(updated);
    if (selectedDocId === id) setSelectedDocId(null);
  };

  // Generate Quiz
  const handleTriggerQuiz = async (docId?: string) => {
    const targetDocId = docId || selectedDocId;
    if (!targetDocId) return;

    const doc = documents.find((d) => d.id === targetDocId);
    if (!doc) return;

    const key = openaiApiKey || '';

    setIsLoadingQuiz(true);
    setDialogue("Crafting some witty questions for you... Try not to fail, okay?");
    setEmotion('excited');

    try {
      const engine = new QuizEngine();
      const questions = await engine.generateQuestions(
        doc.topics,
        doc.extractedText,
        quizDifficulty,
        3,
        key
      );

      if (questions && questions.length > 0) {
        setQuizQuestions(questions);
        setActiveQuestionIndex(0);
        setQuizOpen(true);
        setEmotion('neutral');
        setDialogue("Here are your questions. Let's see what you've got.");
      } else {
        setDialogue("I couldn't come up with any questions. Maybe the content is too simple?");
        setEmotion('disappointed');
      }
    } catch (err: any) {
      console.error(err);
      if (err.message === 'API_KEY_MISSING') {
        setDialogue("I need an OpenAI API Key to generate custom quizzes! Please add it to your .env file or enter it in Settings.");
        setEmotion('concerned');
        setIsSettingsOpen(true);
      } else {
        setDialogue("Something went wrong with the quiz generator. Let's blame the servers.");
        setEmotion('annoyed');
      }
    } finally {
      setIsLoadingQuiz(false);
    }
  };

  // Handle Quiz Answer
  const handleQuizAnswer = (answer: string, isCorrect: boolean) => {
    const q = quizQuestions[activeQuestionIndex];
    if (!q) return;

    const result: QuizResult = {
      questionId: q.id,
      userAnswer: answer,
      isCorrect,
      aiExplanation: isCorrect
        ? `Correct! The answer is: ${q.correctAnswer}`
        : `Incorrect. The correct answer was: ${q.correctAnswer}`,
      characterReaction: isCorrect ? 'proud' : 'disappointed',
      timestamp: Date.now(),
      xpEarned: isCorrect ? 25 : 5,
    };

    const updatedResults = [...quizResults, result];
    saveQuizResults(updatedResults);

    // Update global state & stats
    addXP({
      type: isCorrect ? 'correct_answer' : 'wrong_answer',
      amount: result.xpEarned,
      description: isCorrect ? `Correct answer on ${q.topic}` : `Attempted quiz question`,
      timestamp: Date.now(),
    });
    
    // React to answer
    if (isCorrect) {
      setEmotion('proud');
      setDialogue(`Spot on! See? You're actually capable of studying when you apply yourself.`);
      adjustMood(10);
      // Correct answer calms Dazai down
      useCortisolStore.getState().decrease(8);
    } else {
      setEmotion('disappointed');
      setDialogue(`Wrong! Hmm, did you even read the material, or were you just staring at my handsome face?`);
      adjustMood(-8);
      // Wrong answer stresses Dazai out
      useCortisolStore.getState().increase(12);
    }
    useCharacterStore.getState().triggerVoice();

    // Progression check
    setTimeout(() => {
      if (activeQuestionIndex < quizQuestions.length - 1) {
        setActiveQuestionIndex(activeQuestionIndex + 1);
      } else {
        // Quiz completed
        setQuizOpen(false);
        checkAchievements();
        updateStreak();
        setDialogue("Quiz complete! Let's get back to the timer, shall we?");
        setEmotion('happy');
      }
    }, 4000);
  };

  return (
    <div className="relative min-h-screen flex flex-col text-foreground bg-transparent font-fredoka">
      {/* Achievement & Focus Overlays */}
      <AchievementPopup />
      <FocusWarning />
      <TimerControls />



      {/* 2. Main content area (completely scrollable naturally) */}
      <div className="flex-1 w-full">
        {activeTab === 'study' ? (
          <div className="w-full max-w-[1550px] mx-auto p-8 pb-32 grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            {/* Left Column */}
            <div className="flex flex-col gap-8 w-full">
              <WelcomeClock />
              <ProfileCard />
              
              {/* Companion Status */}
              <Card padding="md" bgVariant="pink" className="w-full shadow-[0_6px_0_#7c6a75]">
                <div className="flex items-center gap-2 border-b-2 border-[#7c6a75]/15 pb-3 mb-4">
                  <span className="text-lg">💫</span>
                  <h3 className="text-xs font-black text-[#5d5770] uppercase tracking-wider">Companion Status</h3>
                </div>
                <div className="space-y-3 font-fredoka text-sm font-bold text-[#5d5770]">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2">💭 Mood</span>
                    <span className="text-xs font-black text-[#58659c] uppercase">{currentEmotion === 'happy' ? '😊 Happy' : currentEmotion === 'proud' ? '💜 Proud' : currentEmotion === 'excited' ? '✨ Excited' : currentEmotion === 'neutral' ? '😐 Neutral' : currentEmotion === 'concerned' ? '😟 Concerned' : currentEmotion === 'annoyed' ? '😤 Annoyed' : currentEmotion === 'disappointed' ? '😔 Disappointed' : '🔥 Motivated'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2">💕 Relationship</span>
                    <span className="text-xs font-black text-[#58659c] uppercase">{useCharacterStore.getState().relationshipLevel === 'new_user' ? 'New Friend' : useCharacterStore.getState().relationshipLevel === 'consistent_student' ? 'Study Buddy' : 'Trusted Partner'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2">⭐ Affinity</span>
                    <span className="text-xs font-black text-[#58659c]">{useCharacterStore.getState().relationshipXP} / 100</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2">🤝 Trust</span>
                    <span className="text-xs font-black text-[#58659c]">{Math.min(100, Math.round((useUserStore.getState().currentStreak * 5) + (useSessionStore.getState().focus.focusScore * 0.5)))}%</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-[#7c6a75]/10 pt-3">
                    <span className="flex items-center gap-2">📍 Status</span>
                    <span className={`text-xs font-black uppercase ${isRunning && !isBreak ? 'text-green-600' : isBreak ? 'text-amber-600' : 'text-[#58659c]'}`}>{isRunning && !isBreak ? '● Studying' : isBreak ? '● On Break' : '● Idle'}</span>
                  </div>
                </div>
              </Card>
            </div>

            {/* Center Column */}
            <div className="flex flex-col gap-8 items-center w-full">
              {/* Character speech bubble + avatar centered */}
              <div className="w-full flex flex-col items-center gap-6">
                <CharacterDialogue />
                <CharacterAvatar />
              </div>
              
              {/* Gameboy Timer */}
              <StudyTimer />
              
              
              
              {/* Materials List */}
              <div className="w-full">
                <StudyMaterials documents={documents} onDelete={handleDeleteDoc} />
              </div>
            </div>

            {/* Right Column */}
            <div className="flex flex-col gap-8 w-full">
              {/* uwustagram Music Player */}
              <CassettePlayer />
              
              {/* Shifted Mood Meter */}
              <MoodMeter />
              
              {/* Current Study Session (Document Uploader) replaces placeholder */}
              <div className="w-full">
                <DocumentUploader 
                  onUpload={handleUpload} 
                  onStartSelecting={() => { isSelectingFileRef.current = true; }} 
                />
              </div>

              {/* Generate Quiz Card - Cozy Yellow */}
              {selectedDocId && (
                <div className="w-full glass-card-yellow-static p-6 shadow-[0_6px_0_#7c6a75] flex flex-col gap-4 font-fredoka">
                  <span className="text-xs font-black text-[#5d5770] uppercase tracking-wider text-center border-b border-[#7c6a75]/25 pb-1.5">Master your material</span>
                  <Button
                    variant="primary"
                    className="w-full py-3 text-sm font-black"
                    isLoading={isLoadingQuiz}
                    onClick={() => handleTriggerQuiz()}
                  >
                    Generate Dazai Quiz
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'dashboard' ? (
          <div className="w-full max-w-7xl mx-auto p-8 pb-32">
            <DashboardView />
          </div>
        ) : (
          <div className="w-full max-w-[1550px] mx-auto p-8 pb-32">
            <StudyHub documents={documents} />
          </div>
        )}
      </div>

      {/* 3. Floating Bottom Navigation Dock */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/80 backdrop-blur-xl border-3 border-[#7c6a75] px-8 py-3 rounded-2xl shadow-[0_6px_0_#7c6a75] flex items-center gap-8 z-40 animate-slideUp font-fredoka">
        <button
          onClick={() => setActiveTab('study')}
          className={`flex flex-col items-center gap-1.5 cursor-pointer transition-all ${
            activeTab === 'study' ? 'scale-110 text-[#7181c8] font-black' : 'text-[#5d5770]/60 hover:text-[#7181c8] hover:scale-105'
          }`}
        >
          <span className="text-2xl">⏱️</span>
          <span className="text-[10px] font-black uppercase tracking-wider">Study</span>
        </button>
        <div className="w-[3px] h-10 bg-[#7c6a75]/25" />
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center gap-1.5 cursor-pointer transition-all ${
            activeTab === 'dashboard' ? 'scale-110 text-[#7181c8] font-black' : 'text-[#5d5770]/60 hover:text-[#7181c8] hover:scale-105'
          }`}
        >
          <span className="text-2xl">📊</span>
          <span className="text-[10px] font-black uppercase tracking-wider">Stats</span>
        </button>
        <div className="w-[3px] h-10 bg-[#7c6a75]/25" />
        <button
          onClick={() => setActiveTab('browser')}
          className={`flex flex-col items-center gap-1.5 cursor-pointer transition-all ${
            activeTab === 'browser' ? 'scale-110 text-[#7181c8] font-black' : 'text-[#5d5770]/60 hover:text-[#7181c8] hover:scale-105'
          }`}
        >
          <span className="text-2xl">🌐</span>
          <span className="text-[10px] font-black uppercase tracking-wider">Hub</span>
        </button>
        <div className="w-[3px] h-10 bg-[#7c6a75]/25" />
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="flex flex-col items-center gap-1.5 cursor-pointer transition-all text-[#5d5770]/60 hover:text-[#7181c8] hover:scale-105"
        >
          <span className="text-2xl">⚙️</span>
          <span className="text-[10px] font-black uppercase tracking-wider">Config</span>
        </button>
      </div>

      {/* 4. Settings Config Modal */}
      <Modal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} title="Companion Config" size="md">
        <div className="space-y-6 py-2 font-fredoka">
          {/* API Key */}
          <div className="space-y-2">
            <label className="text-xs font-black text-[#5d5770]/85 uppercase tracking-wider">OpenAI API Key</label>
            <input
              type="password"
              placeholder="sk-proj-..."
              value={openaiApiKey || ''}
              onChange={(e) => updateSettings({ openaiApiKey: e.target.value })}
              className="w-full bg-white/40 border-3 border-[#7c6a75] shadow-[0_3px_0_#7c6a75] rounded-xl px-4 py-3 text-xs text-[#5d5770] focus:outline-none focus:border-[#7181c8] transition-colors"
            />
            <p className="text-[10px] font-bold text-[#5d5770]/60">
              Required for real-time Dazai dialogue reactions and document quiz generation. Kept local.
            </p>
          </div>

          {/* Preset settings */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-black text-[#5d5770]/85 uppercase tracking-wider">Default Timer</label>
              <select
                value={defaultTimerMode}
                onChange={(e) => {
                  const mode = e.target.value as TimerMode;
                  updateSettings({ defaultTimerMode: mode });
                  useSessionStore.getState().setTimerMode(mode);
                }}
                className="w-full bg-white/40 border-3 border-[#7c6a75] shadow-[0_3px_0_#7c6a75] rounded-xl px-3 py-3 text-xs text-[#5d5770] focus:outline-none cursor-pointer font-bold"
              >
                <option value="pomodoro" className="bg-[#f1e5f6] text-[#5d5770]">Pomodoro (25/5)</option>
                <option value="deep_work" className="bg-[#f1e5f6] text-[#5d5770]">Deep Work (50/10)</option>
                <option value="custom" className="bg-[#f1e5f6] text-[#5d5770]">Custom (45/10)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-[#5d5770]/85 uppercase tracking-wider">Quiz Difficulty</label>
              <select
                value={quizDifficulty}
                onChange={(e) => updateSettings({ quizDifficulty: e.target.value as any })}
                className="w-full bg-white/40 border-3 border-[#7c6a75] shadow-[0_3px_0_#7c6a75] rounded-xl px-3 py-3 text-xs text-[#5d5770] focus:outline-none cursor-pointer font-bold"
              >
                <option value="easy" className="bg-[#f1e5f6] text-[#5d5770]">Easy</option>
                <option value="medium" className="bg-[#f1e5f6] text-[#5d5770]">Medium</option>
                <option value="hard" className="bg-[#f1e5f6] text-[#5d5770]">Hard</option>
                <option value="adaptive" className="bg-[#f1e5f6] text-[#5d5770]">Adaptive</option>
              </select>
            </div>
          </div>

          {/* Voice configuration */}
          <div className="space-y-3 border-t border-[#7c6a75]/25 pt-5">
            <h4 className="text-xs font-black text-[#5d5770]/85 uppercase tracking-wider">Voice & TTS Settings</h4>
            
            <div className="flex items-center justify-between text-xs font-bold text-[#5d5770]">
              <span>Enable Pre-recorded Clips</span>
              <input
                type="checkbox"
                checked={voice.enableVoiceClips}
                onChange={(e) => updateSettings({ voice: { ...voice, enableVoiceClips: e.target.checked } })}
                className="w-4 h-4 cursor-pointer accent-[#7181c8]"
              />
            </div>

            <div className="flex items-center justify-between text-xs font-bold text-[#5d5770]">
              <span>Enable Web Speech API Fallback</span>
              <input
                type="checkbox"
                checked={voice.enableWebSpeech}
                onChange={(e) => updateSettings({ voice: { ...voice, enableWebSpeech: e.target.checked } })}
                className="w-4 h-4 cursor-pointer accent-[#7181c8]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs font-bold text-[#5d5770]">
              <div className="space-y-1">
                <span>Speech Volume</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={voice.voiceClipVolume}
                  onChange={(e) => updateSettings({ voice: { ...voice, voiceClipVolume: parseFloat(e.target.value) } })}
                  className="w-full h-1 bg-[#7c6a75]/20 rounded-lg appearance-none cursor-pointer accent-[#7181c8]"
                />
              </div>

              <div className="space-y-1">
                <span>Speech Speed</span>
                <input
                  type="range"
                  min="0.5"
                  max="1.5"
                  step="0.1"
                  value={voice.webSpeechRate}
                  onChange={(e) => updateSettings({ voice: { ...voice, webSpeechRate: parseFloat(e.target.value) } })}
                  className="w-full h-1 bg-[#7c6a75]/20 rounded-lg appearance-none cursor-pointer accent-[#7181c8]"
                />
              </div>
            </div>
          </div>

          <div className="w-full border-t border-[#7c6a75]/25 my-5" />

          <Button variant="primary" className="w-full py-3" onClick={() => setIsSettingsOpen(false)}>
            Save Settings
          </Button>
        </div>
      </Modal>

      {/* Quiz Modal */}
      {quizOpen && quizQuestions[activeQuestionIndex] && (
        <QuizModal
          question={quizQuestions[activeQuestionIndex]}
          isOpen={quizOpen}
          onClose={() => setQuizOpen(false)}
          onAnswer={handleQuizAnswer}
        />
      )}
    </div>
  );
}
