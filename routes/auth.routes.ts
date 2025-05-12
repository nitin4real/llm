import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { userDb } from '../db/user.db';
import jwt from 'jsonwebtoken';
import { config } from '../config/config';
import { userMetadataDb } from '../db/user-metadata.db';

const router = Router();

// Master user credentials
const MASTER_PASSWORD = config.masterPassword;

// Public routes
router.post('/register', async (req: any, res: any) => {
  try {
    const { uid, password, agentName, masterPassword } = req.body;

    // Verify master password for user creation
    if (masterPassword !== MASTER_PASSWORD) {
      return res.status(401).json({ message: 'Invalid master password' });
    }

    const result = userDb.createUser(uid, password, agentName);

    if (!result.success || !result.user) {
      return res.status(400).json({ message: result.error });
    }

    res.status(201).json({ message: 'User registered successfully', user: result.user });
  } catch (error) {
    res.status(500).json({ message: 'Error registering user' });
  }
});

router.post('/login', async (req: any, res: any) => {
  try {
    const { id, password } = req.body;
    const result = userDb.loginUser(id, password);
    const brandDetailsResult = userMetadataDb.getBrandDetails(id)
    if (!result.success || !result.user) {
      return res.status(401).json({ message: result.error });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: result.user.uid },
      config.jwtSecret,
      { expiresIn: '24h' }
    );

    res.status(200).json({
      message: 'Login successful',
      token,
      user: result.user,
      brandDetails: brandDetailsResult.brandDetails
    });
  } catch (error) {
    res.status(500).json({ message: 'Error logging in' });
  }
});

export default router; 