import EventBus from '@/utils/EventBus.js';

export default class Mob {
    constructor(id, type, position) {
        this.id = id;
        this.type = type;
        this.position = { ...position };
        this.velocity = { x: 0, y: 0 };
        this.size = this.getSize(type);
        this.health = this.getMaxHealth(type);
        this.maxHealth = this.health;
        this.damage = this.getDamage(type);
        this.speed = this.getSpeed(type);
        this.attackRange = this.getAttackRange(type);
        this.sightRange = this.getSightRange(type);
        this.direction = 1;
        this.state = 'idle';
        this.target = null;
        this.attackCooldown = 0;
        this.aiState = 'wander';
        this.path = [];
        this.lastAction = Date.now();
        this.actionTimer = 0;
        this.loot = this.getLootTable(type);
        this.experience = this.getExperience(type);
        
        this.setupBehavior();
    }
    
    getSize(type) {
        const sizes = {
            zombie: { width: 20, height: 32 },
            skeleton: { width: 18, height: 34 },
            spider: { width: 24, height: 16 },
            slime: { width: 28, height: 20 },
            creeper: { width: 20, height: 30 }
        };
        return sizes[type] || { width: 20, height: 30 };
    }
    
    getMaxHealth(type) {
        const health = {
            zombie: 20,
            skeleton: 15,
            spider: 16,
            slime: 12,
            creeper: 20
        };
        return health[type] || 10;
    }
    
    getDamage(type) {
        const damage = {
            zombie: 3,
            skeleton: 2,
            spider: 2,
            slime: 1,
            creeper: 25 // Взрыв
        };
        return damage[type] || 1;
    }
    
    getSpeed(type) {
        const speeds = {
            zombie: 0.8,
            skeleton: 1.0,
            spider: 1.5,
            slime: 0.5,
            creeper: 1.2
        };
        return speeds[type] || 1.0;
    }
    
    getAttackRange(type) {
        const ranges = {
            zombie: 20,
            skeleton: 100, // Стреляет
            spider: 15,
            slime: 10,
            creeper: 3
        };
        return ranges[type] || 15;
    }
    
    getSightRange(type) {
        return 150;
    }
    
    getLootTable(type) {
        const tables = {
            zombie: [
                { id: 2, count: 1, chance: 0.5 },
                { id: 4, count: 1, chance: 0.2 },
                { id: 20, count: 1, chance: 0.05 } // Палка
            ],
            skeleton: [
                { id: 3, count: 1, chance: 0.5 },
                { id: 20, count: 2, chance: 0.3 },
                { id: 25, count: 1, chance: 0.1 } // Уголь
            ],
            spider: [
                { id: 33, count: 1, chance: 0.8 }, // Паутина
                { id: 34, count: 1, chance: 0.3 }  // Паучий глаз
            ],
            slime: [
                { id: 35, count: 1, chance: 1.0 } // Слизь
            ],
            creeper: [
                { id: 25, count: 1, chance: 0.5 }, // Уголь
                { id: 8, count: 1, chance: 0.3 }   // Порох
            ]
        };
        return tables[type] || [];
    }
    
    getExperience(type) {
        const exp = {
            zombie: 5,
            skeleton: 5,
            spider: 3,
            slime: 2,
            creeper: 10
        };
        return exp[type] || 1;
    }
    
    setupBehavior() {
        switch(this.type) {
            case 'zombie':
                this.aiState = 'chase';
                break;
                
            case 'skeleton':
                this.aiState = 'ranged';
                break;
                
            case 'spider':
                this.aiState = 'aggressive';
                break;
                
            case 'slime':
                this.aiState = 'jump';
                break;
                
            case 'creeper':
                this.aiState = 'sneak';
                break;
        }
    }
    
    update(deltaTime, playerPosition) {
        // Обновление кулдауна атаки
        if (this.attackCooldown > 0) {
            this.attackCooldown -= deltaTime * 1000;
        }
        
        // Обновление поведения
        this.updateAI(deltaTime, playerPosition);
        
        // Обновление физики
        this.updatePhysics(deltaTime);
        
        // Обновление анимации
        this.updateAnimation(deltaTime);
        
        // Обновление таймера действий
        this.actionTimer += deltaTime;
    }
    
    updateAI(deltaTime, playerPosition) {
        // Поиск цели
        if (!this.target && playerPosition) {
            const dx = playerPosition.x - this.position.x;
            const dy = playerPosition.y - this.position.y;
            const distance = Math.sqrt(dx*dx + dy*dy);
            
            if (distance < this.sightRange) {
                this.target = playerPosition;
                this.aiState = 'chase';
            }
        }
        
        // Если есть цель
        if (this.target) {
            const dx = this.target.x - this.position.x;
            const dy = this.target.y - this.position.y;
            const distance = Math.sqrt(dx*dx + dy*dy);
            
            // Проверка дистанции
            if (distance > this.sightRange * 1.5) {
                // Потеря цели
                this.target = null;
                this.aiState = 'wander';
                return;
            }
            
            // Выбор поведения в зависимости от типа
            switch(this.type) {
                case 'zombie':
                    this.zombieBehavior(dx, dy, distance);
                    break;
                    
                case 'skeleton':
                    this.skeletonBehavior(dx, dy, distance);
                    break;
                    
                case 'spider':
                    this.spiderBehavior(dx, dy, distance);
                    break;
                    
                case 'slime':
                    this.slimeBehavior(dx, dy, distance);
                    break;
                    
                case 'creeper':
                    this.creeperBehavior(dx, dy, distance);
                    break;
            }
        } else {
            // Блуждание без цели
            this.wanderBehavior(deltaTime);
        }
    }
    
    zombieBehavior(dx, dy, distance) {
        if (distance < this.attackRange) {
            // Атака
            this.velocity.x = 0;
            this.state = 'attacking';
            
            if (this.attackCooldown <= 0) {
                this.attack();
                this.attackCooldown = 1000; // 1 секунда
            }
        } else {
            // Преследование
            this.velocity.x = Math.sign(dx) * this.speed;
            this.direction = Math.sign(dx) || this.direction;
            this.state = 'chasing';
        }
    }
    
    skeletonBehavior(dx, dy, distance) {
        if (distance < this.attackRange && distance > 30) {
            // Стрельба с расстояния
            this.velocity.x = 0;
            this.state = 'attacking';
            
            if (this.attackCooldown <= 0) {
                this.rangedAttack(dx, dy);
                this.attackCooldown = 1500; // 1.5 секунды
            }
        } else if (distance <= 30) {
            // Отход
            this.velocity.x = -Math.sign(dx) * this.speed;
            this.direction = Math.sign(-dx) || this.direction;
            this.state = 'fleeing';
        } else {
            // Подход на дистанцию стрельбы
            this.velocity.x = Math.sign(dx) * this.speed;
            this.direction = Math.sign(dx) || this.direction;
            this.state = 'chasing';
        }
    }
    
    spiderBehavior(dx, dy, distance) {
        if (distance < this.attackRange) {
            // Быстрая атака
            this.velocity.x = 0;
            this.state = 'attacking';
            
            if (this.attackCooldown <= 0) {
                this.attack();
                this.attackCooldown = 500; // 0.5 секунды
            }
        } else {
            // Быстрое преследование
            this.velocity.x = Math.sign(dx) * this.speed * 1.5;
            this.direction = Math.sign(dx) || this.direction;
            this.state = 'chasing';
            
            // Прыжок
            if (Math.abs(dy) > 20 && this.actionTimer > 2) {
                this.velocity.y = -8;
                this.actionTimer = 0;
            }
        }
    }
    
    slimeBehavior(dx, dy, distance) {
        if (this.actionTimer > 1.5) {
            // Прыжок к цели
            this.velocity.x = Math.sign(dx) * this.speed * 2;
            this.velocity.y = -6;
            this.direction = Math.sign(dx) || this.direction;
            this.state = 'jumping';
            this.actionTimer = 0;
        } else if (distance < this.attackRange) {
            // Атака при приземлении
            this.state = 'attacking';
            if (Math.abs(this.velocity.y) < 0.1) {
                this.attack();
            }
        }
    }
    
    creeperBehavior(dx, dy, distance) {
        if (distance < 50 && distance > 10) {
            // Подкрадывание
            this.velocity.x = Math.sign(dx) * this.speed * 0.7;
            this.direction = Math.sign(dx) || this.direction;
            this.state = 'sneaking';
            
            // Начинает шипеть при близком расстоянии
            if (distance < 30) {
                this.state = 'hissing';
                // TODO: эффект шипения
            }
            
            // Взрыв при очень близком расстоянии
            if (distance < 5 && this.actionTimer > 1) {
                this.explode();
            }
        } else if (distance <= 10) {
            // Взрыв!
            this.explode();
        } else {
            // Обычное движение
            this.velocity.x = Math.sign(dx) * this.speed;
            this.direction = Math.sign(dx) || this.direction;
            this.state = 'walking';
        }
    }
    
    wanderBehavior(deltaTime) {
        // Случайное блуждание
        if (this.actionTimer > 3) {
            this.velocity.x = (Math.random() - 0.5) * this.speed;
            this.direction = Math.sign(this.velocity.x) || this.direction;
            this.actionTimer = 0;
            this.state = 'wandering';
        }
        
        // Иногда прыжок
        if (Math.random() < 0.01 && Math.abs(this.velocity.y) < 0.1) {
            this.velocity.y = -5;
        }
    }
    
    updatePhysics(deltaTime) {
        // Гравитация
        if (this.velocity.y < 10) {
            this.velocity.y += 0.5 * deltaTime * 60;
        }
        
        // Движение
        this.position.x += this.velocity.x * deltaTime * 60;
        this.position.y += this.velocity.y * deltaTime * 60;
        
        // Трение
        this.velocity.x *= 0.9;
        if (Math.abs(this.velocity.x) < 0.1) {
            this.velocity.x = 0;
        }
    }
    
    updateAnimation(deltaTime) {
        // Анимация в зависимости от состояния
        switch(this.state) {
            case 'attacking':
            case 'hissing':
                // Пульсация
                this.size.width = 20 + Math.sin(Date.now() / 100) * 4;
                break;
                
            case 'jumping':
                // Сжатие при прыжке
                this.size.height = Math.max(16, 30 + this.velocity.y * 0.5);
                break;
                
            default:
                // Возврат к нормальному размеру
                const targetSize = this.getSize(this.type);
                this.size.width += (targetSize.width - this.size.width) * 0.1;
                this.size.height += (targetSize.height - this.size.height) * 0.1;
                break;
        }
    }
    
    attack() {
        EventBus.emit('mob:attack', {
            mobId: this.id,
            type: this.type,
            damage: this.damage,
            position: { ...this.position },
            direction: this.direction,
            range: this.attackRange
        });
    }
    
    rangedAttack(dx, dy) {
        const angle = Math.atan2(dy, dx);
        
        EventBus.emit('mob:ranged_attack', {
            mobId: this.id,
            type: this.type,
            damage: this.damage,
            position: { ...this.position },
            angle: angle,
            speed: 5
        });
    }
    
    explode() {
        EventBus.emit('mob:explode', {
            mobId: this.id,
            type: this.type,
            position: { ...this.position },
            damage: this.damage,
            radius: 50
        });
        
        this.health = 0; // Умирает при взрыве
    }
    
    takeDamage(damage, source) {
        this.health -= damage;
        
        EventBus.emit('mob:damaged', {
            mobId: this.id,
            type: this.type,
            damage,
            source,
            health: this.health,
            maxHealth: this.maxHealth
        });
        
        // Агрессия при получении урона
        if (source && !this.target) {
            this.target = source.position;
            this.aiState = 'chase';
        }
        
        // Эффект отбрасывания
        if (source) {
            const dx = this.position.x - source.position.x;
            this.velocity.x = Math.sign(dx) * 5;
            this.velocity.y = -3;
        }
        
        if (this.health <= 0) {
            this.die();
        }
    }
    
    die() {
        EventBus.emit('mob:died', {
            mobId: this.id,
            type: this.type,
            position: this.position,
            experience: this.experience,
            loot: this.loot
        });
        
        // Дроп лута
        this.dropLoot();
    }
    
    dropLoot() {
        const drops = [];
        
        for (const item of this.loot) {
            if (Math.random() < item.chance) {
                drops.push({
                    id: item.id,
                    count: item.count
                });
            }
        }
        
        EventBus.emit('mob:dropped', {
            mobId: this.id,
            drops
        });
    }
    
    render(ctx) {
        // Рендер в зависимости от типа
        switch(this.type) {
            case 'zombie':
                this.renderZombie(ctx);
                break;
                
            case 'skeleton':
                this.renderSkeleton(ctx);
                break;
                
            case 'spider':
                this.renderSpider(ctx);
                break;
                
            case 'slime':
                this.renderSlime(ctx);
                break;
                
            case 'creeper':
                this.renderCreeper(ctx);
                break;
                
            default:
                this.renderGeneric(ctx);
                break;
        }
        
        // Полоска здоровья
        if (this.health < this.maxHealth) {
            const healthPercent = this.health / this.maxHealth;
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(
                this.position.x - this.size.width / 2,
                this.position.y - this.size.height / 2 - 8,
                this.size.width * healthPercent,
                4
            );
        }
    }
    
    renderZombie(ctx) {
        // Тело
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(
            this.position.x - this.size.width / 2,
            this.position.y - this.size.height / 2,
            this.size.width,
            this.size.height
        );
        
        // Голова
        ctx.fillStyle = '#27ae60';
        ctx.fillRect(
            this.position.x - 8,
            this.position.y - this.size.height / 2 - 8,
            16,
            8
        );
        
        // Руки
        ctx.fillStyle = '#2ecc71';
        const armOffset = this.state === 'walking' ? Math.sin(Date.now() / 200) * 3 : 0;
        ctx.fillRect(
            this.position.x - this.size.width / 2 - 4,
            this.position.y - this.size.height / 2 + 8 + armOffset,
            4,
            12
        );
        ctx.fillRect(
            this.position.x + this.size.width / 2,
            this.position.y - this.size.height / 2 + 8 - armOffset,
            4,
            12
        );
    }
    
    renderSkeleton(ctx) {
        // Кости
        ctx.fillStyle = '#ecf0f1';
        ctx.fillRect(
            this.position.x - this.size.width / 2,
            this.position.y - this.size.height / 2,
            this.size.width,
            this.size.height
        );
        
        // Череп
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(
            this.position.x - 6,
            this.position.y - this.size.height / 2 - 6,
            12,
            6
        );
        
        // Глазницы
        ctx.fillStyle = '#000000';
        ctx.fillRect(this.position.x - 3, this.position.y - this.size.height / 2 - 4, 2, 2);
        ctx.fillRect(this.position.x + 1, this.position.y - this.size.height / 2 - 4, 2, 2);
        
        // Лук если атакует
        if (this.state === 'attacking') {
            ctx.strokeStyle = '#8b7355';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(this.position.x + this.direction * 15, this.position.y - 5);
            ctx.lineTo(this.position.x + this.direction * 25, this.position.y - 5);
            ctx.stroke();
        }
    }
    
    renderSpider(ctx) {
        // Тело
        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(
            this.position.x - this.size.width / 2,
            this.position.y - this.size.height / 2,
            this.size.width,
            this.size.height
        );
        
        // Голова
        ctx.fillStyle = '#34495e';
        ctx.fillRect(
            this.position.x - 6,
            this.position.y - this.size.height / 2 - 4,
            12,
            4
        );
        
        // Глаза
        ctx.fillStyle = '#e74c3c';
        for (let i = -1; i <= 1; i += 2) {
            for (let j = -1; j <= 1; j += 2) {
                ctx.fillRect(
                    this.position.x + i * 3,
                    this.position.y - this.size.height / 2 - 2 + j * 1,
                    2,
                    2
                );
            }
        }
        
        // Ноги
        ctx.strokeStyle = '#2c3e50';
        ctx.lineWidth = 2;
        const legOffset = Math.sin(Date.now() / 100) * 2;
        
        for (let i = -1; i <= 1; i += 2) {
            for (let j = 0; j < 2; j++) {
                const legX = this.position.x + i * (this.size.width / 2 + 2 + j * 4);
                const legY = this.position.y - this.size.height / 4;
                
                ctx.beginPath();
                ctx.moveTo(legX, legY);
                ctx.lineTo(legX + i * 6, legY + 8 + (j === 0 ? legOffset : -legOffset));
                ctx.stroke();
            }
        }
    }
    
    renderSlime(ctx) {
        // Тело (с эффектом прыжка)
        ctx.fillStyle = '#27ae60';
        const squish = Math.max(0.7, 1 - Math.abs(this.velocity.y) * 0.05);
        
        ctx.beginPath();
        ctx.ellipse(
            this.position.x,
            this.position.y,
            this.size.width / 2,
            this.size.height / 2 * squish,
            0, 0, Math.PI * 2
        );
        ctx.fill();
        
        // Глаза
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(this.position.x - 4, this.position.y - 2, 3, 3);
        ctx.fillRect(this.position.x + 1, this.position.y - 2, 3, 3);
        
        // Зрачки
        ctx.fillStyle = '#000000';
        const lookX = this.target ? Math.sign(this.target.x - this.position.x) : this.direction;
        ctx.fillRect(this.position.x - 4 + lookX, this.position.y - 1, 2, 2);
        ctx.fillRect(this.position.x + 1 + lookX, this.position.y - 1, 2, 2);
        
        // Улыбка
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y + 2, 4, 0.2, Math.PI - 0.2);
        ctx.stroke();
    }
    
    renderCreeper(ctx) {
        // Тело
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(
            this.position.x - this.size.width / 2,
            this.position.y - this.size.height / 2,
            this.size.width,
            this.size.height
        );
        
        // Лицо
        ctx.fillStyle = '#000000';
        
        // Глаза
        ctx.fillRect(this.position.x - 5, this.position.y - this.size.height / 2 + 5, 3, 3);
        ctx.fillRect(this.position.x + 2, this.position.y - this.size.height / 2 + 5, 3, 3);
        
        // Рот
        ctx.fillRect(this.position.x - 3, this.position.y - this.size.height / 2 + 10, 6, 2);
        
        // Эффект шипения
        if (this.state === 'hissing') {
            const pulse = Math.sin(Date.now() / 100) * 0.2 + 0.8;
            ctx.globalAlpha = 0.5 * pulse;
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(
                this.position.x - this.size.width / 2,
                this.position.y - this.size.height / 2,
                this.size.width,
                this.size.height
            );
            ctx.globalAlpha = 1.0;
        }
    }
    
    renderGeneric(ctx) {
        // Простой рендер для неизвестных мобов
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(
            this.position.x - this.size.width / 2,
            this.position.y - this.size.height / 2,
            this.size.width,
            this.size.height
        );
        
        // Глаза
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(this.position.x - 4, this.position.y - 2, 3, 3);
        ctx.fillRect(this.position.x + 1, this.position.y - 2, 3, 3);
    }
    
    getPosition() {
        return { ...this.position };
    }
    
    getTarget() {
        return this.target;
    }
    
    isAlive() {
        return this.health > 0;
    }
}