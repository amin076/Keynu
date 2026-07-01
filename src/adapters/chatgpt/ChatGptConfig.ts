export type ChatGptConfig = {
  conversationUrl: string;
  generationStableMs: number;
};

export const defaultChatGptConfig: ChatGptConfig = {
  conversationUrl: "https://chatgpt.com",
  generationStableMs: 1500,
};