import React, { useState, useEffect, useCallback, useRef } from 'react';
import Avatar from './components/Avatar';
import HistorySidebar from './components/HistorySidebar';
import TranscriptBubble from './components/TranscriptBubble';
import { AppState, LogEntry, ActionType } from './types';
import { processUserMessage } from './services/geminiService';
import { startListening, speakText } from './services/speechService';
import { AnimatePresence, motion } from 'framer-motion';

const generateId = () => Math.random().toString(36).substr(2, 9);

const App: React.FC = () => {
  const [avatarState, setAvatarState] = useState<AppState>(AppState.IDLE);
  const [history, setHistory] = useState<LogEntry[]>([]);
  const [transcript, setTranscript] = useState<string>('');
  const [isMicrophoneActive, setIsMicrophoneActive] = useState(false);
  const [aiCaption, setAiCaption] = useState<string>('');
  const [pendingAction, setPendingAction] = useState<{ url: string; label: string } | null>(null);
  const [isKeyboardMode, setIsKeyboardMode] = useState(false);
  const [inputText, setInputText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const thinkingTimeoutRef = useRef<number | null>(null);
  const talkingTimeoutRef = useRef<number | null>(null);

  // Initial Greeting
  useEffect(() => {
    const greeting = "Hello. I am Aura. I can help you browse the web. Try saying 'Open YouTube' or 'Search for tech news'.";
    addHistoryItem('ai', greeting);
    setAiCaption(greeting);
  }, []);

  // Auto-focus keyboard input
  useEffect(() => {
    if (isKeyboardMode && inputRef.current) inputRef.current.focus();
  }, [isKeyboardMode]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (thinkingTimeoutRef.current) clearTimeout(thinkingTimeoutRef.current);
      if (talkingTimeoutRef.current) clearTimeout(talkingTimeoutRef.current);
    };
  }, []);

  const addHistoryItem = (type: 'user' | 'ai', text: string, action?: { type: ActionType; value: string }) => {
    setHistory(prev => [...prev, { id: generateId(), timestamp: new Date(), type, text, action }]);
  };

  // Handle opening URLs and Searches
  const handleCommand = (type: ActionType, value: string) => {
    console.log("Executing Action:", type, value);
    let url = '';
    let label = '';

    if (type === ActionType.OPEN_URL) {
      url = value.startsWith('http') ? value : `https://${value}`;
      try {
        label = `Open ${new URL(url).hostname}`;
      } catch {
        label = "Open Link";
      }
    } else if (type === ActionType.SEARCH) {
      url = `https://www.google.com/search?q=${encodeURIComponent(value)}`;
      label = `Search "${value}"`;
    }

    if (url) {
      setTimeout(() => {
        try {
          const win = window.open(url, '_blank');
          if (!win || win.closed || typeof win.closed === 'undefined') throw new Error("Popup blocked");
        } catch {
          console.warn("Popup blocked. Requesting manual user interaction.");
          setPendingAction({ url, label });
          setAiCaption(prev => prev + " (Action blocked, click button below)");
        }
      }, 100);
    }
  };

  const activateMicrophone = useCallback(() => {
    setIsKeyboardMode(false);
    setTranscript('');
    setAiCaption('');
    setPendingAction(null);
    setAvatarState(AppState.LISTENING);
    setIsMicrophoneActive(true);

    startListening(
      (text) => setTranscript(text),
      async () => setIsMicrophoneActive(false),
      (error) => {
        console.error(error);
        setAvatarState(AppState.IDLE);
        setIsMicrophoneActive(false);
        if (error !== 'no-speech') setAiCaption("Microphone access denied or error occurred.");
      }
    );
  }, []);

  const handleMicClick = useCallback(() => {
    if ([AppState.LISTENING, AppState.TALKING, AppState.THINKING].includes(avatarState)) return;
    activateMicrophone();
  }, [avatarState, activateMicrophone]);

  // Process voice input when mic stops
  useEffect(() => {
    if (!isMicrophoneActive && avatarState === AppState.LISTENING) {
      if (transcript.trim().length > 0) handleUserQuery(transcript);
      else {
        setAvatarState(AppState.IDLE);
        setAiCaption("I didn't hear anything. Tap to try again.");
      }
    }
  }, [isMicrophoneActive, transcript]); 

  // Process keyboard input
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    setIsKeyboardMode(false);
    setPendingAction(null);
    handleUserQuery(inputText);
    setInputText('');
  };

  // Master function to handle user messages, API calls, and history sync
  const handleUserQuery = async (text: string) => {
    setAvatarState(AppState.THINKING);
    setAiCaption("Processing...");

    const userEntry = { id: generateId(), timestamp: new Date(), type: 'user' as const, text };
    
    // CRITICAL: Update history state AND capture the latest array for the API call
    let currentHistory: LogEntry[] = [];
    setHistory(prev => {
      currentHistory = [...prev, userEntry];
      return currentHistory;
    });

    if (thinkingTimeoutRef.current) clearTimeout(thinkingTimeoutRef.current);
    thinkingTimeoutRef.current = window.setTimeout(() => {
      if (avatarState === AppState.THINKING) {
        setAvatarState(AppState.IDLE);
        setAiCaption("Connection timed out. Please try again.");
      }
    }, 15000);

    try {
      // Pass the fully updated history so Aura remembers the current context
      const aiResponse = await processUserMessage(text, currentHistory);

      if (thinkingTimeoutRef.current) clearTimeout(thinkingTimeoutRef.current);

      setAvatarState(AppState.TALKING);
      addHistoryItem('ai', aiResponse.message, { type: aiResponse.action as ActionType, value: aiResponse.value });
      setAiCaption(aiResponse.message);

      // Trigger actions if the AI returned any
      if (aiResponse.action !== ActionType.NONE && aiResponse.value) {
        handleCommand(aiResponse.action as ActionType, aiResponse.value);
      }

      const estimatedDuration = (aiResponse.message.length / 10) * 1000 + 2000;
      if (talkingTimeoutRef.current) clearTimeout(talkingTimeoutRef.current);
      talkingTimeoutRef.current = window.setTimeout(() => {
        if (avatarState === AppState.TALKING) {
          console.warn("Speech synthesis timed out or was blocked.");
          setAvatarState(AppState.IDLE);
        }
      }, Math.max(4000, estimatedDuration));

      // Speak text, then return to idle (or reactivate mic)
      speakText(aiResponse.message, () => {}, () => {
        if (talkingTimeoutRef.current) clearTimeout(talkingTimeoutRef.current);
        activateMicrophone(); 
      });

    } catch (error) {
      console.error("Gemini Error:", error);
      if (thinkingTimeoutRef.current) clearTimeout(thinkingTimeoutRef.current);
      setAvatarState(AppState.IDLE);
      setAiCaption("I encountered an error. Please check your API key.");
    }
  };

  return (
    <div className="h-screen w-screen bg-transparent text-white flex flex-col md:flex-row overflow-hidden font-inter">
      {/* Background Elements */}
      <div className="fixed inset-0 z-0 bg-[#0f172a]">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-900/30 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-900/30 rounded-full blur-[100px]" />
      </div>

      <HistorySidebar history={history} />

      <main className="flex-1 relative z-10 flex flex-col items-center justify-center p-6 order-1 md:order-2 h-[calc(100vh-12rem)] md:h-full">
        {/* Header/Logo */}
        <div className="absolute top-6 right-6 md:right-auto md:left-6 md:top-6 opacity-80 z-20">
          <h1 className="font-space font-bold text-2xl tracking-tighter cursor-default bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
            AURA <span className="text-xs font-normal text-white bg-white/10 px-2 py-0.5 rounded ml-2 align-middle">v1.0</span>
          </h1>
        </div>

        <div className="relative flex flex-col items-center justify-center space-y-8 md:space-y-12 w-full max-w-2xl">
          {/* Input Area */}
          <div className="h-16 w-full flex justify-center items-end relative z-30">
            {isKeyboardMode ? (
              <form onSubmit={handleManualSubmit} className="w-full max-w-md relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Type a command (e.g., 'Open YouTube')..."
                  className="w-full bg-black/40 backdrop-blur-xl border border-white/20 rounded-full px-6 py-3 text-center text-white placeholder-white/30 focus:outline-none focus:border-indigo-400 transition-colors shadow-2xl"
                />
                <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-white/50 hover:text-white transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-11.25a.75.75 0 00-1.5 0v2.5h-2.5a.75.75 0 000 1.5h2.5v2.5a.75.75 0 001.5 0v-2.5h2.5a.75.75 0 000-1.5h-2.5v-2.5z" clipRule="evenodd" />
                  </svg>
                </button>
              </form>
            ) : (
              <TranscriptBubble text={transcript} isListening={avatarState === AppState.LISTENING} />
            )}
          </div>

          {/* 3D Avatar */}
          <div className="relative z-20"><Avatar state={avatarState} /></div>

          {/* Captions and Pending Actions */}
          <div className="h-32 flex flex-col items-center justify-start px-4 w-full space-y-4">
            <AnimatePresence mode="wait">
              {aiCaption && avatarState !== AppState.LISTENING && !isKeyboardMode && (
                <motion.div
                  key="caption"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-center max-w-lg"
                >
                  <p className="text-xl md:text-2xl font-light text-white font-space leading-snug drop-shadow-lg">
                    {aiCaption}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {pendingAction && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  onClick={() => { window.open(pendingAction.url, '_blank'); setPendingAction(null); }}
                  className="px-6 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-full shadow-[0_0_20px_rgba(16,185,129,0.4)] hover:shadow-[0_0_30px_rgba(16,185,129,0.6)] transition-all flex items-center space-x-2"
                >
                  <span>{pendingAction.label}</span>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                    <path fillRule="evenodd" d="M4.25 5.5a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0112.75 19H4.25A2.25 2.25 0 012 16.75V6.25A2.25 2.25 0 014.25 4h4a.75.75 0 010 1.5h-4z" clipRule="evenodd" />
                    <path fillRule="evenodd" d="M6.194 12.753a.75.75 0 001.06.053L16.5 4.44v2.81a.75.75 0 001.5 0v-4.5a.75.75 0 00-.75-.75h-4.5a.75.75 0 000 1.5h2.553l-9.056 8.194a.75.75 0 00-.053 1.06z" clipRule="evenodd" />
                  </svg>
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          {/* Controls */}
          <div className="flex flex-col items-center space-y-6">
            <div className="flex items-center space-x-6">
              <button
                onClick={() => setIsKeyboardMode(!isKeyboardMode)}
                className="p-3 rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all backdrop-blur-sm border border-white/5"
                aria-label="Toggle Keyboard"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                </svg>
              </button>

              <button
                onClick={handleMicClick}
                disabled={avatarState !== AppState.IDLE}
                className={`group relative flex items-center justify-center w-24 h-24 rounded-full transition-all duration-300 ${
                  avatarState === AppState.LISTENING
                    ? 'bg-rose-500 scale-110 shadow-[0_0_40px_rgba(244,63,94,0.5)]'
                    : avatarState === AppState.IDLE
                      ? 'bg-white/10 hover:bg-white/20 border border-white/20 hover:scale-105'
                      : 'bg-white/5 opacity-50 cursor-not-allowed'
                }`}
                aria-label="Toggle Microphone"
              >
                {avatarState === AppState.LISTENING ? (
                  <div className="w-8 h-8 flex space-x-1 items-center justify-center">
                    <span className="w-1.5 h-4 bg-white animate-[bounce_1s_infinite] delay-0" />
                    <span className="w-1.5 h-8 bg-white animate-[bounce_1s_infinite] delay-100" />
                    <span className="w-1.5 h-4 bg-white animate-[bounce_1s_infinite] delay-200" />
                  </div>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white group-hover:text-indigo-200 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                  </svg>
                )}
              </button>

              <div className="w-12" />
            </div>

            <p className="text-sm text-indigo-200/60 font-mono tracking-wide h-4 uppercase text-center">
              {avatarState === AppState.IDLE && (isKeyboardMode ? "Type your request" : "Tap to Speak")}
              {avatarState === AppState.LISTENING && "Listening..."}
              {avatarState === AppState.THINKING && "Processing..."}
              {avatarState === AppState.TALKING && "Speaking..."}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;