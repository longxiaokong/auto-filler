interface FormField {
  tag: string;
  type: string;
  name: string;
  id: string;
  label: string;
  placeholder: string;
  ariaLabel: string;
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
  };
}

function scanFields(): FieldResult[] {
  elementMap.clear();

  const selectors = 'input, select, textarea';
  const elements = document.querySelectorAll<HTMLElement>(selectors);
  const results: FieldResult[] = [];
  let index = 0;

  elements.forEach((el) => {
    // Skip hidden/file/reset/submit/button/image inputs
    if (
      el.tagName === 'INPUT' &&
      ['hidden', 'file', 'reset', 'submit', 'button', 'image'].includes(
        (el as HTMLInputElement).type,
      )
    ) {
      return;
    }

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
