import { useEffect, useState } from 'react';
import './App.css';

function App() {
  const [bgColor, setBgColor] = useState(0);

  const colors = ['#2cee09ff', '#f53307ff']; // toggle colors

  useEffect(() => {
    const ws = new WebSocket('ws://10.91.190.102:81/'); // ESP32 WebSocket

    ws.onopen = () => {
      console.log('WebSocket Client Connected');
      ws.send('Hello from React App'); // optional handshake
    };

    ws.onmessage = (event) => {
      console.log('Received:', event.data);

      // Toggle background color if button pressed
      if (event.data === 'button_pressed') {
        setBgColor(prev => (prev === 0 ? 1 : 0));
      }
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
    };

    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
    };

    // Cleanup on unmount
    return () => ws.close();
  }, []);

  return (
    <div
      className="App"
      style={{
        backgroundColor: colors[bgColor],
        minHeight: '100vh',
        width: '100vw',
        margin: 0,
        padding: '20px',
        boxSizing: 'border-box',
        transition: 'background-color 0.3s ease'
      }}
    />
  );
}

export default App;
