class AudioManager {
  private static instance: AudioManager;
  private audioContext?: AudioContext;
  private hasUserGesture = false;
  private pendingAudio: Array<() => void> = [];

  private constructor() {
    // Listen for user interaction to enable audio
    this.addUserGestureListeners();
  }

  static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  private addUserGestureListeners() {
    const enableAudio = () => {
      this.hasUserGesture = true;
      this.processPendingAudio();
      // Remove listeners after first interaction
      document.removeEventListener('click', enableAudio);
      document.removeEventListener('keydown', enableAudio);
      document.removeEventListener('touchstart', enableAudio);
    };

    document.addEventListener('click', enableAudio);
    document.addEventListener('keydown', enableAudio);
    document.addEventListener('touchstart', enableAudio);
  }

  private processPendingAudio() {
    while (this.pendingAudio.length > 0) {
      const audioFn = this.pendingAudio.shift();
      if (audioFn) {
        try {
          audioFn();
        } catch (error) {
          console.warn('Failed to play pending audio:', error);
        }
      }
    }
  }

  async playSound(audioUrl: string, options: { volume?: number; loop?: boolean } = {}): Promise<HTMLAudioElement | undefined> {
    const { volume = 1, loop = false } = options;

    const playAudio = () => {
      const audio = new Audio(audioUrl);
      audio.volume = volume;
      audio.loop = loop;
      
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.warn('Audio playback failed:', error);
        });
      }
      
      return audio;
    };

    if (this.hasUserGesture) {
      try {
        return playAudio();
      } catch (error) {
        console.warn('Failed to play audio:', error);
        return undefined;
      }
    } else {
      // Queue audio to play after user gesture
      this.pendingAudio.push(playAudio);
      return undefined;
    }
  }

  async playSoundOnce(audioUrl: string, volume = 1): Promise<HTMLAudioElement | undefined> {
    if (!this.hasUserGesture) {
      console.warn('Audio blocked - waiting for user interaction');
      return;
    }

    try {
      const audio = new Audio(audioUrl);
      audio.volume = volume;
      await audio.play();
      return audio;
    } catch (error) {
      console.warn('Failed to play audio:', error);
      return;
    }
  }

  stopSound(audio: HTMLAudioElement) {
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
  }

  getHasUserGesture(): boolean {
    return this.hasUserGesture;
  }
}

export const audioManager = AudioManager.getInstance(); 