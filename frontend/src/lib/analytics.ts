import { api } from './api';

const ANON_KEY = 'acme_anon_id';

function anonymousId(): string {
  let id = localStorage.getItem(ANON_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(ANON_KEY, id);
  }
  return id;
}

type AnalyticsEventType =
  | 'PRODUCT_VIEWED'
  | 'PRODUCT_SEARCHED'
  | 'CART_ITEM_ADDED'
  | 'CHECKOUT_STARTED'
  | 'ORDER_PLACED';

interface TrackPayload {
  productId?: string;
  variantId?: string;
  data?: Record<string, unknown>;
}

// Fire-and-forget; analytics must never interrupt the UX.
export function trackEvent(type: AnalyticsEventType, payload: TrackPayload = {}): void {
  void api.post('/events', { type, anonymousId: anonymousId(), ...payload }).catch(() => undefined);
}
