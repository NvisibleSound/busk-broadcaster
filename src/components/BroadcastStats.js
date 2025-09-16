import React, { useEffect, useRef } from 'react';
import styles from './BroadcastStats.module.css';

const BroadcastStats = ({ isRecording, isConnected, serverConfig, broadcastStats, setBroadcastStats }) => {
  const lastConnectionState = useRef(false);

  // Update stats based on connection state
  useEffect(() => {
    if (isRecording && isConnected) {
      // Only update if connection state changed
      if (lastConnectionState.current !== isConnected) {
        setBroadcastStats(prev => ({
          ...prev,
          streamTime: '00:00:00',
          listeners: 0,
          audioFormat: 'OPUS',
          bitrate: '128 kbps',
          sampleRate: '48000 Hz',
          channels: 2
        }));
      }
    }
    lastConnectionState.current = isConnected;
  }, [isRecording, isConnected]);

  const getDisplayValue = (value, defaultValue) => {
    if (!isRecording) return defaultValue;
    if (!isConnected) return 'Connecting...';
    return value;
  };

  return (
    <div className={styles.broadcastStats}>
      <div className={styles.statItem}>
        <span className={styles.statLabel}>Mount:</span>
        <span className={styles.statValue}>{getDisplayValue(broadcastStats.mountPoint, '-')}</span>
      </div>
      <div className={styles.statItem}>
        <span className={styles.statLabel}>Time:</span>
        <span className={styles.statValue}>{getDisplayValue(broadcastStats.streamTime, '00:00:00')}</span>
      </div>
      <div className={styles.statItem}>
        <span className={styles.statLabel}>Listeners:</span>
        <span className={styles.statValue}>{getDisplayValue(broadcastStats.listeners, '0')}</span>
      </div>
      <div className={styles.statItem}>
        <span className={styles.statLabel}>Format:</span>
        <span className={styles.statValue}>{getDisplayValue(broadcastStats.audioFormat, '-')}</span>
      </div>
      <div className={styles.statItem}>
        <span className={styles.statLabel}>Bitrate:</span>
        <span className={styles.statValue}>{getDisplayValue(broadcastStats.bitrate, '128 kbps')}</span>
      </div>
      <div className={styles.statItem}>
        <span className={styles.statLabel}>Sample Rate:</span>
        <span className={styles.statValue}>{getDisplayValue(broadcastStats.sampleRate, '44.1 kHz')}</span>
      </div>
    </div>
  );
};

export default BroadcastStats; 