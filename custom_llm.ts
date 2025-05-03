import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import { randomUUID } from 'crypto';
import fs from 'fs';
import https from 'https';

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
          minItems: 4,
          maxItems: 4,
          description: "An array of 4 answer options"
        },
        speechToUser: {
          type: "string",
          description: "The introduction to the question. Only use vocal responses."
        }
      },
      required: ["questionDescription", "options", "speechToUser"]
    }
  }
}, {
  type: "function",
  function: {
    name: "talkToUser",
    description: "Use this tool to discuss the question with the user. Only use vocal responses.",
    parameters: {
      type: "object",
      properties: {
        speechToUser: {
          type: "string",
          description: "The text of the discussion to the user. Only use vocal responses."
        },
      },
      required: ["speechToUser"]
    }
  }
}];

// Basic Chat Completions API
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
      // response_format,
      // stream: true
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
    // for await (const chunk of completion) {
      // logger.debug(`Received chunk: ${JSON.stringify(chunk)}`);
      // res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      // if(firstResponse){
        // responseFormat.id = chunk.id
        // responseFormat.object = chunk.object
        // responseFormat.created = chunk.created
        // responseFormat.model = chunk.model
        // responseFormat.service_tier = chunk.service_tier || "default"
        // responseFormat.system_fingerprint = chunk.system_fingerprint || "fp_0392822090"
    //   }
    // }
    // res.send(completion);
    // return
    res.write(`data: ${JSON.stringify(responseFormat)}\n\n`);

    // End the stream
    // res.write(`data: ${JSON.stringify({"id":"chatcmpl-BSwpxLmsdhLFvVecfQBePPoXJRRDS","object":"chat.completion.chunk","created":1746239053,"model":"gpt-4o-mini-2024-07-18","service_tier":"default","system_fingerprint":"fp_0392822090","choices":[{"index":0,"delta":{},"logprobs":null,"finish_reason":"stop"}]})}\n\n`)
    
    
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
    // Initialize TypeORM
    console.log("Data Source has been initialized!");

    if (isProd) {
      const httpsOptions = {
        key: fs.readFileSync(SSL_KEY_PATH || ''),
        cert: fs.readFileSync(SSL_CERT_PATH || ''),
      };

      https.createServer(httpsOptions, app).listen(port, () => {
        console.log(`HTTPS Server is running on port ${port}`);
      });
    } else {
      app.listen(port, () => {
        console.log(`HTTP Server is running on port ${port}`);
      });
    }
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer(); 