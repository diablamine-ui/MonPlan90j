# Mon Plan de Vie 90 Jours

## Structure
```
monplan90/
├── api/generate.js      ← Route API Gemini (sécurisée)
├── src/
│   ├── main.jsx         ← Entry point React
│   └── App.jsx          ← Application complète
├── public/
│   ├── manifest.json    ← PWA
│   ├── sw.js            ← Service Worker
│   ├── icon-192.png
│   └── icon-512.png
├── index.html
├── vite.config.js
├── package.json
└── vercel.json
```

## Déploiement Vercel
1. Push sur GitHub
2. Import sur Vercel
3. Ajouter `GEMINI_API_KEY` dans Environment Variables
4. Deploy

Vercel détecte automatiquement Vite et compile le projet.
