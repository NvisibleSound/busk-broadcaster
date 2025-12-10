# Audio Plugin System

A modular, optional audio processing system for the broadcaster.

## ✅ Features

- **Fully Optional**: Can be completely disabled without breaking core functionality
- **Modular**: Add/remove plugins easily
- **Fail-Safe**: Falls back to direct connection if plugins fail
- **Built-in Plugins**: EQ, Compressor, Reverb (using Web Audio API)

## 🚀 Quick Start

### Enable Plugins

1. Open `src/components/IcecastBroadcaster.js`
2. Find: `const PLUGINS_ENABLED = false;`
3. Change to: `const PLUGINS_ENABLED = true;`
4. Set `pluginsEnabled` state to `true` (or add a UI toggle)

### Disable Plugins

Set `PLUGINS_ENABLED = false` - the broadcaster will work normally without plugins.

## 📦 Available Plugins

### EQ Plugin (3-Band)
- Low shelf (200Hz)
- Mid peak (1000Hz)
- High shelf (5000Hz)
- Range: -12dB to +12dB per band

### Compressor Plugin
- Threshold: -60dB to 0dB
- Ratio: 1:1 to 1:20
- Attack/Release controls
- Uses Web Audio API DynamicsCompressorNode

### Reverb Plugin
- Room size control
- Dampening control
- Simple impulse response-based reverb

## 🔧 Usage Example

```javascript
import { createPluginManager, EQPlugin, CompressorPlugin } from '../utils/audioPlugins';

// Create plugin manager
const manager = createPluginManager(audioContext, true);

// Add plugins
const eq = new EQPlugin();
eq.setLowGain(3); // Boost lows by 3dB
eq.setMidGain(-2); // Cut mids by 2dB
manager.addPlugin(eq);

const compressor = new CompressorPlugin();
compressor.setThreshold(-24);
compressor.setRatio(12);
manager.addPlugin(compressor);

// Process audio
manager.process(sourceNode, targetNode);
```

## 🛡️ Safety Features

1. **Try/Catch Blocks**: All plugin operations are wrapped
2. **Fallback**: If plugins fail, audio routes directly
3. **Optional Loading**: Plugins only load if enabled
4. **No Breaking Changes**: Core functionality works without plugins

## 🎛️ Adding Custom Plugins

Create a class extending `AudioPlugin`:

```javascript
export class MyCustomPlugin extends AudioPlugin {
  constructor() {
    super('MyPlugin');
  }

  create(audioContext) {
    // Create and return an AudioNode
    const node = audioContext.createGain();
    node.gain.value = 0.8;
    return node;
  }
}
```

## ⚠️ Notes

- Plugins only affect the **broadcast chain**, not monitoring meters
- Plugin processing happens in real-time (low latency)
- All plugins use native Web Audio API nodes (no external dependencies)
- Performance impact is minimal when disabled

## 🐛 Troubleshooting

**Plugins not working?**
- Check `PLUGINS_ENABLED` is `true`
- Check browser console for errors
- Verify `pluginsEnabled` state is `true`
- If issues persist, disable plugins - core functionality unaffected

**Audio quality issues?**
- Try disabling plugins to isolate the issue
- Check plugin parameter ranges
- Verify Web Audio API support in browser

---

**Status**: Ready to use, but disabled by default. Enable when needed!

