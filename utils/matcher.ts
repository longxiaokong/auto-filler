import type { ApiConfig } from './storage';

export interface FormFieldInfo {
  kind?: 'text' | 'file';
  index: number;
  tag: string;
  type: string;
  name: string;
  id: string;
  label: string;
  hint?: string;
  placeholder: string;
  ariaLabel: string;
  title?: string;
  value?: string;
  options?: string[];
  accept?: string;
  multiple?: boolean;
  fillMode?: 'short' | 'long';
  renderWidth?: number;
  renderHeight?: number;
  context: string;
  html?: string;
}

export type MaterialRole = 'id_photo' | 'id_card_front' | 'id_card_back';

export interface MatchResult {
  kind?: 'text' | 'file';
  index: number;
  fieldKey: string;
  value: string;
  shortLabel: string;
  confidence: 'high' | 'medium' | 'low';
  fileRecordId?: number;
  fileName?: string;
  fileType?: string;
  materialRole?: MaterialRole;
}

function truncateText(text: string, maxLength: number): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
}

function buildPrompt(fields: FormFieldInfo[], textFields: { key: string; value: string }[]): string {
  const availableKeys = textFields.map(({ key, value }) => `  "${key}": "${value}"`);

  const fieldList = fields
    .map((f) => {
      const label = truncateText(f.label || f.placeholder || f.ariaLabel || f.title || '', 40);
      const hint = truncateText(f.hint || '', 80);
      const context = truncateText(f.context || '', 120);
      const html = truncateText(f.html || '', 500);
      const technical = [f.name && `name=${f.name}`, f.id && `id=${f.id}`].filter(Boolean).join(', ');
      const options = f.options?.length ? `, options="${f.options.join(' / ')}"` : '';
      const currentValue = f.value ? `, currentValue="${f.value}"` : '';
      const fillMode = f.fillMode ?? 'short';
      const size = f.renderWidth && f.renderHeight ? `, renderedSize=${f.renderWidth}x${f.renderHeight}` : '';
      return `  [${f.index}] tag=${f.tag}, type=${f.type}, fillMode=${fillMode}${size}, label="${label}", hint="${hint}", context="${context}", html="${html}"${options}${currentValue}${technical ? `, ${technical}` : ''}`;
    })
    .join('\n');

  return `你是一个表单字段语义匹配助手。请将以下网页表单字段与用户个人信息进行匹配。

## 用户个人信息（字段名: 值）
${availableKeys.join('\n')}

## 网页表单字段
${fieldList}

## 填充长度分类
- fillMode=short：短填充项，例如姓名、性别、民族、证件号、电话、邮箱、日期、下拉选项等。value 必须简洁，优先直接匹配或格式化已有个人信息。
- fillMode=long：长文本项，通常是渲染尺寸较大的 textarea 或富文本编辑区，例如个人陈述、申请理由、自我介绍、备注说明等。value 必须由你参考“用户个人信息”里的全部可用信息生成一段自然、连贯、可直接粘贴的长文本，而不是只返回某一个字段值。
- 对 long 字段，fieldKey 可以使用 "generated_long_text"，表示这是综合生成内容，不要求对应单一用户字段。
- 对 long 字段，严禁编造未提供的学校、奖项、经历、职务、证书等事实；可以用已提供的姓名、身份信息、地址、联系方式等基础信息组织成稳妥表述。若页面上下文有明确主题，应围绕主题生成；若主题只是“个人陈述/自我介绍”，生成通用、正式、第一人称中文文本。

## 规则
- 根据语义匹配，不要只看关键词。例如"请输入您的真实姓名"应匹配"姓名"。
- 只能使用"用户个人信息"中已有的信息直接匹配或派生，不要凭空编造未提供的信息。
- 需要重点做同义、格式和派生推理。例如用户只有中文姓名，网页字段是"姓名拼音 / name pinyin"，应返回姓名的拼音；"证件号码"可由"身份证号"匹配；"证件号码后四位"应返回身份证号后四位；"出生日期"可直接使用或从身份证号第 7-14 位派生；"手机号后四位"应返回手机号后四位；"邮箱前缀"应返回 @ 前面的部分；"省/市/区"应从地址或户籍地址中拆出对应部分。
- 如果字段要求拼音，使用普通话汉语拼音，小写、无声调；如果页面暗示大写、空格或英文格式，可按页面要求调整。
- 如果页面提示"字母间不加任何字符 / 中间无空格 / 紧左原则"，姓名拼音应去掉空格，例如"刘智杰"应填"liuzhijie"。
- 通讯地址、通信地址可优先匹配"地址"；户口所在地详细地址、户籍地址可优先匹配"户籍地址"。
- 民族、性别、婚否、政治面貌等下拉项应根据 options 中最接近的选项文本匹配，value 返回网页可接受的选项文本。
- 优先依据 label、hint、html 中的当前字段行/局部容器理解字段含义；context 只是辅助信息；name/id 只是技术标识，含义不清时不要强行匹配
- 每个表单字段最多匹配一个用户字段。无法推理出合理值时不要返回该字段。
- 为每个返回项生成一个简短字段名 shortLabel，2 到 8 个中文字符或简短英文，不要直接复制很长的上下文。
- confidence 只能是 high、medium、low：
  - high：字段含义和取值都明确，几乎可直接填。
  - medium：语义基本匹配，但有格式/派生推理或上下文略有歧义。
  - low：可能匹配，但需要用户重点确认。

## 输出格式
返回 JSON 数组，每个元素包含：
- index: 表单字段的索引（数字）
- fieldKey: 匹配的用户字段 key（字符串）
- value: 要填入网页表单的最终值（字符串，可为派生/格式化后的值）
- shortLabel: 简短字段名（字符串）
- confidence: "high" | "medium" | "low"

只返回 JSON 数组，不要其他内容。如果没有任何匹配，返回空数组 []。`;
}

function normalizeConfidence(value: unknown): MatchResult['confidence'] {
  return value === 'high' || value === 'medium' || value === 'low' ? value : 'medium';
}

function fallbackShortLabel(field: FormFieldInfo | undefined, fieldKey: string, index: number): string {
  const raw =
    field?.label ||
    field?.placeholder ||
    field?.ariaLabel ||
    field?.title ||
    fieldKey ||
    `字段${index}`;
  const compact = raw.replace(/\s+/g, '').replace(/[：:，,。；;|｜]/g, ' ');
  return compact.slice(0, 12) || `字段${index}`;
}

export async function matchFields(
  fields: FormFieldInfo[],
  apiConfig: ApiConfig,
  textFields: { key: string; value: string }[],
): Promise<MatchResult[]> {
  if (fields.length === 0 || textFields.length === 0) return [];

  const textLikeFields = fields.filter((field) => field.kind !== 'file');
  if (textLikeFields.length === 0) return [];

  const prompt = buildPrompt(textLikeFields, textFields);
  const baseUrl = apiConfig.baseUrl.replace(/\/+$/, '');
  const url = `${baseUrl}/chat/completions`;

  console.group('%c🔍 LLM 匹配请求', 'color:#1E88E5;font-weight:bold');
  console.log('%cAPI:', 'color:#888', url);
  console.log('%cModel:', 'color:#888', apiConfig.model || 'gpt-4o-mini');
  console.log('%cPrompt:\n' + prompt, 'color:#333');
  console.groupEnd();

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiConfig.apiKey}`,
    },
    body: JSON.stringify({
      model: apiConfig.model || 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LLM API error ${response.status}: ${text}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty response from LLM');

  console.group('%c✅ LLM 匹配响应', 'color:#4caf50;font-weight:bold');
  console.log('%cRaw:', 'color:#888', content);
  console.log('%cTokens usage:', 'color:#888', JSON.stringify(data.usage));
  console.groupEnd();

  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('Invalid LLM response format');

  const rawResults = JSON.parse(jsonMatch[0]) as Array<Partial<MatchResult>>;
  const fieldByIndex = new Map(textLikeFields.map((f) => [f.index, f]));
  const results: MatchResult[] = rawResults.map((r) => ({
    kind: 'text',
    index: Number(r.index),
    fieldKey: String(r.fieldKey ?? ''),
    value: String(r.value ?? ''),
    shortLabel: String(r.shortLabel || fallbackShortLabel(fieldByIndex.get(Number(r.index)), String(r.fieldKey ?? ''), Number(r.index))),
    confidence: normalizeConfidence(r.confidence),
  }));

  console.group('%c📋 匹配结果', 'color:#ff9800;font-weight:bold');
  results.forEach((r) => console.log(`  [${r.index}] ${r.confidence} "${r.shortLabel}" "${r.fieldKey}" ← "${r.value}"`));
  console.groupEnd();

  const validIndices = new Set(textLikeFields.map((f) => f.index));
  return results.filter((r) => validIndices.has(r.index) && r.fieldKey && r.value);
}
