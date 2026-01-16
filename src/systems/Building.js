import EventBus from '@/utils/EventBus.js';

export default class BuildingSystem {
    constructor() {
        this.blocks = new Map();
        this.structures = new Map();
        this.blueprints = new Map();
        this.maxBuildDistance = 100;
        this.ghostBlock = null;
        this.isBuilding = false;
        
        this.setupBlueprints();
        this.setupEventListeners();
    }
    
    setupBlueprints() {
        // Простые структуры
        this.blueprints.set('small_house', {
            id: 'small_house',
            name: 'Маленький дом',
            size: { width: 7, height: 5 },
            blocks: [
                // Фундамент
                { x: 0, y: 0, type: 3 },
                { x: 1, y: 0, type: 3 },
                { x: 2, y: 0, type: 3 },
                { x: 3, y: 0, type: 3 },
                { x: 4, y: 0, type: 3 },
                { x: 5, y: 0, type: 3 },
                { x: 6, y: 0, type: 3 },
                
                // Стены
                { x: 0, y: 1, type: 4 },
                { x: 0, y: 2, type: 4 },
                { x: 0, y: 3, type: 4 },
                { x: 6, y: 1, type: 4 },
                { x: 6, y: 2, type: 4 },
                { x: 6, y: 3, type: 4 },
                
                // Задняя стена
                { x: 1, y: 3, type: 4 },
                { x: 2, y: 3, type: 4 },
                { x: 3, y: 3, type: 4 },
                { x: 4, y: 3, type: 4 },
                { x: 5, y: 3, type: 4 },
                
                // Крыша
                { x: 0, y: 4, type: 5 },
                { x: 1, y: 4, type: 5 },
                { x: 2, y: 4, type: 5 },
                { x: 3, y: 4, type: 5 },
                { x: 4, y: 4, type: 5 },
                { x: 5, y: 4, type: 5 },
                { x: 6, y: 4, type: 5 },
                
                // Дверь
                { x: 3, y: 1, type: 0 },
                { x: 3, y: 2, type: 0 },
                
                // Окна
                { x: 1, y: 2, type: 13 },
                { x: 5, y: 2, type: 13 }
            ],
            requirements: [
                { id: 3, count: 7 },  // Камень
                { id: 4, count: 11 }, // Дерево
                { id: 5, count: 7 },  // Листья
                { id: 13, count: 2 }  // Стекло
            ]
        });
        
        this.blueprints.set('wall', {
            id: 'wall',
            name: 'Стена',
            size: { width: 5, height: 3 },
            blocks: [
                { x: 0, y: 0, type: 3 },
                { x: 1, y: 0, type: 3 },
                { x: 2, y: 0, type: 3 },
                { x: 3, y: 0, type: 3 },
                { x: 4, y: 0, type: 3 },
                
                { x: 0, y: 1, type: 3 },
                { x: 1, y: 1, type: 3 },
                { x: 2, y: 1, type: 3 },
                { x: 3, y: 1, type: 3 },
                { x: 4, y: 1, type: 3 },
                
                { x: 0, y: 2, type: 3 },
                { x: 1, y: 2, type: 3 },
                { x: 2, y: 2, type: 3 },
                { x: 3, y: 2, type: 3 },
                { x: 4, y: 2, type: 3 }
            ],
            requirements: [
                { id: 3, count: 15 } // Камень
            ]
        });
        
        this.blueprints.set('tower', {
            id: 'tower',
            name: 'Башня',
            size: { width: 5, height: 7 },
            blocks: [
                // Основание
                { x: 1, y: 0, type: 3 },
                { x: 2, y: 0, type: 3 },
                { x: 3, y: 0, type: 3 },
                
                { x: 0, y: 1, type: 3 },
                { x: 1, y: 1, type: 3 },
                { x: 2, y: 1, type: 3 },
                { x: 3, y: 1, type: 3 },
                { x: 4, y: 1, type: 3 },
                
                // Стены
                { x: 0, y: 2, type: 3 },
                { x: 4, y: 2, type: 3 },
                { x: 0, y: 3, type: 3 },
                { x: 4, y: 3, type: 3 },
                { x: 0, y: 4, type: 3 },
                { x: 4, y: 4, type: 3 },
                { x: 0, y: 5, type: 3 },
                { x: 4, y: 5, type: 3 },
                
                // Внутренние блоки
                { x: 1, y: 2, type: 3 },
                { x: 2, y: 2, type: 3 },
                { x: 3, y: 2, type: 3 },
                { x: 2, y: 3, type: 3 },
                { x: 2, y: 4, type: 3 },
                
                // Крыша
                { x: 0, y: 6, type: 5 },
                { x: 1, y: 6, type: 5 },
                { x: 2, y: 6, type: 5 },
                { x: 3, y: 6, type: 5 },
                { x: 4, y: 6, type: 5 },
                
                // Окна
                { x: 2, y: 2, type: 0 },
                { x: 2, y: 4, type: 0 }
            ],
            requirements: [
                { id: 3, count: 25 }, // Камень
                { id: 5, count: 5 }   // Листья
            ]
        });
    }
    
    placeBlock(x, y, type, player) {
        // Проверка дистанции
        const distance = this.calculateDistance(x, y, player);
        if (distance > this.maxBuildDistance) {
            EventBus.emit('building:failed', {
                reason: 'too_far',
                maxDistance: this.maxBuildDistance,
                distance
            });
            return false;
        }
        
        // Проверка наличия блока в инвентаре
        if (!this.hasBlock(type, player)) {
            EventBus.emit('building:failed', {
                reason: 'no_blocks',
                blockType: type
            });
            return false;
        }
        
        // Проверка коллизии с игроком
        if (this.checkPlayerCollision(x, y, player)) {
            EventBus.emit('building:failed', {
                reason: 'player_collision'
            });
            return false;
        }
        
        // Проверка поддержки блока (гравитация)
        if (this.requiresSupport(type) && !this.hasSupport(x, y)) {
            EventBus.emit('building:failed', {
                reason: 'no_support',
                blockType: type
            });
            return false;
        }
        
        // Установка блока
        const blockId = `block_${Date.now()}_${Math.random()}`;
        
        this.blocks.set(blockId, {
            id: blockId,
            x,
            y,
            type,
            placedBy: player.id,
            timestamp: Date.now()
        });
        
        // Удаление блока из инвентаря
        this.removeBlockFromInventory(type, player);
        
        EventBus.emit('building:block_placed', {
            id: blockId,
            x,
            y,
            type,
            player: player.id
        });
        
        return true;
    }
    
    removeBlock(x, y, player) {
        const blockId = this.findBlockAt(x, y);
        if (!blockId) return false;
        
        const block = this.blocks.get(blockId);
        if (!block) return false;
        
        // Проверка дистанции
        const distance = this.calculateDistance(x, y, player);
        if (distance > this.maxBuildDistance) {
            EventBus.emit('building:failed', {
                reason: 'too_far',
                action: 'remove'
            });
            return false;
        }
        
        // Проверка владения (опционально)
        // if (block.placedBy !== player.id && !player.isAdmin) {
        //     return false;
        // }
        
        // Удаление блока
        this.blocks.delete(blockId);
        
        // Возврат блока в инвентарь
        this.addBlockToInventory(block.type, player);
        
        EventBus.emit('building:block_removed', {
            id: blockId,
            x,
            y,
            type: block.type,
            player: player.id
        });
        
        return true;
    }
    
    buildStructure(blueprintId, startX, startY, player) {
        const blueprint = this.blueprints.get(blueprintId);
        if (!blueprint) {
            EventBus.emit('building:failed', {
                reason: 'blueprint_not_found',
                blueprintId
            });
            return false;
        }
        
        // Проверка требований
        if (!this.checkRequirements(blueprint.requirements, player)) {
            EventBus.emit('building:failed', {
                reason: 'requirements_not_met',
                blueprint: blueprint.name
            });
            return false;
        }
        
        // Проверка места
        if (!this.canBuildStructure(blueprint, startX, startY, player)) {
            EventBus.emit('building:failed', {
                reason: 'no_space',
                blueprint: blueprint.name
            });
            return false;
        }
        
        // Построение структуры
        const structureId = `structure_${Date.now()}`;
        const blocks = [];
        
        for (const blockDef of blueprint.blocks) {
            const x = startX + blockDef.x;
            const y = startY + blockDef.y;
            
            const blockId = `block_${Date.now()}_${Math.random()}`;
            
            this.blocks.set(blockId, {
                id: blockId,
                x,
                y,
                type: blockDef.type,
                placedBy: player.id,
                timestamp: Date.now(),
                structureId
            });
            
            blocks.push(blockId);
        }
        
        // Сохранение структуры
        this.structures.set(structureId, {
            id: structureId,
            blueprintId,
            startX,
            startY,
            blocks,
            builtBy: player.id,
            timestamp: Date.now()
        });
        
        // Удаление материалов из инвентаря
        this.removeRequirements(blueprint.requirements, player);
        
        EventBus.emit('building:structure_built', {
            id: structureId,
            blueprint: blueprint.name,
            startX,
            startY,
            player: player.id,
            blockCount: blocks.length
        });
        
        return true;
    }
    
    showGhostBlock(x, y, type) {
        this.ghostBlock = { x, y, type, visible: true };
        
        EventBus.emit('building:ghost_updated', {
            x, y, type,
            valid: this.isPlacementValid(x, y, type)
        });
    }
    
    hideGhostBlock() {
        this.ghostBlock = null;
        EventBus.emit('building:ghost_hidden');
    }
    
    calculateDistance(x, y, player) {
        const dx = x * 32 - player.position.x;
        const dy = y * 32 - player.position.y;
        return Math.sqrt(dx*dx + dy*dy);
    }
    
    hasBlock(type, player) {
        // Проверка наличия блока в инвентаре игрока
        // TODO: Реальная проверка инвентаря
        return true; // Временно
    }
    
    checkPlayerCollision(x, y, player) {
        const blockX = x * 32;
        const blockY = y * 32;
        const blockSize = 32;
        
        const playerLeft = player.position.x;
        const playerRight = player.position.x + player.size.width;
        const playerTop = player.position.y;
        const playerBottom = player.position.y + player.size.height;
        
        return !(blockX + blockSize < playerLeft ||
                blockX > playerRight ||
                blockY + blockSize < playerTop ||
                blockY > playerBottom);
    }
    
    requiresSupport(blockType) {
        // Блоки, на которые влияет гравитация
        const gravityBlocks = [7]; // Песок, гравий и т.д.
        return gravityBlocks.includes(blockType);
    }
    
    hasSupport(x, y) {
        // Проверка блока под текущим
        const blockBelow = this.findBlockAt(x, y + 1);
        return !!blockBelow;
    }
    
    isPlacementValid(x, y, type) {
        // Проверка, не занято ли место
        if (this.findBlockAt(x, y)) {
            return false;
        }
        
        // Проверка поддержки для гравитационных блоков
        if (this.requiresSupport(type) && !this.hasSupport(x, y)) {
            return false;
        }
        
        return true;
    }
    
    findBlockAt(x, y) {
        for (const [id, block] of this.blocks) {
            if (block.x === x && block.y === y) {
                return id;
            }
        }
        return null;
    }
    
    removeBlockFromInventory(type, player) {
        // TODO: Удаление блока из инвентаря игрока
        EventBus.emit('inventory:remove', {
            playerId: player.id,
            itemId: type,
            count: 1
        });
    }
    
    addBlockToInventory(type, player) {
        // TODO: Добавление блока в инвентарь игрока
        EventBus.emit('inventory:add', {
            playerId: player.id,
            itemId: type,
            count: 1
        });
    }
    
    checkRequirements(requirements, player) {
        // TODO: Проверка наличия всех материалов
        return true; // Временно
    }
    
    removeRequirements(requirements, player) {
        // TODO: Удаление материалов из инвентаря
        for (const req of requirements) {
            EventBus.emit('inventory:remove', {
                playerId: player.id,
                itemId: req.id,
                count: req.count
            });
        }
    }
    
    canBuildStructure(blueprint, startX, startY, player) {
        // Проверка всех блоков структуры
        for (const blockDef of blueprint.blocks) {
            const x = startX + blockDef.x;
            const y = startY + blockDef.y;
            
            // Проверка дистанции
            const distance = this.calculateDistance(x, y, player);
            if (distance > this.maxBuildDistance) {
                return false;
            }
            
            // Проверка занятости места (кроме воздуха)
            if (blockDef.type !== 0 && this.findBlockAt(x, y)) {
                return false;
            }
        }
        
        return true;
    }
    
    getBlueprints() {
        return Array.from(this.blueprints.values());
    }
    
    getBlueprint(id) {
        return this.blueprints.get(id);
    }
    
    getBlocksInArea(x, y, radius) {
        const result = [];
        const radiusSquared = radius * radius;
        
        for (const [id, block] of this.blocks) {
            const dx = block.x - x;
            const dy = block.y - y;
            const distanceSquared = dx*dx + dy*dy;
            
            if (distanceSquared <= radiusSquared) {
                result.push({ ...block, distance: Math.sqrt(distanceSquared) });
            }
        }
        
        return result.sort((a, b) => a.distance - b.distance);
    }
    
    getStructures() {
        return Array.from(this.structures.values());
    }
    
    removeStructure(structureId) {
        const structure = this.structures.get(structureId);
        if (!structure) return false;
        
        // Удаление всех блоков структуры
        for (const blockId of structure.blocks) {
            this.blocks.delete(blockId);
        }
        
        // Удаление структуры
        this.structures.delete(structureId);
        
        EventBus.emit('building:structure_removed', { structureId });
        
        return true;
    }
    
    update() {
        // Обновление гравитационных блоков
        this.updateGravityBlocks();
        
        // Обновление призрачного блока
        if (this.ghostBlock) {
            EventBus.emit('building:ghost_updated', {
                ...this.ghostBlock,
                valid: this.isPlacementValid(this.ghostBlock.x, this.ghostBlock.y, this.ghostBlock.type)
            });
        }
    }
    
    updateGravityBlocks() {
        const gravityBlocks = [7]; // Песок
        
        for (const [id, block] of this.blocks) {
            if (gravityBlocks.includes(block.type)) {
                const blockBelow = this.findBlockAt(block.x, block.y + 1);
                
                // Если под блоком пусто, он падает
                if (!blockBelow) {
                    // Перемещение блока вниз
                    this.blocks.delete(id);
                    
                    const newBlock = {
                        ...block,
                        y: block.y + 1,
                        timestamp: Date.now()
                    };
                    
                    this.blocks.set(id, newBlock);
                    
                    EventBus.emit('building:block_fell', {
                        id,
                        from: { x: block.x, y: block.y },
                        to: { x: newBlock.x, y: newBlock.y }
                    });
                }
            }
        }
    }
    
    setupEventListeners() {
        EventBus.on('building:place', (data) => {
            this.placeBlock(data.x, data.y, data.type, data.player);
        });
        
        EventBus.on('building:remove', (data) => {
            this.removeBlock(data.x, data.y, data.player);
        });
        
        EventBus.on('building:show_ghost', (data) => {
            this.showGhostBlock(data.x, data.y, data.type);
        });
        
        EventBus.on('building:hide_ghost', () => {
            this.hideGhostBlock();
        });
        
        EventBus.on('building:structure', (data) => {
            this.buildStructure(data.blueprintId, data.x, data.y, data.player);
        });
        
        EventBus.on('game:update', () => {
            this.update();
        });
        
        EventBus.on('building:get_blueprints', () => {
            const blueprints = this.getBlueprints();
            EventBus.emit('building:blueprints', { blueprints });
        });
        
        EventBus.on('building:get_blocks', (data) => {
            const blocks = this.getBlocksInArea(data.x, data.y, data.radius || 10);
            EventBus.emit('building:blocks_in_area', { blocks });
        });
    }
}