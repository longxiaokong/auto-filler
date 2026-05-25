export type ProfileType = 'general' | 'student' | 'civil_servant';

export interface ProfileFields {
  name: string;
  gender: string;
  idNumber: string;
  phone: string;
  email: string;
  address: string;
  // student
  school?: string;
  major?: string;
  studentId?: string;
  degree?: string;
  gpa?: string;
  enrollmentYear?: string;
  // civil_servant
  employeeId?: string;
  department?: string;
  position?: string;
  rank?: string;
}

export interface ApiConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface AppStorage {
  profileType: ProfileType;
  fields: ProfileFields;
  apiConfig: ApiConfig;
}

const DEFAULT_API_CONFIG: ApiConfig = {
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: '',
};

const DEFAULT_FIELDS: ProfileFields = {
  name: '',
  gender: '',
  idNumber: '',
  phone: '',
  email: '',
  address: '',
};

function getStorage(): Promise<AppStorage> {
  return chrome.storage.local.get('appStorage').then((result) => {
    const data = (result.appStorage as AppStorage) || {};
    return {
      profileType: data.profileType || 'general',
      fields: { ...DEFAULT_FIELDS, ...data.fields },
      apiConfig: { ...DEFAULT_API_CONFIG, ...data.apiConfig },
    };
  });
}

function setStorage(data: Partial<AppStorage>): Promise<void> {
  return chrome.storage.local.get('appStorage').then((result) => {
    const current = (result.appStorage as AppStorage) || {};
    return chrome.storage.local.set({
      appStorage: { ...current, ...data },
    });
  });
}

export function getProfile(): Promise<{ profileType: ProfileType; fields: ProfileFields }> {
  return getStorage().then(({ profileType, fields }) => ({ profileType, fields }));
}

export function setProfile(profileType: ProfileType, fields: ProfileFields): Promise<void> {
  return setStorage({ profileType, fields });
}

export function getApiConfig(): Promise<ApiConfig> {
  return getStorage().then(({ apiConfig }) => apiConfig);
}

export function setApiConfig(apiConfig: Partial<ApiConfig>): Promise<void> {
  return getStorage().then((current) =>
    setStorage({ apiConfig: { ...current.apiConfig, ...apiConfig } })
  );
}

export function isProfileConfigured(): Promise<boolean> {
  return getProfile().then(({ fields }) => fields.name.length > 0);
}

export function isApiConfigured(): Promise<boolean> {
  return getApiConfig().then(({ apiKey }) => apiKey.length > 0);
}

export function exportConfig(): Promise<string> {
  return getStorage().then((data) => JSON.stringify(data, null, 2));
}

export function importConfig(json: string): Promise<void> {
  const data = JSON.parse(json) as AppStorage;
  if (!data.profileType || !data.fields || !data.apiConfig) {
    throw new Error('Invalid config format');
  }
  return chrome.storage.local.set({ appStorage: data });
}
