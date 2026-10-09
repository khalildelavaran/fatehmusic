// Unified Multi-Provider Orchestrator for AI Article Generation.
// Supports Google Gemini (Default), Anthropic Claude, and OpenAI.
// Enforces security: never exposes raw keys to client, handles fallback and retries.

import type { AiProvider } from "../types";
import type { ProviderCallResult, TestConnectionResult } from "./types";
import { callGeminiArticle, testGeminiConnection } from "./gemini";
import { callAnthropicArticle, testAnthropicConnection } from "./anthropic";
import { callOpenAIArticle, testOpenAIConnection } from "./openai";
import { DEFAULT_PROVIDER, DEFAULT_MODELS, isValidProvider, isValidModelForProvider, getDefaultModelForProvider } from "./models";

export interface ProviderEnv {
  GEMINI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  OPENAI_API_KEY?: string;
  [key: string]: unknown;
}

export interface MultiProviderGenerateOptions {
  provider?: AiProvider;
  model?: string;
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  env: ProviderEnv;
}

export function resolveApiKeyForProvider(provider: AiProvider, env: ProviderEnv): string {
  if (provider === "gemini") {
    return String(env.GEMINI_API_KEY || (typeof process !== "undefined" ? process.env?.GEMINI_API_KEY : "") || "").trim();
  }
  if (provider === "claude") {
    return String(env.ANTHROPIC_API_KEY || (typeof process !== "undefined" ? process.env?.ANTHROPIC_API_KEY : "") || "").trim();
  }
  if (provider === "openai") {
    return String(env.OPENAI_API_KEY || (typeof process !== "undefined" ? process.env?.OPENAI_API_KEY : "") || "").trim();
  }
  return "";
}

export function getProviderKeyStatus(env: ProviderEnv): Record<AiProvider, boolean> {
  return {
    gemini: Boolean(resolveApiKeyForProvider("gemini", env)),
    claude: Boolean(resolveApiKeyForProvider("claude", env)),
    openai: Boolean(resolveApiKeyForProvider("openai", env))
  };
}

export async function generateArticleWithProvider(options: MultiProviderGenerateOptions): Promise<ProviderCallResult> {
  const provider: AiProvider = isValidProvider(options.provider) ? options.provider : DEFAULT_PROVIDER;
  const model = options.model && isValidModelForProvider(provider, options.model)
    ? options.model
    : getDefaultModelForProvider(provider);

  const apiKey = resolveApiKeyForProvider(provider, options.env);

  if (!apiKey) {
    const keyNames: Record<AiProvider, string> = {
      gemini: "GEMINI_API_KEY",
      claude: "ANTHROPIC_API_KEY",
      openai: "OPENAI_API_KEY"
    };
    return {
      success: false,
      provider,
      model,
      message: `کلید ${keyNames[provider]} برای ارائه‌دهنده ${provider} تنظیم نشده است. لطفاً آن را در متغیرهای سرور اضافه کنید.`
    };
  }

  const params = {
    apiKey,
    systemPrompt: options.systemPrompt,
    userPrompt: options.userPrompt,
    model,
    maxTokens: options.maxTokens
  };

  switch (provider) {
    case "gemini":
      return callGeminiArticle(params);
    case "claude":
      return callAnthropicArticle(params);
    case "openai":
      return callOpenAIArticle(params);
    default:
      return callGeminiArticle(params);
  }
}

export async function testProviderConnectionWithEnv(
  provider: AiProvider,
  model: string | undefined,
  env: ProviderEnv
): Promise<TestConnectionResult> {
  const targetProvider = isValidProvider(provider) ? provider : DEFAULT_PROVIDER;
  const targetModel = model && isValidModelForProvider(targetProvider, model)
    ? model
    : getDefaultModelForProvider(targetProvider);

  const apiKey = resolveApiKeyForProvider(targetProvider, env);

  switch (targetProvider) {
    case "gemini":
      return testGeminiConnection(apiKey, targetModel);
    case "claude":
      return testAnthropicConnection(apiKey, targetModel);
    case "openai":
      return testOpenAIConnection(apiKey, targetModel);
    default:
      return testGeminiConnection(apiKey, targetModel);
  }
}
