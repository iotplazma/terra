import EventBus from '@/utils/EventBus.js';
import Noise from '@/utils/Noise.js';

export default class ChunkSystem {
  constructor(chunkSize = 16) {
    this.chunkSize = chunkSize;
    this.chunks = new Map();
    this.chunkCache = new Map();
    this.activeChunks = new Set();
    
    this.noise = new Noise();
    
    // Настройки генерации
    this.generationSettings = {
      terrainScale: 100,
      heightScale: 40,
      detailScale: 30,
      roughness: 0.5,
      seaLevel: 64,
      biomeScale: 200
    };
  }

  getChunkKey(x, y) {
    return `${Math.floor(x / this.chunkSize)},${Math.floor(y / this.chunkSize)}`;
  }

  getChunk(x, y) {
    const key = this.getChunkKey(x, y);
    
    // Проверка кеша
    if (this.chunkCache.has(key)) {
      return this.chunkCache.get(key);
    }
    
    // Загрузка или генерация чанка
    let chunk = this.chunks.get(key);
    if (!chunk) {
      chunk = this.generateChunk(key);
      this.chunks.set(key, chunk);
    }
    
    // Кеширование
    this.chunkCache.set(key, chunk);
    
    return chunk;
  }

  generateChunk(key) {
    const [chunkX, chunkY] = key.split(',').map(Number);
    const chunkData = new Uint8Array(this.chunkSize * this.chunkSize);
    
    const worldX = chunkX * this.chunkSize;
    const worldY = chunkY * this.chunkSize;
    
    // Генерация высот с помощью шума
    const heights = [];
    for (let x = 0; x < this.chunkSize; x++) {
      const globalX = worldX + x;
      const noiseValue = this.noise.perlin2(
        globalX / this.generationSettings.terrainScale,
        0
      );
      
      // Добавление деталей
      const detailNoise = this.noise.perlin2(
        globalX / this.generationSettings.detailScale,
        0
      ) * this.generationSettings.roughness;
      
      const height = Math.floor(
        this.generationSettings.seaLevel +
        noiseValue * this.generationSettings.heightScale +
        detailNoise * 10
      );
      
      heights.push(height);
    }
    
    // Заполнение чанка блоками
    for (let x = 0; x < this.chunkSize; x++) {
      for (let y = 0; y < this.chunkSize; y++) {
        const globalY = worldY + y;
        const index = y * this.chunkSize + x;
        
        if (globalY > heights[x]) {
          // Воздух
          chunkData[index] = 0;
        } else if (globalY === heights[x]) {
          // Поверхность
          chunkData[index] = 1; // Трава
        } else if (globalY > heights[x] - 5) {
          // Верхний слой земли
          chunkData[index] = 2; // Земля
        } else {
          // Камень
          chunkData[index] = 3;
          
          // Руда (случайная)
          if (globalY < this.generationSettings.seaLevel - 10) {
            const oreNoise = Math.random();
            if (oreNoise < 0.02) {
              chunkData[index] = 7; // Уголь
            } else if (oreNoise < 0.025) {
              chunkData[index] = 8; // Железо
            } else if (oreNoise < 0.005) {
              chunkData[index] = 9; // Золото
            } else if (oreNoise < 0.001) {
              chunkData[index] = 10; // Алмаз
            }
          }
        }
      }
    }
    
    // Специальные структуры
    this.generateStructures(chunkData, worldX, worldY, heights);
    
    return {
      key,
      x: chunkX,
      y: chunkY,
      worldX,
      worldY,
      data: chunkData,
      needsMeshUpdate: true,
      lastAccessed: Date.now()
    };
  }

  generateStructures(chunkData, worldX, worldY, heights) {
    // Генерация деревьев
    for (let x = 0; x < this.chunkSize; x++) {
      const globalX = worldX + x;
      
      // Деревья появляются на траве
      if (chunkData[x] === 1 && Math.random() < 0.02) {
        this.generateTree(chunkData, x, heights[x], globalX, worldY);
      }
      
      // Пещеры
      if (Math.random() < 0.1 && heights[x] - worldY < this.chunkSize) {
        this.generateCave(chunkData, x, heights[x], worldY);
      }
    }
  }

  generateTree(chunkData, x, surfaceHeight, globalX, worldY) {
    const treeHeight = 4 + Math.floor(Math.random() * 3);
    const trunkStart = surfaceHeight - worldY;
    
    // Ствол
    for (let i = 1; i <= treeHeight; i++) {
      const y = trunkStart - i;
      if (y >= 0 && y < this.chunkSize) {
        chunkData[y * this.chunkSize + x] = 4; // Дерево
      }
    }
    
    // Крона (в соседних чанках тоже)
    const crownRadius = 2;
    for (let dx = -crownRadius; dx <= crownRadius; dx++) {
      for (let dy = -crownRadius; dy <= 0; dy++) {
        const crownX = x + dx;
        const crownY = trunkStart - treeHeight + dy;
        
        if (Math.abs(dx) + Math.abs(dy) <= crownRadius + 1) {
          // Проверка границ чанка
          if (crownX >= 0 && crownX < this.chunkSize && 
              crownY >= 0 && crownY < this.chunkSize) {
            chunkData[crownY * this.chunkSize + crownX] = 5; // Листья
          } else {
            // Установка в соседний чанк
            const neighborX = globalX + dx;
            const neighborY = worldY + crownY;
            this.setBlock(neighborX, neighborY, 5);
          }
        }
      }
    }
  }

  generateCave(chunkData, x, surfaceHeight, worldY) {
    const caveHeight = surfaceHeight - worldY - 5;
    if (caveHeight < 0) return;
    
    const caveWidth = 2 + Math.floor(Math.random() * 3);
    const caveDepth = 3 + Math.floor(Math.random() * 4);
    
    for (let dx = -caveWidth; dx <= caveWidth; dx++) {
      for (let dy = 0; dy < caveDepth; dy++) {
        const caveX = x + dx;
        const caveY = caveHeight + dy;
        
        if (caveX >= 0 && caveX < this.chunkSize && 
            caveY >= 0 && caveY < this.chunkSize) {
          // Синусоидальная форма пещеры
          const shape = Math.sin(dx * Math.PI / caveWidth) * 
                       Math.sin(dy * Math.PI / caveDepth);
          
          if (shape > 0.3) {
            chunkData[caveY * this.chunkSize + caveX] = 0; // Воздух
          }
        }
      }
    }
  }

  getBlock(x, y) {
    const chunk = this.getChunk(x, y);
    if (!chunk) return 0;
    
    const localX = (x - chunk.worldX + this.chunkSize) % this.chunkSize;
    const localY = (y - chunk.worldY + this.chunkSize) % this.chunkSize;
    const index = localY * this.chunkSize + localX;
    
    return chunk.data[index] || 0;
  }

  setBlock(x, y, blockId) {
    const chunk = this.getChunk(x, y);
    if (!chunk) return false;
    
    const localX = (x - chunk.worldX + this.chunkSize) % this.chunkSize;
    const localY = (y - chunk.worldY + this.chunkSize) % this.chunkSize;
    const index = localY * this.chunkSize + localX;
    
    const oldBlock = chunk.data[index];
    chunk.data[index] = blockId;
    chunk.needsMeshUpdate = true;
    chunk.lastAccessed = Date.now();
    
    // Уведомление об изменении
    EventBus.emit('chunk:updated', {
      chunk: chunk.key,
      x: localX,
      y: localY,
      oldBlock,
      newBlock: blockId
    });
    
    // Инвалидация кеша соседних чанков при изменении на границе
    if (localX === 0 || localX === this.chunkSize - 1 ||
        localY === 0 || localY === this.chunkSize - 1) {
      this.invalidateNeighborCache(chunk.x, chunk.y);
    }
    
    return true;
  }

  invalidateNeighborCache(chunkX, chunkY) {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const key = `${chunkX + dx},${chunkY + dy}`;
        this.chunkCache.delete(key);
      }
    }
  }

  updateActiveChunks(centerX, centerY, radius) {
    this.activeChunks.clear();
    
    const startChunkX = Math.floor((centerX - radius) / this.chunkSize);
    const endChunkX = Math.floor((centerX + radius) / this.chunkSize);
    const startChunkY = Math.floor((centerY - radius) / this.chunkSize);
    const endChunkY = Math.floor((centerY + radius) / this.chunkSize);
    
    for (let x = startChunkX; x <= endChunkX; x++) {
      for (let y = startChunkY; y <= endChunkY; y++) {
        const key = `${x},${y}`;
        this.activeChunks.add(key);
        
        // Ленивая загрузка
        if (!this.chunks.has(key)) {
          this.getChunk(x * this.chunkSize, y * this.chunkSize);
        }
      }
    }
    
    // Очистка старых чанков
    this.cleanupOldChunks();
  }

  cleanupOldChunks() {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 минут
    
    for (const [key, chunk] of this.chunks) {
      if (!this.activeChunks.has(key) && now - chunk.lastAccessed > maxAge) {
        // Сохранение в хранилище перед удалением
        this.saveChunkToStorage(chunk);
        this.chunks.delete(key);
        this.chunkCache.delete(key);
      }
    }
  }

  saveChunkToStorage(chunk) {
    // Сохранение в IndexedDB или другом хранилище
    try {
      localStorage.setItem(`chunk_${chunk.key}`, 
        JSON.stringify(Array.from(chunk.data)));
    } catch (e) {
      console.warn('Не удалось сохранить чанк:', e);
    }
  }

  loadChunkFromStorage(key) {
    try {
      const data = localStorage.getItem(`chunk_${key}`);
      if (data) {
        const chunkData = Uint8Array.from(JSON.parse(data));
        const [x, y] = key.split(',').map(Number);
        
        return {
          key,
          x,
          y,
          worldX: x * this.chunkSize,
          worldY: y * this.chunkSize,
          data: chunkData,
          needsMeshUpdate: true,
          lastAccessed: Date.now()
        };
      }
    } catch (e) {
      console.warn('Не удалось загрузить чанк:', e);
    }
    
    return null;
  }

  getActiveChunks() {
    const chunks = [];
    for (const key of this.activeChunks) {
      const chunk = this.chunks.get(key);
      if (chunk) chunks.push(chunk);
    }
    return chunks;
  }
}