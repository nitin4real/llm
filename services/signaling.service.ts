import AgoraRTM, { LoginResponse, LogoutResponse, RTMClient } from 'rtm-nodejs';

const { RTM } = AgoraRTM;

class SignalingConnection {
    private rtmClient: RTMClient;
    private channelName: string;
    private uid: number;
    private token: string;

    constructor(appId: string, uid: number, token: string, channelName: string) {
        this.rtmClient = new RTM(appId, uid.toString());
        this.channelName = channelName;
        this.uid = uid;
        this.token = token;
    }

    async connect(): Promise<LoginResponse> {
        return await this.rtmClient.login()
    }

    // async joinChannel(): Promise<SubscribeResponse> {
    //     return await this.rtmClient.subscribe(this.channelName);
    // }

    async leaveChannel(): Promise<LogoutResponse> {
        return await this.rtmClient.logout();
    }

    async sendMessage(message: string): Promise<any> {
        const payload = { type: "text", message: message };
        const publishMessage = JSON.stringify(payload);
        try {
            const result = await this.rtmClient.publish(this.channelName, publishMessage);
            console.log(result);
        } catch (status) {
            console.log(status);
        }
    }

    async onMessage(callback: (message: string) => void) {
        this.rtmClient.on('message', (message) => {
            callback(message.text);
        });
    }

    async disconnect() {
        await this.rtmClient.logout();
    }
}

export default SignalingConnection;