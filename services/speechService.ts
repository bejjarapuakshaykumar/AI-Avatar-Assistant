// Type augmentation for browser speech APIs
interface IWindow extends Window {
  webkitSpeechRecognition: any;
  SpeechRecognition: any;
  activeUtterance?: SpeechSynthesisUtterance; // CRITICAL: Prevent GC
}

/**
 * Starts the microphone and listens for a single command.
 * Renamed to startListening to match App.tsx
 */
export const startListening = (
  onResult: (text: string) => void,
  onEnd: () => void,
  onError: (msg: string) => void
) => {
  const win = window as unknown as IWindow;
  const SpeechInfo = win.SpeechRecognition || win.webkitSpeechRecognition;

  if (!SpeechInfo) {
    onError("Browser does not support Speech Recognition.");
    return null;
  }

  const recognition = new SpeechInfo();
  recognition.lang = 'en-US';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  // We want single-shot command mode
  recognition.continuous = false;

  recognition.onresult = (event: any) => {
    if (event.results.length > 0) {
      const text = event.results[0][0].transcript;
      onResult(text);
    }
  };

  recognition.onerror = (event: any) => {
    // "no-speech" is common if user stays silent; treat as normal end
    if (event.error === 'no-speech') {
      console.warn("Speech: No speech detected");
    } else {
      console.error("Speech Error:", event.error);
      onError(event.error);
    }
  };

  recognition.onend = () => {
    onEnd();
  };

  try {
    recognition.start();
    return recognition;
  } catch (e) {
    console.error("Failed to start recognition:", e);
    onError("Microphone start failed.");
    return null;
  }
};

/**
 * Speaks text using the Web Speech API.
 * Uses global anchoring to prevent premature garbage collection.
 * Renamed to speakText to match App.tsx
 */
export const speakText = (
  text: string, 
  onStart: () => void, 
  onEnd: () => void
) => {
  if (!window.speechSynthesis) {
    onEnd();
    return;
  }

  const synth = window.speechSynthesis;
  synth.cancel(); // Clear queue

  const utterance = new SpeechSynthesisUtterance(text);
  const win = window as unknown as IWindow;
  
  // CRITICAL FIX: Anchor to window so Chrome doesn't GC it before onend
  win.activeUtterance = utterance;

  // Voice Selection Preference
  const voices = synth.getVoices();
  const preferredVoice = voices.find(v => v.name.includes("Google US English")) || 
                         voices.find(v => v.lang === "en-US") || 
                         voices[0];
  if (preferredVoice) utterance.voice = preferredVoice;

  utterance.rate = 1.0;
  utterance.pitch = 1.05;

  utterance.onstart = onStart;
  
  utterance.onend = () => {
    win.activeUtterance = undefined; // Release memory
    onEnd();
  };

  utterance.onerror = (e) => {
    console.error("Speech Synthesis Error:", e);
    win.activeUtterance = undefined;
    onEnd(); // Ensure we don't hang
  };

  try {
    synth.speak(utterance);
  } catch (e) {
    onEnd();
  }
};