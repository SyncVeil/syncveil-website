import React, { useEffect, useState } from 'react';
import Navigation from './components/Navigation';
import Home from './components/views/Home';
import Dashboard from './components/views/Dashboard';
import AuthChoice from './components/views/AuthChoice';
import InfoPage from './components/views/InfoPage';
import Footer from './components/Footer';
import { authAPI, isAuthenticated, getCurrentUser, publicAPI } from './api';
import './styles.css';

// ── OAuth Callback Screen ──────────────────────────────────────────────────
function OAuthCallbackScreen({ status, onRetry }) {
  const providerLabel = status?.provider
    ? status.provider.charAt(0).toUpperCase() + status.provider.slice(1)
    : 'Provider';

  return (
    <div className="adm-root" data-theme="light" style={{display:'grid',placeItems:'center',minHeight:'100vh',background:'linear-gradient(135deg,#2563EB,#8B5CF6)'}}>
      <div style={{background:'#fff',borderRadius:20,padding:48,maxWidth:360,width:'100%',margin:'0 16px',textAlign:'center',boxShadow:'0 20px 40px -8px rgba(0,0,0,0.25)'}}>
        {status?.status === 'loading' && (
          <>
            <div style={{width:64,height:64,borderRadius:'50%',background:'#EFF6FF',display:'grid',placeItems:'center',margin:'0 auto 20px'}}>
              <div className="adm-spinner"/>
            </div>
            <h2 style={{fontFamily:"'Inter Tight',sans-serif",fontWeight:700,fontSize:20,color:'#1E293B',margin:'0 0 8px'}}>Connecting {providerLabel}…</h2>
            <p style={{fontSize:13,color:'#64748B',margin:0}}>Please wait while we link your account.</p>
          </>
        )}
        {status?.status === 'success' && (
          <>
            <div style={{width:64,height:64,borderRadius:'50%',background:'#ECFDF5',display:'grid',placeItems:'center',margin:'0 auto 20px'}}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
            <h2 style={{fontFamily:"'Inter Tight',sans-serif",fontWeight:700,fontSize:20,color:'#1E293B',margin:'0 0 8px'}}>{providerLabel} Connected!</h2>
            <p style={{fontSize:13,color:'#64748B',margin:'0 0 6px'}}>{status.message}</p>
            <p style={{fontSize:11,color:'#94A3B8',margin:0,fontFamily:'JetBrains Mono,monospace',letterSpacing:'0.04em'}}>RETURNING TO DASHBOARD…</p>
          </>
        )}
        {status?.status === 'error' && (
          <>
            <div style={{width:64,height:64,borderRadius:'50%',background:'#FEF2F2',display:'grid',placeItems:'center',margin:'0 auto 20px'}}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </div>
            <h2 style={{fontFamily:"'Inter Tight',sans-serif",fontWeight:700,fontSize:20,color:'#1E293B',margin:'0 0 8px'}}>Connection Failed</h2>
            <p style={{fontSize:13,color:'#EF4444',margin:'0 0 24px'}}>{status.message}</p>
            <button onClick={onRetry} className="btn btn--primary" style={{width:'100%',justifyContent:'center',padding:'11px 16px'}}>
              Back to Dashboard
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function App() {
  const [currentView, setCurrentView] = useState('home');
  const [isAuth, setIsAuth] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [verifyToken, setVerifyToken] = useState(null);
  // OAuth callback state: null | { provider, status: 'loading'|'success'|'error', message }
  const [oauthStatus, setOAuthStatus] = useState(null);
  const [oauthRefreshKey, setOAuthRefreshKey] = useState(0);

  // Check existing session on mount + attempt token refresh
  useEffect(() => {
    const authenticated = isAuthenticated();
    if (authenticated) {
      setIsAuth(true);
      setUser(getCurrentUser());
      // Proactively refresh token on mount (handles page reload after token age)
      authAPI.refresh().then(r => {
        if (r?.user) setUser(r.user);
      }).catch(() => {
        // Refresh failed = session truly expired → force logout
        setIsAuth(false);
        setUser(null);
      });
    }
    setLoading(false);
  }, []);

  // Auto-refresh access token every 12 minutes (expires in 15)
  useEffect(() => {
    if (!isAuth) return;
    const interval = setInterval(async () => {
      try {
        const r = await authAPI.refresh();
        if (r?.user) setUser(r.user);
      } catch {
        // Token refresh failed — session expired
        setIsAuth(false);
        setUser(null);
        setCurrentView('home');
      }
    }, 12 * 60 * 1000);
    return () => clearInterval(interval);
  }, [isAuth]);

  // Handle /verify-email?token=... deep links from email
  useEffect(() => {
    const path = window.location.pathname.replace(/\/+$/, '') || '/';
    const token = new URLSearchParams(window.location.search).get('token');
    if (path !== '/verify-email' || !token) return;

    setVerifyToken(token);
    setCurrentView('auth-choice');
    if (window.history?.replaceState) {
      window.history.replaceState({}, '', '/');
    }
  }, []);

  // Handle /oauth/google/callback and /oauth/microsoft/callback redirects
  useEffect(() => {
    const path = window.location.pathname.replace(/\/+$/, '');
    const match = path.match(/^\/oauth\/(google|microsoft)\/callback$/);
    if (!match) return;

    const provider = match[1];
    const params   = new URLSearchParams(window.location.search);
    const code     = params.get('code');
    const state    = params.get('state');

    // Clean URL immediately so a refresh doesn't re-trigger
    if (window.history?.replaceState) window.history.replaceState({}, '', '/');

    if (!code || !state) {
      // Bad redirect — just go back to wherever makes sense
      setCurrentView(isAuthenticated() ? 'dashboard' : 'home');
      return;
    }

    setOAuthStatus({ provider, status: 'loading' });
    setCurrentView('oauth-callback');

    publicAPI.completeOAuth(provider, code, state)
      .then(() => {
        setOAuthStatus({ provider, status: 'success',
          message: `Your ${provider.charAt(0).toUpperCase() + provider.slice(1)} account was connected successfully.` });
        // After 2s auto-navigate to dashboard and signal it to refresh connected accounts
        setTimeout(() => {
          setOAuthStatus(null);
          setOAuthRefreshKey(k => k + 1);
          setCurrentView(isAuthenticated() ? 'dashboard' : 'home');
        }, 2000);
      })
      .catch(err => {
        setOAuthStatus({ provider, status: 'error',
          message: err.message || `Failed to connect ${provider} account.` });
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Nav height CSS var
  useEffect(() => {
    const update = () => {
      const nav = document.querySelector('nav#public-nav');
      if (!nav || nav.style.display === 'none') return;
      document.documentElement.style.setProperty('--nav-height', `${nav.offsetHeight || 72}px`);
    };
    window.addEventListener('load', update);
    window.addEventListener('resize', update);
    update();
    return () => { window.removeEventListener('load', update); window.removeEventListener('resize', update); };
  }, []);

  const switchView = (viewId) => {
    setCurrentView(viewId);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  // Called by AuthChoice when auth completes successfully
  const handleAuth = (authUser) => {
    setIsAuth(true);
    setUser(authUser);
    switchView('dashboard');
  };

  const handleLogout = async (allDevices = false) => {
    // logout confirmation handled by button design
    try {
      await authAPI.logout(allDevices);
    } catch { /* ignore */ } finally {
      setIsAuth(false);
      setUser(null);
      switchView('home');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="bg-white text-slate-900 selection:bg-indigo-100 selection:text-indigo-900 overflow-x-hidden">
      {(currentView === 'home' || currentView === 'auth-choice' || currentView === 'info') && (
        <Navigation onSwitchView={switchView} isAuthenticated={isAuth} />
      )}

      <main id="main-content">
        {currentView === 'home' && (
          <Home
            onSwitchView={switchView}
            onScrollToSection={(id) => setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }), 0)}
          />
        )}

        {currentView === 'auth-choice' && (
          <AuthChoice
            onSwitchView={switchView}
            onAuth={handleAuth}
            initialMode={verifyToken ? 'verify' : undefined}
            initialToken={verifyToken || undefined}
          />
        )}

        {currentView === 'dashboard' && isAuth && (
          <Dashboard
            onLogout={handleLogout}
            onSwitchView={switchView}
            user={user}
            oauthRefreshKey={oauthRefreshKey}
          />
        )}

        {currentView === 'info' && <InfoPage onSwitchView={switchView} />}

        {currentView === 'oauth-callback' && (
          <OAuthCallbackScreen
            status={oauthStatus}
            onRetry={() => { setOAuthStatus(null); setCurrentView(isAuthenticated() ? 'dashboard' : 'home'); }}
          />
        )}
      </main>

      {!isAuth && <Footer />}
    </div>
  );
}

export default App;
