import React, { useRef, useEffect, useState } from 'react';
import styles from './AudioMeters.module.css';

const AudioMeters = ({ audioNodes, isRecording }) => {
  const [audioLevels, setAudioLevels] = useState({ left: 0, right: 0 });
  
  // Refs for analyzer nodes
  const analyserLeft = useRef(null);
  const analyserRight = useRef(null);
  const dataArrayLeft = useRef(new Float32Array(2048));
  const dataArrayRight = useRef(new Float32Array(2048));
  const animationFrameRef = useRef(null);

  useEffect(() => {
    console.log('Audio nodes received:', audioNodes);

    if (audioNodes?.context?.state === 'running' && audioNodes?.gainNode) {
      console.log('Creating audio chain');
      try {
        // Create stereo splitter
        const splitter = audioNodes.context.createChannelSplitter(2);
        
        // Create analyzers for each channel
        analyserLeft.current = audioNodes.context.createAnalyser();
        analyserRight.current = audioNodes.context.createAnalyser();
        
        // Configure analyzers
        [analyserLeft.current, analyserRight.current].forEach(analyser => {
          analyser.fftSize = 2048;
          analyser.smoothingTimeConstant = 0.8;
          analyser.minDecibels = -90;
          analyser.maxDecibels = 0;
        });
        
        // Connect the audio graph
        audioNodes.gainNode.connect(splitter);
        splitter.connect(analyserLeft.current, 0);
        splitter.connect(analyserRight.current, 1);
        
        console.log('Audio chain connected');
        requestAnimationFrame(updateMeters);
      } catch (error) {
        console.error('Error setting up audio chain:', error);
      }
    }

    return () => {
      console.log('Cleaning up audio nodes');
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (analyserLeft.current) {
        try {
          analyserLeft.current.disconnect();
        } catch (e) {
          console.log('Error disconnecting left analyser:', e);
        }
      }
      if (analyserRight.current) {
        try {
          analyserRight.current.disconnect();
        } catch (e) {
          console.log('Error disconnecting right analyser:', e);
        }
      }
    };
  }, [audioNodes]);

  const updateMeters = () => {
    if (analyserLeft.current && analyserRight.current) {
      analyserLeft.current.getFloatTimeDomainData(dataArrayLeft.current);
      analyserRight.current.getFloatTimeDomainData(dataArrayRight.current);

      // Calculate RMS values
      const rmsLeft = Math.sqrt(
        dataArrayLeft.current.reduce((acc, val) => acc + val * val, 0) 
        / dataArrayLeft.current.length
      );
      
      const rmsRight = Math.sqrt(
        dataArrayRight.current.reduce((acc, val) => acc + val * val, 0) 
        / dataArrayRight.current.length
      );

      // Convert to dB
      const dbLeft = 20 * Math.log10(Math.max(rmsLeft, 1e-7));
      const dbRight = 20 * Math.log10(Math.max(rmsRight, 1e-7));


      // Simpler scaling for debugging
      const scaleLevel = (db) => {
        // Map -60dB to 0% and 0dB to 100%
        const normalized = (db + 60) / 60;
        return Math.max(0.02, Math.min(1, normalized));
      };

      const leftLevel = scaleLevel(dbLeft);
      const rightLevel = scaleLevel(dbRight);


      setAudioLevels({
        left: leftLevel,
        right: rightLevel
      });
    }

    animationFrameRef.current = requestAnimationFrame(updateMeters);
  };

  // Update the meter rendering to include color zones
  return (
    <div className={styles.stereoMeterContainer}>
      <div className={styles.scaleNumbers}>
        <div>0</div>
        <div>6</div>
        <div>12</div>
        <div>24</div>
        <div>40</div>
      </div>
      {['left', 'right'].map(channel => (
        <div key={channel} className={styles.meterChannel}>
          <div className={styles.verticalMeter}>
            <div 
              className={styles.meterFill}
              style={{
                height: `${audioLevels[channel] * 100}%`,
                backgroundColor: audioLevels[channel] > 0.85 ? '#ff4444' :  
                              audioLevels[channel] > 0.75 ? '#ffaa00' :  
                              'rgb(0, 255, 0)'
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

export default AudioMeters; 