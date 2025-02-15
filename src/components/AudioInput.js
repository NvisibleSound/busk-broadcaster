import React, { useState, useEffect } from 'react';
import styles from './AudioInput.module.css';

const AudioInput = ({ onDeviceSelect, selectedDevice }) => {
  const [audioDevices, setAudioDevices] = useState([]);

  useEffect(() => {
    const getAudioDevices = async () => {
      try {
        // First request permission to access audio devices
        await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // Then enumerate devices
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(device => device.kind === 'audioinput');
        setAudioDevices(audioInputs);
        
        // If no device is selected and we have devices, select the first one
        if (!selectedDevice && audioInputs.length > 0) {
          onDeviceSelect(audioInputs[0].deviceId);
        }
      } catch (error) {
        console.error('Error accessing audio devices:', error);
      }
    };

    getAudioDevices();

    // Listen for device changes
    navigator.mediaDevices.addEventListener('devicechange', getAudioDevices);
    
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', getAudioDevices);
    };
  }, []);

  return (
    <div className={styles.audioInput}>
      <select
        value={selectedDevice}
        onChange={(e) => onDeviceSelect(e.target.value)}
        className={styles.deviceSelect}
      >
        {audioDevices.map(device => (
          <option key={device.deviceId} value={device.deviceId}>
            {device.label || `Device ${device.deviceId}`}
          </option>
        ))}
      </select>
    </div>
  );
};

export default AudioInput; 