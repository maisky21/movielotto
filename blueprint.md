# Movie Lotto Project Blueprint (Refactored Engine)

## Project Overview
Movie Lotto is a "lottery-style" movie recommendation app. This refactored version uses a consolidated engine for better performance, reliable data fetching, and a smoother slot machine experience.

## Features & Design (New Requirements)
- **Consolidated Engine:** A robust `async/await` logic that prevents "stuck" states by expanding genre searches if high-rated (7.0+) movies are scarce.
- **Slot Machine 2.0:** A visual-first slot machine animation where posters fly by before revealing the final choice. The "Next Movie" button transforms into "Drawing..." and is disabled during the process.
- **Deep Linking & Interaction:** OTT icons now link directly to the movie's streaming page. `stopPropagation()` is applied to prevent accidental redraws when clicking OTT links.
- **High-Contrast Theme:**
    - **Light Mode:** Black button with white text for maximum legibility.
    - **Dark Mode:** Fluorescent green (Neon) button with black text.
- **Mobile-First (iPhone 12 Optimized):** Large, readable text in the main display box (yellow highlight style) and oversized icons for easy touch interaction.
- **Reset Logic:** Clicking the top logo resets the application state instantly.

## Technical Stack
- **HTML5/CSS3:** Vanilla CSS for maximum control and performance.
- **JavaScript (ES Modules):** Clean, modular code in `main.js`.
- **TMDB API:** Movie data, genres, and watch providers.
- **OMDb API:** IMDb and Rotten Tomatoes ratings.

## Implementation Steps
1. [x] **UI Refactor:** Implement the new high-contrast CSS and mobile-centric layout.
2. [x] **Animation Engine:** Build the vertical scrolling slot machine using CSS transitions and JS orchestration.
3. [x] **Data Logic:** Implement the smart filtering and genre expansion logic.
4. [x] **Interaction Fixes:** Apply `stopPropagation` and deep link logic to OTT providers.
5. [x] **Validation:** Test on mobile viewports and verify dark/light mode contrast.
6. [x] **UI/UX Polish (Current):** Refactor poster/card ratios for better visual balance on all devices.

## Future Roadmap
1. [x] **Recommendation History:** Store the last 5 recommended movies in `localStorage` for users to revisit.
2. [ ] **Advanced Filtering:** Add options to filter by release year (e.g., 2010s, 2020s) and specific rating thresholds.
3. [x] **Visual Polish:** Add a "glow" pulse animation to the Neon button during the "Drawing..." state.

