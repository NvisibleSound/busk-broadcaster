import React from 'react';
import styles from './VolumeControl.module.css';

const VolumeControl = ({ value, onChange }) => {
  const handleTrackClick = (e) => {
    const track = e.currentTarget;
    const rect = track.getBoundingClientRect();
    const position = 1 - ((e.clientY - rect.top) / rect.height);
    const newValue = Math.max(0, Math.min(1, position));
    onChange(newValue);
  };

  return (
    <div className={styles.volumeControl}>
      <div 
        className={styles.track} 
        onClick={handleTrackClick}
      >
        <div 
          className={styles.fill} 
          style={{ height: `${value * 100}%` }} 
        />
        <div 
          className={styles.thumb} 
          style={{ bottom: `${value * 100}%` }}
        />
      </div>
    </div>
  );
};

export default VolumeControl; 