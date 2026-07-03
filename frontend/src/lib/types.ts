export type Role = 'GUEST' | 'CUSTOMER' | 'ADMIN';
export type ProductStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
export type OrderStatus = 'PENDING' | 'PAID' | 'FULFILLED' | 'COMPLETED' | 'CANCELLED';
export type PaymentStatus =
  | 'REQUIRES_PAYMENT'
  | 'PROCESSING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED';
export type UserStatus = 'ACTIVE' | 'INVITED' | 'SUSPENDED' | 'DEACTIVATED';

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
  emailVerified: boolean;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  isActive: boolean;
  position: number;
  children?: Category[];
  _count?: { products: number };
}

export interface ProductVariant {
  id: string;
  sku: string;
  name: string;
  priceAmount: number;
  compareAtAmount?: number | null;
  inventoryQuantity: number;
  options: Record<string, unknown>;
  isActive: boolean;
}

export interface ProductImage {
  id: string;
  url: string;
  alt?: string | null;
  position: number;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  status: ProductStatus;
  brand?: string | null;
  category?: { id: string; name: string; slug: string } | null;
  images: ProductImage[];
  variants: ProductVariant[];
  createdAt: string;
}

export interface CartItem {
  id: string;
  variantId: string;
  quantity: number;
  unitAmount: number;
  lineTotal: number;
  name: string;
  variantName: string;
  sku: string;
  imageUrl: string | null;
  availableQuantity: number;
}

export interface Cart {
  id: string;
  token: string | null;
  currency: string;
  items: CartItem[];
  subtotal: number;
  itemCount: number;
}

export interface OrderItem {
  id: string;
  productName: string;
  variantName: string;
  sku: string;
  unitAmount: number;
  quantity: number;
  totalAmount: number;
}

export interface OrderEvent {
  id: string;
  type: string;
  message?: string | null;
  createdAt: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  email: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: string;
  currency: string;
  subtotalAmount: number;
  totalAmount: number;
  refundedAmount: number;
  shippingAddress?: Record<string, string> | null;
  customer?: { id: string; email: string; firstName?: string | null; lastName?: string | null } | null;
  items?: OrderItem[];
  events?: OrderEvent[];
  createdAt: string;
  _count?: { items: number };
}

export interface Customer {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  status: UserStatus;
  emailVerifiedAt?: string | null;
  lastLoginAt?: string | null;
  createdAt: string;
  _count?: { orders: number };
  orders?: Order[];
  addresses?: Address[];
}

export interface Address {
  id: string;
  type: 'SHIPPING' | 'BILLING';
  fullName: string;
  company?: string | null;
  line1: string;
  line2?: string | null;
  city: string;
  region?: string | null;
  postalCode: string;
  country: string;
  phone?: string | null;
}

export interface Paginated<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface DashboardMetrics {
  grossRevenue: number;
  orderCount: number;
  customerCount: number;
  productCount: number;
  pendingOrders: number;
  recentOrders: Order[];
}
