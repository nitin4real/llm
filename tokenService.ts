import { RtcTokenBuilder, RtcRole } from 'agora-token';
import dotenv from 'dotenv';

dotenv.config();

export class TokenService {
  private readonly appId: string;
  private readonly appCertificate: string;

  constructor() {
    this.appId = process.env.AGORA_APP_ID || '';
    this.appCertificate = process.env.AGORA_APP_CERTIFICATE || '';
  }

  generateChannelName(agentId: string, uid: number): string {
    const timestamp = Date.now().toString(36); // Convert to base36 for shorter representation
    return `${agentId}_${uid}_${timestamp}`;
  }

  generateToken(channelName: string, uid: number): { token: string; channelName: string; uid: number; appId: string } {
    try {
      // Calculate token expiration time (24 hours from now)
      const expirationTimeInSeconds = 24 * 3600;
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

      // Generate the token
      const token = RtcTokenBuilder.buildTokenWithUid(
        this.appId,
        this.appCertificate,
        channelName,
        uid,
        RtcRole.PUBLISHER,
        privilegeExpiredTs,
        privilegeExpiredTs // Join channel privilege expiration time
      );

      return {
        token,
        channelName,
        uid,
        appId: this.appId
      };
    } catch (error) {
      console.error('Error generating Agora token:', error);
      throw error;
    }
  }
}

export const tokenService = new TokenService(); 