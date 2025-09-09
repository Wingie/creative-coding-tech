---
layout: post
title: "Real-time Audio Processing with Web Audio API"
date: 2024-07-26 09:30:00 -0400
categories: [audio, web-development, tutorial]
tags: [web-audio, javascript, real-time, audio-analysis, dsp]
---

Web Audio API has evolved into a powerful platform for real-time audio processing, rivaling desktop applications. After building audio analysis systems for my Strudel MCP server, I'll show you how to create professional-grade audio tools that run entirely in the browser.

## Why Web Audio API?

### Universal Access
- **No Installation**: Works on any device with a modern browser
- **Cross-Platform**: Identical behavior across operating systems  
- **Real-time Capable**: Low-latency audio processing
- **Hardware Access**: Direct microphone and audio interface integration

### Modern Capabilities
- **AudioWorklet**: High-performance audio processing threads
- **Spatial Audio**: 3D audio positioning and HRTF processing
- **Machine Learning**: Integration with TensorFlow.js for AI audio
- **Visual Integration**: Seamless connection with Canvas and WebGL

## Core Concepts for Creative Coding

### The Audio Graph Architecture

Web Audio works as a directed graph of audio nodes:

```javascript
// Basic signal chain
source → processor → analyzer → destination
```

### Essential Node Types

```javascript
// Audio sources
const oscillator = audioContext.createOscillator();
const audioBuffer = audioContext.createBufferSource();
const mediaStream = audioContext.createMediaStreamSource();

// Audio processors  
const gainNode = audioContext.createGain();
const filterNode = audioContext.createBiquadFilter();
const delayNode = audioContext.createDelay();

// Analysis nodes
const analyzerNode = audioContext.createAnalyser();
const scriptProcessor = audioContext.createScriptProcessor();
```

## Building a Real-time Audio Analyzer

Let's create a comprehensive audio analysis system similar to what powers live coding visualizations:

### Basic Setup

```javascript
class AudioAnalyzer {
    constructor() {
        this.audioContext = new AudioContext();
        this.analyzer = this.audioContext.createAnalyser();
        this.microphone = null;
        
        // Configure analyzer for detailed frequency analysis
        this.analyzer.fftSize = 2048;
        this.analyzer.smoothingTimeConstant = 0.8;
        
        this.bufferLength = this.analyzer.frequencyBinCount;
        this.dataArray = new Uint8Array(this.bufferLength);
        this.frequencyData = new Float32Array(this.bufferLength);
    }
    
    async initialize() {
        try {
            // Get microphone access
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                    sampleRate: 44100
                }
            });
            
            this.microphone = this.audioContext.createMediaStreamSource(stream);
            this.microphone.connect(this.analyzer);
            
            console.log('Audio analyzer initialized');
            return true;
        } catch (error) {
            console.error('Microphone access denied:', error);
            return false;
        }
    }
}
```

### Advanced Frequency Analysis

```javascript
class AdvancedAudioAnalyzer extends AudioAnalyzer {
    constructor() {
        super();
        
        // Define frequency bands for musical analysis
        this.frequencyBands = {
            sub: { min: 20, max: 60 },      // Sub bass
            bass: { min: 60, max: 250 },    // Bass
            low: { min: 250, max: 500 },    // Low mids
            mid: { min: 500, max: 2000 },   // Mids  
            high: { min: 2000, max: 8000 }, // High mids
            peak: { min: 8000, max: 20000 } // Highs
        };
    }
    
    getFrequencyData() {
        this.analyzer.getByteFrequencyData(this.dataArray);
        this.analyzer.getFloatFrequencyData(this.frequencyData);
        
        return {
            raw: Array.from(this.dataArray),
            float: Array.from(this.frequencyData),
            bands: this.getFrequencyBands(),
            peak: this.getPeakFrequency(),
            rms: this.getRMSLevel(),
            timestamp: this.audioContext.currentTime
        };
    }
    
    getFrequencyBands() {
        const sampleRate = this.audioContext.sampleRate;
        const bands = {};
        
        Object.entries(this.frequencyBands).forEach(([name, range]) => {
            const startBin = Math.floor(range.min * this.bufferLength / (sampleRate / 2));
            const endBin = Math.floor(range.max * this.bufferLength / (sampleRate / 2));
            
            let sum = 0;
            for (let i = startBin; i <= endBin; i++) {
                sum += this.dataArray[i];
            }
            
            bands[name] = sum / (endBin - startBin + 1);
        });
        
        return bands;
    }
    
    getPeakFrequency() {
        let maxIndex = 0;
        let maxValue = 0;
        
        for (let i = 0; i < this.dataArray.length; i++) {
            if (this.dataArray[i] > maxValue) {
                maxValue = this.dataArray[i];
                maxIndex = i;
            }
        }
        
        const frequency = maxIndex * this.audioContext.sampleRate / (2 * this.bufferLength);
        return { frequency, amplitude: maxValue };
    }
    
    getRMSLevel() {
        let sum = 0;
        for (let i = 0; i < this.dataArray.length; i++) {
            sum += Math.pow(this.dataArray[i] / 255, 2);
        }
        return Math.sqrt(sum / this.dataArray.length);
    }
}
```

## Real-time Audio Effects Processing

### Custom AudioWorklet for Low-latency Processing

```javascript
// effects-processor.js (AudioWorklet)
class EffectsProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        
        // Effect parameters
        this.distortionAmount = 0;
        this.filterCutoff = 1000;
        this.delayTime = 0.3;
        this.delayFeedback = 0.4;
        
        // Delay line buffer
        this.delayBufferSize = Math.floor(sampleRate * 2); // 2 second max delay
        this.delayBuffer = new Float32Array(this.delayBufferSize);
        this.delayIndex = 0;
        
        // Filter state variables
        this.filterState = { x1: 0, x2: 0, y1: 0, y2: 0 };
        
        this.setupParameterListeners();
    }
    
    setupParameterListeners() {
        this.port.onmessage = (event) => {
            const { parameter, value } = event.data;
            
            switch (parameter) {
                case 'distortion':
                    this.distortionAmount = value;
                    break;
                case 'filterCutoff':
                    this.filterCutoff = value;
                    break;
                case 'delayTime':
                    this.delayTime = value;
                    break;
                case 'delayFeedback':
                    this.delayFeedback = value;
                    break;
            }
        };
    }
    
    process(inputs, outputs, parameters) {
        const input = inputs[0];
        const output = outputs[0];
        
        if (input.length > 0) {
            const inputChannel = input[0];
            const outputChannel = output[0];
            
            for (let i = 0; i < inputChannel.length; i++) {
                let sample = inputChannel[i];
                
                // Apply distortion
                if (this.distortionAmount > 0) {
                    sample = this.applyDistortion(sample, this.distortionAmount);
                }
                
                // Apply low-pass filter
                sample = this.applyLowPassFilter(sample, this.filterCutoff);
                
                // Apply delay
                sample = this.applyDelay(sample, this.delayTime, this.delayFeedback);
                
                outputChannel[i] = sample;
            }
        }
        
        return true;
    }
    
    applyDistortion(sample, amount) {
        const drive = amount * 10;
        return Math.tanh(sample * drive) / Math.tanh(drive);
    }
    
    applyLowPassFilter(sample, cutoffFreq) {
        // Simple 2-pole low-pass filter
        const omega = 2 * Math.PI * cutoffFreq / sampleRate;
        const sin = Math.sin(omega);
        const cos = Math.cos(omega);
        const alpha = sin / (2 * 0.707); // Q = 0.707
        
        const b0 = (1 - cos) / 2;
        const b1 = 1 - cos;
        const b2 = (1 - cos) / 2;
        const a0 = 1 + alpha;
        const a1 = -2 * cos;
        const a2 = 1 - alpha;
        
        const output = (b0/a0) * sample + (b1/a0) * this.filterState.x1 + (b2/a0) * this.filterState.x2
                     - (a1/a0) * this.filterState.y1 - (a2/a0) * this.filterState.y2;
        
        this.filterState.x2 = this.filterState.x1;
        this.filterState.x1 = sample;
        this.filterState.y2 = this.filterState.y1;
        this.filterState.y1 = output;
        
        return output;
    }
    
    applyDelay(sample, delayTime, feedback) {
        const delaySamples = Math.floor(delayTime * sampleRate);
        const readIndex = (this.delayIndex - delaySamples + this.delayBufferSize) % this.delayBufferSize;
        
        const delayOutput = this.delayBuffer[readIndex];
        this.delayBuffer[this.delayIndex] = sample + (delayOutput * feedback);
        
        this.delayIndex = (this.delayIndex + 1) % this.delayBufferSize;
        
        return sample + delayOutput * 0.3; // Mix delay signal
    }
}

registerProcessor('effects-processor', EffectsProcessor);
```

### Main Thread Integration

```javascript
class RealTimeEffectsEngine {
    constructor() {
        this.audioContext = new AudioContext();
        this.effectsNode = null;
    }
    
    async initialize() {
        // Load the AudioWorklet
        await this.audioContext.audioWorklet.addModule('effects-processor.js');
        
        // Create effects processor node
        this.effectsNode = new AudioWorkletNode(this.audioContext, 'effects-processor');
        
        // Setup input/output routing
        const input = this.audioContext.createMediaStreamSource(
            await navigator.mediaDevices.getUserMedia({ audio: true })
        );
        
        input.connect(this.effectsNode);
        this.effectsNode.connect(this.audioContext.destination);
    }
    
    updateEffectParameter(parameter, value) {
        this.effectsNode.port.postMessage({ parameter, value });
    }
    
    // Real-time parameter control methods
    setDistortion(amount) { // 0-1
        this.updateEffectParameter('distortion', amount);
    }
    
    setFilterCutoff(frequency) { // Hz
        this.updateEffectParameter('filterCutoff', frequency);
    }
    
    setDelayTime(time) { // seconds
        this.updateEffectParameter('delayTime', time);
    }
    
    setDelayFeedback(feedback) { // 0-1
        this.updateEffectParameter('delayFeedback', feedback);
    }
}
```

## Advanced Synthesis Techniques

### Additive Synthesis Engine

```javascript
class AdditiveSynth {
    constructor(audioContext, numHarmonics = 16) {
        this.audioContext = audioContext;
        this.numHarmonics = numHarmonics;
        this.oscillators = [];
        this.gainNodes = [];
        this.isPlaying = false;
        
        this.createOscillators();
    }
    
    createOscillators() {
        for (let i = 0; i < this.numHarmonics; i++) {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            
            this.oscillators.push(oscillator);
            this.gainNodes.push(gainNode);
        }
    }
    
    playNote(frequency, harmonicSpectrum) {
        if (this.isPlaying) {
            this.stop();
        }
        
        // Create new oscillators for this note
        this.createOscillators();
        
        const masterGain = this.audioContext.createGain();
        masterGain.connect(this.audioContext.destination);
        masterGain.gain.setValueAtTime(0, this.audioContext.currentTime);
        masterGain.gain.linearRampToValueAtTime(0.1, this.audioContext.currentTime + 0.05);
        
        this.oscillators.forEach((oscillator, index) => {
            const harmonicNumber = index + 1;
            const harmonicFreq = frequency * harmonicNumber;
            const amplitude = harmonicSpectrum[index] || 0;
            
            oscillator.frequency.setValueAtTime(harmonicFreq, this.audioContext.currentTime);
            this.gainNodes[index].gain.setValueAtTime(amplitude, this.audioContext.currentTime);
            this.gainNodes[index].connect(masterGain);
            
            oscillator.start();
        });
        
        this.isPlaying = true;
        this.masterGain = masterGain;
    }
    
    stop() {
        if (!this.isPlaying) return;
        
        const stopTime = this.audioContext.currentTime + 0.05;
        this.masterGain.gain.linearRampToValueAtTime(0, stopTime);
        
        this.oscillators.forEach(oscillator => {
            oscillator.stop(stopTime);
        });
        
        this.isPlaying = false;
    }
    
    // Real-time harmonic manipulation
    updateHarmonic(harmonicIndex, amplitude) {
        if (this.gainNodes[harmonicIndex]) {
            this.gainNodes[harmonicIndex].gain.setValueAtTime(
                amplitude, 
                this.audioContext.currentTime
            );
        }
    }
    
    morphSpectrum(targetSpectrum, duration = 1.0) {
        const startTime = this.audioContext.currentTime;
        
        this.gainNodes.forEach((gainNode, index) => {
            const currentValue = gainNode.gain.value;
            const targetValue = targetSpectrum[index] || 0;
            
            gainNode.gain.setValueAtTime(currentValue, startTime);
            gainNode.gain.linearRampToValueAtTime(targetValue, startTime + duration);
        });
    }
}
```

## Creative Audio Visualization

### Real-time Spectral Display

```javascript
class AudioVisualizer {
    constructor(canvas, analyzer) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.analyzer = analyzer;
        this.isRunning = false;
        
        this.setupCanvas();
    }
    
    setupCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        // High DPI support
        const devicePixelRatio = window.devicePixelRatio || 1;
        this.canvas.width *= devicePixelRatio;
        this.canvas.height *= devicePixelRatio;
        this.ctx.scale(devicePixelRatio, devicePixelRatio);
    }
    
    start() {
        this.isRunning = true;
        this.draw();
    }
    
    stop() {
        this.isRunning = false;
    }
    
    draw() {
        if (!this.isRunning) return;
        
        const data = this.analyzer.getFrequencyData();
        
        // Clear canvas with fade effect
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw frequency spectrum
        this.drawSpectrum(data.raw);
        
        // Draw frequency bands as circles
        this.drawFrequencyBands(data.bands);
        
        // Draw peak frequency indicator
        this.drawPeakFrequency(data.peak);
        
        requestAnimationFrame(() => this.draw());
    }
    
    drawSpectrum(frequencyData) {
        const barWidth = this.canvas.width / frequencyData.length;
        
        frequencyData.forEach((amplitude, index) => {
            const barHeight = (amplitude / 255) * this.canvas.height * 0.8;
            const hue = (index / frequencyData.length) * 360;
            
            this.ctx.fillStyle = `hsl(${hue}, 100%, ${50 + amplitude/10}%)`;
            this.ctx.fillRect(
                index * barWidth, 
                this.canvas.height - barHeight, 
                barWidth - 1, 
                barHeight
            );
        });
    }
    
    drawFrequencyBands(bands) {
        const bandNames = Object.keys(bands);
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        
        bandNames.forEach((name, index) => {
            const amplitude = bands[name];
            const angle = (index / bandNames.length) * Math.PI * 2;
            const radius = 50 + amplitude * 2;
            
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;
            
            this.ctx.fillStyle = `hsl(${index * 60}, 70%, 60%)`;
            this.ctx.beginPath();
            this.ctx.arc(x, y, amplitude / 10, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Label
            this.ctx.fillStyle = 'white';
            this.ctx.font = '12px Arial';
            this.ctx.fillText(name.toUpperCase(), x - 15, y + 30);
        });
    }
    
    drawPeakFrequency(peak) {
        const x = (peak.frequency / 20000) * this.canvas.width;
        const intensity = peak.amplitude / 255;
        
        this.ctx.strokeStyle = `rgba(255, 255, 255, ${intensity})`;
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.moveTo(x, 0);
        this.ctx.lineTo(x, this.canvas.height);
        this.ctx.stroke();
        
        // Frequency label
        this.ctx.fillStyle = 'white';
        this.ctx.font = '14px Arial';
        this.ctx.fillText(`${peak.frequency.toFixed(0)}Hz`, x + 5, 20);
    }
}
```

## Performance Optimization

### Efficient Buffer Management

```javascript
class OptimizedAudioProcessor {
    constructor() {
        this.bufferPool = [];
        this.activeBuffers = new Set();
        this.maxPoolSize = 10;
    }
    
    getBuffer(size) {
        // Reuse buffers to avoid garbage collection
        let buffer = this.bufferPool.find(b => b.length === size);
        
        if (!buffer) {
            buffer = new Float32Array(size);
            if (this.bufferPool.length < this.maxPoolSize) {
                this.bufferPool.push(buffer);
            }
        } else {
            this.bufferPool.splice(this.bufferPool.indexOf(buffer), 1);
        }
        
        this.activeBuffers.add(buffer);
        return buffer;
    }
    
    releaseBuffer(buffer) {
        this.activeBuffers.delete(buffer);
        
        if (this.bufferPool.length < this.maxPoolSize) {
            buffer.fill(0); // Clear buffer
            this.bufferPool.push(buffer);
        }
    }
    
    processAudioBlock(inputBuffer) {
        const outputBuffer = this.getBuffer(inputBuffer.length);
        
        // Process audio...
        for (let i = 0; i < inputBuffer.length; i++) {
            outputBuffer[i] = inputBuffer[i] * 0.5; // Simple gain
        }
        
        // Don't forget to release when done
        setTimeout(() => this.releaseBuffer(outputBuffer), 100);
        
        return outputBuffer;
    }
}
```

## Integration with Creative Coding Platforms

### Connecting to p5.js

```javascript
// p5.js sketch with Web Audio integration
let audioAnalyzer;
let visualizer;

function setup() {
    createCanvas(windowWidth, windowHeight);
    
    // Initialize audio analysis
    audioAnalyzer = new AdvancedAudioAnalyzer();
    audioAnalyzer.initialize().then(success => {
        if (success) {
            console.log('Audio input ready');
        }
    });
}

function draw() {
    background(0, 50);
    
    if (audioAnalyzer && audioAnalyzer.microphone) {
        const audioData = audioAnalyzer.getFrequencyData();
        
        // Use audio data to drive visuals
        drawAudioReactiveGraphics(audioData);
    }
}

function drawAudioReactiveGraphics(audioData) {
    const bands = audioData.bands;
    
    // Bass-driven particle system
    if (bands.bass > 100) {
        for (let i = 0; i < bands.bass / 10; i++) {
            fill(255, bands.bass, 100, 150);
            ellipse(
                random(width), 
                random(height), 
                bands.bass / 5, 
                bands.bass / 5
            );
        }
    }
    
    // Mid-frequency driven shapes
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = bands.mid * 2;
    
    fill(100, 255, bands.high, 100);
    ellipse(centerX, centerY, radius, radius);
}
```

## Conclusion

Web Audio API has matured into a platform capable of professional audio applications. The combination of low-latency processing, extensive analysis capabilities, and seamless integration with visual programming makes it ideal for creative coding projects.

Key advantages for creative coders:
- **Immediate Deployment**: No installation barriers for users
- **Cross-Platform Consistency**: Identical behavior across devices
- **Rich Ecosystem**: Integration with ML, graphics, and other web technologies
- **Real-time Capabilities**: Low-latency audio processing and analysis

The examples shown here form the foundation for more complex applications like live coding environments, interactive installations, and AI-powered music tools. Start with basic analysis, gradually add processing capabilities, and don't forget to optimize for performance in resource-constrained environments.

---

*Building audio applications with Web Audio API? Share your projects and let's push the boundaries of browser-based audio together!*