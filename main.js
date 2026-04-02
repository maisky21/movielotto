const CONFIG = {
    TMDB_KEY: '77be59b7948bd8dd4522a4a18ef73767',
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
        kMovie: "K-무비",
        new: "NEW",
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
        kMovie: "K-Movie",
        new: "NEW",
        fail: "Failed to load movie. Please try again.",
        about: "About",
        contact: "Contact",
        privacy: "Privacy",
        terms: "Terms",
        brand: "Cine Lotto"
    }
};

// GA4 Tracking Helper
function trackEvent(name, params) {
    if (typeof gtag === 'function') {
        gtag('event', name, params);
    }
}

let state = {
    genres: [],
    selectedGenre: null,
    isKMovie: false,
    isNewMovie: false,
    selectedProvider: null,
    movies: [],
    isDrawing: false,
    theme: localStorage.getItem('theme') || 'dark',
    lang: localStorage.getItem('lang') || 'KO',
    currentTrailerId: null,
    currentMovie: null,
    currentOmdb: null,
    player: null,
    isApiReady: false,
    moviePoolCache: { key: null, movies: [] }
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

// YouTube IFrame API Callback
window.onYouTubeIframeAPIReady = () => {
    state.isApiReady = true;
};

async function init() {
    applyTheme();
    updateLangUI();
    await fetchGenres();
    renderGenres();
    setupGenreNavScroll();
    
    if (typeof YT !== 'undefined' && YT.Player) {
        state.isApiReady = true;
    }
}

function setupGenreNavScroll() {
    const nav = document.getElementById('genre-container');
    if (!nav) return;

    const wrapper = document.getElementById('genre-nav-wrapper');
    const updateFade = () => {
        if (!wrapper) return;
        const atEnd = nav.scrollLeft + nav.clientWidth >= nav.scrollWidth - 4;
        wrapper.classList.toggle('scrolled-end', atEnd);
    };
    nav.addEventListener('scroll', updateFade, { passive: true });
    // initial check after chips render
    setTimeout(updateFade, 100);

    nav.addEventListener('wheel', (e) => {
        if (e.deltaY !== 0) {
            e.preventDefault();
            nav.scrollLeft += e.deltaY;
        }
    }, { passive: false });

    let isDown = false;
    let startX;
    let scrollLeft;

    nav.onmousedown = (e) => {
        isDown = true;
        startX = e.pageX - nav.offsetLeft;
        scrollLeft = nav.scrollLeft;
        nav.style.scrollBehavior = 'auto';
    };

    window.addEventListener('mouseup', () => {
        if (isDown) {
            isDown = false;
            nav.style.scrollBehavior = 'smooth';
        }
    });

    nav.onmousemove = (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - nav.offsetLeft;
        const walk = (x - startX) * 2;
        nav.scrollLeft = scrollLeft - walk;
    };
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
    if (!container) return;
    container.innerHTML = '';
    
    const isDefault = !state.selectedGenre && !state.isKMovie && !state.isNewMovie && !state.selectedProvider;

    // 1. All Chip
    const allChip = document.createElement('div');
    allChip.className = `genre-chip ${isDefault ? 'active' : ''}`;
    allChip.textContent = I18N[state.lang].all;
    allChip.onclick = () => selectGenre(null, false, false);
    container.appendChild(allChip);

    // 2. K-Movie Chip
    const kChip = document.createElement('div');
    kChip.className = `genre-chip ${state.isKMovie ? 'active' : ''}`;
    kChip.textContent = I18N[state.lang].kMovie;
    kChip.onclick = () => selectGenre(null, true, false);
    container.appendChild(kChip);

    // 3. NEW Chip
    const newChip = document.createElement('div');
    newChip.className = `genre-chip ${state.isNewMovie ? 'active' : ''}`;
    newChip.textContent = I18N[state.lang].new;
    newChip.onclick = () => selectGenre(null, false, true);
    container.appendChild(newChip);

    // 4. OTT-specific Chips (N / D / P)
    const ottChips = [
        { label: 'N', providerId: 8 },
        { label: 'D', providerId: 337 },
        { label: 'P', providerId: 119 },
    ];
    ottChips.forEach(({ label, providerId }) => {
        const chip = document.createElement('div');
        chip.className = `genre-chip ott-chip ${state.selectedProvider === providerId ? 'active' : ''}`;
        chip.textContent = label;
        chip.onclick = () => selectGenre(null, false, false, providerId);
        container.appendChild(chip);
    });

    // 5. Fetched Genres
    state.genres.forEach(g => {
        const chip = document.createElement('div');
        chip.className = `genre-chip ${(state.selectedGenre === g.id && !state.isKMovie && !state.isNewMovie && !state.selectedProvider) ? 'active' : ''}`;
        chip.textContent = g.name;
        chip.onclick = () => selectGenre(g.id, false, false);
        container.appendChild(chip);
    });
}

function selectGenre(id, isKMovie, isNewMovie, providerId = null) {
    if (state.isDrawing) return;

    // GA4 Tracking
    let genreName = I18N[state.lang].all;
    if (isKMovie) genreName = I18N[state.lang].kMovie;
    else if (isNewMovie) genreName = I18N[state.lang].new;
    else if (providerId === 8) genreName = 'Netflix';
    else if (providerId === 337) genreName = 'Disney+';
    else if (providerId === 119) genreName = 'Prime Video';
    else if (id) {
        const genre = state.genres.find(g => g.id === id);
        if (genre) genreName = genre.name;
    }
    trackEvent('select_genre', { genre_name: genreName });

    state.selectedGenre = id;
    state.isKMovie = isKMovie;
    state.isNewMovie = isNewMovie;
    state.selectedProvider = providerId;
    state.movies = [];
    state.moviePoolCache = { key: null, movies: [] };
    renderGenres();
}

function getHistory() {
    try {
        const h = sessionStorage.getItem('recommend_history');
        return h ? JSON.parse(h) : [];
    } catch(e) { return []; }
}

function saveToHistory(id) {
    let h = getHistory();
    h = h.filter(existingId => existingId !== id);
    h.unshift(id);
    if (h.length > 20) h = h.slice(0, 20);
    sessionStorage.setItem('recommend_history', JSON.stringify(h));
}

async function getMovies(genreId, sortBy = 'popularity.desc', providerId = null, expanded = false) {
    const randomPage = (state.isNewMovie || state.isKMovie) ? Math.floor(Math.random() * 10) + 1 : Math.floor(Math.random() * 20) + 1;
    const minVotes = (state.isNewMovie || state.isKMovie) ? 50 : 100;
    const providerParam = providerId ? String(providerId) : '8|337|119';

    let url = `${CONFIG.TMDB_BASE}/discover/movie?api_key=${CONFIG.TMDB_KEY}&language=${state.lang === 'KO' ? 'ko-KR' : 'en-US'}&sort_by=${sortBy}&include_adult=false&vote_count.gte=${minVotes}&vote_average.gte=6.8&page=${randomPage}&watch_region=KR&with_watch_providers=${providerParam}&with_watch_monetization_types=flatrate`;

    if (state.isKMovie) url += `&with_original_language=ko`;
    if (state.isNewMovie) {
        const today = new Date();
        const oneYearAgo = new Date(today);
        oneYearAgo.setFullYear(today.getFullYear() - 1);
        const fmt = d => d.toISOString().slice(0, 10);
        url += `&primary_release_date.gte=${fmt(oneYearAgo)}&primary_release_date.lte=${fmt(today)}`;
    }

    if (genreId) {
        let genreIds = [genreId];
        if (expanded && GENRE_EXPANSION[genreId]) genreIds = [...genreIds, ...GENRE_EXPANSION[genreId]];
        url += `&with_genres=${genreIds.join(',')}`;
    }

    try {
        const res = await fetch(url);
        if (!res.ok) return [];
        const data = await res.json();
        let results = (data.results || []).filter(m => m.poster_path);
        if (results.length < 5 && !expanded && (genreId || state.isKMovie || state.isNewMovie)) {
            return await getMovies(genreId, sortBy, providerId, true);
        }
        return results;
    } catch (e) {
        console.error("Movie fetch error", e);
        return [];
    }
}

async function handleDrawClick() {
    if (state.isDrawing) return;
    
    trackEvent('click_next_movie');

    stopTrailer();
    trailerContainer.style.display = 'none';
    if (playOverlay) playOverlay.style.display = 'flex';
    state.currentTrailerId = null;

    state.isDrawing = true;
    updateButtonState(true);
    
    resultView.style.display = 'none';
    slotView.style.display = 'flex';
    startInfiniteSpin();

    try {
        const history = getHistory();
        const cacheKey = `${state.selectedGenre}-${state.isKMovie}-${state.isNewMovie}-${state.selectedProvider}-${state.lang}`;

        let moviePool;
        if (state.moviePoolCache.key === cacheKey && state.moviePoolCache.movies.length > 0) {
            moviePool = state.moviePoolCache.movies;
        } else if (state.selectedProvider) {
            // N/D/P 단일 플랫폼: 3가지 정렬로 fetch 후 중복 제거
            const sortOrders = ['popularity.desc', 'vote_average.desc', 'revenue.desc'];
            const results = await Promise.all(
                sortOrders.map(sort => getMovies(state.selectedGenre, sort, state.selectedProvider))
            );
            const seen = new Set();
            moviePool = results.flat().filter(m => {
                if (seen.has(m.id)) return false;
                seen.add(m.id);
                return true;
            });
            state.moviePoolCache = { key: cacheKey, movies: moviePool };
        } else {
            // 플랫폼별 균등 비율: 각 OTT(Netflix/Disney+/Prime) × 3가지 정렬 → 9개 병렬 fetch
            const PROVIDER_IDS = [8, 337, 119];
            const sortOrders = ['popularity.desc', 'vote_average.desc', 'revenue.desc'];
            const allResults = await Promise.all(
                PROVIDER_IDS.flatMap(pid =>
                    sortOrders.map(sort => getMovies(state.selectedGenre, sort, pid))
                )
            );
            // 플랫폼별로 3개 정렬 결과 합산 후 중복 제거
            const providerPools = PROVIDER_IDS.map((_, i) => {
                const seen = new Set();
                return allResults.slice(i * 3, i * 3 + 3).flat().filter(m => {
                    if (seen.has(m.id)) return false;
                    seen.add(m.id);
                    return true;
                });
            });
            // 라운드로빈 방식으로 균등 merge (플랫폼별 동일 슬롯 보장)
            const seen = new Set();
            moviePool = [];
            const maxLen = Math.max(...providerPools.map(p => p.length));
            for (let i = 0; i < maxLen; i++) {
                for (const pool of providerPools) {
                    if (i < pool.length && !seen.has(pool[i].id)) {
                        seen.add(pool[i].id);
                        moviePool.push(pool[i]);
                    }
                }
            }
            state.moviePoolCache = { key: cacheKey, movies: moviePool };
        }

        if (moviePool.length === 0) throw new Error("No movies found.");

        // 히스토리 제외 후 후보 선정, 없으면 전체 pool 재사용
        let candidates = moviePool.filter(m => !history.includes(m.id));
        if (candidates.length === 0) candidates = moviePool;

        // 방안 A: pool이 이미 TMDB 기준 6.8+ 품질 보장 → 랜덤 선택
        const selectedMovie = candidates[Math.floor(Math.random() * candidates.length)];

        saveToHistory(selectedMovie.id);
        state.currentMovie = selectedMovie;

        // 선택된 1편에 대해서만 상세 정보 병렬 fetch
        const [fullInfo, selectedOmdb] = await Promise.all([
            fetchFullInfo(selectedMovie.id),
            fetchOMDb(selectedMovie),
        ]);
        state.currentOmdb = selectedOmdb;

        const selectedCredits = fullInfo.credits;
        const selectedVideos = fullInfo.videos;
        const selectedOtt = { KR: fullInfo['watch/providers']?.results?.KR || {} };

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

async function fetchOMDb(movie) {
    try {
        const extRes = await fetch(`${CONFIG.TMDB_BASE}/movie/${movie.id}/external_ids?api_key=${CONFIG.TMDB_KEY}`);
        if (!extRes.ok) return { imdbRating: '--', rtRating: '--', imdbId: null };
        const extData = await extRes.json();
        const realImdbId = extData.imdb_id;
        let url = `${CONFIG.OMDB_BASE}?apikey=${CONFIG.OMDB_KEY}&t=${encodeURIComponent(movie.original_title || movie.title)}`;
        if (realImdbId) url = `${CONFIG.OMDB_BASE}?apikey=${CONFIG.OMDB_KEY}&i=${realImdbId}`;
        const res = await fetch(url);
        if (!res.ok) return { imdbRating: '--', rtRating: '--', imdbId: realImdbId || null };
        const data = await res.json();
        return {
            imdbRating: data.imdbRating || '--',
            rtRating: data.Ratings?.find(r => r.Source.includes('Rotten'))?.Value || '--',
            imdbId: realImdbId || data.imdbID
        };
    } catch (e) { return { imdbRating: '--', rtRating: '--', imdbId: null }; }
}

async function fetchFullInfo(movieId, overrideLang = null) {
    try {
        const lang = overrideLang || (state.lang === 'KO' ? 'ko-KR' : 'en-US');
        const res = await fetch(`${CONFIG.TMDB_BASE}/movie/${movieId}?api_key=${CONFIG.TMDB_KEY}&language=${lang}&append_to_response=videos,credits,watch/providers`);
        if (!res.ok) return {};
        return await res.json();
    } catch (e) { return {}; }
}

function findBestTrailer(videos) {
    if (!videos || !Array.isArray(videos)) return null;
    const ytVideos = videos.filter(v => v.site === 'YouTube');
    if (ytVideos.length === 0) return null;
    const trailerKws = ['Trailer', '예고편'];
    let best = ytVideos.find(v => trailerKws.some(tk => v.name.toLowerCase().includes(tk.toLowerCase())));
    return best?.key || ytVideos[0]?.key || null;
}

function updateButtonState(drawing) {
    drawBtn.disabled = drawing;
    drawBtn.textContent = drawing ? I18N[state.lang].drawing : I18N[state.lang].draw;
    drawBtn.classList.toggle('drawing', drawing);
}

function startInfiniteSpin() {
    slotTrack.style.transition = 'none';
    slotTrack.style.transform = 'translate3d(0, 0, 0)';
    slotTrack.innerHTML = '';
    const ticketDiv = document.createElement('div');
    ticketDiv.className = 'slot-item placeholder';
    ticketDiv.innerHTML = '<span class="ticket-icon">🎟️</span>';
    slotTrack.appendChild(ticketDiv);
    for(let i=0; i<5; i++) {
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
        const itemHeight = document.querySelector('.slot-window').offsetHeight || 400;
        const totalDist = (sequenceCount - 1) * itemHeight;
        slotTrack.classList.add('spinning');
        slotTrack.style.transition = 'transform 1.4s cubic-bezier(0.45, 0.05, 0.55, 0.95)';
        slotTrack.offsetHeight; 
        slotTrack.style.transform = `translate3d(0, -${totalDist}px, 0)`;
        setTimeout(() => {
            slotTrack.classList.remove('spinning');
            resolve();
        }, 1500); 
    });
}

async function showResult(movie, omdb, credits, ott) {
    const posterImg = document.getElementById('res-poster');
    posterImg.classList.remove('loaded');
    posterImg.src = `${CONFIG.IMG_URL}${movie.poster_path}`;
    posterImg.onload = () => posterImg.classList.add('loaded');

    document.getElementById('res-overview').textContent = movie.overview || (state.lang === 'KO' ? "영화 설명이 없습니다." : "No overview available.");
    
    const titleEl = document.getElementById('res-title');
    const imdbId = omdb?.imdbId;
    titleEl.innerHTML = '';
    const titleLink = document.createElement('a');
    if (imdbId) {
        titleLink.href = `https://www.imdb.com/title/${imdbId}/`;
        titleLink.target = '_blank';
    }
    titleLink.addEventListener('click', e => e.stopPropagation());
    titleLink.textContent = movie.title;
    titleEl.appendChild(titleLink);

    const releaseDate = movie.release_date ? new Date(movie.release_date) : null;
    if (releaseDate) {
        const yearSpan = document.createElement('span');
        yearSpan.className = 'release-year';
        yearSpan.textContent = `(${releaseDate.getFullYear()})`;
        titleEl.appendChild(yearSpan);

        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        if (releaseDate >= oneYearAgo) {
            const badge = document.createElement('span');
            badge.className = 'new-badge';
            badge.textContent = 'NEW';
            titleEl.appendChild(badge);
        }
    }
    titleEl.onclick = (e) => e.stopPropagation();
    document.getElementById('res-rating-tmdb').textContent = `TMDB ${(movie.vote_average ?? 0).toFixed(1)}`;
    document.getElementById('res-rating-imdb').textContent = `IMDb ${omdb?.imdbRating || '--'}`;
    document.getElementById('res-rating-rt').textContent = `Rotten ${omdb?.rtRating || '--'}`;

    const directorObj = credits?.crew?.find(c => c.job === 'Director');
    const topCast = credits?.cast?.slice(0, 3) || [];
    const peopleImdb = await Promise.all([...(directorObj ? [directorObj] : []), ...topCast].map(async p => {
        try {
            const res = await fetch(`${CONFIG.TMDB_BASE}/person/${p.id}/external_ids?api_key=${CONFIG.TMDB_KEY}`);
            if (!res.ok) return { id: p.id, imdbId: null };
            const data = await res.json();
            return { id: p.id, imdbId: data.imdb_id };
        } catch {
            return { id: p.id, imdbId: null };
        }
    }));

    const escapeHtml = (str) => String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const getPLink = (p) => {
        const d = peopleImdb.find(x => x.id === p.id);
        const name = escapeHtml(p.name || p.original_name);
        if (d?.imdbId) return `<a class="credit-link" href="https://www.imdb.com/name/${d.imdbId}/" target="_blank" onclick="event.stopPropagation();">${name}</a>`;
        return `<span>${name}</span>`;
    };

    const labels = I18N[state.lang];
    document.getElementById('res-director').innerHTML = directorObj ? `${labels.director}: ${getPLink(directorObj)}` : `${labels.director}: N/A`;
    document.getElementById('res-cast').innerHTML = `${labels.cast}: ${topCast.map(p => getPLink(p)).join(', ') || 'N/A'}`;

    const ottList = document.getElementById('ott-list');
    ottList.innerHTML = '';
    const krData = ott?.KR || {};
    const providers = [...(krData.flatrate || []), ...(krData.rent || []), ...(krData.buy || [])]
        .filter((v, i, a) => a.findIndex(t => t.provider_id === v.provider_id) === i)
        .filter(p => [8, 337, 119].includes(p.provider_id))
        .slice(0, 3);

    if (providers.length > 0) {
        providers.forEach(p => {
            const item = document.createElement('div');
            item.className = 'ott-item';
            const deepLink = getKROttDeepLink(p.provider_id, movie.title);
            item.innerHTML = `<a href="${deepLink}" target="_blank" onclick="openOttLink(${p.provider_id}, '${deepLink}', event);"><div class="ott-icon-small"><img src="https://image.tmdb.org/t/p/original${p.logo_path}" alt="OTT"></div></a>`;
            ottList.appendChild(item);
        });
    } else {
        ottList.innerHTML = `<span style="opacity:0.5;">${labels.noOtt}</span>`;
    }

    playOverlay.style.display = state.currentTrailerId ? 'flex' : 'none';
    slotView.style.display = 'none';
    resultView.style.display = 'flex';
}

function getKROttDeepLink(pId, title) {
    const q = encodeURIComponent(title);
    if (pId === 8) return `https://www.netflix.com/search?q=${q}`;
    if (pId === 337) return `https://www.disneyplus.com/ko-kr/browse/search`;
    if (pId === 119) return `https://www.primevideo.com/search/ref=atv_nb_sug?ie=UTF8&phrase=${q}`;
    return `https://www.google.com/search?q=${q}+OTT`;
}

function openOttLink(pId, webUrl, e) {
    e.stopPropagation();
    e.preventDefault();
    if (pId === 119) {
        var t = setTimeout(function() { window.open(webUrl, '_blank'); }, 1500);
        window.addEventListener('blur', function() { clearTimeout(t); }, { once: true });
        window.location = 'primevideo://';
    } else {
        window.open(webUrl, '_blank');
    }
}

function playTrailer(e) {
    if (e) { e.stopPropagation(); if (e.cancelable) e.preventDefault(); }
    if (!state.currentTrailerId || !state.isApiReady) return;
    stopTrailer();
    trailerContainer.innerHTML = '<div id="yt-player"></div>';
    trailerContainer.style.display = 'block';
    if (playOverlay) playOverlay.style.display = 'none';
    state.player = new YT.Player('yt-player', {
        height: '100%', width: '100%', videoId: state.currentTrailerId,
        playerVars: { 'autoplay': 1, 'controls': 1, 'rel': 0, 'origin': 'https://cinelotto.com', 'playsinline': 1, 'enablejsapi': 1 },
        events: { 'onReady': (ev) => ev.target.playVideo() }
    });
}

function stopTrailer() {
    if (state.player) { try { state.player.destroy(); } catch (err) {} state.player = null; }
    trailerContainer.innerHTML = '';
}

function resetApp() {
    if (state.isDrawing) return;
    sessionStorage.removeItem('recommend_history');
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
    state.moviePoolCache = { key: null, movies: [] };
    await fetchGenres();
    renderGenres();

    // 결과 카드가 표시 중이면 새 언어로 즉시 재렌더
    if (state.currentMovie && resultView.style.display !== 'none') {
        const fullInfo = await fetchFullInfo(state.currentMovie.id);
        // TMDB가 현재 언어로 제목/줄거리를 반환하므로 movie 객체도 업데이트
        state.currentMovie = { ...state.currentMovie, ...fullInfo };
        const credits = fullInfo.credits;
        const ott = { KR: fullInfo['watch/providers']?.results?.KR || {} };
        await showResult(state.currentMovie, state.currentOmdb, credits, ott);
    }
}

function updateLangUI() {
    const labels = I18N[state.lang];
    langToggle.textContent = state.lang;
    document.getElementById('hero-msg').textContent = labels.hero;
    document.getElementById('trust-msg').textContent = labels.trust;
    drawBtn.textContent = labels.draw;
}

window.handleDrawClick = handleDrawClick;
window.resetApp = resetApp;
window.toggleTheme = toggleTheme;
window.toggleLanguage = toggleLanguage;
window.playTrailer = playTrailer;
init();
