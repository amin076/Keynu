import WebSocket from "ws";
import type { RpcMessage } from "./RpcMessage.js";
import type { RpcResponse } from "./RpcResponse.js";

export class DehleroSocketClient {

  private socket?: WebSocket;

  constructor(
    private readonly url = "ws://127.0.0.1:4010"
  ) {}

  async connect(): Promise<void> {

    if (this.socket?.readyState === WebSocket.OPEN) {
      return;
    }

    this.socket = new WebSocket(this.url);

    await new Promise<void>((resolve, reject) => {

      this.socket!.once("open", () => resolve());

      this.socket!.once("error", reject);

    });

  }

  async send(
    message: RpcMessage,
  ): Promise<RpcResponse> {

    await this.connect();

    return new Promise<RpcResponse>((resolve, reject) => {

      this.socket!.once("message", (data) => {

        try {

          resolve(
            JSON.parse(
              data.toString(),
            ),
          );

        } catch (err) {

          reject(err);

        }

      });

      this.socket!.send(
        JSON.stringify(message),
      );

    });

  }

}