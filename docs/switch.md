# 模型切换表

Auto Filler 使用 OpenAI 兼容 API，填入对应的 Base URL、API Key、Model 即可切换供应商。

## 国内厂商

| 厂商 | Base URL | 推荐模型 | 获取 API Key |
|------|----------|----------|-------------|
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat` | [platform.deepseek.com](https://platform.deepseek.com) |
| 阿里百炼 (通义千问) | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-turbo` / `qwen-plus` | [bailian.console.aliyun.com](https://bailian.console.aliyun.com) |
| 智谱 (GLM) | `https://open.bigmodel.cn/api/paas/v4` | `glm-4-flash` | [open.bigmodel.cn](https://open.bigmodel.cn) |
| 月之暗面 (Kimi) | `https://api.moonshot.cn/v1` | `moonshot-v1-8k` | [platform.moonshot.cn](https://platform.moonshot.cn) |
| 字节火山引擎 (豆包) | `https://ark.cn-beijing.volces.com/api/v3` | `doubao-lite-128k` | [console.volcengine.com/ark](https://console.volcengine.com/ark) |
| 百度千帆 | `https://qianfan.baidubce.com/v2` | `ernie-4.0-turbo-8k` | [console.bce.baidu.com/qianfan](https://console.bce.baidu.com/qianfan) |
| 讯飞星火 | `https://spark-api-open.xf-yun.com/v1` | `4.0Ultra` | [console.xfyun.cn](https://console.xfyun.cn) |
| 腾讯混元 | `https://api.hunyuan.cloud.tencent.com/v1` | `hunyuan-lite` | [console.cloud.tencent.com/hunyuan](https://console.cloud.tencent.com/hunyuan) |
| 硅基流动 (SiliconFlow) | `https://api.siliconflow.cn/v1` | `deepseek-ai/DeepSeek-V3` | [siliconflow.cn](https://siliconflow.cn) |
| MiniMax | `https://api.minimax.chat/v1` | `abab6.5s-chat` | [platform.minimaxi.com](https://platform.minimaxi.com) |
| 零一万物 | `https://api.lingyiwanwu.com/v1` | `yi-large` | [platform.lingyiwanwu.com](https://platform.lingyiwanwu.com) |

## 国外厂商

| 厂商 | Base URL | 推荐模型 | 获取 API Key |
|------|----------|----------|-------------|
| OpenAI | `https://api.openai.com/v1` | `gpt-4o-mini` | [platform.openai.com](https://platform.openai.com) |
| Groq | `https://api.groq.com/openai/v1` | `llama-3.1-8b-instant` | [console.groq.com](https://console.groq.com) |
| Together AI | `https://api.together.xyz/v1` | `meta-llama/Llama-3.1-8B-Instruct` | [together.ai](https://together.ai) |
| xAI (Grok) | `https://api.x.ai/v1` | `grok-2` | [x.ai](https://x.ai) |

## 本地 / 自部署

| 方案 | Base URL | 说明 |
|------|----------|------|
| Ollama | `http://localhost:11434/v1` | 本地运行，需先 `ollama pull <model>` |
| vLLM | `http://localhost:8000/v1` | 自部署推理框架 |
| LM Studio | `http://localhost:1234/v1` | 桌面端本地推理 |

## 配置示例

以 DeepSeek 为例，在 Auto Filler 设置页填入：

- **Base URL**: `https://api.deepseek.com/v1`
- **API Key**: `sk-xxxxxxxxxxxxxxxxxxxxxxxx`
- **模型名称**: `deepseek-chat`

匹配任务对模型能力要求不高，推荐优先选用 DeepSeek（便宜）或 SiliconFlow（国内访问稳定）。
