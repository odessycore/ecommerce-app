import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/misc';
import { api } from '@/lib/api';

type Status = 'verifying' | 'success' | 'error';

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<Status>(token ? 'verifying' : 'error');

  useEffect(() => {
    if (!token) return;
    let active = true;
    api
      .post('/auth/verify-email', { token })
      .then(() => active && setStatus('success'))
      .catch(() => active && setStatus('error'));
    return () => {
      active = false;
    };
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md text-center">
        <CardContent className="space-y-6 p-10">
          {status === 'verifying' && (
            <>
              <div className="flex justify-center">
                <Spinner className="size-8" />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-bold tracking-tight">Verifying your email</h1>
                <p className="text-muted-foreground">This will only take a moment.</p>
              </div>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="flex justify-center">
                <span className="flex size-16 items-center justify-center rounded-full bg-success/15">
                  <CheckCircle2 className="size-8 text-success" />
                </span>
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-bold tracking-tight">Email verified</h1>
                <p className="text-muted-foreground">Your account is ready. You can sign in now.</p>
              </div>
              <Button asChild className="w-full">
                <Link to="/login">Continue to sign in</Link>
              </Button>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="flex justify-center">
                <span className="flex size-16 items-center justify-center rounded-full bg-destructive/15">
                  <XCircle className="size-8 text-destructive" />
                </span>
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-bold tracking-tight">Link invalid or expired</h1>
                <p className="text-muted-foreground">
                  This verification link is no longer valid. Try signing in to request a new one.
                </p>
              </div>
              <Button asChild variant="outline" className="w-full">
                <Link to="/login">Go to sign in</Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
