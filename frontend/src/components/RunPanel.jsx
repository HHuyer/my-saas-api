import { useEffect, useRef, useState } from 'react';
import { api } from '../api';

const TERMINAL = new Set(['COMPLETED', 'FAILED', 'STOPPED']);
const MAX_POLLS = 30; // rates: ~500ms each, stays well under the 100 req/15min backend limit
const POLL_MS = 600;

const STATUS_COLOR = {
  PENDING: 'status-pending',
  RUNNING: 'status-running',
  COMPLETED: 'status-completed',
  FAILED: 'status-failed',
  STOPPED: 'status-stopped',
};

/**
 * Polls and renders a workflow run: status, timing, output JSON, node logs.
 */
export default function RunPanel({ run, onClear }) {
  const [detail, setDetail] = useState(null);
  const [nodeLogs, setNodeLogs] = useState([]);
  const [polling, setPolling] = useState(false);
  const timerRef = useRef(null);
  const pollCountRef = useRef(0);

  const stopPolling = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  useEffect(() => {
    return stopPolling;
  }, []);

  useEffect(() => {
    if (!run) return;
    setDetail(null);
    setNodeLogs([]);
    pollCountRef.current = 0;

    const tick = async () => {
      try {
        const r = await api.get(`/runs/${run.id}`);
        setDetail(r);
        pollCountRef.current += 1;

        if (TERMINAL.has(r.status) || pollCountRef.current >= MAX_POLLS) {
          stopPolling();
          setPolling(false);
          // Fetch node logs once the run settles
          try {
            const logs = await api.get(`/runs/${run.id}/nodes`);
            setNodeLogs(Array.isArray(logs) ? logs : []);
          } catch { /* ignore */ }
        }
      } catch {
        stopPolling();
        setPolling(false);
      }
    };

    setPolling(true);
    tick();
    timerRef.current = setInterval(tick, POLL_MS);

    return stopPolling;
  }, [run]);

  if (!run) {
    return (
      <aside className="panel panel-muted">
        <h2>Run</h2>
        <p className="muted">Trigger a run to see its progress, output and node logs here.</p>
      </aside>
    );
  }

  const status = detail?.status || run.status || 'PENDING';
  const output = detail ? safeParse(detail.output) : null;
  const started = detail?.startedAt ? new Date(detail.startedAt) : null;
  const completed = detail?.completedAt ? new Date(detail.completedAt) : null;
  const duration =
    started && completed
      ? `${((completed - started) / 1000).toFixed(2)}s`
      : '—';

  return (
    <aside className="panel">
      <div className="panel-head">
        <h2>Run {detail ? `#${detail.id.slice(0, 8)}` : ''}</h2>
        <button className="btn btn-ghost btn-sm" onClick={onClear}>×</button>
      </div>

      <div className={`run-status ${STATUS_COLOR[status] || ''}`}>
        <span className="status-dot" />
        {status} {polling && !TERMINAL.has(status) && <span className="spin" />}
      </div>

      <dl className="run-facts">
        <div><dt>Started</dt><dd>{started ? started.toLocaleTimeString() : '—'}</dd></div>
        <div><dt>Finished</dt><dd>{completed ? completed.toLocaleTimeString() : '—'}</dd></div>
        <div><dt>Duration</dt><dd>{duration}</dd></div>
        {detail?.errorMessage && <div className="run-error"><dt>Error</dt><dd>{detail.errorMessage}</dd></div>}
      </dl>

      {output && (
        <details className="run-output" open>
          <summary>Output</summary>
          <pre>{JSON.stringify(output, null, 2)}</pre>
        </details>
      )}

      {nodeLogs.length > 0 && (
        <div className="run-nodes">
          <h3>Node logs</h3>
          <ul>
            {nodeLogs.map((log) => (
              <li key={log.id} className={`node-log ${log.status === 'SUCCESS' ? 'log-ok' : 'log-fail'}`}>
                <span className="node-log-name">{log.nodeId}</span>
                <span className="node-log-status">{log.status}</span>
                {log.errorMessage && <div className="node-log-error">{log.errorMessage}</div>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}

function safeParse(value) {
  if (value == null) return null;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return null; }
}
