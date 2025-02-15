import React from 'react';
import styles from './AudioControls.module.css';
import AudioInput from './AudioInput';

const AudioControls = ({ 
  selectedDevice, 
  onDeviceSelect,
  showMenu,
  onToggleMenu,
  audioMenuRef
}) => {
  return (
    <>
      <div 
        className={styles.headerItem} 
        onClick={onToggleMenu}
      >
        Audio
      </div>
      
      {showMenu && (
        <div ref={audioMenuRef} className={styles.audioMenu}>
          <div>
            <h4>Input Device</h4>
            <AudioInput 
              selectedDevice={selectedDevice}
              onDeviceSelect={onDeviceSelect}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default AudioControls; 