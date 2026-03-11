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

const I18N = {
    KO: {
        hero: "당신의 운명을 결정할 단 하나의 영화",
        trust: "평점 7.0 이상의 명작만 엄선",
        director: "감독",
        cast: "출연",
        noOtt: "국내 스트리밍 정보 없음",
        draw: "다음 영화 뽑기",
        drawing: "추첨 중...",
        all: "전체",
        fail: "영화를 불러오는데 실패했습니다. 다시 시도해주세요.",
        about: "서비스 소개",
        contact: "문의하기",
        privacy: "개인정보처리방침",
        terms: "이용약관",
        brand: "시네 로또"
    },
    EN: {
        hero: "The one movie that will decide your fate",
        trust: "Only masterpieces rated 7.0 or higher",
        director: "Director",
        cast: "Cast",
        noOtt: "Not available in KR",
        draw: "Next Movie",
        drawing: "Drawing...",
        all: "All",
        fail: "Failed to load movie. Please try again.",
        about: "About",
        contact: "Contact",
        privacy: "Privacy",
        terms: "Terms",
        brand: "Cine Lotto"
    }
};

let state = {
    genres: [],
    selectedGenre: null,
    movies: [],
    viewedIds: new Set(),
    isDrawing: false,
    theme: localStorage.getItem('theme') || 'dark',
    lang: localStorage.getItem('lang') || 'KO',
    currentTrailerId: null,
    currentMovie: null,
    history: JSON.parse(localStorage.getItem('history') || '[]'),
    player: null,
    isApiReady: false
};

// UI Elements
const drawBtn = document.getElementById('draw-btn');
const slotTrack = document.getElementById('slot-track');
const slotView = document.getElementById('slot-view');
const resultView = document.getElementById('result-view');
const themeToggle = document.getElementById('theme-toggle');
const langToggle = document.getElementById('lang-toggle');
const trailerContainer = document.getElementById('trailer-container');
const playOverlay = document.getElementById('play-overlay');

// YouTube IFrame API
window.onYouTubeIframeAPIReady = () => {
    state.isApiReady = true;
};

async function init() {
    applyTheme();
    updateLangUI();
    await fetchGenres();
    renderGenres();
}

async function fetchGenres() {
    try {
        const res = await fetch(`${CONFIG.TMDB_BASE}/genre/movie/list?api_key=${CONFIG.TMDB_KEY}&language=${state.lang === 'KO' ? 'ko-KR' : 'en-US'}`);
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
    allChip.textContent = I18N[state.lang].all;
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
    let url = `${CONFIG.TMDB_BASE}/discover/movie?api_key=${CONFIG.TMDB_KEY}&language=${state.lang === 'KO' ? 'ko-KR' : 'en-US'}&sort_by=popularity.desc&include_adult=false&vote_count.gte=50&page=${randomPage}`;
    
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
    
    stopTrailer();
    trailerContainer.style.display = 'none';
    playOverlay.style.display = 'flex';
    state.currentTrailerId = null;

    state.isDrawing = true;
    updateButtonState(true);
    
    resultView.style.display = 'none';
    slotView.style.display = 'flex';
    
    startInfiniteSpin();

    try {
        let selectedMovie = null;
        let selectedOmdb = null;
        let selectedCredits = null;
        let selectedOtt = null;
        let selectedVideos = null;
        
        let moviePool = [];
        let retryCount = 0;

        while (!selectedMovie && retryCount < 10) {
            moviePool = await getMovies(state.selectedGenre);
            const candidates = moviePool.filter(m => !state.viewedIds.has(m.id)).sort(() => Math.random() - 0.5);
            
            for (const candidate of candidates) {
                const [ott, omdb, fullInfo] = await Promise.all([
                    fetchOTT(candidate.id),
                    fetchOMDb(candidate),
                    fetchFullInfo(candidate.id)
                ]);

                const tmdbScore = candidate.vote_average || 0;
                const imdbScore = parseFloat(omdb?.imdbRating) || 0;
                const rtScore = parseInt(omdb?.rtRating?.replace('%', '')) || 0;

                if (tmdbScore >= 7.0 || imdbScore >= 7.0 || rtScore >= 70) {
                    selectedMovie = candidate;
                    selectedOmdb = omdb;
                    selectedCredits = fullInfo.credits;
                    selectedOtt = ott;
                    selectedVideos = fullInfo.videos;
                    break;
                }
            }
            retryCount++;
        }

        if (!selectedMovie) {
            selectedMovie = moviePool[0];
            const fullInfo = await fetchFullInfo(selectedMovie.id);
            [selectedOtt, selectedOmdb] = await Promise.all([
                fetchOTT(selectedMovie.id),
                fetchOMDb(selectedMovie)
            ]);
            selectedCredits = fullInfo.credits;
            selectedVideos = fullInfo.videos;
        }

        state.viewedIds.add(selectedMovie.id);
        state.currentMovie = selectedMovie; 

        const trailer = selectedVideos?.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube') || selectedVideos?.results?.find(v => v.site === 'YouTube');
        state.currentTrailerId = trailer?.key || null;

        await performFinalSpin(selectedMovie, moviePool);
        await showResult(selectedMovie, selectedOmdb, selectedCredits, selectedOtt);
    } catch (e) {
        console.error("Draw failed", e);
        alert(I18N[state.lang].fail);
        resetApp();
    } finally {
        state.isDrawing = false;
        updateButtonState(false);
    }
}

function updateButtonState(drawing) {
    drawBtn.disabled = drawing;
    drawBtn.textContent = drawing ? I18N[state.lang].drawing : I18N[state.lang].draw;
    drawBtn.classList.toggle('drawing', drawing);
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
        const itemHeight = 400; 
        const totalDist = (sequenceCount - 1) * itemHeight;
        
        slotTrack.style.transition = 'transform 2.5s cubic-bezier(0.15, 0, 0.15, 1)';
        slotTrack.offsetHeight; 
        slotTrack.style.transform = `translateY(-${totalDist}px)`;
        
        setTimeout(resolve, 2700); 
    });
}

async function showResult(movie, omdb, credits, ott) {
    const posterUrl = `${CONFIG.IMG_URL}${movie.poster_path}`;
    document.getElementById('res-poster').src = posterUrl;
    
    // Set dynamic blurred background
    const dynamicBg = document.getElementById('dynamic-bg');
    dynamicBg.style.backgroundImage = `url(${posterUrl})`;

    const titleEl = document.getElementById('res-title');
    titleEl.innerHTML = omdb?.imdbId 
        ? `<a href="https://www.imdb.com/title/${omdb.imdbId}/" target="_blank">${movie.title}</a>`
        : movie.title;

    document.getElementById('res-overview').textContent = movie.overview || (state.lang === 'KO' ? "영화 설명이 없습니다." : "No overview available.");
    
    document.getElementById('res-rating-tmdb').textContent = `TMDB ${movie.vote_average.toFixed(1)}`;
    document.getElementById('res-rating-imdb').textContent = `IMDb ${omdb?.imdbRating || '--'}`;
    document.getElementById('res-rating-rt').textContent = `Rotten ${omdb?.rtRating || '--'}`;

    const directorObj = credits?.crew?.find(c => c.job === 'Director');
    const topCast = credits?.cast?.slice(0, 3) || [];

    const peopleToFetch = [
        ...(directorObj ? [directorObj] : []),
        ...topCast
    ];

    const personImdbData = await Promise.all(peopleToFetch.map(async p => {
        const imdbId = await fetchPersonImdbId(p.id);
        return { id: p.id, imdbId };
    }));

    const getPersonLink = (p) => {
        const data = personImdbData.find(d => d.id === p.id);
        const displayName = p.name || p.original_name;
        const searchName = p.original_name || p.name;
        if (data?.imdbId) {
            return `<a class="credit-link" href="https://www.imdb.com/name/${data.imdbId}/" target="_blank">${displayName}</a>`;
        } else {
            return `<a class="credit-link" href="https://www.imdb.com/find?q=${encodeURIComponent(searchName)}" target="_blank">${displayName}</a>`;
        }
    };

    const labels = I18N[state.lang];
    const directorName = directorObj ? (directorObj.name || directorObj.original_name) : (state.lang === 'KO' ? '정보 없음' : 'N/A');
    document.getElementById('res-director').innerHTML = directorObj 
        ? `${labels.director}: ${getPersonLink(directorObj)}`
        : `${labels.director}: ${directorName}`;

    const castHtmls = topCast.map(p => getPersonLink(p));
    document.getElementById('res-cast').innerHTML = `${labels.cast}: ${castHtmls.join(', ') || (state.lang === 'KO' ? '정보 없음' : 'N/A')}`;

    const ottList = document.getElementById('ott-list');
    ottList.innerHTML = '';
    
    const krData = ott?.KR || {};
    const providers = [
        ...(krData.flatrate || []),
        ...(krData.rent || [])
    ].filter((v, i, a) => a.findIndex(t => t.provider_id === v.provider_id) === i)
    .slice(0, 4);

    if (providers.length > 0) {
        providers.forEach(p => {
            const item = document.createElement('div');
            item.className = 'ott-item';
            
            const link = document.createElement('a');
            link.href = getKROttDeepLink(p.provider_id, movie.title, movie.original_title);
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.className = 'ott-link';
            link.onclick = (e) => {
                e.stopPropagation();
                if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
                    const scheme = getKROttAppScheme(p.provider_id, movie.title);
                    if (scheme) { window.location.href = scheme; }
                }
            };
            link.innerHTML = `<img src="https://image.tmdb.org/t/p/original${p.logo_path}" alt="${p.provider_name}">`;
            
            const name = document.createElement('span');
            name.className = 'ott-name';
            name.textContent = p.provider_name;
            
            item.appendChild(link);
            item.appendChild(name);
            ottList.appendChild(item);
        });
    } else {
        ottList.innerHTML = `<span style="color:rgba(0,0,0,0.4); font-weight:800; font-size:10px;">${labels.noOtt}</span>`;
    }

    // Save to History
    const historyItem = {
        id: movie.id,
        title: movie.title,
        poster: movie.poster_path,
        year: movie.release_date?.split('-')[0]
    };
    state.history = [historyItem, ...state.history.filter(h => h.id !== movie.id)].slice(0, 5);
    localStorage.setItem('history', JSON.stringify(state.history));

    playOverlay.style.display = state.currentTrailerId ? 'flex' : 'none';
    slotView.style.display = 'none';
    resultView.style.display = 'flex';
}

function getKROttDeepLink(providerId, title, originalTitle) {
    const encodedTitle = encodeURIComponent(title);
    const OTT_MAP = {
        8: `https://www.netflix.com/search?q=${encodedTitle}`,
        337: `https://www.disneyplus.com/ko-kr/search?q=${encodedTitle}`,
        97: `https://watcha.com/search?query=${encodedTitle}`,
        356: `https://www.wavve.com/search?searchKeyword=${encodedTitle}`,
        444: `https://www.coupangplay.com/search?q=${encodedTitle}`,
        350: `https://www.tving.com/search?keyword=${encodedTitle}`,
        2: `https://tv.apple.com/kr/search?term=${encodedTitle}`,
        3: `https://play.google.com/store/search?q=${encodedTitle}&c=movies`,
        119: `https://www.amazon.com/gp/video/storefront/search?phrase=${encodedTitle}`,
    };
    return OTT_MAP[providerId] || `https://www.google.com/search?q=${encodedTitle}+OTT+보러가기`;
}

function getKROttAppScheme(providerId, title) {
    const encodedTitle = encodeURIComponent(title);
    const SCHEME_MAP = {
        8: `nflx://www.netflix.com/Browse?q=${encodedTitle}`,
        337: `disneyplus://`,
        356: `wavve://`,
        350: `tving://`,
        97: `watcha://`
    };
    return SCHEME_MAP[providerId] || null;
}

function playTrailer() {
    if (!state.currentTrailerId || !state.isApiReady) return;

    trailerContainer.innerHTML = '<div id="yt-player"></div><div class="trailer-overlay"></div>';
    trailerContainer.style.display = 'block';
    playOverlay.style.display = 'none';

    state.player = new YT.Player('yt-player', {
        height: '100%',
        width: '100%',
        videoId: state.currentTrailerId,
        playerVars: {
            'autoplay': 1,
            'controls': 1,
            'rel': 0,
            'modestbranding': 1,
            'iv_load_policy': 3,
            'playsinline': 1
        },
        events: {
            'onStateChange': onPlayerStateChange
        }
    });
}

function onPlayerStateChange(event) {
    // Prevent accidental pause
    // If state is PAUSED (2), and it wasn't triggered by reaching the end (0)
    if (event.data === YT.PlayerState.PAUSED) {
        // We can't easily detect if the user clicked the bottom control bar vs the video body.
        // However, we have a 'trailer-overlay' div covering the video body.
        // If the pause was triggered while the video body was clicked, the overlay would have intercepted it.
        // But the overlay 'pointer-events' are 'default', and it doesn't cover the bottom 60px.
        // If the user clicks the overlay, it shouldn't pause.
        // If for some reason it still pauses (e.g. keyboard), we can force play if needed.
        // For now, the overlay should handle the "accidental click on video body" requirement.
    }
}

function stopTrailer() {
    if (state.player && state.player.stopVideo) {
        state.player.stopVideo();
        state.player.destroy();
        state.player = null;
    }
    trailerContainer.innerHTML = '';
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
        if (extData.imdb_id) { url += `&i=${extData.imdb_id}`; } 
        else { url += `&t=${encodeURIComponent(movie.title)}&y=${movie.release_date?.split('-')[0] || ''}`; }
        const res = await fetch(url);
        const data = await res.json();
        if (data.Response === 'True') {
            const rt = data.Ratings?.find(r => r.Source.includes("Rotten Tomatoes"))?.Value;
            return { imdbRating: data.imdbRating && data.imdbRating !== "N/A" ? data.imdbRating : null, rtRating: rt || null, imdbId: extData.imdb_id || data.imdbID };
        }
        return null;
    } catch (e) { return null; }
}

async function fetchFullInfo(movieId) {
    try {
        const res = await fetch(`${CONFIG.TMDB_BASE}/movie/${movieId}?api_key=${CONFIG.TMDB_KEY}&language=${state.lang === 'KO' ? 'ko-KR' : 'en-US'}&append_to_response=videos,credits`);
        return await res.json();
    } catch (e) { return {}; }
}

async function fetchPersonImdbId(personId) {
    try {
        const res = await fetch(`${CONFIG.TMDB_BASE}/person/${personId}/external_ids?api_key=${CONFIG.TMDB_KEY}`);
        const data = await res.json();
        return data.imdb_id || null;
    } catch (e) { return null; }
}

function resetApp() {
    if (state.isDrawing) return;
    state.viewedIds.clear();
    state.currentMovie = null;
    stopTrailer();
    trailerContainer.style.display = 'none';
    resultView.style.display = 'none';
    slotView.style.display = 'flex';
    
    // Clear dynamic background
    const dynamicBg = document.getElementById('dynamic-bg');
    dynamicBg.style.backgroundImage = 'none';

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

async function toggleLanguage() {
    state.lang = state.lang === 'KO' ? 'EN' : 'KO';
    localStorage.setItem('lang', state.lang);
    updateLangUI();
    
    await fetchGenres();
    renderGenres();

    if (state.currentMovie && resultView.style.display !== 'none') {
        const [ott, omdb, fullInfo] = await Promise.all([
            fetchOTT(state.currentMovie.id),
            fetchOMDb(state.currentMovie),
            fetchFullInfo(state.currentMovie.id)
        ]);
        await showResult(fullInfo, omdb, fullInfo.credits, ott);
    }
}

function updateLangUI() {
    const labels = I18N[state.lang];
    langToggle.textContent = state.lang;
    document.getElementById('hero-msg').textContent = labels.hero;
    document.getElementById('trust-msg').textContent = labels.trust;
    drawBtn.textContent = labels.draw;
    
    document.getElementById('link-about').textContent = labels.about;
    document.getElementById('link-contact').textContent = labels.contact;
    document.getElementById('link-privacy').textContent = labels.privacy;
    document.getElementById('link-terms').textContent = labels.terms;
}

window.handleDrawClick = handleDrawClick;
window.resetApp = resetApp;
window.toggleTheme = toggleTheme;
window.toggleLanguage = toggleLanguage;
window.selectGenre = selectGenre;
window.playTrailer = playTrailer;

init();
