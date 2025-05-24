class SnakeGame {
    constructor() {
        console.log('SnakeGame initialized');
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Set canvas size to match window size
        this.resizeCanvas();
        
        this.gridSize = 20;
        // Initialize snake at fixed position (10, 10)
        this.snake = [{x: 10, y: 10}];
        this.food = null;
        this.direction = 'right';
        this.nextDirection = 'right';
        this.score = 0;
        this.level = 1;
        this.speed = 4;
        this.maxSpeed = 8;
        this.gameStarted = false;
        this.isGameOver = false;
        this.isTrainingMode = false;
        this.gameMode = 'multiplayer';
        
        this.playerName = '';
        this.playerColor = '#4CAF50';
        this.otherPlayers = new Map();
        
        this.socket = io();
        this.setupSocketListeners();
        
        this.currentLanguage = 'en';
        this.translations = translations;
        
        // Initialize obstacles array
        this.obstacles = [];
        
        // Initialize all UI elements
        this.initializeStarterScreen();
        this.initializeSettings();
        this.initializeTrainingControls();
        
        // Add event listeners
        window.addEventListener('resize', () => this.resizeCanvas());
        window.addEventListener('keydown', (e) => this.handleKeyPress(e));
        
        // Store and task variables
        this.playerData = { coins: 0 }; // Initialize with default values
        this.currentSkin = 'default';
        this.availableTasks = [];
        
        // Initialize store immediately
        this.initStore();
    }

    resizeCanvas() {
        const minWidth = 800;
        const minHeight = 600;
        this.canvas.width = Math.max(window.innerWidth, minWidth);
        this.canvas.height = Math.max(window.innerHeight, minHeight);
        this.gridSize = Math.min(this.canvas.width, this.canvas.height) / 40; // Adjust grid size based on canvas size
    }

    setupSocketListeners() {
        this.socket.on('initPlayer', (data) => {
            this.playerName = data.name;
            this.playerColor = data.color;
            this.startGame();
        });

        this.socket.on('playerJoined', (data) => {
            this.otherPlayers.set(data.name, {
                snake: data.snake,
                color: data.color
            });
        });

        this.socket.on('playerLeft', (data) => {
            this.otherPlayers.delete(data.name);
        });

        this.socket.on('updatePlayer', (data) => {
            if (this.otherPlayers.has(data.name)) {
                const player = this.otherPlayers.get(data.name);
                player.snake = data.snake;
                player.score = data.score;
            }
        });

        this.socket.on('updateLeaderboard', (leaderboard) => {
            this.updateLeaderboard(leaderboard);
        });

        this.socket.on('nameError', () => {
            document.getElementById('nameError').style.display = 'block';
        });

        this.socket.on('taskCompleted', (data) => {
            const { task, coins } = data;
            this.playerData.coins += coins;
            this.updateCoinsDisplay();
            
            // Show task completion notification
            const notification = document.createElement('div');
            notification.className = 'task-notification';
            notification.innerHTML = `
                <h3>Task Completed!</h3>
                <p>${task.name}</p>
                <p>Reward: ${coins} coins</p>
            `;
            document.body.appendChild(notification);
            setTimeout(() => notification.remove(), 3000);
        });
    }

    initializeColorSelection() {
        const colorButtons = document.querySelectorAll('.color-btn');
        colorButtons.forEach(button => {
            button.addEventListener('click', () => {
                // Remove selected class from all buttons
                colorButtons.forEach(btn => btn.classList.remove('selected'));
                // Add selected class to clicked button
                button.classList.add('selected');
                // Update player color
                this.playerColor = button.dataset.color;
            });
        });
        
        // Select first color by default
        if (colorButtons.length > 0) {
            colorButtons[0].classList.add('selected');
            this.playerColor = colorButtons[0].dataset.color;
        }
    }

    startCountdown() {
        this.isCountingDown = true;
        this.countdownValue = 3;
        
        const countdownElement = document.createElement('div');
        countdownElement.id = 'countdown';
        countdownElement.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 72px;
            color: white;
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
            z-index: 1000;
        `;
        document.body.appendChild(countdownElement);

        const countdownInterval = setInterval(() => {
            if (this.countdownValue > 0) {
                countdownElement.textContent = this.countdownValue;
                this.countdownValue--;
            } else {
                clearInterval(countdownInterval);
                countdownElement.remove();
                this.isCountingDown = false;
                
                if (this.gameMode === 'multiplayer') {
                    this.socket.emit('initPlayer', {
                        name: this.playerName,
                        color: this.playerColor
                    });
                } else {
                    this.startGame();
                }
            }
        }, 1000);
    }

    updateLeaderboard(leaderboard) {
        const leaderboardElement = document.querySelector('.leaderboard ul');
        leaderboardElement.innerHTML = '';
        
        const t = this.translations[this.currentLanguage];
        
        leaderboard.forEach((entry, index) => {
            const li = document.createElement('li');
            const medal = index < 3 ? ['🥇', '🥈', '🥉'][index] : '🐍';
            li.innerHTML = `
                <span class="medal">${medal}</span>
                <span class="name">${entry.name}</span>
                <span class="score">${entry.score}</span>
            `;
            if (entry.name === this.playerName) {
                li.classList.add('current-player');
            }
            leaderboardElement.appendChild(li);
        });
    }

    resetSnakePosition() {
        this.snake = [{x: 10, y: 10}];
        this.direction = 'right';
        this.nextDirection = 'right';
    }

    startGame() {
        this.gameStarted = true;
        this.isGameOver = false;
        this.score = 0;
        this.level = 1;
        this.speed = 5;
        this.resetSnakePosition();
        this.obstacles = [];
        this.food = this.generateFood();
        this.generateObstacles();
        this.lastUpdate = Date.now();
       
        // Update score display
        const scoreContainer = document.getElementById('score-container');
        if (scoreContainer) {
            scoreContainer.textContent = `Score: ${this.score}`;
        }
        // Update level display
        const levelContainer = document.getElementById('level-container');
        if (levelContainer) {
            levelContainer.textContent = `Level: ${this.level}`;
        }
        // Show/hide leaderboard based on game mode
        const leaderboard = document.querySelector('.leaderboard');
        if (leaderboard) {
            leaderboard.style.display = this.gameMode === 'multiplayer' ? 'block' : 'none';
        }
        // Add store initialization for multiplayer
        if (this.gameMode === 'multiplayer') {
            this.initStore();
        }
        // Start the game loop after everything is initialized
        this.gameLoop();
    }

    generateFood() {
        let newFood;
        do {
            newFood = {
                x: Math.floor(Math.random() * this.canvas.width / this.gridSize),
                y: Math.floor(Math.random() * this.canvas.height / this.gridSize)
            };
        } while (this.isPositionOccupied(newFood));
        this.food = newFood;
        return newFood;
    }

    isPositionOccupied(position) {
        // Check if position collides with snake
        for (let segment of this.snake) {
            if (segment.x === position.x && segment.y === position.y) {
                return true;
            }
        }
        
        // Check if position collides with obstacles
        if (Array.isArray(this.obstacles)) {
            for (let obstacle of this.obstacles) {
                if (obstacle.x === position.x && obstacle.y === position.y) {
                    return true;
                }
            }
        }

        // Check if position collides with other players
        for (let [_, player] of this.otherPlayers) {
            if (Array.isArray(player.snake)) {
                for (let segment of player.snake) {
                    if (segment.x === position.x && segment.y === position.y) {
                        return true;
                    }
                }
            }
        }
        
        return false;
    }

    generateObstacles() {
        const obstacles = [];
        const obstacleCount = Math.min(this.level - 1, 5);
        
        for (let i = 0; i < obstacleCount; i++) {
            let obstacle;
            do {
                obstacle = {
                    x: Math.floor(Math.random() * this.canvas.width / this.gridSize),
                    y: Math.floor(Math.random() * this.canvas.height / this.gridSize)
                };
            } while (this.isPositionOccupied(obstacle));
            obstacles.push(obstacle);
        }
        this.obstacles = obstacles;
        return obstacles;
    }

    update() {
        if (this.isGameOver) return;
        this.direction = this.nextDirection;
        const head = { ...this.snake[0] };
        switch (this.direction) {
            case 'up': head.y--; break;
            case 'down': head.y++; break;
            case 'left': head.x--; break;
            case 'right': head.x++; break;
        }
        if (this.isTrainingMode) {
            // Wrap around walls
            if (head.x < 0) head.x = Math.floor(this.canvas.width / this.gridSize) - 1;
            if (head.x >= Math.floor(this.canvas.width / this.gridSize)) head.x = 0;
            if (head.y < 0) head.y = Math.floor(this.canvas.height / this.gridSize) - 1;
            if (head.y >= Math.floor(this.canvas.height / this.gridSize)) head.y = 0;
            // Do NOT check for self-collision or obstacles in training mode
        } else {
            // Wall collision
            if (head.x < 0 || head.x >= Math.floor(this.canvas.width / this.gridSize) ||
                head.y < 0 || head.y >= Math.floor(this.canvas.height / this.gridSize)) {
                this.endGame();
                return;
            }
            // Self-collision
            if (this.snake.some(segment => segment.x === head.x && segment.y === head.y)) {
                this.endGame();
                return;
            }
        }
        this.snake.unshift(head);
        if (this.food && head.x === this.food.x && head.y === this.food.y) {
            this.score += 10;
            this.food = this.generateFood();
            if (this.score % 50 === 0) {
                this.level++;
                this.speed = Math.min(this.speed + 1, this.maxSpeed);
            }
            document.querySelector('#level-container').textContent = 
                `${this.translations[this.currentLanguage].level}: ${this.level}`;
            document.querySelector('#score-container').textContent = 
                `${this.translations[this.currentLanguage].score}: ${this.score}`;
            // Update task progress if following a task
            if (this.activeTask) {
                const task = (this.availableTasks || []).find(t => t.id === this.activeTask);
                if (task && task.type === 'score') {
                    this.taskProgress = Math.min(this.score, task.target);
                    this.updateTaskProgress();
                    if (this.taskProgress >= task.target) {
                        this.completeTask();
                    }
                }
            }
        } else {
            this.snake.pop();
        }
        if (this.gameMode === 'multiplayer') {
            this.socket.emit('update', {
                snake: this.snake,
                score: this.score
            });
        }
    }

    draw() {
        // Clear the canvas
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw grid
        this.ctx.strokeStyle = '#333333';
        this.ctx.lineWidth = 0.5;
        for (let x = 0; x < this.canvas.width; x += this.gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        for (let y = 0; y < this.canvas.height; y += this.gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }

        // Draw food
        if (this.food) {
            this.ctx.fillStyle = '#ff0000';
            this.ctx.beginPath();
            this.ctx.arc(
                (this.food.x + 0.5) * this.gridSize,
                (this.food.y + 0.5) * this.gridSize,
                this.gridSize / 2,
                0,
                Math.PI * 2
            );
            this.ctx.fill();
        }

        // Draw snake with rainbow effect if rainbow skin is selected
        if (this.currentSkin === 'rainbow') {
            this.snake.forEach((segment, index) => {
                const hue = (index * 10 + Date.now() / 50) % 360;
                this.ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
                this.ctx.fillRect(
                    segment.x * this.gridSize,
                    segment.y * this.gridSize,
                    this.gridSize,
                    this.gridSize
                );
            });
        } else {
            // Draw snake with normal color
            this.ctx.fillStyle = this.playerColor;
            for (let segment of this.snake) {
                this.ctx.fillRect(
                    segment.x * this.gridSize,
                    segment.y * this.gridSize,
                    this.gridSize,
                    this.gridSize
                );
            }
        }

        // Draw other players
        for (let [_, player] of this.otherPlayers) {
            this.ctx.fillStyle = player.color;
            for (let segment of player.snake) {
                this.ctx.fillRect(
                    segment.x * this.gridSize,
                    segment.y * this.gridSize,
                    this.gridSize,
                    this.gridSize
                );
            }
        }
    }

    endGame() {
        this.isGameOver = true;
        // Remove any existing game over screen
        const existingGameOver = document.getElementById('gameOver');
        if (existingGameOver) {
            existingGameOver.remove();
        }
        
        // Show store button again
        const storeButton = document.getElementById('store-button');
        if (storeButton) {
            storeButton.style.display = 'block';
        }
        
        const gameOverElement = document.createElement('div');
        gameOverElement.id = 'gameOver';
        const t = this.translations[this.currentLanguage];
        const h2 = document.createElement('h2');
        h2.textContent = t.gameOver;
        const p = document.createElement('p');
        p.textContent = t.finalScore + ': ' + this.score;
        const button = document.createElement('button');
        button.textContent = t.playAgain;
        gameOverElement.appendChild(h2);
        gameOverElement.appendChild(p);
        gameOverElement.appendChild(button);
        document.body.appendChild(gameOverElement);
        button.addEventListener('click', () => {
            gameOverElement.remove();
            this.resetSnakePosition();
            this.restartGame();
        });
    }

    restartGame() {
        this.resetSnakePosition();
        this.isGameOver = false;
        this.gameStarted = false;
        this.score = 0;
        this.level = 1;
        this.speed = 5;
        this.food = this.generateFood();
        this.obstacles = [];
        this.lastUpdate = Date.now();
        this.activeTask = null;
        this.taskProgress = 0;
        // Remove game over screen if it exists
        const gameOverElement = document.getElementById('gameOver');
        if (gameOverElement) {
            gameOverElement.remove();
        }
        // Remove task progress display if it exists
        const taskProgressDiv = document.getElementById('task-progress');
        if (taskProgressDiv) {
            taskProgressDiv.remove();
        }
        // Show player form
        const playerForm = document.getElementById('player-form');
        if (playerForm) {
            playerForm.style.display = 'block';
        }
        // Reset name input and error message
        const nameInput = document.getElementById('playerName');
        const nameError = document.getElementById('nameError');
        if (nameInput) {
            nameInput.value = '';
        }
        if (nameError) {
            nameError.style.display = 'none';
        }
        // Show store button
        const storeButton = document.getElementById('store-button');
        if (storeButton) {
            storeButton.style.display = 'block';
        }
        // Update UI
        document.getElementById('score-container').textContent = `${this.translations[this.currentLanguage].score}: 0`;
        document.getElementById('level-container').textContent = `${this.translations[this.currentLanguage].level}: 1`;
    }

    gameLoop() {
        if (!this.gameStarted || this.isGameOver) return;

        const now = Date.now();
        if (!this.lastUpdate) this.lastUpdate = now;
        const interval = 1000 / this.speed; // ms per move
        if (now - this.lastUpdate >= interval) {
            this.update();
            this.draw();
            this.lastUpdate = now;
        }
        this.gameLoopInterval = requestAnimationFrame(() => this.gameLoop());
    }

    initializeControls() {
        document.addEventListener('keydown', (e) => {
            if (!this.gameStarted || this.isGameOver || this.isCountingDown) return;
            const key = e.key.toLowerCase();
            const currentDirection = this.direction;
            switch(key) {
                case 'arrowup':
                case 'w':
                    if (currentDirection !== 'down') this.nextDirection = 'up';
                    break;
                case 'arrowdown':
                case 's':
                    if (currentDirection !== 'up') this.nextDirection = 'down';
                    break;
                case 'arrowleft':
                case 'a':
                    if (currentDirection !== 'right') this.nextDirection = 'left';
                    break;
                case 'arrowright':
                case 'd':
                    if (currentDirection !== 'left') this.nextDirection = 'right';
                    break;
            }
        });
    }

    setupColorSelection() {
        document.querySelectorAll('.color-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                this.selectedColor = btn.dataset.color;
            });
        });
        document.querySelector('.color-btn[data-color="#4CAF50"]').classList.add('selected');
    }

    drawPlayer(player) {
        this.ctx.fillStyle = player.color || this.selectedColor;
        player.body.forEach(segment => {
            this.ctx.fillRect(segment.x * this.gridSize, segment.y * this.gridSize, this.gridSize - 1, this.gridSize - 1);
        });
    }

    initializeStarterScreen() {
        const starterScreen = document.getElementById('starterScreen');
        const gameModes = document.querySelectorAll('.game-mode-btn');
        const settingsButton = document.getElementById('settingsButton');
        const settingsMenu = document.getElementById('settingsMenu');

        // Initialize settings menu
        if (settingsMenu) {
            settingsMenu.style.display = 'none';
        }

        // Add click event listeners to game mode buttons
        gameModes.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.gameMode = button.dataset.mode;
                
                if (starterScreen) {
                    starterScreen.style.display = 'none';
                }
                
                if (this.gameMode === 'training') {
                    this.startTrainingMode();
                } else {
                    this.showPlayerForm();
                }
            });
        });

        // Add click event listener to settings button
        if (settingsButton) {
            settingsButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (settingsMenu) {
                    settingsMenu.style.display = settingsMenu.style.display === 'none' ? 'block' : 'none';
                }
            });
        }

        // Close settings menu when clicking outside
        document.addEventListener('click', (e) => {
            if (settingsMenu && !settingsMenu.contains(e.target) && e.target !== settingsButton) {
                settingsMenu.style.display = 'none';
            }
        });
    }

    initializeSettings() {
        const languageSelect = document.getElementById('language');
        
        languageSelect.addEventListener('change', (e) => {
            this.currentLanguage = e.target.value;
        });

        // Initialize language select options
        Object.keys(this.translations).forEach(lang => {
            const option = document.createElement('option');
            option.value = lang;
            option.textContent = this.translations[lang].language;
            languageSelect.appendChild(option);
        });

        // Set initial language
        languageSelect.value = this.currentLanguage;
    }

    loadAudio() {
        // Set initial volumes
        this.sounds.background.volume = document.getElementById('musicVolume').value / 100;
        const sfxVolume = document.getElementById('sfxVolume').value / 100;
        Object.values(this.sounds).forEach(sound => {
            if (sound !== this.sounds.background) {
                sound.volume = sfxVolume;
            }
        });
    }

    initializeTrainingControls() {
        const exitTrainingButton = document.getElementById('exitTraining');
        if (exitTrainingButton) {
            exitTrainingButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.exitTrainingMode();
            });
        }
    }

    startTrainingMode() {
        this.isTrainingMode = true;
        const trainingControls = document.getElementById('trainingControls');
        if (trainingControls) {
            trainingControls.classList.add('active');
        }
        this.startGame();
    }

    exitTrainingMode() {
        this.isTrainingMode = false;
        this.gameStarted = false;
        this.isGameOver = true;
        
        const trainingControls = document.getElementById('trainingControls');
        if (trainingControls) {
            trainingControls.classList.remove('active');
        }
        
        const starterScreen = document.getElementById('starterScreen');
        if (starterScreen) {
            starterScreen.style.display = 'flex';
        }
        
        // Reset game state
        this.score = 0;
        this.level = 1;
        this.snake = [{x: 10, y: 10}];
        this.direction = 'right';
        this.nextDirection = 'right';
    }

    showPlayerForm() {
        const playerForm = document.getElementById('player-form');
        const startButton = document.getElementById('startButton');
        const playerName = document.getElementById('playerName');
        const nameError = document.getElementById('nameError');
        // Remove any previous instructions
        const oldInstructions = document.getElementById('game-instructions');
        if (oldInstructions) oldInstructions.remove();
        // Add store button if not present (show on player form)
        if (!document.getElementById('store-button')) {
            this.addStoreButton();
        }
        if (playerForm) {
            playerForm.style.display = 'block';
        }
        if (nameError) {
            nameError.style.display = 'none';
        }

        // Initialize color selection
        this.initializeColorSelection();

        // Add click event listener to start button
        if (startButton) {
            startButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.validateAndJoin();
            });
        }

        // Add enter key listener to name input
        if (playerName) {
            playerName.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.validateAndJoin();
                }
            });
        }
    }

    validateAndJoin() {
        const nameInput = document.getElementById('playerName');
        const name = nameInput.value.trim();
        const nameError = document.getElementById('nameError');
        if (name.length < 2) {
            nameError.style.display = 'block';
            return;
        }
        nameError.style.display = 'none';
        this.playerName = name;
        // Hide player form
        const playerForm = document.getElementById('player-form');
        if (playerForm) {
            playerForm.style.display = 'none';
        }
        // Hide store button during gameplay
        const storeButton = document.getElementById('store-button');
        if (storeButton) {
            storeButton.style.display = 'none';
        }
        // Reset game state before starting
        this.resetSnakePosition();
        this.isGameOver = false;
        this.gameStarted = false;
        this.score = 0;
        this.level = 1;
        this.speed = 5;
        this.food = this.generateFood();
        this.obstacles = [];
        this.lastUpdate = Date.now();
        this.activeTask = null;
        this.taskProgress = 0;
        // Start countdown
        this.startCountdown();
    }

    handleKeyPress(e) {
        if (!this.gameStarted || this.isGameOver) return;

        const key = e.key.toLowerCase();
        const currentDirection = this.direction;

        switch (key) {
            case 'arrowup':
            case 'w':
                if (currentDirection !== 'down') this.nextDirection = 'up';
                break;
            case 'arrowdown':
            case 's':
                if (currentDirection !== 'up') this.nextDirection = 'down';
                break;
            case 'arrowleft':
            case 'a':
                if (currentDirection !== 'right') this.nextDirection = 'left';
                break;
            case 'arrowright':
            case 'd':
                if (currentDirection !== 'left') this.nextDirection = 'right';
                break;
        }
    }

    // Store and task functions
    initStore() {
        console.log('Initializing store');
        try {
            // Get player data
            this.socket.emit('getPlayerData', (data) => {
                console.log('Received player data:', data);
                this.playerData = data || { coins: 0 };
                this.updateCoinsDisplay();
                this.updateTasksDisplay();
            });

            // Get available tasks
            this.socket.emit('getTasks', (tasks) => {
                console.log('Received tasks:', tasks);
                if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
                    // Fallback to default TASKS if server returns nothing
                    this.availableTasks = Object.entries(TASKS).map(([id, task]) => ({ id, ...task }));
                } else {
                    this.availableTasks = tasks;
                }
                this.updateTasksDisplay();
            });

            // Add store button if not already present
            if (!document.getElementById('store-button')) {
                this.addStoreButton();
            }
        } catch (error) {
            console.error('Error initializing store:', error);
        }
    }

    updateCoinsDisplay() {
        const coinsDisplay = document.getElementById('coins-display');
        if (coinsDisplay && this.playerData) {
            coinsDisplay.textContent = `Coins: ${this.playerData.coins}`;
        }
    }

    updateTasksDisplay() {
        const tasksContainer = document.getElementById('tasks-container');
        if (!tasksContainer) return;

        tasksContainer.innerHTML = '';
        this.availableTasks.forEach(task => {
            const taskElement = document.createElement('div');
            taskElement.className = 'task-item';
            const isActive = this.activeTask === task.id;
            taskElement.innerHTML = `
                <h3>${task.name}</h3>
                <p>${task.description}</p>
                <p class="reward">Reward: ${task.reward} coins</p>
                ${task.type === 'legendary' ? '<span class="legendary-badge">Legendary</span>' : ''}
                <button class="follow-task-btn" ${isActive ? 'disabled' : ''}>
                    ${isActive ? 'Following' : 'Follow Task'}
                </button>
            `;
            
            const followButton = taskElement.querySelector('.follow-task-btn');
            followButton.addEventListener('click', () => {
                this.activeTask = task.id;
                this.taskProgress = 0;
                this.updateTaskProgress();
                this.updateTasksDisplay();
            });
            
            tasksContainer.appendChild(taskElement);
        });
    }

    updateTaskProgress() {
        let taskProgressDiv = document.getElementById('task-progress');
        if (!taskProgressDiv) {
            taskProgressDiv = document.createElement('div');
            taskProgressDiv.id = 'task-progress';
            taskProgressDiv.style.cssText = `
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 10px;
                border-radius: 5px;
                z-index: 1000;
            `;
            document.body.appendChild(taskProgressDiv);
        }
        const task = (this.availableTasks || []).find(t => t.id === this.activeTask);
        if (task) {
            let progressText = '';
            if (task.type === 'score') {
                progressText = `${this.taskProgress}/${task.target}`;
            } else if (task.type === 'normal' && task.id.startsWith('play')) {
                progressText = `${this.taskProgress}/${task.target || 5}`;
            } else {
                progressText = `${this.taskProgress}/${task.target || '?'} `;
            }
            taskProgressDiv.innerHTML = `
                <h3>${task.name}</h3>
                <p>Progress: ${progressText}</p>
            `;
        }
    }
}

window.snakeGame = new SnakeGame();