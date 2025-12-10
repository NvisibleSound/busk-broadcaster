import React from 'react';
import styles from './EQ.module.css';

const EQ = ({ 
  enabled, 
  settings, 
  onEnabledChange,
  onBandChange,
  disabled = false,
  pluginsEnabled,
  setPluginsEnabled,
  eqPlugin,
  setEqPlugin,
  pluginManagerRef
}) => {
  // Use bands from settings, with fallback (3 bands + HPF/LPF)
  const bands = settings?.bands || [
    { frequency: 200, gain: 0, Q: 1, enabled: true },
    { frequency: 1000, gain: 0, Q: 1, enabled: true },
    { frequency: 5000, gain: 0, Q: 1, enabled: true }
  ];
  const hpf = settings?.hpf || { frequency: 80, enabled: true };
  const lpf = settings?.lpf || { frequency: 12000, enabled: true };

  const handleToggle = (e) => {
    const newEnabled = e.target.checked;
    onEnabledChange(newEnabled);
    
    // Auto-enable plugin system when EQ is turned on
    if (newEnabled && !pluginsEnabled) {
      setPluginsEnabled(true);
    }
    
    if (newEnabled && !eqPlugin) {
      import('../utils/audioPlugins').then(module => {
        const eq = new module.EQPlugin();
        // Apply current settings to the plugin
        bands.forEach((band, index) => {
          eq.setBandFrequency(index, band.frequency);
          eq.setBandGain(index, band.gain);
          eq.setBandQ(index, band.Q);
          eq.setBandEnabled(index, band.enabled);
        });
        // Apply HPF/LPF settings
        if (hpf) {
          eq.setHPFFrequency(hpf.frequency);
          eq.setHPFEnabled(hpf.enabled);
        }
        if (lpf) {
          eq.setLPFFrequency(lpf.frequency);
          eq.setLPFEnabled(lpf.enabled);
        }
        setEqPlugin(eq);
        if (pluginManagerRef?.current) {
          pluginManagerRef.current.addPlugin(eq);
        }
      });
    } else if (!newEnabled && eqPlugin) {
      if (pluginManagerRef?.current) {
        pluginManagerRef.current.removePlugin('EQ');
      }
      setEqPlugin(null);
    }
  };

  const formatFrequency = (freq) => {
    if (freq >= 1000) {
      return `${(freq / 1000).toFixed(1)}k`;
    }
    return `${Math.round(freq)}`;
  };

  const handleBandChange = (bandIndex, property, value) => {
    const currentBands = settings?.bands || bands;
    const updatedBands = [...currentBands];
    updatedBands[bandIndex] = { ...updatedBands[bandIndex], [property]: value };
    onBandChange({ ...settings, bands: updatedBands });
    
    if (eqPlugin) {
      if (property === 'frequency') {
        eqPlugin.setBandFrequency(bandIndex, value);
      } else if (property === 'gain') {
        eqPlugin.setBandGain(bandIndex, value);
      } else if (property === 'Q') {
        eqPlugin.setBandQ(bandIndex, value);
      } else if (property === 'enabled') {
        eqPlugin.setBandEnabled(bandIndex, value);
      }
    }
  };

  const handleHPFChange = (property, value) => {
    const updatedHpf = { ...hpf, [property]: value };
    onBandChange({ ...settings, hpf: updatedHpf });
    
    if (eqPlugin) {
      if (property === 'frequency') {
        eqPlugin.setHPFFrequency(value);
      } else if (property === 'enabled') {
        eqPlugin.setHPFEnabled(value);
      }
    }
  };

  const handleLPFChange = (property, value) => {
    const updatedLpf = { ...lpf, [property]: value };
    onBandChange({ ...settings, lpf: updatedLpf });
    
    if (eqPlugin) {
      if (property === 'frequency') {
        eqPlugin.setLPFFrequency(value);
      } else if (property === 'enabled') {
        eqPlugin.setLPFEnabled(value);
      }
    }
  };

  return (
    <div className={styles.pluginCard}>
      <div className={styles.pluginCardHeader}>
        <h4>Parametric EQ</h4>
        <label className={styles.toggleContainer}>
          <span className={enabled ? styles.toggleLabelActive : styles.toggleLabel}>
            {enabled ? 'On' : 'Off'}
          </span>
          <label className={styles.toggleSwitch}>
            <input
              type="checkbox"
              checked={enabled}
              onChange={handleToggle}
              disabled={disabled}
            />
            <span className={styles.toggleSlider}></span>
          </label>
        </label>
      </div>
      
      <div className={styles.compactEqControls}>
        {/* Frequency Row */}
        <div className={styles.eqRow}>
          <div className={styles.rowLabel}>Freq</div>
          <div className={styles.rowKnobs}>
            {/* HPF */}
            <div className={styles.knobContainer}>
              <input
                type="range"
                min="20"
                max="500"
                step="1"
                value={hpf.frequency}
                onChange={(e) => handleHPFChange('frequency', parseFloat(e.target.value))}
                className={styles.knob}
                disabled={disabled || !hpf.enabled || !enabled}
                style={{ '--value': ((hpf.frequency - 20) / (500 - 20)) * 100 }}
              />
              <div className={styles.knobValue}>{formatFrequency(hpf.frequency)}</div>
            </div>
            {/* Bands */}
            {bands.map((band, index) => (
              <div key={index} className={styles.knobContainer}>
                <input
                  type="range"
                  min="20"
                  max="20000"
                  step="1"
                  value={band.frequency}
                  onChange={(e) => handleBandChange(index, 'frequency', parseFloat(e.target.value))}
                  className={styles.knob}
                  disabled={disabled || !band.enabled || !enabled}
                  style={{ '--value': ((Math.log(band.frequency) - Math.log(20)) / (Math.log(20000) - Math.log(20))) * 100 }}
                />
                <div className={styles.knobValue}>{formatFrequency(band.frequency)}</div>
              </div>
            ))}
            {/* LPF */}
            <div className={styles.knobContainer}>
              <input
                type="range"
                min="2000"
                max="20000"
                step="1"
                value={lpf.frequency}
                onChange={(e) => handleLPFChange('frequency', parseFloat(e.target.value))}
                className={styles.knob}
                disabled={disabled || !lpf.enabled || !enabled}
                style={{ '--value': ((Math.log(lpf.frequency) - Math.log(2000)) / (Math.log(20000) - Math.log(2000))) * 100 }}
              />
              <div className={styles.knobValue}>{formatFrequency(lpf.frequency)}</div>
            </div>
          </div>
        </div>

        {/* Q Row */}
        <div className={styles.eqRow}>
          <div className={styles.rowLabel}>Q</div>
          <div className={styles.rowKnobs}>
            {/* Empty placeholder for HPF */}
            <div className={styles.knobContainer} style={{ visibility: 'hidden' }}></div>
            {/* Bands */}
            {bands.map((band, index) => (
              <div key={index} className={`${styles.knobContainer} ${styles.knobContainerSmall}`}>
                <input
                  type="range"
                  min="0.1"
                  max="10"
                  step="0.1"
                  value={band.Q}
                  onChange={(e) => handleBandChange(index, 'Q', parseFloat(e.target.value))}
                  className={styles.knob}
                  disabled={disabled || !band.enabled || !enabled}
                  style={{ '--value': ((band.Q - 0.1) / 9.9) * 100 }}
                />
                <div className={styles.knobValue}>{band.Q.toFixed(1)}</div>
              </div>
            ))}
            {/* Empty placeholder for LPF */}
            <div className={styles.knobContainer} style={{ visibility: 'hidden' }}></div>
          </div>
        </div>

        {/* Gain Row */}
        <div className={styles.eqRow}>
          <div className={styles.rowLabel}>Gain</div>
          <div className={styles.rowKnobs}>
            {/* Empty placeholder for HPF */}
            <div className={styles.knobContainer} style={{ visibility: 'hidden' }}></div>
            {/* Bands */}
            {bands.map((band, index) => (
              <div key={index} className={styles.knobContainer}>
                <input
                  type="range"
                  min="-12"
                  max="12"
                  step="0.5"
                  value={band.gain}
                  onChange={(e) => handleBandChange(index, 'gain', parseFloat(e.target.value))}
                  className={styles.knob}
                  disabled={disabled || !band.enabled || !enabled}
                  style={{ '--value': ((band.gain + 12) / 24) * 100 }}
                />
                <div className={styles.knobValue}>{band.gain >= 0 ? '+' : ''}{band.gain.toFixed(1)}</div>
              </div>
            ))}
            {/* Empty placeholder for LPF */}
            <div className={styles.knobContainer} style={{ visibility: 'hidden' }}></div>
          </div>
        </div>

        {/* Enable Buttons Row */}
        <div className={styles.eqRow}>
          <div className={styles.rowLabel}></div>
          <div className={styles.rowKnobs}>
            <button
              className={`${styles.filterEnableButton} ${hpf.enabled ? styles.filterEnabled : ''}`}
              onClick={() => handleHPFChange('enabled', !hpf.enabled)}
              disabled={disabled}
            >
              {hpf.enabled ? '●' : '○'}
            </button>
            {bands.map((band, index) => (
              <button
                key={index}
                className={`${styles.bandEnableButton} ${band.enabled ? styles.bandEnabled : ''}`}
                onClick={() => handleBandChange(index, 'enabled', !band.enabled)}
                disabled={disabled}
              >
                {band.enabled ? '●' : '○'}
              </button>
            ))}
            <button
              className={`${styles.filterEnableButton} ${lpf.enabled ? styles.filterEnabled : ''}`}
              onClick={() => handleLPFChange('enabled', !lpf.enabled)}
              disabled={disabled}
            >
              {lpf.enabled ? '●' : '○'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EQ;

