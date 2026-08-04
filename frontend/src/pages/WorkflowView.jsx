import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, normalizeDefinition } from '../api';
import RunPanel from '../components/RunPanel';

/**
 * Workflow view: edit the definition (JSON) and trigger runs.
 */
export default function WorkflowView() {
  const { id } = useParams();
  const [workflow, setWorkflow] = useState(null);
  const [definitionText, setDefinitionText] = useState('');
  const [jsonError, setJsonError] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [run, setRun] = useState(null); // active run (being tracked)

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError('');
    api.get(`/workflows/${id}`)
      .then((w) => {
        if (!active) return;
        setWorkflow(w);
        const def = normalizeDefinition(w.definition) || { nodes: [], connections: [] };
        setDefinitionText(JSON.stringify(def, null, 2));
      })
      .catch((err) => { if (active) setLoadError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  const handleSave = async () => {
    setJsonError('');
    let parsed;
    try {
      parsed = JSON.parse(definitionText);
    } catch (e) {
      setJsonError(`Invalid JSON: ${e.message}`);
      return;
    }
    setSaving(true);
    try {
      const updated = await api.put(`/workflows/${id}`, { definition: parsed });
      setWorkflow(updated);
    } catch (err) {
      setJsonError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRun = async () => {
    try {
      const created = await api.post(`/workflows/${id}/runs`, {});
      setRun(created);
    } catch (err) {
      setJsonError(err.message);
    }
  };

  if (loading) return <div className="page"><div className="muted">Loading…</div></div>;

  if (loadError) {
    return (
      <div className="page">
        <div className="alert alert-error">{loadError}</div>
        <Link to="/" className="back-link">← Back to projects</Link>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <Link to="/" className="back-link">← All projects</Link>
          <h1>{workflow.name}</h1>
          {workflow.description && <p className="page-sub">{workflow.description}</p>}
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={handleRun}>▶ Run</button>
        </div>
      </div>

      <div className="workflow-layout">
        <section className="panel">
          <div className="panel-head">
            <h2>Definition</h2>
            <button className="btn btn-ghost btn-sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
          {jsonError && <div className="alert alert-error">{jsonError}</div>}
          <textarea
            className="code-editor"
            value={definitionText}
            onChange={(e) => setDefinitionText(e.target.value)}
            spellCheck={false}
          />
          <p className="muted padding-h">
            Edit the workflow graph as JSON — nodes[] + connections[].
          </p>
        </section>

        <RunPanel run={run} onClear={() => setRun(null)} />
      </div>
    </div>
  );
}
