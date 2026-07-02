import type { DehleroRequest } from "./DehleroRequest.js";
import type { DehleroResponse } from "./DehleroResponse.js";

export class DehleroRpcClient {

  constructor(
    private readonly endpoint = "http://localhost:4010",
  ) {}

  async send(
    request: DehleroRequest,
  ): Promise<DehleroResponse> {

    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    return await response.json();
  }

}