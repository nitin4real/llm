# Conversational AI Server - Backend Service Documentation

## Overview

This is a Node.js backend service that provides a custom LLM (Large Language Model) endpoint for conversational AI applications. The service integrates with OpenAI's API and provides additional functionality for real-time chat completions, user session management, and agent-based interactions.

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Installation](#installation)
- [Configuration](#configuration)
- [API Endpoints](#api-endpoints)
- [Chat Completions Endpoint](#chat-completions-endpoint)
- [Authentication](#authentication)
- [WebSocket Integration](#websocket-integration)
- [Error Handling](#error-handling)
- [Development](#development)

## Features

- **Custom LLM Endpoint**: `/api/chat/completions` endpoint compatible with OpenAI's chat completions API
- **Real-time Streaming**: Server-Sent Events (SSE) for streaming responses
- **Function Calling**: Support for custom function calls with predefined tools
- **User Session Management**: Persistent user sessions with chat history
- **WebSocket Integration**: Real-time communication via Socket.IO
- **Authentication**: JWT-based authentication middleware
- **Agent Management**: Integration with conversational agents
- **Multi-modal Support**: Image and question display capabilities

## Architecture

The service follows a modular architecture with the following key components:

```
├── app.ts                 # Main application entry point
├── routes/               # API route definitions
│   ├── chat.routes.ts    # Chat completion endpoints
│   ├── auth.routes.ts    # Authentication endpoints
│   └── agent.routes.ts   # Agent management endpoints
├── services/             # Business logic services
│   ├── chat.service.ts   # Chat completion logic
│   ├── llm.service.ts    # OpenAI integration
│   ├── UserSessionService.ts # User session management
│   └── agent.service.ts  # Agent management
├── middleware/           # Express middleware
│   ├── auth.middleware.ts # JWT authentication
│   └── error.middleware.ts # Error handling
├── config/              # Configuration management
└── types/               # TypeScript type definitions
```

## Installation

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- OpenAI API key

### Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd node-llm
```

2. Install dependencies:
```bash
npm install
```

3. Copy environment variables:
```bash
cp env.example .env
```

4. Configure your environment variables in `.env`

5. Start the development server:
```bash
npm run dev
```

## Configuration

### Environment Variables

Create a `.env` file with the following variables:

```env
# Server Configuration
PORT=8000
NODE_ENV=development

# Authentication
JWT_SECRET=your-jwt-secret-key

# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key

# CORS Configuration (for production)
SSL_KEY_PATH=/path/to/ssl/key
SSL_CERT_PATH=/path/to/ssl/cert

# Agora Configuration (for real-time communication)
AGORA_APP_ID=your-agora-app-id
AGORA_APP_CERTIFICATE=your-agora-certificate
```

### Configuration Object

The service uses a centralized configuration object (`config/config.ts`):

```typescript
export const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
  },
  // ... other configurations
};
```

## API Endpoints

### Base URL
```
http://localhost:8000/api
```

### Available Endpoints

- `POST /api/chat/completions` - Chat completions endpoint
- `POST /api/agent/start` - Start a conversational agent
- `POST /api/agent/stop` - Stop a conversational agent
- `GET /api/auth/*` - Authentication endpoints
- `GET /health` - Health check endpoint
- `GET /token-health` - Token validation endpoint

## Chat Completions Endpoint

### Endpoint Details

**URL:** `POST /api/chat/completions`  
**Authentication:** Required (Bearer token)  
**Content-Type:** `application/json`  
**Response Format:** Server-Sent Events (SSE)

### Request Format

```json
{
  "messages": [
    {
      "role": "user",
      "content": "Hello, how are you?"
    }
  ],
  "stream": false
}
```

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `messages` | Array | Yes | Array of message objects |
| `stream` | Boolean | No | Enable streaming response (default: false) |

### Message Object Structure

```typescript
interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  name?: string;
  tool_calls?: FunctionCall[];
  tool_call_id?: string;
}
```

### Response Format

The endpoint returns a Server-Sent Events (SSE) stream with the following format:

```
data: {"choices":[{"index":0,"delta":{"content":"Hello! I'm doing well, thank you for asking."},"finish_reason":null}]}

data: [DONE]
```

### Response Structure

```json
{
  "choices": [
    {
      "index": 0,
      "delta": {
        "content": "Response content here"
      },
      "finish_reason": null
    }
  ]
}
```

### Function Calling Support

The chat completions endpoint supports custom function calls with the following predefined tools:

#### 1. show_question
Displays a quiz question to the user.

```typescript
{
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
          items: { type: "string" },
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
}
```

#### 2. talkToUser
Sends a vocal response to the user.

```typescript
{
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
        }
      },
      required: ["speechToUser"]
    }
  }
}
```

#### 3. show_image
Displays an image to the user with concept explanation.

```typescript
{
  type: "function",
  function: {
    name: "show_image",
    description: "This function will show a image to the user and tell you the metadata about the image.",
    parameters: {
      type: "object",
      properties: {
        conceptName: {
          type: "string",
          enum: ["concept1", "concept2", ...],
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
}
```

### Example Usage

#### Basic Chat Completion

```javascript
const response = await fetch('/api/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your-jwt-token'
  },
  body: JSON.stringify({
    messages: [
      {
        role: 'user',
        content: 'What is the capital of France?'
      }
    ]
  })
});

```

#### With Function Calling

```javascript
const response = await fetch('/api/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your-jwt-token'
  },
  body: JSON.stringify({
    messages: [
      {
        role: 'user',
        content: 'Show me a question about mathematics'
      }
    ]
  })
});
```

## Authentication

### JWT Authentication

The service uses JWT (JSON Web Tokens) for authentication. All protected endpoints require a valid Bearer token in the Authorization header.

#### Token Format

```
Authorization: Bearer <jwt-token>
```

#### Token Structure

```typescript
interface JWTPayload {
  id: string | number;
  agentName?: string;
}
```

#### Authentication Middleware

The `authMiddleware` validates JWT tokens and attaches user information to the request object:

```typescript
// Middleware usage
app.use('/api/chat', authMiddleware, chatRoutes);

// Accessing user information in route handlers
router.post('/completions', authMiddleware, async (req: any, res: any) => {
  const user = req.user; // { id: number }
  // ... handler logic
});
```

## WebSocket Integration

### Socket.IO Connection

The service integrates Socket.IO for real-time communication:

```javascript
// Client-side connection
const socket = io('http://localhost:8000', {
  auth: {
    token: 'your-jwt-token'
  }
});

// Connection events
socket.on('session_created', (data) => {
  console.log('Session created:', data);
});

socket.on('new_question', (data) => {
  console.log('New question:', data);
});

socket.on('content', (data) => {
  console.log('Content received:', data);
});
```

### Socket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `session_created` | Server → Client | User session established |
| `new_question` | Server → Client | New quiz question available |
| `content` | Server → Client | Image or content to display |
| `heartbeat` | Client → Server | Client heartbeat |
| `heartbeat_response` | Server → Client | Heartbeat acknowledgment |
| `answer_submitted` | Client → Server | User submitted answer |

## Error Handling

### Error Response Format

```json
{
  "error": "Error message description"
}
```

### Common Error Codes

| Status Code | Description |
|-------------|-------------|
| 400 | Bad Request - Invalid request format |
| 401 | Unauthorized - Invalid or missing token |
| 404 | Not Found - Resource not found |
| 500 | Internal Server Error - Server-side error |

### Error Handling Middleware

The service includes centralized error handling:

```typescript
// Global error handler
app.use(errorHandler);

// Not found handler
app.use(notFoundHandler);
```

## Development

### Available Scripts

```bash
npm run dev      # Start development server with nodemon
npm run start    # Start production server
npm run build    # Build TypeScript to JavaScript
npm run test     # Run tests
```

### Project Structure

```
├── app.ts                    # Main application file
├── package.json             # Dependencies and scripts
├── tsconfig.json           # TypeScript configuration
├── nodemon.json            # Nodemon configuration
├── routes/                 # API route definitions
│   ├── chat.routes.ts      # Chat completion routes
│   ├── auth.routes.ts      # Authentication routes
│   └── agent.routes.ts     # Agent management routes
├── services/               # Business logic services
│   ├── chat.service.ts     # Chat completion service
│   ├── llm.service.ts      # OpenAI integration service
│   ├── UserSessionService.ts # User session management
│   ├── agent.service.ts    # Agent management service
│   ├── token.service.ts    # Token generation service
│   └── logger.service.ts   # Logging service
├── middleware/             # Express middleware
│   ├── auth.middleware.ts  # JWT authentication
│   ├── error.middleware.ts # Error handling
│   └── not-found.middleware.ts # 404 handling
├── config/                 # Configuration files
│   └── config.ts          # Main configuration
├── types/                  # TypeScript type definitions
│   └── index.ts           # Shared types
├── db/                     # Database related files
│   ├── user.db.ts         # User database
│   ├── user-metadata.db.ts # User metadata
│   └── businessDb.ts      # Business logic database
└── constants/              # Application constants
```

### Key Dependencies

- **express**: Web framework
- **socket.io**: Real-time communication
- **openai**: OpenAI API integration
- **jsonwebtoken**: JWT authentication
- **cors**: Cross-origin resource sharing
- **helmet**: Security middleware
- **morgan**: HTTP request logging

### Development Guidelines

1. **TypeScript**: The project uses TypeScript for type safety
2. **Error Handling**: Always use try-catch blocks and proper error responses
3. **Logging**: Use the centralized logger service for consistent logging
4. **Authentication**: All protected routes must use the auth middleware
5. **Session Management**: Use the UserSessionService for user session operations

## Security Considerations

1. **JWT Secret**: Use a strong, unique JWT secret in production
2. **CORS**: Configure CORS origins appropriately for production
3. **Rate Limiting**: Consider implementing rate limiting for API endpoints
4. **Input Validation**: Validate all user inputs before processing
5. **SSL/TLS**: Use HTTPS in production environments
6. **Environment Variables**: Never commit sensitive information to version control

## Troubleshooting

### Common Issues

1. **Authentication Errors**: Ensure JWT token is valid and not expired
2. **Streaming Issues**: Check that the client properly handles SSE responses
3. **Session Errors**: Verify user session exists and is not expired
4. **Function Call Errors**: Ensure function parameters match expected schema

### Debug Mode

Enable debug logging by setting the appropriate log level in the logger service.