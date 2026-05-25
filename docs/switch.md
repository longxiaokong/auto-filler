# 模型切换表

> 数据来源：[cc-switch](https://github.com/farion1231/cc-switch) `src/config/claudeProviderPresets.ts`
>
> 以下端点为 **Anthropic 兼容 API** 格式。本项目的 OpenAI 兼容端点通常只需将路径中的 `/anthropic` 替换为 `/v1` 或根路径。

## 官方

| 厂商 | Anthropic Base URL | 默认模型 |
|------|-------------------|----------|
| Anthropic (Claude Official) | `https://api.anthropic.com` | —（直接走 Anthropic API） |

## 国内厂商

| 厂商 | Anthropic Base URL | 默认模型 |
|------|-------------------|----------|
| 火山引擎 Agentplan | `https://ark.cn-beijing.volces.com/api/coding` | `ark-code-latest` |
| BytePlus | `https://ark.ap-southeast.bytepluses.com/api/coding` | `ark-code-latest` |
| 豆包 Seed | `https://ark.cn-beijing.volces.com/api/compatible` | `doubao-seed-2-0-code-preview-latest` |
| DeepSeek | `https://api.deepseek.com/anthropic` | `deepseek-v4-pro` |
| 智谱 GLM | `https://open.bigmodel.cn/api/anthropic` | `glm-5` |
| 智谱 GLM 国际 | `https://api.z.ai/api/anthropic` | `glm-5` |
| 百度千帆 Coding Plan | `https://qianfan.baidubce.com/anthropic/coding` | `qianfan-code-latest` |
| 阿里百炼 | `https://dashscope.aliyuncs.com/apps/anthropic` | — |
| 阿里百炼 For Coding | `https://coding.dashscope.aliyuncs.com/apps/anthropic` | — |
| Kimi (月之暗面) | `https://api.moonshot.cn/anthropic` | `kimi-k2.6` |
| Kimi For Coding | `https://api.kimi.com/coding/` | — |
| StepFun (阶跃星辰) | `https://api.stepfun.com/step_plan` | `step-3.5-flash-2603` |
| StepFun 国际 | `https://api.stepfun.ai/step_plan` | `step-3.5-flash-2603` |
| MiniMax | `https://api.minimaxi.com/anthropic` | `MiniMax-M2.7` |
| MiniMax 国际 | `https://api.minimax.io/anthropic` | `MiniMax-M2.7` |
| 小米 MiMo | `https://api.xiaomimimo.com/anthropic` | `mimo-v2.5-pro` |
| 小米 MiMo Token Plan | `https://token-plan-cn.xiaomimimo.com/anthropic` | `mimo-v2.5-pro` |
| 灵码 (BaiLing/蚂蚁) | `https://api.tbox.cn/api/anthropic` | `Ling-2.5-1T` |
| Longcat | `https://api.longcat.chat/anthropic` | `LongCat-Flash-Chat` |
| KAT-Coder (StreamLake) | `https://vanchin.streamlake.ai/api/gateway/v1/endpoints/${ENDPOINT_ID}/claude-code-proxy` | `KAT-Coder-Pro V1` |

## 聚合平台

| 厂商 | Anthropic Base URL | 默认模型 |
|------|-------------------|----------|
| SiliconFlow | `https://api.siliconflow.cn` | `Pro/MiniMaxAI/MiniMax-M2.7` |
| SiliconFlow 国际 | `https://api.siliconflow.com` | `MiniMaxAI/MiniMax-M2.7` |
| OpenRouter | `https://openrouter.ai/api` | `anthropic/claude-sonnet-4.6` |
| TheRouter | `https://api.therouter.ai` | `anthropic/claude-sonnet-4.6` |
| Novita AI | `https://api.novita.ai/anthropic` | `zai-org/glm-5` |
| AiHubMix | `https://aihubmix.com` | — |
| DMXAPI | `https://www.dmxapi.cn` | — |
| RunAPI | `https://runapi.co` | — |
| ModelScope (魔搭) | `https://api-inference.modelscope.cn` | `ZhipuAI/GLM-5` |
| Compshare (算力共享) | `https://api.modelverse.cn` | — |
| Compshare Coding Plan | `https://cp.compshare.cn` | — |
| 胜算云 (Shengsuanyun) | `https://router.shengsuanyun.com/api` | — |
| PIPELLM | `https://cc-api.pipellm.ai` | `claude-opus-4-7` |
| NVIDIA | `https://integrate.api.nvidia.com` | `moonshotai/kimi-k2.5` |

## 第三方供应商

| 厂商 | Anthropic Base URL |
|------|-------------------|
| PatewayAI | `https://api.pateway.ai` |
| ClaudeAPI | `https://gw.claudeapi.com` |
| ClaudeCN | `https://claudecn.top` |
| PackyCode | `https://www.packyapi.com` |
| Cubence | `https://api.cubence.com` |
| AIGoCode | `https://api.aigocode.com` |
| RightCode | `https://www.right.codes/claude` |
| AICodeMirror | `https://api.aicodemirror.com/api/claudecode` |
| AICoding | `https://api.aicoding.sh` |
| CrazyRouter | `https://cn.crazyrouter.com` |
| SSSAiCode | `https://node-hk.sssaicode.com/api` |
| Micu | `https://www.micuapi.ai` |
| CTok.ai | `https://api.ctok.ai` |
| E-FlowCode | `https://e-flowcode.cc` |
| RelaxyCode | `https://www.relaxycode.com` |
| LemonData | `https://api.lemondata.cc` |

## 特殊认证（OAuth）

| 厂商 | Anthropic Base URL | 认证方式 |
|------|-------------------|---------|
| GitHub Copilot | `https://api.githubcopilot.com` | OAuth（`openai_chat` 格式） |
| OpenAI Codex | `https://chatgpt.com/backend-api/codex` | OAuth（`openai_responses` 格式） |
| Gemini Native | `https://generativelanguage.googleapis.com` | API Key（`gemini_native` 格式） |

## 云服务商

| 厂商 | Anthropic Base URL | 认证 |
|------|-------------------|------|
| AWS Bedrock (AKSK) | `https://bedrock-runtime.${AWS_REGION}.amazonaws.com` | AccessKey + SecretKey + Region |
| AWS Bedrock (API Key) | (同上) | API Key + Region |
