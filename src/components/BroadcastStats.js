import React, { useEffect } from 'react';
import styles from './BroadcastStats.module.css';

const BroadcastStats = ({ isRecording, serverConfig, broadcastStats, setBroadcastStats }) => {
  const fetchStats = async () => {
    try {
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

  return (
    <div className={styles.broadcastStats}>
      <div className={styles.statItem}>
        <span className={styles.statLabel}>Mount:</span>
        <span className={styles.statValue}>{isRecording ? broadcastStats.mountPoint : '-'}</span>
      </div>
      <div className={styles.statItem}>
        <span className={styles.statLabel}>Time:</span>
        <span className={styles.statValue}>{isRecording ? broadcastStats.streamTime : '-'}</span>
      </div>
      <div className={styles.statItem}>
        <span className={styles.statLabel}>Listeners:</span>
        <span className={styles.statValue}>{isRecording ? broadcastStats.listeners : ''}</span>
      </div>
      <div className={styles.statItem}>
        <span className={styles.statLabel}>Format:</span>
        <span className={styles.statValue}>{isRecording ? broadcastStats.audioFormat : ''}</span>
      </div>
      <div className={styles.statItem}>
        <span className={styles.statLabel}>Bitrate:</span>
        <span className={styles.statValue}>{isRecording ? broadcastStats.bitrate : '-'}</span>
      </div>
      <div className={styles.statItem}>
        <span className={styles.statLabel}>Sample Rate:</span>
        <span className={styles.statValue}>{isRecording ? broadcastStats.sampleRate : '-'}</span>
      </div>
    </div>
  );
};

export default BroadcastStats; 