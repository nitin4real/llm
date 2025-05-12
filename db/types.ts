export interface User {
  uid: number;
  password: string;
  platformUsageTime: number; // in seconds
  agentName: string;
  createdAt: Date;
  lastLoginAt: Date;
}

export interface UserLoginResponse {
  success: boolean;
  user?: Omit<User, 'password'>;
  error?: string;
}

export interface UserCreateResponse {
  success: boolean;
  user?: Omit<User, 'password'>;
  error?: string;
}

export interface UserUpdateResponse {
  success: boolean;
  user?: Omit<User, 'password'>;
  error?: string;
} 