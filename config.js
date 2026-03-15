const SUPABASE_URL      = 'https://naagujwufjeqsgwmyrcv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5hYWd1and1ZmplcXNnd215cmN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzMjc0MTcsImV4cCI6MjA4ODkwMzQxN30.6MFjNVe2zz1lwGVYx9BSFco7hEZTjvBueGQABrq1apM';

const dbHeaders = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
};

function applyThemeBase(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    document.body.className = theme === 'photo' ? 'theme-photo' : '';
    document.querySelectorAll('.theme-btn').forEach(btn =>
        btn.classList.toggle('active', btn.dataset.theme === theme)
    );
    localStorage.setItem('theme', theme);
}

(function initTheme() {
    applyThemeBase(localStorage.getItem('theme') || 'dark');
})();
