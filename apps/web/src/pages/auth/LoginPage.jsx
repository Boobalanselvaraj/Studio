import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Aperture,
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
  Building2,
  Users,
  Sparkles,
  Check,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { authApi } from '../../api/services';
import { useAuthStore } from '../../stores/authStore';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [activePreset, setActivePreset] = useState('');
  const navigate = useNavigate();

  async function submit(e) {
    if (e) e.preventDefault();
    setBusy(true);
    setError('');

    try {
      const data = await authApi.login({ email, password });
      useAuthStore.getState().setAuth(data);

      if (data.user?.is_super_admin) {
        navigate('/admin/studios');
      } else if (data.studios && data.studios.length > 0) {
        navigate('/studio/dashboard');
      } else {
        navigate('/customer/galleries');
      }
    } catch (err) {
      setError(
        err.response?.data?.error ||
          'Could not reach the authentication service. Please check that the API backend is running.'
      );
    } finally {
      setBusy(false);
    }
  }

  const selectPreset = (roleEmail, rolePassword, roleKey) => {
    setEmail(roleEmail);
    setPassword(rolePassword);
    setActivePreset(roleKey);
    setError('');
  };

  return (
    <>
      <span className="login-icon">
        <Aperture size={27} />
      </span>
      <p className="eyebrow">WELCOME TO STUDIOFLOW</p>
      <h1 className="login-title">Back to your creative space.</h1>
      <p className="login-description">Sign in and pick up where inspiration left off.</p>

      <form className="form-stack" onSubmit={submit}>
        <label>
          Email address
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setActivePreset('');
            }}
            autoComplete="username"
            placeholder="you@yourstudio.com"
            required
          />
        </label>

        <label>
          Password
          <div className="password-field">
            <input
              type={visible ? 'text' : 'password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setActivePreset('');
              }}
              autoComplete="current-password"
              placeholder="Enter your password"
              required
            />
            <button
              type="button"
              aria-label={visible ? 'Hide password' : 'Show password'}
              onClick={() => setVisible(!visible)}
            >
              {visible ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </label>

        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}

        <Button type="submit" disabled={busy} className="w-full mt-2">
          {busy ? (
            <Loader2 size={17} className="animate-spin" />
          ) : (
            <>
              Sign in to your account
              <ArrowRight size={17} />
            </>
          )}
        </Button>
      </form>

      {/* Quick Demo Credentials */}
      <div className="mt-8 pt-6 border-t border-border">
        <div className="flex items-center gap-1.5 text-xs text-muted font-medium mb-3">
          <Sparkles size={14} className="text-amber-500" />
          <span>Quick 1-Click Demo Accounts:</span>
        </div>

        <div className="grid grid-cols-1 gap-2">
          <button
            type="button"
            className={`p-2.5 rounded-lg border text-left transition-all flex items-center justify-between ${
              activePreset === 'admin'
                ? 'border-brand-primary bg-brand-primary/5 shadow-sm'
                : 'border-border bg-surface-2 hover:bg-surface-3'
            }`}
            onClick={() => selectPreset('admin@photostudio.io', 'admin123456', 'admin')}
          >
            <div className="flex items-center gap-2.5">
              <span className="p-1.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <ShieldCheck size={16} />
              </span>
              <div>
                <div className="text-xs font-semibold flex items-center gap-1.5">
                  Super Admin
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                    Platform Master
                  </span>
                </div>
                <div className="text-[11px] text-muted font-mono">admin@photostudio.io</div>
              </div>
            </div>
            {activePreset === 'admin' && <Check size={16} className="text-brand-primary" />}
          </button>

          <button
            type="button"
            className={`p-2.5 rounded-lg border text-left transition-all flex items-center justify-between ${
              activePreset === 'studio'
                ? 'border-brand-primary bg-brand-primary/5 shadow-sm'
                : 'border-border bg-surface-2 hover:bg-surface-3'
            }`}
            onClick={() => selectPreset('owner@lumina.com', 'studio123456', 'studio')}
          >
            <div className="flex items-center gap-2.5">
              <span className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Building2 size={16} />
              </span>
              <div>
                <div className="text-xs font-semibold flex items-center gap-1.5">
                  Studio Owner
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                    Lumina Studio
                  </span>
                </div>
                <div className="text-[11px] text-muted font-mono">owner@lumina.com</div>
              </div>
            </div>
            {activePreset === 'studio' && <Check size={16} className="text-brand-primary" />}
          </button>

          <button
            type="button"
            className={`p-2.5 rounded-lg border text-left transition-all flex items-center justify-between ${
              activePreset === 'client'
                ? 'border-brand-primary bg-brand-primary/5 shadow-sm'
                : 'border-border bg-surface-2 hover:bg-surface-3'
            }`}
            onClick={() => selectPreset('sarah.client@example.com', 'customer123456', 'client')}
          >
            <div className="flex items-center gap-2.5">
              <span className="p-1.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <Users size={16} />
              </span>
              <div>
                <div className="text-xs font-semibold flex items-center gap-1.5">
                  Client / Customer
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                    Client Portal
                  </span>
                </div>
                <div className="text-[11px] text-muted font-mono">sarah.client@example.com</div>
              </div>
            </div>
            {activePreset === 'client' && <Check size={16} className="text-brand-primary" />}
          </button>
        </div>
      </div>
    </>
  );
}

export default LoginPage;
