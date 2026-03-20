
const leagueDefs = [
  { id: 'all', label: 'Todas as ligas', espn: null },
  { id: 'bra.1', label: 'Brasileirão Série A', espn: 'bra.1' },
  { id: 'eng.1', label: 'Premier League', espn: 'eng.1' },
  { id: 'esp.1', label: 'La Liga', espn: 'esp.1' },
  { id: 'ita.1', label: 'Serie A Itália', espn: 'ita.1' },
  { id: 'ger.1', label: 'Bundesliga', espn: 'ger.1' },
  { id: 'fra.1', label: 'Ligue 1', espn: 'fra.1' },
  { id: 'uefa.champions', label: 'Champions League', espn: 'uefa.champions' },
];

let deferredPrompt = null;
let selectedRange = 'today';
let selectedLeagues = new Set(['bra.1']);
let loadedGames = [];
let selectedGameIds = new Set();
let analyses = [];

const els = {
  leagueChips: document.getElementById('leagueChips'),
  gamesContainer: document.getElementById('gamesContainer'),
  analysisContainer: document.getElementById('analysisContainer'),
  bingaoContainer: document.getElementById('bingaoContainer'),
  refreshBtn: document.getElementById('refreshBtn'),
  analyzeBtn: document.getElementById('analyzeBtn'),
  buildBingaoBtn: document.getElementById('buildBingaoBtn'),
  gamesLoaded: document.getElementById('gamesLoaded'),
  gamesSelected: document.getElementById('gamesSelected'),
  bestCount: document.getElementById('bestCount'),
  bingaoCount: document.getElementById('bingaoCount'),
  loadStatus: document.getElementById('loadStatus'),
  fdToken: document.getElementById('fdToken'),
  advToken: document.getElementById('advToken'),
  saveSettingsBtn: document.getElementById('saveSettingsBtn'),
  installBtn: document.getElementById('installBtn'),
  bingaoProfile: document.getElementById('bingaoProfile'),
  bingaoSize: document.getElementById('bingaoSize'),
};

init();

function init(){
  renderLeagueChips();
  bindEvents();
  loadSettings();
  loadMatches();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  }
}

function bindEvents(){
  document.querySelectorAll('.pill').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.querySelectorAll('.pill').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      selectedRange = btn.dataset.range;
    });
  });
  els.refreshBtn.addEventListener('click', loadMatches);
  els.analyzeBtn.addEventListener('click', analyzeSelected);
  els.buildBingaoBtn.addEventListener('click', buildBingao);
  els.saveSettingsBtn.addEventListener('click', saveSettings);

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    els.installBtn.classList.remove('hidden');
  });
  els.installBtn.addEventListener('click', async ()=>{
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    els.installBtn.classList.add('hidden');
  });
}

function loadSettings(){
  const saved = JSON.parse(localStorage.getItem('xtips_settings') || '{}');
  els.fdToken.value = saved.fdToken || '';
  els.advToken.value = saved.advToken || '';
}
function saveSettings(){
  localStorage.setItem('xtips_settings', JSON.stringify({
    fdToken: els.fdToken.value.trim(),
    advToken: els.advToken.value.trim(),
  }));
  toast('Tokens salvos no aparelho.');
}

function renderLeagueChips(){
  els.leagueChips.innerHTML = '';
  leagueDefs.forEach(lg=>{
    const btn = document.createElement('button');
    btn.className = 'chip' + (selectedLeagues.has(lg.id) ? ' active' : '');
    btn.textContent = lg.label;
    btn.addEventListener('click', ()=>{
      if (lg.id === 'all'){
        if (selectedLeagues.has('all')){
          selectedLeagues.delete('all');
          selectedLeagues = new Set(['bra.1']);
        } else {
          selectedLeagues = new Set(['all']);
        }
      } else {
        selectedLeagues.delete('all');
        if (selectedLeagues.has(lg.id)) selectedLeagues.delete(lg.id);
        else selectedLeagues.add(lg.id);
        if (!selectedLeagues.size) selectedLeagues.add('bra.1');
      }
      renderLeagueChips();
    });
    els.leagueChips.appendChild(btn);
  });
}

function getSelectedLeagueCodes(){
  if (selectedLeagues.has('all')) return leagueDefs.filter(l=>l.espn).map(l=>l.espn);
  return [...selectedLeagues];
}

function getDateList(){
  const now = new Date();
  const dates = [];
  const span = selectedRange === 'today' ? 1 : selectedRange === 'tomorrow' ? 1 : selectedRange === 'week' ? 7 : 30;
  const offset = selectedRange === 'tomorrow' ? 1 : 0;
  for (let i = 0; i < span; i++){
    const d = new Date(now);
    d.setDate(now.getDate() + offset + i);
    dates.push(formatDateESPN(d));
  }
  return dates;
}
function formatDateESPN(d){
  return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
}
function niceDate(iso){
  try{
    const dt = new Date(iso);
    return dt.toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
  } catch {
    return iso;
  }
}

async function loadMatches(){
  els.loadStatus.textContent = 'Carregando jogos reais...';
  els.gamesContainer.innerHTML = '<div class="empty-state">Carregando...</div>';
  loadedGames = [];
  selectedGameIds = new Set();
  updateCounters();

  const leagues = getSelectedLeagueCodes();
  const dates = getDateList();
  const reqs = [];
  for (const league of leagues){
    for (const date of dates){
      const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/scoreboard?dates=${date}&limit=300`;
      reqs.push(fetchJson(url).then(data => ({ league, date, data })).catch(() => null));
    }
  }
  const results = await Promise.all(reqs);
  const games = [];
  for (const item of results){
    if (!item || !item.data || !Array.isArray(item.data.events)) continue;
    for (const ev of item.data.events){
      const comp = ev.competitions?.[0];
      const home = comp?.competitors?.find(c => c.homeAway === 'home');
      const away = comp?.competitors?.find(c => c.homeAway === 'away');
      if (!home || !away) continue;
      games.push({
        id: ev.id,
        league: item.league,
        leagueLabel: leagueDefs.find(l=>l.espn===item.league)?.label || item.league,
        date: ev.date,
        status: ev.status?.type?.description || 'Agendado',
        detail: ev.status?.type?.detail || '',
        venue: comp?.venue?.fullName || '',
        home: home.team?.displayName || home.team?.shortDisplayName || 'Mandante',
        away: away.team?.displayName || away.team?.shortDisplayName || 'Visitante',
        homeRecord: extractRecord(home),
        awayRecord: extractRecord(away),
        headline: `${home.team?.shortDisplayName || home.team?.displayName} x ${away.team?.shortDisplayName || away.team?.displayName}`,
      });
    }
  }
  loadedGames = dedupeGames(games).sort((a,b)=> new Date(a.date) - new Date(b.date));
  renderGames();
  els.loadStatus.textContent = loadedGames.length ? `${loadedGames.length} jogo(s) carregado(s) com dados reais.` : 'Nenhum jogo encontrado para o filtro.';
  updateCounters();
}

function dedupeGames(arr){
  const seen = new Set();
  return arr.filter(g=>{
    if (seen.has(g.id)) return false;
    seen.add(g.id);
    return true;
  });
}

function extractRecord(competitor){
  const rec = competitor.records?.[0]?.summary || '';
  const parts = rec.split('-').map(x => parseInt(x,10)).filter(Number.isFinite);
  let ppg = null;
  if (parts.length >= 3){
    const [w,d,l] = parts;
    const played = w+d+l;
    ppg = played ? ((w*3 + d)/played) : null;
  }
  return { summary: rec, ppg };
}

function renderGames(){
  if (!loadedGames.length){
    els.gamesContainer.innerHTML = '<div class="empty-state">Sem jogos para esse filtro.</div>';
    return;
  }
  els.gamesContainer.innerHTML = '';
  loadedGames.forEach(game=>{
    const card = document.createElement('article');
    card.className = 'game-card' + (selectedGameIds.has(game.id) ? ' selected':'');
    card.innerHTML = `
      <div class="game-top">
        <div>
          <h3 class="game-title">${escapeHtml(game.home)} x ${escapeHtml(game.away)}</h3>
          <div class="game-meta">${escapeHtml(game.leagueLabel)}</div>
        </div>
        <span class="badge">${escapeHtml(game.status)}</span>
      </div>
      <div class="game-rows">
        <div class="game-meta">Data: ${niceDate(game.date)}</div>
        <div class="game-meta">Mandante: ${escapeHtml(game.homeRecord.summary || 'sem record')}</div>
        <div class="game-meta">Visitante: ${escapeHtml(game.awayRecord.summary || 'sem record')}</div>
        ${game.venue ? `<div class="game-meta">Estádio: ${escapeHtml(game.venue)}</div>` : ''}
      </div>
    `;
    card.addEventListener('click', ()=>{
      if (selectedGameIds.has(game.id)) selectedGameIds.delete(game.id);
      else selectedGameIds.add(game.id);
      renderGames();
      updateCounters();
    });
    els.gamesContainer.appendChild(card);
  });
}

function analyzeSelected(){
  const selected = loadedGames.filter(g => selectedGameIds.has(g.id));
  if (!selected.length){
    toast('Selecione ao menos um jogo.');
    return;
  }
  analyses = selected.map(analyzeGame).sort((a,b)=> b.score - a.score);
  renderAnalyses();
  updateCounters();
}

function analyzeGame(game){
  const homePPG = game.homeRecord.ppg ?? 1.4;
  const awayPPG = game.awayRecord.ppg ?? 1.2;
  const diff = homePPG - awayPPG;
  const abs = Math.abs(diff);
  const picks = [];
  let score = 72;

  if (diff > 0.55){
    picks.push(makePick('Dupla chance FT', `${game.home} ou empate (1X)`, 84, 'Mandante chega com força relativa superior pelo record recente/temporada.'));
    picks.push(makePick('Gols FT', 'Mais de 1.5 gols', 80, 'Cenário favorece pressão do time da casa e pelo menos 2 gols no jogo.'));
    score += 10;
  } else if (diff < -0.55){
    picks.push(makePick('Dupla chance FT', `${game.away} ou empate (X2)`, 82, 'Visitante chega mais forte pelo record recente/temporada.'));
    picks.push(makePick('Gols FT', 'Mais de 1.5 gols', 78, 'Diferença de força sugere pelo menos dois gols ao longo da partida.'));
    score += 8;
  } else {
    picks.push(makePick('Gols FT', 'Menos de 3.5 gols', 79, 'Confronto equilibrado costuma favorecer linha total mais controlada.'));
    picks.push(makePick('Resultado FT', 'Empate anula aposta no mandante', 71, 'Jogo sem grande desequilíbrio e com mando leve a favor do time da casa.'));
  }

  if (abs < 0.2){
    picks.push(makePick('BTTS FT', 'Sim', 67, 'Equilíbrio entre forças aumenta chance de ambos marcarem.'));
    picks.push(makePick('1T', 'Menos de 1.5 gols no 1º tempo', 76, 'Partida equilibrada tende a começar mais estudada.'));
  } else {
    picks.push(makePick('1T', 'Mais de 0.5 gol no 1º tempo', 73, 'Desequilíbrio relativo aumenta chance de pressão inicial.'));
  }

  picks.push(makePick('Mercados avançados', 'Cartões, escanteios e chutes: feed premium necessário', 0, 'Sem dados avançados confiáveis nesta instalação.'));

  return {
    id: game.id,
    title: `${game.home} x ${game.away}`,
    leagueLabel: game.leagueLabel,
    score: Math.max(60, Math.min(score, 93)),
    picks,
    summary: diff > 0.35 ? 'Tendência favorável ao mandante.' : diff < -0.35 ? 'Tendência favorável ao visitante.' : 'Confronto equilibrado.',
  };
}

function makePick(market, suggestion, confidence, why){
  return { market, suggestion, confidence, why };
}

function renderAnalyses(){
  if (!analyses.length){
    els.analysisContainer.className = 'analysis-list empty-state';
    els.analysisContainer.textContent = 'Nenhuma análise ainda.';
    return;
  }
  els.analysisContainer.className = 'analysis-list';
  els.analysisContainer.innerHTML = '';
  analyses.forEach(item=>{
    const card = document.createElement('article');
    card.className = 'analysis-card';
    card.innerHTML = `
      <h3>${escapeHtml(item.title)}</h3>
      <div class="game-meta">${escapeHtml(item.leagueLabel)} · ${escapeHtml(item.summary)}</div>
      <div class="score">Confiança geral ${item.score}/100</div>
      <div class="pick-list">
        ${item.picks.map(p=>`
          <div class="pick-item">
            <strong>${escapeHtml(p.market)} — ${escapeHtml(p.suggestion)}</strong>
            <div class="game-meta">${p.confidence ? `Confiança ${p.confidence}/100 · ` : ''}${escapeHtml(p.why)}</div>
          </div>
        `).join('')}
      </div>
    `;
    els.analysisContainer.appendChild(card);
  });
}

function buildBingao(){
  if (!analyses.length){
    toast('Analise os jogos antes de montar o Bingão.');
    return;
  }
  const profile = els.bingaoProfile.value;
  const size = parseInt(els.bingaoSize.value, 10);

  let confidenceFloor = 75;
  if (profile === 'agressivo') confidenceFloor = 66;
  if (profile === 'conservador') confidenceFloor = 79;

  const picks = [];
  analyses.forEach(analysis=>{
    const eligible = analysis.picks
      .filter(p => p.confidence >= confidenceFloor)
      .slice(0, 2)
      .map(p => ({ ...p, game: analysis.title, score: p.confidence + (analysis.score * 0.2) }));
    picks.push(...eligible);
  });

  const finalPicks = picks.sort((a,b)=> b.score - a.score).slice(0, size);
  if (!finalPicks.length){
    els.bingaoContainer.className = 'analysis-list empty-state';
    els.bingaoContainer.textContent = 'Nenhuma combinação atingiu o filtro atual.';
    updateCounters();
    return;
  }

  els.bingaoContainer.className = 'analysis-list';
  els.bingaoContainer.innerHTML = `
    <article class="analysis-card">
      <h3>Bingão do Xandão</h3>
      <div class="game-meta">Perfil ${profile} · ${finalPicks.length} seleção(ões)</div>
      <div class="pick-list">
        ${finalPicks.map((p, idx)=>`
          <div class="pick-item">
            <strong>${idx+1}. ${escapeHtml(p.game)}</strong>
            <div>${escapeHtml(p.market)} — ${escapeHtml(p.suggestion)}</div>
            <div class="game-meta">Confiança ${p.confidence}/100</div>
          </div>
        `).join('')}
      </div>
    </article>
  `;
  updateCounters(finalPicks.length);
}

function updateCounters(bingaoNum = null){
  els.gamesLoaded.textContent = String(loadedGames.length);
  els.gamesSelected.textContent = String(selectedGameIds.size);
  els.bestCount.textContent = String(analyses.length);
  if (bingaoNum !== null) els.bingaoCount.textContent = String(bingaoNum);
}

async function fetchJson(url){
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!res.ok) throw new Error('Falha na API');
  return res.json();
}

function toast(text){
  const el = document.createElement('div');
  el.textContent = text;
  el.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:22px;background:#071a2b;border:1px solid rgba(0,245,176,.25);color:#fff;padding:12px 16px;border-radius:14px;z-index:9999;box-shadow:0 14px 40px rgba(0,0,0,.35)';
  document.body.appendChild(el);
  setTimeout(()=>el.remove(), 2200);
}
function escapeHtml(str=''){
  return String(str).replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
}
