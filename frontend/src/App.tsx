import { Route, Routes } from 'react-router-dom';
import { RequireAuth } from '@/components/route-guards';
import { StoreLayout } from '@/components/layouts/store-layout';
import { AdminLayout } from '@/components/layouts/admin-layout';

import { HomePage } from '@/pages/store/home-page';
import { ProductDetailPage } from '@/pages/store/product-detail-page';
import { CartPage } from '@/pages/store/cart-page';
import { CheckoutPage } from '@/pages/store/checkout-page';
import { OrderConfirmationPage } from '@/pages/store/order-confirmation-page';
import { AccountPage } from '@/pages/store/account-page';

import { LoginPage } from '@/pages/auth/login-page';
import { SignupPage } from '@/pages/auth/signup-page';
import { VerifyEmailPage } from '@/pages/auth/verify-email-page';
import { OAuthCallbackPage } from '@/pages/auth/oauth-callback-page';

import { DashboardPage } from '@/pages/admin/dashboard-page';
import { AdminProductsPage } from '@/pages/admin/products-page';
import { ProductFormPage } from '@/pages/admin/product-form-page';
import { AdminOrdersPage } from '@/pages/admin/orders-page';
import { AdminOrderDetailPage } from '@/pages/admin/order-detail-page';
import { AdminCustomersPage } from '@/pages/admin/customers-page';
import { AdminCustomerDetailPage } from '@/pages/admin/customer-detail-page';

export function App() {
  return (
    <Routes>
      <Route element={<StoreLayout />}>
        <Route index element={<HomePage />} />
        <Route path="products/:slug" element={<ProductDetailPage />} />
        <Route path="cart" element={<CartPage />} />
        <Route path="checkout" element={<CheckoutPage />} />
        <Route path="order-confirmation" element={<OrderConfirmationPage />} />
        <Route
          path="account"
          element={
            <RequireAuth>
              <AccountPage />
            </RequireAuth>
          }
        />
      </Route>

      <Route path="login" element={<LoginPage />} />
      <Route path="signup" element={<SignupPage />} />
      <Route path="verify-email" element={<VerifyEmailPage />} />
      <Route path="auth/callback" element={<OAuthCallbackPage />} />

      <Route
        path="admin"
        element={
          <RequireAuth role="ADMIN">
            <AdminLayout />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="products" element={<AdminProductsPage />} />
        <Route path="products/new" element={<ProductFormPage />} />
        <Route path="products/:id" element={<ProductFormPage />} />
        <Route path="orders" element={<AdminOrdersPage />} />
        <Route path="orders/:id" element={<AdminOrderDetailPage />} />
        <Route path="customers" element={<AdminCustomersPage />} />
        <Route path="customers/:id" element={<AdminCustomerDetailPage />} />
      </Route>
    </Routes>
  );
}
