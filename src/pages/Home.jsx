import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings, useUserPrefs, applyAccent } from '../hooks/useDatabase';

// ─── LOGO ────────────────────────────────────────────────────────────────────
function LogoIcon({ logoUrl, size=32, radius=9 }) {
  return (
    <div className={`logo-icon ${logoUrl?'':'logo-icon-bg'}`} style={{ width:size, height:size, borderRadius:radius }}>
      {logoUrl ? <img src={logoUrl} alt="Logo" style={{ borderRadius:radius }} /> : <span className="logo-icon-ph" style={{ fontSize:size*.38+'px' }}>E</span>}
    </div>
  );
}

// ─── HOME PAGE ───────────────────────────────────────────────────────────────
function HomePage2({ onNav, settings }) {
  return (
    <div className="home">
      <div className="home-grid-bg"/>
      <div className="home-mesh"/>
      <nav className="home-nav">
        <div style={{display:'flex',alignItems:'center',gap:9}}>
          <LogoIcon logoUrl={settings.logo_url} size={34} radius={9} />
          <div>
            <div style={{fontWeight:700,fontSize:'.88rem'}}>{settings.org_name||'EDS UNIMA'}</div>
            <div style={{fontSize:'.58rem',color:'var(--text3)',textTransform:'uppercase',letterSpacing:'.07em'}}>{settings.org_tagline||'Member Database'}</div>
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={()=>onNav('admin')}>Admin Login</button>
      </nav>
      <div className="home-body">
        <div className="home-emblem">
          {settings.logo_url ? <img src={settings.logo_url} alt="Logo" /> : <span className="home-emblem-ph">EDS</span>}
        </div>
        <div className="home-eyebrow">English Debating Society</div>
        <h1 className="home-title">UNIMA <span>Debate</span><br/>Database</h1>
        <p className="home-desc">Central hub for EDS UNIMA member records, competition history, and organizational data.</p>

        {/* Main navigation cards */}
        <div className="home-cards" style={{marginBottom:14}}>
          {[
            {key:'debaters',icon:'🎤',title:'Debaters',desc:'Rankings, divisions, and performance stats'},
            {key:'competitions',icon:'🏆',title:'Competitions',desc:'Competition records, dates, and participants'},
            {key:'membership',icon:'📋',title:'Membership',desc:'Full directory with roles and contacts'},
          ].map(c=>(
            <div key={c.key} className="home-card" onClick={()=>onNav(c.key)}>
              <div className="home-card-icon">{c.icon}</div>
              <div className="home-card-title">{c.title}</div>
              <div className="home-card-desc">{c.desc}</div>
            </div>
          ))}
        </div>

        {/* Secondary nav cards */}
        <div style={{
          display:'grid',
          gridTemplateColumns:`repeat(${settings.show_stats_on_public !== false ? 6 : 5}, 1fr)`,
          gap:10,
          maxWidth:700,
          width:'100%',
          marginBottom:20
        }}>
          {[
            settings.show_stats_on_public !== false && {key:'stats',icon:'📊',title:'Stats'},
            {key:'boards',icon:'🏛️',title:'Board'},
            {key:'materials',icon:'📚',title:'Study'},
            {key:'motions',icon:'📜',title:'Motions'},
            {key:'hof',icon:'🌟',title:'Hall of Fame'},
            {key:'info',icon:'ℹ️',title:'Info'},
          ].filter(Boolean).map(c=>(
            <div key={c.key} className="home-tool-card" onClick={()=>onNav(c.key)} style={{cursor:'pointer'}}>
              <div className="home-tool-icon">{c.icon}</div>
              <div className="home-tool-title">{c.title}</div>
            </div>
          ))}
        </div>

        {/* Debate Tools */}
        <div style={{width:'100%',maxWidth:700}}>
          <div style={{fontSize:'.6rem',fontWeight:600,letterSpacing:'.12em',textTransform:'uppercase',color:'var(--text3)',marginBottom:9,textAlign:'center'}}>Debate Tools</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:10}}>
            <a className="home-tool-card" href="https://maymooniu.github.io/debatetimekeeper/" target="_blank" rel="noreferrer">
              <div className="home-tool-icon">⏱️</div>
              <div className="home-tool-title">Advanced BP Debate Timer</div>
              <div className="home-tool-desc">Full-featured timer for British Parliamentary rounds</div>
            </a>
            <a className="home-tool-card" href="https://maymooniu.github.io/adjudebatenotetaking/" target="_blank" rel="noreferrer">
              <div className="home-tool-icon">📝</div>
              <div className="home-tool-title">Adjudicator Note-taking</div>
              <div className="home-tool-desc">Structured note-taking assistant for adjudicators</div>
            </a>
          </div>
        </div>
      </div>
      <div className="home-footer">{settings.footer_text || 'English Debating Society · Universitas Negeri Manado'} · A Project by Christian Tendean</div>
    </div>
  );
}

// ─── HOME APP ────────────────────────────────────────────────────────────────
export default function Home() {
  const { settings } = useSettings();
  const { prefs } = useUserPrefs();
  const navigate = useNavigate();

  // Apply user preferences globally when they change
  useEffect(() => {
    if (prefs.theme === 'light') document.documentElement.setAttribute('data-theme', 'light');
    else document.documentElement.removeAttribute('data-theme');
  }, [prefs.theme]);

  useEffect(() => {
    document.body.setAttribute('data-compact', prefs.compact_tables ? 'true' : 'false');
  }, [prefs.compact_tables]);

  useEffect(() => {
    if (prefs.accent_color) applyAccent(prefs.accent_color);
  }, [prefs.accent_color]);

  useEffect(() => {
    document.body.setAttribute('data-show-rank-icons', prefs.show_rank_icons !== false ? 'true' : 'false');
  }, [prefs.show_rank_icons]);

  const navTo = key => {
    if (key === 'admin') {
      navigate('/admin');
    } else {
      navigate('/portal?tab=' + key);
    }
  };

  if (settings.maintenance_mode) {
    return (
      <div className="loading-pg">
        <div style={{fontSize:'2rem',marginBottom:10}}>🔧</div>
        <p style={{fontSize:'.95rem',color:'var(--text)',fontWeight:600}}>Under Maintenance</p>
        <p>The database is currently undergoing maintenance.</p>
        <button className="btn btn-ghost btn-sm" style={{marginTop:12}} onClick={()=>navigate('/admin')}>Admin Access</button>
      </div>
    );
  }

  return <HomePage2 onNav={navTo} settings={settings} />;
}
