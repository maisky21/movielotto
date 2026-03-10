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

// REFINED CINEMATIC SFX Assets
const SFX = {
    CLICK: new Audio('https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3'), // Soft Deep Thud
    SPIN: new Audio('https://assets.mixkit.co/active_storage/sfx/111/111-preview.mp3'),   // Projector Hum
    REVEAL: new Audio('https://assets.mixkit.co/active_storage/sfx/2630/2630-preview.mp3'), // Subtle Bass Drop / Cinematic Hit
    START: new Audio('https://assets.mixkit.co/active_storage/sfx/2628/2628-preview.mp3')  // Soft Deep Bell / Cinematic Swish
};

// Set volumes to be very subtle (0.15)
Object.values(SFX).forEach(audio => {
    audio.volume = 0.15;
});
SFX.SPIN.loop = true;

/**
 * Smoothly fades out an audio element
 */
function fadeOut(audio, duration = 500) {
    const startVolume = audio.volume;
    const startTime = performance.now();

    function update() {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        audio.volume = startVolume * (1 - progress);

        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            audio.pause();
            audio.volume = startVolume; 
        }
    }
    requestAnimationFrame(update);
}

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
    
    // Play subtle start sound on first user interaction or load
    window.addEventListener('click', () => {
        if (!state.startSoundPlayed) {
            SFX.START.play().catch(() => {});
            state.startSoundPlayed = true;
        }
    }, { once: true });
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

async function getMovies(genreId, expanded = false) {
    const randomPage = Math.floor(Math.random() * 50) + 1;
    let url = `${CONFIG.TMDB_BASE}/discover/movie?api_key=${CONFIG.TMDB_KEY}&language=${CONFIG.LANG}&sort_by=popularity.desc&include_adult=false&vote_count.gte=50&page=${randomPage}`;
    
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
        let results = (data.results || []).filter(m => m.poster_path);

        if (results.length < 5 && !expanded && genreId) {
            return await getMovies(genreId, true);
        }

        return results;
    } catch (e) {
        console.error("Movie fetch error", e);
        return [];
    }
}

async function handleDrawClick() {
    if (state.isDrawing) return;
    
    // SFX: Soft Thud
    SFX.CLICK.currentTime = 0;
    SFX.CLICK.play().catch(() => {});

    state.isDrawing = true;
    updateButtonState(true);
    
    resultView.style.display = 'none';
    slotView.style.display = 'flex';
    
    startInfiniteSpin();
    
    // SFX: Projector Hum Start
    SFX.SPIN.currentTime = 0;
    SFX.SPIN.play().catch(() => {});

    try {
        let selectedMovie = null;
        let selectedOmdb = null;
        let selectedCredits = null;
        let selectedOtt = null;
        
        let moviePool = [];
        let retryCount = 0;

        while (!selectedMovie && retryCount < 10) {
            moviePool = await getMovies(state.selectedGenre);
            const candidates = moviePool.filter(m => !state.viewedIds.has(m.id)).sort(() => Math.random() - 0.5);
            
            for (const candidate of candidates) {
                const [ott, omdb, credits] = await Promise.all([
                    fetchOTT(candidate.id),
                    fetchOMDb(candidate),
                    fetchCredits(candidate.id)
                ]);

                const tmdbScore = candidate.vote_average || 0;
                const imdbScore = parseFloat(omdb?.imdbRating) || 0;
                const rtScore = parseInt(omdb?.rtRating?.replace('%', '')) || 0;

                if (tmdbScore >= 7.0 || imdbScore >= 7.0 || rtScore >= 70) {
                    selectedMovie = candidate;
                    selectedOmdb = omdb;
                    selectedCredits = credits;
                    selectedOtt = ott;
                    break;
                }
            }
            retryCount++;
        }

        if (!selectedMovie) {
            selectedMovie = moviePool[0];
            [selectedOtt, selectedOmdb, selectedCredits] = await Promise.all([
                fetchOTT(selectedMovie.id),
                fetchOMDb(selectedMovie),
                fetchCredits(selectedMovie.id)
            ]);
        }

        state.viewedIds.add(selectedMovie.id);

        await performFinalSpin(selectedMovie, moviePool);
        
        // SFX: Fade out Projector & Play Subtle Bass Drop
        fadeOut(SFX.SPIN, 400);
        SFX.REVEAL.currentTime = 0;
        SFX.REVEAL.play().catch(() => {});

        await showResult(selectedMovie, selectedOmdb, selectedCredits, selectedOtt);
    } catch (e) {
        console.error("Draw failed", e);
        fadeOut(SFX.SPIN, 200);
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

async function showResult(movie, omdb, credits, ott) {
    document.getElementById('res-poster').src = `${CONFIG.IMG_URL}${movie.poster_path}`;
    document.getElementById('res-title').textContent = movie.title;
    document.getElementById('res-overview').textContent = movie.overview || "영화 설명이 없습니다.";
    
    document.getElementById('res-rating-tmdb').textContent = `TMDB ${movie.vote_average.toFixed(1)}`;
    document.getElementById('res-rating-imdb').textContent = `IMDb ${omdb?.imdbRating || '--'}`;
    document.getElementById('res-rating-rt').textContent = `Rotten ${omdb?.rtRating || '--'}`;

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

async function fetchOMDb(movie) {
    try {
        const extRes = await fetch(`${CONFIG.TMDB_BASE}/movie/${movie.id}/external_ids?api_key=${CONFIG.TMDB_KEY}`);
        const extData = await extRes.json();
        
        let url = `${CONFIG.OMDB_BASE}?apikey=${CONFIG.OMDB_KEY}`;
        if (extData.imdb_id) {
            url += `&i=${extData.imdb_id}`;
        } else {
            const year = movie.release_date ? movie.release_date.split('-')[0] : '';
            url += `&t=${encodeURIComponent(movie.title)}&y=${year}`;
        }

        const res = await fetch(url);
        const data = await res.json();
        
        if (data.Response === 'True') {
            const rt = data.Ratings?.find(r => r.Source.includes("Rotten Tomatoes"))?.Value;
            return {
                imdbRating: data.imdbRating && data.imdbRating !== "N/A" ? data.imdbRating : null,
                rtRating: rt || null
            };
        }
        return null;
    } catch (e) { return null; }
}

async function fetchCredits(movieId) {
    try {
        const res = await fetch(`${CONFIG.TMDB_BASE}/movie/${movieId}/credits?api_key=${CONFIG.TMDB_KEY}&language=${CONFIG.LANG}`);
        const data = await res.json();
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
    
    // Play start sound on reset
    SFX.START.currentTime = 0;
    SFX.START.play().catch(() => {});
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
