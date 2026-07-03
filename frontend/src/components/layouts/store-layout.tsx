import { Link, NavLink, Outlet } from 'react-router-dom';
import { ShoppingBag, User2, LayoutDashboard } from 'lucide-react';
import { useCart } from '@/hooks/use-cart';
import { useAuth } from '@/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { ChatPanel } from '@/components/ai/chat-panel';
import { cn } from '@/lib/utils';

export function StoreLayout() {
  const { data: cart } = useCart();
  const { user } = useAuth();
  const count = cart?.itemCount ?? 0;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-border glass">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="text-lg font-extrabold tracking-tight">
            ACME
          </Link>

          <nav className="hidden items-center gap-8 text-sm md:flex">
            <NavLink to="/" className={navClass} end>
              Shop
            </NavLink>
            {user && (
              <NavLink to="/account" className={navClass}>
                Orders
              </NavLink>
            )}
          </nav>

          <div className="flex items-center gap-2">
            {user?.role === 'ADMIN' && (
              <Button asChild variant="ghost" size="sm">
                <Link to="/admin">
                  <LayoutDashboard className="size-4" /> Admin
                </Link>
              </Button>
            )}
            <Button asChild variant="ghost" size="icon" className="relative">
              <Link to="/cart" aria-label="Cart">
                <ShoppingBag className="size-5" />
                {count > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                    {count}
                  </span>
                )}
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to={user ? '/account' : '/login'}>
                <User2 className="size-4" />
                {user ? 'Account' : 'Sign in'}
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="container flex-1 py-10">
        <Outlet />
      </main>

      <footer className="border-t border-border py-8">
        <div className="container flex items-center justify-between text-sm text-muted-foreground">
          <span>© {new Date().getFullYear()} Acme. All rights reserved.</span>
          <span>Crafted with care.</span>
        </div>
      </footer>

      <ChatPanel />
    </div>
  );
}

const navClass = ({ isActive }: { isActive: boolean }) =>
  cn('text-muted-foreground transition-colors hover:text-foreground', isActive && 'text-foreground');
