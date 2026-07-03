import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Spinner } from '@/components/ui/misc';
import { useAuth } from '@/providers/auth-provider';
import { api } from '@/lib/api';

export function OAuthCallbackPage() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      navigate('/login', { replace: true });
      return;
    }
    const finish = async () => {
      await api.post('/cart/merge').catch(() => undefined);
      await queryClient.invalidateQueries({ queryKey: ['cart'] });
      navigate(user.role === 'ADMIN' ? '/admin' : '/', { replace: true });
    };
    void finish();
  }, [isLoading, user, navigate, queryClient]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
      <Spinner className="size-8" />
      <p className="text-sm text-muted-foreground">Signing you in…</p>
    </div>
  );
}
