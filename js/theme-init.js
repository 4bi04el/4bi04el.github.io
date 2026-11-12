// Runs before stylesheets to prevent a flash of the wrong theme.
(function () {
    var preference;
    try {
        preference = localStorage.getItem('devfolio-theme');
    } catch (error) { /* Storage can be unavailable in private/restricted contexts. */ }
    var dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.dataset.theme = preference === 'light' || preference === 'dark'
        ? preference : (dark ? 'dark' : 'light');
}());
