import GameCore from '@/engine/Core.js';
import BlockSystem from '@/world/BlockSystem.js';
import ChunkSystem from '@/world/ChunkSystem.js';
import World from '@/world/World.js';
import Player from '@/entities/Player.js';
import CraftingSystem from '@/systems/Crafting.js';
import Renderer from '@/engine/Renderer.js';

// Инициализация глобальных стилей
// import '@/styles/main.css';

class Game {
  constructor() {
    this.core = null;
    this.blockSystem = null;
    this.chunkSystem = null;
    this.world = null;
    this.player = null;
    this.crafting = null;
    this.renderer = null;
    
    this.isInitialized = false;
  }

  async init() {
    console.log('🎮 Инициализация TerraCraft Pro...');
    
    try {
      // Создание ядра игры
      this.core = new GameCore({
        width: window.innerWidth,
        height: window.innerHeight,
        debug: process.env.NODE_ENV === 'development'
      });
      
      await this.core.init();
      
      // Инициализация систем
      this.blockSystem = new BlockSystem();
      this.chunkSystem = new ChunkSystem(16);
      this.world = new World();
      this.player = new Player();
      this.crafting = new CraftingSystem();
      this.renderer = this.core.renderer;
      
      // Загрузка данных
      await Promise.all([
        this.blockSystem.loadDefinitions(),
        this.crafting.loadRecipes(),
        this.world.init(),
        this.player.loadFromStorage()
      ]);
      
      // Регистрация систем в ядре
      this.core.registerSystem(this.blockSystem);
      this.core.registerSystem(this.chunkSystem);
      this.core.registerSystem(this.crafting);
      
      // Установка мира в ядро
      this.core.world = this.world;
      
      // Добавление игрока
      this.core.addGameObject('player', this.player);
      
      // Настройка камеры следования за игроком
      this.setupCameraFollow();
      
      // Настройка UI
      this.setupUI();
      
      this.isInitialized = true;
      
      console.log('✅ TerraCraft Pro готов к запуску!');
      
      // Автозапуск в режиме разработки
      if (process.env.NODE_ENV === 'development') {
        this.start();
      }
      
    } catch (error) {
      console.error('❌ Ошибка инициализации игры:', error);
      this.showErrorScreen(error);
    }
  }

  setupCameraFollow() {
    // Камера следует за игроком
    this.core.eventBus.on('player:updated', (data) => {
      this.renderer.setCamera(data.position.x, data.position.y);
      
      // Обновление активных чанков
      this.chunkSystem.updateActiveChunks(
        data.position.x,
        data.position.y,
        500 // радиус в пикселях
      );
    });
  }

  setupUI() {
    // Создание элементов интерфейса
    this.createLoadingScreen();
    this.createMainMenu();
    this.createHUD();
    
    // Обработчики UI событий
    this.setupUIEvents();
  }

  createLoadingScreen() {
    const loadingScreen = document.createElement('div');
    loadingScreen.id = 'loading-screen';
    loadingScreen.innerHTML = `
      <div class="loading-container">
        <div class="logo">TERRACRAFT</div>
        <div class="progress-container">
          <div class="progress-bar" id="loading-progress"></div>
          <div class="progress-text" id="loading-text">Загрузка...</div>
        </div>
        <div class="loading-tips">
          <div class="tip">Совет: Используйте ПКМ для установки блоков</div>
          <div class="tip">Совет: Нажмите E для открытия инвентаря</div>
          <div class="tip">Совет: Собирайте ресурсы для крафта</div>
        </div>
      </div>
    `;
    
    document.body.appendChild(loadingScreen);
  }

  createMainMenu() {
    const menu = document.createElement('div');
    menu.id = 'main-menu';
    menu.classList.add('hidden');
    menu.innerHTML = `
      <div class="menu-container">
        <div class="menu-header">
          <h1>TERRACRAFT</h1>
          <p class="version">v1.0.0</p>
        </div>
        
        <div class="menu-buttons">
          <button id="btn-continue" class="menu-btn">Продолжить</button>
          <button id="btn-new-game" class="menu-btn">Новая игра</button>
          <button id="btn-load-game" class="menu-btn">Загрузить игру</button>
          <button id="btn-settings" class="menu-btn">Настройки</button>
          <button id="btn-quit" class="menu-btn">Выйти</button>
        </div>
        
        <div class="menu-footer">
          <div class="stats">
            <div>Время игры: <span id="play-time">0:00</span></div>
            <div>Уровень: <span id="player-level">1</span></div>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(menu);
  }

  createHUD() {
    const hud = document.createElement('div');
    hud.id = 'game-hud';
    hud.innerHTML = `
      <div class="hud-top">
        <div class="health-bar">
          <div class="bar-label">❤️ Здоровье</div>
          <div class="bar-container">
            <div class="bar-fill" id="health-bar-fill"></div>
            <span class="bar-text" id="health-text">100/100</span>
          </div>
        </div>
        
        <div class="experience-bar">
          <div class="bar-label">⭐ Уровень <span id="level-text">1</span></div>
          <div class="bar-container">
            <div class="bar-fill" id="exp-bar-fill"></div>
            <span class="bar-text" id="exp-text">0/100</span>
          </div>
        </div>
      </div>
      
      <div class="hud-center">
        <div class="crosshair"></div>
        <div class="interaction-hint" id="interaction-hint"></div>
      </div>
      
      <div class="hud-bottom">
        <div class="hotbar" id="hotbar">
          ${Array(9).fill(0).map((_, i) => `
            <div class="hotbar-slot" data-slot="${i}">
              <div class="slot-number">${i + 1}</div>
              <div class="slot-content"></div>
              <div class="slot-count"></div>
            </div>
          `).join('')}
        </div>
        
        <div class="quick-stats">
          <div class="stat">🕐 <span id="game-time">12:00</span></div>
          <div class="stat">📍 <span id="coordinates">0, 0</span></div>
          <div class="stat">📦 <span id="block-count">0</span></div>
        </div>
      </div>
    `;
    
    document.body.appendChild(hud);
  }

  setupUIEvents() {
    // Кнопки главного меню
    document.getElementById('btn-continue').addEventListener('click', () => {
      this.hideMenu();
      this.start();
    });
    
    document.getElementById('btn-new-game').addEventListener('click', () => {
      if (confirm('Начать новую игру? Текущий прогресс будет потерян.')) {
        this.newGame();
      }
    });
    
    document.getElementById('btn-settings').addEventListener('click', () => {
      this.showSettings();
    });
    
    // Обновление HUD
    this.core.eventBus.on('player:updated', (data) => {
      this.updateHUD(data);
    });
    
    // Обновление прогресса загрузки
    this.core.assets.onProgress = (progress) => {
      this.updateLoadingProgress(progress);
    };
  }

  updateLoadingProgress(progress) {
    const bar = document.getElementById('loading-progress');
    const text = document.getElementById('loading-text');
    
    if (bar) bar.style.width = `${progress * 100}%`;
    if (text) text.textContent = `Загрузка... ${Math.round(progress * 100)}%`;
    
    if (progress >= 1) {
      setTimeout(() => {
        document.getElementById('loading-screen').classList.add('hidden');
        document.getElementById('main-menu').classList.remove('hidden');
      }, 500);
    }
  }

  updateHUD(playerData) {
    // Обновление полосы здоровья
    const healthPercent = playerData.stats.health / playerData.stats.maxHealth;
    document.getElementById('health-bar-fill').style.width = `${healthPercent * 100}%`;
    document.getElementById('health-text').textContent = 
      `${Math.floor(playerData.stats.health)}/${playerData.stats.maxHealth}`;
    
    // Обновление координат
    document.getElementById('coordinates').textContent = 
      `${Math.floor(playerData.position.x)}, ${Math.floor(playerData.position.y)}`;
    
    // Обновление уровня
    document.getElementById('level-text').textContent = playerData.stats.level;
    
    // Обновление опыта
    const expPercent = playerData.stats.experience / playerData.stats.nextLevelExp;
    document.getElementById('exp-bar-fill').style.width = `${expPercent * 100}%`;
    document.getElementById('exp-text').textContent = 
      `${playerData.stats.experience}/${playerData.stats.nextLevelExp}`;
  }

  start() {
    if (!this.isInitialized) {
      console.error('Игра не инициализирована');
      return;
    }
    
    console.log('▶️ Запуск игры...');
    
    // Скрытие меню, показ HUD
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('game-hud').classList.remove('hidden');
    
    // Запуск игрового ядра
    this.core.start();
    
    // Генерация начального мира вокруг игрока
    this.chunkSystem.updateActiveChunks(
      this.player.position.x,
      this.player.position.y,
      500
    );
  }

  newGame() {
    // Сброс прогресса
    localStorage.removeItem('player_save');
    localStorage.removeItem('world_seed');
    
    // Создание нового мира
    this.chunkSystem = new ChunkSystem(16);
    this.player = new Player();
    
    // Перезагрузка игры
    location.reload();
  }

  showSettings() {
    const settings = document.createElement('div');
    settings.id = 'settings-menu';
    settings.innerHTML = `
      <div class="settings-container">
        <h2>Настройки</h2>
        
        <div class="settings-section">
          <h3>Графика</h3>
          <div class="setting">
            <label>Разрешение</label>
            <select id="setting-resolution">
              <option value="720p">1280x720</option>
              <option value="1080p">1920x1080</option>
              <option value="1440p">2560x1440</option>
              <option value="4k">3840x2160</option>
            </select>
          </div>
          
          <div class="setting">
            <label>Качество текстур</label>
            <select id="setting-texture-quality">
              <option value="low">Низкое</option>
              <option value="medium" selected>Среднее</option>
              <option value="high">Высокое</option>
              <option value="ultra">Ультра</option>
            </select>
          </div>
          
          <div class="setting">
            <label>Дальность прорисовки</label>
            <input type="range" id="setting-render-distance" min="1" max="32" value="16">
            <span id="render-distance-value">16 чанков</span>
          </div>
        </div>
        
        <div class="settings-section">
          <h3>Звук</h3>
          <div class="setting">
            <label>Громкость музыки</label>
            <input type="range" id="setting-music-volume" min="0" max="100" value="50">
          </div>
          
          <div class="setting">
            <label>Громкость эффектов</label>
            <input type="range" id="setting-sfx-volume" min="0" max="100" value="70">
          </div>
        </div>
        
        <div class="settings-buttons">
          <button id="btn-settings-save" class="settings-btn">Сохранить</button>
          <button id="btn-settings-cancel" class="settings-btn">Отмена</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(settings);
  }

  showErrorScreen(error) {
    document.body.innerHTML = `
      <div class="error-screen">
        <h1>😞 Произошла ошибка</h1>
        <p class="error-message">${error.message}</p>
        <pre class="error-stack">${error.stack}</pre>
        <div class="error-actions">
          <button onclick="location.reload()">Перезагрузить</button>
          <button onclick="localStorage.clear(); location.reload()">Сбросить данные</button>
        </div>
      </div>
    `;
  }

  hideMenu() {
    document.getElementById('main-menu').classList.add('hidden');
  }
}

// Создание и инициализация игры при загрузке страницы
window.addEventListener('load', async () => {
  // Проверка поддержки WebGL
  if (!window.WebGLRenderingContext) {
    alert('Ваш браузер не поддерживает WebGL. Пожалуйста, обновите браузер.');
    return;
  }
  
  // Создание глобального объекта игры
  window.game = new Game();
  await window.game.init();
  
  // Экспорт для отладки в консоли
  if (process.env.NODE_ENV === 'development') {
    window.Game = Game;
    window.GameCore = GameCore;
    window.BlockSystem = BlockSystem;
    window.ChunkSystem = ChunkSystem;
    console.log('🔧 Режим разработки активирован');
  }
});

// Обработка закрытия страницы
window.addEventListener('beforeunload', (e) => {
  if (window.game && window.game.player) {
    window.game.player.saveToStorage();
  }
});