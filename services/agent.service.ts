import axios from 'axios';
import { StartAgentConfig, AgentProperties, AgentResponse, TTSParams, AgentStopResponse } from '../types';
import { config as appConfig } from '../config/config';
import jwt from 'jsonwebtoken';

export class AgentService {
  private baseUrl: string;
  private readonly appId: string;
  private readonly customerId: string;
  private readonly customerSecret: string;

  constructor() {
    this.appId = process.env.AGORA_APP_ID || '';
    this.customerId = process.env.AGORA_CUSTOMER_ID || '';
    this.customerSecret = process.env.AGORA_CUSTOMER_SECRET || '';
    this.baseUrl = `https://api.agora.io/api/conversational-ai-agent/v2/projects/${this.appId}`;
  }

  private getAuthHeader(): string {
    const plainCredential = `${this.customerId}:${this.customerSecret}`;
    const encodedCredential = Buffer.from(plainCredential).toString('base64');
    return `Basic ${encodedCredential}`;
  }

  private getHeaders() {
    return {
      headers: {
        'Authorization': this.getAuthHeader(),
        'Content-Type': 'application/json'
      }
    }
  }

  private getAgentProperties(config: StartAgentConfig): AgentProperties {
    // here get the user meta data from the database -> use this to configure the agent
    const llm_api_key = jwt.sign({ id: config.userId }, appConfig.jwtSecret, { expiresIn: '24h' });
    return {
      channel: config.channelName,
      token: config.agentRTCtoken,
      graph_id: "1.3.1-123-g17c1156", // v3 check if this needs to be in parent params
      agent_rtc_uid: config.agentRTCUid.toString(),
      remote_rtc_uids: ["*"],
      enable_string_uid: true,
      idle_timeout: 120,
      llm: {
        url: process.env.LLM_URL || '',
        api_key: llm_api_key || '',
        system_messages: [
          {
            role: "system",
            content: config.prompt
          }
        ],
        greeting_message: config.intro,
        failure_message: "Sorry, I don't know how to answer this question.",
        max_history: 10,
        params: {
          model: "gpt-4o-mini"
        }
      },
      asr: {
        language: config.languageCode
      },
      vad: {
        silence_duration_ms: 480
      },
      tts: {
        vendor: "elevenlabs",
        params: {
          key: config.elevenLabsApiKey,
          model_id: "eleven_turbo_v2_5",
          voice_id: config.voiceId,
          stability: config.elevenLabsStability || 1,
          similarity_boost: config.elevenLabsSimilarityBoost || 0.75,
          speed: config.elevenLabsSpeed || 1
        }
      }
    };
  }

  async startAgent(config: StartAgentConfig): Promise<AgentResponse> {
    try {
      const properties = this.getAgentProperties(config);
      const response = await axios.post(
        `${this.baseUrl}/join`,
        {
          name: `agent_${Date.now()}`,
          properties
        },
        this.getHeaders()
      );
      return response.data as AgentResponse;
    } catch (error) {
      console.error('Error starting agent:', error);
      throw error;
    }
  }


  async sendSpeech(agentId: string, speech: string): Promise<AgentResponse> {
    const response = await axios.post(
      `${this.baseUrl}/agents/${agentId}/speech`,
      { speech },
      this.getHeaders()
    );
    return response.data;
  }

  async stopAgent(agentId: string): Promise<AgentStopResponse> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/agents/${agentId}/leave`,
        {},
        this.getHeaders()
      );
      return response.data;
    } catch (error) {
      console.error('Error stopping agent:', error);
      throw error;
    }
  }
} 