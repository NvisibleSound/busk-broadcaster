import React, { useState, useRef, useEffect } from 'react';
import { PiBroadcastThin } from "react-icons/pi";
import { BsBroadcast } from "react-icons/bs";
import styles from './IcecastBroadcaster.module.css';
import AudioMeter from './AudioMeter';
import AudioInput from './AudioInput';
import AudioControls from './AudioControls';

const IcecastBroadcaster = () => {
  const [isRecording, setIsRecording] = useState(false);
  const isRecordingRef = useRef(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioDevices, setAudioDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('');

  const [audioContext, setAudioContext] = useState(null);
  const [mediaStream, setMediaStream] = useState(null);
  const mediaRecorder = useRef(null);
  const durationInterval = useRef(null);
  const analyserRef = useRef(null);
  const wsRef = useRef(null);
  const audioMenuRef = useRef(null);
  const animationFrameRef = useRef(null);
  const knobRef = useRef(null);

  // Add connection state tracking
  const [isConnected, setIsConnected] = useState(false);
  const connectionAttempts = useRef(0);
  const maxRetries = 3;

  // Add status message state
  const [statusMessage, setStatusMessage] = useState('');

  const [showAudioMenu, setShowAudioMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Add new state for broadcast stats
  const [broadcastStats, setBroadcastStats] = useState({
    mountPoint: '/ether',
    streamTime: '00:00:00',
    listeners: 0,
    audioFormat: '',
    bitrate: '128 kbps',
    sampleRate: '44.1 kHz',
    channels: 2
  });

  // Update audio level state to handle stereo
  const [audioLevels, setAudioLevels] = useState({ left: 0, right: 0 });

  const calculateRMSLevel = (dataArray) => {
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const value = dataArray[i];
      sum += value * value;
    }
    const rms = Math.sqrt(sum / dataArray.length);
    
    // Convert to dB with adjusted range
    const db = 20 * Math.log10(Math.max(rms, 0.0000001));
    
    // Adjust the mapping range for better visibility
    // Map dB range (-50...0) to (0...1) with a more aggressive curve
    const normalized = (db + 50) / 50;  // Changed from 60 to 50 for more sensitivity
    
    // Apply a non-linear scaling to boost low-level signals
    const scaled = Math.pow(normalized, 0.7);  // Added exponential scaling
    
    // Amplify the result slightly and clamp between 0 and 1
    return Math.max(0, Math.min(1, scaled * 1.2));  // Amplified by 1.2
  };

  const updateLevels = () => {
    if (analyserRef.current && isRecording) {
      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Float32Array(bufferLength);
      
      analyserRef.current.getFloatTimeDomainData(dataArray);
      const level = calculateRMSLevel(dataArray);
      
      // More aggressive smoothing
      setAudioLevels(prevLevels => ({
        left: Math.max(level, prevLevels.left * 0.75),  // Even faster decay
        right: Math.max(level, prevLevels.right * 0.75) // Even faster decay
      }));
      
      animationFrameRef.current = requestAnimationFrame(updateLevels);
    } else {
      setAudioLevels({ left: 0, right: 0 });
    }
  };

  // Add this effect
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (audioMenuRef.current && !audioMenuRef.current.contains(event.target)) {
        setShowAudioMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    // Get available audio devices
    const getAudioDevices = async () => {
      try {
        // First request permission to access audio devices
        await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // Then enumerate devices
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(device => device.kind === 'audioinput');
        setAudioDevices(audioInputs);
        if (audioInputs.length > 0) {
          // Set first device as default and initialize metering for all channels
          setSelectedDevice(audioInputs[0].deviceId);
          const defaultDevice = audioInputs[0];
          if (defaultDevice.channelCount) {
            setAudioLevels(
              Array(defaultDevice.channelCount).fill(0).reduce((acc, _, idx) => {
                acc[`channel${idx}`] = 0;
                return acc;
              }, {})
            );
          } else {
            // Fallback to stereo if channel count not available
            setAudioLevels({left: 0, right: 0});
          }
        }
      } catch (error) {
        console.error('Error accessing audio devices:', error);
      }
    };

    getAudioDevices();

    return () => {
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
      }
      stopBroadcast();
    };
  }, []);

  // Add timer for stream duration
  useEffect(() => {
    if (isRecording) {
      const startTime = Date.now();
      durationInterval.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const hours = Math.floor(elapsed / 3600000);
        const minutes = Math.floor((elapsed % 3600000) / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        setBroadcastStats(prev => ({ ...prev, streamTime: timeString }));
      }, 1000);
    }
    return () => {
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
      }
    };
  }, [isRecording]);

  // Add this effect to handle stats polling
  useEffect(() => {
    let statsInterval;
    if (isRecording && wsRef.current) {
      const fetchStats = () => {
        wsRef.current.send(JSON.stringify({ type: 'GET_STATS' }));
      };
      
      fetchStats(); // Initial fetch
      statsInterval = setInterval(fetchStats, 5000); // Poll every 5 seconds
    }
    return () => {
      if (statsInterval) {
        clearInterval(statsInterval);
      }
    };
  }, [isRecording]);

  // Add this useEffect to set up audio when device is selected
  useEffect(() => {
    const setupAudio = async () => {
      try {
        // Create audio context if it doesn't exist
        const context = new AudioContext();
        
        // Get media stream with selected device
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: selectedDevice,
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
          }
        });
        
        setAudioContext(context);
        setMediaStream(stream);
        
      } catch (error) {
        console.error('Error setting up audio:', error);
      }
    };

    if (selectedDevice) {
      setupAudio();
    }

    // Cleanup
    return () => {
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
      }
      if (audioContext) {
        audioContext.close();
      }
    };
  }, [selectedDevice]);

  const startBroadcast = async () => {
    try {
      // Test all possible formats first
      const formats = [
        'audio/ogg;codecs=vorbis',
        'audio/ogg;codecs=opus',
        'audio/webm;codecs=opus',
        'audio/mp3',
        'audio/mpeg',
        'audio/wav'
      ];

      console.log('Checking supported formats:');
      formats.forEach(format => {
        console.log(`${format}: ${MediaRecorder.isTypeSupported(format)}`);
      });

      setStatusMessage('Starting broadcast...');
      setIsRecording(true);
      isRecordingRef.current = true;
      
      // Create audio context if it doesn't exist
      const context = new AudioContext();
      setAudioContext(context);

      // Get media stream with selected device
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: selectedDevice,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 44100,
          channelCount: 2
        }
      });
      
      setMediaStream(stream);

      // Set up audio pipeline
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      const destination = context.createMediaStreamDestination();
      
      // Configure analyzer
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.5;
      analyser.minDecibels = -50;
      analyser.maxDecibels = -10;

      // Connect the audio graph
      source.connect(analyser);
      analyser.connect(destination);
      
      // Create and wait for WebSocket connection
      const socket = new WebSocket('ws://localhost:3001');
      
      // Try Ogg format first, then fall back to WebM
      const mimeType = 'audio/webm;codecs=opus';  // We know this works
      console.log('Using MIME type:', mimeType);

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('WebSocket connection timeout'));
        }, 5000);

        socket.onopen = () => {
          clearTimeout(timeout);
          console.log('WebSocket connected successfully');
          
          // Send config only after connection is established
          socket.send(JSON.stringify({
            type: 'config',
            mountPoint: '/ether',
            format: mimeType,
            sampleRate: 48000,
            channels: 2,
            bitrate: 128000
          }));
          
          resolve();
        };

        socket.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('WebSocket connection failed'));
        };
      });

      wsRef.current = socket;
      
      socket.onclose = (event) => {
        console.log('WebSocket closed:', event);
        if (isRecordingRef.current) {
          stopBroadcast();
        }
      };

      socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        setStatusMessage('Connection error');
      };

      mediaRecorder.current = new MediaRecorder(destination.stream, {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 128000
      });

      mediaRecorder.current.ondataavailable = (event) => {
        if (event.data.size > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
          console.log('Audio chunk size:', event.data.size);
          wsRef.current.send(event.data);
        }
      };

      mediaRecorder.current.onstart = () => {
        console.log('MediaRecorder started with format:', mimeType);
        setStatusMessage('Broadcasting');
      };

      // Use larger chunks for more stable streaming
      mediaRecorder.current.start(500);  // 500ms chunks instead of 100ms
      
      // After a second, switch to larger chunks
      setTimeout(() => {
        if (mediaRecorder.current?.state === 'recording') {
          mediaRecorder.current.stop();
          mediaRecorder.current.start(500); // Switch to 500ms chunks
        }
      }, 1000);
      
    } catch (error) {
      console.error('Failed to start broadcast:', error);
      setStatusMessage('Failed to start broadcast');
      setIsRecording(false);
      isRecordingRef.current = false;
      throw error;
    }
  };

  const stopBroadcast = () => {
    setStatusMessage('Stopping broadcast...');
    isRecordingRef.current = false;
    setIsRecording(false);
    
    // First stop recording
    if (mediaRecorder.current?.state === 'recording') {
      mediaRecorder.current.stop();
    }

    // Clean up WebSocket
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // Stop all tracks in the media stream
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
    }

    // Clean up audio context
    if (audioContext) {
      audioContext.close();
    }

    // Clean up animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    // Reset all states
    setIsConnected(false);
    setAudioLevels({ left: 0, right: 0 });
    setDuration(0);
    setMediaStream(null);
    setAudioContext(null);
    connectionAttempts.current = 0;
    setStatusMessage('Broadcast stopped');
  };

  // Add cleanup in useEffect
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return (
    <div className={styles.broadcasterContainer}>
      <div className={styles.broadcaster}>
        {/* header */}
        <header className={styles.broadcastHeader}>
          <AudioControls 
            selectedDevice={selectedDevice}
            onDeviceSelect={setSelectedDevice}
            showMenu={showAudioMenu}
            onToggleMenu={() => setShowAudioMenu(!showAudioMenu)}
            audioMenuRef={audioMenuRef}
          />
          
          <div className={styles.statusIndicator}>
            <div className={styles.broadcastIconWrapper}>
              {isRecording 
                ? <BsBroadcast className={`${styles.broadcastIcon} ${styles.active}`} size={20} />
                : <PiBroadcastThin className={styles.broadcastIcon} size={20} />
              }
            </div>
        
          </div>
          
          <div 
            className={styles.headerItem}
            onClick={() => setShowSettings(!showSettings)}
          >
            Settings
          </div>
        </header>

        {/* audio controls */}

        <div className={styles.audioControls}>
          <div className={styles.controlsRow}>
            <AudioMeter 
              audioContext={audioContext}
              mediaStream={mediaStream}
            />
          </div>
        </div>

        <div className={styles.broadcastStats}>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Mount:</span>
            <span className={styles.statValue}>{isRecording ? broadcastStats.mountPoint : '-'}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Time:</span>
            <span className={styles.statValue}>{isRecording ? broadcastStats.streamTime : '00:00:00'}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Listeners:</span>
            <span className={styles.statValue}>{isRecording ? broadcastStats.listeners : '0'}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Format:</span>
            <span className={styles.statValue}>{isRecording ? broadcastStats.audioFormat : '-'}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Bitrate:</span>
            <span className={styles.statValue}>{isRecording ? broadcastStats.bitrate : '128 kbps'}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Sample Rate:</span>
            <span className={styles.statValue}>{isRecording ? broadcastStats.sampleRate : '44.1 kHz'}</span>
          </div>
        </div>

        {/* Button */}
        <div className={styles.buttonContainer}>
          <button
            onClick={isRecording ? stopBroadcast : startBroadcast}
            className={`${styles.broadcastButton} ${isRecording ? styles.recording : ''}`}
          >
            <div className={`${styles.buttonIcon} ${isRecording ? styles.stop : styles.start}`} />
          </button>
        </div>

       
      </div>
    </div>
  );
};

export default IcecastBroadcaster; 