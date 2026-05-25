interface FormField {
  tag: string;
  type: string;
  name: string;
  id: string;
  label: string;
  placeholder: string;
  ariaLabel: string;
  title: string;
  value: string;
  options: string[];
  context: string;
}

interface FieldResult {
  index: number;
  field: FormField;
}

interface FillItem {
  index: number;
  value: string;
}

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
  if (!el.matches(EDITABLE_SELECTOR)) return false;
  if ((el as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).disabled) return false;
  if ((el as HTMLInputElement | HTMLTextAreaElement).readOnly) return false;
  return isVisible(el);
}

function countEditables(el: HTMLElement): number {
  return Array.from(el.querySelectorAll<HTMLElement>(EDITABLE_SELECTOR)).filter(isFillable).length;
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
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return el.value;
  if (el instanceof HTMLSelectElement) {
    return normalizeText(el.selectedOptions[0]?.textContent ?? el.value);
  }
  return normalizeText(el.textContent ?? '');
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
    if (current instanceof HTMLElement && isFillable(current)) break;
    const text = normalizeText(current.textContent ?? '');
    if (text) parts.unshift(text);
    current = current.previousSibling;
  }

  current = el.nextSibling;
  while (current) {
    if (current instanceof HTMLElement && isFillable(current)) break;
    const text = normalizeText(current.textContent ?? '');
    if (text) parts.push(text);
    current = current.nextSibling;
  }

  if (parts.length > 0) return parts.join(' ');

  const rootText = textWithoutControls(contextRoot);
  return rootText.length > 600 ? `${rootText.slice(0, 600)}...` : rootText;
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

function findContext(el: HTMLElement): string {
  const contextRoot = findContextRoot(el);
  const singleFieldContainer = findNearestSingleFieldContainer(el, contextRoot);
  const localText = textWithoutControls(singleFieldContainer);
  const nearbyText = findNearbyText(el, contextRoot);
  const rootText = textWithoutControls(contextRoot);

  return joinUnique([
    localText,
    nearbyText,
    rootText.length > 600 ? `${rootText.slice(0, 600)}...` : rootText,
  ]);
}

function extractField(el: HTMLElement): FormField {
  const tag = el.tagName.toLowerCase();
  return {
    tag,
    type: (el as HTMLInputElement).type ?? tag,
    name: el.getAttribute('name') ?? '',
    id: el.getAttribute('id') ?? '',
    label: findLabel(el),
    placeholder: el.getAttribute('placeholder') ?? '',
    ariaLabel: el.getAttribute('aria-label') ?? '',
    title: el.getAttribute('title') ?? '',
    value: getCurrentValue(el),
    options: getOptions(el),
    context: findContext(el),
  };
}

function scanFields(): FieldResult[] {
  elementMap.clear();

  const elements = document.querySelectorAll<HTMLElement>(EDITABLE_SELECTOR);
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

function fillFields(items: FillItem[]): FillResult {
  let success = 0;
  let failure = 0;

  for (const { index, value } of items) {
    const el = elementMap.get(index);
    if (!el) {
      failure++;
      continue;
    }

    try {
      const tag = el.tagName.toLowerCase();
      const type = (el as HTMLInputElement).type;

      if (type === 'radio') {
        const input = el as HTMLInputElement;
        if (input.value === value) {
          input.checked = true;
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
        success++;
      } else if (type === 'checkbox') {
        const input = el as HTMLInputElement;
        input.checked = value === 'true' || value === '1' || value === input.value;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        success++;
      } else if (tag === 'select') {
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
