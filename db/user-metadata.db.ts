import fs from 'fs';
import path from 'path';

interface UserMetadata {
    languageCode: string;
    voiceId: string;
    logoUrl: string;
    prompt: string;
    agentName: string;
    agentUid: number;
    remainingSeconds: number;
    intro: string;
    elevenLabsApiKey: string;
    elevenLabsStability?: number;
    elevenLabsSimilarityBoost?: number;
    elevenLabsSpeed?: number;
    brandName?: string;
    brandLogo?: string;
}

interface MetadataDatabase {
  users: { [key: string]: UserMetadata };
}

class UserMetadataDatabase {
  private dbPath: string;

  constructor() {
    this.dbPath = path.join(__dirname, 'user-metadata.json');
    this.initializeDatabase();
  }
  

  private initializeDatabase(): void {
    if (!fs.existsSync(this.dbPath)) {
      this.saveDatabase({ users: {} });
    }
  }

  private loadDatabase(): MetadataDatabase {
    try {
      const data = fs.readFileSync(this.dbPath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error loading metadata database:', error);
      return { users: {} };
    }
  }

  private saveDatabase(db: MetadataDatabase): void {
    try {
      fs.writeFileSync(this.dbPath, JSON.stringify(db, null, 2));
    } catch (error) {
      console.error('Error saving metadata database:', error);
      throw new Error('Failed to save metadata database');
    }
  }

  getBrandDetails(uid: number): { success: boolean; error?: string; brandDetails?: any } {
    try {
      const db = this.loadDatabase();
      const user = db.users[uid];

      if (!user) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      return {
        success: true,
        brandDetails: {
          brandName: user.brandName,
          brandLogo: user.brandLogo,
        }
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to get brand details'
      };
    }
  }


  getUserMetadata(uid: number): { success: boolean; metadata?: UserMetadata; error?: string } {
    try {
      const db = this.loadDatabase();
      const metadata = db.users[uid];
      
      if (!metadata) {
        return {
          success: false,
          error: 'No metadata found for user'
        };
      }

      return {
        success: true,
        metadata
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to fetch user metadata'
      };
    }
  }

  updateUserMetadata(uid: number, metadata: Partial<UserMetadata>): { success: boolean; error?: string } {
    try {
      const db = this.loadDatabase();
      const existingMetadata = db.users[uid] || {};
      
      db.users[uid] = {
        ...existingMetadata,
        ...metadata
      };

      this.saveDatabase(db);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to update user metadata'
      };
    }
  }

  deleteUserMetadata(uid: number): { success: boolean; error?: string } {
    try {
      const db = this.loadDatabase();
      
      if (!db.users[uid]) {
        return {
          success: false,
          error: 'No metadata found for user'
        };
      }

      delete db.users[uid];
      this.saveDatabase(db);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to delete user metadata'
      };
    }
  }

  // For testing purposes
  getAllUserMetadata(): { [key: string]: UserMetadata } {
    const db = this.loadDatabase();
    return db.users;
  }
}

// Export a singleton instance
export const userMetadataDb = new UserMetadataDatabase(); 