// Common types for multi-provider article generation layer.
import type { GeneratedArticle } from "../types";

export interface ArticleGenerationParams {
  apiKey: string;
  systemPrompt: string;
  userPrompt: string;
  model?: string;
  maxTokens?: number;
}

export interface ProviderCallSuccess {
  success: true;
  article: GeneratedArticle;
  provider: string;
  model: string;
  latencyMs?: number;
}

export interface ProviderCallError {
  success: false;
  message: string;
  provider: string;
  model: string;
}

export type ProviderCallResult = ProviderCallSuccess | ProviderCallError;

export interface TestConnectionResult {
  success: boolean;
  message: string;
  provider: string;
  model: string;
  latencyMs?: number;
}
