import { getProfile, setProfile, getApiConfig, setApiConfig } from '../../utils/storage';
import type { ProfileType, ProfileFields } from '../../utils/storage';

const profileTypeEl = document.getElementById('profileType') as HTMLSelectElement;
const studentSection = document.getElementById('studentFields')!;
const civilServantSection = document.getElementById('civilServantFields')!;

const fieldIds = [
  'name', 'gender', 'idNumber', 'phone', 'email', 'address',
  'school', 'major', 'studentId', 'degree', 'gpa', 'enrollmentYear',
  'employeeId', 'department', 'position', 'rank',
] as const;

const saveBtn = document.getElementById('saveBtn')!;
const statusMsg = document.getElementById('statusMsg')!;

function getEl(id: string): HTMLInputElement | HTMLSelectElement {
  return document.getElementById(id) as HTMLInputElement | HTMLSelectElement;
}

function toggleSections(type: ProfileType) {
  studentSection.classList.toggle('hidden', type !== 'student');
  civilServantSection.classList.toggle('hidden', type !== 'civil_servant');
}

function readFields(): ProfileFields {
  const fields: Record<string, string> = {};
  for (const id of fieldIds) {
    fields[id] = getEl(id).value.trim();
  }
  return fields as unknown as ProfileFields;
}

function populateFields(fields: ProfileFields) {
  for (const id of fieldIds) {
    const el = getEl(id);
    if (el) {
      el.value = (fields as unknown as Record<string, string>)[id] ?? '';
    }
  }
}

async function load() {
  const { profileType, fields } = await getProfile();
  const apiConfig = await getApiConfig();

  profileTypeEl.value = profileType;
  toggleSections(profileType);
  populateFields(fields);

  getEl('baseUrl').value = apiConfig.baseUrl;
  getEl('apiKey').value = apiConfig.apiKey;
  getEl('model').value = apiConfig.model;
}

async function save() {
  const profileType = profileTypeEl.value as ProfileType;
  const fields = readFields();

  await setProfile(profileType, fields);
  await setApiConfig({
    baseUrl: getEl('baseUrl').value.trim(),
    apiKey: getEl('apiKey').value.trim(),
    model: getEl('model').value.trim(),
  });

  showStatus('已保存');
}

function showStatus(text: string) {
  statusMsg.textContent = text;
  statusMsg.classList.add('show');
  setTimeout(() => statusMsg.classList.remove('show'), 2000);
}

profileTypeEl.addEventListener('change', () => {
  toggleSections(profileTypeEl.value as ProfileType);
});

saveBtn.addEventListener('click', save);

load();
