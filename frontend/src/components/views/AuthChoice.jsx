import React, { useState, useRef, useEffect } from 'react';
import { authAPI, passkeyAPI } from '../../api';
import '../../adminator.css';

const COUNTRIES = ['Afghanistan','Albania','Algeria','Argentina','Australia','Austria','Bangladesh','Belgium','Brazil','Canada','Chile','China','Colombia','Croatia','Czech Republic','Denmark','Egypt','Ethiopia','Finland','France','Germany','Ghana','Greece','Hungary','India','Indonesia','Iran','Iraq','Ireland','Israel','Italy','Japan','Jordan','Kenya','Malaysia','Mexico','Morocco','Netherlands','New Zealand','Nigeria','Norway','Pakistan','Peru','Philippines','Poland','Portugal','Romania','Russia','Saudi Arabia','Singapore','South Africa','South Korea','Spain','Sri Lanka','Sweden','Switzerland','Taiwan','Thailand','Turkey','Ukraine','United Arab Emirates','United Kingdom','United States','Vietnam','Other'];

// ── Passkey PIN boxes ─────────────────────────────────────────────────────────
const PinBoxes = ({ value, onChange, autoFocus }) => {
  const refs = [useRef(),useRef(),useRef(),useRef(),useRef(),useRef()];
  const digits = (value||'').split('').concat(Array(6).fill('')).slice(0,6);

  const handleKey = (i, e) => {
    if (e.key === 'Backspace') {
      const next = digits.map((d,idx) => idx===i ? '' : d).join('');
      onChange(next);
      if (i > 0) setTimeout(() => refs[i-1].current?.focus(), 0);
      return;
    }
    if (e.key === 'ArrowLeft' && i > 0) { refs[i-1].current?.focus(); return; }
    if (e.key === 'ArrowRight' && i < 5) { refs[i+1].current?.focus(); return; }
  };

  const handleInput = (i, e) => {
    const ch = e.target.value.replace(/\D/g,'').slice(-1);
    if (!ch) return;
    const next = digits.map((d,idx) => idx===i ? ch : d).join('');
    onChange(next);
    if (i < 5) setTimeout(() => refs[i+1].current?.focus(), 0);
  };

  const handlePaste = (e) => {
    const paste = e.clipboardData.getData('text').replace(/\D/g,'').slice(0,6);
    onChange(paste.padEnd(6,'').slice(0,6));
    e.preventDefault();
    if (paste.length > 0) refs[Math.min(paste.length, 5)].current?.focus();
  };

  useEffect(() => { if (autoFocus) refs[0].current?.focus(); }, [autoFocus]);

  return (
    <div style={{display:'flex',gap:8,justifyContent:'center',margin:'16px 0'}}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={refs[i]}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d}
          onChange={e => handleInput(i, e)}
          onKeyDown={e => handleKey(i, e)}
          onPaste={handlePaste}
          style={{
            width:44, height:52, textAlign:'center', fontSize:22, fontWeight:700,
            border: d ? '2px solid var(--primary)' : '2px solid var(--border)',
            borderRadius:10, background:'var(--surface)',
            color:'var(--text)', outline:'none', transition:'border-color .15s',
            caretColor:'transparent',
          }}
        />
      ))}
    </div>
  );
};

// ── Password strength ─────────────────────────────────────────────────────────
const StrengthBar = ({ password }) => {
  const s = [password.length>=8,/[A-Z]/.test(password),/[0-9]/.test(password),/[^A-Za-z0-9]/.test(password)].filter(Boolean).length;
  const colors = ['','w1','w2','w3','w4'];
  const labels = ['','Weak','Fair','Good','Strong'];
  if(!password) return null;
  return (
    <div>
      <div className="strength-bar">{[1,2,3,4].map(i=><span key={i} className={i<=s?colors[s]:''}/>)}</div>
      <p style={{fontSize:11,fontWeight:600,marginTop:4,color:s<=1?'var(--danger)':s===2?'var(--warning)':s===3?'var(--warning)':'var(--success)'}}>{labels[s]}</p>
    </div>
  );
};

// ── Inline field alert ────────────────────────────────────────────────────────
const Err = ({msg}) => msg ? (
  <div className="adm-alert danger" style={{marginTop:4}}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
    <span>{msg}</span>
  </div>
) : null;

const Suc = ({msg}) => msg ? (
  <div className="adm-alert success" style={{marginTop:4}}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
    <span>{msg}</span>
  </div>
) : null;

// MODES: login | otp | signup1 | signup2 | verify | forgot | reset | passkey_login | passkey_setup | passkey_prompt
export default function AuthChoice({ onAuth, onSwitchView, initialMode, initialToken }) {
  const [mode,       setMode]       = useState(initialMode || 'login');
  const [showPw,     setShowPw]     = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [err,        setErr]        = useState('');
  const [suc,        setSuc]        = useState('');
  const [savedEmail, setSavedEmail] = useState('');
  const [savedPw,    setSavedPw]    = useState('');
  const [passkeyPin, setPasskeyPin] = useState('');
  const [form,       setForm]       = useState({ email:'', password:'', full_name:'', phone:'', country:'', date_of_birth:'', otp: initialToken||'' });

  const setF = k => e => { setForm(p=>({...p,[k]:e.target.value})); setErr(''); };
  const go   = m => { setMode(m); setErr(''); setSuc(''); setForm(p=>({...p,otp:''})); setPasskeyPin(''); };

  // ── Login ──────────────────────────────────────────────────────────────────
  const handleLogin = async e => {
    e.preventDefault();
    if(!form.email||!form.password){setErr('Fill in all fields.');return;}
    setLoading(true); setErr('');
    try {
      const res = await authAPI.login(form.email, form.password);
      if(res.challengeRequired){
        setSavedEmail(form.email); setSavedPw(form.password);
        if(res.has_passkey) {
          // User has a passkey — offer passkey login shortcut
          setSuc(''); go('passkey_login');
        } else {
          setSuc(res.challenge_token?`Dev code: ${res.challenge_token}`:'Sign-in code sent to your email.');
          go('otp');
        }
      }
    } catch(e){ setErr(e.message||'Login failed'); }
    finally{ setLoading(false); }
  };

  // ── Passkey login ─────────────────────────────────────────────────────────
  const handlePasskeyLogin = async () => {
    if(passkeyPin.replace(/\D/g,'').length < 6){ setErr('Enter your 6-digit passkey.'); return; }
    setLoading(true); setErr('');
    try {
      const res = await passkeyAPI.verifyPasskey(savedEmail, passkeyPin);
      onAuth?.(res.user);
    } catch(e){ setErr(e.message||'Incorrect passkey'); }
    finally{ setLoading(false); }
  };

  // ── Passkey setup (after registration/verify, or from settings) ───────────
  const handlePasskeySetup = async () => {
    if(passkeyPin.replace(/\D/g,'').length < 6){ setErr('Enter a 6-digit PIN.'); return; }
    setLoading(true); setErr('');
    try {
      await passkeyAPI.createPasskey(passkeyPin);
      setSuc('Passkey saved! You can use this PIN to sign in on any device.');
      // After a brief pause, proceed to dashboard
      setTimeout(() => onAuth?.(null), 1800);
    } catch(e){ setErr(e.message||'Failed to save passkey'); }
    finally{ setLoading(false); }
  };

  // ── OTP ───────────────────────────────────────────────────────────────────
  const handleOtp = async e => {
    e.preventDefault();
    if(!form.otp.trim()){setErr('Enter the code from your email.');return;}
    setLoading(true); setErr('');
    try {
      const res = await authAPI.verifyLoginChallenge(savedEmail||form.email, form.otp);
      if(res.totpRequired){ setSuc(''); go('totp'); }
      else if(res.success) {
        const promptPasskey = sessionStorage.getItem('sv_passkey_prompt');
        sessionStorage.removeItem('sv_passkey_prompt');
        if(promptPasskey) { setSuc(''); go('passkey_prompt'); }
        else onAuth?.(res.user);
      }
    } catch(e){ setErr(e.message||'Invalid code'); }
    finally{ setLoading(false); }
  };

  // ── TOTP (authenticator app) ──────────────────────────────────────────────
  const handleTotp = async e => {
    e.preventDefault();
    if(!form.otp.trim()){setErr('Enter the 6-digit code from your authenticator app.');return;}
    setLoading(true); setErr('');
    try {
      const res = await authAPI.verifyTotpChallenge(savedEmail||form.email, form.otp);
      if(res.success) onAuth?.(res.user);
    } catch(e){ setErr(e.message||'Invalid authenticator code'); }
    finally{ setLoading(false); }
  };

  const handleResendOtp = async () => {
    try{
      if(savedPw){
        await authAPI.login(savedEmail||form.email, savedPw);
      } else {
        await authAPI.resendVerification(savedEmail||form.email);
      }
      setSuc('New code sent.');
    } catch{ setSuc('Code re-sent.'); }
  };

  // ── Signup step 1 ─────────────────────────────────────────────────────────
  const handleSignup1 = e => {
    e.preventDefault();
    if(!form.email||!form.password||!form.full_name){setErr('Fill in all fields.');return;}
    if(form.password.length<8){setErr('Password must be at least 8 characters.');return;}
    setErr(''); go('signup2');
  };

  // ── Signup step 2 ─────────────────────────────────────────────────────────
  const handleSignup2 = async e => {
    e.preventDefault();
    setLoading(true); setErr('');
    try {
      await authAPI.signup(form.email, form.password, form.full_name, form.phone, form.country, form.date_of_birth);
      setSavedEmail(form.email);
      setSuc('Account created! Check your email for a verification code.');
      go('verify');
    } catch(e){ setErr(e.message||'Signup failed'); }
    finally{ setLoading(false); }
  };

  // ── Verify email ──────────────────────────────────────────────────────────
  const handleVerify = async e => {
    e.preventDefault();
    if(!form.otp.trim()){setErr('Enter the verification code.');return;}
    setLoading(true); setErr('');
    try {
      await authAPI.verifyEmail(form.otp.trim());
      if(savedPw) {
        // came from signup flow — auto-trigger login challenge, then prompt passkey setup
        const login = await authAPI.login(savedEmail, savedPw).catch(()=>null);
        if(login?.challengeRequired){
          setSuc('Email verified! Sign-in code sent.');
          // After OTP login completes, passkey prompt will show via passkey_prompt mode
          // Store intent for after OTP
          sessionStorage.setItem('sv_passkey_prompt', '1');
          go('otp');
          return;
        }
      }
      setSuc('Email verified! You can now sign in.'); go('login');
    } catch(e){ setErr(e.message||'Verification failed'); }
    finally{ setLoading(false); }
  };

  // ── Forgot password ───────────────────────────────────────────────────────
  const handleForgot = async e => {
    e.preventDefault();
    if(!form.email){setErr('Enter your email.');return;}
    setLoading(true); setErr('');
    try {
      await authAPI.forgotPassword(form.email);
      setSavedEmail(form.email);
      setSuc('Reset code sent to your email.');
      go('reset');
    } catch(e){ setErr(e.message||'Failed to send reset code'); }
    finally{ setLoading(false); }
  };

  // ── Reset password ────────────────────────────────────────────────────────
  const handleReset = async e => {
    e.preventDefault();
    if(!form.otp||!form.password){setErr('Fill in all fields.');return;}
    setLoading(true); setErr('');
    try {
      await authAPI.resetPassword(savedEmail, form.otp, form.password);
      setSuc('Password reset! You can now sign in.');
      go('login');
    } catch(e){ setErr(e.message||'Reset failed'); }
    finally{ setLoading(false); }
  };

  // ── Shared input style ────────────────────────────────────────────────────
  const inp = (key, type='text', placeholder='') => (
    <input className="input" type={type} value={form[key]} onChange={setF(key)} placeholder={placeholder} required/>
  );

  const pwField = (key, placeholder='••••••••') => (
    <div style={{position:'relative'}}>
      <input className="input" type={showPw?'text':'password'} value={form[key]} onChange={setF(key)} placeholder={placeholder} style={{paddingRight:40}}/>
      <button type="button" onClick={()=>setShowPw(v=>!v)} style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',color:'var(--t-muted)',lineHeight:0,border:'none',background:'none',cursor:'pointer'}}>
        {showPw
          ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
          : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        }
      </button>
    </div>
  );

  const submitBtn = (label, loadLabel='Please wait…', btnId=undefined) => (
    <button id={btnId} type="submit" className="btn btn--primary auth-submit" disabled={loading}>
      {loading ? loadLabel : label}
      {!loading && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 5l7 7-7 7"/></svg>}
    </button>
  );

  // ── Aside copy ────────────────────────────────────────────────────────────
  const asideCopy = {
    login:   { h:'The security dashboard your team actually trusts.', p:'Monitor breaches, manage sessions, and encrypt your files — all in one privacy-first workspace.' },
    signup1: { h:'Your data belongs to you, not us.', p:'Create your account and take back control of your digital identity with military-grade encryption.' },
    signup2: { h:'Almost there.', p:'Just a few more details to personalise your security workspace.' },
    otp:     { h:'Two-factor authentication.', p:'Enter the code from your email to verify it\'s really you. Codes expire in 10 minutes.' },
    totp:    { h:'Authenticator verification.', p:'Enter the 6-digit code from your authenticator app (Google Authenticator, Microsoft Authenticator, etc).' },
    verify:  { h:'Verify your email address.', p:'We sent a 6-digit code to your inbox. Enter it below to activate your account.' },
    forgot:  { h:'Forgotten passwords happen.', p:'Enter your email and we\'ll send a reset code. You\'ll be back in seconds.' },
    reset:   { h:'Create a new password.', p:'Use the code from your email together with your new password to regain access.' },
    passkey_login:  { h:'One tap sign-in.', p:'Your 6-digit passkey is stored securely in the cloud — works on every device, no email code needed.' },
    passkey_setup:  { h:'Set up your passkey.', p:'A 6-digit PIN saved to the cloud. Use it to sign in instantly from any device.' },
    passkey_prompt: { h:'Speed up future sign-ins.', p:'Set a 6-digit cloud passkey and skip the email code next time — on any device, anywhere.' },
  };
  const copy = asideCopy[mode]||asideCopy.login;

  return (
    <div className="adm-root" data-theme="light">
      <div className="adm-auth-shell">

        {/* ── Aside ── */}
        <aside className="auth-aside">
          <div className="auth-brand">
            <div className="logo">
              <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <div className="name">SyncVeil</div>
          </div>

          <div className="auth-aside-body">
            <span className="auth-aside-eyebrow">Privacy-first security</span>
            <h1>{copy.h}</h1>
            <p>{copy.p}</p>

            <div className="auth-quote">
              "SyncVeil replaced three separate security tools and gave us a single encrypted workspace we can actually trust."
              <div className="auth-quote-author">
                <div className="av">SK</div>
                <div>Sara Kim · Head of Security Engineering</div>
              </div>
            </div>
          </div>

          <div className="auth-aside-footer">
            <span>© {new Date().getFullYear()} SyncVeil</span>
            <span>END-TO-END ENCRYPTED</span>
          </div>
        </aside>

        {/* ── Main ── */}
        <main className="auth-main">
          <div className="auth-main-top">
            <button className="back-link" onClick={()=>onSwitchView?.('home')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
              Back to home
            </button>
            {mode==='login' && (
              <div className="switch-link">New here?<a onClick={()=>go('signup1')}>Create account</a></div>
            )}
            {(mode==='signup1'||mode==='signup2') && (
              <div className="switch-link">Have an account?<a onClick={()=>go('login')}>Sign in</a></div>
            )}
          </div>

          <div className="auth-card">

            {/* ── LOGIN ── */}
            {mode==='login' && (
              <>
                <h2>Welcome back</h2>
                <p className="sub">Sign in to your SyncVeil workspace.</p>
                <form className="auth-form" onSubmit={handleLogin}>
                  <div className="field">
                    <label className="field-label">Email</label>
                    {inp('email','email','you@company.com')}
                  </div>
                  <div className="field">
                    <div className="field-row">
                      <label className="field-label">Password</label>
                      <button type="button" className="field-row" style={{fontSize:12,color:'var(--primary)',fontWeight:600,border:'none',background:'none',cursor:'pointer'}} onClick={()=>go('forgot')}>Forgot?</button>
                    </div>
                    {pwField('password')}
                  </div>
                  {err && <Err msg={err}/>}
                  {suc && <Suc msg={suc}/>}
                  {submitBtn('Sign in')}
                </form>
                <div className="auth-divider">or link after sign-in</div>
                <div className="social-row">
                  <button className="social-btn" type="button" title="Sign in above then link Google from your dashboard" style={{opacity:0.55,cursor:'default'}} tabIndex={-1}>
                    <svg viewBox="0 0 24 24" width="14" height="14"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57C20.85 18.09 22 15.48 22 12.25z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                    Google
                  </button>
                  <button className="social-btn" type="button" title="GitHub — coming soon" style={{opacity:0.55,cursor:'default'}} tabIndex={-1}>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 .5a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.04c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.74.08-.73.08-.73 1.21.08 1.85 1.24 1.85 1.24 1.07 1.83 2.81 1.3 3.5 1 .11-.78.42-1.3.76-1.6-2.66-.3-5.46-1.33-5.46-5.93 0-1.31.47-2.39 1.24-3.23-.13-.3-.54-1.53.11-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.65.25 2.88.12 3.18.77.84 1.24 1.92 1.24 3.23 0 4.61-2.81 5.62-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58A12 12 0 0 0 12 .5z"/></svg>
                    GitHub
                  </button>
                  <button className="social-btn" type="button" title="Apple — coming soon" style={{opacity:0.55,cursor:'default'}} tabIndex={-1}>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M16.4 12.6c0-2.18 1.78-3.22 1.86-3.27-1.02-1.49-2.6-1.7-3.16-1.72-1.34-.13-2.62.79-3.3.79-.7 0-1.74-.78-2.86-.75-1.47.02-2.83.86-3.59 2.18-1.54 2.66-.39 6.6 1.1 8.76.74 1.06 1.6 2.25 2.74 2.21 1.1-.05 1.51-.71 2.84-.71s1.7.71 2.86.69c1.18-.02 1.93-1.07 2.65-2.14.84-1.23 1.18-2.43 1.2-2.49-.03-.01-2.3-.88-2.32-3.55zM14.27 5.6c.6-.74 1.01-1.74.9-2.75-.87.04-1.93.58-2.55 1.3-.55.65-1.04 1.69-.91 2.67.97.07 1.96-.49 2.56-1.22z"/></svg>
                    Apple
                  </button>
                </div>
                <p style={{textAlign:'center',fontSize:11,color:'var(--t-light)',marginTop:-8,marginBottom:4}}>
                  Link Google &amp; Microsoft from your dashboard after signing in.
                </p>
                <div className="auth-main-bottom">
                  By signing in you agree to our <a onClick={()=>onSwitchView?.('info')}>Terms</a> and <a onClick={()=>onSwitchView?.('info')}>Privacy Policy</a>.
                </div>
              </>
            )}

            {/* ── OTP ── */}
            {mode==='otp' && (
              <>
                <h2>Check your email</h2>
                <p className="sub">We sent a 6-digit sign-in code to <strong>{savedEmail||'your email'}</strong>.</p>
                <form className="auth-form" onSubmit={handleOtp}>
                  <div className="otp-box">
                    <input type="text" inputMode="numeric" maxLength={6} value={form.otp} onChange={e=>{setF('otp')(e);if(e.target.value.replace(/\D/g,'').length===6)setTimeout(()=>document.getElementById('otp-submit')?.click(),50);}} placeholder="——————" autoFocus/>
                  </div>
                  {err && <Err msg={err}/>}
                  {suc && <Suc msg={suc}/>}
                  {submitBtn('Verify code', undefined, 'otp-submit')}
                  <button type="button" className="btn btn--ghost" style={{width:'100%',justifyContent:'center'}} onClick={handleResendOtp}>
                    Resend code
                  </button>
                </form>
              </>
            )}

            {/* ── TOTP (authenticator app) ── */}
            {mode==='totp' && (
              <>
                <h2>Authenticator code</h2>
                <p className="sub">Open your authenticator app and enter the 6-digit code for <strong>SyncVeil</strong>.</p>
                <form className="auth-form" onSubmit={handleTotp}>
                  <div className="otp-box">
                    <input type="text" inputMode="text" maxLength={11} value={form.otp} onChange={setF('otp')} placeholder="000000 or XXXXX-XXXXX" autoFocus style={{letterSpacing:'0.15em',textTransform:'uppercase'}}/>
                  </div>
                  <p className="sub" style={{fontSize:'0.78rem',marginTop:4,textAlign:'center',opacity:.7}}>
                    Lost your device? Enter a recovery code instead (format: XXXXX-XXXXX).
                  </p>
                  {err && <Err msg={err}/>}
                  {suc && <Suc msg={suc}/>}
                  {submitBtn('Verify')}
                  <button type="button" className="btn btn--ghost" style={{width:'100%',justifyContent:'center'}} onClick={()=>go('login')}>
                    Back to sign in
                  </button>
                </form>
              </>
            )}

            {/* ── SIGNUP STEP 1 ── */}
            {mode==='signup1' && (
              <>
                <h2>Create account</h2>
                <p className="sub">Start with your name, email, and a secure password.</p>
                <form className="auth-form" onSubmit={handleSignup1}>
                  <div className="field">
                    <label className="field-label">Full name</label>
                    {inp('full_name','text','Jane Smith')}
                  </div>
                  <div className="field">
                    <label className="field-label">Email</label>
                    {inp('email','email','you@company.com')}
                  </div>
                  <div className="field">
                    <label className="field-label">Password</label>
                    {pwField('password')}
                    <StrengthBar password={form.password}/>
                  </div>
                  {err && <Err msg={err}/>}
                  {submitBtn('Continue')}
                </form>
              </>
            )}

            {/* ── SIGNUP STEP 2 ── */}
            {mode==='signup2' && (
              <>
                <h2>Almost done</h2>
                <p className="sub">Optional details to personalise your security profile.</p>
                <form className="auth-form" onSubmit={handleSignup2}>
                  <div className="field">
                    <label className="field-label">Phone number <span style={{color:'var(--t-light)',fontWeight:400}}>(optional)</span></label>
                    {inp('phone','tel','+1 555 0100')}
                  </div>
                  <div className="field">
                    <label className="field-label">Country</label>
                    <select className="adm-select input" value={form.country} onChange={setF('country')}>
                      <option value="">Select country…</option>
                      {COUNTRIES.map(c=><option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label className="field-label">Date of birth <span style={{color:'var(--t-light)',fontWeight:400}}>(optional)</span></label>
                    <input className="input" type="date" value={form.date_of_birth} onChange={setF('date_of_birth')}/>
                  </div>
                  {err && <Err msg={err}/>}
                  {suc && <Suc msg={suc}/>}
                  <div style={{display:'flex',gap:8}}>
                    <button type="button" className="btn btn--ghost" style={{flex:1,justifyContent:'center'}} onClick={()=>go('signup1')}>Back</button>
                    {submitBtn('Create account','Creating…')}
                  </div>
                </form>
              </>
            )}

            {/* ── VERIFY EMAIL ── */}
            {mode==='verify' && (
              <>
                <h2>Verify your email</h2>
                <p className="sub">Enter the 6-digit code sent to <strong>{savedEmail||'your email'}</strong>.</p>
                <form className="auth-form" onSubmit={handleVerify}>
                  <div className="otp-box">
                    <input type="text" inputMode="numeric" maxLength={6} value={form.otp} onChange={setF('otp')} placeholder="——————" autoFocus/>
                  </div>
                  {err && <Err msg={err}/>}
                  {suc && <Suc msg={suc}/>}
                  {submitBtn('Verify email')}
                  <button type="button" className="btn btn--ghost" style={{width:'100%',justifyContent:'center'}} onClick={()=>go('login')}>
                    Back to sign in
                  </button>
                </form>
              </>
            )}

            {/* ── FORGOT PASSWORD ── */}
            {mode==='forgot' && (
              <>
                <h2>Reset password</h2>
                <p className="sub">We'll send a reset code to your email address.</p>
                <form className="auth-form" onSubmit={handleForgot}>
                  <div className="field">
                    <label className="field-label">Email</label>
                    {inp('email','email','you@company.com')}
                  </div>
                  {err && <Err msg={err}/>}
                  {suc && <Suc msg={suc}/>}
                  {submitBtn('Send reset code')}
                  <button type="button" className="btn btn--ghost" style={{width:'100%',justifyContent:'center'}} onClick={()=>go('login')}>
                    Back to sign in
                  </button>
                </form>
              </>
            )}

            {/* ── RESET PASSWORD ── */}
            {mode==='reset' && (
              <>
                <h2>Create new password</h2>
                <p className="sub">Enter the code from your email and choose a new password.</p>
                <form className="auth-form" onSubmit={handleReset}>
                  <div className="otp-box">
                    <input type="text" inputMode="numeric" maxLength={6} value={form.otp} onChange={setF('otp')} placeholder="Reset code" style={{letterSpacing:'0.2em'}} autoFocus/>
                  </div>
                  <div className="field">
                    <label className="field-label">New password</label>
                    {pwField('password','New password')}
                    <StrengthBar password={form.password}/>
                  </div>
                  {err && <Err msg={err}/>}
                  {suc && <Suc msg={suc}/>}
                  {submitBtn('Reset password')}
                </form>
              </>
            )}

            {/* ── PASSKEY LOGIN ── */}
            {mode==='passkey_login' && (
              <>
                <h2>Use your passkey</h2>
                <p className="sub">Enter your 6-digit passkey PIN to sign in instantly. Stored in the cloud — same PIN on all devices.</p>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  <span style={{fontSize:13,color:'var(--t-muted)'}}>Passkey for <strong>{savedEmail}</strong></span>
                </div>
                <PinBoxes value={passkeyPin} onChange={p=>{setPasskeyPin(p);setErr('');}} autoFocus />
                {err && <Err msg={err}/>}
                {suc && <Suc msg={suc}/>}
                <button
                  className="btn btn--primary auth-submit"
                  style={{width:'100%',justifyContent:'center'}}
                  onClick={handlePasskeyLogin}
                  disabled={loading || passkeyPin.replace(/\D/g,'').length < 6}
                >
                  {loading ? 'Verifying…' : 'Sign in with passkey'}
                </button>
                <div style={{textAlign:'center',marginTop:12}}>
                  <button type="button" className="btn btn--ghost" style={{width:'100%',justifyContent:'center',fontSize:13}} onClick={()=>{setSuc('Sign-in code sent to your email.');go('otp');}}>
                    Use email code instead
                  </button>
                </div>
              </>
            )}

            {/* ── PASSKEY PROMPT (after new account) ── */}
            {mode==='passkey_prompt' && (
              <>
                <h2>Set up your passkey</h2>
                <p className="sub">Create a 6-digit passkey PIN. It's saved to the cloud so you can sign in instantly on any device — no email code needed.</p>
                <div style={{background:'var(--surface-2,#f6f8fa)',borderRadius:10,padding:'12px 14px',marginBottom:8,display:'flex',gap:10,alignItems:'flex-start'}}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" style={{marginTop:1,flexShrink:0}}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <p style={{margin:0,fontSize:13,color:'var(--t-muted)',lineHeight:1.5}}>Your PIN is encrypted and synced across all your devices. You can change or remove it any time from your security settings.</p>
                </div>
                <PinBoxes value={passkeyPin} onChange={p=>{setPasskeyPin(p);setErr('');}} autoFocus />
                {err && <Err msg={err}/>}
                {suc && <Suc msg={suc}/>}
                <button
                  className="btn btn--primary auth-submit"
                  style={{width:'100%',justifyContent:'center'}}
                  onClick={handlePasskeySetup}
                  disabled={loading || passkeyPin.replace(/\D/g,'').length < 6}
                >
                  {loading ? 'Saving…' : 'Save passkey'}
                  {!loading && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 5l7 7-7 7"/></svg>}
                </button>
                <button type="button" className="btn btn--ghost" style={{width:'100%',justifyContent:'center',marginTop:8}} onClick={()=>onAuth?.(null)}>
                  Skip for now
                </button>
              </>
            )}

            {/* ── PASSKEY SETUP (from settings / explicit) ── */}
            {mode==='passkey_setup' && (
              <>
                <h2>Create a passkey</h2>
                <p className="sub">Choose a 6-digit PIN. It's stored securely in the cloud and works on every device.</p>
                <PinBoxes value={passkeyPin} onChange={p=>{setPasskeyPin(p);setErr('');}} autoFocus />
                {err && <Err msg={err}/>}
                {suc && <Suc msg={suc}/>}
                <button
                  className="btn btn--primary auth-submit"
                  style={{width:'100%',justifyContent:'center'}}
                  onClick={handlePasskeySetup}
                  disabled={loading || passkeyPin.replace(/\D/g,'').length < 6}
                >
                  {loading ? 'Saving…' : 'Save passkey'}
                </button>
                <button type="button" className="btn btn--ghost" style={{width:'100%',justifyContent:'center',marginTop:8}} onClick={()=>go('login')}>
                  Cancel
                </button>
              </>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}
