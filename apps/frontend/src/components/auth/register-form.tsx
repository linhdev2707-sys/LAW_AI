'use client';

import { useMemo, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { RegisterSchema, type RegisterDto, type IAuthResponse } from '@law-ai/shared';
import { apiFetch, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MaterialIcon } from '@/components/landing/material-icon';

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<RegisterDto>({
    resolver: zodResolver(RegisterSchema),
    defaultValues: { email: '', password: '', fullName: '' },
  });

  // Live password strength so the user sees what's missing before submitting.
  const passwordValue = useWatch({ control, name: 'password' }) ?? '';
  const strength = useMemo(() => evaluatePassword(passwordValue), [passwordValue]);

  async function onSubmit(values: RegisterDto) {
    setError(null);
    setLoading(true);
    try {
      // 1. Call BE register endpoint
      await apiFetch<IAuthResponse>('/api/v1/auth/register', {
        method: 'POST',
        body: values,
        anonymous: true,
      });
      // 2. Auto-login after register
      const signInRes = await signIn('credentials', {
        email: values.email,
        password: values.password,
        redirect: false,
      });
      if (signInRes?.error) {
        setError('Đã đăng ký nhưng đăng nhập tự động thất bại. Vui lòng đăng nhập thủ công.');
        router.push('/login');
        return;
      }
      router.push('/chat');
      router.refresh();
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message);
      } else {
        setError('Đã có lỗi xảy ra. Vui lòng thử lại.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative w-full max-w-md">
      <div className="relative max-h-[calc(100vh-9rem)] overflow-y-auto rounded-2xl border border-brand-tertiary/25 bg-brand-surface-container/80 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl md:p-8 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
        {/* Top accent line */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-tertiary to-transparent"
        />

        {/* Brand */}
        <Link
          href="/"
          className="mb-6 flex items-center gap-3 transition-opacity hover:opacity-80"
        >
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
            Tạo tài khoản miễn phí
          </h1>
          <p className="mt-1.5 text-sm text-brand-on-surface-variant">
            Bắt đầu sử dụng trợ lý pháp lý AI trong vài giây
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

          {/* Full name */}
          <div className="space-y-2">
            <Label htmlFor="fullName" className="text-brand-on-surface">
              Họ và tên
            </Label>
            <div className="group relative">
              <MaterialIcon
                name="person"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-brand-on-surface-variant transition-colors group-focus-within:text-brand-tertiary"
              />
              <Input
                id="fullName"
                autoComplete="name"
                placeholder="Nguyễn Văn A"
                {...register('fullName')}
                className="h-11 border-brand-outline-variant/30 bg-brand-surface-container-lowest/60 pl-11 pr-3 text-brand-on-surface placeholder:text-brand-on-surface-variant/50 focus-visible:border-brand-tertiary focus-visible:ring-2 focus-visible:ring-brand-tertiary/30"
              />
            </div>
            {errors.fullName && (
              <p className="flex items-center gap-1.5 text-xs text-red-300">
                <MaterialIcon name="error" className="text-[14px]" />
                {errors.fullName.message}
              </p>
            )}
          </div>

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
            <Label htmlFor="password" className="text-brand-on-surface">
              Mật khẩu
            </Label>
            <div className="group relative">
              <MaterialIcon
                name="lock"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-brand-on-surface-variant transition-colors group-focus-within:text-brand-tertiary"
              />
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
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

            {/* Strength meter — only show once user starts typing */}
            {passwordValue.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <div className="flex gap-1">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        i < strength.score
                          ? strength.color
                          : 'bg-brand-outline-variant/20'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-xs text-brand-on-surface-variant">
                  {strength.label}
                </p>
                <ul className="space-y-0.5 text-xs text-brand-on-surface-variant/80">
                  <Requirement met={strength.checks.length} text="Ít nhất 8 ký tự" />
                  <Requirement met={strength.checks.upper} text="Có chữ hoa (A-Z)" />
                  <Requirement met={strength.checks.lower} text="Có chữ thường (a-z)" />
                  <Requirement met={strength.checks.digit} text="Có chữ số (0-9)" />
                </ul>
              </div>
            )}

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
            className="group h-11 w-full rounded-full bg-gradient-to-r from-brand-primary to-brand-tertiary font-label text-label-md font-semibold text-white shadow-lg shadow-brand-primary/30 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-brand-primary/50 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? (
              <>
                <span
                  aria-hidden
                  className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                />
                Đang tạo tài khoản…
              </>
            ) : (
              <>
                Tạo tài khoản
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

        {/* Sign in link */}
        <p className="text-center text-sm text-brand-on-surface-variant">
          Đã có tài khoản?{' '}
          <Link
            href="/login"
            className="font-semibold text-brand-tertiary transition-colors hover:text-brand-primary"
          >
            Đăng nhập
          </Link>
        </p>
      </div>

      {/* Footer trust note */}
      <p className="mt-4 text-center text-xs text-brand-on-surface-variant/70">
        <MaterialIcon name="shield" className="mr-1 align-middle text-[14px] text-brand-tertiary" />
        Bảo mật bởi mã hoá chuẩn ngân hàng · Tuân thủ GDPR
      </p>
    </div>
  );
}

function Requirement({ met, text }: { met: boolean; text: string }) {
  return (
    <li
      className={`flex items-center gap-1.5 transition-colors ${
        met ? 'text-brand-tertiary' : ''
      }`}
    >
      <MaterialIcon
        name={met ? 'check_circle' : 'radio_button_unchecked'}
        className={`text-[14px] ${met ? 'text-brand-tertiary' : 'text-brand-on-surface-variant/50'}`}
      />
      {text}
    </li>
  );
}

function evaluatePassword(pw: string) {
  const checks = {
    length: pw.length >= 8,
    upper: /[A-Z]/.test(pw),
    lower: /[a-z]/.test(pw),
    digit: /[0-9]/.test(pw),
  };
  const passed = Object.values(checks).filter(Boolean).length;
  const score = passed; // 0..4
  let label = '';
  let color = 'bg-red-400';
  if (pw.length === 0) {
    label = '';
    return { checks, score: 0, label, color };
  }
  if (passed <= 1) {
    label = 'Yếu — cần thêm ký tự hoa, thường và số';
    color = 'bg-red-400';
  } else if (passed === 2) {
    label = 'Trung bình — nên thêm chữ hoa và số';
    color = 'bg-amber-400';
  } else if (passed === 3) {
    label = 'Khá tốt — chỉ thiếu 1 loại ký tự';
    color = 'bg-cyan-400';
  } else {
    label = 'Mạnh — đáp ứng yêu cầu';
    color = 'bg-emerald-400';
  }
  return { checks, score, label, color };
}
