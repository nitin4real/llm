import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import { randomUUID } from 'crypto';
import fs from 'fs';
import https from 'https';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';

dotenv.config();
const SSL_KEY_PATH = process.env.SSL_KEY_PATH
const SSL_CERT_PATH = process.env.SSL_CERT_PATH
const isProd = process.env.PROD === 'true';


// Load environment variables

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


let conversationMessages = [
  {
    role: "system",
    content: "You are a helpful math teacher that asks user some multiple choice questions and help with solving and understanding the questions."
  },
  {
    role: "assistant",
    content: "Hello, I'm Baiju Raveendran, your math teacher. I can help you learn new concepts and solve problems. Let's start."
  }
] as any


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
          minItems: 2,
          maxItems: 6,
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
}];

// Socket.IO connection handling
app.post('/chat/completions', async (req: Request, res: Response) => {
  try {
    logger.info(`Received request: ${JSON.stringify(req.body)}`);

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

    if(messages.length > 0){
      const userMessage = messages[messages.length - 1]
      if(userMessage.role == 'user'){
        conversationMessages.push(userMessage)
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

    if(completion.choices[0].message.tool_calls){
      const toolCall = completion.choices[0].message.tool_calls[0];
      const args = JSON.parse(toolCall.function.arguments);
      if(toolCall.function.name === "show_question"){
        conversationMessages.push(completion.choices[0].message)
        responseFormat.choices[0].delta.content = args.speechToUser
        
        // Emit the question to all connected clients
        io.emit('new_question', {
          question: args.questionDescription,
          options: args.options,
          id: toolCall.id
        });
      } else if(toolCall.function.name === "talkToUser"){
        conversationMessages.push(completion.choices[0].message)
        responseFormat.choices[0].delta.content = args.speechToUser
      }
      conversationMessages.push({
        role: "tool",
        content: "Sent To the user",
        id: toolCall.id
      })
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
          content: "You are a helpful math teacher that asks user some multiple choice questions and help with solving and understanding the questions."
        },
        {
          role: "assistant",
          content: "Hello, I'm Baiju Raveendran, your math teacher. I can help you learn new concepts and solve problems. Let's start."
        }
      ]
      socket.on('answer_submitted', (data: { answer: string; question: string }) => {
        console.log('Answer received:', data);
        // Add the user's answer to the conversation
        conversationMessages.push({
          role: "user",
          content: `I selected option ${data.answer} for the question: ${data.question}`
        });
      });

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