import React from 'react';
import styles from './BroadcastSettings.module.css';
import BroadcastServerConfig from './BroadcastServerConfig';

const BroadcastSettings = ({ config, onConfigChange }) => {
  // For now, mountPoint is fixed but will be made configurable later
  const TEMP_MOUNT_POINT = '/ether';

  const handleServerConfigChange = (newServerConfig) => {
    onConfigChange({
      ...config,
      ...newServerConfig,
      mountPoint: TEMP_MOUNT_POINT // Temporarily fixed
    });
  };

  return (
    <div>
      <BroadcastServerConfig 
        config={config}
        onConfigChange={handleServerConfigChange}
      />
    </div>
  );
};

export default BroadcastSettings; 