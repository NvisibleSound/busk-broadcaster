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

// EQ Plugin (3-band)
export class EQPlugin extends AudioPlugin {
  constructor() {
    super('EQ');
    this.lowGain = 0; // -12 to +12 dB
    this.midGain = 0;
    this.highGain = 0;
  }

  create(audioContext) {
    try {
      // Create 3-band EQ using BiquadFilter nodes
      const lowShelf = audioContext.createBiquadFilter();
      lowShelf.type = 'lowshelf';
      lowShelf.frequency.value = 200;
      lowShelf.gain.value = this.lowGain;

      const midPeak = audioContext.createBiquadFilter();
      midPeak.type = 'peaking';
      midPeak.frequency.value = 1000;
      midPeak.Q.value = 1;
      midPeak.gain.value = this.midGain;

      const highShelf = audioContext.createBiquadFilter();
      highShelf.type = 'highshelf';
      highShelf.frequency.value = 5000;
      highShelf.gain.value = this.highGain;

      // Chain them together
      lowShelf.connect(midPeak);
      midPeak.connect(highShelf);

      // Store references for later updates
      this.nodes = { lowShelf, midPeak, highShelf };

      return lowShelf; // Return input node
    } catch (error) {
      console.error('Error creating EQ plugin:', error);
      return null;
    }
  }

  setLowGain(value) {
    this.lowGain = Math.max(-12, Math.min(12, value));
    if (this.nodes?.lowShelf) {
      this.nodes.lowShelf.gain.value = this.lowGain;
    }
  }

  setMidGain(value) {
    this.midGain = Math.max(-12, Math.min(12, value));
    if (this.nodes?.midPeak) {
      this.nodes.midPeak.gain.value = this.midGain;
    }
  }

  setHighGain(value) {
    this.highGain = Math.max(-12, Math.min(12, value));
    if (this.nodes?.highShelf) {
      this.nodes.highShelf.gain.value = this.highGain;
    }
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
  }

  create(audioContext) {
    try {
      const compressor = audioContext.createDynamicsCompressor();
      compressor.threshold.value = this.threshold;
      compressor.knee.value = this.knee;
      compressor.ratio.value = this.ratio;
      compressor.attack.value = this.attack;
      compressor.release.value = this.release;

      this.node = compressor;
      return compressor;
    } catch (error) {
      console.error('Error creating Compressor plugin:', error);
      return null;
    }
  }

  setThreshold(value) {
    this.threshold = Math.max(-60, Math.min(0, value));
    if (this.node) {
      this.node.threshold.value = this.threshold;
    }
  }

  setRatio(value) {
    this.ratio = Math.max(1, Math.min(20, value));
    if (this.node) {
      this.node.ratio.value = this.ratio;
    }
  }
}

// Reverb Plugin (simple)
export class ReverbPlugin extends AudioPlugin {
  constructor() {
    super('Reverb');
    this.roomSize = 0.3; // 0-1
    this.dampening = 0.5; // 0-1
  }

  create(audioContext) {
    try {
      // Simple reverb using ConvolverNode with impulse response
      // For now, we'll use a basic delay-based approach
      const convolver = audioContext.createConvolver();
      
      // Create a simple impulse response
      const length = audioContext.sampleRate * 0.5; // 0.5 seconds
      const impulse = audioContext.createBuffer(2, length, audioContext.sampleRate);
      
      for (let channel = 0; channel < 2; channel++) {
        const channelData = impulse.getChannelData(channel);
        for (let i = 0; i < length; i++) {
          const decay = Math.pow(1 - i / length, 2);
          channelData[i] = (Math.random() * 2 - 1) * decay * this.roomSize;
        }
      }
      
      convolver.buffer = impulse;
      this.node = convolver;
      return convolver;
    } catch (error) {
      console.error('Error creating Reverb plugin:', error);
      return null;
    }
  }

  setRoomSize(value) {
    this.roomSize = Math.max(0, Math.min(1, value));
    // Would need to recreate impulse response to update
  }
}

// Export default plugin manager factory
export function createPluginManager(audioContext, enabled = false) {
  const manager = new AudioPluginManager(audioContext);
  manager.setEnabled(enabled);
  return manager;
}

