'use client';

import { useEffect, useState } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { apiFetch, ApiError } from '@/lib/api';
import type { IUser } from '@law-ai/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const [profile, setProfile] = useState<IUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status !== 'authenticated') return;
    (async () => {
      try {
        const me = await apiFetch<IUser>('/api/v1/auth/me');
        setProfile(me);
      } catch (e) {
        if (e instanceof ApiError) setError(e.message);
        else setError('Failed to load profile');
      } finally {
        setLoading(false);
      }
    })();
  }, [status]);

  if (status === 'loading') {
    return <main className="container py-12">Loading…</main>;
  }

  return (
    <main className="container py-12">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <Button variant="outline" onClick={() => signOut({ callbackUrl: '/' })}>
          Sign out
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your account information from the backend</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <p className="text-muted-foreground">Loading profile…</p>
          ) : profile ? (
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Name</dt>
              <dd className="font-medium">{profile.fullName}</dd>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="font-medium">{profile.email}</dd>
              <dt className="text-muted-foreground">Role</dt>
              <dd className="font-medium">{profile.role}</dd>
              <dt className="text-muted-foreground">Active</dt>
              <dd className="font-medium">{profile.isActive ? 'Yes' : 'No'}</dd>
            </dl>
          ) : (
            <p className="text-muted-foreground">No profile data</p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
