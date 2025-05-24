// Available skins in the store
const SKINS = {
    default: {
        id: 'default',
        name: 'Default Snake',
        price: 0,
        description: 'The classic snake look'
    },
    lion: {
        id: 'lion',
        name: 'Lion',
        price: 25,
        description: 'Roar your way through the game!'
    },
    giraffe: {
        id: 'giraffe',
        name: 'Giraffe',
        price: 25,
        description: 'Reach new heights with this tall friend'
    },
    cat: {
        id: 'cat',
        name: 'Cat',
        price: 25,
        description: 'Nine lives? More like nine points!'
    },
    dog: {
        id: 'dog',
        name: 'Dog',
        price: 0,
        description: 'Man\'s best friend in snake form'
    },
    penguin: {
        id: 'penguin',
        name: 'Penguin',
        price: 25,
        description: 'Slide through the game like ice'
    },
    shark: {
        id: 'shark',
        name: 'Shark',
        price: 25,
        description: 'The apex predator of the snake world'
    },
    rainbow: {
        id: 'rainbow',
        name: 'Legendary Rainbow',
        price: 300,
        description: 'A mythical skin that changes colors as you move!',
        type: 'legendary'
    }
};

// Available tasks
const TASKS = {
    score50: {
        id: 'score50',
        name: 'Score Master',
        description: 'Score 50 points in a single game',
        reward: 3,
        type: 'normal'
    },
    score150: {
        id: 'score150',
        name: 'Legendary Score',
        description: 'Score 150 points in a single game',
        reward: 200,
        type: 'legendary'
    },
    play5: {
        id: 'play5',
        name: 'Dedicated Player',
        description: 'Play 5 games',
        reward: 3,
        type: 'normal'
    }
};

// Make SKINS and TASKS globally accessible in browser environment
if (typeof window !== 'undefined') {
    window.SKINS = SKINS;
    window.TASKS = TASKS;
}

// Export for server-side usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        SKINS,
        TASKS
    };
} 