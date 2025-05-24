const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const db = require('./db');
const { SKINS, TASKS } = require('./public/store');
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

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve index.html for the root route and client-side routes
app.get('/*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

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
    socket.on('initPlayer', (data) => {
        const { name, color } = data;
        
        // Remove any existing player with the same name
        for (const [id, player] of players.entries()) {
            if (player.name === name) {
                players.delete(id);
            }
        }
        
        // Store player data - always reset snake to (10, 10)
        players.set(socket.id, {
            name,
            color,
            score: 0,
            snake: [{x: 10, y: 10}]
        });
        
        // Send initial data to the player
        socket.emit('initPlayer', {
            name,
            color
        });
        
        // Notify other players
        socket.broadcast.emit('playerJoined', {
            name,
            color,
            snake: [{x: 10, y: 10}]
        });
        
        // Update leaderboard
        updateLeaderboard();
    });

    // Handle player updates
    socket.on('update', (data) => {
        const player = players.get(socket.id);
        if (player) {
            player.snake = data.snake;
            player.score = data.score;
            socket.broadcast.emit('updatePlayer', {
                name: player.name,
                snake: data.snake,
                score: data.score
            });
            updateLeaderboard();
        }
    });

    // Handle score updates
    socket.on('updateScore', async (data) => {
        try {
            const player = players.get(socket.id);
            if (player) {
                player.score = data.score;

                // Update score in leaderboard
                const playerData = await db.upsertScore(player.name, player.score);

                // Check for completed tasks
                if (playerData.scores.length > 0) {
                    const latestScore = playerData.scores[playerData.scores.length - 1].score;
                    
                    // Check score tasks
                    if (latestScore >= 50 && !playerData.completedTasks.includes('score50')) {
                        await db.completeTask(player.name, 'score50');
                        await db.addCoins(player.name, TASKS.score50.reward);
                        socket.emit('taskCompleted', {
                            task: TASKS.score50,
                            coins: TASKS.score50.reward
                        });
                    }
                    
                    if (latestScore >= 150 && !playerData.completedTasks.includes('score150')) {
                        await db.completeTask(player.name, 'score150');
                        await db.addCoins(player.name, TASKS.score150.reward);
                        socket.emit('taskCompleted', {
                            task: TASKS.score150,
                            coins: TASKS.score150.reward
                        });
                    }
                }

                // Check games played task
                if (playerData.gamesPlayed >= 5 && !playerData.completedTasks.includes('play5')) {
                    await db.completeTask(player.name, 'play5');
                    await db.addCoins(player.name, TASKS.play5.reward);
                    socket.emit('taskCompleted', {
                        task: TASKS.play5,
                        coins: TASKS.play5.reward
                    });
                }

                // Get updated leaderboard
                const leaderboard = await db.getLeaderboard();
                io.emit('leaderboardUpdate', leaderboard);
            }
        } catch (error) {
            console.error('Error updating score:', error);
        }
    });

    // Get player data
    socket.on('getPlayerData', async (callback) => {
        try {
            const player = players.get(socket.id);
            if (player) {
                const playerData = await db.getPlayerData(player.name);
                callback(playerData);
            }
        } catch (error) {
            console.error('Error getting player data:', error);
            callback(null);
        }
    });

    // Purchase skin
    socket.on('purchaseSkin', async (skinId, callback) => {
        try {
            const player = players.get(socket.id);
            if (player) {
                const playerData = await db.getPlayerData(player.name);
                const skin = SKINS[skinId];

                if (!skin) {
                    callback({ success: false, message: 'Skin not found' });
                    return;
                }

                if (playerData.ownedSkins.includes(skinId)) {
                    callback({ success: false, message: 'Skin already owned' });
                    return;
                }

                if (playerData.coins < skin.price) {
                    callback({ success: false, message: 'Not enough coins' });
                    return;
                }

                // Deduct coins and add skin
                playerData.coins -= skin.price;
                await db.purchaseSkin(player.name, skinId);
                
                callback({ 
                    success: true, 
                    message: 'Skin purchased successfully',
                    playerData
                });
            }
        } catch (error) {
            console.error('Error purchasing skin:', error);
            callback({ success: false, message: 'Error purchasing skin' });
        }
    });

    // Get available tasks
    socket.on('getTasks', async (callback) => {
        try {
            const player = players.get(socket.id);
            if (player) {
                const playerData = await db.getPlayerData(player.name);
                const availableTasks = Object.values(TASKS).filter(task => 
                    !playerData.completedTasks.includes(task.id)
                );
                callback(availableTasks);
            }
        } catch (error) {
            console.error('Error getting tasks:', error);
            callback([]);
        }
    });

    // Handle player disconnect
    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        const player = players.get(socket.id);
        if (player) {
            socket.broadcast.emit('playerLeft', {
                name: player.name
            });
            players.delete(socket.id);
            updateLeaderboard();
        }
    });
});

function updateLeaderboard() {
    // Get all scores from all players
    const allScores = Array.from(players.values()).flatMap(player => {
        const scores = Array.isArray(player.scores) ? player.scores : [{
            name: player.name,
            score: player.score
        }];
        return scores;
    });

    // Sort by score in descending order
    const leaderboard = allScores.sort((a, b) => b.score - a.score);
    
    io.emit('updateLeaderboard', leaderboard);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
}); 