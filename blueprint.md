# Movie Lotto Project Blueprint

## Project Overview
Movie Lotto is a web application that helps users pick a movie to watch through a fun, roulette-style animation. It features a sleek, Netflix-inspired dark mode UI and is designed to integrate with the TMDB API for real-time movie data.

## Features & Design
- **Netflix-Style UI:** High-contrast dark theme with vibrant red accents, utilizing Tailwind CSS for a premium feel.
- **Roulette Animation:** A fast-paced scrolling animation of movie posters that slows down to reveal a single "winning" movie.
- **TMDB Integration:** Ready-to-use structure for fetching popular or trending movies from the The Movie Database (TMDB).
- **Responsive Design:** Optimized for both desktop and mobile viewing.
- **Single-File Architecture:** All HTML, CSS (Tailwind), and JavaScript logic contained within `index.html` for simplicity.

## Technical Stack
- **HTML5:** Semantic structure.
- **CSS:** Tailwind CSS (v4 via CDN) for styling and custom CSS for the roulette animation.
- **JavaScript:** Vanilla JS for DOM manipulation, animation control, and API interaction.

## Development Plan
1. **Scaffold `index.html`:** Set up the basic structure with Tailwind CSS CDN.
2. **Design UI:** Create the header, main roulette area, and the "Pick a Movie" button.
3. **Implement Roulette Logic:**
    - Create a container for movie posters.
    - Implement a looping animation using CSS transitions/transforms.
    - Write JS to randomize the final stop position.
4. **TMDB Integration:**
    - Add a configuration section for the TMDB API Key.
    - Implement a `fetchMovies` function to get data from TMDB.
    - Fallback to mock data if no API key is provided.
5. **Polishing:** Add sound effects (optional/placeholder), transitions, and hover effects.

## Current Progress
- [x] Project Concept Defined
- [x] Blueprint Created
- [x] Implementation of `index.html`
- [x] Netflix-style UI Design
- [x] Roulette Animation Logic
- [x] TMDB API Integration Structure
