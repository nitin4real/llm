export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionRequest {
  model?: string;
  messages: Message[];
  modalities?: string[];
  tools?: any[];
  tool_choice?: any;
  response_format?: any;
  audio?: any;
  stream?: boolean;
  stream_options?: any;
}

export interface Logger {
  info: (message: string) => void;
  debug: (message: string) => void;
  error: (message: string, error?: Error) => void;
}

export interface ElevenLabsTTSParams {
  vendor: "elevenlabs";
  params: {
    key: string;
    model_id: string;
    voice_id: string;
    stability?: number;
    similarity_boost?: number;
    style?: number;
    use_speaker_boost?: boolean;
    speed?: number;
    adjust_volume?: number;
  }
}

export type TTSParams = ElevenLabsTTSParams;

export interface StartAgentConfig {
  userId: number;
  languageCode: string;
  agentRTCUid: number;
  agentRTCtoken: string;
  channelName: string;
  prompt: string;
  intro: string;
  voiceId: string;
  elevenLabsApiKey: string;
  elevenLabsStability?: number;
  elevenLabsSimilarityBoost?: number;
  elevenLabsSpeed?: number;
}

export interface AgentProperties {
  channel: string;
  token: string;
  graph_id?: string;
  agent_rtc_uid: string;
  remote_rtc_uids: string[];
  enable_string_uid: boolean;
  idle_timeout: number;
  llm: {
    url: string;
    api_key: string;
    system_messages: Array<{
      role: string;
      content: string;
    }>;
    greeting_message: string;
    failure_message: string;
    max_history: number;
    params: {
      model: string;
    };
  };
  asr: {
    language: string;
  };
  tts: TTSParams;
  vad: {
    silence_duration_ms: number;
  };
}

export interface AgentResponse {
  agent_id: string;
  create_ts: number;
  status: string;
} 

export interface AgentStopResponse {
} 