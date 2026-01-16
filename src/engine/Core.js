import EventBus from '@/utils/EventBus.js';
import AssetManager from './AssetManager.js';
import Renderer from './Renderer.js';
import Input from './Input.js';
import Physics from './Physics.js';

export default class GameCore {
  constructor(config = {}) {
    this.config = {
      width: 1280,
      height: 720,
      targetFPS: 60,
      debug: false,
      ...config
    };

    this.assets = new AssetManager();
    this.renderer = new Renderer(this.config);
    this.input = new Input();
    this.physics = new Physics();
    this.eventBus = EventBus;
    
    this.scene = null;
    this.isRunning = false;
    this.lastTime = 0;
    this.deltaTime = 0;
    this.fps = 0;
    
    this.gameObjects = new Map();
    this.systems = [];
    this.world = null;
  }

  async init() {
    console.log('🚀 Инициализация игрового ядра...');
    
    // Инициализация подсистем
    await this.assets.init();
    await this.renderer.init();
    this.input.init();
    
    // Загрузка базовых ресурсов
    await this.loadEssentialAssets();
    
    // Настройка игрового цикла
    this.setupGameLoop();
    
    console.log('✅ Игровое ядро готово');
  }

  async loadEssentialAssets() {
    // Предзагрузка критичных ресурсов
    const manifest = [
      { id: 'player', url: '/assets/textures/entities/player.png', type: 'image' },
      { id: 'ui-atlas', url: '/assets/textures/ui/atlas.png', type: 'image' },
      { id: 'font-main', url: '/assets/fonts/main.ttf', type: 'font' },
      { id: 'config-blocks', url: '/assets/data/blocks.json', type: 'json' },
      { id: 'config-recipes', url: '/assets/data/recipes.json', type: 'json' }
    ];

    return this.assets.loadManifest(manifest);
  }

  setupGameLoop() {
    const tick = (currentTime) => {
      if (!this.isRunning) return;
      
      // Расчет deltaTime
      this.deltaTime = (currentTime - this.lastTime) / 1000;
      this.lastTime = currentTime;
      this.fps = Math.min(60, 1 / this.deltaTime);
      
      // Ограничение FPS
      if (this.deltaTime > 1 / this.config.targetFPS) {
        this.deltaTime = 1 / this.config.targetFPS;
      }
      
      // Обновление состояния
      this.update(this.deltaTime);
      
      // Отрисовка
      this.render();
      
      // Следующий кадр
      requestAnimationFrame(tick);
    };
    
    this.gameLoop = tick;
  }

  update(deltaTime) {
    // Обновление физики
    this.physics.update(deltaTime);
    
    // Обновление игровых объектов
    for (const [id, obj] of this.gameObjects) {
      if (obj.update) obj.update(deltaTime, this.world);
    }
    
    // Обновление систем
    for (const system of this.systems) {
      if (system.update) system.update(deltaTime);
    }
    
    // Отправка события обновления
    this.eventBus.emit('game:update', { deltaTime });
  }

  render() {
    // Очистка экрана
    this.renderer.clear();
    
    // Рендер игровых объектов
    for (const [id, obj] of this.gameObjects) {
      if (obj.render) obj.render(this.renderer);
    }
    
    // Рендер интерфейса
    this.renderer.renderUI();
    
    // Отладка (FPS, информация)
    if (this.config.debug) {
      this.renderer.drawDebugInfo(this.fps, this.gameObjects.size);
    }
  }

  start() {
    if (this.isRunning) return;
    
    console.log('▶️ Запуск игры...');
    this.isRunning = true;
    this.lastTime = performance.now();
    requestAnimationFrame(this.gameLoop.bind(this));
    
    this.eventBus.emit('game:start');
  }

  pause() {
    this.isRunning = false;
    this.eventBus.emit('game:pause');
  }

  stop() {
    this.isRunning = false;
    this.eventBus.emit('game:stop');
    
    // Очистка ресурсов
    this.renderer.cleanup();
    this.input.cleanup();
  }

  addGameObject(id, obj) {
    this.gameObjects.set(id, obj);
    if (obj.init) obj.init(this);
  }

  removeGameObject(id) {
    const obj = this.gameObjects.get(id);
    if (obj && obj.destroy) obj.destroy();
    this.gameObjects.delete(id);
  }

  registerSystem(system) {
    this.systems.push(system);
    if (system.init) system.init(this);
  }
}