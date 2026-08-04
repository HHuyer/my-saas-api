import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../auth';

/**
 * Login page — uses the backend's dummy test-login endpoint.
 */
export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('test@example.com');
  const [name, setName] = useState('Test User');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email.trim() || 'test@example.com', name.trim() || 'Test User');
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-heading">
          <span className="brand-mark brand-large">◇</span>
          <h1>Workflow</h1>
          <p>Build and run automation workflows</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Email</span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </label>

          <label className="field">
            <span>Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </label>

          <label className="field">
            <span>Password (ignored — dev mode)</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>

          {error && <div className="alert alert-error">{error}</div>}

          <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="auth-hint">Development demo — any valid email creates an account.</p>
      </div>
    </div>
  );
}
