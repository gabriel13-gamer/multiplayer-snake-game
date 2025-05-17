const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

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

// Serve static files
app.use(express.static(path.join(__dirname)));

// Serve index.html for all routes to handle client-side routing
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Store active players and their data
const players = new Map();
// Store leaderboard data
let leaderboard = [];

// Initialize leaderboard storage
const LEADERBOARD_FILE = path.join(__dirname, 'leaderboard.json');

// Load leaderboard from file if it exists
try {
    if (fs.existsSync(LEADERBOARD_FILE)) {
        const leaderboardData = fs.readFileSync(LEADERBOARD_FILE, 'utf8');
        leaderboard = JSON.parse(leaderboardData);
        console.log('Loaded existing leaderboard:', leaderboard);
    } else {
        console.log('No existing leaderboard found, starting fresh');
        // Create empty leaderboard file
        fs.writeFileSync(LEADERBOARD_FILE, '[]', 'utf8');
    }
} catch (error) {
    console.error('Error loading leaderboard:', error);
    leaderboard = [];
}

// Function to save leaderboard to file
function saveLeaderboard() {
    try {
        fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify(leaderboard, null, 2), 'utf8');
        console.log('Leaderboard saved successfully');
    } catch (error) {
        console.error('Error saving leaderboard:', error);
    }
}

io.on('connection', (socket) => {
    console.log('New player connected:', socket.id);

    // Send leaderboard immediately on connection
    socket.emit('leaderboardUpdate', leaderboard);

    // Check if player name is available
    socket.on('checkName', (name, callback) => {
        // Check active players
        const activeNameExists = Array.from(players.values()).some(player => player.name === name);
        // Check leaderboard
        const leaderboardNameExists = leaderboard.some(entry => entry.name === name);
        
        callback(!(activeNameExists || leaderboardNameExists));
    });

    // Initialize player with validated name
    socket.on('initPlayer', (playerName) => {
        // Double check if name is taken (in both active players and leaderboard)
        const isNameTaken = Array.from(players.values()).some(player => player.name === playerName) ||
                          leaderboard.some(entry => entry.name === playerName);

        if (isNameTaken) {
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

        // Send current players data to new player
        socket.emit('init', {
            playerId: socket.id,
            playerName: playerName,
            players: Array.from(players.values()),
            leaderboard: leaderboard
        });

        // Broadcast new player to others
        socket.broadcast.emit('playerJoined', players.get(socket.id));
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
    socket.on('updateScore', (data) => {
        const player = players.get(socket.id);
        if (player) {
            player.score = data.score;
            updateLeaderboard();
        }
    });

    // Handle player disconnect
    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        const player = players.get(socket.id);
        if (player) {
            // Keep the score in the leaderboard even after disconnect
            updateLeaderboard();
            saveLeaderboard();
        }
        players.delete(socket.id);
        io.emit('playerLeft', socket.id);
    });
});

function updateLeaderboard() {
    // Get all scores from both active players and existing leaderboard
    const allScores = [...Array.from(players.values()), ...leaderboard];
    
    // Create a map to keep highest score for each player name
    const scoreMap = new Map();
    allScores.forEach(({name, score}) => {
        if (!scoreMap.has(name) || scoreMap.get(name) < score) {
            scoreMap.set(name, score);
        }
    });
    
    // Convert map back to array and sort
    const newLeaderboard = Array.from(scoreMap.entries())
        .map(([name, score]) => ({name, score}))
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);

    // Only update and save if there are actual changes
    if (JSON.stringify(leaderboard) !== JSON.stringify(newLeaderboard)) {
        leaderboard = newLeaderboard;
        saveLeaderboard();
        io.emit('leaderboardUpdate', leaderboard);
    }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 