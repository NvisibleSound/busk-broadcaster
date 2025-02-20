import React, { useState, useRef, useEffect, useMemo } from 'react';
import { PiBroadcastThin } from "react-icons/pi";
import { BsBroadcast } from "react-icons/bs";
import styles from './IcecastBroadcaster.module.css';
import { defaultServerConfig } from '../config/BroadcastConfig';
import AudioMeters from './AudioMeters';
import VolumeControl from './VolumeControl';
import BroadcastStats from './BroadcastStats';

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


  // Add a state to track when audio is ready
  const [audioReady, setAudioReady] = useState(false);

  // First, create a stable ref for the audio nodes
  const audioNodesRef = useRef({
    context: null,
    gainNode: null
  });

  // We now use two gain nodes:
  // - volumeGainNode: controls the signal level for broadcasting (updated by the slider)
  // - meterGainNode: always keeps unity gain for AudioMeters so meters are unaffected by slider changes
  const volumeGainNode = useRef(null);
  const meterGainNode = useRef(null);

  // Add this to track our audio connections
  const audioConnections = useRef({
    meterChainConnected: false
  });

  const [audioNodes, setAudioNodes] = useState(null);

  const handleGainChange = (e) => {
    const value = parseFloat(e.target.value);
    setInputGain(value);
    if (gainNode.current) {
      gainNode.current.gain.value = value;
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
    console.log('🛑 Stopping broadcast...');
    setStatusMessage('Stopping broadcast...');
    setIsConnected(false);
    
    if (mediaRecorder.current?.state === 'recording') {
      mediaRecorder.current.stop();
    }
    
    clearInterval(durationInterval.current);
    setIsRecording(false);
    setDuration(0);
    connectionAttempts.current = 0;
    setStatusMessage('Broadcast stopped');
  };

  // Set up the initial audio chain once a device is selected
  useEffect(() => {
    const setupInitialAudio = async () => {
      console.log('🎤 Starting audio setup...');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: selectedDevice ? { exact: selectedDevice } : undefined,
            channelCount: 2,
            sampleRate: 48000,
            autoGainControl: false,
            echoCancellation: false,
            noiseSuppression: false
          }
        });
        
        console.log('🎤 Got media stream');
        mediaStream.current = stream;
        audioContext.current = new AudioContext();
        const source = audioContext.current.createMediaStreamSource(stream);

        console.log('🎤 Creating gain nodes...');
        volumeGainNode.current = audioContext.current.createGain();
        meterGainNode.current = audioContext.current.createGain();
        meterGainNode.current.gain.value = 1;
        
        console.log('🎤 Connecting audio graph...');
        source.connect(volumeGainNode.current);
        source.connect(meterGainNode.current);
        
        // Store nodes in state instead of ref
        const nodes = {
          context: audioContext.current,
          gainNode: meterGainNode.current
        };
        console.log('🎤 Setting audio nodes:', nodes);
        setAudioNodes(nodes);
        setAudioReady(true);
      } catch (error) {
        console.error('❌ Audio setup failed:', error);
      }
    };

    if (selectedDevice) {
      setupInitialAudio();
    }

    return () => {
      // Don't clean up audio nodes on effect cleanup
    };
  }, [selectedDevice]);

  // Create memoized audio nodes object that won't change unless the nodes actually change
  const memoizedAudioNodes = useMemo(() => ({
    context: audioContext.current,
    gainNode: meterGainNode.current
  }), [audioContext.current, meterGainNode.current]);

  // Modify the volume control handler to only affect the broadcast chain
  const handleVolumeChange = (value) => {
    console.log('🔊 Volume change:', value);
    setVolume(value);
    if (volumeGainNode.current) {
      volumeGainNode.current.gain.value = value;
    }
  };

  // Add cleanup only when component unmounts
  useEffect(() => {
    return () => {
      if (mediaStream.current) {
        mediaStream.current.getTracks().forEach(track => track.stop());
      }
      if (audioContext.current) {
        audioContext.current.close();
      }
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
          
          {/* //SETTINGS BUTTON */}   
          <div 
            className={styles.headerItem}
            onClick={() => setShowSettings(!showSettings)}
          >
            Settings
          </div>
        </header>

      
       
        {/* //MAIN CONTROLS */}
        <div className={styles.mainControls}>
          <div className={styles.meterAndVolumeContainer}>
            <AudioMeters audioNodes={audioNodes} />
            <VolumeControl
              value={volume}
              onChange={(value) => {
                console.log('🔊 Volume change:', value);
                setVolume(value);
                if (volumeGainNode.current) {
                  volumeGainNode.current.gain.value = value;
                }
              }}
            />
          </div>
          <div>
            {/* //BROADCAST STATS */} 
            <BroadcastStats 
              isRecording={isRecording}
              serverConfig={serverConfig}
              broadcastStats={broadcastStats}
              setBroadcastStats={setBroadcastStats}
            />
          </div>  
        </div>   
          {/* //BROADCAST BUTTON */}
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
      </div>
    </div>
  );
};

export default IcecastBroadcaster; 