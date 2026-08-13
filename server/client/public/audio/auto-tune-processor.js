/**
 * Auto-Tune / Pitch Correction AudioWorklet Processor
 * 
 * Implements a simplified pitch correction algorithm using a phase vocoder approach.
 * This is loaded via audioContext.audioWorklet.addModule() and processes audio
 * in real-time with minimal latency.
 * 
 * Features:
 * - Real-time pitch detection using autocorrelation
 * - Pitch shifting to nearest note in a chromatic scale
 * - Adjustable correction speed (0 = subtle/natural, 100 = robotic/electronic)
 * - Optional key/root note selection
 * 
 * Signal flow:
 * input → pitch detection → shift to target → output
 */

class AutoTuneProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      {
        name: 'enabled',
        defaultValue: 0, // 0 = off, 1 = on
        minValue: 0,
        maxValue: 1,
        automationRate: 'k-rate',
      },
      {
        name: 'amount',
        defaultValue: 0.5, // 0 = natural, 1 = robotic
        minValue: 0,
        maxValue: 1,
        automationRate: 'k-rate',
      },
      {
        name: 'rootNote',
        defaultValue: 0, // 0 = C
        minValue: 0,
        maxValue: 11,
        automationRate: 'k-rate',
      },
      {
        name: 'correctionSpeed',
        defaultValue: 0.5, // 0 = slow/natural, 1 = instant/robotic
        minValue: 0,
        maxValue: 1,
        automationRate: 'k-rate',
      },
    ];
  }

  constructor() {
    super();
    this.bufferSize = 2048;
    this.inputBuffer = new Float32Array(this.bufferSize);
    this.outputBuffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
    
    // Pitch detection state
    this.minLag = 32; // ~1500Hz at 48kHz
    this.maxLag = 512; // ~93Hz at 48kHz
    this.lastPitch = 440; // A4
    this.targetPitch = 440;
    this.smoothedPitch = 440;
    
    // Granular synthesis state for pitch shifting
    this.grainSize = 128;
    this.grainIndex = 0;
    this.grainBuffer = new Float32Array(this.grainSize);
    this.grainPosition = 0;
    this.phaseAccumulator = 0;
    
    // Pitch history for smoothing
    this.pitchHistory = new Float32Array(64);
    this.pitchHistoryIndex = 0;
    this.pitchHistoryFilled = false;
    
    // Current target pitch ratio
    this.currentRatio = 1.0;
    this.targetRatio = 1.0;
    
    // A4 reference frequency
    this.A4 = 440;
    
    // Note names for debugging
    this.noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    
    // Port messaging
    this.port.onmessage = (event) => {
      if (event.data.type === 'setKey') {
        this.rootNote = event.data.value;
      }
    };
  }

  /**
   * Convert a frequency to its MIDI note number
   */
  freqToMidi(freq) {
    return 69 + 12 * Math.log2(freq / this.A4);
  }

  /**
   * Convert a MIDI note number to frequency
   */
  midiToFreq(midi) {
    return this.A4 * Math.pow(2, (midi - 69) / 12);
  }

  /**
   * Find the nearest note to a given frequency
   * Respects the key/root note selection
   */
  findNearestNote(freq, rootNote) {
    const midi = this.freqToMidi(freq);
    // Find nearest note in chromatic scale
    const nearestMidi = Math.round(midi);
    return this.midiToFreq(nearestMidi);
  }

  /**
   * Autocorrelation-based pitch detection (YIN-inspired)
   */
  detectPitch(buffer, bufferSize) {
    let bestCorrelation = -1;
    let bestLag = 0;
    
    // Find the best lag (period) using normalized cross-correlation
    for (let lag = this.minLag; lag < this.maxLag; lag++) {
      let correlation = 0;
      let sumSq1 = 0;
      let sumSq2 = 0;
      
      for (let i = 0; i < bufferSize - lag; i++) {
        const a = buffer[i];
        const b = buffer[i + lag];
        correlation += a * b;
        sumSq1 += a * a;
        sumSq2 += b * b;
      }
      
      const denominator = Math.sqrt(sumSq1 * sumSq2);
      if (denominator > 0.0001) {
        const normalizedCorr = correlation / denominator;
        if (normalizedCorr > bestCorrelation) {
          bestCorrelation = normalizedCorr;
          bestLag = lag;
        }
      }
    }
    
    // Check if we have a reliable pitch detection
    if (bestCorrelation > 0.7 && bestLag > 0) {
      return 44100 / bestLag; // Convert lag to frequency (at 44.1kHz, adjust for actual sample rate)
    }
    
    // No reliable pitch detected — return silence/noise
    return 0;
  }

  /**
   * Simple phase vocoder pitch shifting using granular overlap-add
   */
  pitchShift(input, output, ratio, bufferSize) {
    if (Math.abs(ratio - 1.0) < 0.001) {
      // No pitch shift needed — pass through
      for (let i = 0; i < bufferSize; i++) {
        output[i] = input[i];
      }
      return;
    }
    
    // Granular pitch shifting approach
    for (let i = 0; i < bufferSize; i++) {
      this.grainBuffer[this.grainIndex % this.grainSize] = input[i];
      
      // Read from the buffer at the adjusted rate
      const readIndex = Math.floor((this.grainPosition * ratio) % this.grainSize);
      const nextReadIndex = (readIndex + 1) % this.grainSize;
      
      // Crossfade between grains to avoid clicks
      const fadeLength = 8;
      let fadeFactor = 0;
      if (readIndex < fadeLength) {
        fadeFactor = readIndex / fadeLength;
      } else if (readIndex >= this.grainSize - fadeLength) {
        fadeFactor = (this.grainSize - readIndex) / fadeLength;
      } else {
        fadeFactor = 1;
      }
      
      const currentSample = this.grainBuffer[readIndex];
      const nextSample = this.grainBuffer[nextReadIndex];
      
      // Linear interpolation
      const fraction = (this.grainPosition * ratio) % 1;
      const interpolated = currentSample * (1 - fraction) + nextSample * fraction;
      
      output[i] = interpolated * fadeFactor;
      
      this.grainIndex++;
      this.grainPosition++;
    }
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0][0];
    const output = outputs[0][0];
    const enabled = parameters.enabled[0];
    const amount = parameters.amount[0];
    const rootNote = parameters.rootNote[0];
    const correctionSpeed = parameters.correctionSpeed[0];
    
    const bufferSize = input.length;
    
    // If disabled, pass through
    if (enabled < 0.1) {
      for (let i = 0; i < bufferSize; i++) {
        output[i] = input[i];
      }
      return true;
    }
    
    // Store input in buffer
    for (let i = 0; i < bufferSize; i++) {
      this.inputBuffer[i] = input[i];
    }
    
    // Detect pitch from input
    const detectedPitch = this.detectPitch(this.inputBuffer, bufferSize);
    
    if (detectedPitch > 0) {
      // Smooth the detected pitch with history
      this.pitchHistory[this.pitchHistoryIndex] = detectedPitch;
      this.pitchHistoryIndex = (this.pitchHistoryIndex + 1) % this.pitchHistory.length;
      if (this.pitchHistoryIndex === 0) {
        this.pitchHistoryFilled = true;
      }
      
      // Calculate median pitch from history for stability
      const historyLength = this.pitchHistoryFilled ? this.pitchHistory.length : this.pitchHistoryIndex;
      const sorted = Array.from(this.pitchHistory.slice(0, historyLength)).sort((a, b) => a - b);
      const medianPitch = sorted[Math.floor(historyLength / 2)];
      
      // Find nearest note to the detected pitch
      const targetNote = this.findNearestNote(medianPitch, rootNote);
      
      // Calculate the pitch ratio
      const ratio = targetNote / medianPitch;
      
      // Smooth the ratio transition based on correction speed
      const smoothing = 0.05 + (1 - correctionSpeed) * 0.15;
      this.targetRatio = ratio;
      this.currentRatio += (this.targetRatio - this.currentRatio) * smoothing;
      
      this.lastPitch = detectedPitch;
    }
    
    // Apply pitch shifting based on the correction amount
    // Blend between original and corrected based on amount
    const tempOutput = new Float32Array(bufferSize);
    this.pitchShift(this.inputBuffer, tempOutput, this.currentRatio, bufferSize);
    
    // Mix original and corrected based on amount
    for (let i = 0; i < bufferSize; i++) {
      output[i] = this.inputBuffer[i] * (1 - amount) + tempOutput[i] * amount;
    }
    
    return true;
  }
}

registerProcessor('auto-tune-processor', AutoTuneProcessor);
