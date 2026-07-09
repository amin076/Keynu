export type BrowserConfig = {
  headless: boolean;
  userDataDir: string;
  defaultUrl: string;
  dedicatedConversationUrl?: string;
};

export const defaultBrowserConfig: BrowserConfig = {
  headless: false,
  userDataDir: "runtime-data/browser-profile",
  defaultUrl: "https://chatgpt.com",
};
