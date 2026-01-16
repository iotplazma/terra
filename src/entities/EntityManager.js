import EventBus from '@/utils/EventBus.js';

export default class EntityManager {
    constructor() {
        this.entities = new Map();
        this.entityCounter = 0;
        this.categories = {
            player: new Set(),
            enemy: new Set(),
            neutral: new Set(),
            item: new Set(),
            projectile: new Set()
        };
        
        this.spawners = [];
        this.spawnTimer = 0;
        this.maxEntities = 100;
        
        this.setupEventListeners();
    }
    
    createEntity(type, data = {}) {
        const id = `entity_${this.entityCounter++}`;
        
        const entity = {
            id,
            type,
            position: data.position || { x: 0, y: 0 },
            velocity: data.velocity || { x: 0, y: 0 },
            size: data.size || { width: 16, height: 16 },
            health: data.health || 1,
            maxHealth: data.maxHealth || 1,
            damage: data.damage || 1,
            speed: data.speed || 1,
            target: null,
            state: data.state || 'idle',
            direction: data.direction || 1,
            ai: data.ai || 'none',
            inventory: data.inventory || [],
            loot: data.loot || [],
            timestamp: Date.now(),
            userData: data.userData || {},
            
            update: data.update || ((deltaTime) => this.updateEntity(entity, deltaTime)),
            render: data.render || ((ctx) => this.renderEntity(entity, ctx)),
            onDamage: data.onDamage || ((damage, source) => {}),
            onDeath: data.onDeath || (() => {})
        };
        
        this.entities.set(id, entity);
        
        // Добавление в категорию
        if (this.categories[type]) {
            this.categories[type].add(id);
        }
        
        EventBus.emit('entity:created', { id, entity });
        
        return entity;
    }
    
    update(deltaTime) {
        // Обновление таймера спавна
        this.spawnTimer += deltaTime;
        if (this.spawnTimer > 5 && this.entities.size < this.maxEntities) {
            this.spawnTimer = 0;
            this.spawnRandomEntity();
        }
        
        // Обновление всех сущностей
        for (const [id, entity] of this.entities) {
            if (entity.update) {
                entity.update(deltaTime);
            }
            
            // Обновление ИИ
            this.updateAI(entity, deltaTime);
            
            // Проверка смерти
            if (entity.health <= 0) {
                this.destroyEntity(id, 'killed');
            }
        }
    }
    
    updateEntity(entity, deltaTime) {
        // Базовая физика
        entity.position.x += entity.velocity.x * deltaTime * 60;
        entity.position.y += entity.velocity.y * deltaTime * 60;
        
        // Гравитация
        if (entity.velocity.y < 10) {
            entity.velocity.y += 0.5 * deltaTime * 60;
        }
    }
    
    updateAI(entity, deltaTime) {
        switch(entity.ai) {
            case 'wander':
                this.aiWander(entity, deltaTime);
                break;
                
            case 'chase':
                this.aiChase(entity, deltaTime);
                break;
                
            case 'flee':
                this.aiFlee(entity, deltaTime);
                break;
        }
    }
    
    aiWander(entity, deltaTime) {
        // Случайное блуждание
        if (Math.random() < 0.01) {
            entity.velocity.x = (Math.random() - 0.5) * entity.speed;
            entity.direction = Math.sign(entity.velocity.x) || 1;
        }
        
        // Иногда прыжок
        if (Math.random() < 0.005 && Math.abs(entity.velocity.y) < 0.1) {
            entity.velocity.y = -5;
        }
    }
    
    aiChase(entity, deltaTime) {
        if (!entity.target) {
            // Поиск ближайшего игрока
            const players = this.getEntitiesByType('player');
            if (players.length > 0) {
                entity.target = players[0];
            }
            return;
        }
        
        // Движение к цели
        const target = this.entities.get(entity.target);
        if (!target) {
            entity.target = null;
            return;
        }
        
        const dx = target.position.x - entity.position.x;
        const dy = target.position.y - entity.position.y;
        const distance = Math.sqrt(dx*dx + dy*dy);
        
        if (distance < 100) {
            // Атака
            if (distance < 20) {
                entity.velocity.x = 0;
                // TODO: атака
            } else {
                // Преледование
                entity.velocity.x = Math.sign(dx) * entity.speed;
                entity.direction = Math.sign(dx) || 1;
            }
        }
    }
    
    aiFlee(entity, deltaTime) {
        // Бегство от игрока
        const players = this.getEntitiesByType('player');
        if (players.length === 0) return;
        
        const player = this.entities.get(players[0]);
        if (!player) return;
        
        const dx = player.position.x - entity.position.x;
        const dy = player.position.y - entity.position.y;
        const distance = Math.sqrt(dx*dx + dy*dy);
        
        if (distance < 150) {
            entity.velocity.x = -Math.sign(dx) * entity.speed;
            entity.direction = Math.sign(entity.velocity.x) || 1;
        }
    }
    
    renderEntity(entity, ctx) {
        // Простая отрисовка
        ctx.fillStyle = this.getEntityColor(entity.type);
        ctx.fillRect(
            entity.position.x - entity.size.width / 2,
            entity.position.y - entity.size.height / 2,
            entity.size.width,
            entity.size.height
        );
        
        // Полоска здоровья
        if (entity.health < entity.maxHealth) {
            const healthPercent = entity.health / entity.maxHealth;
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(
                entity.position.x - entity.size.width / 2,
                entity.position.y - entity.size.height / 2 - 5,
                entity.size.width * healthPercent,
                3
            );
        }
        
        // Глаза по направлению
        ctx.fillStyle = '#ffffff';
        const eyeX = entity.direction > 0 ? 3 : -3;
        ctx.fillRect(
            entity.position.x + eyeX,
            entity.position.y - 2,
            2, 2
        );
    }
    
    getEntityColor(type) {
        const colors = {
            player: '#3498db',
            enemy: '#e74c3c',
            neutral: '#2ecc71',
            item: '#f1c40f',
            projectile: '#9b59b6'
        };
        return colors[type] || '#cccccc';
    }
    
    spawnRandomEntity() {
        const types = ['enemy', 'neutral'];
        const type = types[Math.floor(Math.random() * types.length)];
        
        // Случайная позиция
        const x = Math.random() * 1000;
        const y = Math.random() * 500;
        
        let entityData = {};
        
        switch(type) {
            case 'enemy':
                entityData = {
                    health: 20,
                    maxHealth: 20,
                    damage: 5,
                    speed: 1.5,
                    ai: Math.random() < 0.5 ? 'chase' : 'wander',
                    loot: [
                        { id: 2, count: 1, chance: 0.5 },
                        { id: 3, count: 1, chance: 0.2 }
                    ]
                };
                break;
                
            case 'neutral':
                entityData = {
                    health: 10,
                    maxHealth: 10,
                    speed: 1,
                    ai: 'wander',
                    loot: [
                        { id: 4, count: 1, chance: 0.8 }
                    ]
                };
                break;
        }
        
        this.createEntity(type, {
            position: { x, y },
            ...entityData
        });
    }
    
    destroyEntity(id, reason = 'removed') {
        const entity = this.entities.get(id);
        if (!entity) return;
        
        // Вызов callback смерти
        if (entity.onDeath) {
            entity.onDeath();
        }
        
        // Дроп лута
        if (reason === 'killed' && entity.loot) {
            this.dropLoot(entity);
        }
        
        // Удаление из категорий
        for (const category of Object.values(this.categories)) {
            category.delete(id);
        }
        
        // Удаление из основного списка
        this.entities.delete(id);
        
        EventBus.emit('entity:destroyed', { id, reason, entity });
    }
    
    dropLoot(entity) {
        for (const item of entity.loot) {
            if (Math.random() < item.chance) {
                this.createEntity('item', {
                    position: { ...entity.position },
                    userData: {
                        itemId: item.id,
                        count: item.count
                    }
                });
            }
        }
    }
    
    getEntitiesByType(type) {
        return Array.from(this.categories[type] || []);
    }
    
    getEntitiesInArea(x, y, radius) {
        const result = [];
        
        for (const [id, entity] of this.entities) {
            const dx = entity.position.x - x;
            const dy = entity.position.y - y;
            const distance = Math.sqrt(dx*dx + dy*dy);
            
            if (distance <= radius) {
                result.push({ id, entity, distance });
            }
        }
        
        return result.sort((a, b) => a.distance - b.distance);
    }
    
    damageEntity(id, damage, source) {
        const entity = this.entities.get(id);
        if (!entity) return false;
        
        entity.health = Math.max(0, entity.health - damage);
        
        // Вызов callback урона
        if (entity.onDamage) {
            entity.onDamage(damage, source);
        }
        
        EventBus.emit('entity:damaged', {
            id,
            damage,
            source,
            health: entity.health,
            maxHealth: entity.maxHealth
        });
        
        return true;
    }
    
    healEntity(id, amount) {
        const entity = this.entities.get(id);
        if (!entity) return false;
        
        entity.health = Math.min(entity.maxHealth, entity.health + amount);
        
        EventBus.emit('entity:healed', {
            id,
            amount,
            health: entity.health
        });
        
        return true;
    }
    
    setEntityTarget(id, targetId) {
        const entity = this.entities.get(id);
        if (!entity) return false;
        
        entity.target = targetId;
        return true;
    }
    
    clear() {
        this.entities.clear();
        for (const category of Object.values(this.categories)) {
            category.clear();
        }
        this.entityCounter = 0;
    }
    
    setupEventListeners() {
        EventBus.on('entity:create', (data) => {
            this.createEntity(data.type, data);
        });
        
        EventBus.on('entity:destroy', (data) => {
            this.destroyEntity(data.id, data.reason);
        });
        
        EventBus.on('entity:damage', (data) => {
            this.damageEntity(data.id, data.damage, data.source);
        });
        
        EventBus.on('entity:heal', (data) => {
            this.healEntity(data.id, data.amount);
        });
        
        EventBus.on('entity:get_all', () => {
            const entities = Array.from(this.entities.entries());
            EventBus.emit('entity:all_entities', { entities });
        });
    }
}