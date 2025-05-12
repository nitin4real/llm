enum LogLevel {
    DEBUG = 'DEBUG',
    INFO = 'INFO',
    WARN = 'WARN',
    ERROR = 'ERROR'
}

class LoggerService {
    private isEnabled: boolean = true;
    private currentLogLevel: LogLevel = LogLevel.INFO;

    constructor() {
        // You can set initial state from environment variables if needed
        this.isEnabled = process.env.LOGGING_ENABLED !== 'false';
        this.currentLogLevel = (process.env.LOG_LEVEL as LogLevel) || LogLevel.INFO;
    }

    public enable(): void {
        this.isEnabled = true;
    }

    public disable(): void {
        this.isEnabled = false;
    }

    public setLogLevel(level: LogLevel): void {
        this.currentLogLevel = level;
    }

    private shouldLog(level: LogLevel): boolean {
        if (!this.isEnabled) return false;
        
        const levels = Object.values(LogLevel);
        const currentLevelIndex = levels.indexOf(this.currentLogLevel);
        const messageLevelIndex = levels.indexOf(level);
        
        return messageLevelIndex >= currentLevelIndex;
    }

    private formatMessage(level: LogLevel, message: string, ...args: any[]): string {
        const timestamp = new Date().toISOString();
        return `[${timestamp}] [${level}] ${message}`;
    }

    public debug(message: string, ...args: any[]): void {
        if (this.shouldLog(LogLevel.DEBUG)) {
            console.debug(this.formatMessage(LogLevel.DEBUG, message), ...args);
        }
    }

    public info(message: string, ...args: any[]): void {
        if (this.shouldLog(LogLevel.INFO)) {
            console.info(this.formatMessage(LogLevel.INFO, message), ...args);
        }
    }

    public warn(message: string, ...args: any[]): void {
        if (this.shouldLog(LogLevel.WARN)) {
            console.warn(this.formatMessage(LogLevel.WARN, message), ...args);
        }
    }

    public error(message: string, ...args: any[]): void {
        if (this.shouldLog(LogLevel.ERROR)) {
            console.error(this.formatMessage(LogLevel.ERROR, message), ...args);
        }
    }
}

export { LoggerService, LogLevel };
export default new LoggerService(); 