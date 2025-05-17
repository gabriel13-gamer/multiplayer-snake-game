const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const db = require('./db');
require('dotenv').config({ path: '.env.local' });

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Enable CORS
app.use(cors());

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static files with correct MIME types
app.get('/game.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.sendFile(path.join(__dirname, 'game.js'));
});

app.get('/socket.io/socket.io.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.sendFile(path.join(__dirname, 'node_modules/socket.io/client-dist/socket.io.js'));
});

// Serve index.html and other static files
app.use(express.static(path.join(__dirname)));

// Store active players and their data
const players = new Map();

io.on('connection', (socket) => {
    console.log('New player connected:', socket.id);

    // Check if player name is available
    socket.on('checkName', async (name, callback) => {
        try {
            // Check active players
            const activeNameExists = Array.from(players.values()).some(player => player.name === name);
            // Check leaderboard
            const leaderboardNameExists = await db.checkPlayerName(name);
            
            callback(!(activeNameExists || leaderboardNameExists));
        } catch (error) {
            console.error('Error checking name:', error);
            callback(false);
        }
    });

    // Initialize player with validated name
    socket.on('initPlayer', async (playerName) => {
        try {
            // Double check if name is taken
            const activeNameExists = Array.from(players.values()).some(player => player.name === playerName);
            const leaderboardNameExists = await db.checkPlayerName(playerName);

            if (activeNameExists || leaderboardNameExists) {
                socket.emit('nameRejected');
                return;
            }

            players.set(socket.id, {
                id: socket.id,
                name: playerName,
                score: 0,
                snake: [],
                food: null
            });

            // Get current leaderboard
            const leaderboard = await db.getLeaderboard();

            // Send current players data to new player
            socket.emit('init', {
                playerId: socket.id,
                playerName: playerName,
                players: Array.from(players.values()),
                leaderboard: leaderboard
            });

            // Broadcast new player to others
            socket.broadcast.emit('playerJoined', players.get(socket.id));
        } catch (error) {
            console.error('Error initializing player:', error);
            socket.emit('error', 'Failed to initialize player');
        }
    });

    // Handle player updates
    socket.on('update', (data) => {
        const player = players.get(socket.id);
        if (player) {
            Object.assign(player, data);
            socket.broadcast.emit('playerMoved', player);
        }
    });

    // Handle score updates
    socket.on('updateScore', async (data) => {
        try {
            const player = players.get(socket.id);
            if (player) {
                player.score = data.score;

                // Update score in leaderboard
                await db.upsertScore(player.name, player.score);

                // Get updated leaderboard
                const leaderboard = await db.getLeaderboard();
                io.emit('leaderboardUpdate', leaderboard);
            }
        } catch (error) {
            console.error('Error updating score:', error);
        }
    });

    // Handle player disconnect
    socket.on('disconnect', async () => {
        console.log('Player disconnected:', socket.id);
        const player = players.get(socket.id);
        if (player) {
            try {
                // Update final score in leaderboard
                await db.upsertScore(player.name, player.score);

                // Get updated leaderboard
                const leaderboard = await db.getLeaderboard();

                players.delete(socket.id);
                io.emit('playerLeft', socket.id);
                io.emit('leaderboardUpdate', leaderboard);
            } catch (error) {
                console.error('Error handling disconnect:', error);
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 