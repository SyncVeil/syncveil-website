import React from 'react';

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer style={{
      borderTop:'1px solid #E4E8EF',
      background:'white',
      padding:'24px 32px',
      display:'flex',
      justifyContent:'space-between',
      alignItems:'center',
      flexWrap:'wrap',
      gap:16,
    }}>
      <div style={{display:'flex',alignItems:'center',gap:10}}>
        <div style={{width:26,height:26,background:'#2563EB',borderRadius:6,display:'grid',placeItems:'center'}}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
        </div>
        <span style={{fontSize:12,color:'#94A3B8',fontFamily:'JetBrains Mono,monospace',letterSpacing:'0.06em'}}>© {year} SYNCVEIL INC.</span>
      </div>
      <nav style={{display:'flex',gap:20,flexWrap:'wrap'}}>
        {[
          {label:'Privacy Policy', href:'./privacy-policy.html'},
          {label:'Terms of Service', href:'./terms-of-service.html'},
          {label:'Cookie Policy', href:'./cookie-policy.html'},
        ].map(l=>(
          <a key={l.label} href={l.href} style={{fontSize:12,color:'#94A3B8',textDecoration:'none',fontWeight:500,transition:'color 160ms'}}
            onMouseEnter={e=>e.currentTarget.style.color='#2563EB'}
            onMouseLeave={e=>e.currentTarget.style.color='#94A3B8'}>
            {l.label}
          </a>
        ))}
      </nav>
    </footer>
  );
}
