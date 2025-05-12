import { config } from "../config/config";
import { ChatMessage, LLMResponse, LLMService } from "./llm.service";
import UserSessionService, { UserSession } from "./UserSessionService";
import { listOfImagesWithConcepts } from '../db/businessDb'
import loggerService from "./logger.service";
import { ChatCompletionTool } from "openai/resources/chat/completions";
class ChatService {
    // make this class singleton
    private static instance: ChatService;
    private userSessionService: UserSessionService;
    private llmService: LLMService;
    private constructor() {
        // private constructor
        this.userSessionService = UserSessionService.getInstance();
        this.llmService = new LLMService(config.openai.apiKey || '');
    }

    getUserFunctions = (userId: number): ChatCompletionTool[] => {
        return [{
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
        }, {
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
                        },
                    },
                    required: ["speechToUser"]
                }
            }
        }, {
            type: "function",
            function: {
                name: "show_image",
                description: "This function will show a image to the user and tell you the metadata about the image. You can then use this image to explain the concept to the user.",
                parameters: {
                    type: "object",
                    properties: {
                        conceptName: {
                            type: "string",
                            enum: Object.keys(listOfImagesWithConcepts),
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
        }];
    }


    handleChatCompletion = async (userId: number, messages: ChatMessage[]) => {
        const userSession = this.getUserSession(userId);
        if (!userSession) {
            throw new Error("User session not found");
        }
        const userFunctions = this.getUserFunctions(userId)
        const lastMessage = messages[messages.length - 1];
        const chatHistory = userSession.chatHistory;
        const updatedMessages = [...chatHistory, lastMessage];
        const response = await this.llmService.chat(updatedMessages, {}, userFunctions);

        const { content, function_calls, finish_reason } = response;
        const formatedResponse: LLMResponse = { role: "assistant", content, finish_reason };
        const functionDetails = function_calls?.[0];

        updatedMessages.push({
            role: "assistant",
            content: response.content,
            function_call: functionDetails ? [functionDetails] : []
        })

        if (functionDetails) {
            const functionName = functionDetails.name;
            const functionArguments = JSON.parse(functionDetails.arguments);
            formatedResponse.content = functionArguments.speechToUser;
            await this.callFunction(functionName, functionArguments, updatedMessages, functionDetails.tool_call_id);
        }
        this.userSessionService.updateUserActivity(userId, { chatHistory: updatedMessages });
        return formatedResponse;
    }

    callFunction = async (functionName: string, functionArguments: any, messages: ChatMessage[], toolId: string) => {
        if (functionName === "show_question") {
            messages.push({
                role: "tool",
                content: "Sent To the user",
                tool_call_id: toolId
            })
        } else if (functionName === "talkToUser") {
            messages.push({
                role: "tool",
                content: "Sent To the user",
                tool_call_id: toolId
            })
        } else if (functionName === 'show_image') {
            const imageData = this.getImageByConceptName(functionArguments.conceptName)
            messages.push({
                role: "tool",
                content: `The image shown to user is of ->  ${imageData.description}`,
                tool_call_id: toolId
            })
        }
    }

    sendDataToUser = (userId: number, data: any) => {
        const userSession = this.getUserSession(userId);
        if (!userSession) {
            throw new Error("User session not found");
        }
        loggerService.info("TODO: Sending data to user", data)
        // userSession.signalingConnection.sendMessage(data);
    }


    getImageByConceptName = (conceptName: keyof typeof listOfImagesWithConcepts) => {
        const imageData: any = listOfImagesWithConcepts[conceptName]
        return imageData
    }

    public static getInstance(): ChatService {
        if (!ChatService.instance) {
            ChatService.instance = new ChatService();
        }
        return ChatService.instance;
    }

    public getUserSession(userId: number): UserSession | undefined {
        // get the user session from the database
        const userSession = this.userSessionService.getUserSession(userId);
        if (!userSession) {
            throw new Error("User session not found");
        }
        return userSession;
    }
}

const chatService = ChatService.getInstance();

export default chatService;