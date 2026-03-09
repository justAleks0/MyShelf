# MyShelf

Your personal collection showcase. Built with Firebase.

## Project structure

```
MyShelf/
├── public/                 # Firebase hosting root (deployed as site root)
│   ├── index.html           # Home / collection page
│   ├── 404.html             # Not found page
│   ├── css/
│   │   └── styles.css       # Global styles
│   ├── js/
│   │   ├── firebase-config.js
│   │   ├── script.js        # Main collection app
│   │   ├── auth.js
│   │   ├── feed.js
│   │   ├── explore.js
│   │   ├── social.js
│   │   ├── user.js
│   │   └── settings.js
│   └── pages/
│       ├── auth.html
│       ├── explore.html
│       ├── feed.html
│       ├── social.html
│       ├── user.html
│       └── settings.html
├── firebase.json
├── .firebaserc
└── .gitignore
```

Place `logo.png` and `favicon.ico` in `public/` if you use them (referenced as `/logo.png` and `/favicon.ico`).

## Run locally

```bash
firebase serve
```

## Deploy

```bash
firebase deploy
```
