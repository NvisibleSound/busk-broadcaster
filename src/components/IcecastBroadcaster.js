import React, { useState, useRef, useEffect, useMemo } from 'react';
import { PiBroadcastThin } from "react-icons/pi";
import { BsBroadcast } from "react-icons/bs";
import styles from './IcecastBroadcaster.module.css';
import { defaultServerConfig } from '../config/BroadcastConfig';
import AudioMeters from './AudioMeters';
import VolumeControl from './VolumeControl';
import BroadcastStats from './BroadcastStats';
import EQ from './EQ';
import Compressor from './Compressor';
import Reverb from './Reverb';
// Audio plugins - can be disabled if causing issues
// Set PLUGINS_ENABLED to false to completely disable plugin system
const PLUGINS_ENABLED = true; // Toggle this to enable/disable plugins

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
  const settingsMenuRef = useRef(null);
  const audioHeaderItemRef = useRef(null);
  const settingsHeaderItemRef = useRef(null);
  const gainNode = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const knobRef = useRef(null);
  
  // Audio plugin system (optional, can be disabled)
  const pluginManagerRef = useRef(null);
  const [pluginsEnabled, setPluginsEnabled] = useState(false); // Toggle to enable/disable
  
  // Plugin instances
  const [eqPlugin, setEqPlugin] = useState(null);
  const [compressorPlugin, setCompressorPlugin] = useState(null);
  const [reverbPlugin, setReverbPlugin] = useState(null);
  
  // Plugin settings
  const [eqSettings, setEqSettings] = useState({ 
    enabled: false,
    bands: [
      { frequency: 200, gain: 0, Q: 1, enabled: true },
      { frequency: 1000, gain: 0, Q: 1, enabled: true },
      { frequency: 5000, gain: 0, Q: 1, enabled: true }
    ],
    hpf: { frequency: 80, enabled: true },
    lpf: { frequency: 12000, enabled: true }
  });
  const [compressorSettings, setCompressorSettings] = useState({ 
    threshold: -24, 
    ratio: 12, 
    knee: 30,
    attack: 0.003,
    release: 0.25,
    makeUpGain: 0,
    inputGain: 0,
    outputGain: 0,
    autoGain: false,
    autoRelease: false,
    limiterEnabled: false,
    limiterThreshold: -0.1,
    enabled: false 
  });
  const [reverbSettings, setReverbSettings] = useState({ 
    mix: 0.444,
    predelay: 0,
    decay: 0.8,
    size: 0.224,
    width: 1.072,
    lowFreq: 400,
    highFreq: 9000,
    lowGain: 0,
    highGain: -1.5,
    rate: 0.4,
    depth: 0.32,
    enabled: false 
  });
  
  // Tab system
  const [activeTab, setActiveTab] = useState('home');

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

  // Add state for dynamic source name (must be before broadcastStats)
  const [sourceName, setSourceName] = useState(() => {
    const savedArtist = localStorage.getItem('busk-broadcaster-selected-artist');
    if (savedArtist) {
      const artist = JSON.parse(savedArtist);
      return artist.name || 'ether';
    }
    return 'ether';
  });
  
  // Add state for artist selection and description with localStorage persistence
  const [selectedArtist, setSelectedArtist] = useState(() => {
    const saved = localStorage.getItem('busk-broadcaster-selected-artist');
    return saved ? JSON.parse(saved) : null;
  });
  const [artists, setArtists] = useState([]);
  const [description, setDescription] = useState(() => {
    return localStorage.getItem('busk-broadcaster-description') || 'Play music. Get Paid.';
  });

  // Add state for genre/tag management
  const [availableTags, setAvailableTags] = useState([
    'Electronic', 'Hip-Hop', 'Rock', 'Jazz', 'Classical', 'Pop', 'Country', 'Blues',
    'Folk', 'Reggae', 'R&B', 'Funk', 'Soul', 'Alternative', 'Indie', 'Ambient',
    'Techno', 'House', 'Trance', 'Dubstep', 'Drum & Bass', 'Live', 'Acoustic',
    'Instrumental', 'Vocal', 'Podcast', 'Talk Show', 'News', 'Sports', 'Comedy'
  ]);
  const [selectedTags, setSelectedTags] = useState(() => {
    const saved = localStorage.getItem('busk-broadcaster-selected-tags');
    return saved ? JSON.parse(saved) : [];
  });
  const [tagSearchQuery, setTagSearchQuery] = useState('');

  // Add state for artist source toggle
  const [useRealArtists, setUseRealArtists] = useState(() => {
    const saved = localStorage.getItem('busk-broadcaster-use-real-artists');
    return saved ? JSON.parse(saved) : false; // Default to mock artists
  });

  // Add new state for broadcast stats
  const [broadcastStats, setBroadcastStats] = useState({
    mountPoint: defaultServerConfig.mountPoint,
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

  // Update mountpoint from server config
  useEffect(() => {
    setBroadcastStats(prev => ({ ...prev, mountPoint: serverConfig.mountPoint }));
  }, [serverConfig.mountPoint]);

  // Save selected artist to localStorage
  useEffect(() => {
    if (selectedArtist) {
      localStorage.setItem('busk-broadcaster-selected-artist', JSON.stringify(selectedArtist));
    }
  }, [selectedArtist]);

  // Save description to localStorage
  useEffect(() => {
    localStorage.setItem('busk-broadcaster-description', description);
  }, [description]);

  // Save selected tags to localStorage
  useEffect(() => {
    localStorage.setItem('busk-broadcaster-selected-tags', JSON.stringify(selectedTags));
  }, [selectedTags]);

  // Save useRealArtists toggle to localStorage
  useEffect(() => {
    localStorage.setItem('busk-broadcaster-use-real-artists', JSON.stringify(useRealArtists));
  }, [useRealArtists]);

  // Refetch artists when toggle changes
  useEffect(() => {
    fetchArtists();
  }, [useRealArtists]);

  // Auto-select Ether when artists are loaded in mock mode
  useEffect(() => {
    if (!useRealArtists && artists.length > 0 && !selectedArtist) {
      const etherArtist = artists.find(artist => artist.name === 'Ether');
      if (etherArtist) {
        setSelectedArtist(etherArtist);
        setSourceName(etherArtist.name);
      }
    }
  }, [artists, useRealArtists, selectedArtist]);

  // Tag management functions
  const toggleTag = (tag) => {
    setSelectedTags(prev => {
      if (prev.includes(tag)) {
        return prev.filter(t => t !== tag);
      } else {
        return [...prev, tag];
      }
    });
  };

  const removeTag = (tag) => {
    setSelectedTags(prev => prev.filter(t => t !== tag));
  };

  // Filter available tags based on search query
  const filteredTags = availableTags.filter(tag => 
    tag.toLowerCase().includes(tagSearchQuery.toLowerCase())
  );

  // Fetch artists from react-music-player API
  const fetchArtists = async () => {
    // API call disabled - always use hardcoded mock data
    console.log('Using hardcoded mock artists');
    const mockArtists = [
      { id: 1, name: 'Ether', artistId: 'ether' },
      { id: 2, name: 'DJ Example', artistId: 'dj-example' },
      { id: 3, name: 'Live Band', artistId: 'live-band' },
      { id: 4, name: 'Solo Artist', artistId: 'solo-artist' },
      { id: 5, name: 'Podcast Host', artistId: 'podcast-host' }
    ];
    setArtists(mockArtists);
    return;

    // API call disabled - commented out
    /*
    if (!useRealArtists) {
      // Use hardcoded mock data
      console.log('Using hardcoded mock artists');
      const mockArtists = [
        { id: 1, name: 'Ether', artistId: 'ether' },
        { id: 2, name: 'DJ Example', artistId: 'dj-example' },
        { id: 3, name: 'Live Band', artistId: 'live-band' },
        { id: 4, name: 'Solo Artist', artistId: 'solo-artist' },
        { id: 5, name: 'Podcast Host', artistId: 'podcast-host' }
      ];
      setArtists(mockArtists);
      return;
    }

    try { 
      // Using the same API endpoint structure as your react-music-player
      const API_ENDPOINT = 'http://localhost:5000'; // Update this to match your react-music-player API_ENDPOINT
      const response = await fetch(`${API_ENDPOINT}/artist/`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const artists = await response.json();
      
      // Transform the data to match our expected format
      // Your API returns: [{ id, artistname, location, fileurl }]
      // We need: [{ id, name, artistId }]
      const transformedArtists = artists.map(artist => ({
        id: artist.id,
        name: artist.artistname,
        artistId: artist.id.toString(), // Using id as artistId
        location: artist.location,
        fileurl: artist.fileurl
      }));
      
      setArtists(transformedArtists);
      console.log('Fetched artists from react-music-player API:', transformedArtists);
    } catch (error) {
      console.error('Error fetching artists from API:', error);
      
      // No fallback for PostgreSQL mode - that's the point of the switch
      console.log('PostgreSQL API failed - no fallback available');
      setArtists([]);
    }
    */
  };

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
      // Don't close if clicking on the header items themselves
      const isClickOnAudioHeader = audioHeaderItemRef.current && audioHeaderItemRef.current.contains(event.target);
      const isClickOnSettingsHeader = settingsHeaderItemRef.current && settingsHeaderItemRef.current.contains(event.target);
      
      if (audioMenuRef.current && !audioMenuRef.current.contains(event.target) && !isClickOnAudioHeader) {
        setShowAudioMenu(false);
      }
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(event.target) && !isClickOnSettingsHeader) {
        setShowSettings(false);
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
    fetchArtists(); // Fetch artists on component mount

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
      console.log('🎤 Requesting user media stream...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });
      
      console.log('✅ Got media stream:', stream);
      console.log('🎵 Audio tracks:', stream.getAudioTracks().length);
      mediaStream.current = stream;
      
      // Set up WebSocket connection
      // Use localhost for development, deployed server for production
      const wsUrl = window.location.hostname === 'localhost'
        ? 'ws://localhost:8081'
        : `wss://${window.location.hostname}/ws`;
      console.log('Connecting to WebSocket:', wsUrl);
      
      wsRef.current = new WebSocket(wsUrl);
      wsRef.current.binaryType = 'arraybuffer';

      wsRef.current.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        
        // Small delay to ensure connection is fully established
        setTimeout(() => {
          // Send broadcast configuration to server
          const mountpoint = serverConfig.mountPoint;
          const configMessage = {
            type: 'config',
            sourceName: sourceName,
            description: description,
            mountpoint: mountpoint,
            artistId: selectedArtist?.artistId || null,
            tags: selectedTags,
            contentType: mimeType
          };
          console.log('📤 Sending broadcast config:', configMessage);
          console.log('📤 WebSocket ready state:', wsRef.current.readyState);
          console.log('📤 WebSocket URL:', wsRef.current.url);
          wsRef.current.send(JSON.stringify(configMessage));
          console.log('📤 Message sent successfully');
        }, 100);
        
        // Test all available formats and choose the most compatible
        // WebM/
        // need is the most compatible format for browsers
        const formats = [
          'audio/webm;codecs=opus', // WebM/Opus - most compatible with browsers
          'audio/mp4;codecs=mp4a.40.2', // MP4/AAC - good browser support
          'audio/ogg;codecs=opus', // OGG/Opus - good browser support
          'audio/webm',
          'audio/mp4',
          'audio/ogg'
        ];
        
        // Test format support more robustly
        const supportedFormats = [];
        for (const format of formats) {
          try {
            if (MediaRecorder.isTypeSupported(format)) {
              supportedFormats.push(format);
            }
          } catch (e) {
            console.log('Error testing format:', format, e);
          }
        }
        
        console.log('🎵 Available formats:', supportedFormats);
        
        // Try to create MediaRecorder with each format to test actual compatibility
        let mimeType = 'audio/webm;codecs=opus'; // Default fallback to WebM/Opus
        for (const format of supportedFormats) {
          try {
            const testRecorder = new MediaRecorder(stream, { mimeType: format });
            mimeType = format;
            console.log('✅ Successfully created MediaRecorder with:', format);
            break;
          } catch (e) {
            console.log('❌ Failed to create MediaRecorder with:', format, e);
          }
        }
        
        console.log('🎵 Using audio format:', mimeType);
        
        try {
          mediaRecorder.current = new MediaRecorder(stream, {
            mimeType: mimeType,
            audioBitsPerSecond: 128000
          });
          console.log('✅ MediaRecorder created successfully');
        } catch (error) {
          console.error('❌ Failed to create MediaRecorder:', error);
          // Fallback to default
          mediaRecorder.current = new MediaRecorder(stream, {
            audioBitsPerSecond: 128000
          });
          console.log('🔄 Using default MediaRecorder settings');
          mimeType = 'audio/webm;codecs=opus'; // Update mimeType for fallback to WebM/Opus
        }

        mediaRecorder.current.ondataavailable = (event) => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(event.data);
          } else {
            console.log('❌ WebSocket not ready, cannot send audio data');
          }
        };

        console.log('🎙️ Starting MediaRecorder with 100ms intervals');
        mediaRecorder.current.start(100);
        setIsRecording(true);
        console.log('✅ MediaRecorder started, recording state:', mediaRecorder.current.state);
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
    
    // First stop the MediaRecorder
    if (mediaRecorder.current?.state === 'recording') {
      mediaRecorder.current.stop();
    }

    // Clean up WebSocket properly
    if (wsRef.current) {
      // Only try to close if the connection is still open
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
      wsRef.current = null;
    }
    
    // Stop all media tracks
    if (mediaStream.current) {
      mediaStream.current.getTracks().forEach(track => track.stop());
      mediaStream.current = null;
    }
    
    clearInterval(durationInterval.current);
    setIsRecording(false);
    setIsConnected(false);
    setDuration(0);
    connectionAttempts.current = 0;
    setStatusMessage('Broadcast stopped');
  };

  // Add WebSocket error handling
  useEffect(() => {
    if (wsRef.current) {
      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        stopBroadcast();
      };
    }
  }, []);

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
        
        // Initialize plugin manager if available and enabled
        if (PLUGINS_ENABLED && pluginsEnabled) {
          // Dynamic import for plugins (only if enabled)
          import('../utils/audioPlugins').then(pluginsModule => {
            const manager = pluginsModule.createPluginManager(audioContext.current, true);
            pluginManagerRef.current = manager;
            
            // Add enabled plugins to manager
            if (eqPlugin) manager.addPlugin(eqPlugin);
            if (compressorPlugin) manager.addPlugin(compressorPlugin);
            if (reverbPlugin) manager.addPlugin(reverbPlugin);
            
            console.log('🎛️ Audio plugins enabled');
          }).catch(error => {
            console.warn('⚠️ Failed to load plugins, continuing without:', error);
            pluginManagerRef.current = null;
          });
        } else {
          pluginManagerRef.current = null;
        }
        
        console.log('🎤 Connecting audio graph...');
        
        // Use plugins if available, otherwise connect directly
        if (PLUGINS_ENABLED && pluginManagerRef.current && pluginsEnabled) {
          try {
            // Process through plugins for broadcast chain
            pluginManagerRef.current.process(source, volumeGainNode.current);
            // For meters, connect directly (no plugins on monitoring)
            source.connect(meterGainNode.current);
            console.log('🎛️ Audio routed through plugins');
          } catch (error) {
            console.error('❌ Plugin processing failed, using direct connection:', error);
            // Fallback to direct connection if plugins fail
        source.connect(volumeGainNode.current);
        source.connect(meterGainNode.current);
          }
        } else {
          // Direct connection (no plugins) - default behavior
          source.connect(volumeGainNode.current);
          source.connect(meterGainNode.current);
        }
        
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
  }, [selectedDevice, pluginsEnabled, eqPlugin, compressorPlugin, reverbPlugin]);

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
            ref={audioHeaderItemRef}
            className={`${styles.headerItem} ${showAudioMenu ? styles.headerItemActive : ''}`}
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
            ref={settingsHeaderItemRef}
            className={`${styles.headerItem} ${showSettings ? styles.headerItemActive : ''}`}
            onClick={() => setShowSettings(!showSettings)}
          >
            Settings
          </div>
          
          {showSettings && (
            <div ref={settingsMenuRef} className={styles.settingsMenu}>
              <div>
                <h4>Broadcast Settings</h4>
                
                <div className={styles.settingItem}>
                  <label htmlFor="artistSourceToggle">Artist Source:</label>
                  <div className={styles.toggleContainer}>
                    <span className={!useRealArtists ? styles.toggleLabelActive : styles.toggleLabel}>Hardcoded</span>
                    <label className={styles.toggleSwitch}>
                      <input
                        type="checkbox"
                        checked={useRealArtists}
                        onChange={(e) => setUseRealArtists(e.target.checked)}
                        disabled={isRecording}
                      />
                      <span className={styles.toggleSlider}></span>
                    </label>
                    <span className={useRealArtists ? styles.toggleLabelActive : styles.toggleLabel}>PostgreSQL</span>
                  </div>
                </div>
                
                <div className={styles.settingItem}>
                  <label htmlFor="artistSelect">Artist:</label>
                  <select
                    id="artistSelect"
                    value={selectedArtist?.id || ''}
                    onChange={(e) => {
                      const artist = artists.find(a => a.id === parseInt(e.target.value));
                      setSelectedArtist(artist);
                      if (artist) {
                        setSourceName(artist.name);
                      }
                    }}
                    className={styles.artistSelect}
                    disabled={isRecording}
                  >
                    <option value="">Select an artist...</option>
                    {artists.map(artist => (
                      <option key={artist.id} value={artist.id}>
                        {artist.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.settingItem}>
                  <label htmlFor="description">Description:</label>
                  <input
                    id="description"
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className={styles.sourceNameInput}
                    placeholder="Enter broadcast description"
                    disabled={isRecording}
                  />
                </div>

                <div className={styles.settingItem}>
                  <label htmlFor="tagSearch">Search Genres & Tags:</label>
                  <input
                    id="tagSearch"
                    type="text"
                    value={tagSearchQuery}
                    onChange={(e) => setTagSearchQuery(e.target.value)}
                    className={styles.sourceNameInput}
                    placeholder="Type to search tags..."
                    disabled={isRecording}
                  />
                  
                  {tagSearchQuery && (
                    <div className={styles.tagSearchResults}>
                      {filteredTags.length > 0 ? (
                        filteredTags.map(tag => (
                          <button
                            key={tag}
                            className={`${styles.tagButton} ${selectedTags.includes(tag) ? styles.tagButtonSelected : ''}`}
                            onClick={() => toggleTag(tag)}
                            disabled={isRecording}
                          >
                            {tag}
                          </button>
                        ))
                      ) : (
                        <div className={styles.noResults}>No tags found</div>
                      )}
                    </div>
                  )}
                </div>

                {selectedTags.length > 0 && (
                  <div className={styles.settingItem}>
                    <label>Selected Tags:</label>
                    <div className={styles.selectedTagsContainer}>
                      {selectedTags.map(tag => (
                        <span key={tag} className={styles.selectedTag}>
                          {tag}
                          <button 
                            onClick={() => removeTag(tag)}
                            className={styles.removeTagButton}
                            disabled={isRecording}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </header>

        {/* //BROADCAST TITLE SECTION */}
        <div className={styles.broadcastTitleSection}>
          <div className={styles.artistName}>
            {selectedArtist ? selectedArtist.name : 'Busk Broadcaster'}
          </div>
          </div>

        {/* //TAB NAVIGATION */}
        <div className={styles.tabContainer}>
          <button
            className={`${styles.tab} ${activeTab === 'home' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('home')}
          >
            Home
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'eq' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('eq')}
          >
            EQ
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'compressor' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('compressor')}
          >
            Compressor
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'reverb' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('reverb')}
          >
            Reverb
          </button>
        </div>

        {/* //TAB CONTENT */}
        <div className={styles.tabContent}>
          {activeTab === 'home' && (
            <>
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
            </>
          )}

          {activeTab === 'eq' && (
            <div className={styles.pluginsTabContent}>
              {!PLUGINS_ENABLED ? (
                <div className={styles.pluginDisabled}>
                  <p>Plugins are currently disabled. Enable PLUGINS_ENABLED to use audio plugins.</p>
                </div>
              ) : (
                <EQ
                  enabled={eqSettings.enabled}
                  settings={eqSettings}
                  onEnabledChange={(enabled) => {
                    setEqSettings(prev => ({ ...prev, enabled }));
                  }}
                  onBandChange={(newSettings) => {
                    setEqSettings(newSettings);
                  }}
                  disabled={isRecording}
                  pluginsEnabled={pluginsEnabled}
                  setPluginsEnabled={setPluginsEnabled}
                  eqPlugin={eqPlugin}
                  setEqPlugin={setEqPlugin}
                  pluginManagerRef={pluginManagerRef}
                />
              )}
            </div>
          )}

          {activeTab === 'compressor' && (
            <div className={styles.pluginsTabContent}>
              {!PLUGINS_ENABLED ? (
                <div className={styles.pluginDisabled}>
                  <p>Plugins are currently disabled. Enable PLUGINS_ENABLED to use audio plugins.</p>
                </div>
              ) : (
                <Compressor
                  enabled={compressorSettings.enabled}
                  settings={compressorSettings}
                  onEnabledChange={(enabled) => {
                    setCompressorSettings(prev => ({ ...prev, enabled }));
                  }}
                  onSettingsChange={(newSettings) => {
                    setCompressorSettings(newSettings);
                  }}
                  disabled={isRecording}
                  pluginsEnabled={pluginsEnabled}
                  setPluginsEnabled={setPluginsEnabled}
                  compressorPlugin={compressorPlugin}
                  setCompressorPlugin={setCompressorPlugin}
                  pluginManagerRef={pluginManagerRef}
                />
              )}
            </div>
          )}

          {activeTab === 'reverb' && (
            <div className={styles.pluginsTabContent}>
              {!PLUGINS_ENABLED ? (
                <div className={styles.pluginDisabled}>
                  <p>Plugins are currently disabled. Enable PLUGINS_ENABLED to use audio plugins.</p>
                </div>
              ) : (
                <Reverb
                  enabled={reverbSettings.enabled}
                  settings={reverbSettings}
                  onEnabledChange={(enabled) => {
                    setReverbSettings(prev => ({ ...prev, enabled }));
                  }}
                  onSettingsChange={(newSettings) => {
                    setReverbSettings(newSettings);
                  }}
                  disabled={isRecording}
                  pluginsEnabled={pluginsEnabled}
                  setPluginsEnabled={setPluginsEnabled}
                  reverbPlugin={reverbPlugin}
                  setReverbPlugin={setReverbPlugin}
                  pluginManagerRef={pluginManagerRef}
                />
              )}
            </div>
          )}
        </div>

        {/* //BROADCAST BUTTON - Global (shows on all tabs) */}
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

        {/* //STREAM URLs - Global (shows on all tabs) */}
        <div className={styles.streamUrlsSection}>
          <div className={styles.streamUrlItem}>
            <span className={styles.streamUrlLabel}>HTTPS Stream:</span>
            <a 
              href={`https://test.buskplayer.com${broadcastStats.mountPoint}`}
              target="_blank" 
              rel="noopener noreferrer"
              className={styles.streamLink}
            >
              https://test.buskplayer.com{broadcastStats.mountPoint}
            </a>
          </div>
        </div>  
      </div>
    </div>
  );
};

export default IcecastBroadcaster; 