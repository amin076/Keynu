export type BrowserEvent =
  | {
      type: "conversation.opened";
      url: string;
      createdAt: string;
    }
  | {
      type: "conversation.error";
      message: string;
      createdAt: string;
    }
  | {
      type: "message.detected";
      text: string;
      createdAt: string;
    };
