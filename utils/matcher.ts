import type { ApiConfig } from './storage';

export interface FormFieldInfo {
  index: number;
  tag: string;
  type: string;
  name: string;
  id: string;
  label: string;
  placeholder: string;
  ariaLabel: string;
  context: string;
}

export interface MatchResult {
  index: number;
  fieldKey: string;
  value: string;
}

function buildPrompt(fields: FormFieldInfo[], textFields: { key: string; value: string }[]): string {
  const availableKeys = textFields.map(({ key, value }) => `  "${key}": "${value}"`);

  const fieldList = fields
    .map((f) => {
      const context = f.context || [f.label, f.placeholder, f.ariaLabel, f.name, f.id].filter(Boolean).join(', ');
      return `  [${f.index}] type=${f.type}, context="${context}"`;
    })
    .join('\n');

  return `你是一个表单字段语义匹配助手。请将以下网页表单字段与用户个人信息进行匹配。

## 用户个人信息（字段名: 值）
${availableKeys.join('\n')}

## 网页表单字段
${fieldList}

## 规则
- 根据语义匹配，不要只看关键词。例如"请输入您的真实姓名"应匹配"姓名"
- 只返回能明确匹配的字段，不确定的不要返回
- 每个表单字段最多匹配一个用户字段

## 输出格式
返回 JSON 数组，每个元素包含：
- index: 表单字段的索引（数字）
- fieldKey: 匹配的用户字段 key（字符串）
- value: 对应的用户数据值（字符串）

只返回 JSON 数组，不要其他内容。如果没有任何匹配，返回空数组 []。`;
}

export async function matchFields(
  fields: FormFieldInfo[],
  apiConfig: ApiConfig,
  textFields: { key: string; value: string }[],
): Promise<MatchResult[]> {
  if (fields.length === 0 || textFields.length === 0) return [];

  const prompt = buildPrompt(fields, textFields);
  const baseUrl = apiConfig.baseUrl.replace(/\/+$/, '');
  const url = `${baseUrl}/chat/completions`;

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

  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('Invalid LLM response format');

  const results = JSON.parse(jsonMatch[0]) as MatchResult[];

  const validIndices = new Set(fields.map((f) => f.index));
  return results.filter((r) => validIndices.has(r.index) && r.fieldKey && r.value);
}
