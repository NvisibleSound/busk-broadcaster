/**
 * Modular Audio Plugin System
 * Can be enabled/disabled without breaking core functionality
 */

// Plugin Manager
export class AudioPluginManager {
  constructor(audioContext) {
    this.context = audioContext;
    this.plugins = [];
    this.enabled = false; // Can be toggled off completely
  }

  // Add a plugin to the chain
  addPlugin(plugin) {
    try {
      if (plugin && typeof plugin.create === 'function') {
        this.plugins.push(plugin);
        return true;
      }
      console.warn('Invalid plugin:', plugin);
      return false;
    } catch (error) {
      console.error('Error adding plugin:', error);
      return false;
    }
  }

  // Remove a plugin
  removePlugin(pluginName) {
    this.plugins = this.plugins.filter(p => p.name !== pluginName);
  }

  // Process audio through all enabled plugins
  process(sourceNode, targetNode) {
    if (!this.enabled || this.plugins.length === 0) {
      // If disabled or no plugins, just connect directly
      sourceNode.connect(targetNode);
      return { input: sourceNode, output: targetNode };
    }

    let currentNode = sourceNode;
    
    // Chain all plugins together
    for (const plugin of this.plugins) {
      try {
        const pluginNode = plugin.create(this.context);
        if (pluginNode) {
          currentNode.connect(pluginNode);
          currentNode = pluginNode;
        }
      } catch (error) {
        console.error(`Error creating plugin ${plugin.name}:`, error);
        // Continue with next plugin if one fails
      }
    }

    // Connect last plugin to target
    currentNode.connect(targetNode);

    return { input: sourceNode, output: currentNode };
  }

  // Enable/disable plugin system
  setEnabled(enabled) {
    this.enabled = enabled;
  }

  // Get plugin configuration
  getConfig() {
    return {
      enabled: this.enabled,
      plugins: this.plugins.map(p => ({
        name: p.name,
        enabled: p.enabled !== false
      }))
    };
  }
}

// Base Plugin Class
export class AudioPlugin {
  constructor(name) {
    this.name = name;
    this.enabled = true;
  }

  create(audioContext) {
    throw new Error('Plugin must implement create() method');
  }
}

// EQ Plugin (Parametric with HPF/LPF)
export class EQPlugin extends AudioPlugin {
  constructor() {
    super('EQ');
    // Parametric EQ bands: 3 bands with frequency, gain, and Q
    this.bands = [
      { frequency: 200, gain: 0, Q: 1, enabled: true },
      { frequency: 1000, gain: 0, Q: 1, enabled: true },
      { frequency: 5000, gain: 0, Q: 1, enabled: true }
    ];
    // High Pass Filter
    this.hpf = { frequency: 80, enabled: true };
    // Low Pass Filter
    this.lpf = { frequency: 12000, enabled: true };
  }

  create(audioContext) {
    try {
      this.nodes = [];
      let firstNode = null;
      let previousNode = null;

      // Create HPF first if enabled
      if (this.hpf.enabled) {
        const hpfFilter = audioContext.createBiquadFilter();
        hpfFilter.type = 'highpass';
        hpfFilter.frequency.value = this.hpf.frequency;
        hpfFilter.Q.value = 0.707;
        
        if (!firstNode) {
          firstNode = hpfFilter;
        }
        if (previousNode) {
          previousNode.connect(hpfFilter);
        }
        previousNode = hpfFilter;
        this.nodes.push({ filter: hpfFilter, type: 'hpf' });
      }

      // Create a filter node for each enabled band
      for (let i = 0; i < this.bands.length; i++) {
        const band = this.bands[i];
        if (!band.enabled) continue;

        const filter = audioContext.createBiquadFilter();
        filter.type = 'peaking';
        filter.frequency.value = band.frequency;
        filter.gain.value = band.gain;
        filter.Q.value = band.Q;

        if (!firstNode) {
          firstNode = filter;
        }

        if (previousNode) {
          previousNode.connect(filter);
        }
        
        previousNode = filter;
        this.nodes.push({ filter, bandIndex: i });
      }

      // Create LPF last if enabled
      if (this.lpf.enabled) {
        const lpfFilter = audioContext.createBiquadFilter();
        lpfFilter.type = 'lowpass';
        lpfFilter.frequency.value = this.lpf.frequency;
        lpfFilter.Q.value = 0.707;
        
        if (!firstNode) {
          firstNode = lpfFilter;
        }
        if (previousNode) {
          previousNode.connect(lpfFilter);
        }
        previousNode = lpfFilter;
        this.nodes.push({ filter: lpfFilter, type: 'lpf' });
      }

      return firstNode; // Return the first node in the chain
    } catch (error) {
      console.error('Error creating EQ plugin:', error);
      return null;
    }
  }

  setBandFrequency(bandIndex, frequency) {
    if (this.bands[bandIndex]) {
      this.bands[bandIndex].frequency = Math.max(20, Math.min(20000, frequency));
      const node = this.nodes.find(n => n.bandIndex === bandIndex);
      if (node?.filter) {
        node.filter.frequency.value = this.bands[bandIndex].frequency;
      }
    }
  }

  setBandGain(bandIndex, gain) {
    if (this.bands[bandIndex]) {
      this.bands[bandIndex].gain = Math.max(-12, Math.min(12, gain));
      const node = this.nodes.find(n => n.bandIndex === bandIndex);
      if (node?.filter) {
        node.filter.gain.value = this.bands[bandIndex].gain;
      }
    }
  }

  setBandQ(bandIndex, Q) {
    if (this.bands[bandIndex]) {
      this.bands[bandIndex].Q = Math.max(0.1, Math.min(10, Q));
      const node = this.nodes.find(n => n.bandIndex === bandIndex);
      if (node?.filter) {
        node.filter.Q.value = this.bands[bandIndex].Q;
      }
    }
  }

  setBandEnabled(bandIndex, enabled) {
    if (this.bands[bandIndex]) {
      this.bands[bandIndex].enabled = enabled;
      // Note: Recreating the chain would be needed for enable/disable
      // For now, we'll just set gain to 0 when disabled
      if (!enabled) {
        this.setBandGain(bandIndex, 0);
      }
    }
  }

  setHPFFrequency(frequency) {
    this.hpf.frequency = Math.max(20, Math.min(500, frequency));
    const node = this.nodes.find(n => n.type === 'hpf');
    if (node?.filter) {
      node.filter.frequency.value = this.hpf.frequency;
    }
  }

  setHPFEnabled(enabled) {
    this.hpf.enabled = enabled;
    // Would need to recreate chain for enable/disable
  }

  setLPFFrequency(frequency) {
    this.lpf.frequency = Math.max(2000, Math.min(20000, frequency));
    const node = this.nodes.find(n => n.type === 'lpf');
    if (node?.filter) {
      node.filter.frequency.value = this.lpf.frequency;
    }
  }

  setLPFEnabled(enabled) {
    this.lpf.enabled = enabled;
    // Would need to recreate chain for enable/disable
  }

  // Legacy methods for backward compatibility
  setLowGain(value) {
    this.setBandGain(0, value);
  }

  setMidGain(value) {
    this.setBandGain(1, value);
  }

  setHighGain(value) {
    this.setBandGain(2, value);
  }
}

// Compressor Plugin
export class CompressorPlugin extends AudioPlugin {
  constructor() {
    super('Compressor');
    this.threshold = -24; // dB
    this.knee = 30; // dB
    this.ratio = 12; // 1:12
    this.attack = 0.003; // seconds
    this.release = 0.25; // seconds
    this.makeUpGain = 0; // dB
    this.inputGain = 0; // dB
    this.outputGain = 0; // dB
    this.autoGain = false;
    this.autoRelease = false;
    this.limiterEnabled = false;
    this.limiterThreshold = -0.1; // dB
  }

  create(audioContext) {
    try {
      // Create input gain
      this.inputGainNode = audioContext.createGain();
      this.inputGainNode.gain.value = this.dbToLinear(this.inputGain);
      
      // Create compressor
      const compressor = audioContext.createDynamicsCompressor();
      compressor.threshold.value = this.threshold;
      compressor.knee.value = this.knee;
      compressor.ratio.value = this.ratio;
      compressor.attack.value = this.attack;
      compressor.release.value = this.release;

      // Create makeup gain
      this.makeUpGainNode = audioContext.createGain();
      this.makeUpGainNode.gain.value = this.dbToLinear(this.makeUpGain);

      // Create output gain
      this.outputGainNode = audioContext.createGain();
      this.outputGainNode.gain.value = this.dbToLinear(this.outputGain);

      // Connect: input -> compressor -> makeup -> output
      this.inputGainNode.connect(compressor);
      compressor.connect(this.makeUpGainNode);
      this.makeUpGainNode.connect(this.outputGainNode);

      this.node = this.inputGainNode; // Return input node as entry point
      this.compressorNode = compressor;
      
      return this.inputGainNode;
    } catch (error) {
      console.error('Error creating Compressor plugin:', error);
      return null;
    }
  }

  dbToLinear(db) {
    return Math.pow(10, db / 20);
  }

  setThreshold(value) {
    this.threshold = Math.max(-60, Math.min(0, value));
    if (this.compressorNode) {
      this.compressorNode.threshold.value = this.threshold;
    }
  }

  setRatio(value) {
    this.ratio = Math.max(1, Math.min(20, value));
    if (this.compressorNode) {
      this.compressorNode.ratio.value = this.ratio;
    }
  }

  setKnee(value) {
    this.knee = Math.max(0, Math.min(40, value));
    if (this.compressorNode) {
      this.compressorNode.knee.value = this.knee;
    }
  }

  setAttack(value) {
    this.attack = Math.max(0, Math.min(1, value));
    if (this.compressorNode) {
      this.compressorNode.attack.value = this.attack;
    }
  }

  setRelease(value) {
    this.release = Math.max(0, Math.min(1, value));
    if (this.compressorNode) {
      this.compressorNode.release.value = this.release;
    }
  }

  setMakeUpGain(value) {
    this.makeUpGain = Math.max(-20, Math.min(20, value));
    if (this.makeUpGainNode) {
      this.makeUpGainNode.gain.value = this.dbToLinear(this.makeUpGain);
    }
  }

  setInputGain(value) {
    this.inputGain = Math.max(-20, Math.min(20, value));
    if (this.inputGainNode) {
      this.inputGainNode.gain.value = this.dbToLinear(this.inputGain);
    }
  }

  setOutputGain(value) {
    this.outputGain = Math.max(-20, Math.min(20, value));
    if (this.outputGainNode) {
      this.outputGainNode.gain.value = this.dbToLinear(this.outputGain);
    }
  }

  setAutoGain(enabled) {
    this.autoGain = enabled;
    // Auto gain logic would calculate makeup gain based on compression
    // For now, just store the setting
  }

  setAutoRelease(enabled) {
    this.autoRelease = enabled;
    // Auto release logic would adjust release based on audio content
    // For now, just store the setting
  }

  setLimiterEnabled(enabled) {
    this.limiterEnabled = enabled;
    // Limiter would be implemented as a separate DynamicsCompressorNode with high ratio
    // For now, just store the setting
  }

  setLimiterThreshold(value) {
    this.limiterThreshold = Math.max(-10, Math.min(0, value));
    // Would update limiter node if it existed
  }
}

// Reverb Plugin
export class ReverbPlugin extends AudioPlugin {
  constructor() {
    super('Reverb');
    this.mix = 0.444; // 0-1 (44.4%)
    this.predelay = 0; // 0-200ms
    this.decay = 0.8; // 0-10 seconds
    this.size = 0.224; // 0-1 (22.4%)
    this.width = 1.072; // 0-2 (107.2%)
    this.lowFreq = 400; // Hz
    this.highFreq = 9000; // Hz
    this.lowGain = 0; // dB
    this.highGain = -1.5; // dB
    this.rate = 0.4; // Hz
    this.depth = 0.32; // 0-1 (32%)
  }

  create(audioContext) {
    try {
      // Create dry/wet mix
      this.dryGain = audioContext.createGain();
      this.wetGain = audioContext.createGain();
      this.dryGain.gain.value = 1 - this.mix;
      this.wetGain.gain.value = this.mix;

      // Create predelay
      this.predelayNode = audioContext.createDelay(0.2); // Max 200ms
      this.predelayNode.delayTime.value = this.predelay / 1000;

      // Create reverb using ConvolverNode
      this.convolver = audioContext.createConvolver();
      this.updateImpulseResponse(audioContext);

      // Create EQ filters
      this.lowFilter = audioContext.createBiquadFilter();
      this.lowFilter.type = 'lowshelf';
      this.lowFilter.frequency.value = this.lowFreq;
      this.lowFilter.gain.value = this.lowGain;

      this.highFilter = audioContext.createBiquadFilter();
      this.highFilter.type = 'highshelf';
      this.highFilter.frequency.value = this.highFreq;
      this.highFilter.gain.value = this.highGain;

      // Create modulation (chorus-like effect)
      this.modOscillator = audioContext.createOscillator();
      this.modGain = audioContext.createGain();
      this.modDelay = audioContext.createDelay(0.01);
      
      this.modOscillator.type = 'sine';
      this.modOscillator.frequency.value = this.rate;
      this.modGain.gain.value = this.depth * 0.005; // Small modulation depth
      this.modDelay.delayTime.value = 0.005;

      this.modOscillator.connect(this.modGain);
      this.modGain.connect(this.modDelay.delayTime);
      this.modOscillator.start();

      // Create input splitter to split signal to dry and wet paths
      this.inputSplitter = audioContext.createChannelSplitter(2);
      
      // Connect: input -> splitter
      // Branch 1: splitter -> dry gain
      // Branch 2: splitter -> predelay -> convolver -> filters -> wet gain
      this.inputSplitter.connect(this.dryGain, 0);
      this.inputSplitter.connect(this.predelayNode, 0);
      
      this.predelayNode.connect(this.convolver);
      this.convolver.connect(this.lowFilter);
      this.lowFilter.connect(this.highFilter);
      this.highFilter.connect(this.wetGain);

      // Create merger to combine dry and wet
      this.merger = audioContext.createChannelMerger(2);
      this.dryGain.connect(this.merger, 0, 0);
      this.wetGain.connect(this.merger, 0, 1);

      // Entry point is the splitter, output is the merger
      this.node = this.inputSplitter;
      this.outputNode = this.merger;
      
      return this.inputSplitter;
    } catch (error) {
      console.error('Error creating Reverb plugin:', error);
      return null;
    }
  }

  updateImpulseResponse(audioContext) {
    const length = audioContext.sampleRate * this.decay;
    const impulse = audioContext.createBuffer(2, length, audioContext.sampleRate);
    
    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        const decay = Math.pow(1 - i / length, 2);
        const noise = (Math.random() * 2 - 1) * decay * this.size;
        channelData[i] = noise;
      }
    }
    
    if (this.convolver) {
      this.convolver.buffer = impulse;
    }
  }

  setMix(value) {
    this.mix = Math.max(0, Math.min(1, value));
    if (this.dryGain) this.dryGain.gain.value = 1 - this.mix;
    if (this.wetGain) this.wetGain.gain.value = this.mix;
  }

  setPredelay(value) {
    this.predelay = Math.max(0, Math.min(200, value));
    if (this.predelayNode) {
      this.predelayNode.delayTime.value = this.predelay / 1000;
    }
  }

  setDecay(value) {
    this.decay = Math.max(0, Math.min(10, value));
    // Would need to recreate impulse response
  }

  setSize(value) {
    this.size = Math.max(0, Math.min(1, value));
    // Would need to recreate impulse response
  }

  setWidth(value) {
    this.width = Math.max(0, Math.min(2, value));
    // Affects stereo width - would need to adjust channel mixing
  }

  setLowFreq(value) {
    this.lowFreq = Math.max(20, Math.min(20000, value));
    if (this.lowFilter) {
      this.lowFilter.frequency.value = this.lowFreq;
    }
  }

  setHighFreq(value) {
    this.highFreq = Math.max(20, Math.min(20000, value));
    if (this.highFilter) {
      this.highFilter.frequency.value = this.highFreq;
    }
  }

  setLowGain(value) {
    this.lowGain = Math.max(-20, Math.min(20, value));
    if (this.lowFilter) {
      this.lowFilter.gain.value = this.lowGain;
    }
  }

  setHighGain(value) {
    this.highGain = Math.max(-20, Math.min(20, value));
    if (this.highFilter) {
      this.highFilter.gain.value = this.highGain;
    }
  }

  setRate(value) {
    this.rate = Math.max(0, Math.min(10, value));
    if (this.modOscillator) {
      this.modOscillator.frequency.value = this.rate;
    }
  }

  setDepth(value) {
    this.depth = Math.max(0, Math.min(1, value));
    if (this.modGain) {
      this.modGain.gain.value = this.depth * 0.005;
    }
  }
}

// Export default plugin manager factory
export function createPluginManager(audioContext, enabled = false) {
  const manager = new AudioPluginManager(audioContext);
  manager.setEnabled(enabled);
  return manager;
}

