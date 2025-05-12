import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import http from 'http';
import https from 'https';
import fs from 'fs';
import { config } from './config/config';
import { errorHandler } from './middleware/error.middleware';
import { notFoundHandler } from './middleware/not-found.middleware';
import authRoutes from './routes/auth.routes';
import chatRoutes from './routes/chat.routes';
import agentRoutes from './routes/agent.routes';
import { authMiddleware } from './middleware/auth.middleware';
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
            key: fs.readFileSync('/path/to/private.key'),
            cert: fs.readFileSync('/path/to/certificate.crt')
        };
        server = https.createServer(httpsOptions, app);
    } else {
        server = http.createServer(app);
    }

    return server;
};

const server = initializeServer();
const PORT = config.port;

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT} in ${config.nodeEnv} mode`);
});

export default app;