import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import UserSessionService from '../services/UserSessionService';
const router = Router();

function generateUniqueId(): number {
  return Math.floor(Math.random() * 9000) + 1000;
}

router.use(authMiddleware);

router.post('/start', async (req: any, res: any) => {
  try {

    if (!req.user?.id) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { id }: { id: number } = req.user;
    const userSessionService = UserSessionService.getInstance();
    const { rtcToken, channelName, rtcAppId, rtcUid, rtmToken } = await userSessionService.startUserSession(id);
    const response = {
      rtcToken,
      channelName,
      appId: rtcAppId,
      uid: rtcUid,
      rtmToken,
    
    }
    return res.json(response);

  } catch (error) {
    console.error('Error starting agent:', error);
    if ((error as Error).message.includes('not found')) {
      return res.status(404).json({ error: (error as Error).message });
    }
    res.status(500).json({ error: 'Failed to start agent' });
  }
});

// // Stop agent endpoint
router.post('/stop', async (req: any, res: any) => {
  try {
    const id = req.user?.id;
    if (!id) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    const userSessionService = UserSessionService.getInstance();
    const agentStopResponse = await userSessionService.stopUserSession(id);
    res.json({ response: agentStopResponse, success: true });
  } catch (error) {
    console.error('Error stopping agent:', error);
    res.status(500).json({ error: 'Failed to stop agent' });
  }
});

export default router; 