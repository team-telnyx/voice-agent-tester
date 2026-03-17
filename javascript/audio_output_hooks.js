let i = 0;

// Store original Audio constructor and createElement
const OriginalAudio = window.Audio;
const originalCreateElement = document.createElement;

// Set to track programmatically created Audio instances
const programmaticAudioInstances = new Set();

// Track RTCPeerConnections for RTP stats
const rtcPeerConnections = new Set();
const OriginalRTCPeerConnection = window.RTCPeerConnection;

// Intercept RTCPeerConnection creation
window.RTCPeerConnection = function(...args) {
  const pc = new OriginalRTCPeerConnection(...args);
  rtcPeerConnections.add(pc);
  console.log(`🔗 RTCPeerConnection created (total: ${rtcPeerConnections.size})`);
  
  // Remove from set when connection is closed
  const originalClose = pc.close.bind(pc);
  pc.close = function() {
    rtcPeerConnections.delete(pc);
    console.log(`🔗 RTCPeerConnection closed (remaining: ${rtcPeerConnections.size})`);
    return originalClose();
  };
  
  // Also track connection state changes
  pc.addEventListener('connectionstatechange', () => {
    if (pc.connectionState === 'closed' || pc.connectionState === 'failed') {
      rtcPeerConnections.delete(pc);
    }
  });
  
  return pc;
};

// Preserve prototype chain
window.RTCPeerConnection.prototype = OriginalRTCPeerConnection.prototype;
Object.setPrototypeOf(window.RTCPeerConnection, OriginalRTCPeerConnection);

// Function to get RTP stats from all active peer connections
window.__getRtpStats = async function() {
  const allStats = [];
  
  for (const pc of rtcPeerConnections) {
    try {
      const stats = await pc.getStats();
      const pcStats = {
        connectionState: pc.connectionState,
        iceConnectionState: pc.iceConnectionState,
        signalingState: pc.signalingState,
        inboundAudio: [],
        outboundAudio: [],
        candidatePairs: []
      };
      
      stats.forEach(report => {
        if (report.type === 'inbound-rtp' && report.kind === 'audio') {
          pcStats.inboundAudio.push({
            packetsReceived: report.packetsReceived,
            packetsLost: report.packetsLost,
            bytesReceived: report.bytesReceived,
            jitter: report.jitter,
            audioLevel: report.audioLevel,
            totalAudioEnergy: report.totalAudioEnergy,
            totalSamplesReceived: report.totalSamplesReceived,
            concealedSamples: report.concealedSamples,
            silentConcealedSamples: report.silentConcealedSamples,
            codecId: report.codecId
          });
        } else if (report.type === 'outbound-rtp' && report.kind === 'audio') {
          pcStats.outboundAudio.push({
            packetsSent: report.packetsSent,
            bytesSent: report.bytesSent,
            targetBitrate: report.targetBitrate,
            codecId: report.codecId
          });
        } else if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          pcStats.candidatePairs.push({
            state: report.state,
            localCandidateId: report.localCandidateId,
            remoteCandidateId: report.remoteCandidateId,
            currentRoundTripTime: report.currentRoundTripTime,
            availableOutgoingBitrate: report.availableOutgoingBitrate
          });
        }
      });
      
      allStats.push(pcStats);
    } catch (error) {
      allStats.push({
        error: error.message,
        connectionState: pc.connectionState
      });
    }
  }
  
  return {
    timestamp: Date.now(),
    connectionCount: rtcPeerConnections.size,
    connections: allStats
  };
};

class AudioElementMonitor {
  constructor() {
    this.monitoredElements = new Map();
    this.audioContext = null;
    this.bodyMutationObserver = null; // Observer for new elements added to body
    this.audioElementObservers = new Map(); // Map of individual observers for each audio element
    this.init();
  }

  init() {
    this.setupAudioContext();
    this.setupBodyMutationObserver();
    this.scanExistingAudioElements();
    this.setupProgrammaticAudioInterception();
    this.setupShadowDomInterception();
    console.log("AudioElementMonitor initialized");
  }

  setupShadowDomInterception() {
    const monitor = this;
    const originalAttachShadow = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function(init) {
      const shadowRoot = originalAttachShadow.call(this, init);
      monitor.observeNode(shadowRoot);
      // Also scan for existing elements in the new shadow root
      monitor.checkForNewAudioElements(shadowRoot);
      return shadowRoot;
    };
  }

  setupAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      console.log("AudioContext created successfully");
    } catch (error) {
      console.error("Failed to create AudioContext:", error);
    }
  }

  setupBodyMutationObserver() {
    if (this.bodyMutationObserver) {
      // Already set up
      return;
    }

    if (!document.body) {
      console.log("document.body not available yet, waiting for DOMContentLoaded");
      window.addEventListener('DOMContentLoaded', () => {
        this.setupBodyMutationObserver();
        this.scanExistingAudioElements();
      });
      return;
    }

    this.bodyMutationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              this.checkForNewAudioElements(node);
            }
          });
        }
      });
    });

    this.observeNode(document.body);
    console.log("Body MutationObserver setup complete");
  }

  observeNode(node) {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((addedNode) => {
            if (addedNode.nodeType === Node.ELEMENT_NODE) {
              this.checkForNewAudioElements(addedNode);
            }
          });
        }
      });
    });

    observer.observe(node, {
      childList: true,
      subtree: true
    });
  }

  setupProgrammaticAudioInterception() {
    const monitor = this;

    // Override Audio constructor
    window.Audio = function (src) {
      const audioElement = new OriginalAudio(src);
      const elementId = monitor.getElementId(audioElement);

      programmaticAudioInstances.add(audioElement);
      monitor.setupProgrammaticAudioElement(audioElement, elementId);

      console.log(`Programmatic Audio created: ${elementId} with src: ${src || 'none'}`);
      return audioElement;
    };

    // window.Audio.prototype.play = function () {
    //   console.log(`Programmatic audio play called: ${this.src || this.srcObject}`);
    //   monitor.handleProgrammaticAudioPlay(this, this.srcObject);
    //   return originalPlay.apply(this, arguments);
    // };

    // Override document.createElement to catch audio elements
    document.createElement = function (tagName) {
      const element = originalCreateElement.call(this, tagName);

      if (tagName.toLowerCase() === 'audio') {
        const elementId = monitor.getElementId(element);
        programmaticAudioInstances.add(element);
        monitor.setupProgrammaticAudioElement(element, elementId);
        console.log(`Programmatic audio element created via createElement: ${elementId}`);
      }

      return element;
    };

    // Preserve original constructor properties
    Object.setPrototypeOf(window.Audio, OriginalAudio);
    Object.defineProperty(window.Audio, 'prototype', {
      value: OriginalAudio.prototype,
      writable: false
    });

    console.log("Programmatic Audio interception setup complete");
  }

  setupAudioElementObserver(audioElement) {
    const elementId = this.getElementId(audioElement);

    if (this.audioElementObservers.has(elementId)) {
      // Already observing this element
      return;
    }

    // Since srcObject is a property, not an attribute, we need to use a different approach
    // We'll override the srcObject setter to detect changes
    const originalDescriptor = Object.getOwnPropertyDescriptor(audioElement, 'srcObject') ||
      Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'srcObject');

    // Create a property descriptor that intercepts srcObject changes
    const monitor = this;
    Object.defineProperty(audioElement, 'srcObject', {
      get() {
        return originalDescriptor ? originalDescriptor.get.call(this) : this._srcObject;
      },
      set(value) {
        const previousValue = this.srcObject;

        // Set the actual srcObject using the original setter
        if (originalDescriptor && originalDescriptor.set) {
          originalDescriptor.set.call(this, value);
        } else {
          this._srcObject = value;
        }

        console.log(`Audio element srcObject changed: ${elementId} from ${previousValue} to ${value}`);

        // Trigger handler when srcObject changes
        if (previousValue !== value) {
          monitor.handleAudioElement(audioElement);
        }
      },
      configurable: true,
      enumerable: true
    });

    // Also set up a mutation observer for other attribute changes (like src)
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        console.log(`Audio element attribute changed: ${elementId} ${mutation.attributeName}`);
        if (mutation.type === 'attributes' && mutation.attributeName === 'src') {
          this.handleAudioElement(mutation.target);
        }
      });
    });

    observer.observe(audioElement, {
      attributes: true,
      attributeFilter: ['src']
    });

    this.audioElementObservers.set(elementId, observer);
    console.log(`Set up srcObject observer for audio element: ${audioElement.tagName} ${elementId} ${audioElement.srcObject}`);
  }

  checkForNewAudioElements(element) {
    if (element.tagName === 'AUDIO') {
      this.setupAudioElementObserver(element);
      if (element.srcObject) {
        this.handleAudioElement(element);
      }
    }

    const audioElements = element.querySelectorAll('audio');
    audioElements.forEach(audioEl => {
      this.setupAudioElementObserver(audioEl);
      if (audioEl.srcObject) {
        this.handleAudioElement(audioEl);
      }
    });
  }

  scanExistingAudioElements() {
    const existingAudio = document.querySelectorAll('audio');
    console.log(`Scanning ${existingAudio.length} existing audio elements`);
    existingAudio.forEach(audioEl => {
      this.setupAudioElementObserver(audioEl);
      if (audioEl.srcObject) {
        this.handleAudioElement(audioEl);
      }
    });
  }

  handleAudioElement(audioElement) {
    const elementId = this.getElementId(audioElement);

    if (this.monitoredElements.has(elementId)) {
      console.log(`Audio element ${elementId} already monitored`);
      return;
    }

    console.log(`New audio element with src detected: ${elementId} ${audioElement.srcObject}`);
    this.monitorAudioElement(audioElement, elementId);
  }

  getElementId(element) {
    if (!element._customId) {
      element._customId = element.id || `audio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    return element._customId;
  }

  setupProgrammaticAudioElement(audioElement, elementId) {
    const monitor = this;

    // Set up property interceptors for src and srcObject changes
    this.setupProgrammaticPropertyInterceptors(audioElement, elementId);

    // Override methods specifically for this instance
    const originalPlay = audioElement.play;
    const originalPause = audioElement.pause;
    const originalLoad = audioElement.load;

    audioElement.play = function () {
      console.log(`Programmatic audio play called: ${elementId}, src: ${this.src || this.srcObject}`);
      monitor.handleProgrammaticAudioPlay(this, elementId);
      return originalPlay.apply(this, arguments);
    };

    audioElement.pause = function () {
      console.log(`Programmatic audio pause called: ${elementId}`);
      monitor.handleProgrammaticAudioPause(this, elementId);
      return originalPause.apply(this, arguments);
    };

    audioElement.load = function () {
      console.log(`Programmatic audio load called: ${elementId}, src: ${this.src || this.srcObject}`);
      monitor.handleProgrammaticAudioLoad(this, elementId);
      return originalLoad.apply(this, arguments);
    };

    // Set up event listeners
    const events = ['play', 'pause', 'ended', 'loadstart', 'canplay', 'loadeddata'];
    events.forEach(eventType => {
      audioElement.addEventListener(eventType, (event) => {
        console.log(`Programmatic audio element ${elementId} event: ${eventType}`);
        this.dispatchAudioEvent(`element${eventType}`, elementId, audioElement, event);
      });
    });

    audioElement.addEventListener('ended', () => {
      const monitorData = this.monitoredElements.get(elementId);
      if (monitorData && monitorData.isPlaying) {
        monitorData.isPlaying = false;
        this.dispatchAudioEvent('audiostop', elementId, audioElement);
      }
    });
  }

  setupProgrammaticPropertyInterceptors(audioElement, elementId) {
    const monitor = this;

    // Intercept src property
    const originalSrcDescriptor = Object.getOwnPropertyDescriptor(audioElement, 'src') ||
      Object.getOwnPropertyDescriptor(HTMLAudioElement.prototype, 'src');

    Object.defineProperty(audioElement, 'src', {
      get() {
        return originalSrcDescriptor ? originalSrcDescriptor.get.call(this) : this._src;
      },
      set(value) {
        const previousValue = this.src;

        if (originalSrcDescriptor && originalSrcDescriptor.set) {
          originalSrcDescriptor.set.call(this, value);
        } else {
          this._src = value;
        }

        console.log(`Programmatic audio src changed: ${elementId} from ${previousValue} to ${value}`);

        if (previousValue !== value && value) {
          monitor.handleProgrammaticAudioSrcChange(audioElement, elementId);
        }
      },
      configurable: true,
      enumerable: true
    });

    // Intercept srcObject property
    const originalSrcObjectDescriptor = Object.getOwnPropertyDescriptor(audioElement, 'srcObject') ||
      Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'srcObject');

    Object.defineProperty(audioElement, 'srcObject', {
      get() {
        return originalSrcObjectDescriptor ? originalSrcObjectDescriptor.get.call(this) : this._srcObject;
      },
      set(value) {
        const previousValue = this.srcObject;

        if (originalSrcObjectDescriptor && originalSrcObjectDescriptor.set) {
          originalSrcObjectDescriptor.set.call(this, value);
        } else {
          this._srcObject = value;
        }

        console.log(`Programmatic audio srcObject changed: ${elementId} from ${previousValue} to ${value}`);

        if (previousValue !== value && value) {
          monitor.handleProgrammaticAudioSrcChange(audioElement, elementId);
        }
      },
      configurable: true,
      enumerable: true
    });
  }

  handleProgrammaticAudioPlay(audioElement, elementId) {
    if (audioElement.src || audioElement.srcObject) {
      this.handleProgrammaticAudioSrcChange(audioElement, elementId);
    }
  }

  handleProgrammaticAudioPause(audioElement, elementId) {
    const monitorData = this.monitoredElements.get(elementId);
    if (monitorData && monitorData.isPlaying) {
      monitorData.isPlaying = false;
      this.dispatchAudioEvent('audiostop', elementId, audioElement);
    }
  }

  handleProgrammaticAudioLoad(audioElement, elementId) {
    if (audioElement.src || audioElement.srcObject) {
      this.handleProgrammaticAudioSrcChange(audioElement, elementId);
    }
  }

  handleProgrammaticAudioSrcChange(audioElement, elementId) {
    if (this.monitoredElements.has(elementId)) {
      console.log(`Programmatic audio element ${elementId} already monitored`);
      return;
    }

    console.log(`New programmatic audio element with src detected: ${elementId} ${audioElement.src || audioElement.srcObject}`);
    this.monitorProgrammaticAudioElement(audioElement, elementId);
  }

  monitorProgrammaticAudioElement(audioElement, elementId) {
    if (!this.audioContext) {
      console.warn("AudioContext not available, cannot monitor programmatic audio");
      return;
    }

    try {
      let source;
      if (audioElement.srcObject && audioElement.srcObject instanceof MediaStream) {
        // For MediaStream sources
        source = this.audioContext.createMediaStreamSource(audioElement.srcObject);
      } else if (audioElement.src) {
        // For regular audio sources, we need to create a media element source
        source = this.audioContext.createMediaElementSource(audioElement);
      } else {
        console.warn(`Cannot monitor programmatic audio element ${elementId}: no valid source`);
        return;
      }

      const analyser = this.audioContext.createAnalyser();
      analyser.fftSize = 2048;

      source.connect(analyser);
      // Only connect to destination for MediaElementSource to avoid double audio
      if (audioElement.src) {
        analyser.connect(this.audioContext.destination);
      }

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const monitorData = {
        element: audioElement,
        source: source,
        analyser: analyser,
        dataArray: dataArray,
        isPlaying: false,
        lastAudioTime: 0,
        silenceThreshold: 10,
        checkInterval: null,
        isProgrammatic: true
      };

      this.monitoredElements.set(elementId, monitorData);
      this.startAudioAnalysis(elementId, monitorData);

      console.log(`Started monitoring programmatic audio element: ${elementId}`);
    } catch (error) {
      console.error(`Failed to monitor programmatic audio element ${elementId} via analyser:`, error.message);
      console.log(`Falling back to event-based monitoring for ${elementId}`);
      this.monitorViaEvents(audioElement, elementId);
    }
  }

  /**
   * Fallback monitoring using audio element events (timeupdate/playing/pause).
   * Used when AudioContext-based monitoring fails (e.g., when the audio element
   * is already connected to another AudioContext via MediaStreamDestination).
   */
  monitorViaEvents(audioElement, elementId) {
    const monitorData = {
      element: audioElement,
      source: null,
      analyser: null,
      dataArray: null,
      isPlaying: false,
      lastAudioTime: 0,
      silenceThreshold: 10,
      checkInterval: null,
      isProgrammatic: true,
      eventBased: true
    };

    this.monitoredElements.set(elementId, monitorData);

    // Use timeupdate to detect audio activity — fires ~4x/sec during playback
    let lastTimeUpdate = 0;
    let silenceTimeoutId = null;
    const SILENCE_DELAY = 1500; // ms of no timeupdate before declaring silence

    const resetSilenceTimer = () => {
      if (silenceTimeoutId) clearTimeout(silenceTimeoutId);
      silenceTimeoutId = setTimeout(() => {
        if (monitorData.isPlaying) {
          monitorData.isPlaying = false;
          this.dispatchAudioEvent('audiostop', elementId, audioElement);
          if (typeof window.__publishEvent === 'function') {
            window.__publishEvent('audiostop', { elementId, timestamp: Date.now() });
          }
          console.log(`Audio stopped (event-based): ${elementId}`);
        }
      }, SILENCE_DELAY);
    };

    audioElement.addEventListener('timeupdate', () => {
      const now = Date.now();
      // timeupdate fires even when seeking; only count if currentTime advances
      if (audioElement.currentTime > 0 && now - lastTimeUpdate > 50) {
        lastTimeUpdate = now;
        monitorData.lastAudioTime = now;

        if (!monitorData.isPlaying) {
          monitorData.isPlaying = true;
          this.dispatchAudioEvent('audiostart', elementId, audioElement);
          if (typeof window.__publishEvent === 'function') {
            window.__publishEvent('audiostart', { elementId, timestamp: Date.now() });
          }
          console.log(`Audio started (event-based): ${elementId}`);
        }
        resetSilenceTimer();
      }
    });

    audioElement.addEventListener('pause', () => {
      if (monitorData.isPlaying) {
        monitorData.isPlaying = false;
        if (silenceTimeoutId) clearTimeout(silenceTimeoutId);
        this.dispatchAudioEvent('audiostop', elementId, audioElement);
        if (typeof window.__publishEvent === 'function') {
          window.__publishEvent('audiostop', { elementId, timestamp: Date.now() });
        }
        console.log(`Audio stopped (event-based, pause): ${elementId}`);
      }
    });

    audioElement.addEventListener('ended', () => {
      if (monitorData.isPlaying) {
        monitorData.isPlaying = false;
        if (silenceTimeoutId) clearTimeout(silenceTimeoutId);
        this.dispatchAudioEvent('audiostop', elementId, audioElement);
        if (typeof window.__publishEvent === 'function') {
          window.__publishEvent('audiostop', { elementId, timestamp: Date.now() });
        }
        console.log(`Audio stopped (event-based, ended): ${elementId}`);
      }
    });

    console.log(`Started event-based monitoring for programmatic audio element: ${elementId}`);
  }

  monitorAudioElement(audioElement, elementId) {
    if (!this.audioContext) {
      console.warn("AudioContext not available, cannot monitor audio");
      return;
    }

    try {
      const source = this.audioContext.createMediaStreamSource(audioElement.srcObject);
      const analyser = this.audioContext.createAnalyser();
      analyser.fftSize = 2048;

      source.connect(analyser);
      analyser.connect(this.audioContext.destination);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const monitorData = {
        element: audioElement,
        source: source,
        analyser: analyser,
        dataArray: dataArray,
        isPlaying: false,
        lastAudioTime: 0,
        silenceThreshold: 10,
        checkInterval: null
      };

      this.monitoredElements.set(elementId, monitorData);
      this.startAudioAnalysis(elementId, monitorData);
      this.setupAudioEventListeners(audioElement, elementId, monitorData);

      console.log(`Started monitoring audio element: ${elementId}`);
    } catch (error) {
      console.error(`Failed to monitor audio element ${elementId} via analyser:`, error.message);
      console.log(`Falling back to event-based monitoring for ${elementId}`);
      this.monitorViaEvents(audioElement, elementId);
    }
  }

  startAudioAnalysis(elementId, monitorData) {
    const { analyser, dataArray, silenceThreshold } = monitorData;

    monitorData.checkInterval = setInterval(() => {
      // Use time-domain data for silence detection — more robust than frequency data.
      // Time-domain bytes center at 128 for silence; we measure RMS deviation.
      // This avoids false positives from FFT noise floor / RTP comfort noise.
      analyser.getByteTimeDomainData(dataArray);

      let sumSquares = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const deviation = dataArray[i] - 128;
        sumSquares += deviation * deviation;
      }
      const rms = Math.sqrt(sumSquares / dataArray.length);
      const hasAudio = rms > silenceThreshold;

      // if (i++ % 10 == 0) {
      //   console.log(`Average: ${average} hasAudio: ${hasAudio} elementId: ${elementId}`);
      // }

      if (hasAudio && !monitorData.isPlaying) {
        monitorData.isPlaying = true;
        monitorData.lastAudioTime = Date.now();
        this.dispatchAudioEvent('audiostart', elementId, monitorData.element);
        // Notify Node.js via exposed function
        if (typeof window.__publishEvent === 'function') {
          window.__publishEvent('audiostart', { elementId, timestamp: Date.now() });
        }
        console.log(`Audio started: ${elementId}`);
      } else if (!hasAudio && monitorData.isPlaying) {
        const silenceDuration = Date.now() - monitorData.lastAudioTime;
        if (silenceDuration > 1000) {
          monitorData.isPlaying = false;
          this.dispatchAudioEvent('audiostop', elementId, monitorData.element);
          // Notify Node.js via exposed function
          if (typeof window.__publishEvent === 'function') {
            window.__publishEvent('audiostop', { elementId, timestamp: Date.now() });
          }
          console.log(`Audio stopped: ${elementId}`);
        }
      } else if (hasAudio) {
        monitorData.lastAudioTime = Date.now();
      }
    }, 20);
  }

  setupAudioEventListeners(audioElement, elementId, monitorData) {
    const events = ['play', 'pause', 'ended', 'loadstart', 'canplay'];

    events.forEach(eventType => {
      audioElement.addEventListener(eventType, (event) => {
        console.log(`Audio element ${elementId} event: ${eventType}`);
        this.dispatchAudioEvent(`element${eventType}`, elementId, audioElement, event);
      });
    });

    audioElement.addEventListener('ended', () => {
      if (monitorData.isPlaying) {
        monitorData.isPlaying = false;
        this.dispatchAudioEvent('audiostop', elementId, audioElement);
      }
    });
  }

  dispatchAudioEvent(eventType, elementId, audioElement, originalEvent = null) {
    const customEvent = new CustomEvent(`audio-monitor-${eventType}`, {
      detail: {
        elementId: elementId,
        audioElement: audioElement,
        timestamp: Date.now(),
        originalEvent: originalEvent
      }
    });

    document.dispatchEvent(customEvent);
    console.log(`Dispatched event: audio-monitor-${eventType} for ${elementId}`);
  }

  stopMonitoring(elementId) {
    const monitorData = this.monitoredElements.get(elementId);
    if (monitorData) {
      if (monitorData.checkInterval) {
        clearInterval(monitorData.checkInterval);
      }
      this.monitoredElements.delete(elementId);
      console.log(`Stopped monitoring audio element: ${elementId}`);
    }
  }

  destroy() {
    this.monitoredElements.forEach((monitorData, elementId) => {
      this.stopMonitoring(elementId);
    });

    if (this.bodyMutationObserver) {
      this.bodyMutationObserver.disconnect();
      this.bodyMutationObserver = null;
    }

    this.audioElementObservers.forEach((observer, elementId) => {
      observer.disconnect();
    });
    this.audioElementObservers.clear();

    // Restore original Audio constructor
    if (OriginalAudio) {
      window.Audio = OriginalAudio;
    }

    // Restore original createElement
    if (originalCreateElement) {
      document.createElement = originalCreateElement;
    }

    // Clear programmatic instances
    programmaticAudioInstances.clear();

    if (this.audioContext) {
      this.audioContext.close();
    }

    console.log("AudioElementMonitor destroyed");
  }
}

const audioMonitor = new AudioElementMonitor();

document.addEventListener('audio-monitor-audiostart', (event) => {
  console.log('🔊 Audio playback started:', event.detail);
});

document.addEventListener('audio-monitor-audiostop', (event) => {
  console.log('🔇 Audio playback stopped:', event.detail);
});

window.audioMonitor = audioMonitor;

// Expose a diagnostic function to get detailed audio monitoring state
window.__getAudioDiagnostics = function() {
  const diagnostics = {
    timestamp: Date.now(),
    audioContextState: audioMonitor.audioContext ? audioMonitor.audioContext.state : 'not-created',
    monitoredElementsCount: audioMonitor.monitoredElements.size,
    elements: []
  };

  audioMonitor.monitoredElements.forEach((monitorData, elementId) => {
    const { analyser, dataArray, silenceThreshold, isPlaying, lastAudioTime, isProgrammatic } = monitorData;
    
    // Get current audio level if analyser is available (RMS of time-domain deviation)
    let currentRms = null;
    if (analyser && dataArray) {
      analyser.getByteTimeDomainData(dataArray);
      let sumSquares = 0;
      for (let j = 0; j < dataArray.length; j++) {
        const deviation = dataArray[j] - 128;
        sumSquares += deviation * deviation;
      }
      currentRms = Math.sqrt(sumSquares / dataArray.length);
    }

    diagnostics.elements.push({
      elementId,
      isPlaying,
      isProgrammatic: !!isProgrammatic,
      silenceThreshold,
      currentAudioLevel: currentRms !== null ? currentRms.toFixed(2) : 'unavailable',
      wouldTriggerAudioStart: currentRms !== null ? currentRms > silenceThreshold : 'unknown',
      lastAudioTime,
      timeSinceLastAudio: lastAudioTime ? Date.now() - lastAudioTime : null
    });
  });

  return diagnostics;
};

// Recording functionality
let isRecording = false;
let recordingWorkletNode = null;
let recordingSampleRate = 16000;

window.__startRecording = async function () {
  if (isRecording) {
    console.log("Recording already in progress");
    return;
  }

  // Find the first monitored audio element to record from
  const monitorData = Array.from(audioMonitor.monitoredElements.values())[0];
  if (!monitorData) {
    console.error("No monitored audio elements found for recording");
    return;
  }

  try {
    const audioContext = audioMonitor.audioContext;
    if (!audioContext) {
      console.error("AudioContext not available for recording");
      return;
    }

    recordingSampleRate = audioContext.sampleRate;

    // Load the AudioWorklet processor module
    const assetsServerUrl = window.__assetsServerUrl || window.location.origin;
    const workletUrl = `${assetsServerUrl}/assets/recording-processor.js`;
    await audioContext.audioWorklet.addModule(workletUrl);

    // Create the AudioWorklet node
    recordingWorkletNode = new AudioWorkletNode(audioContext, 'recording-processor');

    // Set up message handling from the worklet
    recordingWorkletNode.port.onmessage = (event) => {
      const { command, audioData, sampleRate } = event.data;

      if (command === 'recordingComplete') {
        // Convert Float32Array to PCM16 and then to base64
        const pcm16Buffer = floatTo16BitPCM(audioData);
        const base64Audio = arrayBufferToBase64(pcm16Buffer);

        // Publish the recording event with PCM audio data
        if (typeof window.__publishEvent === 'function') {
          window.__publishEvent('recordingcomplete', {
            audioData: base64Audio,
            mimeType: 'audio/pcm',
            sampleRate: sampleRate,
            channels: 1,
            bitsPerSample: 16,
            timestamp: Date.now()
          });
        }

        console.log('Recording completed and published');
      }
    };

    // Connect the recording worklet to the existing audio chain
    // Insert it between the source and analyser
    monitorData.source.disconnect();
    monitorData.source.connect(recordingWorkletNode);
    recordingWorkletNode.connect(monitorData.analyser);

    // Start recording
    recordingWorkletNode.port.postMessage({ command: 'start' });
    isRecording = true;
    console.log('Recording started from monitored audio stream using AudioWorklet');

    // Publish recording start event
    if (typeof window.__publishEvent === 'function') {
      window.__publishEvent('recordingstart', { timestamp: Date.now() });
    }

  } catch (error) {
    console.error('Error starting recording:', error);
    isRecording = false;
  }
};

window.__stopRecording = function () {
  if (!isRecording || !recordingWorkletNode) {
    console.log("No recording in progress");
    return;
  }

  isRecording = false;

  try {
    // Send stop command to the worklet
    recordingWorkletNode.port.postMessage({ command: 'stop' });

    // Disconnect and clean up the recording worklet
    recordingWorkletNode.disconnect();

    // Reconnect the original audio chain
    const monitorData = Array.from(audioMonitor.monitoredElements.values())[0];
    if (monitorData) {
      monitorData.source.connect(monitorData.analyser);
    }

    // Clean up
    recordingWorkletNode = null;

    console.log('Recording stop requested');

  } catch (error) {
    console.error('Error stopping recording:', error);
  }
};

// Helper function to convert Float32Array to 16-bit PCM
function floatTo16BitPCM(float32Array) {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  let offset = 0;

  for (let i = 0; i < float32Array.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }

  return buffer;
}

// Helper function to convert ArrayBuffer to base64
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Add a visible indicator that this script loaded
console.log("Audio output hooks initialization complete");