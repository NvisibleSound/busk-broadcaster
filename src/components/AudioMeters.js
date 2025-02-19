import React, { useRef, useEffect, useState } from 'react';
import styles from './AudioMeters.module.css';

const AudioMeters = ({ audioNodes }) => {
  const [audioLevels, setAudioLevels] = useState({ left: 0, right: 0 });
  
  // Refs for analyzer nodes
  const analyserLeft = useRef(null);
  const analyserRight = useRef(null);
  const dataArrayLeft = useRef(new Float32Array(2048));
  const dataArrayRight = useRef(new Float32Array(2048));
  const animationFrameRef = useRef(null);
  const audioChainSetup = useRef(false);

  // Add debug logging for renders and level changes
  useEffect(() => {
    console.log('🎚️ Current audio levels:', audioLevels);
  }, [audioLevels]);

  const updateMeters = () => {
    if (!analyserLeft.current || !analyserRight.current) {
      console.log('📊 Analysers not ready');
      return;
    }
    
    try {
      analyserLeft.current.getFloatTimeDomainData(dataArrayLeft.current);
      analyserRight.current.getFloatTimeDomainData(dataArrayRight.current);
      
      // Remove excessive debug logging
      // const leftSample = dataArrayLeft.current[0];
      // const rightSample = dataArrayRight.current[0];
      // console.log('📊 Raw samples:', { left: leftSample, right: rightSample });
      
      const rmsLeft = Math.sqrt(
        dataArrayLeft.current.reduce((acc, val) => acc + val * val, 0) / dataArrayLeft.current.length
      );
      const rmsRight = Math.sqrt(
        dataArrayRight.current.reduce((acc, val) => acc + val * val, 0) / dataArrayRight.current.length
      );

      // Debug: Log only significant RMS changes
      if (Math.abs(rmsLeft) > 0.01 || Math.abs(rmsRight) > 0.01) {
        console.log('📊 Significant RMS values:', { left: rmsLeft, right: rmsRight });
      }

      const dbLeft = 20 * Math.log10(Math.max(rmsLeft, 1e-7));
      const dbRight = 20 * Math.log10(Math.max(rmsRight, 1e-7));

      const scaleLevel = (db) => {
        // Adjust scaling to be more visible
        const normalized = (db + 60) / 60;
        return Math.max(0.05, Math.min(1, normalized)); // Increased minimum to 0.05 for visibility
      };

      // Only update state if values have changed significantly
      const newLevels = {
        left: scaleLevel(dbLeft),
        right: scaleLevel(dbRight)
      };

      if (Math.abs(newLevels.left - audioLevels.left) > 0.01 ||
          Math.abs(newLevels.right - audioLevels.right) > 0.01) {
        setAudioLevels(newLevels);
      }
      
      animationFrameRef.current = requestAnimationFrame(updateMeters);
    } catch (error) {
      console.error('❌ Error updating meters:', error);
    }
  };

  useEffect(() => {
    console.log('📊 AudioMeters effect running, nodes:', {
      context: audioNodes?.context ? 'exists' : 'missing',
      gainNode: audioNodes?.gainNode ? 'exists' : 'missing',
      contextState: audioNodes?.context?.state,
      gainNodeState: {
        numberOfInputs: audioNodes?.gainNode?.numberOfInputs,
        numberOfOutputs: audioNodes?.gainNode?.numberOfOutputs
      }
    });
    
    if (!audioNodes?.context || !audioNodes?.gainNode) {
      console.log('📊 Missing required audio nodes');
      return;
    }

    const setupAudioChain = async () => {
      try {
        if (audioNodes.context.state !== 'running') {
          console.log('📊 Resuming audio context...');
          await audioNodes.context.resume();
        }

        if (!audioChainSetup.current) {
          console.log('📊 Creating new audio chain...');
          const splitter = audioNodes.context.createChannelSplitter(2);
          
          analyserLeft.current = audioNodes.context.createAnalyser();
          analyserRight.current = audioNodes.context.createAnalyser();
          
          [analyserLeft.current, analyserRight.current].forEach(analyser => {
            analyser.fftSize = 2048;
            analyser.smoothingTimeConstant = 0.8;
            analyser.minDecibels = -90;
            analyser.maxDecibels = 0;
          });
          
          // Connect the chain
          audioNodes.gainNode.connect(splitter);
          splitter.connect(analyserLeft.current, 0);
          splitter.connect(analyserRight.current, 1);
          
          // Log the connections
          console.log('📊 Audio chain connections:', {
            gainToSplitter: audioNodes.gainNode.numberOfOutputs > 0,
            splitterToAnalysers: splitter.numberOfOutputs === 2,
            analyserStates: {
              left: analyserLeft.current.numberOfInputs > 0,
              right: analyserRight.current.numberOfInputs > 0
            }
          });
          
          audioChainSetup.current = true;
          requestAnimationFrame(updateMeters);
        }
      } catch (error) {
        console.error('❌ AudioMeters setup error:', error);
      }
    };

    setupAudioChain();

    return () => {
      console.log('Cleaning up audio chain');
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (analyserLeft.current) {
        try {
          analyserLeft.current.disconnect();
        } catch (e) {
          console.error('Error disconnecting left analyser:', e);
        }
      }
      if (analyserRight.current) {
        try {
          analyserRight.current.disconnect();
        } catch (e) {
          console.error('Error disconnecting right analyser:', e);
        }
      }
    };
  }, [audioNodes?.gainNode]);

  return (
    <div className={styles.stereoMeterContainer}>
      <div className={styles.scaleNumbers}>
        <div>0</div>
        <div>-6</div>
        <div>-12</div>
        <div>-24</div>
        <div>-40</div>
      </div>
      {['left', 'right'].map(channel => (
        <div 
          key={channel} 
          className={styles.meterChannel}
          style={{ border: '1px solid #333' }} // Add visible border for debugging
        >
          <div 
            className={styles.verticalMeter}
            style={{ 
              height: '200px',  // Explicit height
              width: '20px',    // Explicit width
              backgroundColor: '#111' // Dark background to see meter
            }}
          >
            <div 
              className={styles.meterFill}
              style={{
                height: `${audioLevels[channel] * 100}%`,
                backgroundColor:
                  audioLevels[channel] > 0.85 ? '#ff4444' :
                  audioLevels[channel] > 0.75 ? '#ffaa00' :
                  '#00ff00',
                width: '100%',
                position: 'absolute',
                bottom: 0,
                transition: 'height 0.1s ease-out'
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

export default AudioMeters; 