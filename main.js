const CONFIG = {
    TMDB_KEY: 'f5ac0b3500a28ee145b8821abe874c7e',
    OMDB_KEY: 'd4e88f94',
    TMDB_BASE: 'https://api.themoviedb.org/3',
    OMDB_BASE: 'https://www.omdbapi.com/',
    IMG_URL: 'https://image.tmdb.org/t/p/w500',
    LANG: 'ko-KR'
};

const GENRE_EXPANSION = {
    28: [12, 53],    // Action -> Adventure, Thriller
    27: [53, 9648],  // Horror -> Thriller, Mystery
    10749: [18, 35], // Romance -> Drama, Comedy
    878: [14, 12],   // Sci-Fi -> Fantasy, Adventure
    35: [10751, 14], // Comedy -> Family, Fantasy
};

let state = {
    genres: [],
    selectedGenre: null,
    movies: [],
    viewedIds: new Set(),
    isDrawing: false,
    theme: localStorage.getItem('theme') || 'dark'
};

// UI Elements
const drawBtn = document.getElementById('draw-btn');
const slotTrack = document.getElementById('slot-track');
const slotView = document.getElementById('slot-view');
const resultView = document.getElementById('result-view');
const themeToggle = document.getElementById('theme-toggle');

async function init() {
    applyTheme();
    await fetchGenres();
    renderGenres();
}

async function fetchGenres() {
    try {
        const res = await fetch(`${CONFIG.TMDB_BASE}/genre/movie/list?api_key=${CONFIG.TMDB_KEY}&language=${CONFIG.LANG}`);
        const data = await res.json();
        state.genres = data.genres || [];
    } catch (e) {
        console.error("Failed to fetch genres", e);
    }
}

function renderGenres() {
    const container = document.getElementById('genre-container');
    container.innerHTML = '';
    
    const allChip = document.createElement('div');
    allChip.className = `genre-chip ${!state.selectedGenre ? 'active' : ''}`;
    allChip.textContent = '전체';
    allChip.onclick = () => selectGenre(null);
    container.appendChild(allChip);

    state.genres.forEach(g => {
        const chip = document.createElement('div');
        chip.className = `genre-chip ${state.selectedGenre === g.id ? 'active' : ''}`;
        chip.textContent = g.name;
        chip.onclick = () => selectGenre(g.id);
        container.appendChild(chip);
    });
}

function selectGenre(id) {
    if (state.isDrawing) return;
    state.selectedGenre = id;
    state.movies = []; 
    renderGenres();
}

async function getMovies(genreId, ratingThreshold = 7.0, expanded = false) {
    let url = `${CONFIG.TMDB_BASE}/discover/movie?api_key=${CONFIG.TMDB_KEY}&language=${CONFIG.LANG}&sort_by=popularity.desc&include_adult=false&vote_count.gte=100`;
    
    if (genreId) {
        let genreIds = [genreId];
        if (expanded && GENRE_EXPANSION[genreId]) {
            genreIds = [...genreIds, ...GENRE_EXPANSION[genreId]];
        }
        url += `&with_genres=${genreIds.join(',')}`;
    }

    try {
        const res = await fetch(url);
        const data = await res.json();
        let filtered = (data.results || []).filter(m => m.vote_average >= ratingThreshold && m.poster_path);

        if (filtered.length < 5 && ratingThreshold > 6.0) {
            return await getMovies(genreId, ratingThreshold - 0.5, expanded);
        }
        if (filtered.length < 5 && !expanded && genreId) {
            return await getMovies(genreId, 6.5, true);
        }

        return filtered;
    } catch (e) {
        console.error("Movie fetch error", e);
        return [];
    }
}

async function handleDrawClick() {
    if (state.isDrawing) return;
    
    state.isDrawing = true;
    updateButtonState(true);
    
    resultView.style.display = 'none';
    slotView.style.display = 'flex';
    
    startInfiniteSpin();

    try {
        const moviePool = await getMovies(state.selectedGenre);
        const unviewed = moviePool.filter(m => !state.viewedIds.has(m.id));
        const finalPool = unviewed.length > 0 ? unviewed : moviePool;
        
        const selectedMovie = finalPool[Math.floor(Math.random() * finalPool.length)];
        state.viewedIds.add(selectedMovie.id);

        await performFinalSpin(selectedMovie, moviePool);
        await showResult(selectedMovie);
    } catch (e) {
        console.error("Draw failed", e);
        alert("영화를 불러오는데 실패했습니다. 다시 시도해주세요.");
        resetApp();
    } finally {
        state.isDrawing = false;
        updateButtonState(false);
    }
}

function updateButtonState(drawing) {
    drawBtn.disabled = drawing;
    drawBtn.textContent = drawing ? "추첨 중..." : "다음 영화 뽑기";
}

function startInfiniteSpin() {
    slotTrack.style.transition = 'none';
    slotTrack.style.transform = 'translateY(0)';
    
    slotTrack.innerHTML = '';
    const ticketDiv = document.createElement('div');
    ticketDiv.className = 'slot-item placeholder';
    ticketDiv.innerHTML = '<span class="ticket-icon">🎟️</span>';
    slotTrack.appendChild(ticketDiv);

    for(let i=0; i<10; i++) {
        const div = document.createElement('div');
        div.className = 'slot-item placeholder';
        div.textContent = '🎰';
        slotTrack.appendChild(div);
    }
}

async function performFinalSpin(targetMovie, pool) {
    const sequenceCount = 12;
    const sequence = [];
    for(let i=0; i < sequenceCount - 1; i++) {
        sequence.push(pool[Math.floor(Math.random() * pool.length)]);
    }
    sequence.push(targetMovie);

    slotTrack.innerHTML = '';
    sequence.forEach(m => {
        const div = document.createElement('div');
        div.className = 'slot-item';
        div.innerHTML = `<img src="${CONFIG.IMG_URL}${m.poster_path}" alt="Poster">`;
        slotTrack.appendChild(div);
    });

    return new Promise(resolve => {
        const itemHeight = 340; 
        const totalDist = (sequenceCount - 1) * itemHeight;
        
        slotTrack.style.transition = 'transform 2.5s cubic-bezier(0.15, 0, 0.15, 1)';
        slotTrack.offsetHeight; 
        slotTrack.style.transform = `translateY(-${totalDist}px)`;
        
        setTimeout(resolve, 2700); 
    });
}

async function showResult(movie) {
    const [ott, omdb, credits] = await Promise.all([
        fetchOTT(movie.id),
        fetchOMDb(movie.id),
        fetchCredits(movie.id)
    ]);

    document.getElementById('res-poster').src = `${CONFIG.IMG_URL}${movie.poster_path}`;
    document.getElementById('res-title').textContent = movie.title;
    document.getElementById('res-overview').textContent = movie.overview || "영화 설명이 없습니다.";
    
    // Rating Badges
    document.getElementById('res-rating-tmdb').textContent = `TMDB ${movie.vote_average.toFixed(1)}`;
    document.getElementById('res-rating-imdb').textContent = `IMDb ${omdb?.imdbRating || '--'}`;
    document.getElementById('res-rating-rt').textContent = `Rotten ${omdb?.rtRating || '--'}`;

    // Credits with Fallback logic
    const directorObj = credits.crew?.find(c => c.job === 'Director');
    const directorName = directorObj ? (directorObj.name || directorObj.original_name) : '정보 없음';
    
    const castList = credits.cast?.slice(0, 3).map(c => c.name || c.original_name) || [];
    const castString = castList.length > 0 ? castList.join(', ') : '정보 없음';

    document.getElementById('res-director').textContent = `감독: ${directorName}`;
    document.getElementById('res-cast').textContent = `출연: ${castString}`;

    const ottList = document.getElementById('ott-list');
    ottList.innerHTML = '';
    
    const krData = ott?.KR || {};
    const providers = (krData.flatrate || []).slice(0, 4);
    const deepLink = krData.link; 

    if (providers.length > 0) {
        providers.forEach(p => {
            const item = document.createElement('div');
            item.className = 'ott-item';
            
            const link = document.createElement('a');
            link.href = deepLink || `https://www.themoviedb.org/movie/${movie.id}/watch`;
            link.target = '_blank';
            link.className = 'ott-link';
            link.onclick = (e) => e.stopPropagation(); 
            link.innerHTML = `<img src="https://image.tmdb.org/t/p/original${p.logo_path}" alt="${p.provider_name}">`;
            
            const name = document.createElement('span');
            name.className = 'ott-name';
            name.textContent = p.provider_name;
            
            item.appendChild(link);
            item.appendChild(name);
            ottList.appendChild(item);
        });
    } else {
        ottList.innerHTML = '<span style="color:rgba(0,0,0,0.4); font-weight:800; font-size:10px;">OTT 정보 없음</span>';
    }

    slotView.style.display = 'none';
    resultView.style.display = 'flex';
}

async function fetchOTT(movieId) {
    try {
        const res = await fetch(`${CONFIG.TMDB_BASE}/movie/${movieId}/watch/providers?api_key=${CONFIG.TMDB_KEY}`);
        const data = await res.json();
        return data.results || {};
    } catch (e) { return {}; }
}

async function fetchOMDb(tmdbId) {
    try {
        const extRes = await fetch(`${CONFIG.TMDB_BASE}/movie/${tmdbId}/external_ids?api_key=${CONFIG.TMDB_KEY}`);
        const extData = await extRes.json();
        if (!extData.imdb_id) return null;

        const res = await fetch(`${CONFIG.OMDB_BASE}?i=${extData.imdb_id}&apikey=${CONFIG.OMDB_KEY}`);
        const data = await res.json();
        
        if (data.Response === 'True') {
            const rt = data.Ratings?.find(r => r.Source === 'Rotten Tomatoes')?.Value;
            return {
                imdbRating: data.imdbRating,
                rtRating: rt || null
            };
        }
        return null;
    } catch (e) { return null; }
}

async function fetchCredits(movieId) {
    try {
        // Fetch with Korean first
        const res = await fetch(`${CONFIG.TMDB_BASE}/movie/${movieId}/credits?api_key=${CONFIG.TMDB_KEY}&language=${CONFIG.LANG}`);
        const data = await res.json();
        
        // If names are empty or suspicious (not Korean/English), fallback might be needed but TMDB usually handles name translations well.
        // We use name (translated) and original_name as fallback in showResult.
        return data;
    } catch (e) { return { cast: [], crew: [] }; }
}

function resetApp() {
    if (state.isDrawing) return;
    state.viewedIds.clear();
    resultView.style.display = 'none';
    slotView.style.display = 'flex';
    startInfiniteSpin();
    updateButtonState(false);
}

function toggleTheme() {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', state.theme);
    applyTheme();
}

function applyTheme() {
    document.body.classList.toggle('dark-mode', state.theme === 'dark');
    themeToggle.textContent = state.theme === 'dark' ? '☀️' : '🌙';
}

window.handleDrawClick = handleDrawClick;
window.resetApp = resetApp;
window.toggleTheme = toggleTheme;
window.selectGenre = selectGenre;

init();
