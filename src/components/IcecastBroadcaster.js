import React, { useState, useRef, useEffect } from 'react';
import { PiBroadcastThin } from "react-icons/pi";
import { BsBroadcast } from "react-icons/bs";
import styles from './IcecastBroadcaster.module.css';
import { defaultServerConfig } from '../config/BroadcastConfig';
import AudioMeters from './AudioMeters';

const IcecastBroadcaster = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioDevices, setAudioDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [audioLevels, setAudioLevels] = useState({ left: 0, right: 0 });

  const audioContext = useRef(null);
  const mediaStream = useRef(null);
  const mediaRecorder = useRef(null);
  const durationInterval = useRef(null);
  const audioMenuRef = useRef(null);
  const gainNode = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const knobRef = useRef(null);

  // Add connection state tracking
  const [isConnected, setIsConnected] = useState(false);
  const connectionAttempts = useRef(0);
  const maxRetries = 3;

  // Add status message state
  const [statusMessage, setStatusMessage] = useState('');

  // Rename ws to wsRef to avoid shadowing
  const wsRef = useRef(null);

  const [showAudioMenu, setShowAudioMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Add state for server config to allow runtime updates
  const [serverConfig, setServerConfig] = useState(defaultServerConfig);

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

  // Add these new states
  const [inputGain, setInputGain] = useState(1);
  const [gain, setGain] = useState(1);
  const [volume, setVolume] = useState(1);
  const [isDragging, setIsDragging] = useState(false);

  const [audioNodes, setAudioNodes] = useState(null);

  // Add a state to track when audio is ready
  const [audioReady, setAudioReady] = useState(false);

  const handleGainChange = (e) => {
    const value = parseFloat(e.target.value);
    setInputGain(value);
    if (gainNode.current) {
      gainNode.current.gain.value = value;
    }
  };

  const calculateRMSLevel = (dataArray) => {
    const sum = dataArray.reduce((acc, val) => acc + (val * val), 0);
    const rms = Math.sqrt(sum / dataArray.length);
    return Math.min(1, rms); // Normalize between 0 and 1
  };

  const updateLevels = () => {
    if (analyserRef.current) {
      const dataArrayLeft = new Float32Array(analyserRef.current.fftSize);
      const dataArrayRight = new Float32Array(analyserRef.current.fftSize);
      
      analyserRef.current.getFloatTimeDomainData(dataArrayLeft);
      analyserRef.current.getFloatTimeDomainData(dataArrayRight);

      // Add debug logging
      console.log('Left channel data:', dataArrayLeft[0], 'Right channel data:', dataArrayRight[0]);

      const newLevels = {
        left: calculateRMSLevel(dataArrayLeft),
        right: calculateRMSLevel(dataArrayRight)
      };
      
      // Add debug logging
      console.log('Calculated levels:', newLevels);
      
      setAudioLevels(newLevels);
      animationFrameRef.current = requestAnimationFrame(updateLevels);
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
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop()); // Stop the test stream
        
        // Then enumerate devices
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(device => device.kind === 'audioinput');
        setAudioDevices(audioInputs);
        if (audioInputs.length > 0) {
          setSelectedDevice(audioInputs[0].deviceId);
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
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContext.current) {
        audioContext.current.close();
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

  const fetchStats = async () => {
    try {
      // Add auth headers for stats
      const response = await fetch(`http://${serverConfig.url}/admin/stats.json`, {
        headers: {
          'Accept': 'application/json',
          'Authorization': 'Basic ' + btoa('admin:hackme')
        }
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          console.error('Stats authentication failed');
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Update stats if we have mount point data
      if (data.icestats && data.icestats.source) {
        const sources = Array.isArray(data.icestats.source) 
          ? data.icestats.source 
          : [data.icestats.source];
          
        const etherSource = sources.find(s => s.mount === '/ether');
        
        if (etherSource) {
          setBroadcastStats(prev => ({
            ...prev,
            mountPoint: etherSource.mount,
            streamTime: etherSource.stream_start_iso8601 || prev.streamTime,
            listeners: etherSource.listeners || 0,
            audioFormat: etherSource.server_type || 'Opus',
            bitrate: `${etherSource['ice-bitrate'] || 128} kbps`,
            sampleRate: `${etherSource.audio_samplerate || 48000} Hz`,
            channels: etherSource.audio_channels || 2
          }));
        }
      }
    } catch (error) {
      console.error('Failed to fetch broadcast stats:', error);
    }
  };

  const startBroadcast = async () => {
    try {
      console.log('Starting broadcast...');
      
      // Get user media stream
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });
      
      mediaStream.current = stream;
      
      // Set up WebSocket connection
      const wsUrl = 'ws://localhost:3001';
      console.log('Connecting to WebSocket:', wsUrl);
      
      wsRef.current = new WebSocket(wsUrl);
      wsRef.current.binaryType = 'arraybuffer';

      wsRef.current.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        
        // Create and start MediaRecorder
        mediaRecorder.current = new MediaRecorder(stream, {
          mimeType: 'audio/webm;codecs=opus',
          audioBitsPerSecond: 128000
        });

        mediaRecorder.current.ondataavailable = (event) => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(event.data);
          }
        };

        mediaRecorder.current.start(100);
        setIsRecording(true);
      };

      wsRef.current.onclose = () => {
        console.log('WebSocket closed');
        setIsConnected(false);
        stopBroadcast();
      };

      wsRef.current.onmessage = (event) => {
        console.log('Received message from server:', event.data);
      };
      
    } catch (error) {
      console.error('Failed to start broadcast:', error);
      setIsRecording(false);
    }
  };

  const stopBroadcast = () => {
    setStatusMessage('Stopping broadcast...');
    setIsConnected(false);
    setAudioNodes(null);  // Clear audio nodes
    
    if (mediaRecorder.current?.state === 'recording') {
      mediaRecorder.current.stop();
    }
    
    mediaStream.current?.getTracks().forEach(track => track.stop());
    
    if (audioContext.current && audioContext.current.state !== 'closed') {
      audioContext.current.close();
    }
    
    clearInterval(durationInterval.current);
    setIsRecording(false);
    setDuration(0);
    connectionAttempts.current = 0;
    setStatusMessage('Broadcast stopped');
  };

  // Add these functions to handle the knob rotation
  const handleKnobMouseDown = (e) => {
    setIsDragging(true);
    document.addEventListener('mousemove', handleKnobMouseMove);
    document.addEventListener('mouseup', handleKnobMouseUp);
  };

  const handleKnobMouseMove = (e) => {
    if (isDragging && knobRef.current) {
      const knob = knobRef.current;
      const rect = knob.getBoundingClientRect();
      const center = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      };
      
      const angle = Math.atan2(e.clientY - center.y, e.clientX - center.x);
      let degrees = angle * (180 / Math.PI) + 90;
      if (degrees < 0) degrees += 360;
      
      // Limit rotation to 270 degrees (from -45 to 225 degrees)
      const normalizedDegrees = Math.max(-45, Math.min(225, degrees));
      const percentage = (normalizedDegrees + 45) / 270;
      const newGain = percentage * 10; // Max gain of 10
      
      setGain(newGain);
      if (gainNode.current) {
        gainNode.current.gain.value = newGain;
      }
    }
  };

  const handleKnobMouseUp = () => {
    setIsDragging(false);
    document.removeEventListener('mousemove', handleKnobMouseMove);
    document.removeEventListener('mouseup', handleKnobMouseUp);
  };

  // Add this useEffect for initial audio setup
  useEffect(() => {
    const setupInitialAudio = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: selectedDevice ? { exact: selectedDevice } : undefined,
            channelCount: 2,
            sampleRate: 48000
          }
        });
        
        mediaStream.current = stream;
        
        // Create audio context and nodes
        audioContext.current = new AudioContext();
        const source = audioContext.current.createMediaStreamSource(stream);
        gainNode.current = audioContext.current.createGain();
        const analyser = audioContext.current.createAnalyser();
        analyserRef.current = analyser;
        
        // Configure analyser
        analyserRef.current.fftSize = 2048;
        
        // Connect the audio graph for monitoring
        source.connect(gainNode.current);
        gainNode.current.connect(analyserRef.current);
        
        // Set initial gain value
        if (gainNode.current) {
          gainNode.current.gain.value = gain * volume;
        }

        // Signal that audio is ready
        setAudioReady(true);

      } catch (error) {
        console.error('Failed to setup initial audio:', error);
        setStatusMessage('Failed to access audio device');
      }
    };

    if (selectedDevice) {
      setupInitialAudio();
    }

    return () => {
      setAudioReady(false);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (mediaStream.current) {
        mediaStream.current.getTracks().forEach(track => track.stop());
      }
      if (audioContext.current) {
        audioContext.current.close();
      }
    };
  }, [selectedDevice, gain, volume]);

  useEffect(() => {
    return () => {
      stopBroadcast();
    };
  }, []);

  return (
    <div className={styles.broadcasterContainer}>
      <div className={styles.broadcaster}>
        <header className={styles.broadcastHeader}>
          <div 
            className={styles.headerItem} 
            onClick={() => setShowAudioMenu(!showAudioMenu)}
          >
            Audio
          </div>
          
          {showAudioMenu && (
            <div ref={audioMenuRef} className={styles.audioMenu}>
              <div>
                <h4>Input Device</h4>
                <select
                  value={selectedDevice}
                  onChange={(e) => setSelectedDevice(e.target.value)}
                  className={styles.deviceSelect}
                >
                  {audioDevices?.map(device => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `Device ${device.deviceId}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

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

        {/* //BROADCASTB BUTTON */}
        <div className={styles.buttonContainer}>
          <div>
            <button
              onClick={isRecording ? stopBroadcast : startBroadcast}
              className={`${styles.broadcastButton} ${isRecording ? styles.recording : ''}`}
            />
          </div>
          
          <div className={styles.broadcastStatus}>
          {isRecording ? 'Stop' : 'Start'} Broadcast
          </div>
        </div>
       

        <div className={styles.mainControls}>
          <div className={styles.volumeContainer}>
            {console.log('Passing audio nodes:', {
              context: audioContext.current,
              source: mediaStream.current,
              analyser: analyserRef.current,
              gainNode: gainNode.current
            })}
            <AudioMeters 
              audioNodes={{
                context: audioContext.current,
                source: mediaStream.current,
                analyser: analyserRef.current,
                gainNode: gainNode.current
              }}
              isRecording={isRecording}
            />
            <div className={styles.volumeContainer}>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={(e) => {
                  const value = parseFloat(e.target.value);
                  setVolume(value);
                  if (gainNode.current) {
                    gainNode.current.gain.value = gain * value;
                  }
                }}
                className={styles.volumeSlider}
              />
            </div>
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
      </div>
    </div>
  );
};

export default IcecastBroadcaster; 