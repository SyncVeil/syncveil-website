import React, { useEffect, useState } from 'react';
import { publicAPI } from '../api';

const severityClass = {
  critical: 'text-rose-700 bg-rose-100 border-rose-200',
  high: 'text-amber-700 bg-amber-100 border-amber-200',
  medium: 'text-yellow-700 bg-yellow-100 border-yellow-200',
  low: 'text-emerald-700 bg-emerald-100 border-emerald-200',
};

export default function BreachMap() {
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadSnapshot = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await publicAPI.getSecuritySnapshot();
        setSnapshot(response.data);
      } catch (err) {
        console.error('Failed to load security snapshot:', err);
        setError(err.message || 'Failed to load security snapshot');
      } finally {
        setLoading(false);
      }
    };

    loadSnapshot();
  }, []);

  const trend = snapshot?.trend_7d || [];
  const maxFailed = trend.reduce((max, day) => Math.max(max, day.failed_attempts || 0), 1);

  return (
    <div className="space-y-8" style={{overflowX:'hidden'}}>
      <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-lg bg-white p-6" style={{padding:'clamp(14px,3vw,24px)'}}>
        <h3 className="text-lg font-bold text-slate-900 mb-1">Live Security Activity (Last 30 Days)</h3>
        <p className="text-sm text-slate-600 mb-5">
          Real telemetry generated from SyncVeil backend login protection systems.
        </p>

        {loading && <p className="text-sm text-slate-500">Loading security telemetry...</p>}
        {error && <p className="text-sm text-rose-600">{error}</p>}

        {!loading && !error && (
          <>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8" style={{gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))'}}>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-xs text-slate-500">Total Attempts</p>
                <p className="text-2xl font-bold text-slate-900">{snapshot?.total_attempts ?? 0}</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-xs text-slate-500">Blocked Attempts</p>
                <p className="text-2xl font-bold text-slate-900">{snapshot?.failed_attempts ?? 0}</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-xs text-slate-500">Risk Challenges</p>
                <p className="text-2xl font-bold text-slate-900">{snapshot?.challenge_events ?? 0}</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-xs text-slate-500">Cooldown Activations</p>
                <p className="text-2xl font-bold text-slate-900">{snapshot?.cooldown_events ?? 0}</p>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-slate-900">Failed Attempts Trend (7 Days)</h4>
              <div style={{overflowX:'auto',WebkitOverflowScrolling:'touch'}}>
              <div className="grid grid-cols-7 gap-2 h-28 items-end" style={{minWidth:280}}>
                {trend.map((day) => {
                  const value = day.failed_attempts || 0;
                  const ratio = Math.max(6, Math.round((value / maxFailed) * 100));
                  return (
                    <div key={day.date} className="flex flex-col items-center gap-2">
                      <div className="w-full bg-slate-100 rounded-md relative h-20 overflow-hidden">
                        <div
                          className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-indigo-600 to-teal-500 rounded-md"
                          style={{ height: `${ratio}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-500">{day.date.slice(5)}</span>
                    </div>
                  );
                })}
              </div></div>
            </div>
          </>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="p-6 bg-slate-50 rounded-xl border border-slate-200">
          <p className="text-sm text-slate-600 mb-2">Latest Incident</p>
          <p className="text-base font-bold text-slate-900">
            {snapshot?.last_incident ? new Date(snapshot.last_incident).toLocaleString() : 'No recent incidents'}
          </p>
          <p className="text-xs text-slate-500 mt-2">Derived from backend event logs</p>
        </div>
        <div className="p-6 bg-slate-50 rounded-xl border border-slate-200">
          <p className="text-sm text-slate-600 mb-2">Successful Attempts</p>
          <p className="text-3xl font-bold text-slate-900">{snapshot?.successful_attempts ?? 0}</p>
          <p className="text-xs text-emerald-600 mt-2">Verified and approved sessions</p>
        </div>
        <div className="p-6 bg-slate-50 rounded-xl border border-slate-200">
          <p className="text-sm text-slate-600 mb-2">Window</p>
          <p className="text-3xl font-bold text-slate-900">{snapshot?.window_days ?? 30}d</p>
          <p className="text-xs text-indigo-600 mt-2">Rolling telemetry interval</p>
        </div>
      </div>

      {snapshot?.recent_events?.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-slate-900">Recent Security Events</h4>
          {snapshot.recent_events.slice(0, 5).map((event, idx) => (
            <div key={`${event.timestamp}-${idx}`} className="p-4 bg-white rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{event.message}</p>
                <p className="text-xs text-slate-500">{new Date(event.timestamp).toLocaleString()}</p>
              </div>
              <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${severityClass[event.severity] || severityClass.low}`}>
                {(event.severity || 'low').toUpperCase()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
