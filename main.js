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
    const randomPage = Math.floor(Math.random() * 80) + 1; // Increased depth (was 50)
    const providerIds = [2, 356, 8, 337, 119]; // Apple TV+, Coupang, Netflix, Disney+, Prime
    
    let url = `${CONFIG.TMDB_BASE}/discover/movie?api_key=${CONFIG.TMDB_KEY}&language=${state.lang === 'KO' ? 'ko-KR' : 'en-US'}&sort_by=popularity.desc&include_adult=false&vote_count.gte=50&page=${randomPage}&watch_region=KR&with_watch_providers=${providerIds.join('|')}`;
    
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
        const priorityIds = [8, 337, 2, 356, 119]; // Netflix, Disney+, Apple, Coupang, Prime

        while (!selectedMovie && retryCount < 25) { // Increased retries for Coupang depth
            moviePool = await getMovies(state.selectedGenre);
            
            const weightedCandidates = await Promise.all(moviePool.map(async m => {
                const fullInfo = await fetchFullInfo(m.id);
                const ott = fullInfo['watch/providers']?.results?.KR || {};
                
                let weight = Math.random();
                
                // 1. Coupang Play (356) Special Logic & Weight
                const hasCoupang = [...(ott.flatrate || []), ...(ott.rent || []), ...(ott.buy || [])]
                    .some(p => p.provider_id === 356);
                const isCoupangOriginal = (m.production_companies || []).some(c => c.name.toLowerCase().includes('coupang'));
                
                if (hasCoupang || isCoupangOriginal) weight += 5.0; // High bias for Coupang

                // 2. Other Subscribed OTTs
                const hasOtherPriority = [...(ott.flatrate || []), ...(ott.rent || []), ...(ott.buy || [])]
                    .some(p => [8, 337, 2, 119].includes(p.provider_id));
                if (hasOtherPriority) weight += 2.5;

                return { ...m, weight, fullInfo };
            }));

            weightedCandidates.sort((a, b) => b.weight - a.weight);
            
            for (const candidate of weightedCandidates) {
                const fullInfo = candidate.fullInfo;
                const ott = fullInfo['watch/providers']?.results?.KR || {};
                const omdb = await fetchOMDb(candidate);

                const tmdbScore = candidate.vote_average || 0;
                const imdbScore = parseFloat(omdb?.imdbRating) || 0;
                const rtScore = parseInt(omdb?.rtRating?.replace('%', '')) || 0;

                // Threshold Check
                if (tmdbScore >= 7.0 || imdbScore >= 7.0 || rtScore >= 70) {
                    selectedMovie = candidate;
                    selectedOmdb = omdb;
                    selectedCredits = fullInfo.credits;
                    selectedOtt = { KR: ott }; 
                    selectedVideos = fullInfo.videos;
                    break;
                }
            }
            retryCount++;
        }

        if (!selectedMovie) {
            selectedMovie = moviePool[0];
            const fullInfo = await fetchFullInfo(selectedMovie.id);
            const ott = fullInfo['watch/providers']?.results?.KR || {};
            const omdb = await fetchOMDb(selectedMovie);
            selectedCredits = fullInfo.credits;
            selectedVideos = fullInfo.videos;
            selectedOtt = { KR: ott };
        }

        state.viewedIds.add(selectedMovie.id);
        state.currentMovie = selectedMovie; 

        // 1. Construct Precise Search Keywords for Matching Logic
        const releaseYear = selectedMovie.release_date ? selectedMovie.release_date.split('-')[0] : '';
        const koSearchQuery = `${selectedMovie.title} ${releaseYear} 공식 예고편`;
        
        // 2. Ultimate Trailer Matching & Fallback
        let trailerId = findBestTrailer(selectedVideos?.results);

        if (!trailerId) {
            const enInfo = await fetchFullInfo(selectedMovie.id, 'en-US');
            trailerId = findBestTrailer(enInfo.videos?.results);
        }

        state.currentTrailerId = trailerId;

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

function findBestTrailer(videos) {
    if (!videos || !Array.isArray(videos)) return null;
    const ytVideos = videos.filter(v => v.site === 'YouTube');
    if (ytVideos.length === 0) return null;

    // Advanced filtering based on keywords
    const officialKws = ['Official', '공식', 'Main', '메인'];
    const trailerKws = ['Trailer', '예고편'];

    // Priority 1: Official + Trailer
    let best = ytVideos.find(v => 
        officialKws.some(ok => v.name.toLowerCase().includes(ok.toLowerCase())) && 
        trailerKws.some(tk => v.name.toLowerCase().includes(tk.toLowerCase()))
    );

    // Priority 2: Trailer type or Trailer in name
    if (!best) best = ytVideos.find(v => v.type === 'Trailer' || trailerKws.some(tk => v.name.toLowerCase().includes(tk.toLowerCase())));

    // Priority 3: Teaser or Official in name
    if (!best) best = ytVideos.find(v => v.type === 'Teaser' || officialKws.some(ok => v.name.toLowerCase().includes(ok.toLowerCase())));

    // Priority 4: First available YouTube video
    if (!best) best = ytVideos[0];

    return best?.key || null;
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
    const sequenceCount = 15;
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
        const itemHeight = document.querySelector('.slot-window').offsetHeight || 400;
        const totalDist = (sequenceCount - 1) * itemHeight;
        
        slotTrack.classList.add('spinning');
        slotTrack.style.transition = 'transform 1.5s cubic-bezier(0.45, 0.05, 0.55, 0.95)';
        slotTrack.offsetHeight; 
        slotTrack.style.transform = `translateY(-${totalDist}px)`;
        
        setTimeout(() => {
            slotTrack.classList.remove('spinning');
            resolve();
        }, 1600); 
    });
}

async function showResult(movie, omdb, credits, ott) {
    document.getElementById('res-poster').src = `${CONFIG.IMG_URL}${movie.poster_path}`;
    
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
    let providers = [
        ...(krData.flatrate || []),
        ...(krData.rent || []),
        ...(krData.buy || [])
    ].filter((v, i, a) => a.findIndex(t => t.provider_id === v.provider_id) === i);

    // 1. Priority OTT IDs (Netflix, Disney+, Apple, Coupang, Prime)
    const priorityIds = [8, 337, 2, 356, 119];
    const excludedIds = [3, 192, 424, 421]; // Google TV, Rakuten Viki etc (VOD focus)

    // Filter out VOD/Excluded services
    providers = providers.filter(p => !excludedIds.includes(p.provider_id));

    // Forced Original Match Logic
    const prodCompanies = movie.production_companies || [];
    const originalPlatforms = [
        { name: 'Netflix', id: 8, keywords: ['Netflix'] },
        { name: 'Disney Plus', id: 337, keywords: ['Disney'] },
        { name: 'Apple TV Plus', id: 2, keywords: ['Apple'] },
        { name: 'Amazon Prime Video', id: 119, keywords: ['Amazon'] },
        { name: 'Coupang Play', id: 356, keywords: ['Coupang', '쿠팡'] } 
    ];

    originalPlatforms.forEach(p => {
        const isOriginal = prodCompanies.some(c => p.keywords.some(kw => c.name.toLowerCase().includes(kw.toLowerCase())));
        const alreadyExists = providers.some(pr => pr.provider_id === p.id);
        if (isOriginal && !alreadyExists) {
            providers.push({
                provider_id: p.id,
                provider_name: p.name,
                logo_path: getPlatformLogo(p.name)
            });
        }
    });

    // 2. Sorting by Priority (Subscribed OTTs first)
    providers.sort((a, b) => {
        const idxA = priorityIds.indexOf(a.provider_id);
        const idxB = priorityIds.indexOf(b.provider_id);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return 0;
    });

    providers = providers.slice(0, 5);

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
            const logoSrc = p.logo_path.startsWith('/') ? `https://image.tmdb.org/t/p/original${p.logo_path}` : p.logo_path;
            link.innerHTML = `<img src="${logoSrc}" alt="${p.provider_name}">`;
            
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

function getPlatformLogo(name) {
    const MAP = {
        'Netflix': '/wwemzKWzjKYJFfCeiB57q3r4Bcm.jpg',
        'Disney Plus': '/7rwE0vEbsnBp6FocCD9b6FZ7vJu.jpg',
        'Apple TV Plus': '/68vAnUiqHpkS9jY7-ZpCkYW9Iba.jpg',
        'Amazon Prime Video': '/if8Q9jy96OuwFyH4o0vUBTMpS3M.jpg',
        'Coupang Play': '/7rwE0vEbsnBp6FocCD9b6FZ7vJu.jpg' 
    };
    return MAP[name] || '';
}

function getKROttDeepLink(providerId, title, originalTitle) {
    const encodedTitle = encodeURIComponent(title);
    const OTT_MAP = {
        8: `https://www.netflix.com/search?q=${encodedTitle}`,
        337: `https://www.disneyplus.com/ko-kr/search?q=${encodedTitle}`,
        2: `https://tv.apple.com/kr/search?term=${encodedTitle}`,
        350: `https://www.tving.com/search?keyword=${encodedTitle}`,
        119: `https://www.amazon.com/gp/video/storefront/search?phrase=${encodedTitle}`,
        444: `https://www.coupangplay.com/search?q=${encodedTitle}`,
        356: `https://www.wavve.com/search?searchKeyword=${encodedTitle}`,
        97: `https://watcha.com/search?query=${encodedTitle}`,
        3: `https://play.google.com/store/search?q=${encodedTitle}&c=movies`,
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
        97: `watcha://`,
        444: `coupangplay://`
    };
    return SCHEME_MAP[providerId] || null;
}

function playTrailer() {
    if (!state.currentTrailerId || !state.isApiReady || state.player) return;

    trailerContainer.innerHTML = '<div id="yt-player"></div>';
    trailerContainer.style.display = 'block';
    playOverlay.style.display = 'none';

    trailerContainer.onclick = (e) => e.stopPropagation();

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
}

function stopTrailer() {
    if (state.player && state.player.stopVideo) {
        try {
            state.player.stopVideo();
            state.player.destroy();
        } catch (e) {
            console.error("Error stopping trailer", e);
        }
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

async function fetchFullInfo(movieId, overrideLang = null) {
    try {
        const lang = overrideLang || (state.lang === 'KO' ? 'ko-KR' : 'en-US');
        const res = await fetch(`${CONFIG.TMDB_BASE}/movie/${movieId}?api_key=${CONFIG.TMDB_KEY}&language=${lang}&append_to_response=videos,credits,watch/providers`);
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
