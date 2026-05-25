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
  title?: string;
  value?: string;
  options?: string[];
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
      const readable = [
        f.label,
        f.placeholder,
        f.ariaLabel,
        f.title,
        f.context,
      ].filter(Boolean).join(' | ');
      const technical = [f.name && `name=${f.name}`, f.id && `id=${f.id}`].filter(Boolean).join(', ');
      const options = f.options?.length ? `, options="${f.options.join(' / ')}"` : '';
      const currentValue = f.value ? `, currentValue="${f.value}"` : '';
      return `  [${f.index}] tag=${f.tag}, type=${f.type}, readable="${readable}"${options}${currentValue}${technical ? `, ${technical}` : ''}`;
    })
    .join('\n');

  return `你是一个表单字段语义匹配助手。请将以下网页表单字段与用户个人信息进行匹配。

## 用户个人信息（字段名: 值）
${availableKeys.join('\n')}

## 网页表单字段
${fieldList}

## 规则
- 根据语义匹配，不要只看关键词。例如"请输入您的真实姓名"应匹配"姓名"
- 优先依据 readable 中的可读文本和下拉选项理解字段含义；name/id 只是技术标识，含义不清时不要强行匹配
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

  const results = JSON.parse(jsonMatch[0]) as MatchResult[];

  console.group('%c📋 匹配结果', 'color:#ff9800;font-weight:bold');
  results.forEach((r) => console.log(`  [${r.index}] "${r.fieldKey}" ← "${r.value}"`));
  console.groupEnd();

  const validIndices = new Set(fields.map((f) => f.index));
  return results.filter((r) => validIndices.has(r.index) && r.fieldKey && r.value);
}
