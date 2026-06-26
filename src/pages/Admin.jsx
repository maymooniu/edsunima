import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import supabase from '../supabaseClient';
import {
  useMembers,
  useCompetitions,
  useSettings,
  useBoards,
  useHof,
  useStudyMaterials,
  useMotions,
  useInfoSettings,
  useUserPrefs,
  useDragReorder,
  exportDebaters,
  exportMembership,
  exportCompetitions,
  exportAll,
  applyAccent
} from '../hooks/useDatabase';
import * as XLSX from 'xlsx';




// ─── IMAGE COMPRESSION HELPER ───────────────────────────────────────────────
function compressImage(file, maxDim, callback) {
  const reader = new FileReader();
  reader.onload = ev => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let w = img.width;
      let h = img.height;
      if (w > maxDim || h > maxDim) {
        if (w > h) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
      callback(compressedDataUrl);
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

// ─── TOAST ───────────────────────────────────────────────────────────────────
function Toast({ msg, type, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }, []);
  return <div className={`toast ${type==='success'?'ok':'err'}`}>{type==='success'?'✓':'✕'} {msg}</div>;
}
function useToast() {
  const [t, setT] = useState(null);
  const show = (msg, type='success') => setT({ msg, type, k: Date.now() });
  const el = t && <Toast key={t.k} msg={t.msg} type={t.type} onDone={()=>setT(null)} />;
  return [show, el];
}

// ─── LOGO ────────────────────────────────────────────────────────────────────
function LogoIcon({ logoUrl, size=32, radius=9 }) {
  return (
    <div className={`logo-icon ${logoUrl?'':'logo-icon-bg'}`} style={{ width:size, height:size, borderRadius:radius }}>
      {logoUrl ? <img src={logoUrl} alt="Logo" style={{ borderRadius:radius }} /> : <span className="logo-icon-ph" style={{ fontSize:size*.38+'px' }}>E</span>}
    </div>
  );
}

// ─── TOGGLE ──────────────────────────────────────────────────────────────────
function Toggle({ checked, onChange }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={!!checked} onChange={e=>onChange(e.target.checked)} />
      <div className="toggle-track" />
      <div className="toggle-thumb" />
    </label>
  );
}

// ─── FIXED TAGS FOR MOTIONS ──────────────────────────────────────────────────
const PRIMARY_TAGS = [
  'Africa', 'Art', 'Asia', 'Children', 'Cities', 'Criminal Justice', 'Culture', 'Development',
  'Economics', 'Education/Academia', 'Environment', 'Europe', 'Feminism', 'International Relations',
  'Latin America', 'Law', 'LGBTQ+', 'Media', 'Medical', 'Middle East', 'Military', 'Minority Communities',
  'Philosophy', 'Politics', 'Religion', 'Romance/Sexuality', 'Science/Technology', 'Social Justice', 'Sports'
];

const SECONDARY_TAGS = [
  'Aging/Elderly Care', 'Animal Rights', 'Artificial Intelligence', 'Bioethics', 'Censorship', 'Charity',
  'China/Taiwan', 'Civil Disobedience', 'Civil Liberties', 'Climate Change', 'Colonialism', 'Corporate Regulation',
  'Cryptocurrency', 'Cybersecurity', 'Democracy', 'Disability Rights', 'Disinformation', 'Drugs',
  'Energy', 'Family/Parenting', 'Foreign Policy', 'Free Speech', 'Funny', 'Genetic Engineering',
  'Globalization', 'Gun Control', 'Healthcare', 'Historical Memory', 'Housing', 'Human Rights',
  'Immigration', 'India/Pakistan', 'Indigenous Peoples', 'Intellectual Property', 'Israel/Palestine',
  'Journalism', 'Labor', 'Medicine', 'Mental Health', 'Nationalism', 'Pacifism', 'Police', 'Populism',
  'Poverty', 'Privacy', 'Private Property', 'Protest Movements', 'Refugees & Asylum', 'Reparations',
  'Reproductive Rights', 'Sanctions', 'Social Media', 'Surveillance', 'Taxation', 'Terrorism', 'Tourism',
  'Trade', 'Ukraine/Russia', 'Universal Basic Income', 'Whistleblowing'
];

function TagPicker({ value, onChange }) {
  const selected = useMemo(() => {
    return value ? value.split(',').map(t => t.trim()).filter(Boolean) : [];
  }, [value]);

  const [isOpen, setIsOpen] = useState(false);

  const toggleTag = (tag) => {
    let next;
    if (selected.includes(tag)) {
      next = selected.filter(t => t !== tag);
    } else {
      next = [...selected, tag];
    }
    onChange(next.join(', '));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, minHeight: 34, padding: '6px 10px', border: '1px solid var(--border2)', borderRadius: 'var(--r)', background: 'var(--surface2)', alignItems: 'center' }}>
        {selected.length === 0 ? (
          <span style={{ fontSize: '.76rem', color: 'var(--text3)', fontStyle: 'italic', paddingLeft: 4 }}>No tags selected</span>
        ) : (
          selected.map(tag => (
            <span key={tag} className="badge b-blue" style={{ fontSize: '.72rem', display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px' }}>
              {tag}
              <button 
                type="button" 
                onClick={() => toggleTag(tag)}
                style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, fontSize: '.8rem', display: 'inline-flex', alignItems: 'center' }}
              >
                ×
              </button>
            </span>
          ))
        )}
      </div>

      <div>
        <button
          type="button"
          className="btn btn-ghost btn-xs"
          onClick={() => setIsOpen(!isOpen)}
          style={{ fontSize: '.72rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}
        >
          {isOpen ? '▲ Hide Tag List' : '▼ Show/Edit Available Tags'}
        </button>
      </div>

      {isOpen && (
        <div style={{
          border: '1px solid var(--border)',
          borderRadius: 'var(--r)',
          background: 'var(--surface)',
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          maxHeight: 250,
          overflowY: 'auto'
        }}>
          <div>
            <div style={{ fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text3)', marginBottom: 6 }}>Primary Types</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {PRIMARY_TAGS.map(tag => {
                const active = selected.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 14,
                      border: '1px solid ' + (active ? 'var(--accent)' : 'var(--border2)'),
                      background: active ? 'rgba(91,130,246,.15)' : 'var(--surface2)',
                      color: active ? 'var(--accent)' : 'var(--text2)',
                      fontSize: '.72rem',
                      fontWeight: active ? 700 : 500,
                      cursor: 'pointer',
                      transition: 'all .1s'
                    }}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text3)', marginBottom: 6 }}>Secondary Types</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {SECONDARY_TAGS.map(tag => {
                const active = selected.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 14,
                      border: '1px solid ' + (active ? 'var(--accent2)' : 'var(--border2)'),
                      background: active ? 'rgba(192,132,252,.15)' : 'var(--surface2)',
                      color: active ? 'var(--accent2)' : 'var(--text2)',
                      fontSize: '.72rem',
                      fontWeight: active ? 700 : 500,
                      cursor: 'pointer',
                      transition: 'all .1s'
                    }}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MODAL ───────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children, wide, sm }) {
  useEffect(() => {
    const fn = e => { if (e.key==='Escape') onClose(); };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, []);
  return (
    <div className="overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className={`modal ${wide?'modal-wide':''} ${sm?'modal-sm':''}`}>
        <div className="m-title">
          <span>{title}</span>
          <button className="m-close" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── BADGES ──────────────────────────────────────────────────────────────────
function RankBadge({ rank }) {
  if (rank==='Ace') return <span className="r-ace"><span className="r-icon">✦</span> Ace</span>;
  if (rank==='Troop') return <span className="r-troop"><span className="r-icon">◆</span> Troop</span>;
  return <span className="r-trainee">Trainee</span>;
}
function DivBadge({ div }) {
  if (div==='English') return <span className="badge b-eng">EN</span>;
  if (div==='Indonesia') return <span className="badge b-ind">ID</span>;
  return <span className="badge b-flex">Flex</span>;
}
function StatusBadge({ s }) {
  return <span className={`badge ${s==='Active'?'b-green':'b-red'}`}>{s}</span>;
}
function ClassBadges({ classes=[] }) {
  const map = { Advisor:'b-gold', Board:'b-blue', General:'b-gray', Alumni:'b-purple', Ex:'b-ex' };
  return <>{classes.map(c=><span key={c} className={`badge ${map[c]||'b-gray'}`} style={{marginRight:3,marginBottom:2}}>{c}</span>)}</>;
}
function FormatBadge({ f }) {
  return <span className={`badge ${f==='BP'?'b-navy':'b-purple'}`}>{f}</span>;
}

// ─── ADMIN LOGIN ──────────────────────────────────────────────────────────────
function AdminLogin({ settings }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email.trim() || !pass.trim()) {
      setErr('Email and password required.');
      return;
    }
    setLoading(true);
    setErr('');
    const { error } = await supabase.auth.signInWithPassword({
      email: email,
      password: pass,
    });
    setLoading(false);
    if (error) {
      setErr(error.message);
      setPass('');
    }
  };

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div style={{display:'flex',justifyContent:'center',marginBottom:18}}>
          {settings.logo_url
            ? <div style={{width:64,height:64,borderRadius:14,overflow:'hidden'}}><img src={settings.logo_url} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="Logo" /></div>
            : <div style={{width:56,height:56,borderRadius:14,background:'linear-gradient(135deg,var(--accent),var(--accent2))',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Playfair Display,serif',fontSize:'1.4rem',color:'#fff',fontWeight:700}}>E</div>
          }
        </div>
        <h2 style={{fontFamily:'Playfair Display,serif',marginBottom:5,fontSize:'1.25rem'}}>Admin Access</h2>
        <p style={{color:'var(--text3)',fontSize:'.8rem',marginBottom:22}}>EDS UNIMA Database Administration</p>
        
        <div className="fg" style={{marginBottom:14,textAlign:'left'}}>
          <label>Email Address</label>
          <input type="email" placeholder="admin@edsunima.org" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submit()} />
        </div>
        
        <div className="fg" style={{marginBottom:14,textAlign:'left'}}>
          <label>Password</label>
          <input type="password" placeholder="Enter password" value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submit()} />
        </div>
        
        {err && <p style={{color:'var(--red)',fontSize:'.77rem',marginBottom:10}}>{err}</p>}
        
        <div style={{display:'flex',gap:6}}>
          <button className="btn btn-ghost" style={{flex:1,justifyContent:'center'}} onClick={()=>navigate('/')}>← Cancel</button>
          <button className="btn btn-primary" style={{flex:2,justifyContent:'center'}} onClick={submit} disabled={loading}>
            {loading ? 'Logging in...' : 'Login →'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MEMBER FORM ──────────────────────────────────────────────────────────────
const MEMBER_DEF = { full_name:'', nim:'', course:'', division:'English', rank:'Trainee', classes:['General'], membership_status:'Member', active_status:'Active', email:'', whatsapp:'', total_competitions:0, total_rounds:0, total_breaking:0, top_round:'' };
const CLASS_OPTS = ['Advisor','Board','General','Alumni','Ex'];
const MEM_ROLES = ['President','Vice President','Secretary','Treasurer','Training Director','Training Officer','People Director','People Officer','MedCom Director','MedCom Officer','Member'];
const TOP_ROUNDS = ['','Preliminary','Octofinals','Pre-Semifinal Newbie','Semifinal Newbie','Grandfinal Newbie','Pre-Semifinal Pratama','Semifinal Pratama','Grandfinal Pratama','National Break','Quarterfinal','Semifinal','Finals','Grandfinal','Grandfinal Varsity','Grandfinal Judge'];

function MemberForm({ member, onSave, onClose }) {
  const [f, setF] = useState(member ? {...MEMBER_DEF,...member} : {...MEMBER_DEF});
  const set = (k,v) => setF(p=>({...p,[k]:v}));
  const toggleClass = c => { const cur=f.classes||[]; set('classes',cur.includes(c)?cur.filter(x=>x!==c):[...cur,c]); };
  const save = () => {
    if (!f.full_name?.trim()) return alert('Full name required.');
    onSave({...f,nim:f.nim?.trim()||null,total_competitions:+f.total_competitions||0,total_rounds:+f.total_rounds||0,total_breaking:+f.total_breaking||0,top_round:f.top_round||null});
  };
  return (
    <Modal title={member?'Edit Member':'Add New Member'} onClose={onClose} wide>
      <div className="g2">
        <div className="fg span2"><label>Full Name *</label><input value={f.full_name} onChange={e=>set('full_name',e.target.value)} placeholder="Full name" /></div>
        <div className="fg"><label>NIM</label><input value={f.nim||''} onChange={e=>set('nim',e.target.value)} placeholder="220211001" /></div>
        <div className="fg"><label>Course / Major</label><input value={f.course||''} onChange={e=>set('course',e.target.value)} placeholder="English Education" /></div>
        <div className="fg"><label>Division *</label><select value={f.division} onChange={e=>set('division',e.target.value)}>{['English','Indonesia','Flex'].map(o=><option key={o}>{o}</option>)}</select></div>
        <div className="fg"><label>Rank *</label><select value={f.rank} onChange={e=>set('rank',e.target.value)}>{['Ace','Troop','Trainee'].map(o=><option key={o}>{o}</option>)}</select></div>
        <div className="fg span2"><label>Class *</label><div className="class-chips">{CLASS_OPTS.map(c=><div key={c} className={`class-chip ${(f.classes||[]).includes(c)?'on':''}`} onClick={()=>toggleClass(c)}>{c}</div>)}</div></div>
        <div className="fg"><label>Membership Role</label><select value={f.membership_status} onChange={e=>set('membership_status',e.target.value)}>{MEM_ROLES.map(o=><option key={o}>{o}</option>)}</select></div>
        <div className="fg"><label>Active Status *</label><select value={f.active_status} onChange={e=>set('active_status',e.target.value)}><option>Active</option><option>Inactive</option></select></div>
        <div className="fg"><label>Email</label><input type="email" value={f.email||''} onChange={e=>set('email',e.target.value)} placeholder="name@student.unima.ac.id" /></div>
        <div className="fg"><label>WhatsApp</label><input value={f.whatsapp||''} onChange={e=>set('whatsapp',e.target.value)} placeholder="08xxxxxxxxxx" /></div>
        <div style={{gridColumn:'1/-1',borderTop:'1px solid var(--border)',paddingTop:12,marginTop:2}}>
          <div style={{fontSize:'.68rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'.06em',color:'var(--text3)',marginBottom:10}}>Debate Statistics</div>
          <div className="g3">
            <div className="fg"><label>Competitions</label><input type="number" min="0" value={f.total_competitions} onChange={e=>set('total_competitions',e.target.value)} /></div>
            <div className="fg"><label>Rounds</label><input type="number" min="0" value={f.total_rounds} onChange={e=>set('total_rounds',e.target.value)} /></div>
            <div className="fg"><label>Breaking</label><input type="number" min="0" value={f.total_breaking} onChange={e=>set('total_breaking',e.target.value)} /></div>
            <div className="fg span2"><label>Top Round</label><select value={f.top_round||''} onChange={e=>set('top_round',e.target.value)}>{TOP_ROUNDS.map(o=><option key={o} value={o}>{o||'— None —'}</option>)}</select></div>
          </div>
        </div>
      </div>
      <div className="m-footer"><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={save}>{member?'Save':'Add Member'}</button></div>
    </Modal>
  );
}

// ─── COMP FORM ────────────────────────────────────────────────────────────────
const COMP_DEF = { comp_date:'', code:'', competition:'', organizer:'', format:'BP', type:'Open', level:'National', results:[], setting:'In-Person', tabulation:'', participants:[] };

function CompForm({ comp, members, onSave, onClose }) {
  const [f, setF] = useState(comp ? {...COMP_DEF,...comp,participants:(comp.participants||[]).map(p=>({...p}))} : {...COMP_DEF});
  const [newResult, setNewResult] = useState('');
  const [partSearch, setPartSearch] = useState('');
  const [partTab, setPartTab] = useState('all');
  const set = (k,v) => setF(p=>({...p,[k]:v}));

  const addResult = () => { if (!newResult.trim()) return; set('results',[...(f.results||[]),newResult.trim()]); setNewResult(''); };
  const removeResult = i => set('results',f.results.filter((_,j)=>j!==i));

  const getParticipant = id => f.participants?.find(p=>p.memberId===id)||null;
  const togglePart = (id, role) => {
    const cur = f.participants||[];
    const ex = cur.find(p=>p.memberId===id);
    if (ex) {
      if (ex.role===role) set('participants',cur.filter(p=>p.memberId!==id));
      else set('participants',cur.map(p=>p.memberId===id?{...p,role}:p));
    } else {
      set('participants',[...cur,{memberId:id,role,result:''}]);
    }
  };

  const filteredMembersForPicker = useMemo(() => {
    const s = partSearch.toLowerCase();
    return members.filter(m => {
      if (s && !m.full_name?.toLowerCase().includes(s)) return false;
      if (partTab === 'all') return true;
      const p = getParticipant(m.id);
      return p?.role === partTab;
    });
  }, [members, partSearch, partTab, f.participants]);

  const setResult = (id, result) => {
    set('participants',f.participants.map(p=>p.memberId===id?{...p,result}:p));
  };

  const selectedParticipants = (f.participants||[]).map(p=>({...p,member:members.find(m=>m.id===p.memberId)})).filter(p=>p.member);
  const adjus = selectedParticipants.filter(p=>p.role==='Adjudicator');
  const debs = selectedParticipants.filter(p=>p.role==='Debater');

  const save = () => { if (!f.code?.trim()||!f.competition?.trim()) return alert('Code and name required.'); onSave(f); };

  return (
    <Modal title={comp?'Edit Competition':'Add Competition'} onClose={onClose} wide>
      <div className="g2">
        <div className="fg"><label>Short Code *</label><input value={f.code} onChange={e=>set('code',e.target.value)} placeholder="NUDC 2024" /></div>
        <div className="fg"><label>Date</label><input value={f.comp_date||''} onChange={e=>set('comp_date',e.target.value)} placeholder="14-15 Mar 2026" /></div>
        <div className="fg span2"><label>Full Competition Name *</label><input value={f.competition} onChange={e=>set('competition',e.target.value)} placeholder="National Universities Debating Championship 2024" /></div>
        <div className="fg"><label>Organizer</label><input value={f.organizer||''} onChange={e=>set('organizer',e.target.value)} placeholder="Dikti" /></div>
        <div className="fg"><label>Format</label><select value={f.format} onChange={e=>set('format',e.target.value)}><option>BP</option><option>AP</option></select></div>
        <div className="fg"><label>Type</label><select value={f.type} onChange={e=>set('type',e.target.value)}>{['Open','Varsity','School','ProAms'].map(o=><option key={o}>{o}</option>)}</select></div>
        <div className="fg"><label>Level</label><select value={f.level} onChange={e=>set('level',e.target.value)}>{['International','National','Regional','Provincial','University'].map(o=><option key={o}>{o}</option>)}</select></div>
        <div className="fg"><label>Setting</label><select value={f.setting} onChange={e=>set('setting',e.target.value)}>{['In-Person','Online','Hybrid'].map(o=><option key={o}>{o}</option>)}</select></div>
        <div className="fg"><label>Tabulation Link</label><input value={f.tabulation||''} onChange={e=>set('tabulation',e.target.value)} placeholder="https://tabbycat.link/…" /></div>
        <div className="fg span2">
          <label>Overall Competition Results</label>
          <div style={{display:'flex',gap:7,marginBottom:8}}>
            <input value={newResult} onChange={setNewResult} placeholder="e.g. Break Grandfinal, 3rd Speaker…" onKeyDown={e=>e.key==='Enter'&&addResult()} style={{flex:1,padding:'8px 11px',border:'1px solid var(--border2)',borderRadius:'var(--r)',fontSize:'.84rem',background:'var(--surface2)',color:'var(--text)',outline:'none'}} />
            <button className="btn btn-ghost btn-sm" onClick={addResult}>+ Add</button>
          </div>
          <div className="result-tags">{(f.results||[]).map((r,i)=><span key={i} className="result-tag">{r}<button onClick={()=>removeResult(i)}>×</button></span>)}</div>
        </div>
      </div>

      <div style={{marginTop:16}}>
        <div style={{fontSize:'.68rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'.06em',color:'var(--text3)',marginBottom:8}}>
          Participants {(f.participants||[]).length>0 && <span style={{color:'var(--accent)'}}>( {(f.participants||[]).length} selected)</span>}
        </div>
        {selectedParticipants.length > 0 && (
          <div className="part-selected-chips">
            {adjus.map(p=><span key={p.memberId} className="part-chip adj">{p.member.full_name}<button className="part-chip-x" onClick={()=>togglePart(p.memberId,'Adjudicator')}>×</button></span>)}
            {debs.map(p=><span key={p.memberId} className="part-chip deb">{p.member.full_name}<button className="part-chip-x" onClick={()=>togglePart(p.memberId,'Debater')}>×</button></span>)}
          </div>
        )}
        <div className="part-tabs">
          {[['all',`All (${members.length})`],['Debater',`Debaters (${debs.length})`],['Adjudicator',`Adjudicators (${adjus.length})`]].map(([v,l])=>(
            <button key={v} className={`part-tab ${partTab===v?'on':''}`} onClick={()=>setPartTab(v)}>{l}</button>
          ))}
        </div>
        <div className="part-search-wrap">
          <span className="part-search-ico">⌕</span>
          <input placeholder="Search member name…" value={partSearch} onChange={e=>setPartSearch(e.target.value)} />
        </div>
        <div className="part-list-box">
          {filteredMembersForPicker.length===0
            ? <div style={{padding:14,textAlign:'center',color:'var(--text3)',fontSize:'.8rem'}}>No members found</div>
            : filteredMembersForPicker.map(m=>{
              const p=getParticipant(m.id);
              return (
                <div key={m.id} className={`part-list-item ${p?'sel':''}`}>
                  <div style={{flex:1,minWidth:0}}>
                    <div className="part-list-name">{m.full_name}</div>
                    <div className="part-list-meta">{m.division} · <span style={{color:m.rank==='Ace'?'var(--gold)':m.rank==='Troop'?'var(--blue)':'var(--text3)'}}>{m.rank}</span></div>
                  </div>
                  <div className="part-list-roles">
                    {['Debater','Adjudicator'].map(r=>(
                      <button key={r} className={`role-btn ${p?.role===r?'on':''}`} onClick={()=>togglePart(m.id,r)}>{r==='Debater'?'Deb':'Adj'}</button>
                    ))}
                  </div>
                </div>
              );
            })
          }
        </div>
      </div>

      {selectedParticipants.length > 0 && (
        <div style={{marginTop:16}}>
          <div style={{fontSize:'.68rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'.06em',color:'var(--text3)',marginBottom:8}}>Individual Results (optional)</div>
          <div className="per-person-result-wrap">
            {adjus.length > 0 && <div style={{fontSize:'.66rem',color:'var(--purple)',fontWeight:600,marginBottom:4}}>Adjudicators</div>}
            {adjus.map(p=>(
              <div key={p.memberId} className="ppr-row">
                <span className="ppr-name">{p.member.full_name}</span>
                <span className="ppr-role adjudicator">Adj</span>
                <input className="ppr-input" value={p.result||''} onChange={e=>setResult(p.memberId,e.target.value)} placeholder="e.g. Break Judge" />
              </div>
            ))}
            {debs.length > 0 && <div style={{fontSize:'.66rem',color:'var(--blue)',fontWeight:600,marginBottom:4,marginTop:4}}>Debaters</div>}
            {debs.map(p=>(
              <div key={p.memberId} className="ppr-row">
                <span className="ppr-name">{p.member.full_name}</span>
                <span className="ppr-role debater">Deb</span>
                <input className="ppr-input" value={p.result||''} onChange={e=>setResult(p.memberId,e.target.value)} placeholder="e.g. Grandfinal, 2nd Speaker" />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="m-footer"><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={save}>{comp?'Save Changes':'Add Competition'}</button></div>
    </Modal>
  );
}

// ─── ADMIN MEMBERS ────────────────────────────────────────────────────────────
function AdminMembers({ members, refetch, toast }) {
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editM, setEditM] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [activeOrder, setActiveOrder] = useState('debaters');
  const [debOrder, setDebOrder] = useState([]);
  const [memOrder, setMemOrder] = useState([]);

  useEffect(() => {
    if (members.length > 0) {
      if (debOrder.length === 0) {
        const sorted = [...members].sort((a,b)=>(a.order_debaters||9999)-(b.order_debaters||9999));
        setDebOrder(sorted.map(m=>m.id));
      }
      if (memOrder.length === 0) {
        const sorted = [...members]
          .filter(m=>!m.classes?.includes('Alumni')&&!m.classes?.includes('Ex'))
          .sort((a,b)=>(a.order_membership||9999)-(b.order_membership||9999));
        setMemOrder(sorted.map(m=>m.id));
      }
    }
  }, [members]);

  const orderedMembers = useMemo(() => {
    if (activeOrder === 'debaters') {
      const byId = Object.fromEntries(members.map(m=>[m.id,m]));
      const sorted = debOrder.map(id=>byId[id]).filter(Boolean);
      const extras = members.filter(m=>!debOrder.includes(m.id));
      return [...sorted, ...extras];
    } else {
      const eligible = members.filter(m=>!m.classes?.includes('Alumni')&&!m.classes?.includes('Ex'));
      const byId = Object.fromEntries(eligible.map(m=>[m.id,m]));
      const sorted = memOrder.map(id=>byId[id]).filter(Boolean);
      const extras = eligible.filter(m=>!memOrder.includes(m.id));
      return [...sorted, ...extras];
    }
  }, [members,debOrder,memOrder,activeOrder]);

  const filtered = useMemo(()=>{
    const s=search.toLowerCase();
    return orderedMembers.filter(m=>!s||m.full_name?.toLowerCase().includes(s)||m.nim?.includes(s));
  },[orderedMembers,search]);

  const saveOrder = async arr => {
    const field = activeOrder==='debaters'?'order_debaters':'order_membership';
    const ids = arr.map(m=>m.id);
    if (activeOrder === 'debaters') setDebOrder(ids);
    else setMemOrder(ids);
    for (let i=0;i<arr.length;i++) await sb.from('members').update({[field]:i+1}).eq('id',arr[i].id);
    toast('Order saved');
  };

  const { onDragStart, onDragOver, onDrop, onDragEnd, isDragOver } = useDragReorder(
    filtered,
    arr => {
      const ids = arr.map(m=>m.id);
      if (activeOrder === 'debaters') setDebOrder(ids);
      else setMemOrder(ids);
    },
    saveOrder
  );

  const addOrUpdate = async form => {
    if (editM) {
      const { id, created_at, ...rest } = form;
      const { error } = await sb.from('members').update(rest).eq('id',editM.id);
      if (error) toast(error.message,'error'); else { toast('Member updated'); await refetch(); }
    } else {
      const { error } = await sb.from('members').insert(form);
      if (error) toast(error.message,'error'); else { toast('Member added'); await refetch(); }
    }
    setShowForm(false); setEditM(null);
  };

  const del = async id => {
    await sb.from('members').delete().eq('id',id);
    toast('Deleted'); await refetch(); setConfirm(null);
  };

  return (
    <div className="admin-content">
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16,flexWrap:'wrap',gap:10}}>
        <div>
          <h2 style={{fontFamily:'Playfair Display,serif',fontSize:'1.25rem',marginBottom:2}}>Manage Members</h2>
          <p style={{color:'var(--text3)',fontSize:'.78rem'}}>{members.length} total · drag ⠿ to reorder</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={()=>{setEditM(null);setShowForm(true);}}>+ Add Member</button>
      </div>
      <div className="toolbar" style={{marginBottom:10}}>
        <div className="search-wrap"><span className="search-ico">⌕</span><input placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)} /></div>
        <div style={{display:'flex',gap:5,alignItems:'center'}}>
          <span style={{fontSize:'.72rem',color:'var(--text3)',fontWeight:600}}>Order for:</span>
          {['debaters','membership'].map(o=>(
            <button key={o} className={`btn btn-sm ${activeOrder===o?'btn-primary':'btn-outline'}`} onClick={()=>setActiveOrder(o)} style={{textTransform:'capitalize'}}>{o}</button>
          ))}
        </div>
      </div>
      <div className="card">
        <div className="tbl-wrap">
          <table>
            <thead><tr><th style={{width:24}}></th><th>#</th><th>Name</th><th>NIM</th><th>Div</th><th>Rank</th><th>Class</th>{activeOrder==='membership'&&<th>Role</th>}<th>Status</th><th>Comps</th><th>Rds</th><th>Brks</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.map((m,i)=>(
                <tr key={m.id} className={`drag-row ${isDragOver(i)?'drag-over':''}`} draggable onDragStart={e=>onDragStart(e,i)} onDragOver={e=>onDragOver(e,i)} onDrop={e=>onDrop(e,i)} onDragEnd={onDragEnd}>
                  <td><span className="drag-handle">⠿</span></td>
                  <td style={{color:'var(--text3)',fontWeight:600,fontSize:'.72rem'}}>{i+1}</td>
                  <td style={{fontWeight:600,whiteSpace:'nowrap'}}>{m.full_name}</td>
                  <td style={{fontFamily:'monospace',fontSize:'.72rem',color:'var(--text3)'}}>{m.nim||'—'}</td>
                  <td><DivBadge div={m.division}/></td>
                  <td><RankBadge rank={m.rank}/></td>
                  <td><ClassBadges classes={m.classes}/></td>
                  {activeOrder==='membership'&&<td><span className={`badge ${m.membership_status==='President'||m.membership_status==='Vice President'?'b-navy':m.membership_status==='Secretary'||m.membership_status==='Treasurer'?'b-gold':m.membership_status?.includes('Director')?'b-blue':m.membership_status?.includes('Officer')?'b-purple':'b-gray'}`} style={{fontSize:'.65rem'}}>{m.membership_status||'Member'}</span></td>}
                  <td><StatusBadge s={m.active_status}/></td>
                  <td style={{textAlign:'center',fontWeight:700,color:'var(--accent)'}}>{m.total_competitions||0}</td>
                  <td style={{textAlign:'center',fontWeight:600}}>{m.total_rounds||0}</td>
                  <td style={{textAlign:'center',fontWeight:600,color:m.total_breaking>0?'var(--gold)':'var(--text3)'}}>{m.total_breaking||0}</td>
                  <td><div style={{display:'flex',gap:4}}><button className="btn btn-outline btn-xs" onClick={()=>{setEditM(m);setShowForm(true);}}>Edit</button><button className="btn btn-danger btn-xs" onClick={()=>setConfirm(m.id)}>Del</button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {showForm && <MemberForm member={editM} onSave={addOrUpdate} onClose={()=>{setShowForm(false);setEditM(null);}} />}
      {confirm && <Modal title="Delete Member?" onClose={()=>setConfirm(null)} sm><p style={{color:'var(--text3)'}}>This permanently deletes the member. Cannot be undone.</p><div className="m-footer"><button className="btn btn-ghost" onClick={()=>setConfirm(null)}>Cancel</button><button className="btn btn-danger" onClick={()=>del(confirm)}>Delete</button></div></Modal>}
    </div>
  );
}

// ─── ADMIN COMPETITIONS MOTIONS MODAL ──────────────────────────────────────────
function AdminCompMotionsModal({ comp, settings, saveSetting, toast, onClose, refetchMotions }) {
  const compId = comp.id;
  const [motions, setMotions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    sb.from('motions')
      .select('*')
      .eq('competition_id', compId)
      .order('id', { ascending: true })
      .then(({ data, error }) => {
        if (error) toast(error.message, 'error');
        else setMotions(data || []);
        setLoading(false);
      });
  }, [compId]);

  const addRound = () => {
    const roundNumber = motions.length + 1;
    setMotions([...motions, { round: `Round ${roundNumber}`, motion: '', infoslide: '', tags: '' }]);
  };

  const removeRound = (index) => {
    setMotions(motions.filter((_, i) => i !== index));
  };

  const updateRound = (index, key, val) => {
    setMotions(motions.map((m, i) => i === index ? { ...m, [key]: val } : m));
  };

  const save = async () => {
    const invalid = motions.some(m => !m.round.trim() || !m.motion.trim());
    if (invalid) {
      if (!window.confirm('Some rounds have empty names or motion text. Are you sure you want to save?')) {
        return;
      }
    }

    try {
      // 1. Delete all existing motions for this competition
      const { error: delErr } = await sb.from('motions').delete().eq('competition_id', compId);
      if (delErr) throw delErr;

      // 2. Insert new list
      if (motions.length > 0) {
        const payload = motions.map(m => ({
          competition_id: compId,
          round: m.round.trim(),
          motion: m.motion.trim(),
          infoslide: m.infoslide?.trim() || '',
          tags: m.tags ? m.tags.split(',').map(t => t.trim()).filter(Boolean).join(', ') : ''
        })).filter(m => m.round || m.motion);
        
        if (payload.length > 0) {
          const { error: insErr } = await sb.from('motions').insert(payload);
          if (insErr) throw insErr;
        }
      }

      toast('Motions saved successfully');
      if (refetchMotions) await refetchMotions();
      onClose();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <Modal title={`Motions: ${comp.code}`} onClose={onClose} wide>
      <div style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: 10, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 24, color: 'var(--text3)' }}>Loading motions...</div>
        ) : motions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text3)', fontSize: '.84rem' }}>
            No rounds defined for this competition. Click "+ Add Round" to create one.
          </div>
        ) : (
          motions.map((m, idx) => (
            <div key={idx} style={{
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r)',
              padding: 12,
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              gap: 8
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: '.84rem', color: 'var(--accent)' }}>Round #{idx + 1}</span>
                <button className="btn btn-danger btn-xs" onClick={() => removeRound(idx)} style={{ padding: '2px 6px' }}>Remove</button>
              </div>
              <div className="g2" style={{ gridGap: 8 }}>
                <div className="fg">
                  <label style={{ fontSize: '.74rem', marginBottom: 2 }}>Round Name *</label>
                  <input 
                    value={m.round} 
                    onChange={e => updateRound(idx, 'round', e.target.value)} 
                    placeholder="e.g. Round 1" 
                    style={{ padding: '6px 8px', fontSize: '.8rem' }}
                  />
                </div>
                <div className="fg" style={{ gridColumn: 'span 2' }}>
                  <label style={{ fontSize: '.74rem', marginBottom: 2 }}>Motion *</label>
                  <input 
                    value={m.motion} 
                    onChange={e => updateRound(idx, 'motion', e.target.value)} 
                    placeholder="This House would..." 
                    style={{ padding: '6px 8px', fontSize: '.8rem' }}
                  />
                </div>
                <div className="fg" style={{ gridColumn: 'span 2' }}>
                  <label style={{ fontSize: '.74rem', marginBottom: 2 }}>Info Slide (Optional)</label>
                  <textarea 
                    value={m.infoslide || ''} 
                    onChange={e => updateRound(idx, 'infoslide', e.target.value)} 
                    placeholder="Background information or definitions..." 
                    style={{ 
                      padding: '6px 8px', 
                      fontSize: '.8rem', 
                      height: 50, 
                      resize: 'vertical',
                      border: '1px solid var(--border2)',
                      borderRadius: 'var(--r)',
                      background: 'var(--surface)',
                      color: 'var(--text)',
                      outline: 'none',
                      fontFamily: 'inherit'
                    }}
                  />
                </div>
                <div className="fg" style={{ gridColumn: 'span 2' }}>
                  <label style={{ fontSize: '.74rem', marginBottom: 2 }}>Tags (Select multiple from preset list)</label>
                  <TagPicker 
                    value={m.tags || ''} 
                    onChange={val => updateRound(idx, 'tags', val)} 
                  />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="m-footer" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14 }}>
        <button className="btn btn-ghost btn-sm" onClick={addRound} disabled={loading}>+ Add Round</button>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={save} disabled={loading}>Save Motions</button>
        </div>
      </div>
    </Modal>
  );
}

// ─── ADMIN COMPETITIONS ───────────────────────────────────────────────────────
function AdminCompetitions({ competitions, members, refetch, toast, settings, saveSetting, refetchMotions }) {
  const [showForm, setShowForm] = useState(false);
  const [editC, setEditC] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [selectedCompForMotions, setSelectedCompForMotions] = useState(null);
  const [ordered, setOrdered] = useState([]);
  useEffect(()=>{setOrdered([...competitions]);},[competitions]);

  const saveOrder = async arr => {
    for (let i=0;i<arr.length;i++) await sb.from('competitions').update({order_index:i+1}).eq('id',arr[i].id);
    toast('Order saved');
  };
  const { onDragStart, onDragOver, onDrop, onDragEnd, isDragOver } = useDragReorder(ordered,setOrdered,saveOrder);

  const addOrUpdate = async form => {
    if (editC) {
      const { id, created_at, ...rest } = form;
      const { error } = await sb.from('competitions').update(rest).eq('id',editC.id);
      if (error) toast(error.message,'error'); else { toast('Updated'); await refetch(); }
    } else {
      const { error } = await sb.from('competitions').insert({...form,order_index:competitions.length+1});
      if (error) toast(error.message,'error'); else { toast('Added'); await refetch(); }
    }
    setShowForm(false); setEditC(null);
  };
  const del = async id => { await sb.from('competitions').delete().eq('id',id); toast('Deleted'); await refetch(); setConfirm(null); };

  return (
    <div className="admin-content">
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16,flexWrap:'wrap',gap:10}}>
        <div><h2 style={{fontFamily:'Playfair Display,serif',fontSize:'1.25rem',marginBottom:2}}>Manage Competitions</h2><p style={{color:'var(--text3)',fontSize:'.78rem'}}>{competitions.length} competitions · drag to reorder</p></div>
        <button className="btn btn-primary btn-sm" onClick={()=>{setEditC(null);setShowForm(true);}}>+ Add Competition</button>
      </div>
      <div className="card">
        <div className="tbl-wrap">
          <table>
            <thead><tr><th style={{width:24}}></th><th>#</th><th>Code</th><th>Competition</th><th>Organizer</th><th>Date</th><th>Fmt</th><th>Level</th><th>Participants</th><th>Actions</th></tr></thead>
            <tbody>
              {ordered.map((c,i)=>(
                <tr key={c.id} className={`drag-row ${isDragOver(i)?'drag-over':''}`} draggable onDragStart={e=>onDragStart(e,i)} onDragOver={e=>onDragOver(e,i)} onDrop={e=>onDrop(e,i)} onDragEnd={onDragEnd}>
                  <td><span className="drag-handle">⠿</span></td>
                  <td style={{color:'var(--text3)',fontWeight:600,fontSize:'.72rem'}}>{i+1}</td>
                  <td style={{fontWeight:700,color:'var(--accent)',fontSize:'.78rem',whiteSpace:'nowrap'}}>{c.code}</td>
                  <td style={{fontSize:'.8rem',maxWidth:160}}>{c.competition}</td>
                  <td style={{fontSize:'.78rem',color:'var(--text2)',whiteSpace:'nowrap'}}>{c.organizer||'—'}</td>
                  <td style={{fontSize:'.74rem',color:'var(--text3)',whiteSpace:'nowrap'}}>{c.comp_date||'—'}</td>
                  <td><FormatBadge f={c.format}/></td>
                  <td style={{fontSize:'.76rem'}}>{c.level}</td>
                  <td style={{textAlign:'center'}}>{(c.participants||[]).length}</td>
                  <td><div style={{display:'flex',gap:4}}><button className="btn btn-outline btn-xs" onClick={()=>{setEditC(c);setShowForm(true);}}>Edit</button><button className="btn btn-outline btn-xs" onClick={()=>setSelectedCompForMotions(c)}>Motions</button><button className="btn btn-danger btn-xs" onClick={()=>setConfirm(c.id)}>Del</button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {showForm && <CompForm comp={editC} members={members} onSave={addOrUpdate} onClose={()=>{setShowForm(false);setEditC(null);}} />}
      {confirm && <Modal title="Delete?" onClose={()=>setConfirm(null)} sm><p style={{color:'var(--text3)'}}>Permanently delete this competition?</p><div className="m-footer"><button className="btn btn-ghost" onClick={()=>setConfirm(null)}>Cancel</button><button className="btn btn-danger" onClick={()=>del(confirm)}>Delete</button></div></Modal>}
      {selectedCompForMotions && <AdminCompMotionsModal comp={selectedCompForMotions} settings={settings} saveSetting={saveSetting} toast={toast} onClose={()=>setSelectedCompForMotions(null)} refetchMotions={refetchMotions} />}
    </div>
  );
}

// ─── ADMIN SETTINGS ───────────────────────────────────────────────────────────
function AdminSettings({ settings, saveSetting, toast }) {
  const fileRef = useRef();

  const save = async (key, value) => { await saveSetting(key, value); toast('Saved'); };

  const handleFile = e => {
    const file = e.target.files[0]; if (!file) return;
    compressImage(file, 200, dataUrl => save('logo_url', dataUrl));
  };

  const Card = ({ icon, title, desc, iconBg, children }) => (
    <div className="settings-card">
      <div className="settings-card-header">
        <div className="settings-card-icon" style={{background:iconBg||'rgba(108,143,255,.15)'}}>{icon}</div>
        <div><div className="settings-card-title">{title}</div><div className="settings-card-desc">{desc}</div></div>
      </div>
      {children}
    </div>
  );
  const Row = ({ label, sub, children }) => (
    <div className="settings-row">
      <div style={{flex:1,minWidth:0}}><div className="settings-row-label">{label}</div>{sub&&<div className="settings-row-sub">{sub}</div>}</div>
      <div className="settings-row-ctrl">{children}</div>
    </div>
  );
  const InlineInput = ({ sKey, width=180, placeholder='' }) => (
    <input value={settings[sKey]||''} onChange={e=>saveSetting(sKey,e.target.value)} onBlur={e=>save(sKey,e.target.value)}
      style={{width,padding:'6px 9px',border:'1px solid var(--border2)',borderRadius:'var(--r)',fontSize:'.8rem',background:'var(--surface2)',color:'var(--text)',outline:'none'}}
      placeholder={placeholder} />
  );

  return (
    <div className="admin-content">
      <div style={{marginBottom:18}}>
        <h2 style={{fontFamily:'Playfair Display,serif',fontSize:'1.25rem',marginBottom:2}}>Settings</h2>
        <p style={{color:'var(--text3)',fontSize:'.78rem'}}>Customize appearance, behavior, and content of the EDS UNIMA portal</p>
      </div>
      <div className="settings-grid">

        <Card icon="🎨" title="Branding" desc="Logo, name, tagline, footer" iconBg="rgba(230,184,74,.15)">
          <div className="settings-row" style={{flexDirection:'column',alignItems:'flex-start',gap:10,border:'none',paddingBottom:10,borderBottom:'1px solid var(--border)'}}>
            <div style={{display:'flex',alignItems:'center',gap:14}}>
              <div style={{width:60,height:60,borderRadius:12,border:'1px solid var(--border2)',background:'var(--surface2)',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',flexShrink:0}}>
                {settings.logo_url
                  ? <img src={settings.logo_url} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="Logo" />
                  : <span style={{fontFamily:'Playfair Display,serif',fontSize:'1.2rem',color:'var(--accent)'}}>E</span>}
              </div>
              <div>
                <div style={{fontSize:'.8rem',fontWeight:500,marginBottom:6}}>Organization Logo</div>
                <div style={{display:'flex',gap:6}}>
                  <button className="btn btn-ghost btn-sm" onClick={()=>fileRef.current.click()}>📁 Upload</button>
                  {settings.logo_url && <button className="btn btn-danger btn-sm" onClick={()=>save('logo_url','')}>Remove</button>}
                </div>
                <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={handleFile} />
              </div>
            </div>
          </div>
          <Row label="Organization Name"><InlineInput sKey="org_name" placeholder="EDS UNIMA" /></Row>
          <Row label="Tagline"><InlineInput sKey="org_tagline" placeholder="Member Database" /></Row>
          <Row label="Footer Text"><InlineInput sKey="footer_text" width={240} placeholder="English Debating Society…" /></Row>
        </Card>

        <Card icon="🌐" title="Public Page" desc="What visitors see" iconBg="rgba(52,211,153,.12)">
          <Row label="Default Landing Tab">
            <select value={settings.default_tab||'debaters'} onChange={e=>save('default_tab',e.target.value)} style={{padding:'6px 9px',border:'1px solid var(--border2)',borderRadius:'var(--r)',fontSize:'.8rem',background:'var(--surface2)',color:'var(--text)',outline:'none'}}>
              <option value="debaters">Debaters</option><option value="competitions">Competitions</option><option value="membership">Membership</option>
            </select>
          </Row>
          <Row label="Show Stats on Public Pages"><Toggle checked={settings.show_stats_on_public!==false} onChange={v=>save('show_stats_on_public',v)} /></Row>
          <Row label="Show Last Updated Note"><Toggle checked={settings.show_last_updated!==false} onChange={v=>save('show_last_updated',v)} /></Row>
          <Row label="Allow Public Search"><Toggle checked={settings.allow_public_search!==false} onChange={v=>save('allow_public_search',v)} /></Row>
        </Card>

        <Card icon="📊" title="Data Display" desc="Pagination and table options" iconBg="rgba(192,132,252,.12)">
          <Row label="Rows Per Page">
            <select value={settings.items_per_page||'50'} onChange={e=>save('items_per_page',e.target.value)} style={{padding:'6px 9px',border:'1px solid var(--border2)',borderRadius:'var(--r)',fontSize:'.8rem',background:'var(--surface2)',color:'var(--text)',outline:'none'}}>
              {['25','50','100','All'].map(o=><option key={o} value={o}>{o}</option>)}
            </select>
          </Row>
          <Row label="Show Member Photos" sub="Profile pictures (future feature)"><Toggle checked={settings.show_member_photos!==false} onChange={v=>save('show_member_photos',v)} /></Row>
        </Card>

        <Card icon="⚙️" title="System" desc="Site-wide controls" iconBg="rgba(248,113,113,.12)">
          <Row label="Maintenance Mode" sub="Shows maintenance page to public visitors">
            <Toggle checked={!!settings.maintenance_mode} onChange={v=>save('maintenance_mode',v)} />
          </Row>
        </Card>

        <Card icon="🌱" title="Data Management" desc="Seed and reset utilities" iconBg="rgba(52,211,153,.12)">
          <div style={{padding:'8px 0',borderBottom:'1px solid var(--border)'}}>
            <div style={{fontSize:'.8rem',color:'var(--text2)',marginBottom:10,lineHeight:1.6}}>Use these tools to seed initial data into an empty database.</div>
            <button className="btn btn-ghost btn-sm" style={{borderColor:'var(--green)',color:'var(--green)'}} onClick={async()=>{
              const {data} = await sb.from('members').select('id').limit(1);
              if (data?.length) { toast('Members already exist','error'); return; }
              toast('Please use the SQL seed file for initial data','error');
            }}>🌱 Check Member Data</button>
          </div>
          <Row label="Clear all members" sub="⚠️ Permanently deletes ALL member records">
            <button className="btn btn-danger btn-xs" onClick={async()=>{ if(!window.confirm('Delete ALL members? This cannot be undone.'))return; await sb.from('members').delete().neq('id',0); toast('All members deleted'); }}>Delete All</button>
          </Row>
          <Row label="Clear all competitions" sub="⚠️ Permanently deletes ALL competition records">
            <button className="btn btn-danger btn-xs" onClick={async()=>{ if(!window.confirm('Delete ALL competitions?'))return; await sb.from('competitions').delete().neq('id',0); toast('All competitions deleted'); }}>Delete All</button>
          </Row>
        </Card>

      </div>
    </div>
  );
}

// ─── ADMIN DASHBOARD ─────────────────────────────────────────────────────────
function AdminDashboard({ members, competitions, materials = [] }) {
  const nonAlumni = members.filter(m=>!m.classes?.includes('Alumni')&&!m.classes?.includes('Ex'));
  const active = nonAlumni.filter(m=>m.active_status==='Active');
  const totalRounds = members.reduce((s,m)=>s+(m.total_rounds||0),0);
  const totalBreaks = members.reduce((s,m)=>s+(m.total_breaking||0),0);
  const byDiv = { English:members.filter(m=>m.division==='English').length, Indonesia:members.filter(m=>m.division==='Indonesia').length, Flex:members.filter(m=>m.division==='Flex').length };
  const byRank = { Ace:nonAlumni.filter(m=>m.rank==='Ace').length, Troop:nonAlumni.filter(m=>m.rank==='Troop').length, Trainee:nonAlumni.filter(m=>m.rank==='Trainee').length };
  const topRounds = [...members].sort((a,b)=>(b.total_rounds||0)-(a.total_rounds||0)).slice(0,10);
  const topBreaks = [...members].sort((a,b)=>(b.total_breaking||0)-(a.total_breaking||0)).slice(0,10);
  const byLevel = {}; competitions.forEach(c=>{byLevel[c.level]=(byLevel[c.level]||0)+1;});

  return (
    <div className="admin-content">
      <div style={{marginBottom:16}}><h2 style={{fontFamily:'Playfair Display,serif',fontSize:'1.25rem',marginBottom:2}}>Dashboard</h2><p style={{color:'var(--text3)',fontSize:'.78rem'}}>EDS UNIMA at a glance — {members.length} members · {competitions.length} competitions · {materials.length} study materials</p></div>

      <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'var(--r3)',padding:'16px 20px',marginBottom:16}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:10}}>
          <div>
            <div style={{fontWeight:700,fontSize:'.86rem',marginBottom:2}}>Export Data</div>
            <div style={{fontSize:'.72rem',color:'var(--text3)'}}>Download as Excel (.xlsx) — all current database records</div>
          </div>
          <div style={{display:'flex',gap:7,flexWrap:'wrap'}}>
            <button className="btn btn-ghost btn-sm" onClick={()=>exportDebaters(members)} style={{gap:5}}>
              <span>🎤</span> Debaters
            </button>
            <button className="btn btn-ghost btn-sm" onClick={()=>exportMembership(members)} style={{gap:5}}>
              <span>📋</span> Membership
            </button>
            <button className="btn btn-ghost btn-sm" onClick={()=>exportCompetitions(competitions)} style={{gap:5}}>
              <span>🏆</span> Competitions
            </button>
            <button className="btn btn-primary btn-sm" onClick={()=>exportAll(members,competitions)} style={{gap:5}}>
              <span>⬇️</span> Export All
            </button>
          </div>
        </div>
      </div>
      <div className="dash-stat-grid" style={{gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))'}}>
        {[
          ['Members',members.length,`${active.length} active`,'var(--accent)'],
          ['Competitions',competitions.length,`${competitions.filter(c=>c.format==='BP').length} BP · ${competitions.filter(c=>c.format==='AP').length} AP`,'var(--gold)'],
          ['Total Rounds',totalRounds,`avg ${members.length?Math.round(totalRounds/members.length):0}/member`,'var(--green)'],
          ['Total Breaks',totalBreaks,'breaking performances','var(--accent2)'],
          ['Study Materials',materials.length,`${materials.filter(m=>m.material_type==='file').length} files · ${materials.filter(m=>m.material_type==='link').length} links`,'var(--purple)'],
        ].map(([l,v,sub,c])=>(
          <div key={l} className="dash-card"><div className="dash-card-stripe" style={{background:c}}/><div className="dash-num" style={{color:c}}>{v}</div><div className="dash-lbl">{l}</div><div className="dash-sub">{sub}</div></div>
        ))}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:12,marginBottom:12}}>
        <div className="card card-pad">
          <div style={{fontWeight:700,marginBottom:12,fontSize:'.86rem'}}>By Division</div>
          {Object.entries(byDiv).map(([d,v])=>(
            <div key={d} className="progress-row"><div className="progress-lbl"><DivBadge div={d}/></div><div className="progress-bar"><div className="progress-fill" style={{width:`${v/Math.max(...Object.values(byDiv),1)*100}%`,background:'var(--accent)'}}/></div><div className="progress-val">{v}</div></div>
          ))}
        </div>
        <div className="card card-pad">
          <div style={{fontWeight:700,marginBottom:12,fontSize:'.86rem'}}>By Rank</div>
          {Object.entries(byRank).map(([r,v])=>(
            <div key={r} className="progress-row"><div className="progress-lbl"><RankBadge rank={r}/></div><div className="progress-bar"><div className="progress-fill" style={{width:`${v/Math.max(...Object.values(byRank),1)*100}%`,background:r==='Ace'?'var(--gold)':r==='Troop'?'var(--blue)':'var(--text3)'}}/></div><div className="progress-val">{v}</div></div>
          ))}
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:12,marginBottom:12}}>
        <div className="card card-pad"><div style={{fontWeight:700,marginBottom:12,fontSize:'.86rem'}}>Top 10 — Rounds</div><table><thead><tr><th>#</th><th>Name</th><th>Rounds</th></tr></thead><tbody>{topRounds.map((m,i)=><tr key={m.id}><td style={{fontWeight:700,color:i===0?'var(--gold)':'var(--text3)',fontSize:'.72rem'}}>{i+1}</td><td style={{fontSize:'.8rem',fontWeight:i===0?700:400}}>{m.full_name}</td><td style={{fontWeight:700,color:'var(--accent)',textAlign:'center'}}>{m.total_rounds||0}</td></tr>)}</tbody></table></div>
        <div className="card card-pad"><div style={{fontWeight:700,marginBottom:12,fontSize:'.86rem'}}>Top 10 — Breaks</div><table><thead><tr><th>#</th><th>Name</th><th>Breaks</th></tr></thead><tbody>{topBreaks.map((m,i)=><tr key={m.id}><td style={{fontWeight:700,color:i===0?'var(--gold)':'var(--text3)',fontSize:'.72rem'}}>{i+1}</td><td style={{fontSize:'.8rem',fontWeight:i===0?700:400}}>{m.full_name}</td><td style={{fontWeight:700,color:'var(--gold)',textAlign:'center'}}>{m.total_breaking||0}</td></tr>)}</tbody></table></div>
      </div>
      {Object.keys(byLevel).length>0 && (
        <div className="card card-pad">
          <div style={{fontWeight:700,marginBottom:12,fontSize:'.86rem'}}>Competitions by Level</div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {Object.entries(byLevel).map(([l,v])=>(
              <div key={l} style={{background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:10,padding:'10px 14px',textAlign:'center',minWidth:80}}>
                <div style={{fontSize:'1.4rem',fontWeight:800,color:'var(--accent)',lineHeight:1}}>{v}</div>
                <div style={{fontSize:'.63rem',color:'var(--text3)',textTransform:'uppercase',letterSpacing:'.05em',marginTop:3}}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ADMIN BOARDS ─────────────────────────────────────────────────────────────
function PositionEditPanel({ pos, board, members, onSave, onClose }) {
  const [memberId, setMemberId] = useState(board ? (members.find(m=>m.full_name===board.member_name)?.id||'') : '');
  const [photoUrl, setPhotoUrl] = useState(board?.photo_url||'');
  const [extraInfo, setExtraInfo] = useState(board?.extra_info||'');
  const [photoMethod, setPhotoMethod] = useState('url');
  const fileRef = useRef();
  const handleFile = e => {
    const file = e.target.files[0]; if (!file) return;
    compressImage(file, 300, dataUrl => setPhotoUrl(dataUrl));
  };
  return (
    <div style={{padding:'12px 14px 16px',borderTop:'1px solid var(--border)',background:'var(--surface2)'}}>
      <div className="g2" style={{gap:12}}>
        <div className="fg span2">
          <label>Assign Member</label>
          <select value={memberId} onChange={e=>setMemberId(e.target.value)}>
            <option value="">— Select Member —</option>
            {members.filter(m => {
              if (pos === 'Advisor') return true; // allow selecting any member
              return !m.classes?.includes('Alumni') && !m.classes?.includes('Ex');
            }).map(m=>(
              <option key={m.id} value={m.id}>{m.full_name} ({m.membership_status||'Member'})</option>
            ))}
          </select>
        </div>
        <div className="fg span2">
          <label>Photo</label>
          <div style={{display:'flex',gap:6,marginBottom:7}}>
            {['url','upload'].map(mt=>(
              <button key={mt} className={`btn btn-xs ${photoMethod===mt?'btn-primary':'btn-ghost'}`} onClick={()=>setPhotoMethod(mt)}>
                {mt==='url'?'URL':'Upload'}
              </button>
            ))}
          </div>
          {photoMethod==='url'
            ? <input value={photoUrl} onChange={e=>setPhotoUrl(e.target.value)} placeholder="https://..." />
            : <div style={{display:'flex',alignItems:'center',gap:8}}>
                <button className="btn btn-ghost btn-sm" onClick={()=>fileRef.current.click()}>Choose File</button>
                <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={handleFile}/>
                {photoUrl && <span style={{fontSize:'.72rem',color:'var(--green)'}}>Image set</span>}
              </div>
          }
          {photoUrl && (
            <div style={{display:'flex',alignItems:'center',gap:8,marginTop:6}}>
              <img src={photoUrl} style={{width:44,height:44,borderRadius:'50%',objectFit:'cover',border:'2px solid var(--border)'}} alt="preview"/>
              <button className="btn btn-danger btn-xs" onClick={()=>setPhotoUrl('')}>Remove</button>
            </div>
          )}
        </div>
        <div className="fg span2">
          <label>Extra Note (optional)</label>
          <input value={extraInfo} onChange={e=>setExtraInfo(e.target.value)} placeholder="Note shown if member not in database" />
        </div>
      </div>
      <div style={{display:'flex',gap:7,marginTop:12,justifyContent:'flex-end'}}>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary btn-sm" onClick={()=>onSave(pos,memberId,photoUrl,extraInfo)}>Save</button>
      </div>
    </div>
  );
}

function AdminBoards({ boards, members, refetch, toast }) {
  const [editKey, setEditKey] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const getBoard = pos => boards.find(b=>b.position===pos)||null;
  const getMember = name => members.find(m=>m.full_name?.toLowerCase()===name?.toLowerCase());

  const ORG_POSITIONS = ['President','Vice President','Secretary','Treasurer','Training Director','Training Officer','People Director','People Officer','MedCom Director','MedCom Officer','Advisor'];

  const upsert = async (boardId, pos, memberId, photoUrl, extraInfo) => {
    const member = members.find(m=>m.id===+memberId);
    const payload = {
      position:pos,
      member_name:member?.full_name||'',
      photo_url:photoUrl||'',
      extra_info:extraInfo||'',
      sort_order:ORG_POSITIONS.indexOf(pos)+1,
    };
    if (boardId) {
      const {error} = await sb.from('boards').update(payload).eq('id',boardId);
      if(error) toast(error.message,'error'); else toast('Updated');
    } else {
      const {error} = await sb.from('boards').insert(payload);
      if(error) toast(error.message,'error'); else toast('Assigned');
    }
    await refetch(); setEditKey(null);
  };

  const remove = async id => {
    await sb.from('boards').delete().eq('id',id);
    toast('Cleared'); await refetch(); setConfirm(null);
  };

  const TIERS = [
    {label:'Top Leadership', tier:'n1', positions:['President','Vice President']},
    {label:'Secretariat',    tier:'n2', positions:['Secretary','Treasurer']},
    {label:'Training Dept',  tier:'n3', positions:['Training Director','Training Officer']},
    {label:'People Dept',    tier:'n3', positions:['People Director','People Officer']},
    {label:'MedCom Dept',    tier:'n3', positions:['MedCom Director','MedCom Officer']},
    {label:'Senior Advisors', tier:'n3', positions:['Advisor']},
  ];
  const tierColor = t => t==='n1'?'var(--gold)':t==='n2'?'var(--accent)':'var(--text3)';

  return (
    <div className="admin-content">
      <div style={{marginBottom:18}}>
        <h2 style={{fontFamily:'Playfair Display,serif',fontSize:'1.25rem',marginBottom:3}}>Manage Board</h2>
        <p style={{color:'var(--text3)',fontSize:'.78rem'}}>Assign or update each position. Click Edit to expand the assignment panel.</p>
      </div>
      {TIERS.map(group=>(
        <div key={group.label} style={{marginBottom:16}}>
          <div style={{fontSize:'.67rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'.08em',color:'var(--text3)',marginBottom:7,paddingBottom:5,borderBottom:'1px solid var(--border)'}}>{group.label}</div>
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {group.positions.map(pos=>{
              const posEntries = boards.filter(b=>b.position===pos);
              const maxAllowed = pos === 'Advisor' ? 20 : (pos.endsWith('Officer') ? 2 : 1);
              return (
                <div key={pos} style={{display:'flex',flexDirection:'column',gap:6}}>
                  {posEntries.map((b, idx)=>{
                    const m=getMember(b.member_name);
                    const isOpen=editKey===b.id;
                    return (
                      <div key={b.id} style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'var(--r2)',overflow:'hidden'}}>
                        <div style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px'}}>
                          <div style={{width:38,height:38,borderRadius:'50%',overflow:'hidden',border:'1px solid var(--border2)',background:'var(--surface3)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:'.9rem'}}>
                            {(b.photo_url || boards.find(other => other.member_name?.toLowerCase() === b.member_name?.toLowerCase() && other.photo_url)?.photo_url)
                              ? <img src={b.photo_url || boards.find(other => other.member_name?.toLowerCase() === b.member_name?.toLowerCase() && other.photo_url)?.photo_url} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/>
                              : '👤'}
                          </div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:'.68rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'.07em',color:tierColor(group.tier),marginBottom:2}}>
                              {pos} {posEntries.length > 1 ? `#${idx+1}` : ''}
                            </div>
                            <div style={{fontSize:'.83rem',fontWeight:600,color:'var(--text)'}}>{b.member_name}</div>
                            {m&&<div style={{marginTop:3,display:'flex',gap:4,flexWrap:'wrap'}}><DivBadge div={m.division}/><RankBadge rank={m.rank}/></div>}
                          </div>
                          <div style={{display:'flex',gap:6,flexShrink:0}}>
                            <button className="btn btn-outline btn-xs" onClick={()=>setEditKey(isOpen?null:b.id)}>{isOpen?'Close':'Edit'}</button>
                            <button className="btn btn-danger btn-xs" onClick={()=>setConfirm(b)}>Clear</button>
                          </div>
                        </div>
                        {isOpen&&<PositionEditPanel pos={pos} board={b} members={members} onSave={(p, memberId, photoUrl, extraInfo)=>upsert(b.id, p, memberId, photoUrl, extraInfo)} onClose={()=>setEditKey(null)}/>}
                      </div>
                    );
                  })}
                  {posEntries.length===0 && (
                    <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'var(--r2)',overflow:'hidden',opacity:0.8}}>
                      <div style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px'}}>
                        <div style={{width:38,height:38,borderRadius:'50%',background:'var(--surface3)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:'.9rem',color:'var(--text3)'}}>👤</div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:'.68rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'.07em',color:tierColor(group.tier),marginBottom:2}}>{pos}</div>
                          <div style={{fontSize:'.83rem',fontWeight:600,color:'var(--text3)',fontStyle:'italic'}}>Vacant</div>
                        </div>
                        <div style={{display:'flex',gap:6,flexShrink:0}}>
                          <button className="btn btn-outline btn-xs" onClick={()=>setEditKey(editKey===("new-" + pos)?null:("new-" + pos))}>{editKey===("new-" + pos)?'Close':'Assign'}</button>
                        </div>
                      </div>
                      {editKey===("new-" + pos)&&<PositionEditPanel pos={pos} board={null} members={members} onSave={(p, memberId, photoUrl, extraInfo)=>upsert(null, p, memberId, photoUrl, extraInfo)} onClose={()=>setEditKey(null)}/>}
                    </div>
                  )}
                  {posEntries.length < maxAllowed && posEntries.length > 0 && (
                    <div style={{padding:'2px 0 6px'}}>
                      <button className="btn btn-ghost btn-xs" onClick={()=>setEditKey(editKey===("new-" + pos)?null:("new-" + pos))} style={{fontSize:'.68rem',padding:'3px 10px'}}>
                        {editKey===("new-" + pos)?'Cancel Assign':`+ Assign Another ${pos}`}
                      </button>
                      {editKey===("new-" + pos)&&(
                        <div style={{marginTop:6,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'var(--r2)',overflow:'hidden'}}>
                          <PositionEditPanel pos={pos} board={null} members={members} onSave={(p, memberId, photoUrl, extraInfo)=>upsert(null, p, memberId, photoUrl, extraInfo)} onClose={()=>setEditKey(null)}/>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {confirm&&(
        <Modal title="Clear Position?" onClose={()=>setConfirm(null)} sm>
          <p style={{color:'var(--text3)'}}>Remove the current assignment for <strong>{confirm.position}</strong> (<strong>{confirm.member_name}</strong>)?</p>
          <div className="m-footer">
            <button className="btn btn-ghost" onClick={()=>setConfirm(null)}>Cancel</button>
            <button className="btn btn-danger" onClick={()=>remove(confirm.id)}>Clear</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── HOF FORM ────────────────────────────────────────────────────────────────
const HOF_DEF = { name:'', award_title:'', year:'', description:'', photo_url:'', sort_order:99 };

function HofForm({ entry, onSave, onClose }) {
  const [f, setF] = useState(entry ? {...HOF_DEF,...entry} : {...HOF_DEF});
  const [photoMethod, setPhotoMethod] = useState('url');
  const fileRef = useRef();
  const set = (k,v) => setF(p=>({...p,[k]:v}));
  const handleFile = e => {
    const file = e.target.files[0]; if (!file) return;
    compressImage(file, 300, dataUrl => set('photo_url', dataUrl));
  };
  return (
    <Modal title={entry?'Edit Hall of Fame Entry':'Add Hall of Fame Entry'} onClose={onClose} wide>
      <div className="g2">
        <div className="fg"><label>Name *</label><input value={f.name} onChange={e=>set('name',e.target.value)} placeholder="Full name" /></div>
        <div className="fg"><label>Award Title *</label><input value={f.award_title} onChange={e=>set('award_title',e.target.value)} placeholder="e.g. Best Overall Debater" /></div>
        <div className="fg"><label>Year</label><input value={f.year||''} onChange={e=>set('year',e.target.value)} placeholder="e.g. 2024" /></div>
        <div className="fg"><label>Sort Order</label><input type="number" min="1" value={f.sort_order} onChange={e=>set('sort_order',+e.target.value)} /></div>
        <div className="fg span2">
          <label>Photo</label>
          <div style={{display:'flex',gap:6,marginBottom:8}}>
            {['url','upload'].map(m=><button key={m} className={`btn btn-sm ${photoMethod===m?'btn-primary':'btn-ghost'}`} onClick={()=>setPhotoMethod(m)}>{m==='url'?'URL':'Upload'}</button>)}
          </div>
          {photoMethod==='url'
            ? <input value={f.photo_url||''} onChange={e=>set('photo_url',e.target.value)} placeholder="https://…" />
            : <div><button className="btn btn-ghost btn-sm" onClick={()=>fileRef.current.click()}>📁 Choose File</button><input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={handleFile}/></div>
          }
          {f.photo_url && <img src={f.photo_url} style={{width:60,height:60,borderRadius:'50%',objectFit:'cover',marginTop:8,border:'1px solid var(--border)'}} alt="preview"/>}
        </div>
        <div className="fg span2"><label>Description *</label><textarea value={f.description||''} onChange={e=>set('description',e.target.value)} placeholder="Describe their contributions and achievements…" style={{minHeight:90}} /></div>
      </div>
      <div className="m-footer">
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={()=>{ if(!f.name||!f.award_title)return alert('Name and award title required.'); onSave(f); }}>{entry?'Save':'Add Entry'}</button>
      </div>
    </Modal>
  );
}

function AdminHallOfFame({ hof, refetch, toast }) {
  const [showForm, setShowForm] = useState(false);
  const [editH, setEditH] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [ordered, setOrdered] = useState([]);
  useEffect(()=>{ setOrdered([...hof]); },[hof]);

  const saveOrder = async arr => {
    for (let i=0;i<arr.length;i++) await sb.from('hall_of_fame').update({sort_order:i+1}).eq('id',arr[i].id);
    toast('Order saved');
  };
  const { onDragStart, onDragOver, onDrop, onDragEnd, isDragOver } = useDragReorder(ordered, setOrdered, saveOrder);

  const addOrUpdate = async form => {
    if (editH) {
      const { id, created_at, ...rest } = form;
      const { error } = await sb.from('hall_of_fame').update(rest).eq('id', editH.id);
      if (error) toast(error.message,'error'); else toast('Updated');
    } else {
      const { error } = await sb.from('hall_of_fame').insert({...form, sort_order: hof.length+1});
      if (error) toast(error.message,'error'); else toast('Added');
    }
    await refetch(); setShowForm(false); setEditH(null);
  };
  const del = async id => { await sb.from('hall_of_fame').delete().eq('id',id); toast('Deleted'); await refetch(); setConfirm(null); };
  return (
    <div className="admin-content">
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16,flexWrap:'wrap',gap:10}}>
        <div><h2 style={{fontFamily:'Playfair Display,serif',fontSize:'1.25rem',marginBottom:2}}>Manage Hall of Fame</h2><p style={{color:'var(--text3)',fontSize:'.78rem'}}>{hof.length} inductees · drag ⠿ to reorder</p></div>
        <button className="btn btn-primary btn-sm" onClick={()=>{setEditH(null);setShowForm(true);}}>+ Add Inductee</button>
      </div>
      <div className="card">
        <div className="tbl-wrap">
          <table>
            <thead><tr><th style={{width:24}}></th><th>#</th><th>Name</th><th>Award Title</th><th>Year</th><th>Photo</th><th>Actions</th></tr></thead>
            <tbody>
              {ordered.length===0 && <tr><td colSpan={7} style={{textAlign:'center',color:'var(--text3)',padding:36}}>No entries yet</td></tr>}
              {ordered.map((h,i)=>(
                <tr key={h.id} className={`drag-row ${isDragOver(i)?'drag-over':''}`} draggable onDragStart={e=>onDragStart(e,i)} onDragOver={e=>onDragOver(e,i)} onDrop={e=>onDrop(e,i)} onDragEnd={onDragEnd}>
                  <td><span className="drag-handle">⠿</span></td>
                  <td style={{color:'var(--text3)',fontWeight:600,fontSize:'.72rem'}}>{i+1}</td>
                  <td style={{fontWeight:600}}>{h.name}</td>
                  <td style={{color:'var(--gold)',fontSize:'.82rem',fontWeight:600}}>{h.award_title}</td>
                  <td style={{color:'var(--text3)',fontSize:'.78rem'}}>{h.year||'—'}</td>
                  <td>{h.photo_url?<img src={h.photo_url} style={{width:32,height:32,borderRadius:'50%',objectFit:'cover',border:'1px solid var(--border)'}} alt=""/>:<span style={{color:'var(--text3)',fontSize:'.75rem'}}>—</span>}</td>
                  <td><div style={{display:'flex',gap:4}}><button className="btn btn-outline btn-xs" onClick={()=>{setEditH(h);setShowForm(true);}}>Edit</button><button className="btn btn-danger btn-xs" onClick={()=>setConfirm(h.id)}>Del</button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {showForm && <HofForm entry={editH} onSave={addOrUpdate} onClose={()=>{setShowForm(false);setEditH(null);}} />}
      {confirm && <Modal title="Delete?" onClose={()=>setConfirm(null)} sm><p style={{color:'var(--text3)'}}>Remove this Hall of Fame entry?</p><div className="m-footer"><button className="btn btn-ghost" onClick={()=>setConfirm(null)}>Cancel</button><button className="btn btn-danger" onClick={()=>del(confirm)}>Delete</button></div></Modal>}
    </div>
  );
}

// ─── ADMIN STUDY MATERIALS ───────────────────────────────────────────────────
const STUDY_MAT_DEF = { title:'', description:'', material_type:'link', url:'', file_name:'', categories:[], is_highlighted:false, sort_order:99 };
const STUDY_MAT_CATEGORIES = ['BP Format','AP Format','Adjudication','Motions','Strategy','Theory','General','Other'];

function MaterialForm({ entry, onSave, onClose }) {
  const [f, setF] = useState(entry ? {
    ...STUDY_MAT_DEF,
    ...entry,
    categories: entry.categories || (entry.category ? [entry.category] : [])
  } : { ...STUDY_MAT_DEF });
  const [fileStatus, setFileStatus] = useState('');
  const fileRef = useRef();
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const handleFile = e => {
    const file = e.target.files[0]; if (!file) return;
    setFileStatus('Reading…');
    const reader = new FileReader();
    reader.onload = ev => {
      set('url', ev.target.result);
      set('file_name', file.name);
      setFileStatus(`✓ ${file.name}`);
    };
    reader.readAsDataURL(file);
  };

  const toggleCategory = c => {
    const cur = f.categories || [];
    const next = cur.includes(c) ? cur.filter(x => x !== c) : [...cur, c];
    set('categories', next);
  };

  return (
    <Modal title={entry ? 'Edit Material' : 'Add Study Material'} onClose={onClose} wide>
      <div className="g2">
        <div className="fg span2"><label>Title *</label><input value={f.title} onChange={e => set('title', e.target.value)} placeholder="e.g. BP Format Guide" /></div>
        
        <div className="fg span2">
          <label>Categories (Select all that apply)</label>
          <div style={{display:'flex', gap:6, flexWrap:'wrap', marginTop:6}}>
            {STUDY_MAT_CATEGORIES.map(c => {
              const active = (f.categories || []).includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  className={`btn btn-sm ${active ? 'btn-primary' : 'btn-ghost'}`}
                  style={{borderRadius:20, fontSize:'.75rem', padding:'4px 12px'}}
                  onClick={() => toggleCategory(c)}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </div>

        <div className="fg span2" style={{display:'flex', alignItems:'center', gap:10, marginTop:10, marginBottom:10}}>
          <Toggle checked={!!f.is_highlighted} onChange={v => set('is_highlighted', v)} />
          <div>
            <div style={{fontWeight:600, fontSize:'.85rem'}}>Highlighted Material</div>
            <div style={{fontSize:'.72rem', color:'var(--text3)'}}>Pin this material and display it with a featured visual styling</div>
          </div>
        </div>

        <div className="fg span2"><label>Description</label><textarea value={f.description || ''} onChange={e => set('description', e.target.value)} placeholder="Brief description of this material…" style={{minHeight:72}} /></div>
        <div className="fg span2">
          <label>Type</label>
          <div style={{display:'flex',gap:6,marginBottom:10}}>
            {['link','file'].map(t => (
              <button key={t} className={`btn btn-sm ${f.material_type===t ? 'btn-primary' : 'btn-ghost'}`} onClick={() => set('material_type', t)}>
                {t === 'link' ? '🔗 External Link' : '📄 File Upload'}
              </button>
            ))}
          </div>
          {f.material_type === 'link' ? (
            <input value={f.url || ''} onChange={e => set('url', e.target.value)} placeholder="https://…" />
          ) : (
            <div>
              <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current.click()}>📁 Choose File</button>
              <input ref={fileRef} type="file" style={{display:'none'}} onChange={handleFile} />
              {fileStatus && <span style={{marginLeft:10,fontSize:'.75rem',color:'var(--text3)'}}>{fileStatus}</span>}
              {f.file_name && <div style={{marginTop:6,fontSize:'.72rem',color:'var(--text3)'}}>{f.file_name}</div>}
            </div>
          )}
        </div>
      </div>
      <div className="m-footer">
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={() => { if (!f.title) return alert('Title is required.'); onSave(f); }}>
          {entry ? 'Save Changes' : 'Add Material'}
        </button>
      </div>
    </Modal>
  );
}

function AdminStudyMaterials({ materials, refetch, toast }) {
  const [showForm, setShowForm] = useState(false);
  const [editM, setEditM] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [ordered, setOrdered] = useState([]);
  useEffect(() => { setOrdered([...materials]); }, [materials]);

  const saveOrder = async arr => {
    for (let i = 0; i < arr.length; i++) await sb.from('study_materials').update({ sort_order: i + 1 }).eq('id', arr[i].id);
    toast('Order saved');
  };
  const { onDragStart, onDragOver, onDrop, onDragEnd, isDragOver } = useDragReorder(ordered, setOrdered, saveOrder);

  const addOrUpdate = async form => {
    if (editM) {
      const { id, created_at, uploaded_at, ...rest } = form;
      const { error } = await sb.from('study_materials').update(rest).eq('id', editM.id);
      if (error) toast(error.message, 'error'); else toast('Updated');
    } else {
      const { error } = await sb.from('study_materials').insert({ ...form, uploaded_at: new Date().toISOString(), sort_order: materials.length + 1 });
      if (error) toast(error.message, 'error'); else toast('Added');
    }
    await refetch(); setShowForm(false); setEditM(null);
  };

  const del = async id => {
    await sb.from('study_materials').delete().eq('id', id);
    toast('Deleted'); await refetch(); setConfirm(null);
  };

  const fmtDate = d => { if (!d) return '—'; const dt = new Date(d); return dt.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }); };

  return (
    <div className="admin-content">
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16,flexWrap:'wrap',gap:10}}>
        <div>
          <h2 style={{fontFamily:'Playfair Display,serif',fontSize:'1.25rem',marginBottom:2}}>Study Materials</h2>
          <p style={{color:'var(--text3)',fontSize:'.78rem'}}>{materials.length} material{materials.length !== 1 ? 's' : ''} · drag ⠃ to reorder</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => { setEditM(null); setShowForm(true); }}>+ Add Material</button>
      </div>
      <div className="card">
        <div className="tbl-wrap">
          <table>
            <thead><tr><th style={{width:24}}></th><th>#</th><th>Title</th><th>Categories</th><th>Type</th><th>Uploaded</th><th>Actions</th></tr></thead>
            <tbody>
              {ordered.length === 0 && <tr><td colSpan={7} style={{textAlign:'center',color:'var(--text3)',padding:36}}>No materials yet. Click "+ Add Material" to get started.</td></tr>}
              {ordered.map((m, i) => (
                <tr key={m.id} className={`drag-row ${isDragOver(i) ? 'drag-over' : ''}`}
                  draggable onDragStart={e => onDragStart(e, i)} onDragOver={e => onDragOver(e, i)} onDrop={e => onDrop(e, i)} onDragEnd={onDragEnd}>
                  <td><span className="drag-handle">⠃</span></td>
                  <td style={{color:'var(--text3)',fontWeight:600,fontSize:'.72rem'}}>{i + 1}</td>
                  <td>
                    <div style={{display:'flex', alignItems:'center', gap:6}}>
                      <div style={{fontWeight:600,fontSize:'.85rem'}}>{m.title}</div>
                      {m.is_highlighted && <span style={{fontSize:'.65rem', color:'var(--gold)', fontWeight:'bold', display:'flex', alignItems:'center', gap:2}} title="Highlighted">⭐ <span style={{fontSize:'.6rem', background:'rgba(230,184,74,.15)', padding:'1px 5px', borderRadius:4, border:'1px solid rgba(230,184,74,.3)'}}>Featured</span></span>}
                    </div>
                    {m.description && <div style={{fontSize:'.72rem',color:'var(--text3)',marginTop:2}}>{m.description.length > 60 ? m.description.slice(0,60) + '…' : m.description}</div>}
                  </td>
                  <td>
                    <div style={{display:'flex', gap:4, flexWrap:'wrap'}}>
                      {(m.categories && m.categories.length > 0) ? m.categories.map(cat => (
                        <span key={cat} style={{fontSize:'.72rem',fontWeight:700,padding:'2px 7px',borderRadius:10,background:'rgba(108,143,255,.12)',color:'var(--accent)',border:'1px solid rgba(108,143,255,.2)'}}>
                          {cat}
                        </span>
                      )) : <span style={{fontSize:'.72rem',fontWeight:700,padding:'2px 7px',borderRadius:10,background:'rgba(108,143,255,.12)',color:'var(--accent)',border:'1px solid rgba(108,143,255,.2)'}}>General</span>}
                    </div>
                  </td>
                  <td style={{fontSize:'.78rem'}}>{m.material_type === 'file' ? '📄 File' : '🔗 Link'}</td>
                  <td style={{color:'var(--text3)',fontSize:'.78rem'}}>{fmtDate(m.uploaded_at)}</td>
                  <td><div style={{display:'flex',gap:4}}>
                    <button className="btn btn-outline btn-xs" onClick={() => { setEditM(m); setShowForm(true); }}>Edit</button>
                    <button className="btn btn-danger btn-xs" onClick={() => setConfirm(m.id)}>Del</button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {showForm && <MaterialForm entry={editM} onSave={addOrUpdate} onClose={() => { setShowForm(false); setEditM(null); }} />}
      {confirm && <Modal title="Delete?" onClose={() => setConfirm(null)} sm><p style={{color:'var(--text3)'}}>Remove this study material?</p><div className="m-footer"><button className="btn btn-ghost" onClick={() => setConfirm(null)}>Cancel</button><button className="btn btn-danger" onClick={() => del(confirm)}>Delete</button></div></Modal>}
    </div>
  );
}

// ─── ADMIN INFO EDITOR ────────────────────────────────────────────────────────
function AdminInfoEditor({ info, saveInfo, toast }) {
  const [draft, setDraft] = useState({
    org_about: info?.org_about || 'A prestigious student organization at Universitas Negeri Manado that focuses on the proliferation of parliamentary debate.\n\nFlagship Project: Unima Debate League\n\nUniversitas Negeri Manado, Tondano, Sulawesi Utara, Indonesia',
    rank_trainee: info?.rank_trainee || 'Trainee is the entry-level rank for new members who have been accepted through recruitment and/or have completed basic debate training.',
    rank_troop_desc: info?.rank_troop_desc || 'Troop is the intermediate rank for members who have demonstrated sustained commitment and competitive experience.',
    rank_troop_reqs: info?.rank_troop_reqs || 'Completed basic and/or intermediate debate training.\nParticipated in at least 4–5 provincial, regional, or national competitions across 2–3 semesters.',
    rank_ace_desc: info?.rank_ace_desc || 'Ace is the highest rank, awarded to members who have proven excellence across training, volume of competition, and competitive achievement.',
    rank_ace_reqs: info?.rank_ace_reqs || 'Completed training at basic, intermediate, and national tournament preparation levels.\nParticipated in at least 8–10 competitions across 3–4 semesters.\nAchieved breaking status at least 3–4 times in regional, national, or international competitions.',
    div_en: info?.div_en || 'Members who compete in English-language debate tournaments, following BP or AP formats conducted in English.',
    div_id: info?.div_id || 'Members who compete in Indonesian-language debate tournaments (KDMI, LDBI, etc.) conducted in Bahasa Indonesia.',
    div_flex: info?.div_flex || 'Members who are proficient and compete in both English and Indonesian debate — capable of competing in either division.',
    class_advisor: info?.class_advisor || 'Senior members who have demonstrated exceptional skill and experience. They serve as mentors, guiding the development of newer members and providing strategic advice to the organization.',
    class_board: info?.class_board || 'The Board of Executives — members chosen to lead and run the organization. They hold executive positions such as President, Vice President, Directors, Officers, and other leadership roles.',
    class_general: info?.class_general || 'General members of EDS UNIMA who actively participate in training sessions, competitions, and organizational activities.',
    class_alumni: info?.class_alumni || 'Former members who have graduated from Universitas Negeri Manado. They remain part of the EDS UNIMA community and their competition records are preserved.',
    class_ex: info?.class_ex || 'Individuals who were previously members but are no longer considered active — either due to removal or prolonged inactivity. Their competition records are retained in the database.',
  });
  const set = (k,v) => setDraft(p=>({...p,[k]:v}));
  const save = async () => { await saveInfo(draft); toast('Info page saved'); };

  const SectionCard = ({title, children}) => (
    <div className="card card-pad" style={{marginBottom:14}}>
      <div style={{fontWeight:700,fontSize:'.88rem',marginBottom:14,paddingBottom:10,borderBottom:'1px solid var(--border)'}}>{title}</div>
      {children}
    </div>
  );
  const Field = ({label, k, multiline=false, rows=3}) => (
    <div className="fg" style={{marginBottom:10}}>
      <label>{label}</label>
      {multiline
        ? <textarea value={draft[k]} onChange={e=>set(k,e.target.value)} style={{minHeight:rows*28+'px',fontSize:'.84rem'}} />
        : <input value={draft[k]} onChange={e=>set(k,e.target.value)} />
      }
    </div>
  );

  return (
    <div className="admin-content">
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16,flexWrap:'wrap',gap:10}}>
        <div><h2 style={{fontFamily:'Playfair Display,serif',fontSize:'1.25rem',marginBottom:2}}>Manage Info Page</h2><p style={{color:'var(--text3)',fontSize:'.78rem'}}>Edit all content displayed on the public Info page</p></div>
        <button className="btn btn-primary btn-sm" onClick={save}>💾 Save All Changes</button>
      </div>
      <div style={{maxWidth:720}}>

        <SectionCard title="📖 About EDS UNIMA">
          <Field label="Organization Description" k="org_about" multiline rows={5} />
        </SectionCard>

        <SectionCard title="🎖️ Ranks — Trainee">
          <Field label="Description" k="rank_trainee" multiline rows={3} />
        </SectionCard>

        <SectionCard title="🎖️ Ranks — Troop">
          <Field label="Description" k="rank_troop_desc" multiline rows={3} />
          <Field label="Requirements (one per line)" k="rank_troop_reqs" multiline rows={3} />
        </SectionCard>

        <SectionCard title="🎖️ Ranks — Ace">
          <Field label="Description" k="rank_ace_desc" multiline rows={3} />
          <Field label="Requirements (one per line)" k="rank_ace_reqs" multiline rows={4} />
        </SectionCard>

        <SectionCard title="🌐 Divisions">
          <Field label="English Division" k="div_en" multiline rows={2} />
          <Field label="Indonesia Division" k="div_id" multiline rows={2} />
          <Field label="Flex Division" k="div_flex" multiline rows={2} />
        </SectionCard>

        <SectionCard title="🏷️ Classes">
          <Field label="Advisor" k="class_advisor" multiline rows={3} />
          <Field label="Board" k="class_board" multiline rows={3} />
          <Field label="General" k="class_general" multiline rows={2} />
          <Field label="Alumni" k="class_alumni" multiline rows={2} />
          <Field label="Ex" k="class_ex" multiline rows={2} />
        </SectionCard>

        <div style={{display:'flex',justifyContent:'flex-end'}}>
          <button className="btn btn-primary" onClick={save}>💾 Save All Changes</button>
        </div>
      </div>
    </div>
  );
}

// ─── ADMIN MOTIONS (STANDALONE) ──────────────────────────────────────────────
const STANDALONE_MOTION_DEF = { motion: '', infoslide: '', round: '', format: 'BP', level: 'National', tags: '', date: '' };

function MotionForm({ entry, competitions, onSave, onClose }) {
  const [motionType, setMotionType] = useState(() => {
    if (entry && !entry.isStandalone) return 'competition';
    return 'standalone';
  });
  const [selectedCompId, setSelectedCompId] = useState(() => {
    if (entry && !entry.isStandalone) return entry.compId || '';
    return '';
  });
  const [f, setF] = useState(() => {
    if (entry) {
      return { ...STANDALONE_MOTION_DEF, ...entry, tags: entry.tags || '' };
    }
    return { ...STANDALONE_MOTION_DEF };
  });

  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const handleSave = () => {
    if (!f.motion.trim()) return alert('Motion text is required.');
    if (!f.round.trim()) return alert('Round / Context is required.');

    if (motionType === 'competition') {
      if (!selectedCompId) return alert('Please select a competition.');
      onSave({
        isStandalone: false,
        compId: Number(selectedCompId),
        motion: f.motion,
        infoslide: f.infoslide,
        round: f.round,
        tags: f.tags
      });
    } else {
      onSave({
        isStandalone: true,
        motion: f.motion,
        infoslide: f.infoslide,
        round: f.round,
        format: f.format,
        level: f.level,
        date: f.date,
        tags: f.tags
      });
    }
  };

  return (
    <Modal title={entry ? 'Edit Motion' : 'Add Motion'} onClose={onClose} wide>
      <div className="g2">
        <div className="fg span2">
          <label>Motion Type</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
            <button
              type="button"
              className={`btn btn-sm ${motionType === 'standalone' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setMotionType('standalone')}
            >
              ⭐ Standalone Practice
            </button>
            <button
              type="button"
              className={`btn btn-sm ${motionType === 'competition' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setMotionType('competition')}
            >
              🏆 Tied to Competition
            </button>
          </div>
        </div>

        {motionType === 'competition' && (
          <div className="fg span2">
            <label>Select Competition *</label>
            <select value={selectedCompId} onChange={e => setSelectedCompId(e.target.value)}>
              <option value="">— Select Existing Competition —</option>
              {competitions.map(comp => (
                <option key={comp.id} value={comp.id}>
                  {comp.code} - {comp.competition} ({comp.comp_date || 'No Date'})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="fg span2">
          <label>Motion Text *</label>
          <input value={f.motion} onChange={e => set('motion', e.target.value)} placeholder="This House would..." />
        </div>
        <div className="fg span2">
          <label>Info Slide (Optional)</label>
          <textarea 
            value={f.infoslide} 
            onChange={e => set('infoslide', e.target.value)} 
            placeholder="Background information or definitions..." 
            style={{ 
              height: 70, 
              resize: 'vertical',
              border: '1px solid var(--border2)',
              borderRadius: 'var(--r)',
              background: 'var(--surface)',
              color: 'var(--text)',
              outline: 'none',
              padding: '6px 8px',
              fontFamily: 'inherit',
              fontSize: '.82rem'
            }}
          />
        </div>
        <div className="fg">
          <label>Round / Context *</label>
          <input value={f.round} onChange={e => set('round', e.target.value)} placeholder="e.g. Practice Round 1" />
        </div>

        {motionType === 'standalone' ? (
          <>
            <div className="fg">
              <label>Format</label>
              <select value={f.format} onChange={e => set('format', e.target.value)}>
                <option>BP</option>
                <option>AP</option>
                <option>None</option>
              </select>
            </div>
            <div className="fg">
              <label>Level</label>
              <select value={f.level} onChange={e => set('level', e.target.value)}>
                <option>None</option>
                <option>International</option>
                <option>National</option>
                <option>Regional</option>
                <option>Provincial</option>
                <option>University</option>
              </select>
            </div>
            <div className="fg">
              <label>Date (Optional)</label>
              <input type="date" value={f.date || ''} onChange={e => set('date', e.target.value)} />
            </div>
          </>
        ) : (
          <div className="fg span2" style={{
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r)',
            padding: '10px 14px',
            fontSize: '.76rem',
            color: 'var(--text3)'
          }}>
            ℹ️ This motion will inherit the Format, Level, and Date from the selected competition.
          </div>
        )}

        <div className="fg span2">
          <label>Tags (Select multiple from preset list)</label>
          <TagPicker value={f.tags || ''} onChange={val => set('tags', val)} />
        </div>
      </div>
      <div className="m-footer">
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSave}>
          {entry ? 'Save Changes' : 'Add Motion'}
        </button>
      </div>
    </Modal>
  );
}

function AdminMotions({ settings, saveSetting, toast, competitions, motions, refetch }) {
  const [showForm, setShowForm] = useState(false);
  const [editM, setEditM] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [migrating, setMigrating] = useState(false);

  const hasLegacyData = useMemo(() => {
    const standalones = settings.standalone_motions || [];
    const compMotions = settings.comp_motions || {};
    return standalones.length > 0 || Object.keys(compMotions).length > 0;
  }, [settings.standalone_motions, settings.comp_motions]);

  const runMigration = async () => {
    if (!window.confirm("This will migrate all legacy motions stored in app settings into the new relational table. Proceed?")) return;
    setMigrating(true);
    try {
      const standalones = settings.standalone_motions || [];
      const compMotions = settings.comp_motions || {};
      const payload = [];

      // 1. Map standalones
      standalones.forEach(m => {
        payload.push({
          motion: m.motion,
          infoslide: m.infoslide || '',
          round: m.round || 'Standalone',
          format: m.format || 'BP',
          level: m.level || 'None',
          date: m.date || null,
          tags: m.tags || '',
          competition_id: null
        });
      });

      // 2. Map competition motions
      Object.entries(compMotions).forEach(([compId, list]) => {
        list.forEach(m => {
          payload.push({
            motion: m.motion,
            infoslide: m.infoslide || '',
            round: m.round || 'Round',
            format: 'BP',
            level: 'None',
            date: null,
            tags: m.tags || '',
            competition_id: Number(compId)
          });
        });
      });

      // 3. Bulk insert to supabase
      if (payload.length > 0) {
        const { error } = await sb.from('motions').insert(payload);
        if (error) throw error;
      }

      // 4. Clear settings keys
      await saveSetting('standalone_motions', []);
      await saveSetting('comp_motions', {});
      
      toast('Migration completed! All legacy motions moved to the database.');
      if (refetch) await refetch();
    } catch (err) {
      alert('Migration failed: ' + err.message);
    } finally {
      setMigrating(false);
    }
  };

  const motionsList = useMemo(() => {
    return motions.map((m, idx) => {
      const comp = m.competition_id ? competitions.find(c => c.id === m.competition_id) : null;
      return {
        ...m,
        isStandalone: !m.competition_id,
        compId: m.competition_id,
        format: comp ? (comp.format || 'None') : (m.format || 'None'),
        level: comp ? (comp.level || 'None') : (m.level || 'None'),
        date: comp ? (comp.comp_date || '') : (m.date || ''),
        sourceLabel: comp ? `🏆 ${comp.code}` : 'Standalone',
        compName: comp ? comp.competition : ''
      };
    });
  }, [motions, competitions]);

  const addOrUpdate = async form => {
    try {
      if (form.isStandalone) {
        const payload = {
          motion: form.motion.trim(),
          infoslide: form.infoslide.trim(),
          round: form.round.trim(),
          format: form.format,
          level: form.level,
          date: form.date || null,
          tags: form.tags.split(',').map(t => t.trim()).filter(Boolean).join(', '),
          competition_id: null
        };

        if (editM) {
          const { error } = await sb.from('motions').update(payload).eq('id', editM.id);
          if (error) throw error;
          toast('Updated');
        } else {
          const { error } = await sb.from('motions').insert(payload);
          if (error) throw error;
          toast('Added');
        }
      } else {
        const payload = {
          motion: form.motion.trim(),
          infoslide: form.infoslide.trim(),
          round: form.round.trim(),
          format: 'BP',
          level: 'None',
          date: null,
          tags: form.tags.split(',').map(t => t.trim()).filter(Boolean).join(', '),
          competition_id: form.compId
        };

        if (editM) {
          const { error } = await sb.from('motions').update(payload).eq('id', editM.id);
          if (error) throw error;
          toast('Updated');
        } else {
          const { error } = await sb.from('motions').insert(payload);
          if (error) throw error;
          toast('Added');
        }
      }

      if (refetch) await refetch();
      setShowForm(false);
      setEditM(null);
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const del = async motionItem => {
    try {
      const { error } = await sb.from('motions').delete().eq('id', motionItem.id);
      if (error) throw error;
      toast('Deleted');
      if (refetch) await refetch();
      setConfirm(null);
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <div className="admin-content">
      {hasLegacyData && (
        <div style={{
          background: 'rgba(230, 184, 74, 0.08)',
          border: '1px solid rgba(230, 184, 74, 0.3)',
          borderRadius: 'var(--r2)',
          padding: '12px 18px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap'
        }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={{ fontWeight: 700, fontSize: '.85rem', color: 'var(--gold)', marginBottom: 3 }}>⚠️ Legacy Motions Data Detected</div>
            <div style={{ fontSize: '.75rem', color: 'var(--text2)' }}>
              You have motions stored in the old configuration format. Click migrate to move all standalone and competition-tied motions into the new database table structure.
            </div>
          </div>
          <button 
            className="btn btn-primary btn-sm" 
            onClick={runMigration} 
            disabled={migrating}
            style={{ background: 'var(--gold)', color: '#000', border: 'none' }}
          >
            {migrating ? 'Migrating...' : '🚀 Migrate Data'}
          </button>
        </div>
      )}

      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16,flexWrap:'wrap',gap:10}}>
        <div>
          <h2 style={{fontFamily:'Playfair Display,serif',fontSize:'1.25rem',marginBottom:2}}>Motions Archive</h2>
          <p style={{color:'var(--text3)',fontSize:'.78rem'}}>{motionsList.length} motion{motionsList.length !== 1 ? 's' : ''} in database</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => { setEditM(null); setShowForm(true); }}>+ Add Motion</button>
      </div>
      <div className="card">
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Round/Context</th>
                <th>Motion</th>
                <th>Type/Source</th>
                <th>Format</th>
                <th>Level</th>
                <th>Tags</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {motionsList.length === 0 && (
                <tr>
                   <td colSpan={8} style={{textAlign:'center',color:'var(--text3)',padding:36}}>
                    No motions yet. Click "+ Add Motion" to start.
                  </td>
                </tr>
              )}
              {motionsList.map((m, i) => (
                <tr key={m.id || i}>
                  <td style={{color:'var(--text3)',fontWeight:600,fontSize:'.72rem'}}>{i + 1}</td>
                  <td style={{fontWeight:600, fontSize:'.78rem', color:'var(--accent)', whiteSpace:'nowrap'}}>{m.round || '—'}</td>
                  <td style={{fontSize:'.82rem', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}} title={m.motion}>
                    {m.motion}
                  </td>
                  <td>
                    <span style={{
                      fontSize: '.68rem',
                      fontWeight: 700,
                      color: m.isStandalone ? 'var(--gold)' : 'var(--text2)',
                      background: m.isStandalone ? 'rgba(230, 184, 74, 0.08)' : 'var(--surface2)',
                      border: `1px solid ${m.isStandalone ? 'rgba(230, 184, 74, 0.2)' : 'var(--border)'}`,
                      padding: '2px 6px',
                      borderRadius: 4,
                      whiteSpace: 'nowrap'
                    }}>
                      {m.sourceLabel}
                    </span>
                  </td>
                  <td><span className={`badge ${m.format === 'BP' ? 'b-blue' : m.format === 'AP' ? 'b-purple' : 'b-gray'}`}>{m.format || 'None'}</span></td>
                  <td style={{fontSize:'.76rem'}}>{m.level || '—'}</td>
                  <td style={{maxWidth: 150, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize: '.72rem', color:'var(--text2)'}} title={m.tags}>
                    {m.tags || '—'}
                  </td>
                  <td>
                    <div style={{display:'flex',gap:4}}>
                      <button className="btn btn-outline btn-xs" onClick={() => { setEditM(m); setShowForm(true); }}>Edit</button>
                      <button className="btn btn-danger btn-xs" onClick={() => setConfirm(m)}>Del</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {showForm && <MotionForm entry={editM} competitions={competitions} onSave={addOrUpdate} onClose={() => { setShowForm(false); setEditM(null); }} />}
      {confirm && (
        <Modal title="Delete?" onClose={() => setConfirm(null)} sm>
          <p style={{color:'var(--text3)'}}>Remove this motion?</p>
          <div className="m-footer">
            <button className="btn btn-ghost" onClick={() => setConfirm(null)}>Cancel</button>
            <button className="btn btn-danger" onClick={() => del(confirm)}>Delete</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── ADMIN SHELL ──────────────────────────────────────────────────────────────
function AdminShell2({ onLogout, members, refetchMembers, competitions, refetchCompetitions, settings, saveSetting, boards, refetchBoards, hof, refetchHof, materials, refetchMaterials, info, saveInfo, motions, refetchMotions }) {
  const [section, setSection] = useState('dashboard');
  const [toast, toastEl] = useToast();
  const menu = [
    {sec:'OVERVIEW', items:[{key:'dashboard',icon:'📊',label:'Dashboard'}]},
    {sec:'DATA', items:[{key:'members',icon:'👥',label:'Members'},{key:'competitions',icon:'🏆',label:'Competitions'}]},
    {sec:'PAGES', items:[{key:'boards',icon:'🏛️',label:'Board'},{key:'materials',icon:'📚',label:'Study Materials'},{key:'motions',icon:'📜',label:'Motions'},{key:'hof',icon:'🌟',label:'Hall of Fame'},{key:'info',icon:'ℹ️',label:'Info Page'}]},
    {sec:'CONFIGURE', items:[{key:'settings',icon:'⚙️',label:'Settings'}]},
  ];
  return (
    <div className="admin-wrap">
      <div className="sidebar">
        <div className="sb-brand">
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <LogoIcon logoUrl={settings.logo_url} size={28} radius={7} />
            <div><div style={{fontWeight:700,fontSize:'.82rem'}}>{settings.org_name||'EDS UNIMA'}</div><div style={{fontSize:'.58rem',color:'var(--text3)',textTransform:'uppercase',letterSpacing:'.06em'}}>Admin</div></div>
          </div>
        </div>
        <div className="sb-nav">
          {menu.map(g=>(
            <div key={g.sec}>
              <div className="sb-section">{g.sec}</div>
              {g.items.map(m=>(
                <div key={m.key} className={`sb-item ${section===m.key?'on':''}`} onClick={()=>setSection(m.key)}>
                  <span className="sb-icon">{m.icon}</span>{m.label}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="sb-foot">
          <button className="btn btn-ghost btn-sm" style={{width:'100%',justifyContent:'center'}} onClick={onLogout}>← Exit Admin</button>
          <div style={{textAlign:'center',marginTop:10,fontSize:'.68rem',color:'rgba(139,144,168,.7)',letterSpacing:'.03em'}}>A Project by Christian Tendean</div>
        </div>
      </div>
      <div className="admin-main">
        {section==='dashboard' && <AdminDashboard members={members} competitions={competitions} materials={materials} />}
        {section==='members' && <AdminMembers members={members} refetch={refetchMembers} toast={toast} />}
        {section==='competitions' && <AdminCompetitions competitions={competitions} members={members} refetch={refetchCompetitions} toast={toast} settings={settings} saveSetting={saveSetting} refetchMotions={refetchMotions} />}
        {section==='boards' && <AdminBoards boards={boards} members={members} refetch={refetchBoards} toast={toast} />}
        {section==='materials' && <AdminStudyMaterials materials={materials} refetch={refetchMaterials} toast={toast} />}
        {section==='motions' && <AdminMotions settings={settings} saveSetting={saveSetting} toast={toast} competitions={competitions} motions={motions} refetch={refetchMotions} />}
        {section==='hof' && <AdminHallOfFame hof={hof} refetch={refetchHof} toast={toast} />}
        {section==='info' && <AdminInfoEditor info={info} saveInfo={saveInfo} toast={toast} />}
        {section==='settings' && <AdminSettings settings={settings} saveSetting={saveSetting} toast={toast} />}
      </div>
      {toastEl}
    </div>
  );
}

// ─── ADMIN MAIN APP ───────────────────────────────────────────────────────────
export default function Admin() {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const { members, loading: mLoad, refetch: refetchMembers } = useMembers();
  const { competitions, loading: cLoad, refetch: refetchCompetitions } = useCompetitions();
  const { motions, loading: motionsLoad, refetch: refetchMotions } = useMotions();
  const { settings, saveSetting } = useSettings();
  const { boards, refetch: refetchBoards } = useBoards();
  const { hof, refetch: refetchHof } = useHof();
  const { materials, refetch: refetchMaterials } = useStudyMaterials();
  const { info, saveInfo } = useInfoSettings();
  const { prefs } = useUserPrefs();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  if (authLoading) {
    return (
      <div className="loading-pg">
        <div className="spin"/>
        <p>Checking authorization...</p>
      </div>
    );
  }

  if (!session) {
    return <AdminLogin settings={settings} />;
  }

  if (mLoad || cLoad || motionsLoad) {
    return (
      <div className="loading-pg">
        <div className="spin"/>
        <p>Loading EDS UNIMA database…</p>
      </div>
    );
  }

  return (
    <AdminShell2 
      onLogout={handleLogout}
      members={members} 
      refetchMembers={refetchMembers}
      competitions={competitions} 
      refetchCompetitions={refetchCompetitions}
      settings={settings} 
      saveSetting={saveSetting}
      boards={boards} 
      refetchBoards={refetchBoards}
      hof={hof} 
      refetchHof={refetchHof}
      materials={materials}
      refetchMaterials={refetchMaterials}
      info={info} 
      saveInfo={saveInfo}
      motions={motions}
      refetchMotions={refetchMotions}
    />
  );
}
