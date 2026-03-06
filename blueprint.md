# Movie Lotto Project Blueprint

## Project Overview
Movie Lotto is a modern, high-performance web application that provides a "lottery-style" movie recommendation experience. It uses a sophisticated slot-machine animation and 3D card flipping to reveal hand-picked, high-rated movies to the user.

## Features & Design
- **Expressive Typography:** Uses the 'Pretendard' font family for a premium, readable feel.
- **Dynamic Theming:** Supports both Light and Dark modes with smooth transitions.
- **Multilingual Support:** Fully localized in both Korean (ko-KR) and English (en-US).
- **Genre Filtering:** Real-time genre chips fetched from TMDB allowing users to narrow down recommendations.
- **Slot Machine & 3D Flip:** A dual-stage reveal process starting with a slot machine animation followed by a dramatic 3D card flip reveal.
- **Result Sharing:** Integrated sharing bar for URL copying and native system sharing (Web Share API) for viral potential.
- **Rich Metadata:** Displays ratings from TMDB, IMDb, and Rotten Tomatoes, plus streaming provider information (OTT).
- **Responsive Layout:** Works seamlessly across mobile, tablet, and desktop viewports.

## Technical Stack
- **HTML5/CSS3:** Modern baseline features including 3D Transforms, CSS Variables, and Flexbox.
- **Tailwind CSS v4:** Used via CDN for rapid, expressive styling.
- **Vanilla JavaScript (ES Modules):** Clean, modular logic separated into `main.js`.
- **TMDB API:** Primary source for movie data, genres, and streaming providers.
- **OMDb API:** Secondary source for IMDb and Rotten Tomatoes ratings.

## Current Progress & Bug Fixes
- [x] **Genre Filter Chips:** Implemented dynamic genre loading and filtering logic.
- [x] **3D Card Flip Animation:** Added 'Lotto Card' back design and 3D transition for movie reveal.
- [x] **Share Bar Implementation:** Added native share and link copy buttons above the draw button.
- [x] **Logic Separation:** All logic moved to `main.js`.
- [x] **Global Function Exposure:** All interactive functions exposed for HTML event handlers.
