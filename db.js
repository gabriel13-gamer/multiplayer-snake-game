const fs = require('fs').promises;
const path = require('path');

const LEADERBOARD_FILE = path.join(__dirname, 'leaderboard.json');

// Initialize leaderboard from file or create new one
async function initLeaderboard() {
    try {
        const data = await fs.readFile(LEADERBOARD_FILE, 'utf8');
        return new Map(Object.entries(JSON.parse(data)));
    } catch (error) {
        return new Map();
    }
}

// Save leaderboard to file
async function saveLeaderboard(leaderboard) {
    const data = Object.fromEntries(leaderboard);
    await fs.writeFile(LEADERBOARD_FILE, JSON.stringify(data, null, 2));
}

// Initialize the leaderboard
let inMemoryLeaderboard;
(async () => {
    inMemoryLeaderboard = await initLeaderboard();
})();

// Leaderboard functions
const leaderboardFunctions = {
    // Get top 10 scores
    getLeaderboard: async () => {
        return Array.from(inMemoryLeaderboard.values())
            .sort((a, b) => b.score - a.score)
            .slice(0, 10);
    },

    // Check if player name exists
    checkPlayerName: async (name) => {
        // Only check for active players, allow reusing names
        return false;
    },

    // Update or create player score
    upsertScore: async (name, score) => {
        const existingScore = inMemoryLeaderboard.get(name)?.score || 0;
        // Always store the highest score achieved
        if (score >= existingScore) {
            const playerData = {
                name,
                score,
                last_updated: new Date().toISOString()
            };
            inMemoryLeaderboard.set(name, playerData);
            await saveLeaderboard(inMemoryLeaderboard);
            return playerData;
        }
        return inMemoryLeaderboard.get(name);
    }
};

module.exports = leaderboardFunctions; 