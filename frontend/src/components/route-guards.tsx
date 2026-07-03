import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { PageLoader } from '@/components/ui/misc';
import type { Role } from '@/lib/types';

export function RequireAuth({ children, role }: { children: ReactNode; role?: Role }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <PageLoader />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return <>{children}</>;
}
