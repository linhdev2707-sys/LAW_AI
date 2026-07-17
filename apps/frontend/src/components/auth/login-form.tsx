'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LoginSchema, type LoginDto } from '@law-ai/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MaterialIcon } from '@/components/landing/material-icon';

export function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const rawCallback = search.get('callbackUrl');
  const callbackUrl = rawCallback && rawCallback.startsWith('/') ? rawCallback : '/chat';
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginDto>({
    resolver: zodResolver(LoginSchema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(values: LoginDto) {
    setError(null);
    setLoading(true);
    const res = await signIn('credentials', { ...values, redirect: false });
    setLoading(false);
    if (res?.error) {
      setError('Email hoặc mật khẩu không đúng');
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <div className="relative w-full max-w-md">
      <div className="relative max-h-[calc(100vh-9rem)] overflow-y-auto rounded-2xl border border-brand-tertiary/25 bg-brand-surface-container/80 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl [scrollbar-width:none] md:p-8 [&::-webkit-scrollbar]:hidden">
        {/* Top accent line */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-tertiary to-transparent"
        />

        {/* Brand */}
        <Link href="/" className="mb-6 flex items-center gap-3 transition-opacity hover:opacity-80">
          <Image
            src="/logo.jpg"
            alt="iLaw"
            width={80}
            height={80}
            className="h-20 w-20 rounded-md object-contain"
            priority
          />
          <span className="font-headline text-2xl font-bold tracking-wide text-brand-on-surface">
            iLaw
          </span>
        </Link>

        {/* Heading */}
        <div className="mb-6">
          <h1 className="font-headline text-2xl font-semibold leading-tight text-brand-on-surface md:text-3xl">
            Chào mừng trở lại
          </h1>
          <p className="mt-1.5 text-sm text-brand-on-surface-variant">
            Đăng nhập để tiếp tục sử dụng trợ lý pháp lý AI của bạn
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-200"
            >
              <MaterialIcon name="error" className="mt-0.5 text-[18px] text-red-300" />
              <span>{error}</span>
            </div>
          )}

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-brand-on-surface">
              Email
            </Label>
            <div className="group relative">
              <MaterialIcon
                name="mail"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-brand-on-surface-variant transition-colors group-focus-within:text-brand-tertiary"
              />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                {...register('email')}
                className="h-11 border-brand-outline-variant/30 bg-brand-surface-container-lowest/60 pl-11 pr-3 text-brand-on-surface placeholder:text-brand-on-surface-variant/50 focus-visible:border-brand-tertiary focus-visible:ring-2 focus-visible:ring-brand-tertiary/30"
              />
            </div>
            {errors.email && (
              <p className="flex items-center gap-1.5 text-xs text-red-300">
                <MaterialIcon name="error" className="text-[14px]" />
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-brand-on-surface">
                Mật khẩu
              </Label>
              <Link
                href="#"
                className="text-xs font-medium text-brand-tertiary transition-colors hover:text-brand-primary"
              >
                Quên mật khẩu?
              </Link>
            </div>
            <div className="group relative">
              <MaterialIcon
                name="lock"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-brand-on-surface-variant transition-colors group-focus-within:text-brand-tertiary"
              />
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                {...register('password')}
                className="h-11 border-brand-outline-variant/30 bg-brand-surface-container-lowest/60 pl-11 pr-11 text-brand-on-surface placeholder:text-brand-on-surface-variant/50 focus-visible:border-brand-tertiary focus-visible:ring-2 focus-visible:ring-brand-tertiary/30"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-brand-on-surface-variant transition-colors hover:bg-white/5 hover:text-brand-tertiary"
              >
                <MaterialIcon
                  name={showPassword ? 'visibility_off' : 'visibility'}
                  className="text-[20px]"
                />
              </button>
            </div>
            {errors.password && (
              <p className="flex items-center gap-1.5 text-xs text-red-300">
                <MaterialIcon name="error" className="text-[14px]" />
                {errors.password.message}
              </p>
            )}
          </div>

          {/* Submit */}
          <Button
            type="submit"
            disabled={loading}
            className="font-label group h-11 w-full rounded-full bg-gradient-to-r from-brand-primary to-brand-tertiary text-label-md font-semibold text-white shadow-lg shadow-brand-primary/30 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-brand-primary/50 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? (
              <>
                <span
                  aria-hidden
                  className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                />
                Đang đăng nhập…
              </>
            ) : (
              <>
                Đăng nhập
                <MaterialIcon
                  name="arrow_forward"
                  className="ml-2 text-[18px] transition-transform group-hover:translate-x-0.5"
                />
              </>
            )}
          </Button>
        </form>

        {/* Divider */}
        <div className="my-5 flex items-center gap-3 text-xs text-brand-on-surface-variant/60">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-brand-outline-variant/30" />
          <span>hoặc</span>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-brand-outline-variant/30" />
        </div>

        {/* Register link */}
        <p className="text-center text-sm text-brand-on-surface-variant">
          Chưa có tài khoản?{' '}
          <Link
            href="/register"
            className="font-semibold text-brand-tertiary transition-colors hover:text-brand-primary"
          >
            Tạo tài khoản miễn phí
          </Link>
        </p>
      </div>

      {/* Footer trust note */}
      <p className="mt-4 text-center text-xs text-brand-on-surface-variant/70">
        <MaterialIcon name="shield" className="mr-1 align-middle text-[14px] text-brand-tertiary" />
        Đăng nhập an toàn · Mã hoá đầu cuối
      </p>
    </div>
  );
}
