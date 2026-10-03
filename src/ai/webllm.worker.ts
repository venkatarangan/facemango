import { WebWorkerMLCEngineHandler } from '@mlc-ai/web-llm';

// Runs the model off the main thread so the UI never blocks (CLAUDE.md engineering rules).
const handler = new WebWorkerMLCEngineHandler();
self.onmessage = (message: MessageEvent) => handler.onmessage(message);
