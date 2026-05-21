/**
 * Planning Poker - real-time multi-user server.
 * Express serves static client; Socket.IO manages rooms, votes, reveal, reset.
 */
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const express = require('express');
const QRCode = require('qrcode');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.json());
app.use((req, res, next) => {
    if (req.path === '/' || req.path.endsWith('/index.html')) {
        res.setHeader('Cache-Control', 'no-store, must-revalidate');
    }
    next();
});
app.use(express.static(path.join(__dirname, 'public')));

const DECKS = {
    fibonacci: ['0', '1', '2', '3', '5', '8', '13', '21', '34', '55', '89', '?', '☕'],
    modified: ['0', '½', '1', '2', '3', '5', '8', '13', '20', '40', '100', '?', '☕'],
    tshirt: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '?', '☕'],
    powers: ['0', '1', '2', '4', '8', '16', '32', '64', '?', '☕'],
};

// rooms: { [roomId]: { name, deckId, deck, revealed, story, moderatorId, settings, users } }
const rooms = Object.create(null);

function defaultSettings() {
    return {
        whoReveal: 'all',     // 'all' | 'mod'
        whoManage: 'all',     // 'all' | 'mod'
        autoReveal: false,
        funFeatures: true,
        showAverage: true,
        showCountdown: true,
    };
}

function createRoom({ name, deckId, deck, settings }) {
    const id = crypto.randomBytes(6).toString('base64url');
    let resolvedDeck;
    let resolvedDeckId;
    if (Array.isArray(deck) && deck.length >= 2) {
        resolvedDeck = deck
            .map((v) => String(v).trim())
            .filter(Boolean)
            .slice(0, 20);
        resolvedDeckId = 'custom';
    } else if (DECKS[deckId]) {
        resolvedDeck = DECKS[deckId];
        resolvedDeckId = deckId;
    } else {
        resolvedDeck = DECKS.fibonacci;
        resolvedDeckId = 'fibonacci';
    }
    rooms[id] = {
        name: name || 'Planning Poker',
        deckId: resolvedDeckId,
        deck: resolvedDeck,
        revealed: false,
        story: '',
        moderatorId: null,
        facilitators: [],
        settings: { ...defaultSettings(), ...(settings || {}) },
        users: {},
        votingHistory: [],
        roundStartTime: Date.now(),
    };
    return id;
}

// REST: create room
app.post('/api/rooms', (req, res) => {
    const { name, deckId, deck, settings } = req.body || {};
    const id = createRoom({ name, deckId, deck, settings });
    res.json({ roomId: id });
});

// REST: room exists?
app.get('/api/rooms/:id', (req, res) => {
    const r = rooms[req.params.id];
    if (!r) return res.status(404).json({ error: 'not_found' });
    res.json({ name: r.name, deckId: r.deckId, settings: r.settings });
});

// REST: QR code PNG for any text (used by invite modal)
app.get('/api/qr', async (req, res) => {
    const text = String(req.query.text || '').slice(0, 2000);
    if (!text) return res.status(400).end();
    try {
        const buf = await QRCode.toBuffer(text, {
            type: 'png',
            margin: 1,
            width: 320,
            color: { dark: '#1a2235', light: '#ffffff' },
        });
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=300');
        res.end(buf);
    } catch (e) {
        res.status(500).end();
    }
});

function roomSnapshot(room) {
    const users = Object.entries(room.users).map(([id, u]) => ({
        id,
        name: u.name,
        spectator: !!u.spectator,
        hasVoted: u.vote !== null && u.vote !== undefined,
        vote: room.revealed ? u.vote : null,
        isModerator: id === room.moderatorId,
        isFacilitator: room.facilitators.includes(id) || id === room.moderatorId,
    }));
    return {
        name: room.name,
        deckId: room.deckId,
        deck: room.deck,
        revealed: room.revealed,
        story: room.story,
        moderatorId: room.moderatorId,
        facilitators: room.facilitators,
        settings: room.settings,
        users,
        votingHistory: room.votingHistory || [],
    };
}

function broadcast(roomId) {
    const room = rooms[roomId];
    if (!room) return;
    io.to(roomId).emit('room:state', roomSnapshot(room));
}

function maybeAutoReveal(room, roomId) {
    if (!room.settings.autoReveal || room.revealed) return;
    const voters = Object.entries(room.users).filter(([, u]) => !u.spectator);
    if (voters.length > 0 && voters.every(([, u]) => u.vote != null)) {
        room.revealed = true;
        // Save to history
        const voted = voters.filter(([, u]) => u.vote != null);
        const playerResults = voted.map(([, u]) => u.name + ' (' + u.vote + ')').join(', ');
        const votes = voted.map(([, u]) => u.vote);
        const numVotes = votes.map(Number).filter((n) => !Number.isNaN(n));
        const result = numVotes.length ? (Math.round((numVotes.reduce((a, b) => a + b, 0) / numVotes.length) * 10) / 10).toString() : votes[0] || '-';
        const uniqueVotes = new Set(votes).size;
        let agreement = 'low';
        if (uniqueVotes === 1) agreement = 'high';
        else if (uniqueVotes === 2) agreement = 'mid';
        const duration = room.roundStartTime ? Math.round((Date.now() - room.roundStartTime) / 1000) : 0;
        room.votingHistory.push({
            issue: room.story || '-',
            result,
            agreement,
            duration,
            date: Date.now(),
            votedCount: voted.length,
            totalCount: voters.length,
            playerResults,
        });
        io.to(roomId).emit('reveal:countdown', { duration: room.settings.showCountdown ? 3 : 0 });
        broadcast(roomId);
    }
}

function canReveal(room, socketId) {
    if (room.settings.whoReveal === 'all') return true;
    return socketId === room.moderatorId || room.facilitators.includes(socketId);
}

io.on('connection', (socket) => {
    let currentRoomId = null;

    socket.on('room:join', ({ roomId, userName, spectator }) => {
        if (!roomId || !userName) return;
        const room = rooms[roomId];
        if (!room) {
            socket.emit('room:error', { code: 'not_found' });
            return;
        }
        currentRoomId = roomId;
        room.users[socket.id] = {
            name: String(userName).slice(0, 32),
            vote: null,
            spectator: !!spectator,
        };
        if (!room.moderatorId) room.moderatorId = socket.id;
        socket.join(currentRoomId);
        socket.emit('room:joined', { roomId: currentRoomId, selfId: socket.id });
        broadcast(currentRoomId);
    });

    socket.on('vote:cast', ({ value }) => {
        const room = rooms[currentRoomId];
        if (!room || room.revealed) return;
        const user = room.users[socket.id];
        if (!user || user.spectator) return;
        if (!room.deck.includes(value)) return;
        user.vote = user.vote === value ? null : value;
        broadcast(currentRoomId);
        maybeAutoReveal(room, currentRoomId);
    });

    socket.on('vote:reveal', () => {
        const room = rooms[currentRoomId];
        if (!room || room.revealed) return;
        if (!canReveal(room, socket.id)) return;
        const duration = room.settings.showCountdown ? 3 : 0;
        io.to(currentRoomId).emit('reveal:countdown', { duration });
        setTimeout(() => {
            const r = rooms[currentRoomId];
            if (!r) return;
            r.revealed = true;
            // Save voting round to history
            const voters = Object.entries(r.users).filter(([, u]) => !u.spectator);
            const voted = voters.filter(([, u]) => u.vote != null);
            const playerResults = voted.map(([, u]) => u.name + ' (' + u.vote + ')').join(', ');
            const votes = voted.map(([, u]) => u.vote);
            const numVotes = votes.map(Number).filter((n) => !Number.isNaN(n));
            const result = numVotes.length ? (Math.round((numVotes.reduce((a, b) => a + b, 0) / numVotes.length) * 10) / 10).toString() : votes[0] || '-';
            const uniqueVotes = new Set(votes).size;
            let agreement = 'low';
            if (uniqueVotes === 1) agreement = 'high';
            else if (uniqueVotes === 2) agreement = 'mid';
            const duration = r.roundStartTime ? Math.round((Date.now() - r.roundStartTime) / 1000) : 0;
            r.votingHistory.push({
                issue: r.story || '-',
                result,
                agreement,
                duration,
                date: Date.now(),
                votedCount: voted.length,
                totalCount: voters.length,
                playerResults,
            });
            broadcast(currentRoomId);
        }, duration * 1000);
    });

    socket.on('vote:reset', () => {
        const room = rooms[currentRoomId];
        if (!room) return;
        if (!canReveal(room, socket.id)) return;
        room.revealed = false;
        room.roundStartTime = Date.now();
        for (const u of Object.values(room.users)) u.vote = null;
        broadcast(currentRoomId);
    });

    socket.on('story:set', ({ story }) => {
        const room = rooms[currentRoomId];
        if (!room) return;
        room.story = String(story || '').slice(0, 200);
        broadcast(currentRoomId);
    });

    socket.on('user:toggleSpectator', () => {
        const room = rooms[currentRoomId];
        if (!room) return;
        const u = room.users[socket.id];
        if (!u) return;
        u.spectator = !u.spectator;
        if (u.spectator) u.vote = null;
        broadcast(currentRoomId);
        maybeAutoReveal(room, currentRoomId);
    });

    socket.on('user:setModerator', ({ targetId, isModerator }) => {
        const room = rooms[currentRoomId];
        if (!room) return;
        // Only current moderator or facilitators can change facilitators
        if (socket.id !== room.moderatorId && !room.facilitators.includes(socket.id)) return;
        const target = room.users[targetId];
        if (!target) return;
        if (isModerator) {
            // Transfer moderator role
            room.moderatorId = targetId;
        }
        broadcast(currentRoomId);
    });

    socket.on('user:addFacilitator', ({ targetId }) => {
        const room = rooms[currentRoomId];
        if (!room) return;
        if (socket.id !== room.moderatorId && !room.facilitators.includes(socket.id)) return;
        const target = room.users[targetId];
        if (!target) return;
        if (!room.facilitators.includes(targetId) && targetId !== room.moderatorId) {
            room.facilitators.push(targetId);
        }
        broadcast(currentRoomId);
    });

    socket.on('user:removeFacilitator', ({ targetId }) => {
        const room = rooms[currentRoomId];
        if (!room) return;
        if (socket.id !== room.moderatorId && !room.facilitators.includes(socket.id)) return;
        room.facilitators = room.facilitators.filter((id) => id !== targetId);
        broadcast(currentRoomId);
    });

    socket.on('room:leave', () => {
        const room = rooms[currentRoomId];
        if (!room) return;
        socket.leave(currentRoomId);
        delete room.users[socket.id];
        room.facilitators = room.facilitators.filter((id) => id !== socket.id);
        if (room.moderatorId === socket.id) {
            const remaining = Object.keys(room.users);
            room.moderatorId = remaining[0] || null;
        }
        if (Object.keys(room.users).length === 0) {
            delete rooms[currentRoomId];
        } else {
            broadcast(currentRoomId);
        }
        currentRoomId = null;
        socket.emit('room:left');
    });

    socket.on('disconnect', () => {
        const room = rooms[currentRoomId];
        if (!room) return;
        delete room.users[socket.id];
        room.facilitators = room.facilitators.filter((id) => id !== socket.id);
        if (room.moderatorId === socket.id) {
            const remaining = Object.keys(room.users);
            room.moderatorId = remaining[0] || null;
        }
        if (Object.keys(room.users).length === 0) {
            delete rooms[currentRoomId];
        } else {
            broadcast(currentRoomId);
            maybeAutoReveal(room, currentRoomId);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Planning Poker running at http://localhost:${PORT}`);
});
