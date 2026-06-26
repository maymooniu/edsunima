import { useState, useEffect, useRef, useMemo } from 'react';
import supabase from '../supabaseClient';
import * as XLSX from 'xlsx';

// ─── ACCENT COLORS MAP ───────────────────────────────────────────────────────
export const ACCENT_MAP = {
  blue:    ['#6c8fff','#a78bfa'],
  purple:  ['#a855f7','#7c3aed'],
  green:   ['#10b981','#34d399'],
  gold:    ['#e6b84a','#f5d080'],
  red:     ['#f87171','#fb923c'],
  orange:  ['#fb923c','#f59e0b'],
  teal:    ['#22d3ee','#0ea5e9'],
  magenta: ['#f472b6','#e879f9'],
};

export function applyAccent(id) {
  const [a1,a2] = ACCENT_MAP[id] || ACCENT_MAP.blue;
  document.documentElement.style.setProperty('--accent', a1);
  document.documentElement.style.setProperty('--accent2', a2);
}

// ─── EXPORT UTILITIES ────────────────────────────────────────────────────────
export function exportToExcel(sheetData, sheetName, fileName) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  const colWidths = sheetData[0].map((_, ci) => ({
    wch: Math.min(50, Math.max(10, ...sheetData.map(r => String(r[ci]||'').length)))
  }));
  ws['!cols'] = colWidths;
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, fileName);
}

export function exportDebaters(members) {
  const rows = [
    ['#','Full Name','Division','Rank','Class','Active Status','Competitions','Rounds','Breaking','Top Round'],
    ...members.map((m,i) => [
      i+1, m.full_name, m.division, m.rank,
      (m.classes||[]).join(', '), m.active_status,
      m.total_competitions||0, m.total_rounds||0, m.total_breaking||0,
      m.top_round||''
    ])
  ];
  exportToExcel(rows, 'Debaters', 'EDS_UNIMA_Debaters.xlsx');
}

export function exportMembership(members) {
  const nonAlumni = [...members]
    .filter(m=>!m.classes?.includes('Alumni')&&!m.classes?.includes('Ex'))
    .sort((a,b)=>(a.order_membership||9999)-(b.order_membership||9999));
  const rows = [
    ['#','Full Name','NIM','Course','Division','Membership Role','Rank','Class','Active Status','Email','WhatsApp'],
    ...nonAlumni.map((m,i) => [
      i+1, m.full_name, m.nim||'', m.course||'', m.division,
      m.membership_status||'Member', m.rank,
      (m.classes||[]).join(', '), m.active_status,
      m.email||'', m.whatsapp||''
    ])
  ];
  exportToExcel(rows, 'Membership', 'EDS_UNIMA_Membership.xlsx');
}

export function exportCompetitions(competitions) {
  const rows = [
    ['#','Code','Competition','Date','Organizer','Format','Type','Level','Results','Setting','Tabulation','Participants Count'],
    ...competitions.map((c,i) => [
      i+1, c.code, c.competition, c.comp_date||'',
      c.organizer||'', c.format, c.type, c.level,
      (c.results||[]).join('; '), c.setting||'',
      c.tabulation||'', (c.participants||[]).length
    ])
  ];
  exportToExcel(rows, 'Competitions', 'EDS_UNIMA_Competitions.xlsx');
}

export function exportAll(members, competitions) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Debaters
  const debRows = [
    ['#','Full Name','Division','Rank','Class','Status','Comps','Rounds','Breaks','Top Round'],
    ...members.map((m,i)=>[i+1,m.full_name,m.division,m.rank,(m.classes||[]).join(', '),m.active_status,m.total_competitions||0,m.total_rounds||0,m.total_breaking||0,m.top_round||''])
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(debRows);
  ws1['!cols'] = debRows[0].map((_,ci)=>({wch:Math.min(50,Math.max(10,...debRows.map(r=>String(r[ci]||'').length)))}));
  XLSX.utils.book_append_sheet(wb, ws1, 'Debaters');

  // Sheet 2: Membership
  const nonAlumni = [...members].filter(m=>!m.classes?.includes('Alumni')&&!m.classes?.includes('Ex')).sort((a,b)=>(a.order_membership||9999)-(b.order_membership||9999));
  const memRows = [
    ['#','Full Name','NIM','Course','Division','Role','Rank','Class','Status','Email','WhatsApp'],
    ...nonAlumni.map((m,i)=>[i+1,m.full_name,m.nim||'',m.course||'',m.division,m.membership_status||'Member',m.rank,(m.classes||[]).join(', '),m.active_status,m.email||'',m.whatsapp||''])
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(memRows);
  ws2['!cols'] = memRows[0].map((_,ci)=>({wch:Math.min(50,Math.max(10,...memRows.map(r=>String(r[ci]||'').length)))}));
  XLSX.utils.book_append_sheet(wb, ws2, 'Membership');

  // Sheet 3: Competitions
  const compRows = [
    ['#','Code','Competition','Date','Organizer','Format','Type','Level','Results','Setting','Tabulation'],
    ...competitions.map((c,i)=>[i+1,c.code,c.competition,c.comp_date||'',c.organizer||'',c.format,c.type,c.level,(c.results||[]).join('; '),c.setting||'',c.tabulation||''])
  ];
  const ws3 = XLSX.utils.aoa_to_sheet(compRows);
  ws3['!cols'] = compRows[0].map((_,ci)=>({wch:Math.min(50,Math.max(10,...compRows.map(r=>String(r[ci]||'').length)))}));
  XLSX.utils.book_append_sheet(wb, ws3, 'Competitions');

  XLSX.writeFile(wb, 'EDS_UNIMA_Database_Export.xlsx');
}

// ─── DATA HOOKS ──────────────────────────────────────────────────────────────
export function useMembers() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const fetch = async () => {
    const { data } = await supabase.from('members').select('*').order('order_debaters',{ascending:true});
    setMembers(data||[]); setLoading(false);
  };
  useEffect(() => {
    fetch();
    const ch = supabase.channel('m-ch').on('postgres_changes',{event:'*',schema:'public',table:'members'},fetch).subscribe();
    return () => supabase.removeChannel(ch);
  }, []);
  return { members, loading, refetch:fetch };
}

export function useCompetitions() {
  const [competitions, setCompetitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const fetch = async () => {
    const { data } = await supabase.from('competitions').select('*').order('order_index',{ascending:true});
    setCompetitions(data||[]); setLoading(false);
  };
  useEffect(() => {
    fetch();
    const ch = supabase.channel('c-ch').on('postgres_changes',{event:'*',schema:'public',table:'competitions'},fetch).subscribe();
    return () => supabase.removeChannel(ch);
  }, []);
  return { competitions, loading, refetch:fetch };
}

export function useSettings() {
  const defaults = { logo_url:'', theme:'dark', accent_color:'blue', compact_tables:false, show_stats_on_public:true, org_name:'EDS UNIMA', org_tagline:'Member Database', footer_text:'English Debating Society · Universitas Negeri Manado', maintenance_mode:false, allow_public_search:true, show_last_updated:true, table_striped:false, sidebar_compact:false, show_rank_icons:true, default_tab:'debaters', items_per_page:'50', show_member_photos:true };
  const [settings, setSettings] = useState(defaults);
  useEffect(() => {
    supabase.from('app_settings').select('*').then(({ data }) => {
      if (!data?.length) return;
      const map = {};
      data.forEach(r => { try { map[r.key] = JSON.parse(r.value); } catch { map[r.key] = r.value; } });
      setSettings(p => ({ ...p, ...map }));
    });
  }, []);
  const saveSetting = async (key, value) => {
    setSettings(p => ({ ...p, [key]: value }));
    await supabase.from('app_settings').upsert({ key, value: typeof value==='string'?value:JSON.stringify(value) });
  };
  return { settings, saveSetting };
}

export function useBoards() {
  const [boards, setBoards] = useState([]);
  const fetch = async () => { const { data } = await supabase.from('boards').select('*').order('sort_order',{ascending:true}); setBoards(data||[]); };
  useEffect(() => {
    fetch();
    const ch = supabase.channel('boards-ch').on('postgres_changes',{event:'*',schema:'public',table:'boards'},fetch).subscribe();
    return () => supabase.removeChannel(ch);
  }, []);
  return { boards, refetch: fetch };
}

export function useHof() {
  const [hof, setHof] = useState([]);
  const fetch = async () => { const { data } = await supabase.from('hall_of_fame').select('*').order('sort_order',{ascending:true}); setHof(data||[]); };
  useEffect(() => {
    fetch();
    const ch = supabase.channel('hof-ch').on('postgres_changes',{event:'*',schema:'public',table:'hall_of_fame'},fetch).subscribe();
    return () => supabase.removeChannel(ch);
  }, []);
  return { hof, refetch: fetch };
}

export function useStudyMaterials() {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const fetch = async () => { const { data } = await supabase.from('study_materials').select('*').order('sort_order',{ascending:true}); setMaterials(data||[]); setLoading(false); };
  useEffect(() => {
    fetch();
    const ch = supabase.channel('materials-ch').on('postgres_changes',{event:'*',schema:'public',table:'study_materials'},fetch).subscribe();
    return () => supabase.removeChannel(ch);
  }, []);
  return { materials, loading, refetch: fetch };
}

export function useMotions() {
  const [motions, setMotions] = useState([]);
  const [loading, setLoading] = useState(true);
  const fetch = async () => {
    const { data } = await supabase.from('motions').select('*').order('created_at', { ascending: false });
    setMotions(data || []);
    setLoading(false);
  };
  useEffect(() => {
    fetch();
    const ch = supabase.channel('motions-ch').on('postgres_changes', { event: '*', schema: 'public', table: 'motions' }, fetch).subscribe();
    return () => supabase.removeChannel(ch);
  }, []);
  return { motions, loading, refetch: fetch };
}

export function useInfoSettings() {
  const [info, setInfo] = useState({ org_about: 'A prestigious student organization at Universitas Negeri Manado that focuses on the proliferation of parliamentary debate.\n\nFlagship Project: Unima Debate League\n\nUniversitas Negeri Manado, Tondano, Sulawesi Utara, Indonesia' });
  useEffect(() => {
    supabase.from('app_settings').select('value').eq('key','info_content').single().then(({ data }) => {
      if (data?.value) { try { setInfo(JSON.parse(data.value)); } catch {} }
    });
  }, []);
  const saveInfo = async (newInfo) => {
    setInfo(newInfo);
    await supabase.from('app_settings').upsert({ key:'info_content', value: JSON.stringify(newInfo) });
  };
  return { info, saveInfo };
}

export function useUserPrefs() {
  const load = () => {
    try { return JSON.parse(localStorage.getItem('eds_user_prefs') || '{}'); } catch { return {}; }
  };
  const defaults = { theme:'dark', accent_color:'blue', compact_tables:false, show_rank_icons:true };
  const [prefs, setPrefs] = useState(() => ({ ...defaults, ...load() }));
  const setPref = (key, value) => {
    setPrefs(p => { const n = { ...p, [key]: value }; localStorage.setItem('eds_user_prefs', JSON.stringify(n)); return n; });
  };
  return { prefs, setPref };
}

// ─── DRAG REORDER HOOK ────────────────────────────────────────────────────────
export function useDragReorder(items, setItems, onSaveOrder) {
  const dragIdx = useRef(null);
  const [overIdx, setOverIdx] = useState(null);
  const onDragStart = (e,i) => { dragIdx.current=i; e.dataTransfer.effectAllowed='move'; };
  const onDragOver = (e,i) => { e.preventDefault(); setOverIdx(i); };
  const onDrop = (e,i) => {
    e.preventDefault();
    if (dragIdx.current===null||dragIdx.current===i){setOverIdx(null);return;}
    const arr=[...items]; const [m]=arr.splice(dragIdx.current,1); arr.splice(i,0,m);
    setItems(arr); onSaveOrder(arr); dragIdx.current=null; setOverIdx(null);
  };
  const onDragEnd = () => { dragIdx.current=null; setOverIdx(null); };
  return { onDragStart, onDragOver, onDrop, onDragEnd, isDragOver:i=>overIdx===i };
}
