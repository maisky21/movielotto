# Movie Lotto Project Blueprint (Refactored Engine)

## Project Overview
Movie Lotto is a "lottery-style" movie recommendation app. This refactored version uses a consolidated engine for better performance, reliable data fetching, and a smoother slot machine experience.

## Features & Design (New Requirements)
- **SEO Optimization (robots.txt):**
    - **Global Access:** All search engine crawlers (User-agent: *) are permitted to index the site (Allow: /).
    - **Security/Privacy:** Critical system directories (`.git/`, `.idx/`, `.vscode/`) and temporary logs (`firebase-debug.log`) are explicitly disallowed from crawling.
    - **Sitemap Integration:** The official sitemap URL (`https://cinelotto.com/sitemap.xml`) is linked to guide crawlers efficiently.
- **Brand Identity (CINE LOTTO):**
    - **Visual Branding:** A premium text-based logo where "CINE" is crisp white (#FFFFFF) and "LOTTO" is radiant gold (#FFD700).
    - **Golden Shimmer Animation:** A low-overhead CSS animation that sends a subtle golden flash across the "LOTTO" text every 3 seconds, creating a high-end feel without performance impact.
    - **Golden Ball Icon:** The letter 'O' in "LOTTO" is styled as a golden slot machine ball with a soft glow effect.
    - **Interactive Feedback:** Micro-bounce animation on logo hover to enhance the user's "Jackpot" excitement.
- **Consolidated Engine:** A robust `async/await` logic that prevents "stuck" states by expanding genre searches if high-rated (7.0+) movies are scarce.
- **Slot Machine 2.0:** A visual-first slot machine animation where posters fly by before revealing the final choice. The "Next Movie" button transforms into "Drawing..." and is disabled during the process.
- **Deep Linking & Interaction:** OTT icons now link directly to the movie's streaming page. `stopPropagation()` is applied to prevent accidental redraws when clicking OTT links.
- **High-Contrast Theme:**
    - **Light Mode:** Black button with white text for maximum legibility.
    - **Dark Mode:** Fluorescent green (Neon) button with black text.
- **Mobile-First (iPhone 12 Optimized):** Large, readable text in the main display box (yellow highlight style) and oversized icons for easy touch interaction.
- **Reset Logic:** Clicking the top logo resets the application state instantly.
- **Stable YouTube Trailer Integration:**
    - **Clean Player View:** All interfering transparent layers and `pointer-events: none` settings have been removed to allow direct interaction with the YouTube player.
    - **Mobile Playback Stability:** `playsinline: 1` is enforced for immediate playback within the browser on mobile devices.
    - **Event Propagation Control:** Clicks on the trailer container are isolated (`stopPropagation`) to prevent accidental app resets or rewinding on PC.
    - **Session Sync:** Video stops automatically when drawing a new movie or resetting the app, ensuring clean state transitions.

## Technical Stack
- **HTML5/CSS3:** Vanilla CSS for maximum control and performance (using CSS variables, `@keyframes`, and `background-clip: text`).
- **JavaScript (ES Modules):** Clean, modular code in `main.js`.
- **TMDB API:** Movie data, genres, and watch providers.
- **OMDb API:** IMDb and Rotten Tomatoes ratings.
- **YouTube IFrame Player API:** Enhanced trailer playback.

## Implementation Steps
1. [x] **UI Refactor:** Implement the new high-contrast CSS and mobile-centric layout.
2. [x] **Animation Engine:** Build the vertical scrolling slot machine using CSS transitions and JS orchestration.
3. [x] **Data Logic:** Implement the smart filtering and genre expansion logic.
4. [x] **Interaction Fixes:** Apply `stopPropagation` and deep link logic to OTT providers.
5. [x] **Validation:** Test on mobile viewports and verify dark/light mode contrast.
6. [x] **UI/UX Polish:** Refactor poster/card ratios for better visual balance on all devices.
7. [x] **Cache Busting:** Add version parameters (`?v=20260311`) to `style.css` and `main.js` to force latest updates on mobile.
8. [x] **YouTube API Integration:** Implement the YouTube IFrame API with clean player logic (removed blocking layers and fixed bubbling).
9. [x] **Branding Update:** Implement the "CINE LOTTO" logo with Golden Shimmer animation.
10. [x] **SEO Optimization:** Create and configure `robots.txt` for better search engine crawling and security.

## Future Roadmap
1. [x] **Recommendation History:** Store the last 5 recommended movies in `localStorage` for users to revisit.
2. [ ] **Advanced Filtering:** Add options to filter by release year (e.g., 2010s, 2020s) and specific rating thresholds.
3. [x] **Visual Polish:** Add a "glow" pulse animation to the Neon button during the "Drawing..." state.
