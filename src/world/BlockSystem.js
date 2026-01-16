import EventBus from '@/utils/EventBus.js';

export default class BlockSystem {
  constructor() {
    this.blocks = new Map();
    this.blockTextures = new Map();
    this.loaded = false;
  }

  async loadDefinitions() {
    try {
      console.log('📦 Загрузка определений блоков...');
      const response = await fetch('/assets/data/blocks.json');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      const definitions = data.blocks || data;
      
      for (const block of definitions) {
        this.registerBlock(block);
      }
      
      this.loaded = true;
      console.log(`✅ Загружено ${this.blocks.size} типов блоков`);
      EventBus.emit('blocks:loaded');
    } catch (error) {
      console.error('❌ Ошибка загрузки блоков:', error);
      this.loadFallbackBlocks();
    }
  }

  registerBlock(definition) {
    this.blocks.set(definition.id, {
      id: definition.id,
      name: definition.name,
      displayName: definition.displayName,
      solid: definition.solid ?? true,
      transparent: definition.transparent ?? false,
      lightLevel: definition.lightLevel ?? 0,
      hardness: definition.hardness ?? 1.0,
      toolType: definition.toolType, // 'pickaxe', 'axe', 'shovel'
      toolLevel: definition.toolLevel ?? 0, // 0=wood, 1=stone, 2=iron, 3=diamond
      drops: definition.drops ?? definition.id,
      color: definition.color,
      texture: definition.texture,
      variants: definition.variants ?? 1,
      // Специальные свойства
      isFluid: definition.isFluid ?? false,
      fluidDensity: definition.fluidDensity ?? 1.0,
      isClimbable: definition.isClimbable ?? false,
      emitsLight: definition.emitsLight ?? false,
      lightColor: definition.lightColor || '#ffffff'
    });
  }

  getBlock(id) {
    return this.blocks.get(id) || this.blocks.get(0); // Возвращает воздух если блок не найден
  }

  getTexture(blockId, variant = 0, face = 'top') {
    const block = this.getBlock(blockId);
    if (!block) return null;
    
    // Генерация ключа текстуры
    const textureKey = `${block.texture}_${variant}_${face}`;
    return this.blockTextures.get(textureKey) || this.blockTextures.get('default');
  }

  setTexture(blockId, variant, face, texture) {
    const textureKey = `${blockId}_${variant}_${face}`;
    this.blockTextures.set(textureKey, texture);
  }

  canHarvest(blockId, toolType, toolLevel) {
    const block = this.getBlock(blockId);
    if (!block.solid) return true;
    
    // Проверка необходимости инструмента
    if (block.toolType) {
      return toolType === block.toolType && toolLevel >= block.toolLevel;
    }
    
    return true;
  }

  getHarvestTime(blockId, toolType, toolLevel) {
    const block = this.getBlock(blockId);
    if (!block.solid) return 0;
    
    let time = block.hardness;
    
    // Модификатор инструмента
    if (block.toolType && toolType === block.toolType) {
      const toolEfficiency = [1, 2, 4, 8][toolLevel] || 1;
      time /= toolEfficiency;
    }
    
    return Math.max(0.1, time);
  }

  getDrop(blockId, fortuneLevel = 0) {
    const block = this.getBlock(blockId);
    if (!block.drops) return null;
    
    // Обработка нескольких дропов
    if (Array.isArray(block.drops)) {
      // Выбор случайного дропа с учетом шансов
      const totalWeight = block.drops.reduce((sum, drop) => sum + drop.weight, 0);
      let random = Math.random() * totalWeight;
      
      for (const drop of block.drops) {
        if (random < drop.weight) {
          // Увеличение количества с помощью удачи
          let count = drop.count || 1;
          if (fortuneLevel > 0 && drop.fortuneAffected !== false) {
            count += Math.floor(Math.random() * (fortuneLevel + 1));
          }
          return { id: drop.id, count };
        }
        random -= drop.weight;
      }
    }
    
    // Одиночный дроп
    return { id: block.drops, count: 1 };
  }

  loadFallbackBlocks() {
    console.log('⚠️ Использование резервных блоков');
    
    const fallbackBlocks = [
      {
        id: 0,
        name: 'air',
        displayName: 'Воздух',
        solid: false,
        transparent: true,
        color: '#00000000'
      },
      {
        id: 1,
        name: 'grass',
        displayName: 'Трава',
        solid: true,
        hardness: 0.6,
        toolType: 'shovel',
        color: '#7CFC00',
        drops: 2
      },
      {
        id: 2,
        name: 'dirt',
        displayName: 'Земля',
        solid: true,
        hardness: 0.5,
        toolType: 'shovel',
        color: '#8B4513',
        drops: 2
      },
      {
        id: 3,
        name: 'stone',
        displayName: 'Камень',
        solid: true,
        hardness: 1.5,
        toolType: 'pickaxe',
        toolLevel: 1,
        color: '#808080',
        drops: 4
      },
      {
        id: 4,
        name: 'wood',
        displayName: 'Дерево',
        solid: true,
        hardness: 1.0,
        toolType: 'axe',
        color: '#8B7355',
        drops: 5
      },
      {
        id: 5,
        name: 'leaves',
        displayName: 'Листья',
        solid: true,
        transparent: true,
        hardness: 0.2,
        color: '#228B22',
        drops: 6
      },
      {
        id: 6,
        name: 'water',
        displayName: 'Вода',
        solid: false,
        transparent: true,
        isFluid: true,
        fluidDensity: 1.0,
        color: '#1E90FF80'
      }
    ];
    
    for (const block of fallbackBlocks) {
      this.registerBlock(block);
    }
    
    this.loaded = true;
  }
}