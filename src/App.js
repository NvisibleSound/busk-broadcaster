import React from 'react'
import IcecastBroadcaster from './components/IcecastBroadcaster.js'
import './App.css'

function App() {
  return React.createElement('div', { className: 'App' },
    React.createElement(IcecastBroadcaster)
  );
}

export default App 