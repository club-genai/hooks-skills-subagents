const slides = [
    'slides/01-intro.html',
    'slides/02-sfeir.html',
    'slides/03-menu.html',
    'slides/04-part1.html',
    'slides/05-part2.html',
    'slides/06-part3.html',
    'slides/07-part4.html',
    'slides/08-conclusion.html'
];

async function loadSlidesAndInit() {
    const slidesContainer = document.querySelector('.slides');
    
    try {
        // Fetch all slide files in order
        const slidePromises = slides.map(url => fetch(url).then(res => {
            if (!res.ok) throw new Error(`Failed to load ${url}`);
            return res.text();
        }));
        
        const slideContents = await Promise.all(slidePromises);
        
        // Append all HTML content to the slide container
        slidesContainer.innerHTML = slideContents.join('');

        // Initialize Reveal.js after HTML is fully in DOM
        Reveal.initialize({
            hash: true,
            slideNumber: 'c/t',
            controls: true,
            progress: true,
            center: false,
            margin: 0.1,
            width: 1050,
            height: 700,
            minScale: 0.2,
            maxScale: 2.0
        });
        
    } catch (error) {
        console.error("Error loading slides:", error);
        slidesContainer.innerHTML = `<section><h2>Error parsing slides</h2><p>${error.message}</p><p>Assurez-vous de lancer l'application via un serveur local (ex: Python HTTP Server) pour contourner les erreurs CORS.</p></section>`;
    }
}

// Run the loader on DOM Ready
document.addEventListener('DOMContentLoaded', loadSlidesAndInit);
