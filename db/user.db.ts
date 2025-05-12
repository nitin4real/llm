import { User, UserLoginResponse, UserCreateResponse, UserUpdateResponse } from './types';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

interface Database {
  users: { [key: string]: User };
}

class UserDatabase {
  private dbPath: string;

  constructor() {
    this.dbPath = path.join(__dirname, 'database.json');
  }

  private loadDatabase(): Database {
    try {
      if (fs.existsSync(this.dbPath)) {
        const data = fs.readFileSync(this.dbPath, 'utf-8');
        return JSON.parse(data);
      }
      return { users: {} };
    } catch (error) {
      console.error('Error loading database:', error);
      return { users: {} };
    }
  }

  private saveDatabase(db: Database): void {
    try {
      fs.writeFileSync(this.dbPath, JSON.stringify(db, null, 2));
    } catch (error) {
      console.error('Error saving database:', error);
      throw new Error('Failed to save database');
    }
  }

  private hashPassword(password: string): string {
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  private validatePassword(inputPassword: string, hashedPassword: string): boolean {
    return this.hashPassword(inputPassword) === hashedPassword;
  }

  createUser(uid: number, password: string, agentName: string): UserCreateResponse {
    try {
      const db = this.loadDatabase();
      if (db.users[uid]) {
        return {
          success: false,
          error: 'User already exists'
        };
      }

      const user: User = {
        uid,
        password: this.hashPassword(password),
        platformUsageTime: 0,
        agentName,
        createdAt: new Date(),
        lastLoginAt: new Date()
      };

      db.users[uid] = user;
      this.saveDatabase(db);

      const { password: _, ...userWithoutPassword } = user;
      return {
        success: true,
        user: userWithoutPassword
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to create user'
      };
    }
  }

  loginUser(uid: number, password: string): UserLoginResponse {
    try {
      const db = this.loadDatabase();
      const user = db.users[uid];

      if (!user) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      if (!this.validatePassword(password, user.password)) {
        return {
          success: false,
          error: 'Invalid password'
        };
      }

      // Update last login time
      user.lastLoginAt = new Date();
      db.users[uid] = user;
      this.saveDatabase(db);

      const { password: _, ...userWithoutPassword } = user;
      return {
        success: true,
        user: userWithoutPassword
      };
    } catch (error) {
      return {
        success: false,
        error: 'Login failed'
      };
    }
  }

  updatePlatformUsageTime(uid: number, additionalTimeInSeconds: number): UserUpdateResponse {
    try {
      const db = this.loadDatabase();
      const user = db.users[uid];
      
      if (!user) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      user.platformUsageTime += additionalTimeInSeconds;
      db.users[uid] = user;
      this.saveDatabase(db);

      const { password: _, ...userWithoutPassword } = user;
      return {
        success: true,
        user: userWithoutPassword
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to update platform usage time'
      };
    }
  }

  getUser(uid: number): UserUpdateResponse {
    try {
      const db = this.loadDatabase();
      const user = db.users[uid];
      
      if (!user) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      const { password: _, ...userWithoutPassword } = user;
      return {
        success: true,
        user: userWithoutPassword
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to get user'
      };
    }
  }

  deleteUser(uid: string): { success: boolean; error?: string } {
    try {
      const db = this.loadDatabase();
      if (!db.users[uid]) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      delete db.users[uid];
      this.saveDatabase(db);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to delete user'
      };
    }
  }

  // For testing purposes
  getAllUsers(): Omit<User, 'password'>[] {
    const db = this.loadDatabase();
    return Object.values(db.users).map(({ password, ...user }) => user);
  }
}

// Export a singleton instance
export const userDb = new UserDatabase(); 