import supabase from '../supabaseClient';

// Ranking priority for top_round calculation
const TOP_ROUND_WEIGHTS = {
  'Champion': 100,
  'Co-Champion': 99,
  'Grand Finalist': 90,
  'Finalist': 89,
  'Runner-up': 88,
  '2nd Place': 87,
  '3rd Place': 86,
  'Semifinalist': 70,
  'EFL Finalist': 65,
  'Novice Finalist': 60,
  'Quarterfinalist': 50,
  'Octofinalist': 40,
  'Pre-Octofinalist': 30,
  'Break Judge': 25,
  'Break': 20,
  'Participant': 1
};

export function getBreakStageWeight(stageStr) {
  if (!stageStr) return 0;
  const str = String(stageStr).trim();
  for (const [key, weight] of Object.entries(TOP_ROUND_WEIGHTS)) {
    if (key.toLowerCase() === str.toLowerCase() || str.toLowerCase().includes(key.toLowerCase())) {
      return weight;
    }
  }
  if (str.toLowerCase().includes('champ')) return 100;
  if (str.toLowerCase().includes('final')) return 89;
  if (str.toLowerCase().includes('semi')) return 70;
  if (str.toLowerCase().includes('quarter')) return 50;
  if (str.toLowerCase().includes('octo')) return 40;
  if (str.toLowerCase().includes('break')) return 20;
  return 5;
}

export function isBreakResult(p) {
  if (!p) return false;
  if (p.isBreak || p.is_break) return true;
  const res = (p.result || '').toLowerCase();
  const stage = (p.break_stage || '').toLowerCase();
  const keywords = ['champion', 'finalist', 'semifinalist', 'quarterfinalist', 'octofinalist', 'break', 'break judge', 'grandfinalist', 'runner-up', 'efl', 'novice'];
  return keywords.some(k => res.includes(k) || stage.includes(k));
}

export function computeMemberStats(member, competitions = []) {
  if (!member) return { total_competitions: 0, total_rounds: 0, total_breaking: 0, top_round: '-' };

  // Find all competitions where member participated
  const memberComps = competitions.filter(c => 
    (c.participants || []).some(p => String(p.memberId) === String(member.id))
  );

  let total_competitions = 0;
  let total_rounds = 0;
  let total_breaking = 0;
  let highestWeight = 0;
  let top_round = '';

  memberComps.forEach(c => {
    const p = (c.participants || []).find(p => String(p.memberId) === String(member.id));
    if (!p) return;

    total_competitions += 1;

    // Prelim rounds default to competition setting or 4 if not set
    const defaultRounds = c.prelim_rounds || 4;
    const roundsPlayed = p.rounds !== undefined && p.rounds !== null && p.rounds !== '' 
      ? Number(p.rounds) 
      : defaultRounds;
    
    total_rounds += isNaN(roundsPlayed) ? defaultRounds : roundsPlayed;

    // Check if member broke in this competition
    const broke = isBreakResult(p);
    if (broke) {
      total_breaking += 1;
    }

    // Evaluate top round / achievement
    const stage = p.break_stage || p.result || '';
    const weight = getBreakStageWeight(stage);
    if (weight > highestWeight) {
      highestWeight = weight;
      top_round = stage.trim();
    }
  });

  return {
    total_competitions,
    total_rounds,
    total_breaking,
    top_round: top_round || (total_breaking > 0 ? 'Break' : (total_competitions > 0 ? 'Participant' : '-'))
  };
}

export async function syncAllMemberStats(members, competitions) {
  if (!members || !members.length) return;
  
  const updates = [];
  for (const m of members) {
    const computed = computeMemberStats(m, competitions);
    if (
      m.total_competitions !== computed.total_competitions ||
      m.total_rounds !== computed.total_rounds ||
      m.total_breaking !== computed.total_breaking ||
      m.top_round !== computed.top_round
    ) {
      updates.push({
        id: m.id,
        total_competitions: computed.total_competitions,
        total_rounds: computed.total_rounds,
        total_breaking: computed.total_breaking,
        top_round: computed.top_round
      });
    }
  }

  if (updates.length > 0) {
    for (const u of updates) {
      await supabase.from('members').update({
        total_competitions: u.total_competitions,
        total_rounds: u.total_rounds,
        total_breaking: u.total_breaking,
        top_round: u.top_round
      }).eq('id', u.id);
    }
  }
}
