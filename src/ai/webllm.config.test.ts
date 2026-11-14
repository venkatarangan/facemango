import { describe, expect, it } from 'vitest';
import { appConfig } from './webllm';

describe('WebLLM app config', () => {
  it('has a bundled model library for every model we offer', () => {
    // Throws "Model library not bundled" when a web-llm upgrade renames a library file.
    const config = appConfig('https://example.test');
    expect(config.model_list.length).toBe(4);
    for (const record of config.model_list) {
      expect(record.model_lib).toMatch(/^https:\/\/example\.test\/models\/.+\.wasm$/);
    }
  });
});
