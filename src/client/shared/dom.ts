/**
 * DOM utilities for type-safe element queries
 */

/**
 * Get an element by ID with type safety
 * Throws if element not found
 */
export function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Element with id "${id}" not found`);
  }
  return element as T;
}

/**
 * Get an element by ID, returns null if not found
 */
export function getElementOrNull<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

/**
 * Show a message element
 */
export function showMessage(element: HTMLElement, message: string, isHtml = false): void {
  if (isHtml) {
    element.innerHTML = message;
  } else {
    element.textContent = message;
  }
  element.classList.remove('message--hidden');
}

/**
 * Hide a message element
 */
export function hideMessage(element: HTMLElement): void {
  element.classList.add('message--hidden');
}

/**
 * Format a date for display
 */
export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString();
}
