import React, { useState, useEffect } from 'react';
import '../adminator.css';

export default function Navigation({ onSwitchView, isAuthenticated }) {
  const [open, setOpen] = useState(false);

  // Close menu on resize to desktop
  useEffect(() => {
    const handler = () => { if (window.innerWidth > 640) setOpen(false); };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const navLinks = [
    { label: 'Product',        action: () => { setOpen(false); onSwitchView('home'); } },
    { label: 'Security',       action: () => { setOpen(false); document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' }); } },
    { label: 'Privacy Policy', action: () => { setOpen(false); onSwitchView('info'); } },
  ];

  return (
    <nav style={{
      background: 'rgba(255,255,255,0.95)',
      borderBottom: '1px solid #E4E8EF',
      position: 'sticky', top: 0, zIndex: 50,
      backdropFilter: 'saturate(140%) blur(8px)',
      WebkitBackdropFilter: 'saturate(140%) blur(8px)',
    }}>
      <div style={{
        maxWidth: 1200, margin: '0 auto',
        padding: '0 20px', height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        {/* Brand */}
        <button
          onClick={() => { setOpen(false); onSwitchView('home'); }}
          style={{ display: 'flex', alignItems: 'center', gap: 9, border: 'none', background: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }}
        >
          <div style={{ width: 32, height: 32, background: '#2563EB', borderRadius: 8, display: 'grid', placeItems: 'center', boxShadow: '0 4px 10px -2px rgba(37,99,235,0.35)', flexShrink: 0 }}>
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <span style={{ fontFamily: "'Inter Tight',sans-serif", fontWeight: 700, fontSize: 16, letterSpacing: '-0.02em', color: '#1E293B' }}>SyncVeil</span>
        </button>

        {/* Desktop links */}
        <div className="nav-desktop-links" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {navLinks.map(item => (
            <button key={item.label} onClick={item.action}
              style={{ padding: '7px 13px', borderRadius: 8, border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: '#64748B', transition: 'background 160ms,color 160ms', whiteSpace: 'nowrap' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#F1F5F9'; e.currentTarget.style.color = '#1E293B'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#64748B'; }}>
              {item.label}
            </button>
          ))}
          {!isAuthenticated && (
            <button onClick={() => onSwitchView('auth-choice')}
              style={{ marginLeft: 8, padding: '8px 18px', background: '#2563EB', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, transition: 'background 180ms', whiteSpace: 'nowrap' }}
              onMouseEnter={e => e.currentTarget.style.background = '#1D4ED8'}
              onMouseLeave={e => e.currentTarget.style.background = '#2563EB'}>
              Sign In
            </button>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setOpen(o => !o)}
          className="nav-hamburger"
          aria-label="Toggle menu"
          aria-expanded={open}
          style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 8, borderRadius: 8, color: '#64748B', lineHeight: 0, flexShrink: 0 }}
        >
          {open
            ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          }
        </button>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div style={{ borderTop: '1px solid #E4E8EF', padding: '10px 16px 14px', display: 'flex', flexDirection: 'column', gap: 4, background: 'white' }}>
          {navLinks.map(item => (
            <button key={item.label} onClick={item.action}
              style={{ padding: '11px 14px', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500, color: '#475569', borderRadius: 8, transition: 'background 160ms' }}
              onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}>
              {item.label}
            </button>
          ))}
          {!isAuthenticated && (
            <button onClick={() => { setOpen(false); onSwitchView('auth-choice'); }}
              style={{ marginTop: 6, padding: '11px 14px', background: '#2563EB', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600, textAlign: 'center' }}>
              Sign In →
            </button>
          )}
        </div>
      )}

      <style>{`
        .nav-hamburger { display: none !important; }
        @media (max-width: 640px) {
          .nav-hamburger { display: flex !important; align-items: center; justify-content: center; }
          .nav-desktop-links { display: none !important; }
        }
      `}</style>
    </nav>
  );
}
