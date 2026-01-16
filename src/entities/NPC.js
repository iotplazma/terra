import EventBus from '@/utils/EventBus.js';

export default class NPC {
    constructor(id, type, position) {
        this.id = id;
        this.type = type;
        this.position = { ...position };
        this.velocity = { x: 0, y: 0 };
        this.size = { width: 24, height: 40 };
        this.health = 50;
        this.maxHealth = 50;
        this.speed = 1.0;
        this.direction = 1;
        this.state = 'idle';
        this.target = null;
        this.dialogue = [];
        this.inventory = [];
        this.quests = [];
        this.tradeItems = [];
        this.ai = 'passive';
        this.lastAction = Date.now();
        this.actionCooldown = 2000;
        
        this.setupDialogue();
        this.setupQuests();
        this.setupTrade();
    }
    
    setupDialogue() {
        switch(this.type) {
            case 'merchant':
                this.dialogue = [
                    { text: "Приветствую, путник!", options: ["Кто ты?", "Что продаёшь?", "Пока"] },
                    { text: "Я торговец из дальних земель.", options: ["Что продаёшь?", "Есть задания?", "Пока"] },
                    { text: "Вот что у меня есть...", options: ["Купить", "Пока"] }
                ];
                break;
                
            case 'villager':
                this.dialogue = [
                    { text: "Добро пожаловать в нашу деревню!", options: ["Что здесь происходит?", "Нужна помощь?", "Пока"] },
                    { text: "Недавно видели странных существ в лесу...", options: ["Расскажи подробнее", "Пока"] }
                ];
                break;
                
            case 'blacksmith':
                this.dialogue = [
                    { text: "Нужно оружие или доспехи?", options: ["Покажи товар", "Можешь починить?", "Пока"] },
                    { text: "У меня лучшая сталь в округе!", options: ["Купить", "Пока"] }
                ];
                break;
        }
    }
    
    setupQuests() {
        switch(this.type) {
            case 'villager':
                this.quests = [
                    {
                        id: 'gather_wood',
                        title: "Заготовка дров",
                        description: "Принеси 10 блоков дерева",
                        reward: { items: [{ id: 2, count: 5 }], experience: 100 },
                        requirements: [{ type: 'item', id: 4, count: 10 }],
                        completed: false
                    }
                ];
                break;
        }
    }
    
    setupTrade() {
        switch(this.type) {
            case 'merchant':
                this.tradeItems = [
                    { id: 2, price: 1, stock: 99 }, // Земля
                    { id: 3, price: 3, stock: 50 }, // Камень
                    { id: 8, price: 10, stock: 20 }, // Уголь
                    { id: 18, price: 2, stock: 30 }  // Факелы
                ];
                break;
                
            case 'blacksmith':
                this.tradeItems = [
                    { id: 21, price: 20, stock: 10 }, // Деревянная кирка
                    { id: 26, price: 50, stock: 5 },  // Каменная кирка
                    { id: 24, price: 15, stock: 10 }  // Деревянный меч
                ];
                break;
        }
    }
    
    update(deltaTime, playerPosition) {
        switch(this.ai) {
            case 'passive':
                this.updatePassive(deltaTime);
                break;
                
            case 'wander':
                this.updateWander(deltaTime);
                break;
                
            case 'follow':
                this.updateFollow(deltaTime, playerPosition);
                break;
        }
        
        // Обновление анимации
        this.updateAnimation(deltaTime);
    }
    
    updatePassive(deltaTime) {
        // Просто стоит на месте
        this.velocity.x = 0;
        
        // Иногда меняет направление
        if (Date.now() - this.lastAction > this.actionCooldown) {
            this.direction = Math.random() > 0.5 ? 1 : -1;
            this.lastAction = Date.now();
            this.actionCooldown = 2000 + Math.random() * 3000;
        }
    }
    
    updateWander(deltaTime) {
        // Случайное блуждание
        if (Date.now() - this.lastAction > this.actionCooldown) {
            this.velocity.x = (Math.random() - 0.5) * this.speed;
            this.direction = Math.sign(this.velocity.x) || this.direction;
            this.lastAction = Date.now();
            this.actionCooldown = 1000 + Math.random() * 4000;
        }
        
        // Автоматическое движение
        this.position.x += this.velocity.x * deltaTime * 60;
    }
    
    updateFollow(deltaTime, targetPosition) {
        if (!targetPosition) return;
        
        const dx = targetPosition.x - this.position.x;
        const distance = Math.abs(dx);
        
        if (distance > 100) {
            // Слишком далеко, перестаём следовать
            this.ai = 'wander';
            return;
        }
        
        if (distance > 20) {
            // Двигаемся к цели
            this.velocity.x = Math.sign(dx) * this.speed;
            this.direction = Math.sign(dx);
            this.state = 'walking';
        } else {
            // Стоим рядом
            this.velocity.x = 0;
            this.state = 'idle';
        }
        
        this.position.x += this.velocity.x * deltaTime * 60;
    }
    
    updateAnimation(deltaTime) {
        if (Math.abs(this.velocity.x) > 0.1) {
            this.state = 'walking';
        } else {
            this.state = 'idle';
        }
    }
    
    interact(player) {
        EventBus.emit('npc:interact', {
            npcId: this.id,
            npcType: this.type,
            playerId: player.id,
            dialogue: this.dialogue[0],
            hasQuests: this.quests.length > 0,
            hasTrade: this.tradeItems.length > 0
        });
        
        // Начинаем следовать за игроком если он взаимодействует
        if (this.ai === 'passive') {
            this.ai = 'follow';
            this.target = player.id;
        }
    }
    
    trade(itemId, quantity, player) {
        const tradeItem = this.tradeItems.find(item => item.id === itemId);
        
        if (!tradeItem) {
            return { success: false, message: "У меня нет такого товара" };
        }
        
        if (tradeItem.stock < quantity) {
            return { success: false, message: "Недостаточно товара в наличии" };
        }
        
        const totalPrice = tradeItem.price * quantity;
        
        // Проверка наличия валюты у игрока
        // TODO: Проверка инвентаря игрока
        
        tradeItem.stock -= quantity;
        
        return {
            success: true,
            message: `Товар куплен: ${quantity} шт.`,
            itemId,
            quantity,
            price: totalPrice
        };
    }
    
    giveQuest(questId, player) {
        const quest = this.quests.find(q => q.id === questId);
        
        if (!quest) {
            return { success: false, message: "Задание не найдено" };
        }
        
        if (quest.completed) {
            return { success: false, message: "Задание уже выполнено" };
        }
        
        // Проверка требований
        const canAccept = this.checkQuestRequirements(quest, player);
        
        if (!canAccept) {
            return { success: false, message: "Требования не выполнены" };
        }
        
        // Выдача задания игроку
        EventBus.emit('quest:assigned', {
            questId,
            npcId: this.id,
            playerId: player.id,
            quest
        });
        
        return { success: true, quest };
    }
    
    checkQuestRequirements(quest, player) {
        for (const requirement of quest.requirements) {
            switch(requirement.type) {
                case 'item':
                    // TODO: Проверка наличия предмета
                    break;
                    
                case 'level':
                    if (player.level < requirement.value) return false;
                    break;
                    
                case 'quest':
                    // TODO: Проверка выполнения предыдущих квестов
                    break;
            }
        }
        
        return true;
    }
    
    completeQuest(questId, player) {
        const quest = this.quests.find(q => q.id === questId);
        
        if (!quest || quest.completed) {
            return { success: false, message: "Задание не найдено или уже выполнено" };
        }
        
        // Проверка выполнения
        const isComplete = this.verifyQuestCompletion(quest, player);
        
        if (!isComplete) {
            return { success: false, message: "Задание не выполнено" };
        }
        
        // Награда
        quest.completed = true;
        
        EventBus.emit('quest:completed', {
            questId,
            npcId: this.id,
            playerId: player.id,
            reward: quest.reward
        });
        
        // Выдача награды
        this.giveReward(quest.reward, player);
        
        return {
            success: true,
            message: "Задание выполнено!",
            reward: quest.reward
        };
    }
    
    verifyQuestCompletion(quest, player) {
        for (const requirement of quest.requirements) {
            switch(requirement.type) {
                case 'item':
                    // TODO: Проверка наличия предметов
                    // return player.hasItem(requirement.id, requirement.count);
                    break;
            }
        }
        
        return true;
    }
    
    giveReward(reward, player) {
        if (reward.items) {
            for (const item of reward.items) {
                // TODO: Добавление предметов игроку
                EventBus.emit('player:item_added', {
                    playerId: player.id,
                    itemId: item.id,
                    count: item.count
                });
            }
        }
        
        if (reward.experience) {
            EventBus.emit('player:experience', {
                playerId: player.id,
                amount: reward.experience
            });
        }
    }
    
    takeDamage(damage, source) {
        this.health -= damage;
        
        EventBus.emit('npc:damaged', {
            npcId: this.id,
            damage,
            source,
            health: this.health
        });
        
        if (this.health <= 0) {
            this.die();
        }
    }
    
    die() {
        EventBus.emit('npc:died', {
            npcId: this.id,
            position: this.position,
            type: this.type
        });
        
        // Дроп предметов
        this.dropItems();
    }
    
    dropItems() {
        const drops = [];
        
        // Дроп инвентаря
        for (const item of this.inventory) {
            drops.push(item);
        }
        
        // Дроп торговых предметов (частичный)
        for (const item of this.tradeItems) {
            if (item.stock > 0 && Math.random() < 0.3) {
                drops.push({
                    id: item.id,
                    count: Math.min(item.stock, Math.floor(Math.random() * 5) + 1)
                });
            }
        }
        
        EventBus.emit('npc:dropped', {
            npcId: this.id,
            drops
        });
    }
    
    render(ctx) {
        // Рендер тела
        ctx.fillStyle = this.getColor();
        ctx.fillRect(
            this.position.x - this.size.width / 2,
            this.position.y - this.size.height / 2,
            this.size.width,
            this.size.height
        );
        
        // Голова
        ctx.fillStyle = '#f1c40f';
        ctx.fillRect(
            this.position.x - 8,
            this.position.y - this.size.height / 2 - 8,
            16,
            8
        );
        
        // Полоска здоровья
        if (this.health < this.maxHealth) {
            const healthPercent = this.health / this.maxHealth;
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(
                this.position.x - this.size.width / 2,
                this.position.y - this.size.height / 2 - 5,
                this.size.width * healthPercent,
                3
            );
        }
        
        // Индикатор состояния
        if (this.state === 'talking') {
            ctx.fillStyle = '#ffff00';
            ctx.fillRect(this.position.x - 2, this.position.y - 20, 4, 4);
        }
    }
    
    getColor() {
        const colors = {
            merchant: '#3498db',
            villager: '#2ecc71',
            blacksmith: '#e74c3c',
            guard: '#95a5a6'
        };
        
        return colors[this.type] || '#cccccc';
    }
    
    getDialogue() {
        return this.dialogue;
    }
    
    getQuests() {
        return this.quests.filter(q => !q.completed);
    }
    
    getTradeItems() {
        return this.tradeItems.filter(item => item.stock > 0);
    }
}