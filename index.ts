import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI, ProviderConfig, ProviderModelConfig } from "@earendil-works/pi-coding-agent";
import { registerFetchMiddleware } from "@aizigao/pi-fetch-pipeline";

declare const process:
  | {
      env?: Record<string, string | undefined>;
    }
  | undefined;

type JsonProviderConfig = Pick<ProviderConfig, "name" | "baseUrl" | "apiKey" | "api" | "headers"> & {
  models: ProviderModelConfig[];
};

type ModelsConfig = {
  providers?: Record<string, JsonProviderConfig>;
};

type CompatProviderOverride = {
  match?: {
    host?: string;
    markerHeader?: string;
    markerValue?: string;
  };
  rewrite?: Record<string, string>;
  removeHeaders?: string[];
  setHeaders?: Record<string, string>;
};

type LegacyModifyHeaders = {
  USER_AGENT?: string;
  ANTHROPIC_VERSION?: string;
  ACCEPT?: string;
  CONTENT_TYPE?: string;
  AUTHORIZATION?: string;
};

type CompatConfig = {
  enable?: boolean;
  matchedProviders?: string[];
  matchedProvidersUrl?: string[];
  modifyHeaders?: LegacyModifyHeaders;
  providers?: Record<string, CompatProviderOverride>;
};

type ResolvedProviderCompat = {
  providerName: string;
  apiKeyValue: string;
  host: string;
  markerHeader: string;
  markerValue: string;
  rewrite: Record<string, string>;
  removeHeaders: string[];
  setHeaders: Record<string, string>;
};

const DEFAULT_MARKER_HEADER = "x-pi-provider-marker";
const DEFAULT_REMOVE_HEADERS = [
  "x-api-key",
  "anthropic-dangerous-direct-browser-access",
  "accept-language",
  "x-app",
  DEFAULT_MARKER_HEADER,
  "x-stainless-*",
  "sec-fetch-*",
];
const DEFAULT_SET_HEADERS = {
  authorization: "Bearer ${API_KEY}",
  "user-agent": "2.1.110 (Claude Code)",
  "anthropic-version": "2023-06-01",
  accept: "application/json",
  "content-type": "application/json",
};
const DEFAULT_REWRITE = {
  "/messages": "/v1/messages",
};

function getAgentDir(): string {
  return process?.env?.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi", "agent");
}

function getModelsConfigPath(): string {
  return join(getAgentDir(), "models.json");
}

function getCompatConfigPath(): string {
  return join(getAgentDir(), "claude-code-headers-compat.json");
}

function readJsonFile<T>(path: string): T | null {
  if (!existsSync(path)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return null;
  }
}

function readModelsConfig(): ModelsConfig | null {
  return readJsonFile<ModelsConfig>(getModelsConfigPath());
}

function readCompatConfig(): CompatConfig | null {
  return readJsonFile<CompatConfig>(getCompatConfigPath());
}

function getBaseUrlHost(baseUrl: string | undefined): string | null {
  if (!baseUrl) {
    return null;
  }

  try {
    return new URL(baseUrl).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function getLegacySetHeaders(modifyHeaders: LegacyModifyHeaders | undefined): Record<string, string> {
  return {
    authorization: modifyHeaders?.AUTHORIZATION ?? DEFAULT_SET_HEADERS.authorization,
    "user-agent": modifyHeaders?.USER_AGENT ?? DEFAULT_SET_HEADERS["user-agent"],
    "anthropic-version": modifyHeaders?.ANTHROPIC_VERSION ?? DEFAULT_SET_HEADERS["anthropic-version"],
    accept: modifyHeaders?.ACCEPT ?? DEFAULT_SET_HEADERS.accept,
    "content-type": modifyHeaders?.CONTENT_TYPE ?? DEFAULT_SET_HEADERS["content-type"],
  };
}

function resolveEnvironmentValue(input: string): string | null {
  const env = process?.env ?? {};
  let output = "";

  for (let index = 0; index < input.length; ) {
    const char = input[index];
    if (char !== "$") {
      output += char;
      index += 1;
      continue;
    }

    const nextChar = input[index + 1];
    if (nextChar === "$" || nextChar === "!") {
      output += nextChar;
      index += 2;
      continue;
    }

    if (nextChar === "{") {
      const closingIndex = input.indexOf("}", index + 2);
      if (closingIndex === -1) {
        output += char;
        index += 1;
        continue;
      }

      const envName = input.slice(index + 2, closingIndex);
      const envValue = env[envName];
      if (envValue == null) {
        return null;
      }

      output += envValue;
      index = closingIndex + 1;
      continue;
    }

    const match = input.slice(index + 1).match(/^[A-Za-z_][A-Za-z0-9_]*/);
    if (!match) {
      output += char;
      index += 1;
      continue;
    }

    const envName = match[0];
    const envValue = env[envName];
    if (envValue == null) {
      return null;
    }

    output += envValue;
    index += 1 + envName.length;
  }

  return output;
}

function resolveCommandValue(command: string): string | null {
  try {
    return execSync(command, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

function usesValueResolutionSyntax(value: string): boolean {
  return value.startsWith("!") || value.includes("$");
}

function resolveApiKeyValue(apiKey: string | undefined): string | null {
  if (!apiKey) {
    return null;
  }

  if (apiKey.startsWith("!")) {
    return resolveCommandValue(apiKey.slice(1));
  }

  if (usesValueResolutionSyntax(apiKey)) {
    return resolveEnvironmentValue(apiKey);
  }

  return process?.env?.[apiKey] ?? apiKey;
}

function resolveProviderCompat(
  providerName: string,
  providerConfig: JsonProviderConfig,
  override: CompatProviderOverride | undefined,
  legacyHeaders: LegacyModifyHeaders | undefined,
): ResolvedProviderCompat | null {
  const apiKeyValue = resolveApiKeyValue(providerConfig.apiKey);
  const host = override?.match?.host?.toLowerCase() ?? getBaseUrlHost(providerConfig.baseUrl);

  if (!apiKeyValue || !host) {
    return null;
  }

  return {
    providerName,
    apiKeyValue,
    host,
    markerHeader: override?.match?.markerHeader?.toLowerCase() ?? DEFAULT_MARKER_HEADER,
    markerValue: override?.match?.markerValue ?? providerName,
    rewrite: override?.rewrite ?? DEFAULT_REWRITE,
    removeHeaders: override?.removeHeaders ?? DEFAULT_REMOVE_HEADERS,
    setHeaders: override?.setHeaders ?? getLegacySetHeaders(legacyHeaders),
  };
}

function getCompatProviders(): ResolvedProviderCompat[] {
  const modelsConfig = readModelsConfig();
  const compatConfig = readCompatConfig();
  const compatProviders = compatConfig?.providers;
  const modelProviders = modelsConfig?.providers;

  if (!modelProviders || !compatConfig?.enable) {
    return [];
  }

  const providers: ResolvedProviderCompat[] = [];

  if (compatProviders && Object.keys(compatProviders).length > 0) {
    for (const [providerName, override] of Object.entries(compatProviders)) {
      const providerConfig = modelProviders[providerName];
      if (!providerConfig) {
        continue;
      }

      const resolved = resolveProviderCompat(providerName, providerConfig, override, compatConfig.modifyHeaders);
      if (resolved) {
        providers.push(resolved);
      }
    }

    return providers;
  }

  const matchedProviders = compatConfig.matchedProviders ?? compatConfig.matchedProvidersUrl ?? [];
  for (const providerName of matchedProviders) {
    const providerConfig = modelProviders[providerName];
    if (!providerConfig) {
      continue;
    }

    const resolved = resolveProviderCompat(providerName, providerConfig, undefined, compatConfig.modifyHeaders);
    if (resolved) {
      providers.push(resolved);
    }
  }

  return providers;
}

function urlOf(input: unknown): string | undefined {
  if (typeof input === "string") {
    return input;
  }

  if (input instanceof URL) {
    return input.toString();
  }

  if (input instanceof Request) {
    return input.url;
  }

  return undefined;
}

function readHeaderValue(headersSource: HeadersInit | undefined, name: string): string | null {
  if (!headersSource) {
    return null;
  }

  return new Headers(headersSource).get(name);
}

function getRequestMarker(input: unknown, init: RequestInit | undefined, markerHeader: string): string | null {
  const initMarker = readHeaderValue(init?.headers, markerHeader);
  if (initMarker) {
    return initMarker;
  }

  if (input instanceof Request) {
    return input.headers.get(markerHeader);
  }

  return null;
}

function getMatchedCompat(input: unknown, init: RequestInit | undefined): ResolvedProviderCompat | null {
  const url = urlOf(input);
  if (!url) {
    return null;
  }

  try {
    const hostname = new URL(url).hostname.toLowerCase();
    for (const provider of getCompatProviders()) {
      if (provider.host !== hostname) {
        continue;
      }

      const markerValue = getRequestMarker(input, init, provider.markerHeader);
      if (markerValue === provider.markerValue) {
        return provider;
      }
    }
  } catch {
    return null;
  }

  return null;
}

function shouldRemoveHeader(headerName: string, patterns: string[]): boolean {
  const normalizedHeader = headerName.toLowerCase();

  for (const pattern of patterns) {
    const normalizedPattern = pattern.toLowerCase();
    if (normalizedPattern.endsWith("*")) {
      const prefix = normalizedPattern.slice(0, -1);
      if (normalizedHeader.startsWith(prefix)) {
        return true;
      }
      continue;
    }

    if (normalizedHeader === normalizedPattern) {
      return true;
    }
  }

  return false;
}

function copyHeaders(target: Headers, source: HeadersInit | undefined): void {
  if (!source) {
    return;
  }

  const headers = new Headers(source);
  headers.forEach((value, key) => {
    target.set(key, value);
  });
}

function rewriteInputUrl(input: RequestInfo | URL, rewrite: Record<string, string>): RequestInfo | URL {
  const url = urlOf(input);
  if (!url) {
    return input;
  }

  try {
    const nextUrl = new URL(url);
    const nextPath = rewrite[nextUrl.pathname];
    if (!nextPath) {
      return input;
    }

    nextUrl.pathname = nextPath;

    if (typeof input === "string") {
      return nextUrl.toString();
    }

    if (input instanceof URL) {
      return nextUrl;
    }

    if (input instanceof Request) {
      return new Request(nextUrl.toString(), input);
    }
  } catch {
    return input;
  }

  return input;
}

function applyHeaderTemplates(headers: Record<string, string>, provider: ResolvedProviderCompat): Record<string, string> {
  const applied: Record<string, string> = {};

  for (const [key, value] of Object.entries(headers)) {
    applied[key] = value.replaceAll("${API_KEY}", provider.apiKeyValue);
  }

  return applied;
}

function registerCompatFetchMiddleware(): void {
  registerFetchMiddleware({
    name: "pi-claude-code-headers-compat",
    priority: 10,
    middleware: async ({ input, init, next }) => {
      const provider = getMatchedCompat(input, init);
      if (!provider) {
        return next(input, init);
      }

      const rewrittenInput = rewriteInputUrl(input, provider.rewrite);
      const headers = new Headers();

      if (rewrittenInput instanceof Request) {
        copyHeaders(headers, rewrittenInput.headers);
      }
      copyHeaders(headers, init?.headers);

      for (const key of [...headers.keys()]) {
        if (shouldRemoveHeader(key, provider.removeHeaders)) {
          headers.delete(key);
        }
      }

      const nextHeaders = applyHeaderTemplates(provider.setHeaders, provider);
      for (const [key, value] of Object.entries(nextHeaders)) {
        headers.set(key, value);
      }

      return next(rewrittenInput, { ...init, headers });
    },
  });
}

function registerCompatProviders(pi: ExtensionAPI): void {
  const modelsConfig = readModelsConfig();
  const compatProviders = getCompatProviders();
  const modelProviders = modelsConfig?.providers;

  if (!modelProviders) {
    return;
  }

  for (const provider of compatProviders) {
    const providerConfig = modelProviders[provider.providerName];
    if (!providerConfig) {
      continue;
    }

    const providerHeaders = {
      ...providerConfig.headers,
      [provider.markerHeader]: provider.markerValue,
    };

    const models = providerConfig.models.map((model) => ({
      ...model,
      headers: {
        ...model.headers,
        [provider.markerHeader]: provider.markerValue,
      },
    }));

    pi.registerProvider(provider.providerName, {
      name: providerConfig.name ?? provider.providerName,
      baseUrl: providerConfig.baseUrl,
      apiKey: providerConfig.apiKey,
      api: providerConfig.api,
      authHeader: true,
      headers: providerHeaders,
      models,
    });
  }
}

export default function (pi: ExtensionAPI) {
  registerCompatProviders(pi);
  registerCompatFetchMiddleware();
}
