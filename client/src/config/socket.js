import { io } from 'socket.io-client';

let socket = null;

export const initSocket = (userId) => {
  if (!socket) {
    socket = io(process.env.REACT_APP_API_URL?.replace('/api', '') || 'http://localhost:3006', {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    socket.on('connect', () => {
      console.log('Socket connected');
      if (userId) {
        socket.emit('authenticate', userId);
        console.log('Socket authentication sent for user:', userId);
      }
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });

    socket.on('reconnect', () => {
      console.log('Socket reconnected');
      if (userId) {
        socket.emit('authenticate', userId);
      }
    });
  } else if (userId) {
    // If socket exists but user changed, authenticate
    if (socket.connected) {
      socket.emit('authenticate', userId);
      console.log('Socket re-authenticated for user:', userId);
    } else {
      // Wait for connection then authenticate
      socket.once('connect', () => {
        socket.emit('authenticate', userId);
      });
    }
  }

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const getSocket = () => socket;

