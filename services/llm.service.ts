import OpenAI from 'openai';
import {
    ChatCompletionCreateParams,
    ChatCompletionMessageParam,
    ChatCompletion,
    ChatCompletionTool
} from 'openai/resources/chat/completions';
import { Stream } from 'openai/streaming';


export interface LLMConfig {
    model: string;
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    frequency_penalty?: number;
    presence_penalty?: number;
}

export interface FunctionCall {
    name: string;
    arguments: string;
    tool_call_id: string
}

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string | null;
    name?: string;
    function_call?: FunctionCall[];
    tool_call_id?: string;
}

export interface LLMResponse {
    role: "assistant";
    content: string;
    function_calls?: FunctionCall[];
    finish_reason: string;
}

export class LLMService {
    private openai: OpenAI;
    private defaultConfig: LLMConfig;

    constructor(apiKey: string, defaultConfig: Partial<LLMConfig> = {}) {
        this.openai = new OpenAI({ apiKey });
        this.defaultConfig = {
            model: 'gpt-4o-mini',
            temperature: 0.7,
            max_tokens: 1000,
            top_p: 1,
            frequency_penalty: 0,
            presence_penalty: 0,
            ...defaultConfig,
        };
    }

    private formatMessages(messages: ChatMessage[]): ChatCompletionMessageParam[] {
        return messages.map(msg => {
            const baseMessage = {
                role: msg.role,
                content: msg.content,
            };
            return baseMessage as ChatCompletionMessageParam;
        });
    }

    async chat(
        messages: ChatMessage[],
        config: Partial<LLMConfig> = {},
        functions?: ChatCompletionTool[],
        stream: boolean = false
    ): Promise<LLMResponse> {
        const finalConfig = { ...this.defaultConfig, ...config };

        const params: ChatCompletionCreateParams = {
            model: finalConfig.model,
            messages: this.formatMessages(messages),
            temperature: finalConfig.temperature,
            max_tokens: finalConfig.max_tokens,
            top_p: finalConfig.top_p,
            frequency_penalty: finalConfig.frequency_penalty,
            presence_penalty: finalConfig.presence_penalty,
            stream,
        };

        if (functions) {
            params.tools = functions;
            params.tool_choice = 'required';
        }

        try {
            if (false) { // (stream) also add the return type Stream<ChatCompletionChunk> -> Promise<LLMResponse | Stream<ChatCompletionChunk>>
                // const response = await this.openai.chat.completions.create(params);
                // return response as unknown as Stream<ChatCompletionChunk>;
            } else {
                const response = await this.openai.chat.completions.create(params) as ChatCompletion;
                const choice = response.choices[0];

                return {
                    role: "assistant",
                    content: choice.message.content || '',
                    function_calls: choice.message.tool_calls ? [{
                        name: choice.message.tool_calls[0].function.name,
                        arguments: choice.message.tool_calls[0].function.arguments,
                        tool_call_id: choice.message.tool_calls[0].id
                    }] : undefined,
                    finish_reason: choice.finish_reason || 'stop',
                };
            }
        } catch (error) {
            console.error('Error in LLM service:', error);
            throw error;
        }
    }

    async handleStream( // test this later for stream response of tool call
        stream: Stream<OpenAI.Chat.Completions.ChatCompletionChunk>,
        onChunk: (chunk: string) => void,
        onFunctionCall?: (functionCall: FunctionCall) => void
    ): Promise<LLMResponse> {
        let content = '';
        let functionCall: FunctionCall | undefined;

        try {
            for await (const chunk of stream) {
                const delta = chunk.choices[0]?.delta;

                if (delta?.content) {
                    content += delta.content;
                    onChunk(delta.content);
                }

                if (delta?.tool_calls) {
                    if (!functionCall) {
                        functionCall = {
                            name: delta?.tool_calls[0]?.function?.name || '',
                            arguments: delta?.tool_calls[0]?.function?.arguments || '',
                            tool_call_id: delta?.tool_calls[0]?.id || ''
                        };
                    } else {
                        functionCall.arguments += delta?.tool_calls[0]?.function?.arguments || '';
                    }

                    if (onFunctionCall && delta?.tool_calls[0]?.function?.name) {
                        onFunctionCall(functionCall);
                    }
                }
            }

            return {
                role: "assistant",
                content,
                function_calls: functionCall ? [functionCall] : undefined,
                finish_reason: 'stop',
            };
        } catch (error) {
            console.error('Error handling stream:', error);
            throw error;
        }
    }
}
