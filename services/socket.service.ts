import { Server } from "socket.io";
import logger from './logger.service';

class SocketService {
    private server: Server;

    constructor() {
        this.server = new Server(3000, {
            cors: {
                origin: "http://localhost:3000",
                methods: ["GET", "POST"]
            }
        });

        this.server.on('connection', (socket) => {
            logger.info('New user connected', { socketId: socket.id });
            
            socket.on('disconnect', () => {
                logger.info('User disconnected', { socketId: socket.id });
            });
        });
    }

    public getServer(): Server {
        return this.server;
    }
}

export default new SocketService();