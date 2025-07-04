import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import { randomUUID } from 'crypto';
import fs from 'fs';
import https from 'https';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import { tokenService } from './tokenService';
import axios from 'axios';

dotenv.config();
const SSL_KEY_PATH = process.env.SSL_KEY_PATH
const SSL_CERT_PATH = process.env.SSL_CERT_PATH
const isProd = process.env.PROD === 'true';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string | number;
      };
    }
  }
}


// Type definitions
interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatCompletionRequest {
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

interface Logger {
  info: (message: string) => void;
  debug: (message: string) => void;
  error: (message: string, error?: Error) => void;
}

interface ElevenLabsTTSParams {
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

type TTSParams = ElevenLabsTTSParams;

interface StartAgentConfig {
  channelName: string;
  agentUid: string;
  token: string;
  userId: number;
  ttsVendor?: "elevenlabs";
  systemPrompt?: string;
  introduction?: string;
  voiceId?: string;
  language?: string;
}

interface AgentProperties {
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
}

interface AgentResponse {
  agent_id: string;
  create_ts: number;
  status: string;
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'your-api-key-here',
});

// Initialize Express app
const app = express();
const port = process.env.PORT || 8000;

// Initialize Socket.IO server
let io: Server;

// Configure logging
const logger: Logger = {
  info: (message: string) => console.log(`INFO: ${message}`),
  debug: (message: string) => console.log(`DEBUG: ${message}`),
  error: (message: string, error?: Error) => console.error(`ERROR: ${message}`, error),
};

// Middleware
app.use(cors());
app.use(express.json());
app.use((request: Request, response: Response, next: NextFunction) => {
  logger.info(request.originalUrl);
  next();
});

// Health check endpoint
app.get('/ping', (req: Request, res: Response) => {
  res.json({ message: 'pong' });
});

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'Welcome to a simple Custom LLM server for Agora Convo AI Engine!',
    endpoints: [
      '/chat/completions',
      '/rag/chat/completions',
      '/audio/chat/completions',
    ],
  });
});
const prompt = `You are a helpful math teacher that asks user some multiple choice questions and help with solving and understanding the questions. The user will be a student. 
    Always stay in character and avoid repetition. 
    `
// Only dialogue content is allowed when sending speech to user, adding any descriptions of actions, expressions, or scenes is not permitted in speech to user. Please state any formula verbally, using only spoken words and avoiding any mathematical symbols or notation in speech to user.”
const intro = "Hello, I'm Baiju Raveendran, your math teacher. I can help you learn new concepts and solve problems. Let's start with some basic math questions. are you ready ?"
let conversationMessages = [
  {
    role: "system",
    content: prompt
  },
  {
    role: "assistant",
    content: intro
  }
] as any

const listOfImagesWithConcepts = {
  "triangles": {
    imageUrl: 'data:image/png;base64,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',
    description: 'Image of a equilateral triangle.'
  },
  "rightAngleTriangle": {
    imageUrl: 'https://ichef.bbci.co.uk/images/ic/480xn/p0dkvtlx.png',
    description: 'Image of a right angle triangle showing theta, hypotenuse h, opposite side o and adjecent a.'
  },
  "numbers": {
    imageUrl: "https://s3.eu-central-1.amazonaws.com/studysmarter-mediafiles/media/1865576/summary_images/Untitled_Artwork_3.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIA4OLDUDE42UZHAIET%2F20250502%2Feu-central-1%2Fs3%2Faws4_request&X-Amz-Date=20250502T160812Z&X-Amz-Expires=604800&X-Amz-SignedHeaders=host&X-Amz-Signature=8928baad0cbeff8e26d193aff2051f7d9c687ce88bc1584a0a1de04686a30836",
    description: "Image of number system devision"
  },
  "circles": {
    imageUrl: "https://dictionary.cambridge.org/images/thumb/circle_noun_001_02738.jpg?version=6.0.49",
    description: "Plain circle",
  },
  "pizza": {
    imageUrl: "https://assets.surlatable.com/m/15a89c2d9c6c1345/72_dpi_webp-REC-283110_Pizza.jpg",
    description: "Pizza that is cut in 8 slices to use an example of circle",
  },
  "vectors": {
    imageUrl: "https://mathinsight.org/media/image/image/vector.png",
    description: "A vector showing magnitude, direction, head and tail of a vector"
  }
}

const myTools = [{
  type: "function",
  function: {
    name: "show_question",
    description: "Show question to the user.",
    parameters: {
      type: "object",
      properties: {
        questionDescription: {
          type: "string",
          description: "The text of the quiz question"
        },
        options: {
          type: "array",
          items: {
            type: "string"
          },
          minItems: 4,
          maxItems: 4,
          description: "An array of answer options"
        },
        speechToUser: {
          type: "string",
          description: "The introduction to the question. Only use vocal responses. Approx 30-40 words"
        }
      },
      required: ["questionDescription", "options", "speechToUser"]
    }
  }
}, {
  type: "function",
  function: {
    name: "talkToUser",
    description: "Use this tool to discuss with the user. Only use vocal responses. Approx 30-40 words",
    parameters: {
      type: "object",
      properties: {
        speechToUser: {
          type: "string",
          description: "The text of the discussion to the user. Only use vocal responses. Approx 30-40 words"
        },
      },
      required: ["speechToUser"]
    }
  }
}, {
  type: "function",
  function: {
    name: "show_image",
    description: "This function will show a image to the user and tell you the metadata about the image. You can then use this image to explain the concept to the user.",
    parameters: {
      type: "object",
      properties: {
        conceptName: {
          type: "string",
          enum: Object.keys(listOfImagesWithConcepts),
          description: "Name of the concept you want to show the user."
        },
        speechToUser: {
          type: "string",
          description: "The introduction to the concept. Only use vocal responses. Approx 30-40 words"
        }
      },
      required: ["conceptName", "speechToUser"]
    }
  }
}];

const getImageByConceptName = (conceptName: keyof typeof listOfImagesWithConcepts) => {
  const imageData: any = listOfImagesWithConcepts[conceptName]
  return imageData
}

app.post('/chat/completions', async (req: Request, res: Response) => {
  try {
    // logger.info(`Received request: ${JSON.stringify(req.body)}`);

    const {
      model = 'gpt-4o-mini',
      messages,
      tools = myTools,
      tool_choice,
      response_format,
      stream = true,
    } = req.body as ChatCompletionRequest;

    if (!messages) {
      return res
        .status(400)
        .json({ detail: 'Missing messages in request body' });
    }

    if (!stream) {
      return res
        .status(400)
        .json({ detail: 'chat completions require streaming' });
    }


    if (messages.length > 0) {
      const userMessage = messages[messages.length - 1]
      if (userMessage.role == 'user') {
        conversationMessages.push(userMessage)
        io.emit('transcript', {
          isAgent: false,
          transcript: userMessage.content
        });
      }
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    let firstResponse = true

    // Create OpenAI streaming completion
    const completion = await openai.chat.completions.create({
      model,
      messages: conversationMessages,
      tools: tools ? tools : undefined,
      tool_choice: "required",
    });

    // Stream the response
    const responseFormat = {
      "choices": [
        {
          "index": 0,
          "delta": {
            "content": ""
          },
          "finish_reason": null
        }]
    }

    if (completion.choices[0].message.tool_calls) {
      const toolCall = completion.choices[0].message.tool_calls[0];
      if (completion.choices[0].message.tool_calls.length > 1) {
        completion.choices[0].message.tool_calls = [completion.choices[0].message.tool_calls[0]];
      }
      const args = JSON.parse(toolCall.function.arguments);
      if (toolCall.function.name === "show_question") {
        conversationMessages.push(completion.choices[0].message)
        responseFormat.choices[0].delta.content = args.speechToUser

        io.emit('transcript', {
          isAgent: true,
          transcript: args.speechToUser
        });

        // Emit the question to all connected clients
        io.emit('new_question', {
          question: args.questionDescription,
          options: args.options,
          id: toolCall.id
        });
        conversationMessages.push({
          role: "tool",
          content: "Sent To the user",
          tool_call_id: toolCall.id
        })
      } else if (toolCall.function.name === "talkToUser") {
        io.emit('transcript', {
          isAgent: true,
          transcript: args.speechToUser
        });
        conversationMessages.push(completion.choices[0].message)
        responseFormat.choices[0].delta.content = args.speechToUser
        conversationMessages.push({
          role: "tool",
          content: "Sent To the user",
          tool_call_id: toolCall.id
        })
      } else if (toolCall.function.name === 'show_image') {
        conversationMessages.push(completion.choices[0].message)
        const imageData = getImageByConceptName(args.conceptName)
        io.emit('transcript', {
          isAgent: true,
          transcript: args.speechToUser
        });
        conversationMessages.push({
          role: "tool",
          content: `The image shown to user is of ->  ${imageData.description}`,
          tool_call_id: toolCall.id
        })
        responseFormat.choices[0].delta.content = args.speechToUser
        io.emit('content', {
          imageUrl: imageData.imageUrl
        })
        // implement the logic for calling the open ai again here == :TODO man
      }
    } else {
      responseFormat.choices[0].delta.content = completion.choices[0].message.content || "Hmm, I'm not sure what to say."
    }
    logger.info(`${JSON.stringify(conversationMessages)}\n\n\n`)

    res.write(`data: ${JSON.stringify(responseFormat)}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();

  } catch (error) {
    logger.error('Chat completion error:', error as Error);

    if (!res.headersSent) {
      const errorDetail = `${(error as Error).message}\n${(error as Error).stack || ''}`;
      return res.status(500).json({ detail: errorDetail });
    }

    res.write(`data: ${JSON.stringify({ error: (error as Error).message })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  }
});

function generateUniqueId(): number {
  return Math.floor(Math.random() * 9000) + 1000;
}

// Add the new channel endpoint
app.get('/channel/:agentId', (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    // generate a 4 digid number id
    const uid = generateUniqueId()

    const channelName = tokenService.generateChannelName(agentId, uid);
    const tokenData = tokenService.generateToken(channelName, uid);

    res.json(tokenData);
  } catch (error) {
    logger.error('Error generating Agora token:', error as Error);
    res.status(500).json({ error: 'Failed to generate Agora token' });
  }
});

// Start agent endpoint
app.post('/start/:agentId', async (req: Request, res: Response) => {
  try {
    let { channelName, languageCode = 'en-US' } = req.body;
    const { agentId } = req.params;
    const userId = generateUniqueId();
    const userName = "User";

    if (languageCode === '') {
      languageCode = 'en-US';
    }

    // Create a new unique uid for the agent with request user id by adding 2 digits to the end
    const agentUid = userId * 100 + 1; // the agent id is {userId}01
    const tokenData = tokenService.generateToken(channelName, agentUid);

    // Generate system prompt for the agent
    let systemPrompt = "You are a helpful AI assistant.";
    let introduction = intro
    const voiceId = process.env.ELEVENLABS_VOICE_ID || '';

    // Start the agent with the generated token and system prompt
    const agent = await agentService.startAgent({
      channelName,
      agentUid: agentUid.toString(),
      token: tokenData.token,
      userId: Number(userId),
      systemPrompt,
      introduction,
      voiceId,
      language: languageCode
    });

    res.json({
      ...agent,
      ...tokenData
    });
  } catch (error) {
    logger.error('Error starting agent:', error as Error);
    if ((error as Error).message.includes('not found')) {
      return res.status(404).json({ error: (error as Error).message });
    }
    res.status(500).json({ error: 'Failed to start agent' });
  }
});

// Stop agent endpoint
app.post('/stop', async (req: Request, res: Response) => {
  try {
    const { convoAgentId } = req.body;
    if (!convoAgentId) {
      return res.status(400).json({ error: 'Agent ID is required' });
    }
    res.json({ message: 'Agent stopped successfully' });
  } catch (error) {
    logger.error('Error stopping agent:', error as Error);
    res.status(500).json({ error: 'Failed to stop agent' });
  }
});

class AgentService {
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
    let { channelName, agentUid, token, ttsVendor = "elevenlabs", systemPrompt, introduction, voiceId, language = "en-US" } = config;
    const ttsConfig: ElevenLabsTTSParams = {
      vendor: "elevenlabs",
      params: {
        key: process.env.ELEVENLABS_API_KEY || "",
        model_id: "eleven_flash_v2_5",
        voice_id: voiceId || "21m00Tcm4TlvDq8ikWAM",
        stability: 1,
        similarity_boost: 0.75,
        speed: 90
      }
    }

    return {
      channel: channelName,
      token: token,
      graph_id: "1.3.1-123-g17c1156", // v3 
      agent_rtc_uid: agentUid,
      remote_rtc_uids: ["*"], // use req user id as remote uid
      enable_string_uid: false,
      idle_timeout: 120,
      llm: {
        url: process.env.LLM_SERVICE_URL || "https://api.openai.com/v1/chat/completions",
        api_key: process.env.OPENAI_API_KEY || "",
        system_messages: [
          {
            role: "system",
            content: systemPrompt || "You are a helpful casual conversational AI."
          }
        ],
        greeting_message: introduction || "Hello, how can I help you?",
        failure_message: "Sorry, I don't know how to answer this question.",
        max_history: 10,
        params: {
          model: "gpt-4o-mini"
        }
      },
      asr: {
        language
      },
      tts: ttsConfig
    };
  }

  async startAgent(config: StartAgentConfig): Promise<AgentResponse> {
    try {
      const properties = this.getAgentProperties(config);
      logger.info(`Starting agent with properties: ${JSON.stringify(properties)}`);
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

  // async getAgentStatus(agentId: string): Promise<AgentResponse> {
  //   try {
  //     const response = await axios.get(
  //       `${this.baseUrl}/status/${agentId}`,
  //       this.getHeaders()
  //     );
  //     return response.data;
  //   } catch (error) {
  //     console.error('Error getting agent status:', error);
  //     throw error;
  //   }
  // }
}

// Initialize AgentService
const agentService = new AgentService();

// Initialize the application
const startServer = async () => {
  try {
    console.log("Data Source has been initialized!");

    if (isProd) {
      const httpsOptions = {
        key: fs.readFileSync(SSL_KEY_PATH || ''),
        cert: fs.readFileSync(SSL_CERT_PATH || ''),
      };

      const httpsServer = https.createServer(httpsOptions, app);
      io = new Server(httpsServer, {
        cors: {
          origin: "*",
          methods: ["GET", "POST"]
        }
      });

      httpsServer.listen(port, () => {
        console.log(`HTTPS Server with Socket.IO is running on port ${port}`);
      });
    } else {
      const httpServer = createServer(app);
      io = new Server(httpServer, {
        cors: {
          origin: "*",
          methods: ["GET", "POST"]
        }
      });

      httpServer.listen(port, () => {
        console.log(`HTTP Server with Socket.IO is running on port ${port}`);
      });
    }

    // Socket.IO connection handling
    io.on('connection', (socket: Socket) => {
      console.log('A user connected');
      // reset the conversation array

      conversationMessages = [
        {
          role: "system",
          content: prompt
        },
        {
          role: "assistant",
          content: intro
        }
      ]
      io.emit('transcript', {
        isAgent: true,
        transcript: intro
      });
      socket.on('answer_submitted', (data: { answer: string; question: string }) => {
        console.log('Answer received:', data);
        // Add the user's answer to the conversation
        conversationMessages.push({
          role: "system",
          content: `User answered -> ${data.answer} for the question: ${data.question}`
        });
      });
      // here add this to the list and generate a response and send it directly to the TTS.

      socket.on('disconnect', () => {
        console.log('User disconnected');
      });
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer(); 