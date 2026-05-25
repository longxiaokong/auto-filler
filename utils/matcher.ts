import type { ApiConfig, ProfileType, ProfileFields } from './storage';

export interface FormFieldInfo {
  index: number;
  tag: string;
  type: string;
  name: string;
  id: string;
  label: string;
  placeholder: string;
  ariaLabel: string;
}

export interface MatchResult {
  index: number;
  fieldKey: string;
  value: string;
}

const FIELD_DESCRIPTIONS: Record<string, string> = {
  name: '姓名',
  gender: '性别',
  idNumber: '身份证号',
  phone: '手机号',
  email: '电子邮箱',
  address: '地址',
  school: '学校/毕业院校',
  major: '专业',
  studentId: '学号',
  degree: '学历/学位',
  gpa: 'GPA/绩点',
  enrollmentYear: '入学年份',
  employeeId: '工号',
  department: '部门',
  position: '职务',
  rank: '职级',
};

function buildPrompt(fields: FormFieldInfo[], profileType: ProfileType, profileFields: ProfileFields): string {
  const availableKeys = Object.entries(profileFields)
    .filter(([, v]) => v.length > 0)
    .map(([k, v]) => `  "${k}" (${FIELD_DESCRIPTIONS[k] || k}): "${v}"`);

  const fieldList = fields
    .map((f, i) => {
      const clues = [f.label, f.placeholder, f.ariaLabel, f.name, f.id].filter(Boolean);
      return `  [${f.index}] type=${f.type}, clues=[${clues.join(', ')}]`;
    })
    .join('\n');

  return `你是一个表单字段语义匹配助手。请将以下网页表单字段与用户个人信息进行匹配。

## 用户个人信息（字段key: 描述 = 值）
${availableKeys.join('\n')}

## 网页表单字段
${fieldList}

## 规则
- 根据语义匹配，不要只看关键词。例如"请输入您的真实姓名"应匹配 name
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
  profileType: ProfileType,
  profileFields: ProfileFields,
): Promise<MatchResult[]> {
  if (fields.length === 0) return [];

  const prompt = buildPrompt(fields, profileType, profileFields);
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

  // Parse JSON from response — handle markdown code blocks
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('Invalid LLM response format');

  const results = JSON.parse(jsonMatch[0]) as MatchResult[];

  // Validate that returned indices exist in the field list
  const validIndices = new Set(fields.map((f) => f.index));
  return results.filter((r) => validIndices.has(r.index) && r.fieldKey && r.value);
}
