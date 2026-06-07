import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle, Clock, Download, Eye, Globe, Link, Lock, LogOut, Mail, Moon, RefreshCw, Settings, Shield, Smartphone, Sun, Trash2, Upload, User, Wifi, X } from 'lucide-react';
import { dashboardAPI, passkeyAPI } from '../../api';
import '../../adminator.css';

// ── Utilities ─────────────────────────────────────────────────────────────────
const fmt    = b => { if(!b) return '0 B'; const u=['B','KB','MB','GB']; const i=Math.min(Math.floor(Math.log(b)/Math.log(1024)),3); return `${(b/1024**i).toFixed(i?1:0)} ${u[i]}`; };
const ago    = iso => { if(!iso) return 'never'; const s=(Date.now()-new Date(iso))/1000; if(s<60) return 'just now'; if(s<3600) return `${Math.floor(s/60)}m ago`; if(s<86400) return `${Math.floor(s/3600)}h ago`; return `${Math.floor(s/86400)}d ago`; };
const fmtDate = iso => iso ? new Date(iso).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'}) : '—';
const initials = name => name ? name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2) : '??';
const severityTag = s => { const m={critical:'danger',high:'warning',medium:'info',low:'success'}; return m[s]||'muted'; };
const eventDot = t => { if(!t) return ''; const l=t.toLowerCase(); if(l.includes('fail')||l.includes('block')||l.includes('bad_cred')||l.includes('disabled')) return 'danger'; if(l.includes('warn')||l.includes('cooldown')) return 'warning'; if(l.includes('success')||l.includes('verified')||l.includes('login')) return 'success'; return 'info'; };
const evLabel = ev => { const r=ev.reason||ev.event_type||''; const m={'bad_credentials':'Failed login','otp_challenge_sent':'Sign-in code sent','otp_verified':'Login success','2fa_required':'2FA required','2fa_verified':'2FA verified','2fa_invalid':'2FA failed','cooldown':'Rate limited','disabled':'Account disabled','email_not_verified':'Email not verified','password_reset':'Password reset','logout':'Signed out','logout_all':'All devices signed out'}; return m[r]||r||'Security event'; };

// ── Radial Ring ───────────────────────────────────────────────────────────────
const Radial = ({ pct=0, color='primary', label, caption }) => {
  const r=32, c=2*Math.PI*r, offset=c-((Math.min(100,Math.max(0,pct))/100)*c);
  return (
    <div className="sv-radial">
      <div className="sv-radial-chart">
        <svg viewBox="0 0 80 80">
          <circle className="radial-track" cx="40" cy="40" r={r}/>
          <circle className={`radial-fill ${color}`} cx="40" cy="40" r={r}
            strokeDasharray={c} strokeDashoffset={offset} style={{transition:'stroke-dashoffset 1s ease'}}/>
        </svg>
        <span className="radial-pct">{Math.round(pct)}%</span>
      </div>
      <div className="sv-radial-text">
        <div className="sv-radial-name">{label}</div>
        <div className="sv-radial-caption">{caption}</div>
      </div>
    </div>
  );
};

// ── KPI Card ──────────────────────────────────────────────────────────────────
const KpiCard = ({ label, value, sup, pill, pillKind='neutral', iconKind='primary', compare, children }) => (
  <article className={`kpi-card c-${iconKind}`}>
    <div className="kpi-top">
      <div className="kpi-identity">
        <div className={`kpi-icon ${iconKind}`}>
          {children}
        </div>
        <div className="kpi-label">{label}</div>
      </div>
      {pill && <span className={`kpi-pill ${pillKind}`}>{pill}</span>}
    </div>
    <div className="kpi-value">{value}{sup && <sup>{sup}</sup>}</div>
    {compare && <div className="kpi-compare">{compare}</div>}
  </article>
);

// ── Provider Logo ─────────────────────────────────────────────────────────────
const ProviderLogo = ({ p }) => {
  if(p==='google') return <svg viewBox="0 0 24 24" width="20" height="20"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>;
  if(p==='microsoft') return <svg viewBox="0 0 24 24" width="20" height="20"><path d="M11.4 11.4H0V0h11.4v11.4z" fill="#f25022"/><path d="M24 11.4H12.6V0H24v11.4z" fill="#7fba00"/><path d="M11.4 24H0V12.6h11.4V24z" fill="#00a4ef"/><path d="M24 24H12.6V12.6H24V24z" fill="#ffb900"/></svg>;
  return <Globe size={20}/>;
};

const TABS = [
  { id:'overview', label:'Overview',        svg: <path d="M12 20V10M18 20V4M6 20v-4"/> },
  { id:'score',    label:'Security Score',  svg: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></> },
  { id:'email',    label:'Email Security', svg: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></> },
  { id:'vault',    label:'Encrypted Vault', svg: <><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></> },
  { id:'monitor',  label:'Security Monitor', svg: <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/> },
  { id:'intel',    label:'Intelligence', svg: <><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></> },
  { id:'settings', label:'Settings', svg: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></> },
  { id:'alerts',   label:'Alert Engine',  svg: <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></> },
  { id:'activity', label:'Activity Log',  svg: <><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></> },
];

const COUNTRIES = ['Afghanistan','Albania','Algeria','Argentina','Australia','Austria','Bangladesh','Belgium','Brazil','Canada','Chile','China','Colombia','Croatia','Czech Republic','Denmark','Egypt','Ethiopia','Finland','France','Germany','Ghana','Greece','Hungary','India','Indonesia','Iran','Iraq','Ireland','Israel','Italy','Japan','Jordan','Kenya','Malaysia','Mexico','Morocco','Netherlands','New Zealand','Nigeria','Norway','Pakistan','Peru','Philippines','Poland','Portugal','Romania','Russia','Saudi Arabia','Singapore','South Africa','South Korea','Spain','Sri Lanka','Sweden','Switzerland','Taiwan','Thailand','Turkey','Ukraine','United Arab Emirates','United Kingdom','United States','Vietnam','Other'];


// ── Live Threat Feed (URLhaus) ────────────────────────────────────────────────
function IntelFeedTab() {
  const [feed, setFeed]     = useState(null);
  const [loading, setLoad]  = useState(false);
  const [filter, setFilter] = useState('');

  const load = async () => {
    setLoad(true);
    try {
      const r = await dashboardAPI.getThreatFeed(30);
      setFeed(r);
    } catch(e) { setFeed({available:false,reason:e.message}); }
    finally { setLoad(false); }
  };

  useEffect(() => { load(); }, []);

  const items = (feed?.items||[]).filter(i =>
    !filter || i.threat?.toLowerCase().includes(filter.toLowerCase()) ||
    i.url?.toLowerCase().includes(filter.toLowerCase()) ||
    (i.tags||[]).some(t => t.toLowerCase().includes(filter.toLowerCase()))
  );

  const threatColor = t => {
    if(!t) return 'muted';
    const l = t.toLowerCase();
    if(l.includes('malware')||l.includes('botnet')) return 'danger';
    if(l.includes('phishing')) return 'warning';
    if(l.includes('exploit')) return 'purple';
    return 'info';
  };

  return (
    <div className="grid">
      <section className="col-12 card">
        <div className="card-head">
          <div className="card-title-wrap">
            <span className="eyebrow">URLhaus · abuse.ch</span>
            <h2 className="card-title">Live malware & phishing feed</h2>
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <input
              className="input" style={{width:200,padding:'6px 10px',fontSize:12}}
              placeholder="Filter by threat / tag…"
              value={filter} onChange={e=>setFilter(e.target.value)}
            />
            <button className="btn btn--ghost btn--sm" onClick={load} disabled={loading}>
              {loading ? <span className="adm-spinner" style={{width:13,height:13,borderWidth:2}}/> : 'Refresh'}
            </button>
          </div>
        </div>

        {!feed?.available && feed?.reason && (
          <div className="adm-alert danger" style={{marginBottom:16}}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
            {feed.reason}
          </div>
        )}

        {loading && <div style={{display:'flex',justifyContent:'center',padding:'32px 0'}}><div className="adm-spinner lg"/></div>}

        {!loading && items.length === 0 && (
          <p style={{textAlign:'center',color:'var(--t-muted)',fontSize:13,padding:'32px 0'}}>No feed items match your filter.</p>
        )}

        {!loading && items.length > 0 && (
          <>
            <div style={{display:'flex',gap:16,marginBottom:16,fontSize:12,color:'var(--t-muted)'}}>
              <span>Showing <strong style={{color:'var(--t-base)'}}>{items.length}</strong> entries</span>
              <span>Source: <strong style={{color:'var(--primary)'}}>URLhaus / abuse.ch</strong> — free, no API key required</span>
            </div>
            <div className="table-scroll"><table className="table">
              <thead>
                <tr>
                  <th style={{width:'40%'}}>URL</th>
                  <th>Threat type</th>
                  <th>Tags</th>
                  <th>Country</th>
                  <th>Date added</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item,i) => (
                  <tr key={i}>
                    <td>
                      <div style={{fontFamily:'JetBrains Mono,monospace',fontSize:11,color:'var(--t-base)',
                        maxWidth:320,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}
                        title={item.url}>
                        {item.url}
                      </div>
                      {item.reporter && (
                        <div className="cell-muted">Reporter: {item.reporter}</div>
                      )}
                    </td>
                    <td>
                      <span className={`tag ${threatColor(item.threat)}`}>
                        {item.threat||'unknown'}
                      </span>
                    </td>
                    <td>
                      <div style={{display:'flex',flexWrap:'wrap',gap:3}}>
                        {(item.tags||[]).slice(0,3).map((t,j)=>(
                          <span key={j} className="tag muted" style={{fontSize:10}}>{t}</span>
                        ))}
                      </div>
                    </td>
                    <td className="cell-muted">{item.country||'—'}</td>
                    <td style={{fontFamily:'JetBrains Mono,monospace',fontSize:11,color:'var(--t-light)',whiteSpace:'nowrap'}}>
                      {item.date?.slice(0,10)||'—'}
                    </td>
                    <td>
                      <span className={`badge ${item.url_status==='online'?'danger':item.url_status==='offline'?'success':'muted'}`}>
                        {item.url_status||'—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </>
        )}
      </section>
    </div>
  );
}

// ── Security Alert Engine ─────────────────────────────────────────────────────
const ALERT_RULES = [
  { id:'new_device',    icon:<Smartphone size={16}/>, color:'primary', severity:'high',     label:'New device login',             desc:'Sign-in from an unrecognised device or browser.' },
  { id:'password_change',icon:<Lock size={16}/>,      color:'warning', severity:'critical', label:'Password change',              desc:'Account password was updated.' },
  { id:'email_change',  icon:<Mail size={16}/>,       color:'warning', severity:'critical', label:'Email address change',         desc:'Primary email was modified on your account.' },
  { id:'breach',        icon:<AlertTriangle size={16}/>,color:'danger', severity:'critical', label:'Breach detected',             desc:'Your credentials appeared in a known data breach.' },
  { id:'new_location',  icon:<Globe size={16}/>,      color:'purple',  severity:'high',     label:'Vault access · new location', desc:'Encrypted vault opened from an unrecognised location.' },
  { id:'failed_logins', icon:<Wifi size={16}/>,       color:'danger',  severity:'medium',   label:'Multiple failed logins',       desc:'5+ consecutive failed authentication attempts.' },
];

const ALERT_CHANNELS = [
  { id:'email',   label:'Email',             icon:<Mail size={14}/> },
  { id:'push',    label:'Push notification', icon:<Smartphone size={14}/> },
  { id:'sms',     label:'SMS',               icon:<Activity size={14}/> },
  { id:'webhook', label:'Webhook',           icon:<Link size={14}/> },
  { id:'slack',   label:'Slack',             icon:<Settings size={14}/> },
];

const ALERT_SIMULATIONS = [
  { ruleId:'new_device',     dot:'primary', sub:'Chrome 125 · Windows 11 · Mumbai, IN' },
  { ruleId:'password_change',dot:'warning', sub:'Changed via account settings' },
  { ruleId:'email_change',   dot:'warning', sub:'New email address confirmed' },
  { ruleId:'breach',         dot:'danger',  sub:'LinkedIn · 2024 · 533M records exposed' },
  { ruleId:'new_location',   dot:'purple',  sub:'Vault opened remotely · Frankfurt, DE' },
  { ruleId:'failed_logins',  dot:'danger',  sub:'7 attempts in 2 min · 192.168.1.55' },
];

function AlertEngine({ showToast, logEvent }) {
  const [enabled,   setEnabled]   = useState(() => new Set(ALERT_RULES.map(r => r.id)));
  const [channels,  setChannels]  = useState(() => new Set(['email','push']));
  const [feedItems, setFeedItems] = useState([]);
  const [simIdx,    setSimIdx]    = useState(0);
  const [triggered, setTriggered] = useState(0);

  const toggleRule = (id, on) =>
    setEnabled(prev => { const s = new Set(prev); on ? s.add(id) : s.delete(id); return s; });

  const toggleChannel = id =>
    setChannels(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const simulate = () => {
    const sim  = ALERT_SIMULATIONS[simIdx % ALERT_SIMULATIONS.length];
    const rule = ALERT_RULES.find(r => r.id === sim.ruleId);
    setSimIdx(i => i + 1);
    if (!enabled.has(sim.ruleId)) { showToast(`Alert "${rule?.label}" is disabled — enable it first.`, 'error'); return; }
    if (channels.size === 0)      { showToast('No channels active — enable at least one channel.', 'error'); return; }
    const chs = [...channels].join(', ');
    const now = new Date().toTimeString().slice(0,8);
    setFeedItems(prev => [{ id: Date.now(), title: rule.label, sub: `${sim.sub} · via ${chs}`, dot: sim.dot, time: now }, ...prev].slice(0, 12));
    setTriggered(t => t + 1);
    logEvent?.(rule.label, `${sim.sub} [simulated]`);
    showToast(`Alert sent: ${rule.label}`);
  };

  const dotColor = color => ({
    primary:'var(--primary)', warning:'var(--warning)', danger:'var(--danger)',
    purple:'var(--purple)',   info:'var(--info)',        success:'var(--success)',
  }[color] || 'var(--t-muted)');

  const iconBg  = color => ({
    primary:'var(--primary-soft)', warning:'var(--warning-soft)', danger:'var(--danger-soft)',
    purple:'var(--purple-soft)',   info:'var(--info-soft)',        success:'var(--success-soft)',
  }[color] || 'var(--bg-muted)');

  const iconColor = color => ({
    primary:'var(--primary)', warning:'var(--warning)', danger:'var(--danger)',
    purple:'var(--purple)',   info:'var(--info)',        success:'var(--success)',
  }[color] || 'var(--t-muted)');

  const severityKind = s => ({ critical:'danger', high:'warning', medium:'info', low:'success' }[s] || 'muted');

  return (
    <>
      <section className="hero">
        <div className="hero-text">
          <span className="eyebrow">Notifications</span>
          <h1 className="hero-title">Security <span className="accent">Alert Engine</span></h1>
          <p className="hero-sub">Configure which events trigger real-time alerts and which channels deliver them.</p>
        </div>
        <div className="hero-actions">
          <button className="btn btn--ghost" onClick={() => { setEnabled(new Set(ALERT_RULES.map(r=>r.id))); showToast('All alerts enabled.'); }}>
            <Shield size={14}/> Enable all
          </button>
          <button className="btn btn--primary" onClick={simulate}>
            <Activity size={14}/> Simulate alert
          </button>
        </div>
      </section>

      {/* Summary KPIs */}
      <div className="kpi-grid" style={{marginBottom:20}}>
        <KpiCard label="Active Rules"    value={enabled.size}   sup={`/${ALERT_RULES.length}`} iconKind="success"
          pill="Configured" pillKind="neutral" compare={<>of {ALERT_RULES.length} rules enabled</>}><Shield size={15}/></KpiCard>
        <KpiCard label="Active Channels" value={channels.size}  sup={`/${ALERT_CHANNELS.length}`} iconKind="primary"
          pill="Delivery" pillKind="neutral" compare={<>notification channels on</>}><Mail size={15}/></KpiCard>
        <KpiCard label="Simulated Today" value={triggered} iconKind={triggered>0?'warning':'info'}
          pill="Test" pillKind="info" compare={<>alerts fired this session</>}><Activity size={15}/></KpiCard>
      </div>

      <div className="grid">
        {/* Channels */}
        <section className="col-12 card" style={{marginBottom:0}}>
          <div className="card-head">
            <div className="card-title-wrap">
              <span className="eyebrow">Delivery</span>
              <h2 className="card-title">Notification channels</h2>
            </div>
          </div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {ALERT_CHANNELS.map(ch => {
              const on = channels.has(ch.id);
              return (
                <button key={ch.id} onClick={() => toggleChannel(ch.id)}
                  className={on ? 'btn btn--primary btn--sm' : 'btn btn--ghost btn--sm'}
                  style={{display:'flex',alignItems:'center',gap:6,padding:'7px 14px',fontSize:12}}>
                  {ch.icon} {ch.label}
                  {on && <CheckCircle size={12} style={{marginLeft:2}}/>}
                </button>
              );
            })}
          </div>
          {channels.size === 0 && (
            <div className="adm-alert warning" style={{marginTop:12}}>
              <AlertTriangle size={15}/><div>No channels active — alerts will be queued but not delivered.</div>
            </div>
          )}
        </section>

        {/* Alert Rules */}
        <section className="col-12 card">
          <div className="card-head">
            <div className="card-title-wrap">
              <span className="eyebrow">Rules</span>
              <h2 className="card-title">Alert triggers — {enabled.size} of {ALERT_RULES.length} active</h2>
            </div>
            <div style={{display:'flex',gap:8}}>
              <button className="btn btn--ghost btn--sm" onClick={() => setEnabled(new Set(ALERT_RULES.map(r=>r.id)))}>Enable all</button>
              <button className="btn btn--ghost btn--sm" onClick={() => setEnabled(new Set())}>Disable all</button>
            </div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            {ALERT_RULES.map(rule => {
              const on = enabled.has(rule.id);
              return (
                <div key={rule.id} style={{
                  display:'flex',alignItems:'flex-start',gap:12,padding:'14px 16px',
                  border:`1px solid ${on?'var(--primary)':'var(--border-soft)'}`,
                  borderRadius:12,background:'var(--bg-card)',transition:'border-color 200ms',
                }}>
                  <div style={{
                    width:36,height:36,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',
                    flexShrink:0,background:iconBg(rule.color),color:iconColor(rule.color),
                  }}>
                    {rule.icon}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:600,color:'var(--t-base)',marginBottom:2}}>{rule.label}</div>
                    <div style={{fontSize:11.5,color:'var(--t-muted)',lineHeight:1.5,marginBottom:8}}>{rule.desc}</div>
                    <span className={`tag ${severityKind(rule.severity)}`} style={{fontSize:10}}>{rule.severity}</span>
                  </div>
                  <label className="switch" style={{marginLeft:4,flexShrink:0}}>
                    <input type="checkbox" checked={on} onChange={e => toggleRule(rule.id, e.target.checked)}/>
                    <span className="track"/>
                  </label>
                </div>
              );
            })}
          </div>
        </section>

        {/* Live feed */}
        <section className="col-12 card">
          <div className="card-head">
            <div className="card-title-wrap">
              <span className="eyebrow">Feed</span>
              <h2 className="card-title">Live alert feed</h2>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'var(--t-muted)'}}>
              <span style={{width:7,height:7,borderRadius:'50%',background:'var(--success)',display:'inline-block',animation:'adm-spin 0s linear infinite'}}/>
              Monitoring active
            </div>
          </div>
          {feedItems.length === 0 ? (
            <p style={{textAlign:'center',color:'var(--t-muted)',fontSize:13,padding:'28px 0'}}>
              No alerts yet — click <strong>Simulate alert</strong> to test your configuration.
            </p>
          ) : (
            feedItems.map(item => (
              <div key={item.id} className="event-row">
                <div className="event-dot" style={{background:dotColor(item.dot)}}/>
                <div>
                  <div className="event-text">{item.title}</div>
                  <div className="event-sub">{item.sub}</div>
                </div>
                <div className="event-time" style={{fontFamily:'JetBrains Mono,monospace'}}>{item.time}</div>
              </div>
            ))
          )}
        </section>
      </div>
    </>
  );
}

// ── Security Score Engine ─────────────────────────────────────────────────────
function SecurityScoreEngine({ twofa, breaches, events, sessions, vault, vaultStats, sec, onNavigate }) {

  // ── Factor definitions & scoring ─────────────────────────────────────────
  const failedLogins = events.filter(e => (e.reason||e.event_type||'').toLowerCase().match(/fail|bad_cred|block/)).length;
  const activeSessions = sec?.active_sessions ?? sessions.length ?? 0;

  const factors = [
    {
      id: 'twofa',
      label: '2FA enabled',
      icon: <Shield size={18}/>,
      weight: 25,
      score: (() => {
        if (twofa?.enabled) return 25;
        return 0;
      })(),
      maxScore: 25,
      status: twofa?.enabled ? 'pass' : 'fail',
      detail: twofa?.enabled
        ? `Active · ${twofa.recovery_codes_remaining ?? '?'} recovery codes remaining`
        : 'Not configured — strongly recommended',
      action: twofa?.enabled ? null : { label: 'Enable 2FA', tab: 'settings' },
    },
    {
      id: 'breach',
      label: 'Breach exposure',
      icon: <AlertTriangle size={18}/>,
      weight: 25,
      score: (() => {
        if (breaches.length === 0) return 25;
        if (breaches.length === 1) return 10;
        return 0;
      })(),
      maxScore: 25,
      status: breaches.length === 0 ? 'pass' : 'fail',
      detail: breaches.length === 0
        ? 'No known breaches for your email'
        : `${breaches.length} breach${breaches.length > 1 ? 'es' : ''} detected — change affected passwords`,
      action: breaches.length > 0 ? { label: 'View breaches', tab: 'monitor' } : null,
    },
    {
      id: 'password',
      label: 'Password health',
      icon: <Lock size={18}/>,
      weight: 20,
      score: (() => {
        // Penalise for recent failed login bursts (brute-force signal)
        if (failedLogins === 0) return 20;
        if (failedLogins <= 2) return 14;
        if (failedLogins <= 5) return 8;
        return 0;
      })(),
      maxScore: 20,
      status: failedLogins === 0 ? 'pass' : failedLogins <= 2 ? 'warn' : 'fail',
      detail: failedLogins === 0
        ? 'No failed login attempts detected'
        : `${failedLogins} failed login${failedLogins > 1 ? 's' : ''} in recent history — review activity`,
      action: failedLogins > 0 ? { label: 'View events', tab: 'monitor' } : null,
    },
    {
      id: 'sessions',
      label: 'Active sessions',
      icon: <Smartphone size={18}/>,
      weight: 15,
      score: (() => {
        if (activeSessions <= 1) return 15;
        if (activeSessions <= 3) return 10;
        if (activeSessions <= 6) return 5;
        return 0;
      })(),
      maxScore: 15,
      status: activeSessions <= 1 ? 'pass' : activeSessions <= 3 ? 'warn' : 'fail',
      detail: activeSessions === 0
        ? 'No other active sessions'
        : `${activeSessions} device${activeSessions > 1 ? 's' : ''} signed in — review and revoke unused sessions`,
      action: activeSessions > 2 ? { label: 'Manage sessions', tab: 'monitor' } : null,
    },
    {
      id: 'vault',
      label: 'Vault protection',
      icon: <Eye size={18}/>,
      weight: 15,
      score: (() => {
        if (vault.length === 0) return 8;           // no files — neutral
        const health = vaultStats?.vault_health_score ?? 100;
        if (health >= 90) return 15;
        if (health >= 70) return 10;
        return 4;
      })(),
      maxScore: 15,
      status: vault.length === 0 ? 'warn' : (vaultStats?.vault_health_score ?? 100) >= 90 ? 'pass' : 'warn',
      detail: vault.length === 0
        ? 'No files stored — vault is available and ready'
        : `${vault.length} file${vault.length > 1 ? 's' : ''} encrypted · Vault health ${vaultStats?.vault_health_score ?? '—'}%`,
      action: vault.length === 0 ? { label: 'Open vault', tab: 'vault' } : null,
    },
  ];

  const totalScore  = factors.reduce((s, f) => s + f.score, 0);
  const maxPossible = factors.reduce((s, f) => s + f.maxScore, 0);
  const pct         = Math.round((totalScore / maxPossible) * 100);

  const grade = pct >= 90 ? { label:'A', color:'var(--success)' }
              : pct >= 75 ? { label:'B', color:'var(--info)'    }
              : pct >= 60 ? { label:'C', color:'var(--warning)' }
              :              { label:'D', color:'var(--danger)'  };

  const riskLabel = pct >= 80 ? 'Low risk' : pct >= 60 ? 'Medium risk' : 'High risk';
  const riskKind  = pct >= 80 ? 'success'  : pct >= 60 ? 'warning'     : 'danger';

  // Arc SVG (semicircle gauge)
  const ARC_R = 70, ARC_CX = 100, ARC_CY = 95;
  const arcLen = Math.PI * ARC_R; // half-circle circumference
  const arcFill = arcLen * (pct / 100);
  const arcOffset = arcLen - arcFill;

  return (
    <>
      <section className="hero">
        <div className="hero-text">
          <span className="eyebrow">Security</span>
          <h1 className="hero-title">Security <span className="accent">Score Engine</span></h1>
          <p className="hero-sub">Your account's overall protection level, computed across five security pillars.</p>
        </div>
      </section>

      {/* ── Gauge + grade ── */}
      <div className="grid" style={{marginBottom:0}}>
        <section className="col-6 card" style={{display:'flex',flexDirection:'column',alignItems:'center',paddingBottom:28}}>
          {/* SVG arc gauge */}
          <svg viewBox="0 0 200 110" width="260" style={{overflow:'visible',marginBottom:4}}>
            {/* track */}
            <path
              d={`M ${ARC_CX - ARC_R} ${ARC_CY} A ${ARC_R} ${ARC_R} 0 0 1 ${ARC_CX + ARC_R} ${ARC_CY}`}
              fill="none" stroke="var(--border)" strokeWidth="12" strokeLinecap="round"
            />
            {/* fill */}
            <path
              d={`M ${ARC_CX - ARC_R} ${ARC_CY} A ${ARC_R} ${ARC_R} 0 0 1 ${ARC_CX + ARC_R} ${ARC_CY}`}
              fill="none"
              stroke={grade.color}
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={`${arcLen}`}
              strokeDashoffset={`${arcOffset}`}
              style={{transition:'stroke-dashoffset 1.2s cubic-bezier(.2,.7,.2,1), stroke .4s'}}
            />
            {/* score label */}
            <text x={ARC_CX} y={ARC_CY - 8} textAnchor="middle"
              style={{fontFamily:"'Inter Tight','Inter',sans-serif",fontSize:34,fontWeight:700,fill:grade.color}}>
              {pct}
            </text>
            <text x={ARC_CX} y={ARC_CY + 12} textAnchor="middle"
              style={{fontFamily:"'Inter',sans-serif",fontSize:11,fill:'var(--t-muted)',letterSpacing:'0.05em'}}>
              OUT OF 100
            </text>
          </svg>

          {/* Grade + risk */}
          <div style={{display:'flex',alignItems:'center',gap:12,marginTop:4}}>
            <span style={{
              width:44,height:44,borderRadius:12,background:grade.color,
              color:'#fff',display:'grid',placeItems:'center',
              fontFamily:"'Inter Tight',sans-serif",fontSize:22,fontWeight:700,flexShrink:0,
            }}>{grade.label}</span>
            <div>
              <div style={{fontSize:16,fontWeight:700,color:'var(--t-base)',fontFamily:"'Inter Tight',sans-serif",letterSpacing:'-0.02em'}}>
                Security Score: <span style={{color:grade.color}}>{pct}/100</span>
              </div>
              <div style={{fontSize:12,color:'var(--t-muted)',marginTop:2}}>
                <span className={`tag ${riskKind}`} style={{fontSize:10,marginRight:6}}>{riskLabel}</span>
                {factors.filter(f=>f.status==='fail').length > 0
                  ? `${factors.filter(f=>f.status==='fail').length} issue${factors.filter(f=>f.status==='fail').length>1?'s':''} need attention`
                  : 'All checks passing'}
              </div>
            </div>
          </div>
        </section>

        {/* ── Score breakdown bars ── */}
        <section className="col-6 card">
          <div className="card-head">
            <div className="card-title-wrap">
              <span className="eyebrow">Breakdown</span>
              <h2 className="card-title">Score by pillar</h2>
            </div>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:16}}>
            {factors.map(f => {
              const pctF = Math.round((f.score / f.maxScore) * 100);
              const barColor = f.status==='pass' ? 'var(--success)' : f.status==='warn' ? 'var(--warning)' : 'var(--danger)';
              return (
                <div key={f.id}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:5}}>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <span style={{
                        width:28,height:28,borderRadius:7,display:'grid',placeItems:'center',flexShrink:0,
                        background: f.status==='pass'?'var(--success-soft)':f.status==='warn'?'var(--warning-soft)':'var(--danger-soft)',
                        color: barColor,
                      }}>{f.icon}</span>
                      <span style={{fontSize:13,fontWeight:600,color:'var(--t-base)'}}>{f.label}</span>
                    </div>
                    <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,fontWeight:600,color:barColor}}>
                      {f.score}/{f.maxScore}
                    </span>
                  </div>
                  <div className="progress" style={{height:6,borderRadius:3,background:'var(--border-soft)'}}>
                    <div className="progress-fill" style={{
                      width:`${pctF}%`,background:barColor,borderRadius:3,
                      transition:'width 1s cubic-bezier(.2,.7,.2,1)',
                    }}/>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* ── Factor detail cards ── */}
      <div className="grid" style={{marginTop:0}}>
        <section className="col-12 card">
          <div className="card-head">
            <div className="card-title-wrap">
              <span className="eyebrow">Details</span>
              <h2 className="card-title">Factor analysis</h2>
            </div>
            <span style={{fontSize:12,color:'var(--t-muted)',fontFamily:"'JetBrains Mono',monospace"}}>
              {totalScore} / {maxPossible} pts
            </span>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            {factors.map(f => {
              const statusColor = f.status==='pass'?'var(--success)':f.status==='warn'?'var(--warning)':'var(--danger)';
              const statusBg    = f.status==='pass'?'var(--success-soft)':f.status==='warn'?'var(--warning-soft)':'var(--danger-soft)';
              const statusLabel = f.status==='pass'?'Pass':f.status==='warn'?'Review':'Action needed';
              return (
                <div key={f.id} style={{
                  display:'flex',alignItems:'flex-start',gap:12,padding:'14px 16px',
                  border:`1px solid ${f.status==='fail'?'var(--danger)':f.status==='warn'?'var(--warning)':'var(--border-soft)'}`,
                  borderRadius:12,background:'var(--bg-card)',
                }}>
                  <div style={{
                    width:38,height:38,borderRadius:10,display:'grid',placeItems:'center',flexShrink:0,
                    background:statusBg,color:statusColor,
                  }}>{f.icon}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:3}}>
                      <span style={{fontSize:13,fontWeight:600,color:'var(--t-base)'}}>{f.label}</span>
                      <span className={`badge ${f.status==='pass'?'success':f.status==='warn'?'warning':'danger'}`}
                        style={{fontSize:10}}>{statusLabel}</span>
                    </div>
                    <div style={{fontSize:12,color:'var(--t-muted)',lineHeight:1.5,marginBottom:f.action?8:0}}>
                      {f.detail}
                    </div>
                    {f.action && (
                      <button className="btn btn--ghost btn--sm"
                        style={{fontSize:11,padding:'3px 10px',marginTop:2}}
                        onClick={() => onNavigate(f.action.tab)}>
                        {f.action.label} →
                      </button>
                    )}
                  </div>
                  <div style={{
                    fontFamily:"'JetBrains Mono',monospace",fontSize:11,fontWeight:700,
                    color:statusColor,flexShrink:0,minWidth:28,textAlign:'right',paddingTop:2,
                  }}>{f.score}<span style={{opacity:.5,fontWeight:400}}>/{f.maxScore}</span></div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </>
  );
}

export default function Dashboard({ onLogout, onSwitchView, user: propUser, oauthRefreshKey }) {
  const [tab,    setTab]    = useState('overview');
  const [theme,  setTheme]  = useState(() => { try { return localStorage.getItem('sv-theme')||'light'; } catch { return 'light'; } });
  const [dash,   setDash]   = useState(null);
  const [sec,    setSec]    = useState(null);
  const [events, setEvents] = useState([]);
  const [breaches,setBreaches] = useState([]);
  const [vault,  setVault]  = useState([]);
  const [emailSec,setEmailSec] = useState(null);
  const [profile,setProfile] = useState(null);
  const [connected,setConnected] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);
  const [lastRefreshed,setLastRefreshed] = useState(null);
  const [uploadErr,setUploadErr]  = useState('');
  const [profForm,setProfForm]    = useState({full_name:'',phone:'',country:'',date_of_birth:''});
  const [profSaving,setProfSaving]= useState(false);
  const [profSaved,setProfSaved]  = useState(false);
  const [pwForm,setPwForm]        = useState({current:'',next:'',confirm:''});
  const [pwSaving,setPwSaving]    = useState(false);
  const [pwErr,setPwErr]          = useState('');
  const [pwOk,setPwOk]            = useState('');
  const [connecting,setConnecting]= useState('');
  const [toast,setToast]          = useState(null);
  const [intel,setIntel]          = useState(null);
  const [intelLoading,setIntelLoading] = useState(false);
  const [intelTab,setIntelTab]    = useState('breaches');
  const [drag,setDrag]            = useState(false);
  const [sidebarOpen,setSidebarOpen] = useState(false);
  const [sidebarOpen,setSidebarOpen] = useState(false);
  const [vaultStats,setVaultStats] = useState(null);
  const [checkingId,setCheckingId] = useState(null);
  // ── 2FA state ──
  const [twofa,      setTwofa]      = useState(null);   // {enabled, recovery_codes_remaining}
  const [twofaStep,  setTwofaStep]  = useState('idle'); // idle | setup | confirm | disable | regen | codes
  const [twofaSetup, setTwofaSetup] = useState(null);   // {secret, provisioning_uri}
  const [twofaCodes, setTwofaCodes] = useState([]);     // plaintext recovery codes (shown once)
  const [twofaCode,  setTwofaCode]  = useState('');     // input code
  const [twofaErr,   setTwofaErr]   = useState('');
  const [twofaBusy,  setTwofaBusy]  = useState(false);
  // ── Passkey state ──
  const [passkeyStatus,   setPasskeyStatus]   = useState(null);  // {has_passkey, created_at}
  const [passkeyStep,     setPasskeyStep]     = useState('idle'); // idle | create | delete
  const [passkeyPin,      setPasskeyPin]      = useState('');
  const [passkeyConfirm,  setPasskeyConfirm]  = useState('');
  const [passkeyErr,      setPasskeyErr]      = useState('');
  const [passkeyBusy,     setPasskeyBusy]     = useState(false);
  // ── Session management state ──
  const [sessions,      setSessions]      = useState([]);
  const [sessLoading,   setSessLoading]   = useState(false);
  const [revokingId,    setRevokingId]    = useState(null);  // id being revoked
  const [trustingId,    setTrustingId]    = useState(null);  // id being trusted
  const [renamingId,    setRenamingId]    = useState(null);  // id being renamed
  const [renameVal,     setRenameVal]     = useState('');
  const [revokeAllBusy, setRevokeAllBusy] = useState(false);
  const fileRef = useRef(null);

  const toggleTheme = () => setTheme(t => { const n=t==='dark'?'light':'dark'; try{localStorage.setItem('sv-theme',n);}catch{} return n; });
  const showToast = (msg, type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),4000); };

  // ── Activity Log ─────────────────────────────────────────────────────────
  const [activityLog, setActivityLog] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sv-activity-log') || '[]'); } catch { return []; }
  });

  const logEvent = (type, detail = '') => {
    const entry = { id: Date.now() + Math.random(), type, detail, ts: new Date().toISOString() };
    setActivityLog(prev => {
      const next = [entry, ...prev].slice(0, 200);
      try { localStorage.setItem('sv-activity-log', JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const clearActivityLog = () => {
    setActivityLog([]);
    try { localStorage.removeItem('sv-activity-log'); } catch {}
    showToast('Activity log cleared.');
  };

  const loadIntel = async () => {
    setIntelLoading(true);
    try {
      const r = await dashboardAPI.getThreatScan();
      setIntel(r);
    } catch(e) { showToast(e.message||'Intelligence scan failed','error'); }
    finally { setIntelLoading(false); }
  };

  const loadAll = useCallback(async (silent=false) => {
    if(!silent) setLoading(true); else setRefreshing(true);
    const [d,s,e,b,v,em,p,vs,tf,ca,pk] = await Promise.allSettled([
      dashboardAPI.getDashboardData(), dashboardAPI.getSecurityOverview(),
      dashboardAPI.getSecurityEvents(25), dashboardAPI.getBreachData(),
      dashboardAPI.getVaultFiles(), dashboardAPI.getEmailSecurity(), dashboardAPI.getProfile(),
      dashboardAPI.getVaultStorageStats(), dashboardAPI.get2FAStatus(),
      dashboardAPI.getConnectedAccounts(), passkeyAPI.getStatus(),
    ]);
    if(d.status==='fulfilled'){ const r=d.value?.data||d.value; setDash(r); if(r?.sessions?.length) setSessions(r.sessions); }
    if(ca.status==='fulfilled'){ setConnected(ca.value?.accounts||[]); }
    else if(d.status==='fulfilled'){ const r=d.value?.data||d.value; setConnected(r?.connectedAccounts||[]); }
    if(s.status==='fulfilled') setSec(s.value?.data||s.value);
    if(e.status==='fulfilled') {
      const evts = e.value?.data?.events||[];
      setEvents(evts);
      // Seed activity log from server-side security events (login success/failure)
      evts.forEach(ev => {
        const t = (ev.reason||ev.event_type||'').toLowerCase();
        if(t.includes('login')||t.includes('auth')||t.includes('fail')||t.includes('verified')||t.includes('otp')||t.includes('challenge')) {
          const type = (t.includes('fail')||t.includes('block')||t.includes('bad_cred')) ? 'Login Failure' : 'Login Success';
          const detail = [ev.ip_address, (ev.device_info||ev.user_agent)?.slice(0,40)].filter(Boolean).join(' · ') || '—';
          logEvent(type, detail);
        }
      });
    }
    if(b.status==='fulfilled') setBreaches(b.value?.breaches?.breaches||[]);
    if(v.status==='fulfilled') setVault((v.value?.files||[]).map(f=>({...f,status:'secured'})));
    if(vs?.status==='fulfilled') setVaultStats(vs.value);
    if(em.status==='fulfilled') setEmailSec(em.value);
    if(p.status==='fulfilled'){ const pr=p.value; setProfile(pr); setProfForm({full_name:pr.full_name||'',phone:pr.phone||'',country:pr.country||'',date_of_birth:pr.date_of_birth||''}); }
    if(tf.status==='fulfilled') setTwofa(tf.value);
    if(pk.status==='fulfilled') setPasskeyStatus(pk.value);
    setLoading(false); setRefreshing(false); setLastRefreshed(new Date());
  },[]);

  useEffect(()=>{ loadAll(); },[loadAll]);
  // Re-fetch connected accounts whenever App.jsx signals an OAuth just completed
  useEffect(()=>{ if(oauthRefreshKey){ loadAll(true); } },[oauthRefreshKey]);
  useEffect(()=>{ const f=sessionStorage.getItem('oauth_connecting'); if(f){ sessionStorage.removeItem('oauth_connecting'); const t=setTimeout(()=>loadAll(true),800); return()=>clearTimeout(t); } },[]);
  useEffect(()=>{ if(tab==='monitor' && sessions.length===0) loadSessions(); },[tab]);

  const upload = async files => {
    setUploadErr('');
    for(const file of files){
      const tmp='tmp-'+Math.random().toString(36).slice(2);
      setVault(p=>[{id:tmp,file_name:file.name,size_bytes:file.size,status:'uploading',progress:0},...p]);
      try {
        const r=await dashboardAPI.uploadFile(file,pct=>setVault(p=>p.map(f=>f.id===tmp?{...f,progress:pct}:f)));
        const uf=r.file;
        setVault(p=>p.map(f=>f.id===tmp?{...f,id:uf.id,file_name:uf.file_name,size_bytes:uf.size_bytes,uploaded_at:uf.uploaded_at,status:'secured',progress:100}:f));
        logEvent('File Uploaded', file.name);
      } catch(err){ setVault(p=>p.map(f=>f.id===tmp?{...f,status:'failed',error:err.message}:f)); setUploadErr(err.message||'Upload failed'); }
    }
  };
  const deleteFile = async id => { try{ await dashboardAPI.deleteVaultFile(id); setVault(p=>p.filter(f=>f.id!==id)); logEvent('File Deleted', vault.find(f=>f.id===id)?.file_name||id); showToast('File deleted.'); }catch(e){ showToast(e.message,'error'); } };
  const downloadFile = async (id, name) => { try{ showToast('Preparing download…','info'); await dashboardAPI.downloadVaultFile(id, name); logEvent('File Downloaded', name); }catch(e){ showToast(e.message||'Download failed','error'); } };
  const checkIntegrity = async (id) => {
    setCheckingId(id);
    try{
      const r = await dashboardAPI.checkFileIntegrity(id);
      if(r.integrity?.integrity_ok) showToast('✓ Integrity verified — file is intact.');
      else showToast('⚠ Integrity check FAILED — file may be corrupted.','error');
    }catch(e){ showToast(e.message||'Check failed','error'); }
    finally{ setCheckingId(null); }
  };
  const changePassword = async () => {
    setPwErr(''); setPwOk('');
    if(!pwForm.current){setPwErr('Enter your current password.');return;}
    if(pwForm.next.length<8){setPwErr('New password must be at least 8 characters.');return;}
    if(pwForm.next!==pwForm.confirm){setPwErr('Passwords do not match.');return;}
    setPwSaving(true);
    try{
      await dashboardAPI.changePassword(pwForm.current,pwForm.next);
      setPwOk('Password changed. Other devices have been signed out.');
      setPwForm({current:'',next:'',confirm:''});
      logEvent('Password Changed','Password updated from settings');
      setTimeout(()=>setPwOk(''),4000);
    }catch(e){setPwErr(e.message||'Failed to change password.');}
    finally{setPwSaving(false);}
  };
  const saveProfile = async () => { setProfSaving(true); try{ await dashboardAPI.updateProfile(profForm); setProfSaved(true); logEvent('Profile Updated', 'Account details saved'); showToast('Profile saved.'); setTimeout(()=>setProfSaved(false),3000); }catch(e){ showToast(e.message||'Save failed.','error'); } finally{ setProfSaving(false); } };

  // ── 2FA handlers ─────────────────────────────────────────────────────────
  const twofa_begin = async () => {
    setTwofaBusy(true); setTwofaErr('');
    try {
      const res = await dashboardAPI.begin2FASetup();
      setTwofaSetup(res);
      setTwofaStep('setup');
      setTwofaCode('');
    } catch(e){ setTwofaErr(e.message||'Setup failed'); }
    finally{ setTwofaBusy(false); }
  };

  const twofa_confirm = async () => {
    if(!twofaCode.trim()){ setTwofaErr('Enter the 6-digit code from your app.'); return; }
    setTwofaBusy(true); setTwofaErr('');
    try {
      const res = await dashboardAPI.confirm2FASetup(twofaCode.trim());
      setTwofa({ enabled: true, recovery_codes_remaining: res.recovery_codes?.length || 8 });
      setTwofaCodes(res.recovery_codes || []);
      setTwofaStep('codes');
      setTwofaCode('');
      logEvent('2FA Enabled', 'TOTP authenticator configured');
      showToast('2FA enabled successfully!');
    } catch(e){ setTwofaErr(e.message||'Invalid code — check your authenticator app'); }
    finally{ setTwofaBusy(false); }
  };

  const twofa_disable = async () => {
    if(!twofaCode.trim()){ setTwofaErr('Enter your authenticator code to confirm.'); return; }
    setTwofaBusy(true); setTwofaErr('');
    try {
      await dashboardAPI.disable2FA(twofaCode.trim());
      setTwofa({ enabled: false, recovery_codes_remaining: 0 });
      setTwofaStep('idle');
      setTwofaCode('');
      logEvent('2FA Disabled', 'Two-factor authentication turned off');
      showToast('2FA disabled.');
    } catch(e){ setTwofaErr(e.message||'Invalid code'); }
    finally{ setTwofaBusy(false); }
  };

  const twofa_regen = async () => {
    if(!twofaCode.trim()){ setTwofaErr('Enter your authenticator code to regenerate.'); return; }
    setTwofaBusy(true); setTwofaErr('');
    try {
      const res = await dashboardAPI.regenerateRecoveryCodes(twofaCode.trim());
      setTwofaCodes(res.recovery_codes || []);
      setTwofa(p => ({ ...p, recovery_codes_remaining: res.recovery_codes?.length || 8 }));
      setTwofaStep('codes');
      setTwofaCode('');
      showToast('Recovery codes regenerated.');
    } catch(e){ setTwofaErr(e.message||'Invalid code'); }
    finally{ setTwofaBusy(false); }
  };

  // ── Passkey handlers ─────────────────────────────────────────────────────
  const passkey_create = async () => {
    if(passkeyPin.length < 6){ setPasskeyErr('Enter a 6-digit PIN.'); return; }
    if(passkeyPin !== passkeyConfirm){ setPasskeyErr('PINs do not match.'); return; }
    setPasskeyBusy(true); setPasskeyErr('');
    try {
      await passkeyAPI.createPasskey(passkeyPin);
      setPasskeyStatus({ has_passkey: true, created_at: new Date().toISOString() });
      setPasskeyStep('idle');
      setPasskeyPin(''); setPasskeyConfirm('');
      showToast('Passkey saved! Use this PIN to sign in on any device.');
    } catch(e){ setPasskeyErr(e.message||'Failed to save passkey'); }
    finally{ setPasskeyBusy(false); }
  };

  const passkey_delete = async () => {
    if(passkeyPin.length < 6){ setPasskeyErr('Enter your current PIN to confirm deletion.'); return; }
    setPasskeyBusy(true); setPasskeyErr('');
    try {
      await passkeyAPI.deletePasskey(passkeyPin);
      setPasskeyStatus({ has_passkey: false, created_at: null });
      setPasskeyStep('idle');
      setPasskeyPin(''); setPasskeyConfirm('');
      showToast('Passkey removed.');
    } catch(e){ setPasskeyErr(e.message||'Incorrect PIN'); }
    finally{ setPasskeyBusy(false); }
  };

  // ── Session management handlers ──────────────────────────────────────────
  const loadSessions = async () => {
    setSessLoading(true);
    try { const r = await dashboardAPI.getSessions(); setSessions(r.sessions||[]); }
    catch(e){ showToast(e.message||'Failed to load sessions', 'error'); }
    finally { setSessLoading(false); }
  };

  const revokeSession = async (id) => {
    setRevokingId(id);
    try {
      await dashboardAPI.revokeSession(id);
      setSessions(s => s.filter(x => x.id !== id));
      showToast('Device signed out.');
    } catch(e){ showToast(e.message||'Failed to revoke session', 'error'); }
    finally { setRevokingId(null); }
  };

  const revokeAllSessions = async () => {
    setRevokeAllBusy(true);
    try {
      await dashboardAPI.revokeAllSessions();
      showToast('All devices signed out.');
      setTimeout(() => { onLogout?.(); }, 1200);
    } catch(e){ showToast(e.message||'Failed', 'error'); }
    finally { setRevokeAllBusy(false); }
  };

  const toggleTrust = async (s) => {
    setTrustingId(s.id);
    try {
      await dashboardAPI.trustDevice(s.id, !s.trusted);
      setSessions(prev => prev.map(x => x.id === s.id ? {...x, trusted: !s.trusted} : x));
      showToast(s.trusted ? 'Device unmarked as trusted.' : 'Device marked as trusted.');
    } catch(e){ showToast(e.message||'Failed', 'error'); }
    finally { setTrustingId(null); }
  };

  const submitRename = async (id) => {
    if(!renameVal.trim()) return;
    try {
      await dashboardAPI.renameDevice(id, renameVal.trim());
      setSessions(prev => prev.map(x => x.id === id ? {...x, device_name: renameVal.trim()} : x));
      setRenamingId(null); setRenameVal('');
      showToast('Device renamed.');
    } catch(e){ showToast(e.message||'Failed', 'error'); }
  };
  const connectProvider = async provider => {
    setConnecting(provider);
    try{ const fn=provider==='google'?dashboardAPI.getGoogleOAuthUrl:dashboardAPI.getMicrosoftOAuthUrl; const r=await fn(); sessionStorage.setItem('oauth_connecting',provider); logEvent('Account Linked', `${provider} OAuth initiated`); window.location.href=r.url; }
    catch(e){ showToast(e.message||`${provider} OAuth not configured.`,'error'); }
    finally{ setConnecting(''); }
  };
  const disconnectProvider = async provider => { try{ await dashboardAPI.disconnectAccount(provider); setConnected(p=>p.filter(a=>a.provider!==provider)); logEvent('Account Unlinked', `${provider} account disconnected`); showToast(`${provider} disconnected.`); }catch(e){ showToast(e.message,'error'); } };
  const connAcc = p => connected.find(a=>a.provider===p);
  const score = sec?.security_score??0;
  const rl    = sec?.risk_level||'low';

  if(loading) return (
    <div className="adm-root" data-theme={theme} style={{display:'grid',placeItems:'center',minHeight:'100vh'}}>
      <div style={{textAlign:'center'}}>
        <div className="adm-spinner lg" style={{margin:'0 auto 16px'}}/>
        <p style={{color:'var(--t-muted)',fontSize:14,fontWeight:500}}>Loading your security workspace…</p>
      </div>
    </div>
  );

  return (
    <div className="adm-root" data-theme={theme}>
      {/* Toast */}
      {toast && (
        <div className={`adm-toast ${toast.type}`}>
          {toast.type==='error'
            ? <X size={15}/>
            : <CheckCircle size={15}/>}
          {toast.msg}
          <button onClick={()=>setToast(null)}><X size={13}/></button>
        </div>
      )}

      {sidebarOpen && <div className="mob-overlay" onClick={()=>setSidebarOpen(false)}/>}
      <div className={`adm-shell${sidebarOpen?' sidebar-open':''}`}>
        {/* ── Sidebar ── */}
        <aside className="d-sidebar">
          <button className="mob-sidebar-close" onClick={()=>setSidebarOpen(false)} aria-label="Close menu" style={{display:"none",position:"absolute",top:14,right:14,border:"none",background:"var(--bg-hover)",borderRadius:8,padding:6,cursor:"pointer",color:"var(--t-muted)",lineHeight:0,zIndex:1}}><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
          <div className="brand">
            <button className="brand-logo" onClick={()=>onSwitchView?.('home')} style={{cursor:'pointer',border:'none'}}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </button>
            <div className="brand-text">
              <div className="brand-name">SyncVeil</div>
              <div className="brand-tag">SECURITY</div>
            </div>
          </div>

          <nav className="nav-section">
            <div className="nav-label">Workspace</div>
            {TABS.map(t=>(
              <button key={t.id} className={`nav-link${tab===t.id?' is-active':''}`} onClick={()=>setTab(t.id)}>
                <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">{t.svg}</svg>
                <span>{t.label}</span>
              </button>
            ))}
          </nav>

          <div className="sidebar-footer">
            <div className="workspace">
              <div className="workspace-avatar">{initials(profile?.full_name||propUser?.email||'U')}</div>
              <div className="workspace-text">
                <div className="workspace-name">{profile?.full_name||propUser?.email||'User'}</div>
                <div className="workspace-role">Security Account</div>
              </div>
            </div>
          </div>
        </aside>

        {/* ── Main ── */}
        <div className="adm-main">
          {/* Topbar */}
          <header className="d-topbar">
            <button className="mob-hamburger icon-btn" onClick={()=>setSidebarOpen(v=>!v)} aria-label="Toggle menu"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg></button>
            <div className="crumbs" style={{overflow:"hidden",minWidth:0,flex:1}}>
              <span>SyncVeil</span>
              <span className="sep">/</span>
              <span className="current">{TABS.find(t=>t.id===tab)?.label||'Dashboard'}</span>
            </div>
            <div className="topbar-actions">
              {lastRefreshed && <span style={{fontSize:11,color:'var(--t-light)',fontFamily:'JetBrains Mono,monospace',letterSpacing:'0.04em'}}>Updated {ago(lastRefreshed.toISOString())}</span>}
              <button className="icon-btn" onClick={()=>loadAll(true)} disabled={refreshing} title="Refresh">
                <RefreshCw size={16} style={refreshing?{animation:'adm-spin 700ms linear infinite'}:{}}/>
              </button>
              <button className="icon-btn" onClick={toggleTheme} title="Toggle theme">
                {theme==='dark' ? <Sun size={16}/> : <Moon size={16}/>}
              </button>
              <button className="icon-btn" onClick={()=>onLogout?.()} title="Sign out">
                <LogOut size={16}/>
              </button>
              <div className="adm-avatar">{initials(profile?.full_name||propUser?.email||'U')}</div>
            </div>
          </header>

          {/* Content */}
          <main className="content">

            {/* ── OVERVIEW ── */}
            {tab==='overview' && (
              <>
                <section className="hero">
                  <div className="hero-text">
                    <span className="eyebrow">Security Dashboard</span>
                    <h1 className="hero-title">Welcome back, <span className="accent">{profile?.full_name?.split(' ')[0]||'User'}</span></h1>
                    <p className="hero-sub">Your security score is <strong style={{color:score>=80?'var(--success)':score>=60?'var(--warning)':'var(--danger)'}}>{score}/100</strong> — risk level is <strong>{rl}</strong>.</p>
                  </div>
                  <div className="hero-actions">
                    <button className="btn btn--ghost" onClick={()=>loadAll(true)}>
                      <RefreshCw size={14}/> Refresh data
                    </button>
                    <button className="btn btn--primary" onClick={()=>setTab('monitor')}>
                      <Eye size={14}/> View threats
                    </button>
                  </div>
                </section>

                <div className="kpi-grid">
                  <KpiCard label="Security Score" value={score} sup="/100" iconKind="success" pill={score>=80?'Excellent':score>=60?'Good':'At Risk'} pillKind={score>=80?'up':score>=60?'neutral':'down'}
                    compare={<><a style={{cursor:'pointer',color:'var(--primary)'}} onClick={()=>setTab('score')}>View full breakdown →</a></>}>
                    <Shield size={15}/>
                  </KpiCard>
                  <KpiCard label="Risk Level" value={rl.charAt(0).toUpperCase()+rl.slice(1)} iconKind={rl==='low'?'success':rl==='medium'?'warning':'danger'}
                    pill={rl==='low'?'Safe':rl==='medium'?'Monitor':'Act now'} pillKind={rl==='low'?'up':rl==='medium'?'neutral':'down'}
                    compare={<>based on recent activity</>}>
                    <AlertTriangle size={15}/>
                  </KpiCard>
                  <KpiCard label="Active Sessions" value={sec?.active_sessions??0} iconKind="purple" pillKind="neutral"
                    compare={<>devices signed in now</>}>
                    <Smartphone size={15}/>
                  </KpiCard>
                  <KpiCard label="Security Events" value={events.length} iconKind="info" pill="7 days" pillKind="info"
                    compare={<><strong>{events.filter(e=>(e.reason||e.event_type||'').toLowerCase().match(/fail|bad_cred|block/)).length}</strong> failures detected</>}>
                    <Activity size={15}/>
                  </KpiCard>
                  <KpiCard label="2FA Status" value={twofa?.enabled?'Active':'Off'} iconKind={twofa?.enabled?'success':'warning'}
                    pill={twofa?.enabled?'Protected':'Recommended'} pillKind={twofa?.enabled?'up':'down'}
                    compare={twofa?.enabled?<>{twofa.recovery_codes_remaining} recovery codes left</>:<><a style={{cursor:'pointer',color:'var(--accent)'}} onClick={()=>setTab('settings')}>Enable now →</a></>}>
                    <Shield size={15}/>
                  </KpiCard>
                </div>

                {/* Passkey nudge banner */}
                {passkeyStatus && !passkeyStatus.has_passkey && (
                  <div style={{background:'linear-gradient(135deg,rgba(99,102,241,.08),rgba(99,102,241,.03))',border:'1px solid rgba(99,102,241,.25)',borderRadius:12,padding:'14px 18px',display:'flex',alignItems:'center',gap:14,marginBottom:8,flexWrap:'wrap'}}>
                    <div style={{width:36,height:36,borderRadius:10,background:'rgba(99,102,241,.15)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                      <Lock size={16} style={{color:'var(--primary)'}}/>
                    </div>
                    <div style={{flex:1,minWidth:180}}>
                      <div style={{fontWeight:600,fontSize:'.9rem',marginBottom:2}}>Speed up your sign-ins with a passkey</div>
                      <div style={{fontSize:'.82rem',opacity:.7}}>Set a 6-digit cloud PIN once — sign in instantly on any device, no email code needed.</div>
                    </div>
                    <button className="btn btn--primary" style={{flexShrink:0,fontSize:13}} onClick={()=>{ setPasskeyStep('create'); setPasskeyPin(''); setPasskeyConfirm(''); setPasskeyErr(''); setTab('settings'); }}>
                      Set up passkey
                    </button>
                    <button style={{background:'none',border:'none',cursor:'pointer',opacity:.5,padding:4}} onClick={()=>setPasskeyStatus(p=>({...p,_dismissed:true}))}>
                      <X size={16}/>
                    </button>
                  </div>
                )}

                <div className="grid">
                  {/* Radial rings: score breakdown */}
                  <section className="col-6 card">
                    <div className="card-head">
                      <div className="card-title-wrap">
                        <span className="eyebrow">Security</span>
                        <h2 className="card-title">Account health</h2>
                      </div>
                      <button className="card-action" onClick={()=>setTab('monitor')}>
                        Full report <svg viewBox="0 0 24 24"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
                      </button>
                    </div>
                    <div className="sv-radials" style={{gridTemplateColumns:'repeat(2,minmax(0,1fr))'}}>
                      <Radial pct={score} color="success" label="Security score" caption="overall health"/>
                      <Radial pct={Math.min(100,events.filter(e=>!(e.reason||e.event_type||'').toLowerCase().match(/fail|bad_cred|block/)).length*4)} color="primary" label="Auth success rate" caption="last 25 events"/>
                      <Radial pct={connected.length>0?100:20} color="info" label="Account linking" caption="providers connected"/>
                      <Radial pct={vault.length>0?80:0} color="warning" label="Vault usage" caption="encrypted files"/>
                    </div>
                  </section>

                  {/* Recent security events */}
                  <section className="col-6 card">
                    <div className="card-head">
                      <div className="card-title-wrap">
                        <span className="eyebrow">Activity</span>
                        <h2 className="card-title">Recent events</h2>
                      </div>
                      <button className="card-action" onClick={()=>setTab('monitor')}>
                        View all <svg viewBox="0 0 24 24"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
                      </button>
                    </div>
                    {events.length===0
                      ? <p style={{color:'var(--t-muted)',fontSize:13,textAlign:'center',padding:'24px 0'}}>No recent events</p>
                      : events.slice(0,8).map((ev,i)=>(
                        <div key={i} className="event-row">
                          <div className={`event-dot ${eventDot(ev.reason||ev.event_type)}`}/>
                          <div>
                            <div className="event-text">{evLabel(ev)}</div>
                            <div className="event-sub">{ev.ip_address||(ev.device_info||ev.user_agent)?.slice(0,40)||'—'}</div>
                          </div>
                          <div className="event-time">{ago(ev.created_at||ev.timestamp)}</div>
                        </div>
                      ))
                    }
                  </section>

                  {/* Connected accounts */}
                  <section className="col-6 card">
                    <div className="card-head">
                      <div className="card-title-wrap">
                        <span className="eyebrow">Integrations</span>
                        <h2 className="card-title">Connected accounts</h2>
                      </div>
                    </div>
                    {['google','microsoft'].map(p=>{
                      const acc=connAcc(p); return (
                      <div key={p} className="provider-row">
                        <div className="provider-logo"><ProviderLogo p={p}/></div>
                        <div className="provider-info">
                          <div className="provider-name">{p.charAt(0).toUpperCase()+p.slice(1)}</div>
                          <div className="provider-sub">{acc?acc.email||acc.displayName||'Connected':connecting===p?'Connecting…':'Not connected'}</div>
                        </div>
                        {acc
                          ? <button className="btn btn--soft-danger btn--sm" onClick={()=>disconnectProvider(p)}>Disconnect</button>
                          : <button className="btn btn--soft-primary btn--sm" onClick={()=>connectProvider(p)} disabled={!!connecting}>
                              {connecting===p?'…':'Connect'}
                            </button>
                        }
                      </div>
                    );})}
                  </section>

                  {/* Breach summary */}
                  <section className="col-6 card">
                    <div className="card-head">
                      <div className="card-title-wrap">
                        <span className="eyebrow">Monitoring</span>
                        <h2 className="card-title">Breach exposure</h2>
                      </div>
                      <button className="card-action" onClick={()=>setTab('monitor')}>
                        Details <svg viewBox="0 0 24 24"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
                      </button>
                    </div>
                    {breaches.length===0
                      ? <div className="adm-alert success"><CheckCircle size={15}/><div><strong>All clear.</strong> No data breaches detected for your email.</div></div>
                      : breaches.slice(0,5).map((b,i)=>(
                        <div key={i} className="event-row">
                          <div className="event-dot danger"/>
                          <div>
                            <div className="event-text">{b.message||b.Name||b.title||'Security event'}</div>
                            <div className="event-sub">{b.ip||b.BreachDate||b.date||'—'} · {ago(b.timestamp)}</div>
                          </div>
                          <span className="badge danger">Exposed</span>
                        </div>
                      ))
                    }
                  </section>
                </div>
              </>
            )}

            {/* ── EMAIL SECURITY ── */}
            {tab==='email' && (
              <>
                <section className="hero">
                  <div className="hero-text">
                    <span className="eyebrow">Email Security</span>
                    <h1 className="hero-title">Email <span className="accent">Protection</span></h1>
                    <p className="hero-sub">Monitor your email's security posture, DNS records, and breach exposure.</p>
                  </div>
                </section>
                <div className="grid">
                  <section className="col-12 card">
                    <div className="card-head">
                      <div className="card-title-wrap">
                        <span className="eyebrow">DNS + Authentication</span>
                        <h2 className="card-title">Email security posture</h2>
                      </div>
                    </div>
                    {emailSec && (
                      <div className="kpi-grid" style={{marginBottom:16}}>
                        <KpiCard label="Spam Risk" value={emailSec.spam_risk_score??0} sup="/100"
                          iconKind={emailSec.spam_risk_level==='low'?'success':emailSec.spam_risk_level==='critical'?'danger':'warning'}
                          pill={emailSec.spam_risk_level||'—'} pillKind={emailSec.spam_risk_level==='low'?'up':emailSec.spam_risk_level==='critical'?'down':'neutral'}
                          compare={<>based on login activity</>}><AlertTriangle size={15}/></KpiCard>
                        <KpiCard label="Failed Logins (7d)" value={emailSec.failed_attempts_7d??0}
                          iconKind={emailSec.failed_attempts_7d>5?'danger':'success'}
                          compare={<>authentication failures</>}><Activity size={15}/></KpiCard>
                        <KpiCard label="Unique IPs (7d)" value={emailSec.unique_ips_7d??0}
                          iconKind={emailSec.unique_ips_7d>5?'warning':'success'}
                          compare={<>distinct source IPs</>}><Globe size={15}/></KpiCard>
                        <KpiCard label="DNS Score" value={emailSec.dns_score??0} sup="/100"
                          iconKind={(emailSec.dns_score??0)>=70?'success':(emailSec.dns_score??0)>=40?'warning':'danger'}
                          compare={<>SPF + DKIM + DMARC</>}><Shield size={15}/></KpiCard>
                      </div>
                    )}
                    {!emailSec
                      ? <div className="adm-alert info"><Mail size={15}/><div>Email security analysis will appear here once your backend returns data.</div></div>
                      : (
                        <div className="grid" style={{marginBottom:0}}>
                          {[
                            {label:'SPF Record',   exists:emailSec.spf?.exists,   ok:emailSec.spf?.valid,   detail:emailSec.spf?.record||'No SPF record found'},
                            {label:'DKIM Record',  exists:emailSec.dkim?.exists,  ok:emailSec.dkim?.valid,  detail:emailSec.dkim?.record||'No DKIM record found'},
                            {label:'DMARC Record', exists:emailSec.dmarc?.exists, ok:emailSec.dmarc?.valid, detail:emailSec.dmarc?.record||'No DMARC record found'},
                          ].map(r=>(
                            <div key={r.label} className="col-4 card" style={{boxShadow:'none',border:'1px solid var(--border-soft)'}}>
                              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                                <div style={{fontSize:13,fontWeight:600,color:'var(--t-base)'}}>{r.label}</div>
                                <span className={`badge ${r.ok?'success':r.exists?'warning':'danger'}`}>
                                  {r.ok?'Pass':r.exists?'Invalid':'Missing'}
                                </span>
                              </div>
                              <div style={{fontFamily:'JetBrains Mono,monospace',fontSize:11,color:'var(--t-muted)',wordBreak:'break-all',lineHeight:1.6}}>{r.detail}</div>
                            </div>
                          ))}
                        </div>
                      )
                    }
                  </section>
                  <section className="col-12 card">
                    <div className="card-head">
                      <div className="card-title-wrap">
                        <span className="eyebrow">Breach Monitoring</span>
                        <h2 className="card-title">Known breaches</h2>
                      </div>
                    </div>
                    {breaches.length===0
                      ? <div className="adm-alert success"><CheckCircle size={15}/><div><strong>Great news.</strong> Your email hasn't appeared in any known data breaches.</div></div>
                      : (
                        <div className="table-scroll"><table className="table">
                          <thead><tr><th>Service</th><th>Date</th><th>Records exposed</th><th>Severity</th></tr></thead>
                          <tbody>
                            {breaches.map((b,i)=>(
                              <tr key={i}>
                                <td className="cell-name">{b.message||b.Name||b.title||'Security event'}</td>
                                <td className="cell-muted">{b.ip||b.BreachDate||b.date||'—'} · {ago(b.timestamp)}</td>
                                <td className="cell-mono">{b.PwnCount?.toLocaleString?.()||'—'}</td>
                                <td><span className={`tag ${severityTag(b.severity)}`}>{b.severity||'Unknown'}</span></td>
                              </tr>
                            ))}
                          </tbody>
                        </table></div>
                      )
                    }
                  </section>
                </div>
              </>
            )}

            {/* ── VAULT ── */}
{tab==='vault' && (
              <>
                <section className="hero">
                  <div className="hero-text">
                    <span className="eyebrow">Secure Container Engine</span>
                    <h1 className="hero-title">SSCE <span className="accent">Encrypted Vault</span></h1>
                    <p className="hero-sub">Files are malware-scanned, compressed, then AES-256-GCM encrypted in a signed .syncveil container before storage.</p>
                  </div>
                  <div className="hero-actions">
                    <button className="btn btn--primary" onClick={()=>fileRef.current?.click()}>
                      <Upload size={14}/> Upload file
                    </button>
                    <input ref={fileRef} type="file" multiple style={{display:'none'}} onChange={e=>{upload(Array.from(e.target.files||[]));e.target.value='';}}/>  
                  </div>
                </section>

                {/* ── Vault KPI row ── */}
                <div className="grid" style={{marginBottom:0}}>
                  <div className="col-3">
                    <article className="kpi-card c-primary">
                      <div className="kpi-top"><div className="kpi-identity"><div className="kpi-icon primary"><Lock size={16}/></div><div className="kpi-label">Encrypted Files</div></div></div>
                      <div className="kpi-value">{vault.filter(f=>f.status!=='uploading').length}</div>
                    </article>
                  </div>
                  <div className="col-3">
                    <article className="kpi-card c-success">
                      <div className="kpi-top"><div className="kpi-identity"><div className="kpi-icon success"><Shield size={16}/></div><div className="kpi-label">Vault Health</div></div></div>
                      <div className="kpi-value">{vaultStats?.vault_health_score ?? '—'}<sup style={{fontSize:14}}>%</sup></div>
                    </article>
                  </div>
                  <div className="col-3">
                    <article className="kpi-card c-warning">
                      <div className="kpi-top"><div className="kpi-identity"><div className="kpi-icon warning"><AlertTriangle size={16}/></div><div className="kpi-label">Malware Blocked</div></div></div>
                      <div className="kpi-value">{vaultStats?.malware_blocked ?? 0}</div>
                    </article>
                  </div>
                  <div className="col-3">
                    <article className="kpi-card c-primary">
                      <div className="kpi-top"><div className="kpi-identity"><div className="kpi-icon primary"><Activity size={16}/></div><div className="kpi-label">Integrity Failures</div></div></div>
                      <div className="kpi-value">{vaultStats?.integrity_fails ?? 0}</div>
                    </article>
                  </div>
                </div>

                {/* ── Storage quota bar ── */}
                {vaultStats && (
                  <div className="grid" style={{marginBottom:0}}>
                    <section className="col-12 card" style={{paddingTop:16,paddingBottom:16}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                        <span style={{fontSize:13,fontWeight:600}}>Storage Usage</span>
                        <span style={{fontSize:12,color:'var(--t-muted)'}}>
                          {fmt(vaultStats.total_size_bytes)} / {fmt(vaultStats.quota_bytes)} used
                          <span style={{marginLeft:8,color: vaultStats.quota_used_pct>85?'var(--danger)':vaultStats.quota_used_pct>60?'var(--warning)':'var(--success)'}}>
                            ({vaultStats.quota_used_pct}%)
                          </span>
                        </span>
                      </div>
                      <div className="progress" style={{height:8,borderRadius:4}}>
                        <div className="progress-fill gradient" style={{
                          width:`${Math.min(100,vaultStats.quota_used_pct)}%`,
                          background: vaultStats.quota_used_pct>85?'var(--danger)':undefined
                        }}/>
                      </div>
                    </section>
                  </div>
                )}

                <div className="grid">
                  <section className="col-12 card">
                    <div className="card-head">
                      <div className="card-title-wrap">
                        <span className="eyebrow">Vault · AES-256-GCM · Zstd · HMAC-SHA256</span>
                        <h2 className="card-title">Encrypted files — {vault.length} stored</h2>
                      </div>
                    </div>
                    {uploadErr && <div className="adm-alert danger" style={{marginBottom:16}}><AlertTriangle size={15}/>{uploadErr}</div>}
                    <div className={`dropzone${drag?' active':''}`}
                      onDragOver={e=>{e.preventDefault();e.stopPropagation();setDrag(true);}}
                      onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget))setDrag(false);}}
                      onDrop={e=>{e.preventDefault();setDrag(false);upload(Array.from(e.dataTransfer.files));}}
                      onClick={()=>fileRef.current?.click()}>
                      <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/></svg>
                      <p><strong>Click to upload</strong> or drag and drop files here.<br/>
                      <span style={{fontSize:12}}>Scanned → Compressed (Zstd) → Encrypted (AES-256-GCM) → Signed (HMAC-SHA256)</span></p>
                    </div>
                    <div style={{marginTop:20}}>
                      {vault.length===0
                        ? <p style={{textAlign:'center',color:'var(--t-muted)',fontSize:13,padding:'24px 0'}}>No files in your vault yet.</p>
                        : vault.map(f=>(
                          <div key={f.id} className="file-row">
                            <div className="file-icon">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
                            </div>
                            <div className="file-meta" style={{flex:1}}>
                              <div className="file-name">{f.file_name}</div>
                              <div className="file-size">
                                {fmt(f.size_bytes)}
                                {f.compression_type && <span style={{marginLeft:6,opacity:.6}}>· {f.compression_type}</span>}
                                {f.encryption_version && <span style={{marginLeft:6,opacity:.6}}>· AES-GCM v{f.encryption_version}</span>}
                                {f.malware_scan_status && <span style={{marginLeft:6,opacity:.6}}>· scan: {f.malware_scan_status}</span>}
                                <span style={{marginLeft:6,opacity:.6}}>· {f.uploaded_at?fmtDate(f.uploaded_at):'uploading…'}</span>
                              </div>
                              {f.status==='uploading' && f.progress!=null && (
                                <div className="progress" style={{marginTop:6}}>
                                  <div className="progress-fill gradient" style={{width:`${f.progress}%`}}/>
                                </div>
                              )}
                            </div>
                            <span className={`badge ${f.status==='secured'?'success':f.status==='failed'?'danger':'info'}`}>{f.status}</span>
                            {f.status!=='uploading' && (<>
                              <button className="icon-btn" onClick={()=>downloadFile(f.id,f.file_name)} title="Download" style={{marginLeft:4}}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>
                              </button>
                              <button className="icon-btn" onClick={()=>checkIntegrity(f.id)} title="Verify integrity" style={{marginLeft:4}} disabled={checkingId===f.id}>
                                {checkingId===f.id
                                  ? <span className="adm-spinner" style={{width:13,height:13,borderWidth:2}}/>
                                  : <CheckCircle size={15}/>}
                              </button>
                              <button className="icon-btn" onClick={()=>deleteFile(f.id)} title="Delete" style={{marginLeft:4}}>
                                <Trash2 size={15}/>
                              </button>
                            </>)}
                          </div>
                        ))
                      }
                    </div>
                  </section>
                </div>
              </>
            )}

            {/* ── MONITOR ── */}
            {tab==='monitor' && (
              <>
                <section className="hero">
                  <div className="hero-text">
                    <span className="eyebrow">Security Monitor</span>
                    <h1 className="hero-title">Threat <span className="accent">Intelligence</span></h1>
                    <p className="hero-sub">Real-time security events, login activity, and breach monitoring for your account.</p>
                  </div>
                  <div className="hero-actions">
                    <button className="btn btn--ghost" onClick={()=>loadAll(true)}>
                      <RefreshCw size={14}/> Refresh
                    </button>
                  </div>
                </section>
                <div className="grid">
                  <section className="col-6 card">
                    <div className="card-head">
                      <div className="card-title-wrap">
                        <span className="eyebrow">Activity Log</span>
                        <h2 className="card-title">Security events</h2>
                      </div>
                    </div>
                    {events.length===0
                      ? <p style={{color:'var(--t-muted)',fontSize:13,textAlign:'center',padding:'24px 0'}}>No events recorded.</p>
                      : events.map((ev,i)=>(
                        <div key={i} className="event-row">
                          <div className={`event-dot ${eventDot(ev.reason||ev.event_type)}`}/>
                          <div>
                            <div className="event-text">{evLabel(ev)}</div>
                            <div className="event-sub">{[ev.ip_address,(ev.device_info||ev.user_agent)?.slice(0,30)].filter(Boolean).join(' · ')||'—'}</div>
                          </div>
                          <div className="event-time">{ago(ev.created_at||ev.timestamp)}</div>
                        </div>
                      ))
                    }
                  </section>

                  <section className="col-6 card">
                    <div className="card-head">
                      <div className="card-title-wrap">
                        <span className="eyebrow">Data Breaches</span>
                        <h2 className="card-title">Breach exposure</h2>
                      </div>
                    </div>
                    {breaches.length===0
                      ? <div className="adm-alert success"><CheckCircle size={15}/><div><strong>All clear.</strong> No breaches found for your email address.</div></div>
                      : breaches.map((b,i)=>(
                        <div key={i} className="event-row">
                          <div className="event-dot danger"/>
                          <div>
                            <div className="event-text">{b.message||b.Name||b.title||'Security event'}</div>
                            <div className="event-sub">{b.ip||b.BreachDate||b.date||'—'} · {b.Description?.slice?.(0,60)||ago(b.timestamp)}</div>
                          </div>
                          <span className={`tag ${severityTag(b.severity)}`}>{b.severity||'—'}</span>
                        </div>
                      ))
                    }
                  </section>

                  <section className="col-12 card">
                    <div className="card-head">
                      <div className="card-title-wrap">
                        <span className="eyebrow">Sessions</span>
                        <h2 className="card-title">Active devices</h2>
                      </div>
                      <div style={{display:'flex',gap:8,alignItems:'center'}}>
                        <button className="btn btn--ghost btn--sm" onClick={loadSessions} disabled={sessLoading}>
                          <RefreshCw size={12}/> {sessLoading?'Loading…':'Refresh'}
                        </button>
                        <button className="btn btn--soft-danger btn--sm" onClick={revokeAllSessions} disabled={revokeAllBusy}
                          title="Sign out all devices including this one">
                          <LogOut size={12}/> {revokeAllBusy?'Signing out…':'Logout all devices'}
                        </button>
                      </div>
                    </div>

                    {/* Use sessions from loadSessions if available, fall back to dash.sessions */}
                    {(()=>{
                      const list = sessions.length > 0 ? sessions : (dash?.sessions||[]);
                      if(list.length===0) return (
                        <div style={{textAlign:'center',padding:'28px 0',color:'var(--t-muted)',fontSize:13}}>
                          <Smartphone size={28} style={{opacity:.3,marginBottom:8,display:'block',margin:'0 auto 8px'}}/>
                          No active sessions found.
                          <br/><button className="btn btn--ghost btn--sm" style={{marginTop:10}} onClick={loadSessions}>Load sessions</button>
                        </div>
                      );
                      return list.map((s) => {
                        const isRenaming = renamingId === s.id;
                        const DeviceIcon = s.icon==='mobile' ? Smartphone : s.icon==='terminal' ? Activity : () => (
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
                          </svg>
                        );
                        return (
                          <div key={s.id} className="session-row" style={{alignItems:'flex-start',gap:14,padding:'14px 0'}}>
                            {/* Icon */}
                            <div className="session-icon" style={{
                              background: s.trusted ? 'var(--success-soft)' : s.is_current ? 'var(--primary-soft)' : 'var(--bg-muted)',
                              color: s.trusted ? 'var(--success)' : s.is_current ? 'var(--primary)' : 'var(--t-muted)',
                              width:38, height:38, borderRadius:10,
                            }}>
                              <DeviceIcon size={16}/>
                            </div>

                            {/* Meta */}
                            <div className="session-meta" style={{flex:1}}>
                              {isRenaming ? (
                                <div style={{display:'flex',gap:6,alignItems:'center',marginBottom:4}}>
                                  <input
                                    className="input" value={renameVal} autoFocus
                                    onChange={e=>setRenameVal(e.target.value)}
                                    onKeyDown={e=>{ if(e.key==='Enter') submitRename(s.id); if(e.key==='Escape'){setRenamingId(null);setRenameVal('');} }}
                                    placeholder={s.device_name}
                                    style={{maxWidth:220,fontSize:12,padding:'4px 8px',height:28}}
                                  />
                                  <button className="btn btn--primary btn--sm" style={{padding:'4px 10px',fontSize:11}} onClick={()=>submitRename(s.id)}>Save</button>
                                  <button className="btn btn--ghost btn--sm" style={{padding:'4px 8px',fontSize:11}} onClick={()=>{setRenamingId(null);setRenameVal('');}}>✕</button>
                                </div>
                              ) : (
                                <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:2}}>
                                  <span className="session-name">{s.device_name}</span>
                                  {s.is_current && <span className="badge success" style={{fontSize:9,padding:'2px 6px'}}>Current</span>}
                                  {s.trusted && !s.is_current && <span className="badge primary" style={{fontSize:9,padding:'2px 6px'}}>Trusted</span>}
                                </div>
                              )}
                              <div className="session-sub" style={{display:'flex',gap:10,flexWrap:'wrap'}}>
                                <span>{s.os} · {s.browser}</span>
                                <span>·</span>
                                <span>{s.ip_address}</span>
                                <span>·</span>
                                <span>{s.location}</span>
                                <span>·</span>
                                <span>Last active {ago(s.last_used_at)}</span>
                              </div>
                              <div className="session-sub" style={{marginTop:2,fontSize:11}}>
                                Signed in {ago(s.created_at)}
                              </div>
                            </div>

                            {/* Actions */}
                            <div style={{display:'flex',gap:6,alignItems:'center',flexShrink:0,flexWrap:'wrap',justifyContent:'flex-end'}}>
                              {/* Rename */}
                              <button
                                className="btn btn--ghost btn--sm"
                                style={{padding:'4px 8px',fontSize:11}}
                                title="Rename this device"
                                onClick={()=>{ setRenamingId(s.id); setRenameVal(s.device_name); }}
                              >
                                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" style={{marginRight:3}}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                Rename
                              </button>
                              {/* Trust toggle */}
                              <button
                                className={`btn btn--sm ${s.trusted ? 'btn--ghost' : 'btn--ghost'}`}
                                style={{padding:'4px 8px',fontSize:11,color: s.trusted?'var(--warning)':'var(--success)'}}
                                title={s.trusted?'Remove trusted status':'Mark as trusted device'}
                                onClick={()=>toggleTrust(s)}
                                disabled={trustingId===s.id}
                              >
                                <Shield size={11} style={{marginRight:3}}/>
                                {trustingId===s.id ? '…' : s.trusted ? 'Untrust' : 'Trust'}
                              </button>
                              {/* Revoke */}
                              {!s.is_current && (
                                <button
                                  className="btn btn--soft-danger btn--sm"
                                  style={{padding:'4px 8px',fontSize:11}}
                                  title="Sign out this device"
                                  onClick={()=>revokeSession(s.id)}
                                  disabled={revokingId===s.id}
                                >
                                  <X size={11} style={{marginRight:3}}/>
                                  {revokingId===s.id ? 'Revoking…' : 'Revoke'}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </section>
                </div>
              </>
            )}


            {/* ── INTELLIGENCE ── */}
            {tab==='intel' && (
              <>
                <section className="hero">
                  <div className="hero-text">
                    <span className="eyebrow">Threat Intelligence</span>
                    <h1 className="hero-title">Security <span className="accent">Intelligence</span></h1>
                    <p className="hero-sub">Real-time breach monitoring via HaveIBeenPwned, LeakCheck, DNS health checks, IP reputation via AbuseIPDB, and URLhaus malware feeds.</p>
                  </div>
                  <div className="hero-actions">
                    <button className="btn btn--primary" onClick={loadIntel} disabled={intelLoading}>
                      {intelLoading
                        ? <><span className="adm-spinner" style={{width:14,height:14,borderWidth:2}}/> Scanning…</>
                        : <><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:14,height:14}}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> Run scan</>
                      }
                    </button>
                  </div>
                </section>

                {!intel && !intelLoading && (
                  <div className="adm-alert info" style={{marginBottom:24}}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    <div>Click <strong>Run scan</strong> to check your email against HaveIBeenPwned, LeakCheck, DNS records, and recent IP reputation data.</div>
                  </div>
                )}

                {intelLoading && (
                  <div style={{display:'flex',flexDirection:'column',gap:12,marginBottom:24}}>
                    {['Querying HaveIBeenPwned breach database…','Checking LeakCheck dark-web sources…','Analysing DNS records (SPF/DKIM/DMARC)…','Checking IP reputation via AbuseIPDB…'].map((m,i)=>(
                      <div key={i} className="adm-alert info" style={{animationDelay:`${i*120}ms`}}>
                        <span className="adm-spinner" style={{width:14,height:14,borderWidth:2,flexShrink:0}}/>
                        <span>{m}</span>
                      </div>
                    ))}
                  </div>
                )}

                {intel && (
                  <>
                    {/* Summary cards */}
                    <div className="kpi-grid" style={{marginBottom:20}}>
                      <KpiCard label="Total Breaches" value={intel.total_breaches} iconKind={intel.total_breaches>0?'danger':'success'}
                        pill={intel.total_breaches>0?'Exposed':'Clean'} pillKind={intel.total_breaches>0?'down':'up'}
                        compare={<>across HIBP + LeakCheck</>}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                      </KpiCard>
                      <KpiCard label="DNS Score" value={intel.dns?.score??0} sup="/100" iconKind={intel.dns?.score>=70?'success':intel.dns?.score>=40?'warning':'danger'}
                        pill={intel.dns?.score>=70?'Healthy':intel.dns?.score>=40?'Partial':'Insecure'} pillKind={intel.dns?.score>=70?'up':intel.dns?.score>=40?'neutral':'down'}
                        compare={<>SPF + DMARC + DKIM</>}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                      </KpiCard>
                      <KpiCard label="Malicious IPs" value={intel.ip_reputation?.filter(r=>r.is_malicious).length??0} iconKind={intel.ip_reputation?.some(r=>r.is_malicious)?'danger':'success'}
                        pill="Login IPs" pillKind="neutral"
                        compare={<>{intel.ip_reputation?.length??0} IPs checked via AbuseIPDB</>}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                      </KpiCard>
                      <KpiCard label="Risk Level" value={intel.risk?.charAt(0).toUpperCase()+intel.risk?.slice(1)} iconKind={intel.risk==='low'?'success':intel.risk==='medium'?'warning':'danger'}
                        pill={intel.risk==='low'?'Protected':intel.risk==='critical'?'Act now':'Review'} pillKind={intel.risk==='low'?'up':intel.risk==='critical'?'down':'neutral'}
                        compare={<>overall threat assessment</>}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                      </KpiCard>
                    </div>

                    {/* Recommendations */}
                    {intel.summary?.recommendation?.length > 0 && (
                      <div className="card" style={{marginBottom:20}}>
                        <div className="card-head">
                          <div className="card-title-wrap">
                            <span className="eyebrow">Action Required</span>
                            <h2 className="card-title">Recommendations</h2>
                          </div>
                        </div>
                        <div style={{display:'flex',flexDirection:'column',gap:10}}>
                          {intel.summary.recommendation.map((r,i)=>(
                            <div key={i} className={`adm-alert ${i===0&&intel.total_breaches>0?'danger':intel.risk==='low'?'success':'warning'}`}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                              <span>{r}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Sub-tabs */}
                    <div className="tabs">
                      {[['breaches','Breach Data'],['dns','DNS Health'],['ips','IP Reputation'],['feed','Live Threat Feed']].map(([id,label])=>(
                        <button key={id} className={`tab${intelTab===id?' is-active':''}`} onClick={()=>setIntelTab(id)}>{label}</button>
                      ))}
                    </div>

                    {/* Breach Data sub-tab */}
                    {intelTab==='breaches' && (
                      <div className="grid">
                        {/* HIBP */}
                        <section className="col-6 card">
                          <div className="card-head">
                            <div className="card-title-wrap">
                              <span className="eyebrow">HaveIBeenPwned</span>
                              <h2 className="card-title">Known breaches</h2>
                            </div>
                            {intel.hibp?.available
                              ? <span className={`badge ${intel.hibp.count>0?'danger':'success'}`}>{intel.hibp.count>0?`${intel.hibp.count} found`:'All clear'}</span>
                              : <span className="badge">{intel.hibp?.reason||'No API key'}</span>
                            }
                          </div>
                          {!intel.hibp?.available
                            ? <div className="adm-alert warning">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
                                <div><strong>HIBP_API_KEY not set.</strong> Add it to Render environment variables. Get your key at <span style={{fontFamily:'JetBrains Mono,monospace',fontSize:11}}>haveibeenpwned.com/API/Key</span></div>
                              </div>
                            : intel.hibp.count===0
                              ? <div className="adm-alert success"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg><div><strong>Not found in any breaches.</strong> Your email does not appear in HIBP's database of {(3e9).toLocaleString()}+ compromised accounts.</div></div>
                              : (
                                <div className="table-scroll"><table className="table">
                                  <thead><tr><th>Service</th><th>Date</th><th>Records</th><th>Severity</th></tr></thead>
                                  <tbody>
                                    {intel.hibp.breaches.map((b,i)=>(
                                      <tr key={i}>
                                        <td><div className="cell-name">{b.title||b.name}</div><div className="cell-muted">{b.domain}</div></td>
                                        <td className="cell-muted">{b.date}</td>
                                        <td className="cell-mono">{b.pwn_count?.toLocaleString?.()}</td>
                                        <td><span className={`tag ${severityTag(b.severity)}`}>{b.severity}</span></td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table></div>
                              )
                          }
                        </section>

                        {/* LeakCheck */}
                        <section className="col-6 card">
                          <div className="card-head">
                            <div className="card-title-wrap">
                              <span className="eyebrow">LeakCheck</span>
                              <h2 className="card-title">Dark-web sources</h2>
                            </div>
                            {intel.leakcheck?.available
                              ? <span className={`badge ${intel.leakcheck.found?'danger':'success'}`}>{intel.leakcheck.found?`${intel.leakcheck.count} source(s)`:'Clean'}</span>
                              : <span className="badge">{intel.leakcheck?.reason||'No API key'}</span>
                            }
                          </div>
                          {!intel.leakcheck?.available
                            ? <div className="adm-alert warning">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
                                <div><strong>LEAKCHECK_API_KEY not set.</strong> Free tier available at <span style={{fontFamily:'JetBrains Mono,monospace',fontSize:11}}>leakcheck.io</span></div>
                              </div>
                            : !intel.leakcheck.found
                              ? <div className="adm-alert success"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg><div><strong>Not found in dark-web leaks.</strong> Your credentials were not found in LeakCheck's database.</div></div>
                              : (
                                <div className="table-scroll"><table className="table">
                                  <thead><tr><th>Source</th><th>Date</th><th>Entries</th><th>Fields exposed</th></tr></thead>
                                  <tbody>
                                    {intel.leakcheck.sources.map((s,i)=>(
                                      <tr key={i}>
                                        <td className="cell-name">{s.name}</td>
                                        <td className="cell-muted">{s.date||'Unknown'}</td>
                                        <td className="cell-mono">{s.entries?.toLocaleString?.()}</td>
                                        <td><div style={{display:'flex',flexWrap:'wrap',gap:4}}>{(s.fields||[]).map((f,j)=><span key={j} className="tag purple">{f}</span>)}</div></td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table></div>
                              )
                          }
                        </section>
                      </div>
                    )}

                    {/* DNS Health sub-tab */}
                    {intelTab==='dns' && (
                      <div className="grid">
                        <section className="col-12 card">
                          <div className="card-head">
                            <div className="card-title-wrap">
                              <span className="eyebrow">DNS Security Records</span>
                              <h2 className="card-title">{intel.domain} — email domain health</h2>
                            </div>
                            <span className={`badge ${intel.dns?.score>=70?'success':intel.dns?.score>=40?'warning':'danger'}`}>Score: {intel.dns?.score??0}/100</span>
                          </div>
                          {intel.dns?.error
                            ? <div className="adm-alert warning"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg><div>{intel.dns.error}</div></div>
                            : (
                              <>
                                <div className="grid" style={{marginBottom:20}}>
                                  {[
                                    {key:'spf',  label:'SPF',   desc:'Sender Policy Framework — prevents email spoofing',    detail: intel.dns?.spf?.strength ? `Strength: ${intel.dns.spf.strength}` : null},
                                    {key:'dmarc',label:'DMARC', desc:'Domain Message Auth — defines breach handling policy',  detail: intel.dns?.dmarc?.policy ? `Policy: ${intel.dns.dmarc.policy}` : null},
                                    {key:'dkim', label:'DKIM',  desc:'DomainKeys Identified Mail — cryptographic signature', detail: intel.dns?.dkim?.selector ? `Selector: ${intel.dns.dkim.selector}` : null},
                                  ].map(({key,label,desc,detail})=>{
                                    const rec = intel.dns?.[key]||{};
                                    return (
                                      <div key={key} className="col-4 card" style={{boxShadow:'none',border:'1px solid var(--border-soft)',gap:12}}>
                                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                                          <div style={{fontSize:15,fontWeight:700,fontFamily:'Inter Tight,sans-serif',letterSpacing:'-0.02em'}}>{label}</div>
                                          <span className={`badge ${rec.valid?'success':rec.exists?'warning':'danger'}`}>{rec.valid?'PASS':rec.exists?'WEAK':'MISSING'}</span>
                                        </div>
                                        <div style={{fontSize:12,color:'var(--t-muted)',lineHeight:1.5}}>{desc}</div>
                                        {detail && <div style={{fontSize:11,color:'var(--t-light)',fontFamily:'JetBrains Mono,monospace'}}>{detail}</div>}
                                        {rec.record && <div style={{fontFamily:'JetBrains Mono,monospace',fontSize:10.5,color:'var(--t-muted)',wordBreak:'break-all',background:'var(--bg-muted)',borderRadius:8,padding:'8px 10px',lineHeight:1.6}}>{rec.record}</div>}
                                      </div>
                                    );
                                  })}
                                </div>
                                {intel.dns?.mx?.records?.length > 0 && (
                                  <div>
                                    <div style={{fontSize:12,fontWeight:600,color:'var(--t-muted)',marginBottom:8,fontFamily:'JetBrains Mono,monospace',letterSpacing:'0.1em',textTransform:'uppercase'}}>MX Records</div>
                                    {intel.dns.mx.records.map((mx,i)=>(
                                      <div key={i} style={{display:'flex',gap:12,padding:'8px 0',borderBottom:'1px solid var(--border-soft)',fontSize:13}}>
                                        <span style={{fontFamily:'JetBrains Mono,monospace',color:'var(--t-light)',minWidth:40}}>{mx.preference}</span>
                                        <span style={{color:'var(--t-base)',fontWeight:500}}>{mx.exchange}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </>
                            )
                          }
                        </section>
                      </div>
                    )}

                    {/* IP Reputation sub-tab */}
                    {intelTab==='ips' && (
                      <div className="grid">
                        <section className="col-12 card">
                          <div className="card-head">
                            <div className="card-title-wrap">
                              <span className="eyebrow">AbuseIPDB</span>
                              <h2 className="card-title">Login IP reputation</h2>
                            </div>
                            <span className="badge info">{intel.ip_reputation?.length??0} IPs checked</span>
                          </div>
                          {(!intel.ip_reputation||intel.ip_reputation.length===0)
                            ? <div className="adm-alert info"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><div>No login IPs found yet. Log in from more devices to build a reputation report.</div></div>
                            : !intel.ip_reputation[0]?.available
                              ? <div className="adm-alert warning"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg><div><strong>ABUSEIPDB_API_KEY not set.</strong> Get a free key at <span style={{fontFamily:'JetBrains Mono,monospace',fontSize:11}}>abuseipdb.com/register</span></div></div>
                              : (
                                <div className="table-scroll"><table className="table">
                                  <thead><tr><th>IP Address</th><th>Country / ISP</th><th>Abuse Score</th><th>Reports</th><th>Status</th></tr></thead>
                                  <tbody>
                                    {intel.ip_reputation.map((ip,i)=>(
                                      <tr key={i}>
                                        <td className="cell-mono">{ip.ip}</td>
                                        <td><div className="cell-name">{ip.country}</div><div className="cell-muted">{ip.isp}</div></td>
                                        <td>
                                          <div style={{display:'flex',alignItems:'center',gap:8}}>
                                            <div className="progress" style={{width:80,flexShrink:0}}><div className={`progress-fill ${ip.abuse_score>50?'danger':ip.abuse_score>25?'warning':'success'}`} style={{width:`${ip.abuse_score}%`}}/></div>
                                            <span style={{fontFamily:'JetBrains Mono,monospace',fontSize:12}}>{ip.abuse_score}%</span>
                                          </div>
                                        </td>
                                        <td className="cell-mono">{ip.total_reports}</td>
                                        <td><span className={`tag ${ip.is_malicious?'danger':'success'}`}>{ip.is_malicious?'Malicious':'Clean'}</span></td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table></div>
                              )
                          }
                        </section>
                      </div>
                    )}

                    {/* Live Threat Feed sub-tab */}
                    {intelTab==='feed' && <IntelFeedTab />}
                  </>
                )}
              </>
            )}

            {/* ── SETTINGS ── */}
            {tab==='settings' && (
              <>
                <section className="hero">
                  <div className="hero-text">
                    <span className="eyebrow">Account</span>
                    <h1 className="hero-title">Account <span className="accent">Settings</span></h1>
                    <p className="hero-sub">Manage your profile, appearance, and account security preferences.</p>
                  </div>
                </section>
                <div className="grid">
                  <section className="col-8 card">
                    <div className="card-head">
                      <div className="card-title-wrap">
                        <span className="eyebrow">Profile</span>
                        <h2 className="card-title">Personal information</h2>
                      </div>
                    </div>
                    <div className="form-grid">
                      <div className="field">
                        <label className="field-label">Full name</label>
                        <input className="input" value={profForm.full_name} onChange={e=>setProfForm(p=>({...p,full_name:e.target.value}))} placeholder="Your name"/>
                      </div>
                      <div className="field">
                        <label className="field-label">Phone number</label>
                        <input className="input" value={profForm.phone} onChange={e=>setProfForm(p=>({...p,phone:e.target.value}))} placeholder="+1 555 0100"/>
                      </div>
                      <div className="field">
                        <label className="field-label">Country</label>
                        <select className="adm-select input" value={profForm.country} onChange={e=>setProfForm(p=>({...p,country:e.target.value}))}>
                          <option value="">Select country…</option>
                          {COUNTRIES.map(c=><option key={c}>{c}</option>)}
                        </select>
                      </div>
                      <div className="field">
                        <label className="field-label">Date of birth</label>
                        <input className="input" type="date" value={profForm.date_of_birth} onChange={e=>setProfForm(p=>({...p,date_of_birth:e.target.value}))}/>
                      </div>
                    </div>
                    <div className="form-actions">
                      <button className="btn btn--primary" onClick={saveProfile} disabled={profSaving}>
                        {profSaving?'Saving…':profSaved?'Saved ✓':'Save changes'}
                      </button>
                    </div>

                    <div className="sv-divider" style={{margin:'20px 0'}}/>
                    <div className="card-head" style={{border:0,padding:'0 0 12px',margin:0}}>
                      <div className="card-title-wrap">
                        <span className="eyebrow">Security</span>
                        <h2 className="card-title" style={{fontSize:16}}>Change password</h2>
                      </div>
                    </div>
                    <div className="form-grid">
                      <div className="field" style={{gridColumn:'1/-1'}}>
                        <label className="field-label">Current password</label>
                        <input className="input" type="password" value={pwForm.current} onChange={e=>setPwForm(p=>({...p,current:e.target.value}))} placeholder="••••••••" autoComplete="current-password"/>
                      </div>
                      <div className="field">
                        <label className="field-label">New password</label>
                        <input className="input" type="password" value={pwForm.next} onChange={e=>setPwForm(p=>({...p,next:e.target.value}))} placeholder="At least 8 characters" autoComplete="new-password"/>
                      </div>
                      <div className="field">
                        <label className="field-label">Confirm new password</label>
                        <input className="input" type="password" value={pwForm.confirm} onChange={e=>setPwForm(p=>({...p,confirm:e.target.value}))} placeholder="Repeat new password" autoComplete="new-password"/>
                      </div>
                    </div>
                    {pwErr && <div className="adm-alert danger" style={{marginTop:8}}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><span>{pwErr}</span></div>}
                    {pwOk && <div className="adm-alert success" style={{marginTop:8}}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg><span>{pwOk}</span></div>}
                    <div className="form-actions">
                      <button className="btn btn--primary" onClick={changePassword} disabled={pwSaving||!pwForm.current||!pwForm.next||!pwForm.confirm}>
                        {pwSaving?'Changing…':'Change password'}
                      </button>
                    </div>
                  </section>

                  {/* ── Connected Accounts in Settings ── */}
                  <section className="col-8 card">
                    <div className="card-head">
                      <div className="card-title-wrap">
                        <span className="eyebrow">Integrations</span>
                        <h2 className="card-title">Connected accounts</h2>
                      </div>
                      <button className="btn btn--ghost btn--sm" onClick={()=>dashboardAPI.getConnectedAccounts().then(r=>setConnected(r?.accounts||[])).catch(()=>{})} title="Refresh">
                        <RefreshCw size={13}/> Refresh
                      </button>
                    </div>
                    <p style={{marginBottom:16,opacity:.75,fontSize:'.9rem',lineHeight:1.6}}>
                      Link your Google or Microsoft account to enhance your security monitoring and enable single sign-on.
                    </p>
                    {['google','microsoft'].map(p=>{
                      const acc=connAcc(p); return (
                      <div key={p} className="provider-row" style={{marginBottom:12}}>
                        <div className="provider-logo"><ProviderLogo p={p}/></div>
                        <div className="provider-info">
                          <div className="provider-name">{p.charAt(0).toUpperCase()+p.slice(1)}</div>
                          <div className="provider-sub">
                            {acc ? (acc.email||acc.display_name||acc.displayName||'Connected') : (connecting===p?'Connecting…':'Not connected')}
                          </div>
                        </div>
                        {acc
                          ? <button className="btn btn--soft-danger btn--sm" onClick={()=>disconnectProvider(p)}>Disconnect</button>
                          : <button className="btn btn--soft-primary btn--sm" onClick={()=>connectProvider(p)} disabled={!!connecting}>
                              {connecting===p?'…':'Connect'}
                            </button>
                        }
                      </div>
                    );})}
                  </section>

                  <section className="col-4 card">
                    <div className="card-head">
                      <div className="card-title-wrap">
                        <span className="eyebrow">Appearance</span>
                        <h2 className="card-title">Theme</h2>
                      </div>
                    </div>
                    <label className="switch">
                      <input type="checkbox" checked={theme==='dark'} onChange={toggleTheme}/>
                      <span className="track"/>
                      <span>{theme==='dark'?'Dark mode':'Light mode'}</span>
                    </label>
                    <div className="sv-divider"/>
                    <div className="card-head" style={{border:0,padding:'0 0 12px',margin:0}}>
                      <div className="card-title-wrap">
                        <span className="eyebrow">Danger Zone</span>
                        <h2 className="card-title" style={{fontSize:14}}>Account actions</h2>
                      </div>
                    </div>
                    <div style={{display:'flex',flexDirection:'column',gap:8}}>
                      <button className="btn btn--soft-danger" style={{justifyContent:'center'}} onClick={()=>onLogout?.()}>
                        <LogOut size={14}/> Sign out
                      </button>
                      <button className="btn btn--ghost btn--sm" style={{justifyContent:'center'}} onClick={()=>onLogout?.(true)}>
                        Sign out all devices
                      </button>
                    </div>
                  </section>

                  {/* ── 2FA Card ── */}
                  <section className="col-12 card">
                    <div className="card-head">
                      <div className="card-title-wrap">
                        <span className="eyebrow">Security</span>
                        <h2 className="card-title">Two-Factor Authentication (2FA)</h2>
                      </div>
                      {twofa?.enabled && twofaStep==='idle' && (
                        <span className="badge badge--success" style={{alignSelf:'center'}}>
                          <CheckCircle size={12} style={{marginRight:4}}/>Enabled
                        </span>
                      )}
                      {!twofa?.enabled && twofaStep==='idle' && (
                        <span className="badge badge--warning" style={{alignSelf:'center'}}>Not enabled</span>
                      )}
                    </div>

                    {/* ── idle: not enabled ── */}
                    {twofaStep==='idle' && !twofa?.enabled && (
                      <div>
                        <p style={{marginBottom:16,opacity:.75,fontSize:'.9rem',lineHeight:1.6}}>
                          Add an extra layer of protection to your account. After entering your email OTP, you'll also be asked for a 6-digit code from your authenticator app. Works with <strong>Google Authenticator</strong>, <strong>Microsoft Authenticator</strong>, Authy, and any TOTP-compatible app.
                        </p>
                        {twofaErr && <div className="alert alert--danger" style={{marginBottom:12}}>{twofaErr}</div>}
                        <button className="btn btn--primary" onClick={twofa_begin} disabled={twofaBusy}>
                          <Shield size={14}/> {twofaBusy?'Generating…':'Set up 2FA'}
                        </button>
                      </div>
                    )}

                    {/* ── idle: enabled ── */}
                    {twofaStep==='idle' && twofa?.enabled && (
                      <div>
                        <div style={{display:'flex',flexWrap:'wrap',gap:16,marginBottom:20}}>
                          <div className="kpi-card c-success" style={{flex:'1 1 180px',minWidth:160}}>
                            <div className="kpi-top"><div className="kpi-identity"><div className="kpi-icon success"><Shield size={16}/></div><div className="kpi-label">Status</div></div></div>
                            <div className="kpi-value" style={{fontSize:'1rem'}}>Active</div>
                          </div>
                          <div className="kpi-card c-primary" style={{flex:'1 1 180px',minWidth:160}}>
                            <div className="kpi-top"><div className="kpi-identity"><div className="kpi-icon primary"><Lock size={16}/></div><div className="kpi-label">Recovery codes</div></div></div>
                            <div className="kpi-value" style={{fontSize:'1rem'}}>{twofa.recovery_codes_remaining} remaining</div>
                          </div>
                        </div>
                        <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
                          <button className="btn btn--ghost" onClick={()=>{ setTwofaStep('regen'); setTwofaCode(''); setTwofaErr(''); }}>
                            <RefreshCw size={13}/> Regenerate recovery codes
                          </button>
                          <button className="btn btn--soft-danger" onClick={()=>{ setTwofaStep('disable'); setTwofaCode(''); setTwofaErr(''); }}>
                            <X size={13}/> Disable 2FA
                          </button>
                        </div>
                      </div>
                    )}

                    {/* ── setup: show QR + secret ── */}
                    {twofaStep==='setup' && twofaSetup && (
                      <div style={{display:'flex',flexDirection:'column',gap:20}}>
                        <div style={{display:'flex',gap:28,flexWrap:'wrap',alignItems:'flex-start'}}>
                          <div style={{flexShrink:0}}>
                            <p style={{marginBottom:8,fontWeight:600,fontSize:'.85rem'}}>1. Scan with your authenticator app</p>
                            <div style={{background:'#fff',padding:12,borderRadius:8,display:'inline-block',border:'1px solid var(--border)'}}>
                              <img
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(twofaSetup.provisioning_uri)}`}
                                alt="QR code" width={160} height={160} style={{display:'block'}}
                              />
                            </div>
                            <p style={{marginTop:8,fontSize:'.75rem',opacity:.6,textAlign:'center'}}>
                              Google Authenticator · Microsoft Authenticator · Authy
                            </p>
                          </div>
                          <div style={{flex:1,minWidth:200}}>
                            <p style={{marginBottom:8,fontWeight:600,fontSize:'.85rem'}}>Can't scan? Enter the key manually</p>
                            <div style={{background:'var(--surface-raised)',border:'1px solid var(--border)',borderRadius:6,padding:'10px 14px',fontFamily:'monospace',fontSize:'.8rem',letterSpacing:'0.08em',wordBreak:'break-all',marginBottom:12}}>
                              {twofaSetup.secret}
                            </div>
                            <p style={{fontSize:'.78rem',opacity:.65,lineHeight:1.5}}>
                              Open your authenticator app → tap <strong>"+"</strong> or <strong>"Add account"</strong> → choose <em>Time-based</em> → scan QR or enter the key above.
                            </p>
                          </div>
                        </div>
                        <div>
                          <p style={{marginBottom:8,fontWeight:600,fontSize:'.85rem'}}>2. Enter the 6-digit code to confirm</p>
                          <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
                            <input
                              className="input" inputMode="numeric" maxLength={6}
                              placeholder="000000" value={twofaCode}
                              onChange={e=>setTwofaCode(e.target.value.replace(/\D/g,''))}
                              style={{maxWidth:160,textAlign:'center',letterSpacing:'0.25em',fontSize:'1.1rem'}}
                              autoFocus
                            />
                            <button className="btn btn--primary" onClick={twofa_confirm} disabled={twofaBusy||twofaCode.length!==6}>
                              {twofaBusy?'Verifying…':'Confirm & enable'}
                            </button>
                            <button className="btn btn--ghost" onClick={()=>{ setTwofaStep('idle'); setTwofaCode(''); setTwofaErr(''); }}>
                              Cancel
                            </button>
                          </div>
                          {twofaErr && <div className="alert alert--danger" style={{marginTop:10}}>{twofaErr}</div>}
                        </div>
                      </div>
                    )}

                    {/* ── show recovery codes (once) ── */}
                    {twofaStep==='codes' && (
                      <div>
                        <div className="alert alert--warning" style={{marginBottom:16}}>
                          <strong>Save these recovery codes now.</strong> They won't be shown again. Each code can only be used once to sign in if you lose access to your authenticator app.
                        </div>
                        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))',gap:8,marginBottom:20}}>
                          {twofaCodes.map((c,i)=>(
                            <div key={i} style={{background:'var(--surface-raised)',border:'1px solid var(--border)',borderRadius:6,padding:'8px 12px',fontFamily:'monospace',fontSize:'.85rem',letterSpacing:'0.05em',textAlign:'center'}}>
                              {c}
                            </div>
                          ))}
                        </div>
                        <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
                          <button className="btn btn--primary" onClick={()=>{ const t=twofaCodes.join('\n'); navigator.clipboard?.writeText(t); showToast('Recovery codes copied!'); }}>
                            Copy all codes
                          </button>
                          <button className="btn btn--ghost" onClick={()=>{ setTwofaStep('idle'); setTwofaCodes([]); }}>
                            Done — I've saved them
                          </button>
                        </div>
                      </div>
                    )}

                    {/* ── disable confirm ── */}
                    {twofaStep==='disable' && (
                      <div>
                        <div className="alert alert--danger" style={{marginBottom:16}}>
                          Disabling 2FA reduces your account security. You'll only be protected by your email OTP.
                        </div>
                        <p style={{marginBottom:12,fontSize:'.88rem'}}>Enter your current authenticator code or a recovery code to confirm:</p>
                        <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
                          <input
                            className="input" placeholder="Code or XXXXX-XXXXX" value={twofaCode}
                            onChange={e=>setTwofaCode(e.target.value)}
                            style={{maxWidth:220,textAlign:'center',letterSpacing:'0.15em'}}
                            autoFocus
                          />
                          <button className="btn btn--danger" onClick={twofa_disable} disabled={twofaBusy||!twofaCode.trim()}>
                            {twofaBusy?'Disabling…':'Confirm disable'}
                          </button>
                          <button className="btn btn--ghost" onClick={()=>{ setTwofaStep('idle'); setTwofaCode(''); setTwofaErr(''); }}>
                            Cancel
                          </button>
                        </div>
                        {twofaErr && <div className="alert alert--danger" style={{marginTop:10}}>{twofaErr}</div>}
                      </div>
                    )}

                    {/* ── regen recovery codes confirm ── */}
                    {twofaStep==='regen' && (
                      <div>
                        <p style={{marginBottom:12,fontSize:'.88rem'}}>Enter your current authenticator code to generate new recovery codes (old ones will be invalidated):</p>
                        <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
                          <input
                            className="input" inputMode="numeric" maxLength={6} placeholder="000000" value={twofaCode}
                            onChange={e=>setTwofaCode(e.target.value.replace(/\D/g,''))}
                            style={{maxWidth:160,textAlign:'center',letterSpacing:'0.25em',fontSize:'1.1rem'}}
                            autoFocus
                          />
                          <button className="btn btn--primary" onClick={twofa_regen} disabled={twofaBusy||twofaCode.length!==6}>
                            {twofaBusy?'Regenerating…':'Regenerate'}
                          </button>
                          <button className="btn btn--ghost" onClick={()=>{ setTwofaStep('idle'); setTwofaCode(''); setTwofaErr(''); }}>
                            Cancel
                          </button>
                        </div>
                        {twofaErr && <div className="alert alert--danger" style={{marginTop:10}}>{twofaErr}</div>}
                      </div>
                    )}
                  </section>

                  {/* ── Passkey Card ── */}
                  <section className="col-12 card">
                    <div className="card-head">
                      <div className="card-title-wrap">
                        <span className="eyebrow">Security</span>
                        <h2 className="card-title">Cloud Passkey (6-digit PIN)</h2>
                      </div>
                      {passkeyStatus?.has_passkey && passkeyStep==='idle' && (
                        <span className="badge badge--success" style={{alignSelf:'center'}}>
                          <CheckCircle size={12} style={{marginRight:4}}/>Active
                        </span>
                      )}
                      {!passkeyStatus?.has_passkey && passkeyStep==='idle' && (
                        <span className="badge badge--warning" style={{alignSelf:'center'}}>Not set</span>
                      )}
                    </div>

                    {passkeyStep==='idle' && !passkeyStatus?.has_passkey && (
                      <div>
                        <p style={{marginBottom:16,opacity:.75,fontSize:'.9rem',lineHeight:1.6}}>
                          Set a 6-digit passkey PIN stored securely in the cloud. Next time you sign in, use your PIN instead of waiting for an email code — works on <strong>every device</strong>, no setup needed.
                        </p>
                        {passkeyErr && <div className="alert alert--danger" style={{marginBottom:12}}>{passkeyErr}</div>}
                        <button className="btn btn--primary" onClick={()=>{ setPasskeyStep('create'); setPasskeyPin(''); setPasskeyConfirm(''); setPasskeyErr(''); }}>
                          <Lock size={14}/> Set up passkey
                        </button>
                      </div>
                    )}

                    {passkeyStep==='idle' && passkeyStatus?.has_passkey && (
                      <div>
                        <p style={{marginBottom:16,opacity:.75,fontSize:'.9rem',lineHeight:1.6}}>
                          Your passkey PIN is active. Sign in instantly on any device — no email code needed.
                          {passkeyStatus.created_at && <><br/><span style={{fontSize:'.82rem',opacity:.6}}>Set on {new Date(passkeyStatus.created_at).toLocaleDateString()}</span></>}
                        </p>
                        <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
                          <button className="btn btn--ghost" onClick={()=>{ setPasskeyStep('create'); setPasskeyPin(''); setPasskeyConfirm(''); setPasskeyErr(''); }}>
                            <RefreshCw size={14}/> Change PIN
                          </button>
                          <button className="btn btn--ghost" style={{color:'var(--danger)',borderColor:'var(--danger)'}} onClick={()=>{ setPasskeyStep('delete'); setPasskeyPin(''); setPasskeyErr(''); }}>
                            <Trash2 size={14}/> Remove passkey
                          </button>
                        </div>
                      </div>
                    )}

                    {passkeyStep==='create' && (
                      <div>
                        <p style={{marginBottom:16,fontSize:'.9rem',opacity:.75}}>Choose a 6-digit PIN. It will be encrypted and saved to the cloud — same PIN works on all your devices.</p>
                        <div style={{marginBottom:14}}>
                          <label className="field-label" style={{display:'block',marginBottom:6}}>New PIN</label>
                          <div style={{display:'flex',gap:8}}>
                            {[0,1,2,3,4,5].map(i=>(
                              <input key={i} id={`pk-new-${i}`} type="text" inputMode="numeric" maxLength={1}
                                value={passkeyPin[i]||''}
                                autoFocus={i===0}
                                onChange={e=>{
                                  const ch=e.target.value.replace(/\D/g,'').slice(-1);
                                  const arr=(passkeyPin+'      ').slice(0,6).split(''); arr[i]=ch;
                                  setPasskeyPin(arr.join('').trimEnd()); setPasskeyErr('');
                                  if(ch&&i<5) setTimeout(()=>document.getElementById(`pk-new-${i+1}`)?.focus(),0);
                                }}
                                onKeyDown={e=>{ if(e.key==='Backspace'&&!passkeyPin[i]&&i>0){ const arr=(passkeyPin+'      ').slice(0,6).split(''); arr[i-1]=''; setPasskeyPin(arr.join('').trimEnd()); setTimeout(()=>document.getElementById(`pk-new-${i-1}`)?.focus(),0); }}}
                                style={{width:44,height:52,textAlign:'center',fontSize:20,fontWeight:700,border:passkeyPin[i]?'2px solid var(--primary)':'2px solid var(--border)',borderRadius:10,background:'var(--surface)',color:'var(--text)',caretColor:'transparent',outline:'none'}}
                              />
                            ))}
                          </div>
                        </div>
                        <div style={{marginBottom:16}}>
                          <label className="field-label" style={{display:'block',marginBottom:6}}>Confirm PIN</label>
                          <div style={{display:'flex',gap:8}}>
                            {[0,1,2,3,4,5].map(i=>(
                              <input key={i} id={`pk-conf-${i}`} type="text" inputMode="numeric" maxLength={1}
                                value={passkeyConfirm[i]||''}
                                onChange={e=>{
                                  const ch=e.target.value.replace(/\D/g,'').slice(-1);
                                  const arr=(passkeyConfirm+'      ').slice(0,6).split(''); arr[i]=ch;
                                  setPasskeyConfirm(arr.join('').trimEnd()); setPasskeyErr('');
                                  if(ch&&i<5) setTimeout(()=>document.getElementById(`pk-conf-${i+1}`)?.focus(),0);
                                }}
                                onKeyDown={e=>{ if(e.key==='Backspace'&&!passkeyConfirm[i]&&i>0){ const arr=(passkeyConfirm+'      ').slice(0,6).split(''); arr[i-1]=''; setPasskeyConfirm(arr.join('').trimEnd()); setTimeout(()=>document.getElementById(`pk-conf-${i-1}`)?.focus(),0); }}}
                                style={{width:44,height:52,textAlign:'center',fontSize:20,fontWeight:700,border:passkeyConfirm[i]&&passkeyConfirm[i]===passkeyPin[i]?'2px solid var(--success)':passkeyConfirm[i]?'2px solid var(--danger)':'2px solid var(--border)',borderRadius:10,background:'var(--surface)',color:'var(--text)',caretColor:'transparent',outline:'none'}}
                              />
                            ))}
                          </div>
                        </div>
                        {passkeyErr && <div className="alert alert--danger" style={{marginBottom:12}}>{passkeyErr}</div>}
                        <div style={{display:'flex',gap:10}}>
                          <button className="btn btn--primary" onClick={passkey_create}
                            disabled={passkeyBusy||passkeyPin.replace(/\s/g,'').length<6||passkeyConfirm.replace(/\s/g,'').length<6}>
                            {passkeyBusy?'Saving…':'Save passkey'}
                          </button>
                          <button className="btn btn--ghost" onClick={()=>{ setPasskeyStep('idle'); setPasskeyPin(''); setPasskeyConfirm(''); setPasskeyErr(''); }}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {passkeyStep==='delete' && (
                      <div>
                        <div className="alert alert--warning" style={{marginBottom:16,display:'flex',gap:10,alignItems:'flex-start'}}>
                          <AlertTriangle size={16} style={{flexShrink:0,marginTop:2}}/>
                          <span>Removing your passkey means you'll need an email code every time you sign in.</span>
                        </div>
                        <p style={{marginBottom:12,fontSize:'.88rem'}}>Enter your current passkey PIN to confirm:</p>
                        <div style={{display:'flex',gap:8,marginBottom:14}}>
                          {[0,1,2,3,4,5].map(i=>(
                            <input key={i} id={`pk-del-${i}`} type="text" inputMode="numeric" maxLength={1}
                              value={passkeyPin[i]||''}
                              autoFocus={i===0}
                              onChange={e=>{
                                const ch=e.target.value.replace(/\D/g,'').slice(-1);
                                const arr=(passkeyPin+'      ').slice(0,6).split(''); arr[i]=ch;
                                setPasskeyPin(arr.join('').trimEnd()); setPasskeyErr('');
                                if(ch&&i<5) setTimeout(()=>document.getElementById(`pk-del-${i+1}`)?.focus(),0);
                              }}
                              onKeyDown={e=>{ if(e.key==='Backspace'&&!passkeyPin[i]&&i>0){ const arr=(passkeyPin+'      ').slice(0,6).split(''); arr[i-1]=''; setPasskeyPin(arr.join('').trimEnd()); setTimeout(()=>document.getElementById(`pk-del-${i-1}`)?.focus(),0); }}}
                              style={{width:44,height:52,textAlign:'center',fontSize:20,fontWeight:700,border:passkeyPin[i]?'2px solid var(--danger)':'2px solid var(--border)',borderRadius:10,background:'var(--surface)',color:'var(--text)',caretColor:'transparent',outline:'none'}}
                            />
                          ))}
                        </div>
                        {passkeyErr && <div className="alert alert--danger" style={{marginBottom:12}}>{passkeyErr}</div>}
                        <div style={{display:'flex',gap:10}}>
                          <button className="btn btn--danger" onClick={passkey_delete}
                            disabled={passkeyBusy||passkeyPin.replace(/\s/g,'').length<6}>
                            {passkeyBusy?'Removing…':'Confirm remove'}
                          </button>
                          <button className="btn btn--ghost" onClick={()=>{ setPasskeyStep('idle'); setPasskeyPin(''); setPasskeyErr(''); }}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </section>
                </div>
              </>
            )}

            {/* ── SECURITY SCORE ENGINE ── */}
            {tab==='score' && (
              <SecurityScoreEngine
                twofa={twofa}
                breaches={breaches}
                events={events}
                sessions={sessions}
                vault={vault}
                vaultStats={vaultStats}
                sec={sec}
                onNavigate={setTab}
              />
            )}

            {/* ── ALERT ENGINE ── */}
            {tab==='alerts' && (
              <AlertEngine showToast={showToast} logEvent={logEvent}/>
            )}

            {/* ── ACTIVITY LOG ── */}
            {tab==='activity' && (() => {
              const EVENT_META = {
                'File Uploaded':    { dot:'primary', icon:<Upload size={14}/>,       kind:'info'    },
                'File Downloaded':  { dot:'info',    icon:<Download size={14}/>,     kind:'info'    },
                'File Deleted':     { dot:'danger',  icon:<Trash2 size={14}/>,       kind:'danger'  },
                '2FA Enabled':      { dot:'success', icon:<Shield size={14}/>,       kind:'success' },
                '2FA Disabled':     { dot:'warning', icon:<Shield size={14}/>,       kind:'warning' },
                'Password Changed': { dot:'warning', icon:<Lock size={14}/>,         kind:'warning' },
                'Profile Updated':  { dot:'info',    icon:<User size={14}/>,          kind:'info'    },
                'Login Success':    { dot:'success', icon:<CheckCircle size={14}/>,  kind:'success' },
                'Login Failure':    { dot:'danger',  icon:<X size={14}/>,            kind:'danger'  },
                'Account Linked':   { dot:'primary', icon:<Link size={14}/>,         kind:'info'    },
                'Account Unlinked': { dot:'warning', icon:<Link size={14}/>,         kind:'warning' },
              };
              const dotColor = d => ({
                primary:'var(--primary)',success:'var(--success)',danger:'var(--danger)',
                warning:'var(--warning)',info:'var(--info)',
              }[d]||'var(--t-muted)');

              const counts = activityLog.reduce((acc, e) => { acc[e.type]=(acc[e.type]||0)+1; return acc; }, {});
              const [filter, setFilter] = useState('all');
              const [search, setSearch] = useState('');
              const filtered = activityLog.filter(e =>
                (filter==='all' || e.type===filter) &&
                (!search || e.type.toLowerCase().includes(search.toLowerCase()) || e.detail.toLowerCase().includes(search.toLowerCase()))
              );

              return (
                <>
                  <section className="hero">
                    <div className="hero-text">
                      <span className="eyebrow">Audit</span>
                      <h1 className="hero-title">Activity <span className="accent">Log</span></h1>
                      <p className="hero-sub">A full audit trail of every security-relevant action on your account.</p>
                    </div>
                    <div className="hero-actions">
                      <button className="btn btn--ghost" onClick={clearActivityLog}>
                        <Trash2 size={14}/> Clear log
                      </button>
                    </div>
                  </section>

                  {/* KPI strip */}
                  <div className="kpi-grid" style={{marginBottom:20}}>
                    {[
                      {label:'Total Events',    value:activityLog.length,                   kind:'primary'},
                      {label:'Login Successes', value:counts['Login Success']||0,           kind:'success'},
                      {label:'Login Failures',  value:counts['Login Failure']||0,           kind:'danger' },
                      {label:'Vault Actions',   value:(counts['File Uploaded']||0)+(counts['File Downloaded']||0)+(counts['File Deleted']||0), kind:'info'},
                    ].map(k=>(
                      <KpiCard key={k.label} label={k.label} value={k.value} iconKind={k.kind}
                        compare={<>tracked this session</>}>
                        <Activity size={15}/>
                      </KpiCard>
                    ))}
                  </div>

                  <div className="grid">
                    <section className="col-12 card">
                      <div className="card-head" style={{flexWrap:'wrap',gap:10}}>
                        <div className="card-title-wrap">
                          <span className="eyebrow">Audit trail</span>
                          <h2 className="card-title">{filtered.length} event{filtered.length!==1?'s':''}</h2>
                        </div>
                        <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center',marginLeft:'auto'}}>
                          <input className="input" placeholder="Search events…" value={search}
                            onChange={e=>setSearch(e.target.value)}
                            style={{width:180,padding:'6px 10px',fontSize:12}}/>
                          <select className="adm-select input" value={filter} onChange={e=>setFilter(e.target.value)}
                            style={{fontSize:12,padding:'6px 10px',minWidth:160}}>
                            <option value="all">All types</option>
                            {Object.keys(EVENT_META).map(k=><option key={k} value={k}>{k}</option>)}
                          </select>
                        </div>
                      </div>

                      {filtered.length===0 ? (
                        <div style={{textAlign:'center',padding:'40px 0',color:'var(--t-muted)',fontSize:13}}>
                          <Activity size={32} style={{opacity:.2,margin:'0 auto 10px',display:'block'}}/>
                          {activityLog.length===0
                            ? 'No activity yet — events appear here as you use SyncVeil.'
                            : 'No events match your filter.'}
                        </div>
                      ) : (
                        <div className="table-scroll"><table className="table">
                          <thead>
                            <tr>
                              <th style={{width:18}}></th>
                              <th>Event</th>
                              <th>Detail</th>
                              <th style={{whiteSpace:'nowrap'}}>Time</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filtered.map(ev => {
                              const meta = EVENT_META[ev.type] || { dot:'info', kind:'info' };
                              return (
                                <tr key={ev.id}>
                                  <td>
                                    <div style={{
                                      width:8,height:8,borderRadius:'50%',
                                      background:dotColor(meta.dot),flexShrink:0,
                                    }}/>
                                  </td>
                                  <td>
                                    <div style={{display:'flex',alignItems:'center',gap:7}}>
                                      <span style={{
                                        display:'inline-flex',alignItems:'center',justifyContent:'center',
                                        width:24,height:24,borderRadius:6,
                                        background:`var(--${meta.dot==='primary'?'primary':meta.dot==='success'?'success':meta.dot==='danger'?'danger':meta.dot==='warning'?'warning':'info'}-soft)`,
                                        color:`var(--${meta.dot==='primary'?'primary':meta.dot==='success'?'success':meta.dot==='danger'?'danger':meta.dot==='warning'?'warning':'info'})`,
                                        flexShrink:0,
                                      }}>{meta.icon}</span>
                                      <span style={{fontWeight:600,fontSize:12.5,color:'var(--t-base)'}}>{ev.type}</span>
                                    </div>
                                  </td>
                                  <td style={{fontSize:12,color:'var(--t-muted)',maxWidth:340,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}
                                    title={ev.detail}>{ev.detail||'—'}</td>
                                  <td style={{fontFamily:'JetBrains Mono,monospace',fontSize:11,color:'var(--t-light)',whiteSpace:'nowrap'}}>
                                    {new Date(ev.ts).toLocaleString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'})}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table></div>
                      )}
                    </section>
                  </div>
                </>
              );
            })()}

          </main>

          {/* Footer */}
          <footer className="d-footer" style={{flexWrap:"wrap",gap:12}}>
            <span>© {new Date().getFullYear()} SyncVeil Inc. All rights reserved.</span>
            <div className="d-footer-meta">
              <span>SECURITY</span>
              <span>·</span>
              <span>ENCRYPTED</span>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
