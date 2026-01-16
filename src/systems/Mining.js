import EventBus from '@/utils/EventBus.js';

export default class MiningSystem {
    constructor() {
        this.tools = new Map();
        this.miningProgress = new Map();
        this.currentMining = null;
        this.miningSpeed = 1.0;
        this.fortuneLevel = 0;
        
        this.setupTools();
        this.setupEventListeners();
    }
    
    setupTools() {
        // Рука
        this.tools.set('hand', {
            id: 'hand',
            name: 'Рука',
            type: 'none',
            tier: 0,
            miningSpeed: 0.3,
            durability: Infinity,
            maxDurability: Infinity,
            efficiency: {
                dirt: 1.0,
                stone: 0.3,
                wood: 1.0,
                leaves: 1.5
            }
        });
        
        // Деревянные инструменты
        this.tools.set('wooden_pickaxe', {
            id: 'wooden_pickaxe',
            name: 'Деревянная кирка',
            type: 'pickaxe',
            tier: 0,
            miningSpeed: 0.5,
            durability: 59,
            maxDurability: 59,
            efficiency: {
                dirt: 0.8,
                stone: 1.0,
                wood: 0.5,
                ore: 1.0
            }
        });
        
        this.tools.set('wooden_axe', {
            id: 'wooden_axe',
            name: 'Деревянный топор',
            type: 'axe',
            tier: 0,
            miningSpeed: 0.5,
            durability: 59,
            maxDurability: 59,
            efficiency: {
                dirt: 0.5,
                stone: 0.3,
                wood: 1.5,
                leaves: 1.2
            }
        });
        
        this.tools.set('wooden_shovel', {
            id: 'wooden_shovel',
            name: 'Деревянная лопата',
            type: 'shovel',
            tier: 0,
            miningSpeed: 0.5,
            durability: 59,
            maxDurability: 59,
            efficiency: {
                dirt: 1.5,
                sand: 1.5,
                gravel: 1.2,
                stone: 0.3
            }
        });
        
        // Каменные инструменты
        this.tools.set('stone_pickaxe', {
            id: 'stone_pickaxe',
            name: 'Каменная кирка',
            type: 'pickaxe',
            tier: 1,
            miningSpeed: 0.7,
            durability: 131,
            maxDurability: 131,
            efficiency: {
                dirt: 0.8,
                stone: 1.5,
                ore: 1.2,
                wood: 0.5
            }
        });
        
        // Железные инструменты
        this.tools.set('iron_pickaxe', {
            id: 'iron_pickaxe',
            name: 'Железная кирка',
            type: 'pickaxe',
            tier: 2,
            miningSpeed: 0.9,
            durability: 250,
            maxDurability: 250,
            efficiency: {
                dirt: 0.8,
                stone: 2.0,
                ore: 1.5,
                wood: 0.5
            }
        });
        
        // Алмазные инструменты
        this.tools.set('diamond_pickaxe', {
            id: 'diamond_pickaxe',
            name: 'Алмазная кирка',
            type: 'pickaxe',
            tier: 3,
            miningSpeed: 1.2,
            durability: 1561,
            maxDurability: 1561,
            efficiency: {
                dirt: 0.8,
                stone: 2.5,
                ore: 2.0,
                wood: 0.5
            }
        });
    }
    
    startMining(blockId, blockType, toolId, position) {
        const tool = this.tools.get(toolId) || this.tools.get('hand');
        const blockHardness = this.getBlockHardness(blockType);
        
        // Проверка возможности добычи
        if (!this.canMine(blockType, tool)) {
            EventBus.emit('mining:cannot_mine', {
                blockId,
                blockType,
                tool,
                reason: 'wrong_tool'
            });
            return false;
        }
        
        // Расчет времени добычи
        const miningTime = this.calculateMiningTime(blockHardness, tool, blockType);
        
        this.currentMining = {
            blockId,
            blockType,
            tool,
            position,
            startTime: Date.now(),
            totalTime: miningTime,
            progress: 0
        };
        
        EventBus.emit('mining:started', {
            blockId,
            blockType,
            tool,
            position,
            miningTime
        });
        
        return true;
    }
    
    updateMining(deltaTime) {
        if (!this.currentMining) return;
        
        const now = Date.now();
        const elapsed = now - this.currentMining.startTime;
        this.currentMining.progress = elapsed / this.currentMining.totalTime;
        
        // Отправка прогресса
        EventBus.emit('mining:progress', {
            blockId: this.currentMining.blockId,
            progress: this.currentMining.progress
        });
        
        // Проверка завершения
        if (elapsed >= this.currentMining.totalTime) {
            this.completeMining();
        }
    }
    
    completeMining() {
        if (!this.currentMining) return;
        
        const { blockId, blockType, tool, position } = this.currentMining;
        
        // Износ инструмента
        this.damageTool(tool);
        
        // Получение дропа
        const drops = this.getBlockDrops(blockType, this.fortuneLevel);
        
        EventBus.emit('mining:completed', {
            blockId,
            blockType,
            tool,
            position,
            drops
        });
        
        // Сброс текущей добычи
        this.currentMining = null;
        
        // Очистка прогресса
        this.miningProgress.delete(blockId);
    }
    
    cancelMining() {
        if (!this.currentMining) return;
        
        EventBus.emit('mining:cancelled', {
            blockId: this.currentMining.blockId
        });
        
        this.currentMining = null;
    }
    
    canMine(blockType, tool) {
        const blockInfo = this.getBlockInfo(blockType);
        
        // Проверка необходимости специального инструмента
        if (blockInfo.requiredTool) {
            if (tool.type !== blockInfo.requiredTool.type) {
                return false;
            }
            
            if (tool.tier < blockInfo.requiredTool.minTier) {
                return false;
            }
        }
        
        return true;
    }
    
    calculateMiningTime(hardness, tool, blockType) {
        // Базовое время
        let time = hardness * 1000; // в миллисекундах
        
        // Модификатор инструмента
        const efficiency = this.getToolEfficiency(tool, blockType);
        time /= efficiency;
        
        // Модификатор скорости добычи
        time /= this.miningSpeed;
        
        // Минимальное время
        time = Math.max(100, time);
        
        return time;
    }
    
    getToolEfficiency(tool, blockType) {
        const blockCategory = this.getBlockCategory(blockType);
        return tool.efficiency[blockCategory] || 1.0;
    }
    
    getBlockHardness(blockType) {
        const hardness = {
            0: 0,   // Воздух
            1: 0.6, // Трава
            2: 0.5, // Земля
            3: 1.5, // Камень
            4: 1.0, // Дерево
            5: 0.2, // Листья
            6: 0,   // Вода
            7: 0.4, // Песок
            8: 2.0, // Уголь
            9: 3.0, // Железо
            10: 4.0, // Золото
            11: 5.0, // Алмаз
            12: 0,   // Лава
            13: 0.3, // Стекло
            14: -1   // Бедрок (неломаемый)
        };
        
        return hardness[blockType] || 1.0;
    }
    
    getBlockCategory(blockType) {
        const categories = {
            1: 'dirt',    // Трава
            2: 'dirt',    // Земля
            3: 'stone',   // Камень
            4: 'wood',    // Дерево
            5: 'leaves',  // Листья
            7: 'sand',    // Песок
            8: 'ore',     // Уголь
            9: 'ore',     // Железо
            10: 'ore',    // Золото
            11: 'ore',    // Алмаз
            13: 'stone'   // Стекло
        };
        
        return categories[blockType] || 'stone';
    }
    
    getBlockInfo(blockType) {
        const info = {
            3: { requiredTool: { type: 'pickaxe', minTier: 1 } }, // Камень
            8: { requiredTool: { type: 'pickaxe', minTier: 1 } }, // Уголь
            9: { requiredTool: { type: 'pickaxe', minTier: 2 } }, // Железо
            10: { requiredTool: { type: 'pickaxe', minTier: 2 } }, // Золото
            11: { requiredTool: { type: 'pickaxe', minTier: 3 } }, // Алмаз
            14: { unbreakable: true } // Бедрок
        };
        
        return info[blockType] || {};
    }
    
    getBlockDrops(blockType, fortuneLevel = 0) {
        const drops = [];
        
        switch(blockType) {
            case 1: // Трава
            case 2: // Земля
                drops.push({ id: 2, count: 1 });
                break;
                
            case 3: // Камень
                drops.push({ id: 3, count: 1 });
                break;
                
            case 4: // Дерево
                drops.push({ id: 4, count: 1 });
                break;
                
            case 5: // Листья
                if (Math.random() < 0.05) {
                    drops.push({ id: 6, count: 1 }); // Саженец
                }
                break;
                
            case 7: // Песок
                drops.push({ id: 7, count: 1 });
                break;
                
            case 8: // Уголь
                let coalCount = 1;
                if (fortuneLevel > 0) {
                    coalCount += Math.floor(Math.random() * (fortuneLevel + 1));
                }
                drops.push({ id: 8, count: coalCount });
                break;
                
            case 9: // Железо
                drops.push({ id: 9, count: 1 });
                break;
                
            case 10: // Золото
                drops.push({ id: 10, count: 1 });
                break;
                
            case 11: // Алмаз
                let diamondCount = 1;
                if (fortuneLevel > 0) {
                    diamondCount += Math.floor(Math.random() * (fortuneLevel + 1));
                }
                drops.push({ id: 11, count: diamondCount });
                break;
                
            case 13: // Стекло
                // Стекло не дропается без шелка
                break;
        }
        
        return drops;
    }
    
    damageTool(tool) {
        if (tool.durability === Infinity) return;
        
        tool.durability -= 1;
        
        EventBus.emit('tool:damaged', {
            toolId: tool.id,
            durability: tool.durability,
            maxDurability: tool.maxDurability
        });
        
        if (tool.durability <= 0) {
            this.breakTool(tool);
        }
    }
    
    breakTool(tool) {
        EventBus.emit('tool:broken', {
            toolId: tool.id,
            toolName: tool.name
        });
    }
    
    repairTool(toolId, amount) {
        const tool = this.tools.get(toolId);
        if (!tool || tool.durability === Infinity) return false;
        
        tool.durability = Math.min(tool.maxDurability, tool.durability + amount);
        
        EventBus.emit('tool:repaired', {
            toolId,
            durability: tool.durability
        });
        
        return true;
    }
    
    getTool(toolId) {
        return this.tools.get(toolId);
    }
    
    getAvailableTools() {
        return Array.from(this.tools.values());
    }
    
    setMiningSpeed(speed) {
        this.miningSpeed = speed;
    }
    
    setFortuneLevel(level) {
        this.fortuneLevel = level;
    }
    
    setupEventListeners() {
        EventBus.on('mining:start', (data) => {
            this.startMining(
                data.blockId,
                data.blockType,
                data.toolId || 'hand',
                data.position
            );
        });
        
        EventBus.on('mining:cancel', () => {
            this.cancelMining();
        });
        
        EventBus.on('game:update', (data) => {
            this.updateMining(data.deltaTime);
        });
        
        EventBus.on('player:tool_changed', (data) => {
            // Обновление скорости добычи при смене инструмента
            const tool = this.tools.get(data.toolId);
            if (tool) {
                this.miningSpeed = tool.miningSpeed;
            }
        });
        
        EventBus.on('enchantment:fortune', (data) => {
            this.setFortuneLevel(data.level);
        });
    }
}