import { EventEmitter } from 'events';
import { tokenService } from '../services/token.service';
import { userDb } from '../db/user.db';
import { userMetadataDb } from '../db/user-metadata.db';
import { AgentService } from './agent.service';
import { Socket } from 'socket.io';
import { AgentResponse, AgentStopResponse } from '../types';
import Logger from './logger.service';
import SignalingService from './signaling.service';
import { config } from '../config/config';
import { ChatMessage } from './llm.service';
import { authenticateToken } from '../middleware/auth.middleware';



export interface StartAgentResponse {
    rtcToken: string;
    channelName: string;
    rtcAppId: string;
    rtcUid: number;
    rtmToken: string;
}


export interface UserSession {
    userId: number;
    settings: {
        [key: string]: any;
    };
    socketConnection: Socket | null;
    chatHistory: ChatMessage[];
    convoAgentId: string;
    lastHeartbeat: number;
    secondsRemaining: number;
}

const agentService = new AgentService();

class UserSessionService {
    private static instance: UserSessionService;
    private activeUsers: Map<number, UserSession>;
    private heartbeatInterval: NodeJS.Timeout;
    private eventEmitter: EventEmitter;
    private readonly HEARTBEAT_TIMEOUT = 15000; // 15 seconds
    private readonly HEARTBEAT_INTERVAL = 5000; // 5 seconds
    private readonly heartbeatMap: Map<string, { lastHeartbeat: number, secondsRemaining: number, userId: number }>;

    private constructor() {
        this.activeUsers = new Map();
        this.eventEmitter = new EventEmitter();
        this.heartbeatInterval = setInterval(() => { }, this.HEARTBEAT_INTERVAL);
        this.heartbeatMap = new Map();
    }

    public static getInstance(): UserSessionService {
        if (!UserSessionService.instance) {
            UserSessionService.instance = new UserSessionService();
        }
        return UserSessionService.instance;
    }

    authenticateUser(token: string): number {
        const user = authenticateToken(token);
        if (!user) {
            throw new Error('User not found');
        }
        return Number(user.id);
    }

    private async startHeartbeat(convoAgentId: string, secondsRemaining: number, userId: number): Promise<void> {
        Logger.info(`Starting heartbeat for ${convoAgentId}`);
        this.heartbeatMap.set(convoAgentId, {
            lastHeartbeat: Date.now(),
            secondsRemaining,
            userId
        });
    }

    async updateHeartbeat(convoAgentId: string, userId: number): Promise<{ status: string, secondsRemaining: number }> {
        Logger.info(`Updating heartbeat for ${convoAgentId}`);
        const heartbeat = this.heartbeatMap.get(convoAgentId);
        if (!heartbeat) {
            throw new Error(`Agent ${convoAgentId} not found`);
        }
        if (heartbeat.userId !== userId) {
            throw new Error(`Agent - User mismatch`);
        }
        const newTime = Date.now();
        const heartbeatDifference = newTime - heartbeat.lastHeartbeat;
        const newSecondsRemaining = heartbeat.secondsRemaining - (heartbeatDifference / 1000);

        this.heartbeatMap.set(convoAgentId, {
            lastHeartbeat: newTime,
            secondsRemaining: newSecondsRemaining,
            userId
        });

        if (newSecondsRemaining <= 0) {
            this.stopHeartbeat(convoAgentId);
            throw new Error(`Agent ${convoAgentId} timed out`);
        }
        return {
            status: "OK",
            secondsRemaining: newSecondsRemaining
        }
    }

    private async checkHeartbeats(): Promise<void> {
        Logger.info(`Checking heartbeats`);
        for (const [convoAgentId, heartbeat] of this.heartbeatMap.entries()) {
            const now = Date.now();
            const timeSinceLastHeartbeat = now - heartbeat.lastHeartbeat;

            if (timeSinceLastHeartbeat > this.HEARTBEAT_TIMEOUT) {
                console.log(`Agent ${convoAgentId} heartbeat timeout. Stopping agent...`);
                this.stopHeartbeat(convoAgentId);
            }
        }
    }

    async stopHeartbeat(convoAgentId: string): Promise<AgentStopResponse> {
        Logger.info(`Stopping heartbeat for ${convoAgentId}`);
        const heartbeat = this.heartbeatMap.get(convoAgentId);
        if (!heartbeat) {
            throw new Error(`Agent ${convoAgentId} not found`);
        }

        const { userId, secondsRemaining } = heartbeat;
        try {
            // userMetadataDb.updateUserMetadata(userId, { remainingSeconds: Math.floor(secondsRemaining) });
        } catch (error) {
            console.error(`Error updating user ${userId}:`, error);
        }

        this.heartbeatMap.delete(convoAgentId);

        try {
            const stopAgentResponse = await agentService.stopAgent(convoAgentId);
            const userSession = this.getUserSession(userId);
            if (userSession && userSession.socketConnection) {
                userSession.socketConnection.disconnect();
            }
            return stopAgentResponse;
        } catch (error) {
            console.error(`Error stopping agent ${convoAgentId}:`, error);
            throw error;
        }
    }

    public async stopUserSession(userId: number): Promise<AgentStopResponse> {
        Logger.info(`Stopping user session ${userId}`);
        const userSession = this.getUserSession(userId);
        try {
            if (userSession) {
                const stopAgentResponse = await this.stopHeartbeat(userSession.convoAgentId);
                this.removeUser(userId);
                return stopAgentResponse;
            }
            throw new Error('User session not found');
        } catch (error) {
            console.error(`Error stopping user session ${userId}:`, error);
            throw error;
        }
    }

    public async startUserSession(userId: number): Promise<StartAgentResponse> {
        Logger.info(`Starting user session ${userId}`);
        const user = userDb.getUser(Number(userId));
        const userMetadata = userMetadataDb.getUserMetadata(Number(userId));
        if (!userMetadata.metadata) {
            throw new Error('Metadata is required');
        }

        if (userMetadata.metadata.remainingSeconds <= 0) {
            throw new Error('User has no remaining seconds');
        }

        if (!user.user) {
            throw new Error('User not found');
        }

        if (this.getUserSession(userId)) {
            throw new Error('A user session already exists. Please try again later.');
        }

        const agentRTCUid = Number(`${userId}1`);
        const backendRtmId = Number(`${userId}2`);

        const channelName = tokenService.generateChannelName(agentRTCUid, Number(userId));
        const tokensForUser = tokenService.generateTokens(channelName, Number(userId));
        const rtcTokenForAgent = tokenService.generateRtcToken(channelName, agentRTCUid);
        const rtmTokenForBackend = tokenService.generateRtmToken(backendRtmId);

        const agentResponse = await agentService.startAgent({
            userId,
            languageCode: userMetadata.metadata.languageCode || 'en-US',
            agentRTCUid: agentRTCUid,
            agentRTCtoken: rtcTokenForAgent.token,
            channelName: channelName,
            prompt: userMetadata.metadata.prompt,
            intro: userMetadata.metadata.intro,
            voiceId: userMetadata.metadata.voiceId,
            elevenLabsApiKey: userMetadata.metadata.elevenLabsApiKey
        });

        const chatHistory: ChatMessage[] = [
            {
                role: "system",
                content: userMetadata.metadata.prompt
            },
            {
                role: "assistant",
                content: userMetadata.metadata.intro
            }
        ]

        const convoAgentId = agentResponse.agent_id

        const session: UserSession = {
            userId,
            settings: {},
            chatHistory,
            convoAgentId,
            lastHeartbeat: Date.now(),
            secondsRemaining: userMetadata.metadata.remainingSeconds,
            socketConnection: null
        }

        this.setUserSession(userId, session);
        this.eventEmitter.emit('userAdded', userId);
        this.startHeartbeat(convoAgentId, session.secondsRemaining, userId);
        return {
            rtcToken: tokensForUser.rtcToken,
            channelName,
            rtcAppId: config.agora.appId || '',
            rtcUid: userId,
            rtmToken: tokensForUser.rtmToken
        }
    }

    public removeUser(userId: number): void {
        this.activeUsers.delete(userId);
        this.eventEmitter.emit('userRemoved', userId);
    }

    public setSocketConnection(userId: number, socketConnection: Socket): void {
        const userSession = this.activeUsers.get(userId);
        if (userSession) {
            userSession.socketConnection = socketConnection;
            this.setUserSession(userId, userSession);

            socketConnection.on('disconnect', () => {
                Logger.info(`User ${userId} disconnected`);
            });
            socketConnection.on('heartbeat', () => {
                Logger.info(`User ${userId} heartbeat`);
            });
            socketConnection.on('message', (message: string) => {
                Logger.info(`User ${userId} message: ${message}`);
            });
            socketConnection.on('answer_submitted', ({
                answer,
                question
            }: {
                answer: string;
                question: string;
            }) => {
                const userSession = this.getUserSession(userId);
                if (userSession) {
                    userSession.chatHistory.push({
                        role: "system",
                        content: `User has submitted answer: ${answer} for question: ${question}`
                    })
                }
            });
        }
    }

    public updateUserActivity(userId: number, updates: Partial<UserSession>): void {
        const userSession = this.activeUsers.get(userId);
        if (userSession) {
            const currentTime = Date.now();
            const secondsSinceLastHeartbeat = Math.floor((currentTime - userSession.lastHeartbeat) / 1000);
            const newSecondsRemaining = userSession.secondsRemaining - secondsSinceLastHeartbeat;
            userMetadataDb.updateUserMetadata(userId, { remainingSeconds: newSecondsRemaining });
            if (newSecondsRemaining <= 0) {
                // send stop signal to socket
                userSession.socketConnection?.emit('timeout', {
                    message: 'You have run out of platform usage time. Please try again later.'
                });
            }
            this.setUserSession(userId, { ...userSession, ...updates });
        }
    }

    public updateUserSettings(userId: number, settings: { [key: string]: any }): void {
        const userSession = this.activeUsers.get(userId);
        if (userSession) {
            userSession.settings = { ...userSession.settings, ...settings };
            this.setUserSession(userId, userSession);
            this.eventEmitter.emit('settingsUpdated', userId, settings);
        }
    }

    public getUserSession(userId: number): UserSession | undefined {
        return this.activeUsers.get(userId);
    }

    public setUserSession(userId: number, session: UserSession): void {
        this.activeUsers.set(userId, session);
    }

    public getAllActiveUsers(): UserSession[] {
        return Array.from(this.activeUsers.values());
    }

    public getInactiveUsers(timeoutMinutes: number): number[] {
        const now = new Date();
        return Array.from(this.activeUsers.entries())
            .filter(([_, session]) => {
                const inactiveTime = (now.getTime() - session.lastHeartbeat) / (1000 * 60);
                return inactiveTime > timeoutMinutes;
            })
            .map(([userId]) => userId);
    }

    public onUserAdded(callback: (userId: number) => void): void {
        this.eventEmitter.on('userAdded', callback);
    }

    public onUserRemoved(callback: (userId: number) => void): void {
        this.eventEmitter.on('userRemoved', callback);
    }

    public onSignalingStatusChanged(callback: (userId: number, isConnected: boolean) => void): void {
        this.eventEmitter.on('signalingStatusChanged', callback);
    }

    public onSettingsUpdated(callback: (userId: number, settings: { [key: string]: any }) => void): void {
        this.eventEmitter.on('settingsUpdated', callback);
    }
}
export default UserSessionService; 