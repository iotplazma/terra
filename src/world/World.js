import EventBus from '@/utils/EventBus.js';
import ChunkSystem from './ChunkSystem.js';
import BlockSystem from './BlockSystem.js';
import Noise from '@/utils/Noise.js';

export default class World {
    constructor() {
        this.chunks = new ChunkSystem();
        this.blocks = new BlockSystem();
        this.noise = new Noise();
        
        this.width = 200;
        this.height = 100;
        this.seed = Date.now();
        this.biomes = new Map();
        this.structures = [];
        this.spawnPoint = { x: 0, y: 0 };
        this.time = { day: 0, hour: 12, minute: 0 };
        this.weather = 'clear';
        
        this.setupEventListeners();
    }
    
    async init() {
        console.log('🌍 Инициализация мира...');
        await this.blocks.loadDefinitions();
        this.generate();
        console.log('✅ Мир готов');
    }
    
    generate() {
        console.log(`🌱 Генерация мира (seed: ${this.seed})...`);
        
        // Генерация высот и биомов
        const heightmap = this.generateHeightmap();
        const biomeMap = this.generateBiomes();
        
        // Установка точки спавна
        this.spawnPoint = this.findSpawnPoint(heightmap);
        
        // Заполнение мира блоками
        this.fillWorld(heightmap, biomeMap);
        
        // Генерация структур
        this.generateStructures();
        
        EventBus.emit('world:generated', {
            width: this.width,
            height: this.height,
            spawn: this.spawnPoint
        });
    }
    
    generateHeightmap() {
        const map = [];
        const noiseScale = 100;
        
        for (let x = 0; x < this.width; x++) {
            map[x] = [];
            for (let y = 0; y < this.height; y++) {
                // Основной шум
                let value = this.noise.perlin2(
                    x / noiseScale,
                    y / noiseScale
                );
                
                // Добавление деталей
                value += this.noise.perlin2(
                    x / (noiseScale * 0.5),
                    y / (noiseScale * 0.5)
                ) * 0.5;
                
                // Горы
                const mountainNoise = this.noise.perlin2(
                    x / (noiseScale * 2),
                    y / (noiseScale * 2)
                );
                
                if (mountainNoise > 0.7) {
                    value += mountainNoise * 2;
                }
                
                // Нормализация
                value = (value + 1) / 2;
                
                // Преобразование в высоту
                const terrainHeight = Math.floor(value * 40) + 20;
                map[x][y] = terrainHeight;
            }
        }
        
        return map;
    }
    
    generateBiomes() {
        const map = [];
        const scale = 50;
        
        for (let x = 0; x < this.width; x++) {
            map[x] = [];
            for (let y = 0; y < this.height; y++) {
                // Температура и влажность
                const temp = this.noise.perlin2(x / scale, 0);
                const humidity = this.noise.perlin2(x / scale * 1.3, 100);
                
                // Определение биома
                let biome = 'plains';
                
                if (temp > 0.6) {
                    biome = humidity < 0.3 ? 'desert' : 'savanna';
                } else if (temp < 0.3) {
                    biome = humidity < 0.4 ? 'tundra' : 'taiga';
                } else {
                    if (humidity < 0.3) biome = 'plains';
                    else if (humidity < 0.6) biome = 'forest';
                    else biome = 'swamp';
                }
                
                map[x][y] = biome;
            }
        }
        
        return map;
    }
    
    fillWorld(heightmap, biomeMap) {
        for (let x = 0; x < this.width; x++) {
            for (let y = 0; y < this.height; y++) {
                const height = heightmap[x][y];
                const biome = biomeMap[x][y];
                
                let blockId = 0; // Воздух
                
                if (y > height) {
                    // Облака
                    if (y < 20 && Math.random() < 0.01) {
                        blockId = 13; // Стекло как облако
                    }
                } else if (y === height) {
                    // Поверхность
                    blockId = this.getSurfaceBlock(biome);
                    
                    // Растения
                    if (biome === 'forest' && Math.random() < 0.1) {
                        this.generateTree(x, y - 1);
                    }
                } else if (y > height - 5) {
                    // Верхний слой
                    blockId = 2; // Земля
                } else if (y > height - 15) {
                    // Каменный слой
                    if (Math.random() < 0.1) {
                        blockId = 8; // Уголь
                    } else {
                        blockId = 3; // Камень
                    }
                } else {
                    // Глубины
                    const r = Math.random();
                    if (r < 0.05) blockId = 9; // Железо
                    else if (r < 0.02) blockId = 10; // Золото
                    else if (r < 0.005) blockId = 11; // Алмазы
                    else if (r < 0.01) blockId = 12; // Лава
                    else blockId = 3;
                }
                
                this.setBlock(x, y, blockId);
                this.biomes.set(`${x},${y}`, biome);
            }
        }
    }
    
    getSurfaceBlock(biome) {
        switch(biome) {
            case 'desert': return 7; // Песок
            case 'tundra': return 1; // Трава (снег позже)
            case 'forest': return 1; // Трава
            case 'swamp': return 2; // Земля
            default: return 1; // Трава
        }
    }
    
    generateTree(x, y) {
        const height = 3 + Math.floor(Math.random() * 3);
        
        // Ствол
        for (let i = 0; i < height; i++) {
            this.setBlock(x, y - i, 4); // Дерево
        }
        
        // Крона
        const radius = 2;
        for (let dx = -radius; dx <= radius; dx++) {
            for (let dy = -radius; dy <= 0; dy++) {
                if (Math.abs(dx) + Math.abs(dy) <= radius + 1) {
                    this.setBlock(x + dx, y - height + dy, 5); // Листья
                }
            }
        }
    }
    
    generateStructures() {
        // Пещеры
        for (let i = 0; i < 20; i++) {
            const x = Math.floor(Math.random() * this.width);
            const y = 20 + Math.floor(Math.random() * 30);
            this.generateCave(x, y);
        }
        
        // Озёра
        for (let i = 0; i < 10; i++) {
            const x = Math.floor(Math.random() * this.width);
            const y = this.getSurfaceHeight(x);
            this.generateLake(x, y + 1);
        }
    }
    
    generateCave(startX, startY) {
        const length = 10 + Math.floor(Math.random() * 20);
        const branches = Math.floor(Math.random() * 3);
        
        let x = startX;
        let y = startY;
        
        for (let i = 0; i < length; i++) {
            // Выкопать блок
            this.setBlock(x, y, 0);
            
            // Случайное направление
            x += Math.floor(Math.random() * 3) - 1;
            y += Math.floor(Math.random() * 3) - 1;
            
            // Ограничения
            x = Math.max(0, Math.min(x, this.width - 1));
            y = Math.max(0, Math.min(y, this.height - 1));
        }
    }
    
    generateLake(x, y) {
        const radius = 2 + Math.floor(Math.random() * 3);
        
        for (let dx = -radius; dx <= radius; dx++) {
            for (let dy = 0; dy <= 2; dy++) {
                if (dx*dx + dy*dy <= radius*radius) {
                    this.setBlock(x + dx, y + dy, 6); // Вода
                }
            }
        }
    }
    
    findSpawnPoint(heightmap) {
        // Ищем плоскую область для спавна
        for (let x = this.width / 2; x < this.width; x++) {
            const height = heightmap[x][0];
            let flat = true;
            
            // Проверяем 10 блоков вперёд
            for (let dx = 0; dx < 10; dx++) {
                if (Math.abs(heightmap[x + dx][0] - height) > 2) {
                    flat = false;
                    break;
                }
            }
            
            if (flat) {
                return { x: x * 32, y: (height - 5) * 32 };
            }
        }
        
        return { x: 100 * 32, y: 50 * 32 };
    }
    
    getSurfaceHeight(x) {
        for (let y = 0; y < this.height; y++) {
            const block = this.getBlock(x, y);
            if (block.type > 0 && block.type !== 6 && block.type !== 12) {
                return y;
            }
        }
        return this.height - 1;
    }
    
    getBlock(x, y) {
        const chunk = this.chunks.getChunk(x, y);
        if (!chunk) return { type: 0, solid: false };
        
        const localX = (x - chunk.worldX + 16) % 16;
        const localY = (y - chunk.worldY + 16) % 16;
        const index = localY * 16 + localX;
        const blockId = chunk.data[index] || 0;
        
        return this.blocks.getBlock(blockId);
    }
    
    setBlock(x, y, type) {
        this.chunks.setBlock(x, y, type);
        
        EventBus.emit('world:block_changed', {
            x, y, type,
            biome: this.biomes.get(`${x},${y}`) || 'plains'
        });
    }
    
    update(deltaTime) {
        // Обновление времени суток
        this.time.minute += deltaTime * 10;
        
        if (this.time.minute >= 60) {
            this.time.minute = 0;
            this.time.hour = (this.time.hour + 1) % 24;
            
            if (this.time.hour === 0) {
                this.time.day++;
                
                // Смена погоды
                if (Math.random() < 0.3) {
                    this.weather = Math.random() < 0.5 ? 'rain' : 'clear';
                    EventBus.emit('world:weather_changed', { weather: this.weather });
                }
            }
        }
        
        // Отправка события времени
        EventBus.emit('world:time_updated', { ...this.time, weather: this.weather });
    }
    
    getBlockCount() {
        let count = 0;
        for (const chunk of this.chunks.chunks.values()) {
            for (const block of chunk.data) {
                if (block > 0) count++;
            }
        }
        return count;
    }
    
    save() {
        const saveData = {
            seed: this.seed,
            spawn: this.spawnPoint,
            time: this.time,
            weather: this.weather,
            chunks: Array.from(this.chunks.chunks.entries())
        };
        
        localStorage.setItem('world_save', JSON.stringify(saveData));
        return saveData;
    }
    
    load() {
        const saveData = JSON.parse(localStorage.getItem('world_save'));
        if (!saveData) return false;
        
        this.seed = saveData.seed;
        this.spawnPoint = saveData.spawn;
        this.time = saveData.time;
        this.weather = saveData.weather;
        
        // Загрузка чанков
        this.chunks.chunks.clear();
        for (const [key, chunk] of saveData.chunks) {
            this.chunks.chunks.set(key, {
                ...chunk,
                data: new Uint8Array(chunk.data)
            });
        }
        
        return true;
    }
    
    setupEventListeners() {
        EventBus.on('world:get_block', (data) => {
            const block = this.getBlock(data.x, data.y);
            EventBus.emit('world:block_info', {
                x: data.x,
                y: data.y,
                block: block
            });
        });
        
        EventBus.on('world:set_block', (data) => {
            this.setBlock(data.x, data.y, data.type);
        });
        
        EventBus.on('world:save', () => {
            this.save();
        });
        
        EventBus.on('world:load', () => {
            this.load();
        });
    }
}