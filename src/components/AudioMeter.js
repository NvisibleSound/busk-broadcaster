import React, { useRef, useEffect, useState } from 'react';
import styles from './AudioMeter.module.css';

const AudioMeter = ({ audioContext, mediaStream }) => {
  const [levels, setLevels] = useState({ left: 0, right: 0 });
  const animationFrameRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const gainNodeRef = useRef(null);

  const calculateRMSLevel = (dataArray) => {
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const value = dataArray[i];
      sum += value * value;
    }
    const rms = Math.sqrt(sum / dataArray.length);
    
    // Convert to dB, with adjusted floor
    const db = 20 * Math.log10(Math.max(rms, 0.0000001));
    
    // Split the difference between -90 and -70
    const dbMin = -80;  // Middle ground for quiet signals
    const dbMax = -10;  // Keep ceiling the same
    
    // Clamp dB value between min and max
    const dbClamped = Math.max(dbMin, Math.min(dbMax, db));
    
    // Slightly gentler curve than before
    const normalized = Math.pow((dbClamped - dbMin) / (dbMax - dbMin), 1.1);
    
    return Math.max(0, Math.min(1, normalized));
  };

  const updateLevels = () => {
    if (analyserRef.current) {
      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Float32Array(bufferLength);
      
      analyserRef.current.getFloatTimeDomainData(dataArray);
      const level = calculateRMSLevel(dataArray);
      
      // Smoother attack and decay
      setLevels(prevLevels => {
        const attackSpeed = 0.3;
        const decaySpeed = 0.95;
        
        return {
          left: level > prevLevels.left 
            ? (level * attackSpeed) + (prevLevels.left * (1 - attackSpeed))
            : Math.max(level, prevLevels.left * decaySpeed),
          right: level > prevLevels.right 
            ? (level * attackSpeed) + (prevLevels.right * (1 - attackSpeed))
            : Math.max(level, prevLevels.right * decaySpeed)
        };
      });
      
      animationFrameRef.current = requestAnimationFrame(updateLevels);
    }
  };

  useEffect(() => {
    if (audioContext && mediaStream) {
      sourceRef.current = audioContext.createMediaStreamSource(mediaStream);
      analyserRef.current = audioContext.createAnalyser();
      gainNodeRef.current = audioContext.createGain();

      // Configure analyzer
      analyserRef.current.fftSize = 2048;
      analyserRef.current.smoothingTimeConstant = 0.5;
      analyserRef.current.minDecibels = -50;
      analyserRef.current.maxDecibels = -10;

      // Connect the audio graph
      sourceRef.current
        .connect(gainNodeRef.current)
        .connect(analyserRef.current);

      // Start metering
      updateLevels();
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      // Cleanup audio nodes
      if (sourceRef.current) {
        sourceRef.current.disconnect();
      }
      if (gainNodeRef.current) {
        gainNodeRef.current.disconnect();
      }
      if (analyserRef.current) {
        analyserRef.current.disconnect();
      }
    };
  }, [audioContext, mediaStream]);

  // Expose gain node for external control
  const setGain = (value) => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = value;
    }
  };

  return (
    <div className={styles.stereoMeterContainer}>
      {/* Left Channel */}
      <div className={styles.meterChannel}>
        <div className={styles.verticalMeter}>
          <div 
            className={styles.meterFill}
            style={{ height: `${levels.left * 100}%` }}
          />
        </div>
      </div>
      {/* Right Channel */}
      <div className={styles.meterChannel}>
        <div className={styles.verticalMeter}>
          <div 
            className={styles.meterFill}
            style={{ height: `${levels.right * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default AudioMeter; 