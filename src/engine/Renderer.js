import * as PIXI from 'pixi.js';

export default class Renderer {
  constructor(config) {
    this.config = config;
    this.app = null;
    this.stage = null;
    this.worldContainer = null;
    this.uiContainer = null;
    this.debugContainer = null;
    
    this.camera = {
      x: 0,
      y: 0,
      zoom: 2,
      targetZoom: 2,
      minZoom: 0.5,
      maxZoom: 4,
      smoothing: 0.1
    };
    
    this.textures = new Map();
    this.sprites = new Map();
    this.chunkMeshes = new Map();
  }

  async init() {
    console.log('🎨 Инициализация WebGL рендерера...');
    
    // Создание PIXI Application
    this.app = new PIXI.Application({
      width: this.config.width,
      height: this.config.height,
      backgroundColor: 0x0a0a12,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      antialias: true,
      powerPreference: 'high-performance'
    });
    
    // Добавление канваса в DOM
    document.getElementById('game-container').appendChild(this.app.view);
    
    // Создание контейнеров
    this.stage = this.app.stage;
    this.worldContainer = new PIXI.Container();
    this.uiContainer = new PIXI.Container();
    this.debugContainer = new PIXI.Container();
    
    this.stage.addChild(this.worldContainer);
    this.stage.addChild(this.uiContainer);
    this.stage.addChild(this.debugContainer);
    
    // Настройка фильтров
    this.setupFilters();
    
    // Обработка изменения размера
    window.addEventListener('resize', this.handleResize.bind(this));
    this.handleResize();
    
    console.log('✅ Рендерер готов');
  }

  setupFilters() {
    // Создание слоев для пост-обработки
    this.worldContainer.filters = [
      new PIXI.filters.ColorMatrixFilter(),
      new PIXI.filters.BlurFilter()
    ];
    
    // Настройка цветового фильтра для времени суток
    this.colorFilter = this.worldContainer.filters[0];
    this.colorFilter.brightness(1.0, false);
    
    // Настройка размытия для глубины резкости
    this.blurFilter = this.worldContainer.filters[1];
    this.blurFilter.blur = 0;
  }

  handleResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    this.app.renderer.resize(width, height);
    
    // Центрирование камеры
    this.uiContainer.position.set(width / 2, height / 2);
  }

  setCamera(x, y, immediate = false) {
    if (immediate) {
      this.camera.x = x;
      this.camera.y = y;
    } else {
      // Плавное движение камеры
      this.camera.x += (x - this.camera.x) * this.camera.smoothing;
      this.camera.y += (y - this.camera.y) * this.camera.smoothing;
    }
    
    // Обновление позиции мира
    this.worldContainer.position.set(
      -this.camera.x * this.camera.zoom + this.app.screen.width / 2,
      -this.camera.y * this.camera.zoom + this.app.screen.height / 2
    );
    
    // Масштабирование
    this.worldContainer.scale.set(this.camera.zoom);
  }

  setZoom(zoom, immediate = false) {
    this.camera.targetZoom = Math.max(
      this.camera.minZoom,
      Math.min(this.camera.maxZoom, zoom)
    );
    
    if (immediate) {
      this.camera.zoom = this.camera.targetZoom;
    } else {
      this.camera.zoom += (this.camera.targetZoom - this.camera.zoom) * 0.1;
    }
    
    this.worldContainer.scale.set(this.camera.zoom);
  }

  async loadTexture(id, url) {
    try {
      const texture = await PIXI.Assets.load(url);
      this.textures.set(id, texture);
      return texture;
    } catch (error) {
      console.error(`Ошибка загрузки текстуры ${id}:`, error);
      return this.createFallbackTexture();
    }
  }

  createFallbackTexture() {
    const graphics = new PIXI.Graphics();
    graphics.beginFill(0xFF0000);
    graphics.drawRect(0, 0, 16, 16);
    graphics.endFill();
    
    return this.app.renderer.generateTexture(graphics);
  }

  createChunkMesh(chunk, blockSystem) {
    const mesh = new PIXI.Container();
    
    for (let x = 0; x < chunk.data.length; x++) {
      const blockId = chunk.data[x];
      if (blockId === 0) continue;
      
      const block = blockSystem.getBlock(blockId);
      if (!block) continue;
      
      const sprite = new PIXI.Sprite(this.getBlockTexture(blockId));
      sprite.position.set(
        (x % this.chunkSize) * 16,
        Math.floor(x / this.chunkSize) * 16
      );
      
      mesh.addChild(sprite);
    }
    
    mesh.position.set(chunk.worldX * 16, chunk.worldY * 16);
    this.chunkMeshes.set(chunk.key, mesh);
    this.worldContainer.addChild(mesh);
    
    return mesh;
  }

  updateChunkMesh(chunk, blockSystem) {
    const mesh = this.chunkMeshes.get(chunk.key);
    if (!mesh) return;
    
    mesh.removeChildren();
    
    for (let x = 0; x < chunk.data.length; x++) {
      const blockId = chunk.data[x];
      if (blockId === 0) continue;
      
      const texture = this.getBlockTexture(blockId);
      if (!texture) continue;
      
      const sprite = new PIXI.Sprite(texture);
      sprite.position.set(
        (x % this.chunkSize) * 16,
        Math.floor(x / this.chunkSize) * 16
      );
      
      mesh.addChild(sprite);
    }
  }

  getBlockTexture(blockId) {
    // Возвращает текстуру блока из кеша
    const textureKey = `block_${blockId}`;
    if (this.textures.has(textureKey)) {
      return this.textures.get(textureKey);
    }
    
    // Создание временной текстуры
    return this.createFallbackTexture();
  }

  renderUI() {
    // Очистка UI контейнера
    this.uiContainer.removeChildren();
    
    // Здесь будет рендер интерфейса
    // Инвентарь, здоровье, мини-карта и т.д.
  }

  drawDebugInfo(fps, entityCount) {
    this.debugContainer.removeChildren();
    
    const text = new PIXI.Text(
      `FPS: ${Math.round(fps)}\n` +
      `Entities: ${entityCount}\n` +
      `Camera: ${Math.round(this.camera.x)}, ${Math.round(this.camera.y)}\n` +
      `Zoom: ${this.camera.zoom.toFixed(2)}`,
      {
        fontFamily: 'Arial',
        fontSize: 12,
        fill: 0xffffff,
        align: 'left'
      }
    );
    
    text.position.set(10, 10);
    this.debugContainer.addChild(text);
  }

  clear() {
    // Очистка экрана
    this.app.renderer.clear();
  }

  cleanup() {
    this.app.destroy(true, true);
    this.textures.clear();
    this.sprites.clear();
    this.chunkMeshes.clear();
  }
}