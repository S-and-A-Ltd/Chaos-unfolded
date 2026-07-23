import type { AIMessage } from '@/types';

// Using OpenRouter since the provided key is an OpenRouter key (sk-or-...)
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'nvidia/llama-3.1-nemotron-70b-instruct'; // Default Nemotron on OpenRouter

export async function callNemotron(
  messages: AIMessage[],
  apiKey: string,
  options: {
    temperature?: number;
    responseFormat?: 'json_object';
    model?: string;
  } = {}
): Promise<string> {
  const { temperature = 0.7, responseFormat, model = DEFAULT_MODEL } = options;

  const body: any = {
    model,
    messages,
    temperature,
  };

  if (responseFormat === 'json_object') {
    body.response_format = { type: 'json_object' };
  }

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'http://localhost:3000', // Required by OpenRouter
      'X-Title': 'Dazai Study Companion', // Required by OpenRouter
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('Nemotron API Error:', errorData);
    throw new Error(`Nemotron API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}
