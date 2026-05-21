# Planning Poker

A real-time Planning Poker (Scrum Poker) web app inspired by tools like FlexJobs Grooming.

Features:
- Real-time multi-user rooms (Socket.IO)
- Fibonacci deck (0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, ?, ☕)
- Hidden votes until reveal
- Vote distribution, numeric average, and agreement indicator
- Spectator mode
- Shareable room link (`?room=your-room`)
- Story / ticket title input

## Run

```powershell
cd d:\ravinder\pockerplanning
npm install
npm start
```

Open http://localhost:3000 in multiple tabs/devices, join the same room name, and start estimating.

## Project structure

- [server.js](server.js) — Express + Socket.IO server, room state and broadcasting
- [public/index.html](public/index.html) — UI markup
- [public/styles.css](public/styles.css) — styling
- [public/app.js](public/app.js) — client logic (join, vote, reveal, results)
