import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import chatService from '../services/chat.service';

const router = Router();



router.post('/completions', authMiddleware, async (req: any, res: any) => {
  try {
    const user = req.user;
    const { messages, stream = false } = req.body;
    if (!messages) {
      throw new Error("Messages are required");
    }
    const response = await chatService.handleChatCompletion(user.id, messages);
    const responseFormat = {
      "choices": [
        {
          "index": 0,
          "delta": {
            "content": response.content || "Hmm, I'm not sure what to say, there seems to be some problems"
          },
          "finish_reason": null
        }]
    }
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.write(`data: ${JSON.stringify(responseFormat)}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end()
  } catch (error: any) {
    console.error("Error in chat completion", error);
    res.status(500).json({ error: error?.message });
  }
});

export default router; 