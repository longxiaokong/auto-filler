interface FormField {
  kind: 'text' | 'file';
  tag: string;
  type: string;
  name: string;
  id: string;
  label: string;
  hint: string;
  placeholder: string;
  ariaLabel: string;
  title: string;
  value: string;
  options: string[];
  accept: string;
  multiple: boolean;
  fillMode: 'short' | 'long';
  renderWidth: number;
  renderHeight: number;
  context: string;
  html: string;
}

interface FieldResult {
  index: number;
  field: FormField;
}

interface TextFillItem {
  kind?: 'text';
  index: number;
  value: string;
}

interface FileFillItem {
  kind: 'file';
  index: number;
  fileName: string;
  fileType: string;
  fileBody: string;
}

type FillItem = TextFillItem | FileFillItem;

interface FillResult {
  success: number;
  failure: number;
}

interface ScanMessage { type: 'scan' }
interface FillMessage { type: 'fill'; items: FillItem[] }
type Message = ScanMessage | FillMessage;

let elementMap = new Map<number, HTMLElement>();

function findLabel(el: HTMLElement): string {
  if (el.id) {
    const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (label) return label.textContent?.trim() ?? '';
  }

  const parentLabel = el.closest('label');
  if (parentLabel) {
    // Exclude the element's own text from the label
    const clone = parentLabel.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('input, select, textarea').forEach((c) => c.remove());
    return clone.textContent?.trim() ?? '';
  }

  // Use aria-labelledby
  const labelledBy = el.getAttribute('aria-labelledby');
  if (labelledBy) {
    const refEl = document.getElementById(labelledBy);
    if (refEl) return refEl.textContent?.trim() ?? '';
  }

  const row = el.closest('tr');
  const valueCell = el.closest('td, th');
  if (row && valueCell) {
    const cells = Array.from(row.querySelectorAll<HTMLElement>('td, th'));
    const valueCellIndex = cells.indexOf(valueCell as HTMLElement);
    const labelCell = cells
      .slice(0, Math.max(valueCellIndex, 0))
      .reverse()
      .find((cell) => textWithoutControls(cell));
    if (labelCell) return textWithoutControls(labelCell);
  }

  return '';
}

const EDITABLE_SELECTOR = [
  'input:not([type="hidden"]):not([type="submit"]):not([type="reset"]):not([type="button"]):not([type="image"]):not([type="file"])',
  'select',
  'textarea',
  '[contenteditable="true"]',
  '[role="textbox"]',
  '[role="combobox"]',
].join(',');

const FILE_SELECTOR = 'input[type="file"]';
const SCANNABLE_SELECTOR = `${EDITABLE_SELECTOR},${FILE_SELECTOR}`;

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function isVisible(el: HTMLElement): boolean {
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    return false;
  }
  return el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0;
}

function isFillable(el: HTMLElement): boolean {
  if (!el.matches(SCANNABLE_SELECTOR)) return false;
  if ((el as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).disabled) return false;
  if (!(el instanceof HTMLInputElement && el.type === 'file') && (el as HTMLInputElement | HTMLTextAreaElement).readOnly) return false;
  return isVisible(el);
}

function countEditables(el: HTMLElement): number {
  return Array.from(el.querySelectorAll<HTMLElement>(SCANNABLE_SELECTOR)).filter(isFillable).length;
}

// Walk up from the deepest editable node until the current container holds
// multiple fillable controls; that is the widest useful context boundary.
function textWithoutControls(el: HTMLElement): string {
  const clone = el.cloneNode(true) as HTMLElement;
  clone
    .querySelectorAll('input, select, textarea, option, script, style, svg, button')
    .forEach((child) => child.remove());
  return normalizeText(clone.textContent ?? '');
}

function getOptions(el: HTMLElement): string[] {
  if (el instanceof HTMLSelectElement) {
    return Array.from(el.options)
      .map((option) => normalizeText(option.textContent ?? option.value))
      .filter(Boolean)
      .slice(0, 20);
  }

  const optionContainerIds = el.getAttribute('aria-owns') || el.getAttribute('aria-controls');
  if (!optionContainerIds) return [];

  return optionContainerIds
    .split(/\s+/)
    .flatMap((id) => Array.from(document.getElementById(id)?.querySelectorAll('[role="option"]') ?? []))
    .map((option) => normalizeText(option.textContent ?? ''))
    .filter(Boolean)
    .slice(0, 20);
}

function getCurrentValue(el: HTMLElement): string {
  if (el instanceof HTMLInputElement && el.type === 'file') {
    return Array.from(el.files ?? []).map((file) => file.name).join(', ');
  }
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return el.value;
  if (el instanceof HTMLSelectElement) {
    return normalizeText(el.selectedOptions[0]?.textContent ?? el.value);
  }
  return normalizeText(el.textContent ?? '');
}

function getRenderedSize(el: HTMLElement): { width: number; height: number } {
  const rect = el.getBoundingClientRect();
  return {
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  };
}

function classifyFillMode(el: HTMLElement, width: number, height: number): 'short' | 'long' {
  if (el instanceof HTMLSelectElement) return 'short';
  if (el instanceof HTMLInputElement && el.type !== 'file') return height >= 96 ? 'long' : 'short';
  if (el instanceof HTMLInputElement && el.type === 'file') return 'short';

  const area = width * height;
  if (height >= 96 || area >= 32000) return 'long';
  return 'short';
}

function findContextRoot(el: HTMLElement): HTMLElement {
  let node: HTMLElement | null = el;
  while (node && node !== document.body) {
    if (countEditables(node) > 1) {
      return node;
    }
    node = node.parentElement;
  }
  return el.closest('form') ?? document.body;
}

function findNearestSingleFieldContainer(el: HTMLElement, contextRoot: HTMLElement): HTMLElement {
  let node: HTMLElement = el;
  while (node.parentElement && node.parentElement !== contextRoot && countEditables(node.parentElement) <= 1) {
    node = node.parentElement;
  }
  return node;
}

function findNearbyText(el: HTMLElement, contextRoot: HTMLElement): string {
  const parts: string[] = [];
  let current: ChildNode | null = el.previousSibling;

  while (current) {
    if (current instanceof HTMLElement && current.matches(SCANNABLE_SELECTOR) && isFillable(current)) break;
    const text = normalizeText(current.textContent ?? '');
    if (text) parts.unshift(text);
    current = current.previousSibling;
  }

  current = el.nextSibling;
  while (current) {
    if (current instanceof HTMLElement && current.matches(SCANNABLE_SELECTOR) && isFillable(current)) break;
    const text = normalizeText(current.textContent ?? '');
    if (text) parts.push(text);
    current = current.nextSibling;
  }

  return parts.join(' ');
}

function joinUnique(parts: Array<string | undefined>): string {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const part of parts) {
    const text = normalizeText(part ?? '');
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
  }

  return result.join(' | ');
}

function getSemanticContainer(el: HTMLElement): HTMLElement {
  const row = el.closest<HTMLElement>('tr');
  if (row) return row;

  const fieldWrapper = el.closest<HTMLElement>(
    '.form-group, .field, .form-item, .form-row, .ant-form-item, .el-form-item, label',
  );
  if (fieldWrapper) return fieldWrapper;

  return findNearestSingleFieldContainer(el, findContextRoot(el));
}

function sanitizeHtml(el: HTMLElement): string {
  const clone = el.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('script, style, svg, iframe, canvas').forEach((child) => child.remove());

  clone.querySelectorAll<HTMLElement>('*').forEach((node) => {
    Array.from(node.attributes).forEach((attr) => {
      const name = attr.name.toLowerCase();
      const keep =
        ['id', 'name', 'type', 'placeholder', 'title', 'aria-label', 'role'].includes(name) ||
        name.startsWith('data-');
      if (!keep || name.startsWith('on')) {
        node.removeAttribute(attr.name);
      }
    });

    if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement) {
      node.removeAttribute('value');
    }
  });

  return normalizeText(clone.outerHTML).slice(0, 800);
}

function findContext(el: HTMLElement): string {
  const contextRoot = findContextRoot(el);
  const singleFieldContainer = findNearestSingleFieldContainer(el, contextRoot);
  const localText = textWithoutControls(singleFieldContainer);
  const nearbyText = findNearbyText(el, contextRoot);

  return joinUnique([localText, nearbyText]);
}

function findHint(el: HTMLElement, label: string, context: string): string {
  const singleFieldContainer = findNearestSingleFieldContainer(el, findContextRoot(el));
  const localText = textWithoutControls(singleFieldContainer);
  const hint = localText
    .replace(label, '')
    .replace(/\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return hint || context.replace(label, '').trim();
}

function extractField(el: HTMLElement): FormField {
  const tag = el.tagName.toLowerCase();
  const isFile = el instanceof HTMLInputElement && el.type === 'file';
  const renderedSize = getRenderedSize(el);
  const context = findContext(el);
  const label = findLabel(el);
  return {
    kind: isFile ? 'file' : 'text',
    tag,
    type: (el as HTMLInputElement).type ?? tag,
    name: el.getAttribute('name') ?? '',
    id: el.getAttribute('id') ?? '',
    label,
    hint: findHint(el, label, context),
    placeholder: el.getAttribute('placeholder') ?? '',
    ariaLabel: el.getAttribute('aria-label') ?? '',
    title: el.getAttribute('title') ?? '',
    value: getCurrentValue(el),
    options: getOptions(el),
    accept: isFile ? el.accept : '',
    multiple: isFile ? el.multiple : false,
    fillMode: classifyFillMode(el, renderedSize.width, renderedSize.height),
    renderWidth: renderedSize.width,
    renderHeight: renderedSize.height,
    context,
    html: sanitizeHtml(getSemanticContainer(el)),
  };
}

function scanFields(): FieldResult[] {
  elementMap.clear();

  const elements = document.querySelectorAll<HTMLElement>(SCANNABLE_SELECTOR);
  const results: FieldResult[] = [];
  let index = 0;

  elements.forEach((el) => {
    if (!isFillable(el)) return;

    elementMap.set(index, el);
    results.push({ index, field: extractField(el) });
    index++;
  });

  return results;
}

function isAcceptedFileType(accept: string, fileName: string, fileType: string): boolean {
  const rules = accept
    .split(',')
    .map((rule) => rule.trim().toLowerCase())
    .filter(Boolean);
  if (rules.length === 0) return true;

  const lowerName = fileName.toLowerCase();
  const lowerType = fileType.toLowerCase();
  return rules.some((rule) => {
    if (rule === '*/*') return true;
    if (rule.endsWith('/*')) return lowerType.startsWith(rule.slice(0, -1));
    if (rule.startsWith('.')) return lowerName.endsWith(rule);
    return lowerType === rule;
  });
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function fillFields(items: FillItem[]): FillResult {
  let success = 0;
  let failure = 0;

  for (const item of items) {
    const { index } = item;
    const el = elementMap.get(index);
    if (!el) {
      failure++;
      continue;
    }

    try {
      const tag = el.tagName.toLowerCase();
      const type = (el as HTMLInputElement).type;

      if (item.kind === 'file') {
        if (!(el instanceof HTMLInputElement) || el.type !== 'file') {
          failure++;
          continue;
        }
        if (!isAcceptedFileType(el.accept, item.fileName, item.fileType)) {
          failure++;
          continue;
        }

        const file = new File([base64ToArrayBuffer(item.fileBody)], item.fileName, { type: item.fileType || 'application/octet-stream' });
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        el.files = dataTransfer.files;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        success++;
      } else if (type === 'radio') {
        const { value } = item;
        const input = el as HTMLInputElement;
        if (input.value === value) {
          input.checked = true;
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
        success++;
      } else if (type === 'checkbox') {
        const { value } = item;
        const input = el as HTMLInputElement;
        input.checked = value === 'true' || value === '1' || value === input.value;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        success++;
      } else if (tag === 'select') {
        const { value } = item;
        const select = el as HTMLSelectElement;
        const option = Array.from(select.options).find(
          (opt) => opt.value === value || opt.textContent?.trim() === value,
        );
        if (option) {
          select.value = option.value;
        } else {
          select.value = value;
        }
        select.dispatchEvent(new Event('change', { bubbles: true }));
        success++;
      } else if (tag === 'textarea' || tag === 'input') {
        const { value } = item;
        const target = el as HTMLInputElement | HTMLTextAreaElement;
        // Use native setter to ensure React/Angular pick up the change
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          'value',
        )?.set;
        if (nativeInputValueSetter && tag === 'input') {
          nativeInputValueSetter.call(target, value);
        } else {
          target.value = value;
        }
        target.dispatchEvent(new Event('input', { bubbles: true }));
        target.dispatchEvent(new Event('change', { bubbles: true }));
        success++;
      } else if (el.isContentEditable || el.getAttribute('role') === 'textbox') {
        const { value } = item;
        el.textContent = value;
        el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        success++;
      } else {
        failure++;
      }
    } catch {
      failure++;
    }
  }

  return { success, failure };
}

export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    chrome.runtime.onMessage.addListener(
      (message: Message, _sender, sendResponse) => {
        if (message.type === 'scan') {
          const results = scanFields();
          sendResponse(results);
        } else if (message.type === 'fill') {
          const results = fillFields(message.items);
          sendResponse(results);
        }
        // Return true to keep the message channel open for async sendResponse
        return true;
      },
    );
  },
});
