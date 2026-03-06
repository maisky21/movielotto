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
    defaultDesc: '추첨 버튼을 눌러 당신의 운명적인 영화를 찾아보세요.' 
  },
  'en-US': { 
    draw: 'Next Movie', 
    drawing: 'Drawing...',
    loading: 'Loading...',
    error: 'Please try again',
    noInfo: 'No info', 
    defaultTitle: 'MOVIE LOTTO', 
    defaultSubtitle: 'Tonight, the one and only movie waiting for you',
    defaultDesc: 'Tap the button to find your masterpiece.' 
  }
};

let allMovies = [];
let currentMovie = null;
let viewedIds = new Set();
let isRolling = false;

async function init() {
  applyTheme();
  applyLanguage();
  await fetchData();
  // Initial draw removed to wait for user interaction or better control
  // startDraw(); 
}

async function fetchData() {
  const btn = document.getElementById('draw-btn');
  const originalText = UI_TEXT[CONFIG.LANG].draw;
  btn.disabled = true;
  btn.textContent = UI_TEXT[CONFIG.LANG].loading;

  try {
    const pages = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const fetchPromises = pages.map(p => 
      fetch(`${CONFIG.TMDB_BASE}/movie/popular?api_key=${CONFIG.TMDB_KEY}&language=${CONFIG.LANG}&page=${p}`)
        .then(r => {
          if (!r.ok) throw new Error(`HTTP error! status: ${r.status}`);
          return r.json();
        })
    );
    
    const results = await Promise.all(fetchPromises);
    allMovies = results.flatMap(r => r.results).filter(m => m.vote_count >= 100 && m.vote_average >= 6.0);
    
    if (allMovies.length === 0) {
      // Fallback: If no movies meet criteria, just use whatever we got
      allMovies = results.flatMap(r => r.results);
    }
    
    allMovies.sort(() => Math.random() - 0.5);
    console.log(`Fetched ${allMovies.length} movies`);
  } catch (e) { 
    console.error('Fetch error:', e);
    btn.textContent = UI_TEXT[CONFIG.LANG].error;
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

async function startDraw() {
  if (isRolling) return;
  
  const btn = document.getElementById('draw-btn');
  
  if (allMovies.length === 0) {
    await fetchData();
    if (allMovies.length === 0) return;
  }

  const pool = allMovies.filter(m => !viewedIds.has(m.id));
  if (pool.length === 0) { 
    viewedIds.clear(); 
    return startDraw(); 
  }

  isRolling = true;
  btn.disabled = true;
  btn.textContent = UI_TEXT[CONFIG.LANG].drawing;
  
  document.getElementById('slot-layer').style.display = 'flex';
  document.getElementById('res-poster').classList.add('opacity-0');

  const samples = [];
  for(let i=0; i<15; i++) samples.push(pool[Math.floor(Math.random() * pool.length)]);
  
  const track = document.getElementById('slot-track');
  track.style.transform = 'translateY(0)';
  track.innerHTML = samples.map(m => `
    <div class="h-[100px] w-[70px] flex-shrink-0">
      <img src="${m.poster_path ? CONFIG.IMG_URL + m.poster_path : 'https://via.placeholder.com/70x100?text=No+Image'}" 
           class="w-full h-full object-cover rounded-lg"
           onerror="this.src='https://via.placeholder.com/70x100?text=No+Image'">
    </div>
  `).join('');

  let step = 0;
  const totalSteps = 20 + Math.floor(Math.random() * 10);
  
  const animate = () => {
    step++;
    track.style.transform = `translateY(-${(step % samples.length) * 100}px)`;
    if (step < totalSteps) {
      setTimeout(animate, 50 + (step * 10));
    } else {
      currentMovie = samples[step % samples.length];
      viewedIds.add(currentMovie.id);
      finishDraw();
    }
  };
  animate();
}

async function finishDraw() {
  if (!currentMovie) {
    isRolling = false;
    document.getElementById('draw-btn').disabled = false;
    document.getElementById('draw-btn').textContent = UI_TEXT[CONFIG.LANG].draw;
    return;
  }

  try {
    const details = await getExtraInfo(currentMovie);
    renderUI(currentMovie, details);
  } catch (e) {
    console.error('Error finishing draw:', e);
    renderUI(currentMovie, { flatrate: [], rent: [], buy: [], deepLink: '', imdbId: '', imdb: '--', rt: '--' });
  } finally {
    setTimeout(() => {
      document.getElementById('slot-layer').style.display = 'none';
      document.getElementById('res-poster').classList.remove('opacity-0');
      document.getElementById('draw-btn').disabled = false;
      document.getElementById('draw-btn').textContent = UI_TEXT[CONFIG.LANG].draw;
      isRolling = false;
    }, 400);
  }
}

function renderUI(movie, details) {
  const posterImg = document.getElementById('res-poster');
  posterImg.src = movie.poster_path ? CONFIG.IMG_URL + movie.poster_path : 'https://via.placeholder.com/500x750?text=No+Poster';
  
  document.getElementById('res-title').textContent = movie.title + (movie.title !== movie.original_title ? ` (${movie.original_title})` : '');
  document.getElementById('res-desc').textContent = movie.overview || UI_TEXT[CONFIG.LANG].noInfo;

  const metaRow = document.getElementById('badge-row-meta');
  metaRow.innerHTML = '';
  
  const providers = [...(details.flatrate || []), ...(details.rent || []), ...(details.buy || [])];
  const uniqueProviders = Array.from(new Map(providers.map(p => [p.provider_id, p])).values());
  
  if (uniqueProviders.length > 0) {
    uniqueProviders.forEach(p => {
      metaRow.innerHTML += `
        <div class="provider-container">
          <a href="${details.deepLink}" target="_blank" onclick="event.stopPropagation();">
            <img src="https://image.tmdb.org/t/p/original${p.logo_path}" class="provider-sticker" title="${p.provider_name}">
          </a>
          <span class="provider-name">${p.provider_name}</span>
        </div>`;
    });
  } else {
    metaRow.innerHTML = `<span class="text-[10px] text-gray-500 uppercase font-bold">${UI_TEXT[CONFIG.LANG].noInfo} OTT</span>`;
  }

  document.getElementById('badge-row-scores').innerHTML = `
    <a href="https://www.themoviedb.org/movie/${movie.id}" target="_blank" class="sticker-badge" onclick="event.stopPropagation();">TMDB ${movie.vote_average.toFixed(1)}</a>
    <a href="https://www.imdb.com/title/${details.imdbId}" target="_blank" class="sticker-badge" onclick="event.stopPropagation();">IMDb ${details.imdb || '--'}</a>
    <a href="https://www.rottentomatoes.com/search?search=${encodeURIComponent(movie.original_title)}" target="_blank" class="sticker-badge" onclick="event.stopPropagation();">Rotten ${details.rt || '--'}</a>
  `;
}

async function getExtraInfo(movie) {
  const defaultInfo = { imdbId: '', imdb: '--', rt: '--', deepLink: `https://www.themoviedb.org/movie/${movie.id}/watch`, flatrate: [], rent: [], buy: [] };
  
  try {
    const [ext, watch] = await Promise.all([
      fetch(`${CONFIG.TMDB_BASE}/movie/${movie.id}/external_ids?api_key=${CONFIG.TMDB_KEY}`).then(r => r.ok ? r.json() : {}),
      fetch(`${CONFIG.TMDB_BASE}/movie/${movie.id}/watch/providers?api_key=${CONFIG.TMDB_KEY}`).then(r => r.ok ? r.json() : {})
    ]);

    let imdb = null, rt = null;
    if (ext.imdb_id) {
      try {
        const omdb = await fetch(`${CONFIG.OMDB_BASE}?i=${ext.imdb_id}&apikey=${CONFIG.OMDB_KEY}`).then(r => r.json());
        if (omdb.Response === 'True') {
          imdb = omdb.imdbRating;
          rt = omdb.Ratings?.find(r => r.Source === 'Rotten Tomatoes')?.Value;
        }
      } catch (e) { console.warn('OMDb fetch failed', e); }
    }

    const krWatch = watch.results?.KR || {};
    return { 
      imdbId: ext.imdb_id || '', 
      imdb: imdb || '--', 
      rt: rt || '--', 
      deepLink: krWatch.link || `https://www.themoviedb.org/movie/${movie.id}/watch`,
      flatrate: krWatch.flatrate || [], 
      rent: krWatch.rent || [], 
      buy: krWatch.buy || []
    };
  } catch (e) { 
    console.error('getExtraInfo error', e);
    return defaultInfo;
  }
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
}

async function toggleLanguage() { 
  if (isRolling) return;
  CONFIG.LANG = CONFIG.LANG === 'ko-KR' ? 'en-US' : 'ko-KR'; 
  localStorage.setItem('movielotto-lang', CONFIG.LANG); 
  applyLanguage(); 
  await fetchData(); 
  if (currentMovie) {
    const translated = allMovies.find(m => m.id === currentMovie.id) || currentMovie;
    const details = await getExtraInfo(translated);
    renderUI(translated, details);
  }
}

function resetApp() {
  if (isRolling) return;
  document.getElementById('slot-layer').style.display = 'flex';
  document.getElementById('res-poster').classList.add('opacity-0');
  document.getElementById('res-title').textContent = UI_TEXT[CONFIG.LANG].defaultTitle;
  document.getElementById('res-desc').textContent = UI_TEXT[CONFIG.LANG].defaultDesc;
  document.getElementById('badge-row-meta').innerHTML = '';
  document.getElementById('badge-row-scores').innerHTML = '<span class="sticker-badge">TMDB --</span><span class="sticker-badge">IMDb --</span><span class="sticker-badge">Rotten --</span>';
  currentMovie = null;
}

// Global functions for HTML onclick
window.startDraw = startDraw;
window.toggleTheme = toggleTheme;
window.toggleLanguage = toggleLanguage;
window.resetApp = resetApp;

init();
