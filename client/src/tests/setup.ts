import "@testing-library/jest-dom";

// Mock Web Audio API for Metronome tests
if (typeof window !== "undefined") {
  (window as any).AudioContext = class {
    currentTime = 0;
    state = "running";
    createOscillator() {
      return {
        connect: () => {},
        frequency: { setValueAtTime: () => {} },
        start: () => {},
        stop: () => {},
      };
    }
    createGain() {
      return {
        connect: () => {},
        gain: {
          setValueAtTime: () => {},
          exponentialRampToValueAtTime: () => {},
        },
      };
    }
    resume() {
      return Promise.resolve();
    }
  };
}
