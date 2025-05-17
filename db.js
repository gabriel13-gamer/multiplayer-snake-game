const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

// Leaderboard functions
const leaderboardFunctions = {
    // Get top 10 scores
    getLeaderboard: async () => {
        const { data, error } = await supabase
            .from('leaderboard')
            .select('*')
            .order('score', { ascending: false })
            .limit(10);

        if (error) throw error;
        return data;
    },

    // Check if player name exists
    checkPlayerName: async (name) => {
        const { data, error } = await supabase
            .from('leaderboard')
            .select('name')
            .eq('name', name)
            .single();

        if (error && error.code !== 'PGNF') throw error;
        return !!data;
    },

    // Update or create player score
    upsertScore: async (name, score) => {
        const { data, error } = await supabase
            .from('leaderboard')
            .upsert(
                { 
                    name, 
                    score,
                    last_updated: new Date().toISOString()
                },
                {
                    onConflict: 'name',
                    target: ['name'],
                    // Only update if new score is higher
                    returning: true
                }
            );

        if (error) throw error;
        return data;
    }
};

module.exports = leaderboardFunctions; 