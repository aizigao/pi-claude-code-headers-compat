# pi-claude-code-headers-compat

[简体中文](./README-CN.md) | [English](./README.md)

[![npm version](https://img.shields.io/npm/v/%40aizigao%2Fpi-claude-code-headers-compat.svg)](https://www.npmjs.com/package/@aizigao/pi-claude-code-headers-compat)

The requests sent by Pi with `"api": "anthropic-messages"` use the SDK format, which is not exactly the same as the requests sent by Claude Code. The specific problem I am facing is that my proxy provider is currently blocked by Cloudflare as crawler traffic. The purpose of this package is to make the request `headers` look broadly closer to what Claude Code sends.

The goal of this plugin is not to change the structure of `models.json`, but to add an extra compatibility layer while keeping Pi's original provider configuration style.

## Who this is for

This package is suitable for users who:
- already configured custom providers in Pi
- use Claude-compatible proxy/provider endpoints
- run into incompatible headers, incompatible paths, or unexpected API responses
- want to handle these compatibility rules through a standalone package
- get `403` responses from the proxy provider

## What it does

When enabled, the package will:
- read configured providers from the official `~/.pi/agent/models.json`
- read compatibility settings from `~/.pi/agent/claude-code-headers-compat.json`
- only apply compatibility handling to matched provider requests
- automatically rewrite request paths and adjust headers before sending the request

## Installation

Install it in Pi with:

```bash
pi install npm:@aizigao/pi-claude-code-headers-compat
```

If you are developing this project locally, use:

```bash
npm install
```

## Configuration

### 1. Configure the provider

Using my current proxy provider [aicoding.sh](https://aicoding.sh/i/kD8yO7) as an example: when used in Pi, Cloudflare treats the request as crawler traffic because of the headers and returns `403`. My configuration is:

File: `~/.pi/agent/models.json`.
Keep using Pi's default format for this file. No structure changes are needed.

```json
{
  "providers": {
    "aicoding-sh-anthropic": {
      "baseUrl": "https://api.aicoding.sh",
      "api": "anthropic-messages",
      "apiKey": "AI_CODING_SH_API_KEY",
      "models": [
        {
          "id": "claude-sonnet-4-6",
          "name": "azg-claude-sonnet-4-6",
          "reasoning": true,
          "input": ["text", "image"],
          "cost": {
            "input": 3,
            "output": 15,
            "cacheRead": 0.3,
            "cacheWrite": 3.75
          },
          "contextWindow": 1000000,
          "maxTokens": 128000
        },
        {
          "id": "claude-opus-4-7",
          "name": "azg-claude-opus-4-7",
          "reasoning": true,
          "input": ["text", "image"],
          "cost": {
            "input": 15,
            "output": 75,
            "cacheRead": 1.5,
            "cacheWrite": 18.75
          },
          "contextWindow": 1000000,
          "maxTokens": 128000
        },
        {
          "id": "gpt-5.5",
          "name": "azg-gpt-5.5",
          "reasoning": true,
          "input": ["text", "image"],
          "cost": {
            "input": 5,
            "output": 30,
            "cacheRead": 0.5,
            "cacheWrite": 6.25
          },
          "contextWindow": 1000000,
          "maxTokens": 128000
        },
        {
          "id": "gpt-5.4",
          "name": "azg-gpt-5.4",
          "reasoning": true,
          "input": ["text", "image"],
          "cost": {
            "input": 2.5,
            "output": 15,
            "cacheRead": 0.25,
            "cacheWrite": 3.125
          },
          "contextWindow": 1000000,
          "maxTokens": 128000
        },
        {
          "id": "gpt-5.3-codex",
          "name": "azg-gpt-5.3-codex",
          "reasoning": true,
          "input": ["text", "image"],
          "cost": {
            "input": 1.75,
            "output": 14,
            "cacheRead": 0.175,
            "cacheWrite": 2.1875
          },
          "contextWindow": 1000000,
          "maxTokens": 128000
        }
      ]
    }
  }
}
```

Notes:
- the key under `providers` is the provider name
- `apiKey` follows the same rule as the official config: it can be an environment variable name or a literal API key
- the plugin matches compatibility logic using the provider name and `baseUrl`

### 2. Configure compatibility rules

File: `~/.pi/agent/claude-code-headers-compat.json`

Your current configuration example:

```json
{
  "enable": true,
  "matchedProvidersUrl": ["aicoding-sh-anthropic"],
  "modifyHeaders": {
    "USER_AGENT": "2.1.110 (Claude Code)",
    "ANTHROPIC_VERSION": "2023-06-01"
  }
}
```

Field reference:

#### `enable`

Whether to enable it.

#### `matchedProvidersUrl`
The list of provider names that should use compatibility handling. Configure it as needed.

Requirements:
- the names must match the provider keys in `models.json`
- only providers listed here will get compatibility handling

#### `modifyHeaders`
Used to override default header values.

Currently supported:
- `USER_AGENT`
- `ANTHROPIC_VERSION`
- `ACCEPT`
- `CONTENT_TYPE`
- `AUTHORIZATION`

Notes:
- if a field is omitted, it falls back to the default value
- `AUTHORIZATION` defaults to `Bearer ${API_KEY}`
- `${API_KEY}` will be replaced with the final resolved key value for that provider
- if `apiKey` is an environment variable name, the environment value is used
- if `apiKey` is a literal value, the literal value is used directly

## Usage

After configuration:
1. make sure the provider is already defined in `models.json`
2. make sure that provider is enabled in `claude-code-headers-compat.json`
3. start Pi
4. when that provider sends requests, the plugin will automatically apply the compatibility handling

## Notes

- provider names in `matchedProvidersUrl` must stay consistent with `models.json`
- `apiKey` in `models.json` can be either an environment variable name or a literal key
- this package is currently aimed at Claude-compatible provider scenarios
- if a provider does not match, requests will not be rewritten
