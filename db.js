const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Get player data
async function getPlayerData(name) {
    try {
        const { data: player, error } = await supabase
            .from('players')
            .select('*')
            .eq('name', name)
            .single();

        if (error) throw error;

        if (!player) {
            // Create new player if doesn't exist
            const { data: newPlayer, error: insertError } = await supabase
                .from('players')
                .insert([
                    {
                        name,
                        coins: 50,
                        games_played: 0,
                        owned_skins: [],
                        completed_tasks: []
                    }
                ])
                .select()
                .single();

            if (insertError) throw insertError;

            return {
                name: newPlayer.name,
                coins: newPlayer.coins,
                gamesPlayed: newPlayer.games_played,
                ownedSkins: newPlayer.owned_skins,
                completedTasks: newPlayer.completed_tasks
            };
        }

        // If player exists but has less than 50 coins, update to 50
        if (player.coins < 50) {
            const { data: updatedPlayer, error: updateError } = await supabase
                .from('players')
                .update({ coins: 50 })
                .eq('name', name)
                .select()
                .single();

            if (updateError) throw updateError;

            return {
                name: updatedPlayer.name,
                coins: updatedPlayer.coins,
                gamesPlayed: updatedPlayer.games_played,
                ownedSkins: updatedPlayer.owned_skins,
                completedTasks: updatedPlayer.completed_tasks
            };
        }

        return {
            name: player.name,
            coins: player.coins,
            gamesPlayed: player.games_played,
            ownedSkins: player.owned_skins,
            completedTasks: player.completed_tasks
        };
    } catch (error) {
        console.error('Error in getPlayerData:', error);
        throw error;
    }
}

// Update player score
async function upsertScore(name, score) {
    try {
        // Insert new score
        const { error: scoreError } = await supabase
            .from('scores')
            .insert([
                {
                    player_name: name,
                    score: score
                }
            ]);

        if (scoreError) throw scoreError;

        // Increment games played
        const { error: updateError } = await supabase
            .from('players')
            .update({ games_played: supabase.rpc('increment_games_played') })
            .eq('name', name);

        if (updateError) throw updateError;

        // Get updated player data
        return await getPlayerData(name);
    } catch (error) {
        console.error('Error in upsertScore:', error);
        throw error;
    }
}

// Get leaderboard
async function getLeaderboard() {
    try {
        const { data, error } = await supabase
            .from('scores')
            .select(`
                player_name,
                score,
                timestamp,
                players (
                    coins,
                    games_played,
                    owned_skins,
                    completed_tasks
                )
            `)
            .order('score', { ascending: false });

        if (error) throw error;

        return data.map(row => ({
            name: row.player_name,
            score: row.score,
            timestamp: row.timestamp,
            coins: row.players.coins,
            gamesPlayed: row.players.games_played,
            ownedSkins: row.players.owned_skins,
            completedTasks: row.players.completed_tasks
        }));
    } catch (error) {
        console.error('Error in getLeaderboard:', error);
        throw error;
    }
}

// Add coins to player
async function addCoins(name, amount) {
    try {
        const { error } = await supabase
            .from('players')
            .update({ coins: supabase.rpc('increment_coins', { amount }) })
            .eq('name', name);

        if (error) throw error;
    } catch (error) {
        console.error('Error in addCoins:', error);
        throw error;
    }
}

// Complete task
async function completeTask(name, taskId) {
    try {
        const { data: player, error: fetchError } = await supabase
            .from('players')
            .select('completed_tasks')
            .eq('name', name)
            .single();

        if (fetchError) throw fetchError;

        const completedTasks = player.completed_tasks || [];
        if (!completedTasks.includes(taskId)) {
            const { error: updateError } = await supabase
                .from('players')
                .update({ completed_tasks: [...completedTasks, taskId] })
                .eq('name', name);

            if (updateError) throw updateError;
        }
    } catch (error) {
        console.error('Error in completeTask:', error);
        throw error;
    }
}

// Purchase skin
async function purchaseSkin(name, skinId) {
    try {
        const { data: player, error: fetchError } = await supabase
            .from('players')
            .select('owned_skins')
            .eq('name', name)
            .single();

        if (fetchError) throw fetchError;

        const ownedSkins = player.owned_skins || [];
        if (!ownedSkins.includes(skinId)) {
            const { error: updateError } = await supabase
                .from('players')
                .update({ owned_skins: [...ownedSkins, skinId] })
                .eq('name', name);

            if (updateError) throw updateError;
        }
    } catch (error) {
        console.error('Error in purchaseSkin:', error);
        throw error;
    }
}

module.exports = {
    getPlayerData,
    upsertScore,
    getLeaderboard,
    addCoins,
    completeTask,
    purchaseSkin
}; 