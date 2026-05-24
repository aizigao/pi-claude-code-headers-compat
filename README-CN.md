# pi-claude-code-headers-compat

[简体中文](./README-CN.md) | [English](./README.md)

[![npm version](https://img.shields.io/npm/v/%40aizigao%2Fpi-claude-code-headers-compat.svg)](https://www.npmjs.com/package/@aizigao/pi-claude-code-headers-compat)

Pi 当前用的 `"api": "anthropic-messages"` 用的 sdk 发出的请求和 Claude code 是不太一样的，我现在遇到的特殊问题就是我用的中转站被 Cloudflare 当前爬虫拦截了， 这个包的作用就是把 `headers` 改为和 `Claude code` 发出的大体一样

这个插件的目标不是改 `models.json` 的结构，而是在保留 Pi 原有 provider 配置方式的前提下，额外补一层兼容处理。

## 适合谁

适合下面这类用户：
- 已经在 Pi 里配置了自定义 provider
- 使用的是 Claude 兼容代理接口
- 遇到请求头不兼容、路径不兼容、接口返回异常的问题
- 希望通过一个独立插件统一处理这些兼容逻辑
- 中转站返回 403

## 它做什么

启用后，插件会：
- 读取官方 `~/.pi/agent/models.json` 中已配置的 provider
- 读取 `~/.pi/agent/claude-code-headers-compat.json` 中的兼容配置
- 仅对命中的 provider 请求做兼容处理
- 在发请求前自动完成路径改写和请求头调整

## 安装

在 Pi 中安装：

```bash
pi install npm:@aizigao/pi-claude-code-headers-compat
```

如果你是在本地开发这个项目，再使用：

```bash
npm install
```


## 配置方式

### 1. 配置 provider

以我的当前的用的中转站 [aicoding.sh](https://aicoding.sh/i/kD8yO7) 举例, 在 pi 中使用会因为 headers 原因 被 Cloudflare 当为爬虫返回 403, 我配置为

文件：`~/.pi/agent/models.json` 这个文件继续使用 Pi 默认格式，不需要改结构
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
    },
  }
}
```

说明：
- `providers` 下的 key 就是 provider 名
- `apiKey` 和官网一致 可以写环境变量名，也可以直接写明文 key 
- 插件会根据这里的 provider 名和 baseUrl 来匹配兼容逻辑

### 2. 配置兼容规则

文件：`~/.pi/agent/claude-code-headers-compat.json`

你当前配置示例：

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

字段说明：

#### `enable`

是否启动

#### `matchedProvidersUrl`
需要启用兼容逻辑的 provider 名列表, 按需配置就可以了。

要求：
- 名称必须和 `models.json` 里的 provider key 一致
- 只有这里列出的 provider 才会启用兼容处理

#### `modifyHeaders`
用于覆盖默认请求头值。

当前支持：
- `USER_AGENT`
- `ANTHROPIC_VERSION`
- `ACCEPT`
- `CONTENT_TYPE`
- `AUTHORIZATION`

说明：
- 如果某个字段不写，会回退到默认值
- `AUTHORIZATION` 默认使用 `Bearer ${API_KEY}`
- `${API_KEY}` 会替换成该 provider 最终解析出来的 key 值
- 如果 `apiKey` 是环境变量名，则使用环境变量值
- 如果 `apiKey` 是明文，则直接使用明文值

## 使用说明

配置完成后：
1. 确保 `models.json` 中已经定义好 provider
2. 确保 `claude-code-headers-compat.json` 中已经启用该 provider
3. 启动 Pi
4. 当该 provider 发起请求时，插件会自动处理逻辑

## 注意事项

- `matchedProvidersUrl` 中的 provider 名必须和 `models.json` 保持一致
- `apiKey` 在 `models.json` 中既可以写环境变量名，也可以直接写明文 key
- 当前插件主要面向 Claude 兼容接口场景
- 如果 provider 没有命中，插件不会改写请求
