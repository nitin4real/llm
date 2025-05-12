import { RtcTokenBuilder, RtcRole, RtmTokenBuilder } from 'agora-token';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { LoggerService } from './logger.service';

dotenv.config();

class TokenService {
  private readonly appId: string;
  private readonly appCertificate: string;
  private readonly DEFAULT_EXPIRATION = 24 * 3600; // 24 hours in seconds

  constructor() {
    this.appId = process.env.AGORA_APP_ID || '';
    this.appCertificate = process.env.AGORA_APP_CERTIFICATE || '';
  }

  generateChannelName(agentId: number, uid: number): string {
    const timestamp = Date.now().toString(36); // Convert to base36 for shorter representation
    return `agent_${agentId}_${uid}_${timestamp}`;
  }

  generateRtcToken(channelName: string, uid: number, expirationInSeconds: number = this.DEFAULT_EXPIRATION) {
    try {
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const privilegeExpiredTs = currentTimestamp + expirationInSeconds;
      const token = RtcTokenBuilder.buildTokenWithUid(
        this.appId,
        this.appCertificate,
        channelName,
        Number(uid),
        RtcRole.PUBLISHER,
        privilegeExpiredTs,
        privilegeExpiredTs
      );

      return {
        token,
        channelName,
        uid: Number(uid),
        appId: this.appId,
        expirationTime: privilegeExpiredTs
      };
    } catch (error) {
      console.error('Error generating RTC token:', error);
      throw error;
    }
  }

  generateRtmToken(uid: number, expirationInSeconds: number = this.DEFAULT_EXPIRATION) {
    try {
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const privilegeExpiredTs = currentTimestamp + expirationInSeconds;

      const token = RtmTokenBuilder.buildToken(
        this.appId,
        this.appCertificate,
        uid.toString(),
        privilegeExpiredTs
      );

      return {
        token,
        uid,
        appId: this.appId,
        expirationTime: privilegeExpiredTs
      };
    } catch (error) {
      console.error('Error generating RTM token:', error);
      throw error;
    }
  }

  generateTokens(channelName: string, uid: number, expirationInSeconds: number = this.DEFAULT_EXPIRATION) {
    try {
      const rtcToken = this.generateRtcToken(channelName, uid, expirationInSeconds);
      const rtmToken = this.generateRtmToken(uid, expirationInSeconds);

      return {
        rtcToken: rtcToken.token,
        rtmToken: rtmToken.token,
        channelName,
        uid,
        appId: this.appId,
        expirationTime: rtcToken.expirationTime
      };
    } catch (error) {
      console.error('Error generating tokens:', error);
      throw error;
    }
  }
}

export const tokenService = new TokenService(); 