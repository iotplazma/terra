import Noise from '@/utils/Noise.js';

export default class TerrainGen {
    constructor(seed = Date.now()) {
        this.seed = seed;
        this.noise = new Noise(seed);
        
        this.settings = {
            terrain: {
                scale: 100,
                amplitude: 40,
                octaves: 4,
                persistence: 0.5,
                lacunarity: 2.0
            },
            caves: {
                scale: 30,
                threshold: 0.6,
                octaves: 2
            },
            biomes: {
                scale: 200,
                temperatureScale: 150,
                humidityScale: 120
            },
            structures: {
                treeDensity: 0.02,
                oreDensity: 0.05,
                caveDensity: 0.1
            }
        };
    }
    
    generateChunk(chunkX, chunkY, chunkSize = 16) {
        const data = new Uint8Array(chunkSize * chunkSize);
        const worldX = chunkX * chunkSize;
        const worldY = chunkY * chunkSize;
        
        // Генерация высот для этого чанка
        const heights = [];
        for (let x = 0; x < chunkSize; x++) {
            const globalX = worldX + x;
            heights[x] = this.getTerrainHeight(globalX);
        }
        
        // Заполнение чанка
        for (let x = 0; x < chunkSize; x++) {
            for (let y = 0; y < chunkSize; y++) {
                const globalY = worldY + y;
                const index = y * chunkSize + x;
                
                if (globalY > heights[x]) {
                    // Воздух
                    data[index] = 0;
                    
                    // Облака
                    if (globalY < 30 && this.noise.perlin2(
                        (worldX + x) / 50,
                        (worldY + y) / 50
                    ) > 0.7) {
                        data[index] = 13; // Стекло как облака
                    }
                } else {
                    // Определение слоя и блока
                    const depth = heights[x] - globalY;
                    data[index] = this.getBlockForDepth(depth, globalY, worldX + x);
                    
                    // Пещеры
                    if (depth > 5 && this.isCave(worldX + x, globalY)) {
                        data[index] = 0;
                    }
                }
            }
        }
        
        // Генерация поверхностных структур
        this.generateSurfaceStructures(data, worldX, worldY, heights, chunkSize);
        
        return data;
    }
    
    getTerrainHeight(x) {
        const settings = this.settings.terrain;
        
        // Основной рельеф
        let height = this.noise.fbm(
            x / settings.scale,
            0,
            settings.octaves,
            settings.persistence,
            settings.lacunarity
        );
        
        // Горы
        const mountainNoise = this.noise.ridged(
            x / (settings.scale * 2),
            0,
            3
        );
        
        if (mountainNoise > 0.3) {
            height += mountainNoise * 1.5;
        }
        
        // Нормализация и масштабирование
        height = (height + 1) / 2;
        const baseHeight = 40;
        
        return Math.floor(baseHeight + height * settings.amplitude);
    }
    
    getBlockForDepth(depth, y, x) {
        // Поверхность
        if (depth === 0) {
            const biome = this.getBiome(x, y);
            return this.getSurfaceBlock(biome);
        }
        
        // Верхний слой
        if (depth < 4) {
            return 2; // Земля
        }
        
        // Каменный слой
        if (depth < 15) {
            // Руда в каменном слое
            if (Math.random() < 0.1) {
                return this.getOre(y, 0.1); // Уголь
            }
            return 3; // Камень
        }
        
        // Глубины
        if (y < 10) {
            return 14; // Бедрок
        }
        
        // Глубинные руды
        const oreChance = Math.random();
        if (oreChance < 0.05) {
            return this.getOre(y, oreChance);
        }
        
        return 3; // Камень
    }
    
    getBiome(x, y) {
        const settings = this.settings.biomes;
        
        // Температура
        const temperature = this.noise.perlin2(
            x / settings.temperatureScale,
            this.seed
        );
        
        // Влажность
        const humidity = this.noise.perlin2(
            x / settings.humidityScale,
            this.seed + 1000
        );
        
        // Высота
        const height = this.getTerrainHeight(x);
        const elevation = y / height;
        
        // Определение биома
        if (elevation > 0.8) {
            return 'mountains';
        }
        
        if (temperature > 0.6) {
            if (humidity < 0.3) return 'desert';
            if (humidity < 0.6) return 'savanna';
            return 'jungle';
        }
        
        if (temperature < 0.3) {
            if (humidity < 0.4) return 'tundra';
            return 'taiga';
        }
        
        if (humidity < 0.3) return 'plains';
        if (humidity < 0.6) return 'forest';
        return 'swamp';
    }
    
    getSurfaceBlock(biome) {
        switch(biome) {
            case 'desert': return 7; // Песок
            case 'tundra': return 1; // Трава (снег позже)
            case 'forest': return 1; // Трава
            case 'jungle': return 1; // Трава
            case 'swamp': return 2; // Земля
            case 'mountains': return 3; // Камень
            default: return 1; // Трава
        }
    }
    
    getOre(y, chance) {
        if (y < 20) {
            // Глубокие руды
            if (chance < 0.005) return 11; // Алмазы
            if (chance < 0.02) return 10; // Золото
        }
        
        if (y < 40) {
            if (chance < 0.05) return 9; // Железо
        }
        
        return 8; // Уголь
    }
    
    isCave(x, y) {
        const settings = this.settings.caves;
        
        const value = this.noise.fbm(
            x / settings.scale,
            y / settings.scale,
            settings.octaves
        );
        
        // Добавляем шум для естественных пещер
        const detail = this.noise.perlin2(
            x / (settings.scale * 0.3),
            y / (settings.scale * 0.3)
        ) * 0.3;
        
        return (value + detail) > settings.threshold;
    }
    
    generateSurfaceStructures(data, worldX, worldY, heights, chunkSize) {
        for (let x = 0; x < chunkSize; x++) {
            const globalX = worldX + x;
            const surfaceY = heights[x];
            
            // Проверяем, что поверхность в этом чанке
            if (surfaceY >= worldY && surfaceY < worldY + chunkSize) {
                const localY = surfaceY - worldY;
                const index = localY * chunkSize + x;
                const surfaceBlock = data[index];
                
                // Деревья на траве
                if (surfaceBlock === 1 && Math.random() < this.settings.structures.treeDensity) {
                    this.generateTree(data, x, localY, globalX, worldY, chunkSize);
                }
                
                // Цветы и травка
                if (surfaceBlock === 1 && Math.random() < 0.3) {
                    const flowerY = localY - 1;
                    if (flowerY >= 0) {
                        const flowerIndex = flowerY * chunkSize + x;
                        data[flowerIndex] = 18; // Факел как цветок
                    }
                }
            }
        }
        
        // Подземные руды
        this.generateOres(data, worldX, worldY, chunkSize);
    }
    
    generateTree(data, x, y, globalX, worldY, chunkSize) {
        const treeHeight = 4 + Math.floor(Math.random() * 3);
        const trunkStart = y;
        
        // Ствол
        for (let i = 1; i <= treeHeight; i++) {
            const treeY = trunkStart - i;
            if (treeY >= 0) {
                const index = treeY * chunkSize + x;
                data[index] = 4; // Дерево
            }
        }
        
        // Крона
        const crownRadius = 2;
        const crownStart = trunkStart - treeHeight;
        
        for (let dx = -crownRadius; dx <= crownRadius; dx++) {
            for (let dy = -crownRadius; dy <= 0; dy++) {
                const crownX = x + dx;
                const crownY = crownStart + dy;
                
                // Проверка границ чанка
                if (crownX >= 0 && crownX < chunkSize && 
                    crownY >= 0 && crownY < chunkSize) {
                    
                    if (Math.abs(dx) + Math.abs(dy) <= crownRadius + 1) {
                        const index = crownY * chunkSize + crownX;
                        data[index] = 5; // Листья
                    }
                }
            }
        }
    }
    
    generateOres(data, worldX, worldY, chunkSize) {
        const veinCount = Math.floor(Math.random() * 5) + 1;
        
        for (let v = 0; v < veinCount; v++) {
            const oreType = this.getRandomOreType(worldY);
            if (!oreType) continue;
            
            const veinX = Math.floor(Math.random() * chunkSize);
            const veinY = Math.floor(Math.random() * chunkSize);
            const veinSize = Math.floor(Math.random() * 3) + 2;
            
            // Создание жилы
            for (let i = 0; i < veinSize; i++) {
                const offsetX = veinX + Math.floor((Math.random() - 0.5) * 4);
                const offsetY = veinY + Math.floor((Math.random() - 0.5) * 4);
                
                if (offsetX >= 0 && offsetX < chunkSize && 
                    offsetY >= 0 && offsetY < chunkSize) {
                    
                    const index = offsetY * chunkSize + offsetX;
                    // Заменяем только камень
                    if (data[index] === 3) {
                        data[index] = oreType;
                    }
                }
            }
        }
    }
    
    getRandomOreType(y) {
        if (y < 10) {
            const r = Math.random();
            if (r < 0.1) return 11; // Алмазы
            if (r < 0.3) return 10; // Золото
        }
        
        if (y < 30) {
            if (Math.random() < 0.4) return 9; // Железо
        }
        
        if (Math.random() < 0.5) return 8; // Уголь
        
        return null;
    }
    
    getHeightmap(width, startX = 0) {
        const heightmap = new Array(width);
        
        for (let x = 0; x < width; x++) {
            heightmap[x] = this.getTerrainHeight(startX + x);
        }
        
        return heightmap;
    }
    
    getBiomeMap(width, height, startX = 0) {
        const biomeMap = new Array(height);
        
        for (let y = 0; y < height; y++) {
            biomeMap[y] = new Array(width);
            for (let x = 0; x < width; x++) {
                const globalY = y; // Упрощенно
                biomeMap[y][x] = this.getBiome(startX + x, globalY);
            }
        }
        
        return biomeMap;
    }
    
    setSeed(seed) {
        this.seed = seed;
        this.noise = new Noise(seed);
    }
    
    updateSettings(newSettings) {
        this.settings = {
            ...this.settings,
            ...newSettings
        };
    }
}