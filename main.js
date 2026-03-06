const CONFIG = {
  TMDB_KEY: 'f5ac0b3500a28ee145b8821abe874c7e',
  OMDB_KEY: 'd4e88f94',
  TMDB_BASE: 'https://api.themoviedb.org/3',
  OMDB_BASE: 'https://www.omdbapi.com/',
  IMG_URL: 'https://image.tmdb.org/t/p/w500',
  LANG: localStorage.getItem('movielotto-lang') || 'ko-KR',
  THEME: localStorage.getItem('movielotto-theme') || 'dark'
};

const UI_TEXT = {
  'ko-KR': { 
    draw: '다음 영화 뽑기', 
    drawing: '추첨 중...',
    loading: '데이터 로딩 중...',
    error: '다시 시도해주세요',
    noInfo: '정보 없음', 
    defaultTitle: '무비 로또', 
    defaultSubtitle: '오늘 밤, 당신을 기다리는 단 하나의 영화',
    defaultDesc: '추첨 버튼을 눌러 당신의 운명적인 영화를 찾아보세요.',
    shareTitle: '무비 로또 결과!',
    shareMsg: '오늘 밤 제가 볼 운명의 영화는 [TITLE] 입니다! 함께 보실래요?',
    copied: '링크가 복사되었습니다!'
  },
  'en-US': { 
    draw: 'Next Movie', 
    drawing: 'Drawing...',
    loading: 'Loading...',
    error: 'Please try again',
    noInfo: 'No info', 
    defaultTitle: 'MOVIE LOTTO', 
    defaultSubtitle: 'Tonight, the one and only movie waiting for you',
    defaultDesc: 'Tap the button to find your masterpiece.',
    shareTitle: 'Movie Lotto Result!',
    shareMsg: 'My destiny movie for tonight is [TITLE]! Want to watch together?',
    copied: 'Link copied to clipboard!'
  }
};

let allMovies = [];
let genres = [];
let selectedGenre = null;
let currentMovie = null;
let viewedIds = new Set();
let isRolling = false;

async function init() {
  applyTheme();
  applyLanguage();
  await Promise.all([fetchGenres(), fetchData()]);
  renderGenres();
}

async function fetchGenres() {
  try {
    const res = await fetch(`${CONFIG.TMDB_BASE}/genre/movie/list?api_key=${CONFIG.TMDB_KEY}&language=${CONFIG.LANG}`).then(r => r.json());
    genres = res.genres || [];
  } catch (e) { console.error('Genre fetch error:', e); }
}

function renderGenres() {
  const container = document.getElementById('genre-filter');
  const allLabel = CONFIG.LANG === 'ko-KR' ? '전체' : 'All';
  
  container.innerHTML = `<div class="genre-chip ${!selectedGenre ? 'active' : ''}" onclick="selectGenre(null)">${allLabel}</div>`;
  genres.forEach(g => {
    container.innerHTML += `<div class="genre-chip ${selectedGenre === g.id ? 'active' : ''}" onclick="selectGenre(${g.id})">${g.name}</div>`;
  });
}

function selectGenre(id) {
  if (isRolling) return;
  selectedGenre = id;
  renderGenres();
  fetchData();
}

async function fetchData() {
  const btn = document.getElementById('draw-btn');
  const originalText = UI_TEXT[CONFIG.LANG].draw;
  btn.disabled = true;
  btn.textContent = UI_TEXT[CONFIG.LANG].loading;

  try {
    const pages = [1, 2, 3]; // Increased focus for faster loading with filters
    let url = `${CONFIG.TMDB_BASE}/movie/popular?api_key=${CONFIG.TMDB_KEY}&language=${CONFIG.LANG}`;
    if (selectedGenre) {
      url = `${CONFIG.TMDB_BASE}/discover/movie?api_key=${CONFIG.TMDB_KEY}&language=${CONFIG.LANG}&with_genres=${selectedGenre}&sort_by=popularity.desc`;
    }

    const fetchPromises = pages.map(p => fetch(`${url}&page=${p}`).then(r => r.json()));
    const results = await Promise.all(fetchPromises);
    
    allMovies = results.flatMap(r => r.results).filter(m => m.vote_average >= 6.0 && m.poster_path);
    allMovies.sort(() => Math.random() - 0.5);
  } catch (e) { 
    console.error('Fetch error:', e);
    btn.textContent = UI_TEXT[CONFIG.LANG].error;
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

async function startDraw() {
  if (isRolling || allMovies.length === 0) return;
  
  const pool = allMovies.filter(m => !viewedIds.has(m.id));
  if (pool.length === 0) { viewedIds.clear(); return startDraw(); }

  isRolling = true;
  document.getElementById('draw-btn').disabled = true;
  document.getElementById('draw-btn').textContent = UI_TEXT[CONFIG.LANG].drawing;
  document.getElementById('share-bar').classList.remove('visible');
  
  // Reset Card Flip State
  const container = document.getElementById('poster-container');
  container.classList.remove('flipped');
  document.getElementById('slot-layer').style.display = 'flex';

  // Slot Animation
  const samples = [];
  for(let i=0; i<15; i++) samples.push(pool[Math.floor(Math.random() * pool.length)]);
  
  const track = document.getElementById('slot-track');
  track.style.transform = 'translateY(0)';
  track.innerHTML = samples.map(m => `
    <div class="h-[120px] w-[80px] flex-shrink-0">
      <img src="${CONFIG.IMG_URL}${m.poster_path}" class="w-full h-full object-cover rounded-lg">
    </div>
  `).join('');

  let step = 0;
  const totalSteps = 15 + Math.floor(Math.random() * 10);
  
  const animate = () => {
    step++;
    track.style.transform = `translateY(-${(step % samples.length) * 120}px)`;
    if (step < totalSteps) {
      setTimeout(animate, 50 + (step * 15));
    } else {
      currentMovie = samples[step % samples.length];
      viewedIds.add(currentMovie.id);
      finishDraw();
    }
  };
  animate();
}

async function finishDraw() {
  if (!currentMovie) return;
  const details = await getExtraInfo(currentMovie);
  renderUI(currentMovie, details);
  
  setTimeout(() => {
    document.getElementById('slot-layer').style.display = 'none';
    document.getElementById('poster-container').classList.add('flipped'); // Trigger Flip Animation
    
    setTimeout(() => {
      document.getElementById('draw-btn').disabled = false;
      document.getElementById('draw-btn').textContent = UI_TEXT[CONFIG.LANG].draw;
      document.getElementById('share-bar').classList.add('visible');
      isRolling = false;
    }, 800); // Wait for flip animation
  }, 400);
}

function renderUI(movie, details) {
  document.getElementById('res-poster').src = CONFIG.IMG_URL + movie.poster_path;
  document.getElementById('res-title').textContent = movie.title;
  document.getElementById('res-desc').textContent = movie.overview || UI_TEXT[CONFIG.LANG].noInfo;

  const metaRow = document.getElementById('badge-row-meta');
  metaRow.innerHTML = '';
  
  const providers = [...(details.flatrate || []), ...(details.rent || []), ...(details.buy || [])];
  const uniqueProviders = Array.from(new Map(providers.map(p => [p.provider_id, p])).values()).slice(0, 4);
  
  uniqueProviders.forEach(p => {
    metaRow.innerHTML += `
      <div class="flex flex-col items-center gap-1">
        <img src="https://image.tmdb.org/t/p/original${p.logo_path}" class="w-8 h-8 rounded-lg border border-white/50 shadow-sm">
        <span class="text-[8px] font-bold opacity-60">${p.provider_name}</span>
      </div>`;
  });

  document.getElementById('badge-row-scores').innerHTML = `
    <span class="sticker-badge">TMDB ${movie.vote_average.toFixed(1)}</span>
    <span class="sticker-badge">IMDb ${details.imdb || '--'}</span>
    <span class="sticker-badge">Rotten ${details.rt || '--'}</span>
  `;
}

async function getExtraInfo(movie) {
  try {
    const [ext, watch] = await Promise.all([
      fetch(`${CONFIG.TMDB_BASE}/movie/${movie.id}/external_ids?api_key=${CONFIG.TMDB_KEY}`).then(r => r.json()),
      fetch(`${CONFIG.TMDB_BASE}/movie/${movie.id}/watch/providers?api_key=${CONFIG.TMDB_KEY}`).then(r => r.json())
    ]);
    let imdb = null, rt = null;
    if (ext.imdb_id) {
      const omdb = await fetch(`${CONFIG.OMDB_BASE}?i=${ext.imdb_id}&apikey=${CONFIG.OMDB_KEY}`).then(r => r.json());
      if (omdb.Response === 'True') {
        imdb = omdb.imdbRating;
        rt = omdb.Ratings?.find(r => r.Source === 'Rotten Tomatoes')?.Value;
      }
    }
    const krWatch = watch.results?.KR || {};
    return { 
      imdbId: ext.imdb_id, imdb, rt,
      flatrate: krWatch.flatrate || [], rent: krWatch.rent || [], buy: krWatch.buy || []
    };
  } catch (e) { return { flatrate: [], rent: [], buy: [] }; }
}

function shareResult(type) {
  if (!currentMovie) return;
  const msg = UI_TEXT[CONFIG.LANG].shareMsg.replace('[TITLE]', currentMovie.title);
  const url = window.location.href;

  if (type === 'kakao' || (type === 'link' && navigator.share)) {
    if (navigator.share) {
      navigator.share({ title: UI_TEXT[CONFIG.LANG].shareTitle, text: msg, url: url }).catch(() => {});
    } else {
      copyToClipboard(url + " - " + msg);
    }
  } else {
    copyToClipboard(url + " - " + msg);
  }
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    alert(UI_TEXT[CONFIG.LANG].copied);
  });
}

function toggleTheme() { 
  CONFIG.THEME = CONFIG.THEME === 'light' ? 'dark' : 'light'; 
  localStorage.setItem('movielotto-theme', CONFIG.THEME); 
  applyTheme(); 
}

function applyTheme() { 
  document.body.classList.toggle('dark-mode', CONFIG.THEME === 'dark'); 
  document.getElementById('theme-icon').textContent = CONFIG.THEME === 'dark' ? '☀️' : '🌙'; 
}

function applyLanguage() { 
  const t = UI_TEXT[CONFIG.LANG]; 
  document.getElementById('draw-btn').textContent = isRolling ? t.drawing : t.draw; 
  document.getElementById('res-subtitle').textContent = t.defaultSubtitle;
  if(!currentMovie) { 
    document.getElementById('res-title').textContent = t.defaultTitle; 
    document.getElementById('res-desc').textContent = t.defaultDesc; 
  } 
  renderGenres();
}

async function toggleLanguage() { 
  if (isRolling) return;
  CONFIG.LANG = CONFIG.LANG === 'ko-KR' ? 'en-US' : 'ko-KR'; 
  localStorage.setItem('movielotto-lang', CONFIG.LANG); 
  applyLanguage(); 
  await Promise.all([fetchGenres(), fetchData()]); 
  renderGenres();
}

function resetApp() {
  if (isRolling) return;
  document.getElementById('poster-container').classList.remove('flipped');
  document.getElementById('slot-layer').style.display = 'flex';
  document.getElementById('res-title').textContent = UI_TEXT[CONFIG.LANG].defaultTitle;
  document.getElementById('res-desc').textContent = UI_TEXT[CONFIG.LANG].defaultDesc;
  document.getElementById('badge-row-meta').innerHTML = '';
  document.getElementById('badge-row-scores').innerHTML = '<span class="sticker-badge">TMDB --</span><span class="sticker-badge">IMDb --</span><span class="sticker-badge">Rotten --</span>';
  document.getElementById('share-bar').classList.remove('visible');
  currentMovie = null;
}

// Global exposure
window.startDraw = startDraw;
window.toggleTheme = toggleTheme;
window.toggleLanguage = toggleLanguage;
window.resetApp = resetApp;
window.selectGenre = selectGenre;
window.shareResult = shareResult;

init();
