import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/config';
import loggerService from '../services/logger.service';
export const authMiddleware = async (
  req: any,
  res: any,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    try {
      const decoded = jwt.verify(token, config.jwtSecret) as { id: string | number; agentName: string };
      req.user = { id: decoded.id };
      next();
    } catch (error) {
      return res.status(401).json({ message: 'Invalid token' });
    }
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error' });
  }
}; 

export const authenticateToken = (token: string) => {
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as { id: string | number; agentName: string };
    return decoded;
  } catch (error) {
    loggerService.error('Authentication failed', token);
    return null;
  }
}