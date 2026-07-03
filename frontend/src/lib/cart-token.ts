const KEY = 'acme_cart_token';

export function getCartToken(): string | null {
  return localStorage.getItem(KEY);
}

export function setCartToken(token: string | null): void {
  if (token) localStorage.setItem(KEY, token);
}

export function clearCartToken(): void {
  localStorage.removeItem(KEY);
}
