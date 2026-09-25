import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Aperture,
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
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
            onChange={(e) => setEmail(e.target.value)}
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
              onChange={(e) => setPassword(e.target.value)}
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
    </>
  );
}

export default LoginPage;
