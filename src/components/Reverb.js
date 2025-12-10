import React from 'react';
import styles from './Reverb.module.css';

const Reverb = ({ 
  enabled, 
  settings, 
  onEnabledChange,
  onSettingsChange,
  disabled = false,
  pluginsEnabled,
  setPluginsEnabled,
  reverbPlugin,
  setReverbPlugin,
  pluginManagerRef
}) => {
  const {
    mix = 0.444,
    predelay = 0,
    decay = 0.8,
    size = 0.224,
    width = 1.072,
    lowFreq = 400,
    highFreq = 9000,
    lowGain = 0,
    highGain = -1.5,
    rate = 0.4,
    depth = 0.32
  } = settings || {};

  const handleToggle = (e) => {
    const newEnabled = e.target.checked;
    onEnabledChange(newEnabled);
    
    // Auto-enable plugin system when Reverb is turned on
    if (newEnabled && !pluginsEnabled) {
      setPluginsEnabled(true);
    }
    
    if (newEnabled && !reverbPlugin) {
      import('../utils/audioPlugins').then(module => {
        const reverb = new module.ReverbPlugin();
        // Apply current settings to the plugin
        reverb.setMix(mix);
        reverb.setPredelay(predelay);
        reverb.setDecay(decay);
        reverb.setSize(size);
        reverb.setWidth(width);
        reverb.setLowFreq(lowFreq);
        reverb.setHighFreq(highFreq);
        reverb.setLowGain(lowGain);
        reverb.setHighGain(highGain);
        reverb.setRate(rate);
        reverb.setDepth(depth);
        
        setReverbPlugin(reverb);
        
        // Add to plugin manager if it exists
        if (pluginManagerRef?.current) {
          pluginManagerRef.current.addPlugin(reverb);
        }
      }).catch(error => {
        console.error('Failed to load Reverb plugin:', error);
      });
    }
  };

  const handleSettingChange = (key, value) => {
    const newSettings = { ...settings, [key]: value };
    onSettingsChange(newSettings);
    
    // Update plugin if it exists
    if (reverbPlugin) {
      const methodMap = {
        mix: 'setMix',
        predelay: 'setPredelay',
        decay: 'setDecay',
        size: 'setSize',
        width: 'setWidth',
        lowFreq: 'setLowFreq',
        highFreq: 'setHighFreq',
        lowGain: 'setLowGain',
        highGain: 'setHighGain',
        rate: 'setRate',
        depth: 'setDepth'
      };
      
      const method = methodMap[key];
      if (method && typeof reverbPlugin[method] === 'function') {
        reverbPlugin[method](value);
      }
    }
  };

  const formatFrequency = (freq) => {
    if (freq >= 1000) {
      return `${(freq / 1000).toFixed(1)}k`;
    }
    return `${freq.toFixed(0)}`;
  };

  return (
    <div className={styles.pluginCard}>
      <div className={styles.pluginCardHeader}>
        <h4>Reverb</h4>
        <div className={styles.toggleContainer}>
          <label className={enabled ? styles.toggleLabelActive : styles.toggleLabel}>
            {enabled ? 'On' : 'Off'}
          </label>
          <label className={styles.toggleSwitch}>
            <input
              type="checkbox"
              checked={enabled}
              onChange={handleToggle}
              disabled={disabled}
            />
            <span className={styles.toggleSlider}></span>
          </label>
        </div>
      </div>

      <div className={styles.reverbControls}>
        {/* Top Row: MIX, DECAY, SIZE, MOD */}
        <div className={styles.controlSections}>
          {/* MIX Section */}
          <div className={styles.controlSection}>
            <div className={styles.sectionLabel}>MIX</div>
            <div className={styles.knobContainer}>
              <input
                type="range"
                min="0"
                max="1"
                step="0.001"
                value={mix}
                onChange={(e) => handleSettingChange('mix', parseFloat(e.target.value))}
                className={styles.knob}
                disabled={disabled || !enabled}
                style={{ '--value': (mix * 100) }}
              />
              <div className={styles.knobValue}>{(mix * 100).toFixed(1)} %</div>
            </div>
            <div className={styles.knobContainer}>
              <input
                type="range"
                min="0"
                max="200"
                step="0.1"
                value={predelay}
                onChange={(e) => handleSettingChange('predelay', parseFloat(e.target.value))}
                className={styles.knob}
                disabled={disabled || !enabled}
                style={{ '--value': (predelay / 200) * 100 }}
              />
              <div className={styles.knobLabel}>PREDELAY</div>
              <div className={styles.knobValue}>{predelay.toFixed(1)} ms</div>
            </div>
          </div>

          {/* DECAY Section */}
          <div className={styles.controlSection}>
            <div className={styles.sectionLabel}>DECAY</div>
            <div className={`${styles.knobContainer} ${styles.knobContainerLarge}`}>
              <input
                type="range"
                min="0"
                max="10"
                step="0.01"
                value={decay}
                onChange={(e) => handleSettingChange('decay', parseFloat(e.target.value))}
                className={styles.knob}
                disabled={disabled || !enabled}
                style={{ '--value': (decay / 10) * 100 }}
              />
              <div className={styles.knobValue}>{decay.toFixed(1)} s</div>
            </div>
          </div>

          {/* SIZE Section */}
          <div className={styles.controlSection}>
            <div className={styles.sectionLabel}>SIZE</div>
            <div className={styles.knobContainer}>
              <input
                type="range"
                min="0"
                max="1"
                step="0.001"
                value={size}
                onChange={(e) => handleSettingChange('size', parseFloat(e.target.value))}
                className={styles.knob}
                disabled={disabled || !enabled}
                style={{ '--value': (size * 100) }}
              />
              <div className={styles.knobValue}>{(size * 100).toFixed(1)} %</div>
            </div>
            <div className={styles.knobContainer}>
              <input
                type="range"
                min="0"
                max="2"
                step="0.001"
                value={width}
                onChange={(e) => handleSettingChange('width', parseFloat(e.target.value))}
                className={styles.knob}
                disabled={disabled || !enabled}
                style={{ '--value': (width / 2) * 100 }}
              />
              <div className={styles.knobLabel}>WIDTH</div>
              <div className={styles.knobValue}>{(width * 100).toFixed(1)} %</div>
            </div>
          </div>
        </div>

        {/* Bottom Row: MOD and EQ Sections */}
        <div className={styles.bottomRow}>
          {/* MOD Section */}
          <div className={styles.controlSection}>
            <div className={styles.sectionLabel}>MOD</div>
            <div className={styles.knobContainer}>
              <input
                type="range"
                min="0"
                max="10"
                step="0.01"
                value={rate}
                onChange={(e) => handleSettingChange('rate', parseFloat(e.target.value))}
                className={styles.knob}
                disabled={disabled || !enabled}
                style={{ '--value': (rate / 10) * 100 }}
              />
              <div className={styles.knobLabel}>Rate</div>
              <div className={styles.knobValue}>{rate.toFixed(2)} Hz</div>
            </div>
            <div className={styles.knobContainer}>
              <input
                type="range"
                min="0"
                max="1"
                step="0.001"
                value={depth}
                onChange={(e) => handleSettingChange('depth', parseFloat(e.target.value))}
                className={styles.knob}
                disabled={disabled || !enabled}
                style={{ '--value': (depth * 100) }}
              />
              <div className={styles.knobLabel}>Depth</div>
              <div className={styles.knobValue}>{(depth * 100).toFixed(1)} %</div>
            </div>
          </div>

          {/* EQ Section */}
          <div className={styles.controlSection}>
            <div className={styles.sectionLabel}>EQ</div>
            <div className={styles.eqGrid}>
              <div className={styles.knobContainer}>
                <input
                  type="range"
                  min="20"
                  max="20000"
                  step="1"
                  value={lowFreq}
                  onChange={(e) => handleSettingChange('lowFreq', parseFloat(e.target.value))}
                  className={styles.knob}
                  disabled={disabled || !enabled}
                  style={{ '--value': ((Math.log(lowFreq) - Math.log(20)) / (Math.log(20000) - Math.log(20))) * 100 }}
                />
                <div className={styles.knobLabel}>LowFreq</div>
                <div className={styles.knobValue}>{formatFrequency(lowFreq)} Hz</div>
              </div>
              <div className={styles.knobContainer}>
                <input
                  type="range"
                  min="20"
                  max="20000"
                  step="1"
                  value={highFreq}
                  onChange={(e) => handleSettingChange('highFreq', parseFloat(e.target.value))}
                  className={styles.knob}
                  disabled={disabled || !enabled}
                  style={{ '--value': ((Math.log(highFreq) - Math.log(20)) / (Math.log(20000) - Math.log(20))) * 100 }}
                />
                <div className={styles.knobLabel}>HighFreq</div>
                <div className={styles.knobValue}>{formatFrequency(highFreq)} Hz</div>
              </div>
              <div className={styles.knobContainer}>
                <input
                  type="range"
                  min="-20"
                  max="20"
                  step="0.1"
                  value={lowGain}
                  onChange={(e) => handleSettingChange('lowGain', parseFloat(e.target.value))}
                  className={styles.knob}
                  disabled={disabled || !enabled}
                  style={{ '--value': ((lowGain + 20) / 40) * 100 }}
                />
                <div className={styles.knobLabel}>LowGain</div>
                <div className={styles.knobValue}>{lowGain >= 0 ? '+' : ''}{lowGain.toFixed(1)} dB</div>
              </div>
              <div className={styles.knobContainer}>
                <input
                  type="range"
                  min="-20"
                  max="20"
                  step="0.1"
                  value={highGain}
                  onChange={(e) => handleSettingChange('highGain', parseFloat(e.target.value))}
                  className={styles.knob}
                  disabled={disabled || !enabled}
                  style={{ '--value': ((highGain + 20) / 40) * 100 }}
                />
                <div className={styles.knobLabel}>HighGain</div>
                <div className={styles.knobValue}>{highGain >= 0 ? '+' : ''}{highGain.toFixed(1)} dB</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reverb;

