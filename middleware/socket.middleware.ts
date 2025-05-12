import { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config/config';

export interface AuthenticatedSocket extends Socket {
  user?: {
    id: string;
    role: string;
  };
}

export const socketAuthMiddleware = async (socket: AuthenticatedSocket, next: (err?: Error) => void) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

    if (!token) {
      return next(new Error('Authentication token missing'));
    }

    const decoded = jwt.verify(token, config.jwt.secret) as { id: string; role: string };
    socket.user = decoded;
    next();
  } catch (error) {
    next(new Error('Invalid authentication token'));
  }
};

export const socketRateLimit = (socket: Socket, next: (err?: Error) => void) => {
  const now = Date.now();
  const lastConnection = socket.data.lastConnection || 0;
  const minInterval = 1000; // 1 second between connections

  if (now - lastConnection < minInterval) {
    return next(new Error('Connection rate limit exceeded'));
  }

  socket.data.lastConnection = now;
  next();
}; 