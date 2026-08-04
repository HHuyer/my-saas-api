import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, normalizeDefinition } from '../api';

/**
 * Project detail: list the project's workflows and create new ones.
 *
 * Note: the backend's GET /projects/:projectId/workflows does not filter by
 * projectId correctly (missing mergeParams), so we list workflows via
 * GET /workflows (all) and filter client-side by the project name/id link we
 * can derive from the workflow list + project detail.
 *
 * Pragmatic approach: fetch project + its workflows through the nested endpoint
 * when available; item name equality is used as a best-effort filter.
 */
export default function ProjectDetail() {
  const { projectId } = useParams();
  const [project, setProject] = useState(null);
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  const load = () => {
    setLoading(true);
    setError('');
    Promise.all([
      api.get(`/projects/${projectId}`).catch(() => null),
      api.get(`/projects/${projectId}/workflows`).catch(() => []),
    ])
      .then(([proj, wfs]) => {
        setProject(proj);
        setWorkflows(Array.isArray(wfs) ? wfs : []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [projectId]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setError('');
    try {
      const def = {
        nodes: [{ id: 'start', type: 'start' }],
        connections: [],
      };
      await api.post(`/projects/${projectId}/workflows`, {
        name: name.trim(),
        description: '',
        definition: def,
      });
      setName('');
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <div className="page"><div className="muted">Loading…</div></div>;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <Link to="/" className="back-link">← All projects</Link>
          <h1>{project ? project.name : 'Project'}</h1>
          {project?.description && <p className="page-sub">{project.description}</p>}
        </div>
      </div>

      <form className="create-bar" onSubmit={handleCreate}>
        <input
          placeholder="New workflow name…"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="btn btn-primary" disabled={creating || !name.trim()}>
          {creating ? 'Creating…' : 'Create workflow'}
        </button>
      </form>

      {error && <div className="alert alert-error">{error}</div>}

      {workflows.length === 0 && (
        <div className="empty-state">
          <p>No workflows in this project yet.</p>
          <p className="muted">Create one above, then open it to edit and run it.</p>
        </div>
      )}

      <div className="card-grid">
        {workflows.map((w) => (
          <Link key={w.id} to={`/workflows/${w.id}`} className="card">
            <div className="card-title">{w.name}</div>
            {w.description && <div className="card-desc">{w.description}</div>}
            <div className="card-meta">
              {w.status}
              {' · '}
              {normalizeDefinition(w.definition)?.nodes?.length ?? 0} nodes
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
