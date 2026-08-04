import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

/**
 * Dashboard: list the current user's projects and create new ones.
 */
export default function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const load = () => {
    setLoading(true);
    api.get('/projects')
      .then((data) => setProjects(Array.isArray(data) ? data : []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setError('');
    try {
      await api.post('/projects', { name: name.trim(), description: description.trim() || undefined });
      setName('');
      setDescription('');
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Projects</h1>
          <p className="page-sub">Workflow containers — each project holds its own workflows.</p>
        </div>
      </div>

      <form className="create-bar" onSubmit={handleCreate}>
        <input
          placeholder="New project name…"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <button className="btn btn-primary" disabled={creating || !name.trim()}>
          {creating ? 'Creating…' : 'Create'}
        </button>
      </form>

      {error && <div className="alert alert-error">{error}</div>}

      {loading && <div className="muted">Loading projects…</div>}

      {!loading && projects.length === 0 && (
        <div className="empty-state">
          <p>No projects yet.</p>
          <p className="muted">Create your first project above to get started.</p>
        </div>
      )}

      <div className="card-grid">
        {projects.map((p) => (
          <Link key={p.id} to={`/projects/${p.id}`} className="card">
            <div className="card-title">{p.name}</div>
            {p.description && <div className="card-desc">{p.description}</div>}
            <div className="card-meta">Created {new Date(p.createdAt).toLocaleDateString()}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
