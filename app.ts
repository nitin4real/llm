import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import http from 'http';
import https from 'https';
import fs from 'fs';
import { Server } from 'socket.io';
import { config } from './config/config';
import { errorHandler } from './middleware/error.middleware';
import { notFoundHandler } from './middleware/not-found.middleware';
import authRoutes from './routes/auth.routes';
import chatRoutes from './routes/chat.routes';
import agentRoutes from './routes/agent.routes';
import { authMiddleware } from './middleware/auth.middleware';
import UserSessionService from './services/UserSessionService';
import loggerService from './services/logger.service';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors(config.cors));
app.use(morgan('dev'));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/chat', chatRoutes);

// Health check endpoint
app.get('/health', (req: any, res: any) => {
    res.json({ status: 'ok' });
});

// token health check
app.get('/token-health', authMiddleware, (req: any, res: any) => {
    res.json({ status: 'ok' });
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Initialize server
const initializeServer = () => {
    let server;

    if (config.nodeEnv === 'production') {
        const httpsOptions = {
            key: fs.readFileSync(config.ssl.key || ''),
            cert: fs.readFileSync(config.ssl.cert || '')
        };
        server = https.createServer(httpsOptions, app);
    } else {
        server = http.createServer(app);
    }

    // Initialize Socket.IO
    const io = new Server(server, {
        cors: config.cors
    });

    // Socket.IO connection handling
    io.on('connection', (socket) => {
        console.log('New client connected', socket.id, JSON.stringify(socket.handshake.query), socket.handshake.auth);
        const token = socket.handshake.auth.token;
        if (!token) {
            loggerService.error('No token provided', socket.id);
            socket.emit('error', { message: 'Authentication failed' });
            socket.disconnect();
            return;
        }
        
        const userSessionService = UserSessionService.getInstance();
        const userId = userSessionService.authenticateUser(token);
        try {
            userSessionService.setSocketConnection(userId, socket);
            socket.emit('session_created', {
                userId,
            });
            socket.on('heartbeat', async () => {
                try {
                    const userSession = userSessionService.getUserSession(userId);
                    if (userSession) {
                        const heartbeatStatus = await userSessionService.updateHeartbeat(
                            userSession.convoAgentId,
                            userId
                        );
                        socket.emit('heartbeat_response', heartbeatStatus);
                    }
                } catch (error) {
                    console.error('Heartbeat error:', error);
                }
            });
        } catch (error) {
            console.error('Authentication error:', error);
        }

        socket.on('disconnect', async () => {
            console.log('Client disconnected');
            const userSessionService = UserSessionService.getInstance();
            const activeUsers = userSessionService.getAllActiveUsers();
            const userSession = activeUsers.find(session => session.socketConnection === socket);

            if (userSession) {
                try {
                    await userSessionService.stopUserSession(userSession.userId);
                } catch (error) {
                    console.error('Error stopping user session:', error);
                }
            }
        });
    });

    return server;
};

const server = initializeServer();
const PORT = config.port;

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT} in ${config.nodeEnv} mode`);
});

export default app;