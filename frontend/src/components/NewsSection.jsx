import React, { useEffect, useState } from 'react';
import { publicAPI } from '../api';

const levelClass = {
  critical: 'bg-rose-100 text-rose-700',
  high: 'bg-amber-100 text-amber-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-emerald-100 text-emerald-700',
};

export default function NewsSection() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadEvents = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await publicAPI.getSecuritySnapshot();
        setEvents(response.data?.recent_events || []);
      } catch (err) {
        console.error('Failed to load events:', err);
        setError(err.message || 'Failed to load events');
      } finally {
        setLoading(false);
      }
    };

    loadEvents();
  }, []);

  return (
    <section className="py-20 lg:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl lg:text-5xl font-extrabold text-slate-900 mb-6" style={{fontSize:"clamp(1.75rem,5vw,3rem)"}}>Security Operations Feed</h2>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Live operational events produced by SyncVeil authentication safeguards.
          </p>
        </div>

        {loading && <p className="text-center text-slate-500">Loading event feed...</p>}
        {error && <p className="text-center text-rose-600">{error}</p>}

        {!loading && !error && (
          <div className="space-y-4">
            {events.length === 0 && (
              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 text-center text-slate-600">
                No recent security events recorded yet.
              </div>
            )}

            {events.map((event, idx) => (
              <div key={`${event.timestamp}-${idx}`} className="p-6 bg-gradient-to-r from-slate-50 to-white rounded-2xl border border-slate-200 hover:border-indigo-300 hover:shadow-lg transition-all duration-300" style={{padding:"clamp(14px,3vw,24px)"}}>
                <div className="flex items-start gap-4">
                  <div className="text-3xl">{event.success ? '✅' : '🛡️'}</div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-slate-900 mb-2">{event.message}</h3>
                    <p className="text-sm text-slate-600 mb-3">{new Date(event.timestamp).toLocaleString()}</p>
                    <div className="flex flex-wrap gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${levelClass[event.severity] || levelClass.low}`}>
                        {(event.severity || 'low').toUpperCase()}
                      </span>
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                        {event.success ? 'Verified' : 'Mitigated'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
