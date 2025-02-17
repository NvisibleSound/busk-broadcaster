import React from 'react';
import styles from './BroadcastSettings.module.css';

const BroadcastServerConfig = ({ config, onConfigChange }) => {
  const handleChange = (field, value) => {
    onConfigChange({
      ...config,
      [field]: value
    });
  };

  return (
    <div className={styles.settingsPanel}>
      <h3>Server Configuration</h3>
      <div className={styles.settingGroup}>
        <label>
          Server URL:
          <input
            type="text"
            value={config.url}
            onChange={(e) => handleChange('url', e.target.value)}
          />
        </label>
      </div>
      <div className={styles.settingGroup}>
        <label>
          Username:
          <input
            type="text"
            value={config.username}
            onChange={(e) => handleChange('username', e.target.value)}
          />
        </label>
      </div>
      <div className={styles.settingGroup}>
        <label>
          Password:
          <input
            type="password"
            value={config.password}
            onChange={(e) => handleChange('password', e.target.value)}
          />
        </label>
      </div>
    </div>
  );
};

export default BroadcastServerConfig; 