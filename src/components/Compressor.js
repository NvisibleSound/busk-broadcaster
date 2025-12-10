import React from 'react';
import styles from './Compressor.module.css';

const Compressor = ({ 
  enabled, 
  settings, 
  onEnabledChange,
  onSettingsChange,
  disabled = false,
  pluginsEnabled,
  setPluginsEnabled,
  compressorPlugin,
  setCompressorPlugin,
  pluginManagerRef
}) => {
  const {
    threshold = -24,
    ratio = 12,
    knee = 30,
    attack = 0.003,
    release = 0.25,
    makeUpGain = 0,
    inputGain = 0,
    outputGain = 0,
    autoGain = false,
    autoRelease = false,
    limiterEnabled = false,
    limiterThreshold = -0.1
  } = settings || {};

  const handleToggle = (e) => {
    const newEnabled = e.target.checked;
    onEnabledChange(newEnabled);
    
    // Auto-enable plugin system when Compressor is turned on
    if (newEnabled && !pluginsEnabled) {
      setPluginsEnabled(true);
    }
    
    if (newEnabled && !compressorPlugin) {
      import('../utils/audioPlugins').then(module => {
        const compressor = new module.CompressorPlugin();
        // Apply current settings to the plugin
        compressor.setThreshold(threshold);
        compressor.setRatio(ratio);
        compressor.setKnee(knee);
        compressor.setAttack(attack);
        compressor.setRelease(release);
        compressor.setMakeUpGain(makeUpGain);
        compressor.setInputGain(inputGain);
        compressor.setOutputGain(outputGain);
        compressor.setAutoGain(autoGain);
        compressor.setAutoRelease(autoRelease);
        compressor.setLimiterEnabled(limiterEnabled);
        compressor.setLimiterThreshold(limiterThreshold);
        
        setCompressorPlugin(compressor);
        
        // Add to plugin manager if it exists
        if (pluginManagerRef?.current) {
          pluginManagerRef.current.addPlugin(compressor);
        }
      }).catch(error => {
        console.error('Failed to load Compressor plugin:', error);
      });
    }
  };

  const handleSettingChange = (key, value) => {
    const newSettings = { ...settings, [key]: value };
    onSettingsChange(newSettings);
    
    // Update plugin if it exists
    if (compressorPlugin) {
      const methodMap = {
        threshold: 'setThreshold',
        ratio: 'setRatio',
        knee: 'setKnee',
        attack: 'setAttack',
        release: 'setRelease',
        makeUpGain: 'setMakeUpGain',
        inputGain: 'setInputGain',
        outputGain: 'setOutputGain',
        autoGain: 'setAutoGain',
        autoRelease: 'setAutoRelease',
        limiterEnabled: 'setLimiterEnabled',
        limiterThreshold: 'setLimiterThreshold'
      };
      
      const method = methodMap[key];
      if (method && typeof compressorPlugin[method] === 'function') {
        compressorPlugin[method](value);
      }
    }
  };

  const formatRatio = (value) => {
    return `1:${value.toFixed(0)}`;
  };

  const formatTime = (value) => {
    if (value < 0.001) {
      return `${(value * 1000).toFixed(1)}μs`;
    } else if (value < 1) {
      return `${(value * 1000).toFixed(1)}ms`;
    } else {
      return `${value.toFixed(2)}s`;
    }
  };

  return (
    <div className={styles.pluginCard}>
      <div className={styles.pluginCardHeader}>
        <h4>Compressor</h4>
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

      <div className={styles.compressorControls}>
        {/* Top Section: Input Gain (Left), Display (Center), Limiter/Output (Right) */}
        <div className={styles.compressorTopSection}>
          {/* Input Gain Section */}
          <div className={styles.inputGainSection}>
            <div className={styles.verticalFader}>
              <input
                type="range"
                min="-20"
                max="20"
                step="0.5"
                value={inputGain}
                onChange={(e) => handleSettingChange('inputGain', parseFloat(e.target.value))}
                className={styles.fader}
                disabled={disabled || !enabled}
                style={{ '--value': ((inputGain + 20) / 40) * 100 }}
              />
              <div className={styles.faderScale}>
                <span>+20</span>
                <span>0</span>
                <span>-20</span>
              </div>
            </div>
            <div className={styles.knobLabel}>INPUT GAIN</div>
            <div className={styles.knobValue}>{inputGain >= 0 ? '+' : ''}{inputGain.toFixed(1)}</div>
          </div>

          {/* Central Display */}
          <div className={styles.displaySection}>
            <div className={styles.displayHeader}>
              <button className={`${styles.displayButton} ${styles.displayButtonActive}`}>Meter</button>
              <button className={styles.displayButton}>Graph</button>
            </div>
            <div className={styles.displayMeter}>
              <div className={styles.meterScale}>
                <span>-50</span>
                <span>-30</span>
                <span>-20</span>
                <span>-10</span>
                <span>-5</span>
                <span>0</span>
              </div>
              <div className={styles.meterNeedle} style={{ '--level': '15%' }}></div>
            </div>
          </div>

          {/* Limiter/Output Section */}
          <div className={styles.outputSection}>
            
            <div className={styles.verticalFader}>
              <input
                type="range"
                min="-20"
                max="20"
                step="0.5"
                value={outputGain}
                onChange={(e) => handleSettingChange('outputGain', parseFloat(e.target.value))}
                className={styles.fader}
                disabled={disabled || !enabled}
                style={{ '--value': ((outputGain + 20) / 40) * 100 }}
              />
              <div className={styles.faderScale}>
                <span>+20</span>
                <span>0</span>
                <span>-20</span>
              </div>
            </div>
            <div className={styles.knobLabel}>OUTPUT GAIN</div>
            <div className={styles.knobValue}>{outputGain >= 0 ? '+' : ''}{outputGain.toFixed(1)}</div>
          </div>
        </div>

        {/* Main Controls Section */}
        <div className={styles.mainControlsSection}>
          {/* Top Row */}
          <div className={styles.controlRow}>
            <div className={styles.controlGroup}>
              <div className={styles.knobLabel}>THRESHOLD</div>
              <div className={styles.knobContainer}>
                <input
                  type="range"
                  min="-60"
                  max="0"
                  step="0.5"
                  value={threshold}
                  onChange={(e) => handleSettingChange('threshold', parseFloat(e.target.value))}
                  className={styles.knob}
                  disabled={disabled || !enabled}
                  style={{ '--value': ((threshold + 60) / 60) * 100 }}
                />
                <div className={styles.knobValue}>{threshold.toFixed(1)}</div>
              </div>
            </div>

            <div className={styles.controlGroup}>
              <div className={styles.knobLabel}>RATIO</div>
              <div className={styles.knobContainer}>
                <input
                  type="range"
                  min="1"
                  max="20"
                  step="0.5"
                  value={ratio}
                  onChange={(e) => handleSettingChange('ratio', parseFloat(e.target.value))}
                  className={styles.knob}
                  disabled={disabled || !enabled}
                  style={{ '--value': ((ratio - 1) / 19) * 100 }}
                />
                <div className={styles.knobValue}>{formatRatio(ratio)}</div>
              </div>
            </div>

            <div className={styles.controlGroup}>
              <div className={styles.knobLabel}>MAKE UP</div>
              <div className={styles.knobContainer}>
                <input
                  type="range"
                  min="-20"
                  max="20"
                  step="0.5"
                  value={makeUpGain}
                  onChange={(e) => handleSettingChange('makeUpGain', parseFloat(e.target.value))}
                  className={styles.knob}
                  disabled={disabled || !enabled}
                  style={{ '--value': ((makeUpGain + 20) / 40) * 100 }}
                />
                <div className={styles.knobValue}>{makeUpGain >= 0 ? '+' : ''}{makeUpGain.toFixed(1)}</div>
              </div>
            </div>

            <div className={styles.autoGainSection}>
              <div className={styles.autoGainLabel}>AUTO GAIN</div>
              <div className={styles.autoGainButtons}>
                <button
                  className={`${styles.autoButton} ${autoGain ? styles.autoButtonActive : ''}`}
                  onClick={() => handleSettingChange('autoGain', !autoGain)}
                  disabled={disabled || !enabled}
                >
                  ON
                </button>
              </div>
            </div>
          </div>

          {/* Bottom Row */}
          <div className={styles.controlRow}>
            <div className={styles.controlGroup}>
              <div className={styles.knobLabel}>KNEE</div>
              <div className={styles.knobContainer}>
                <input
                  type="range"
                  min="0"
                  max="40"
                  step="1"
                  value={knee}
                  onChange={(e) => handleSettingChange('knee', parseFloat(e.target.value))}
                  className={styles.knob}
                  disabled={disabled || !enabled}
                  style={{ '--value': (knee / 40) * 100 }}
                />
                <div className={styles.knobValue}>{knee.toFixed(0)}</div>
              </div>
            </div>

            <div className={styles.controlGroup}>
              <div className={styles.knobLabel}>ATTACK</div>
              <div className={styles.knobContainer}>
                <input
                  type="range"
                  min="0"
                  max="0.1"
                  step="0.001"
                  value={attack}
                  onChange={(e) => handleSettingChange('attack', parseFloat(e.target.value))}
                  className={styles.knob}
                  disabled={disabled || !enabled}
                  style={{ '--value': (attack / 0.1) * 100 }}
                />
                <div className={styles.knobValue}>{formatTime(attack)}</div>
              </div>
            </div>

            <div className={styles.controlGroup}>
              <div className={styles.knobLabel}>RELEASE</div>
              <div className={styles.knobContainer}>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={release}
                  onChange={(e) => handleSettingChange('release', parseFloat(e.target.value))}
                  className={styles.knob}
                  disabled={disabled || !enabled}
                  style={{ '--value': (release / 1) * 100 }}
                />
                <div className={styles.knobValue}>{formatTime(release)}</div>
              </div>
            </div>

            <div className={styles.autoReleaseSection}>
              <div className={styles.autoReleaseLabel}>AUTO</div>
              <button
                className={`${styles.autoButton} ${autoRelease ? styles.autoButtonActive : ''}`}
                onClick={() => handleSettingChange('autoRelease', !autoRelease)}
                disabled={disabled || !enabled}
              >
                ON
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Compressor;

