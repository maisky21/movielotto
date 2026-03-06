# Movie Lotto Project Blueprint

## Project Overview
Movie Lotto is a modern, high-performance web application that provides a "lottery-style" movie recommendation experience. It uses a sophisticated slot-machine animation to reveal hand-picked, high-rated movies to the user.

## Features & Design
- **Expressive Typography:** Uses the 'Pretendard' font family for a premium, readable feel.
- **Dynamic Theming:** Supports both Light and Dark modes with smooth transitions.
- **Multilingual Support:** Fully localized in both Korean (ko-KR) and English (en-US).
- **Slot Machine Animation:** High-quality, interactive slot machine track that cycles through movie posters.
- **Rich Metadata:** Displays ratings from TMDB, IMDb, and Rotten Tomatoes, plus streaming provider information (OTT).
- **Responsive Layout:** Works seamlessly across mobile, tablet, and desktop viewports using CSS container queries and flexible layouts.

## Technical Stack
- **HTML5/CSS3:** Modern baseline features including CSS Variables, Flexbox, and Grid.
- **Tailwind CSS v4:** Used via CDN for rapid, expressive styling.
- **Vanilla JavaScript (ES Modules):** Clean, modular logic separated into `main.js`.
- **TMDB API:** Primary source for movie data, posters, and streaming providers.
- **OMDb API:** Secondary source for IMDb and Rotten Tomatoes ratings.

## Current Progress & Bug Fixes
- [x] **Logic Separation:** Moved all JavaScript from `index.html` to `main.js` for better maintainability and global function exposure.
- [x] **Robust Data Fetching:** Enhanced `fetchData` to handle empty results with fallbacks (vote_count >= 100, vote_average >= 6.0) and error states.
- [x] **Enhanced UX:** Added loading states ("추첨 중...", "데이터 로딩 중...") to the draw button.
- [x] **Error Handling:** Wrapped API calls in `try-catch` blocks and added `Promise.all` for parallel fetching with individual failure resilience.
- [x] **OTT Integration:** Displays available streaming providers (Netflix, Disney+, etc.) in Korea with deep links to TMDB watch pages.
- [x] **Global Function Exposure:** Ensured `startDraw`, `toggleTheme`, `toggleLanguage`, and `resetApp` are available globally for HTML event handlers.
