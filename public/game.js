class SnakeGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.gridSize = 20;
        this.tileCount = this.canvas.width / this.gridSize;
        
        // Socket.io connection
        this.socket = io();
        this.playerId = null;
        this.playerName = localStorage.getItem('playerName') || '';
        this.otherPlayers = new Map();
        
        // Game state
        this.level = 1;
        this.score = parseInt(localStorage.getItem('lastScore')) || 0;
        this.gameOver = false;
        this.gameStarted = false;
        this.countdownValue = 3;
        this.isCountingDown = false;
        
        // Snake properties
        this.snake = [{x: 10, y: 10}];
        this.velocityX = 0;
        this.velocityY = 0;
        
        // Level properties
        this.speed = 4;
        this.foodToNextLevel = 5;
        this.foodEaten = 0;
        
        // Initialize obstacles array first
        this.obstacles = [];
        
        // Food (generate after obstacles are initialized)
        this.food = this.generateFood();
        
        // Initialize controls
        this.initializeControls();
        this.initializeSocket();
        
        // Start button
        document.getElementById('startButton').addEventListener('click', () => this.validateAndJoin());

        // Set player name in input if it exists
        if (this.playerName) {
            document.getElementById('playerName').value = this.playerName;
        }
    }

    initializeSocket() {
        this.socket.on('init', (data) => {
            this.playerId = data.playerId;
            this.playerName = data.playerName;
            document.getElementById('playerName').value = this.playerName;
            data.players.forEach(player => {
                if (player.id !== this.playerId) {
                    this.otherPlayers.set(player.id, player);
                }
            });
            this.score = data.players.find(p => p.id === this.playerId)?.score || 0;
            document.getElementById('score').textContent = this.score;
            this.updateLeaderboard(data.leaderboard);
        });

        this.socket.on('nameRejected', () => {
            const nameInput = document.getElementById('playerName');
            const nameError = document.getElementById('nameError');
            nameInput.disabled = false;
            nameError.textContent = 'This name is already taken in the leaderboard. Please choose another name.';
            nameError.style.display = 'block';
        });

        this.socket.on('playerJoined', (player) => {
            if (player.id !== this.playerId) {
                this.otherPlayers.set(player.id, player);
            }
        });

        this.socket.on('playerLeft', (playerId) => {
            this.otherPlayers.delete(playerId);
        });

        this.socket.on('playerMoved', (player) => {
            if (player.id !== this.playerId) {
                this.otherPlayers.set(player.id, player);
            }
        });

        this.socket.on('leaderboardUpdate', (leaderboard) => {
            this.updateLeaderboard(leaderboard);
        });
    }

    validateAndJoin() {
        const nameInput = document.getElementById('playerName');
        const name = nameInput.value.trim();
        const nameError = document.getElementById('nameError');
        
        // Hide error message initially
        nameError.style.display = 'none';
        
        if (!name) {
            nameError.textContent = 'Please enter a name';
            nameError.style.display = 'block';
            return;
        }

        this.socket.emit('checkName', name, (isAvailable) => {
            if (isAvailable) {
                this.playerName = name;
                localStorage.setItem('playerName', name);
                this.socket.emit('initPlayer', name);
                nameInput.disabled = true;
                this.startCountdown();
            } else {
                nameError.textContent = 'This name is already taken. Please choose another name.';
                nameError.style.display = 'block';
            }
        });
    }

    startCountdown() {
        this.isCountingDown = true;
        this.countdownValue = 3;
        document.getElementById('startButton').style.display = 'none';
        
        const countdownElement = document.createElement('div');
        countdownElement.id = 'countdown';
        countdownElement.style.position = 'absolute';
        countdownElement.style.top = '50%';
        countdownElement.style.left = '50%';
        countdownElement.style.transform = 'translate(-50%, -50%)';
        countdownElement.style.fontSize = '48px';
        countdownElement.style.color = '#fff';
        document.body.appendChild(countdownElement);

        const countdownInterval = setInterval(() => {
            if (this.countdownValue > 0) {
                countdownElement.textContent = this.countdownValue;
                this.countdownValue--;
            } else {
                clearInterval(countdownInterval);
                countdownElement.remove();
                this.isCountingDown = false;
                this.startGame();
            }
        }, 1000);
    }

    updateLeaderboard(leaderboard) {
        const leaderboardList = document.getElementById('leaderboardList');
        leaderboardList.innerHTML = leaderboard
            .map((entry, index) => `
                <li class="leaderboard-item ${entry.name === this.playerName ? 'current-player' : ''}">
                    ${index + 1}. ${entry.name}: ${entry.score}
                </li>
            `)
            .join('');
    }

    startGame() {
        if (!this.gameStarted) {
            this.gameStarted = true;
            this.gameOver = false;
            // Initialize movement direction to right
            this.velocityX = 1;
            this.velocityY = 0;
            this.snake = [{x: 10, y: 10}];
            this.food = this.generateFood();
            this.gameLoop();
        }
    }

    generateFood() {
        let newFood;
        do {
            newFood = {
                x: Math.floor(Math.random() * this.tileCount),
                y: Math.floor(Math.random() * this.tileCount)
            };
        } while (this.isPositionOccupied(newFood));
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
        for (let obstacle of this.obstacles) {
            if (obstacle.x === position.x && obstacle.y === position.y) {
                return true;
            }
        }

        // Check if position collides with other players
        for (let [_, player] of this.otherPlayers) {
            for (let segment of player.snake) {
                if (segment.x === position.x && segment.y === position.y) {
                    return true;
                }
            }
        }
        
        return false;
    }

    generateObstacles() {
        this.obstacles = [];
        const obstacleCount = Math.min(this.level - 1, 5);
        
        for (let i = 0; i < obstacleCount; i++) {
            let obstacle;
            do {
                obstacle = {
                    x: Math.floor(Math.random() * this.tileCount),
                    y: Math.floor(Math.random() * this.tileCount)
                };
            } while (this.isPositionOccupied(obstacle));
            this.obstacles.push(obstacle);
        }
    }

    update() {
        if (this.gameOver || this.isCountingDown) return;

        const head = {
            x: this.snake[0].x + this.velocityX,
            y: this.snake[0].y + this.velocityY
        };

        // Check wall collision
        if (head.x < 0 || head.x >= this.tileCount || 
            head.y < 0 || head.y >= this.tileCount) {
            this.endGame();
            return;
        }

        // Check self collision
        for (let i = 0; i < this.snake.length; i++) {
            if (head.x === this.snake[i].x && head.y === this.snake[i].y) {
                this.endGame();
                return;
            }
        }

        // Check obstacle collision
        for (let obstacle of this.obstacles) {
            if (head.x === obstacle.x && head.y === obstacle.y) {
                this.endGame();
                return;
            }
        }

        // Check other players collision
        for (let [_, player] of this.otherPlayers) {
            if (player.snake) {  // Only check if player has snake data
                for (let segment of player.snake) {
                    if (head.x === segment.x && head.y === segment.y) {
                        this.endGame();
                        return;
                    }
                }
            }
        }

        // Add new head
        this.snake.unshift(head);

        // Check food collision
        if (head.x === this.food.x && head.y === this.food.y) {
            this.score += 10 * this.level;
            this.foodEaten++;
            document.getElementById('score').textContent = this.score;
            localStorage.setItem('lastScore', this.score.toString());
            
            // Update score on server
            this.socket.emit('updateScore', { score: this.score });
            
            // Generate new food
            this.food = this.generateFood();
            
            // Check for level up
            if (this.foodEaten >= this.foodToNextLevel) {
                this.levelUp();
            }
        } else {
            // Remove tail if no food eaten
            this.snake.pop();
        }

        // Update server with new snake position
        this.socket.emit('update', {
            snake: this.snake,
            score: this.score
        });
    }

    levelUp() {
        this.level++;
        this.foodEaten = 0;
        this.speed = Math.min(this.speed + 1, 8);
        this.foodToNextLevel = Math.min(this.foodToNextLevel + 2, 10);
        document.getElementById('level').textContent = this.level;
        this.generateObstacles();
    }

    draw() {
        // Clear canvas
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw other players
        for (let [_, player] of this.otherPlayers) {
            this.ctx.fillStyle = '#2196F3';
            for (let segment of player.snake) {
                this.ctx.fillRect(
                    segment.x * this.gridSize,
                    segment.y * this.gridSize,
                    this.gridSize - 2,
                    this.gridSize - 2
                );
            }
        }

        // Draw current player's snake
        this.ctx.fillStyle = '#4CAF50';
        for (let segment of this.snake) {
            this.ctx.fillRect(
                segment.x * this.gridSize,
                segment.y * this.gridSize,
                this.gridSize - 2,
                this.gridSize - 2
            );
        }

        // Draw food
        this.ctx.fillStyle = '#FF0000';
        this.ctx.fillRect(
            this.food.x * this.gridSize,
            this.food.y * this.gridSize,
            this.gridSize - 2,
            this.gridSize - 2
        );

        // Draw obstacles
        this.ctx.fillStyle = '#666666';
        for (let obstacle of this.obstacles) {
            this.ctx.fillRect(
                obstacle.x * this.gridSize,
                obstacle.y * this.gridSize,
                this.gridSize - 2,
                this.gridSize - 2
            );
        }
    }

    endGame() {
        this.gameOver = true;
        this.gameStarted = false;
        document.getElementById('startButton').style.display = 'block';
        document.getElementById('startButton').textContent = 'Play Again';
        
        // Store final score
        localStorage.setItem('lastScore', this.score.toString());
        
        // Clear snake from other players' view
        this.socket.emit('update', {
            snake: [],
            score: this.score
        });
    }

    gameLoop() {
        if (!this.gameOver) {
            setTimeout(() => {
                this.update();
                this.draw();
                requestAnimationFrame(() => this.gameLoop());
            }, 1000 / this.speed);
        }
    }

    initializeControls() {
        document.addEventListener('keydown', (e) => {
            if (!this.gameStarted || this.gameOver || this.isCountingDown) return;
            
            switch(e.key) {
                case 'ArrowUp':
                case 'w':
                case 'W':
                    if (this.velocityY !== 1) {
                        this.velocityX = 0;
                        this.velocityY = -1;
                    }
                    break;
                case 'ArrowDown':
                case 's':
                case 'S':
                    if (this.velocityY !== -1) {
                        this.velocityX = 0;
                        this.velocityY = 1;
                    }
                    break;
                case 'ArrowLeft':
                case 'a':
                case 'A':
                    if (this.velocityX !== 1) {
                        this.velocityX = -1;
                        this.velocityY = 0;
                    }
                    break;
                case 'ArrowRight':
                case 'd':
                case 'D':
                    if (this.velocityX !== -1) {
                        this.velocityX = 1;
                        this.velocityY = 0;
                    }
                    break;
            }
        });
    }
}

function restartGame() {
    document.getElementById('gameOver').style.display = 'none';
    document.getElementById('startButton').style.display = 'block';
    document.getElementById('playerName').disabled = false;
    game = new SnakeGame();
}

let game = new SnakeGame(); 