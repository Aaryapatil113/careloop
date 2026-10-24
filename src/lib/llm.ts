import Anthropic from "@anthropic-ai/sdk";

export const MODEL = "claude-opus-5-5";

/**
 * Live mode needs ANTHROPIC_API_KEY. Without it (or with CARELOOP_MODE=demo)
 * the app runs a deterministic, retrieval-grounded responder so the hosted
 * demo costs nothing and every pipeline stage still runs and is traced.
 */
export function isLive(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY) && process.env.CARELOOP_MODE !== "demo";
}

let client: Anthropic | undefined;
export function anthropic(): Anthropic {
  return (client ??= new Anthropic());
}
