export interface SpeakOptions {
  voiceName?: string;
  rate?: number;
  pitch?: number;
  onEnd?: () => void;
  onError?: (err: unknown) => void;
}

export function speakChinese(text: string, options: SpeakOptions = {}) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    console.warn('Speech synthesis not supported in this environment');
    return;
  }

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  if (!text) return;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'zh-CN';
  utterance.rate = options.rate ?? 0.9;
  utterance.pitch = options.pitch ?? 1.0;

  const voices = window.speechSynthesis.getVoices();
  if (options.voiceName) {
    const selectedVoice = voices.find(v => v.name === options.voiceName);
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }
  } else {
    // Choose best zh-CN voice available
    const zhVoice = voices.find(v => v.lang === 'zh-CN') || voices.find(v => v.lang.startsWith('zh'));
    if (zhVoice) {
      utterance.voice = zhVoice;
    }
  }

  if (options.onEnd) {
    utterance.onend = options.onEnd;
  }
  if (options.onError) {
    utterance.onerror = options.onError;
  }

  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}
