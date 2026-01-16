import EventBus from '@/utils/EventBus.js';

export default class InventoryUI {
    constructor(game) {
        this.game = game;
        this.inventory = game.player.inventory;
        this.isOpen = false;
        this.selectedSlot = 0;
        this.draggedItem = null;
        this.dragOffset = { x: 0, y: 0 };
        
        this.container = null;
        this.slots = new Map();
        this.craftingSlots = new Map();
        this.outputSlot = null;
        
        this.setupDOM();
        this.setupEventListeners();
    }
    
    setupDOM() {
        // Создание контейнера инвентаря
        this.container = document.createElement('div');
        this.container.id = 'inventory-ui';
        this.container.className = 'inventory-container hidden';
        this.container.innerHTML = `
            <div class="inventory-wrapper">
                <div class="inventory-header">
                    <h2>📦 Инвентарь</h2>
                    <button class="close-btn">&times;</button>
                </div>
                
                <div class="inventory-body">
                    <!-- Крафт -->
                    <div class="crafting-section">
                        <h3>⚒️ Крафт</h3>
                        <div class="crafting-grid" id="crafting-grid">
                            ${Array(9).fill(0).map((_, i) => `
                                <div class="crafting-slot" data-slot="${i}"></div>
                            `).join('')}
                        </div>
                        <div class="crafting-output">
                            <div class="output-slot" id="output-slot"></div>
                            <button class="craft-btn" id="craft-btn">Создать</button>
                        </div>
                    </div>
                    
                    <!-- Основной инвентарь -->
                    <div class="main-inventory">
                        <h3>🎒 Содержимое</h3>
                        <div class="inventory-grid" id="inventory-grid">
                            ${Array(36).fill(0).map((_, i) => `
                                <div class="inventory-slot" data-slot="${i}"></div>
                            `).join('')}
                        </div>
                    </div>
                    
                    <!-- Быстрый доступ -->
                    <div class="quick-access">
                        <h3>⚡ Быстрый доступ</h3>
                        <div class="hotbar-slots">
                            ${Array(9).fill(0).map((_, i) => `
                                <div class="hotbar-slot-ui" data-hotbar="${i}">
                                    <span class="slot-number">${i + 1}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    
                    <!-- Информация о предмете -->
                    <div class="item-info" id="item-info">
                        <div class="item-name" id="item-name">Выберите предмет</div>
                        <div class="item-description" id="item-description"></div>
                        <div class="item-stats" id="item-stats"></div>
                    </div>
                </div>
                
                <div class="inventory-footer">
                    <div class="player-stats">
                        <div class="stat">❤️ <span id="inv-health">100</span>/100</div>
                        <div class="stat">⚡ <span id="inv-stamina">100</span>/100</div>
                        <div class="stat">🍖 <span id="inv-hunger">100</span>/100</div>
                    </div>
                    <div class="weight">
                        Вес: <span id="inv-weight">0</span>/100 кг
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.container);
        
        // Инициализация слотов
        this.initializeSlots();
    }
    
    initializeSlots() {
        // Слоты крафта
        const craftingGrid = document.getElementById('crafting-grid');
        craftingGrid.querySelectorAll('.crafting-slot').forEach((slot, index) => {
            this.craftingSlots.set(index, slot);
            this.setupSlotEvents(slot, 'crafting', index);
        });
        
        // Слот выхода крафта
        this.outputSlot = document.getElementById('output-slot');
        this.setupSlotEvents(this.outputSlot, 'output', 0);
        
        // Слоты инвентаря
        const inventoryGrid = document.getElementById('inventory-grid');
        inventoryGrid.querySelectorAll('.inventory-slot').forEach((slot, index) => {
            this.slots.set(index, slot);
            this.setupSlotEvents(slot, 'inventory', index);
        });
        
        // Слоты горячей панели
        document.querySelectorAll('.hotbar-slot-ui').forEach((slot, index) => {
            this.setupSlotEvents(slot, 'hotbar', index);
        });
        
        // Кнопка крафта
        document.getElementById('craft-btn').addEventListener('click', () => {
            this.craftItem();
        });
        
        // Кнопка закрытия
        this.container.querySelector('.close-btn').addEventListener('click', () => {
            this.hide();
        });
    }
    
    setupSlotEvents(slot, type, index) {
        // Клик
        slot.addEventListener('click', (e) => {
            this.handleSlotClick(e, type, index);
        });
        
        // Двойной клик
        slot.addEventListener('dblclick', (e) => {
            this.handleDoubleClick(e, type, index);
        });
        
        // Начало перетаскивания
        slot.addEventListener('mousedown', (e) => {
            if (e.button === 0) {
                this.startDrag(e, type, index);
            }
        });
        
        // Контекстное меню
        slot.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.handleRightClick(e, type, index);
        });
        
        // Наведение
        slot.addEventListener('mouseenter', () => {
            this.showItemInfo(type, index);
        });
        
        slot.addEventListener('mouseleave', () => {
            this.hideItemInfo();
        });
    }
    
    handleSlotClick(e, type, index) {
        e.stopPropagation();
        
        // Если есть перетаскиваемый предмет
        if (this.draggedItem) {
            this.dropItem(type, index);
            return;
        }
        
        const item = this.getItemFromSlot(type, index);
        if (!item) return;
        
        // Выбор предмета
        this.selectedSlot = { type, index };
        this.updateSelection();
        
        // Использование предмета
        if (e.button === 0 && !e.ctrlKey) {
            this.useItem(item, type, index);
        }
    }
    
    handleDoubleClick(e, type, index) {
        const item = this.getItemFromSlot(type, index);
        if (!item) return;
        
        // Быстрое перемещение в горячую панель
        if (type === 'inventory') {
            this.quickMoveToHotbar(index);
        }
        // Быстрое перемещение в инвентарь
        else if (type === 'hotbar') {
            this.quickMoveToInventory(index);
        }
    }
    
    handleRightClick(e, type, index) {
        const item = this.getItemFromSlot(type, index);
        if (!item) return;
        
        // Разделение стопки
        if (e.ctrlKey && item.count > 1) {
            this.splitStack(type, index);
        } 
        // Информация о предмете
        else {
            this.showDetailedInfo(item);
        }
    }
    
    startDrag(e, type, index) {
        const item = this.getItemFromSlot(type, index);
        if (!item) return;
        
        this.draggedItem = {
            item: { ...item },
            source: { type, index },
            element: this.createDragElement(item, e.clientX, e.clientY)
        };
        
        this.dragOffset = {
            x: e.clientX - e.target.getBoundingClientRect().left,
            y: e.clientY - e.target.getBoundingClientRect().top
        };
        
        document.addEventListener('mousemove', this.handleDragMove);
        document.addEventListener('mouseup', this.handleDragEnd);
    }
    
    createDragElement(item, x, y) {
        const dragElement = document.createElement('div');
        dragElement.className = 'drag-item';
        dragElement.innerHTML = `
            <div class="drag-icon">${this.getItemIcon(item.id)}</div>
            <div class="drag-count">${item.count > 1 ? item.count : ''}</div>
        `;
        dragElement.style.position = 'fixed';
        dragElement.style.left = `${x - 16}px`;
        dragElement.style.top = `${y - 16}px`;
        dragElement.style.zIndex = '10000';
        
        document.body.appendChild(dragElement);
        return dragElement;
    }
    
    handleDragMove = (e) => {
        if (!this.draggedItem) return;
        
        this.draggedItem.element.style.left = `${e.clientX - this.dragOffset.x}px`;
        this.draggedItem.element.style.top = `${e.clientY - this.dragOffset.y}px`;
    };
    
    handleDragEnd = (e) => {
        if (!this.draggedItem) return;
        
        // Удаление элемента перетаскивания
        this.draggedItem.element.remove();
        
        // Определение цели перетаскивания
        const targetElement = document.elementFromPoint(e.clientX, e.clientY);
        if (targetElement) {
            const targetSlot = this.findSlotFromElement(targetElement);
            if (targetSlot) {
                this.dropItem(targetSlot.type, targetSlot.index);
            }
        }
        
        // Очистка
        document.removeEventListener('mousemove', this.handleDragMove);
        document.removeEventListener('mouseup', this.handleDragEnd);
        this.draggedItem = null;
    };
    
    findSlotFromElement(element) {
        let current = element;
        while (current && !current.dataset.slot && !current.dataset.hotbar) {
            current = current.parentElement;
        }
        
        if (current) {
            if (current.dataset.slot !== undefined) {
                return { type: 'inventory', index: parseInt(current.dataset.slot) };
            } else if (current.dataset.hotbar !== undefined) {
                return { type: 'hotbar', index: parseInt(current.dataset.hotbar) };
            }
        }
        
        return null;
    }
    
    dropItem(targetType, targetIndex) {
        if (!this.draggedItem) return;
        
        const source = this.draggedItem.source;
        const item = this.draggedItem.item;
        
        // Если источник и цель одинаковы
        if (source.type === targetType && source.index === targetIndex) {
            return;
        }
        
        const targetItem = this.getItemFromSlot(targetType, targetIndex);
        
        // Если целевой слот пустой
        if (!targetItem) {
            this.removeItemFromSlot(source.type, source.index, item.count);
            this.addItemToSlot(targetType, targetIndex, item);
        }
        // Если тот же предмет
        else if (targetItem.id === item.id && targetItem.count < this.getMaxStackSize(item.id)) {
            const total = targetItem.count + item.count;
            const maxStack = this.getMaxStackSize(item.id);
            
            if (total <= maxStack) {
                // Объединение стопок
                this.removeItemFromSlot(source.type, source.index, item.count);
                targetItem.count = total;
                this.updateSlot(targetType, targetIndex, targetItem);
            } else {
                // Частичное объединение
                const transferAmount = maxStack - targetItem.count;
                this.removeItemFromSlot(source.type, source.index, transferAmount);
                targetItem.count = maxStack;
                this.updateSlot(targetType, targetIndex, targetItem);
                
                // Остаток остается в исходном слоте
                item.count -= transferAmount;
                if (item.count > 0) {
                    this.updateSlot(source.type, source.index, item);
                } else {
                    this.clearSlot(source.type, source.index);
                }
            }
        }
        // Обмен предметами
        else {
            this.swapItems(source, { type: targetType, index: targetIndex });
        }
        
        EventBus.emit('inventory:updated');
    }
    
    swapItems(source, target) {
        const sourceItem = this.getItemFromSlot(source.type, source.index);
        const targetItem = this.getItemFromSlot(target.type, target.index);
        
        if (sourceItem) {
            this.addItemToSlot(target.type, target.index, sourceItem);
        } else {
            this.clearSlot(target.type, target.index);
        }
        
        if (targetItem) {
            this.addItemToSlot(source.type, source.index, targetItem);
        } else {
            this.clearSlot(source.type, source.index);
        }
    }
    
    getItemFromSlot(type, index) {
        switch (type) {
            case 'hotbar':
                return this.inventory.hotbar[index];
            case 'inventory':
                return this.inventory.main[index];
            case 'crafting':
                return this.inventory.crafting[index];
            case 'output':
                return this.inventory.output;
            default:
                return null;
        }
    }
    
    addItemToSlot(type, index, item) {
        switch (type) {
            case 'hotbar':
                this.inventory.hotbar[index] = item;
                break;
            case 'inventory':
                this.inventory.main[index] = item;
                break;
            case 'crafting':
                this.inventory.crafting[index] = item;
                break;
            case 'output':
                this.inventory.output = item;
                break;
        }
        
        this.updateSlot(type, index, item);
    }
    
    removeItemFromSlot(type, index, amount = 1) {
        const item = this.getItemFromSlot(type, index);
        if (!item) return;
        
        if (item.count <= amount) {
            this.clearSlot(type, index);
        } else {
            item.count -= amount;
            this.updateSlot(type, index, item);
        }
    }
    
    clearSlot(type, index) {
        this.addItemToSlot(type, index, null);
    }
    
    updateSlot(type, index, item) {
        let slotElement;
        
        switch (type) {
            case 'hotbar':
                slotElement = document.querySelector(`[data-hotbar="${index}"]`);
                break;
            case 'inventory':
                slotElement = this.slots.get(index);
                break;
            case 'crafting':
                slotElement = this.craftingSlots.get(index);
                break;
            case 'output':
                slotElement = this.outputSlot;
                break;
        }
        
        if (!slotElement) return;
        
        if (item) {
            slotElement.innerHTML = `
                <div class="slot-content">
                    <div class="item-icon">${this.getItemIcon(item.id)}</div>
                    ${item.count > 1 ? `
                        <div class="item-count">${item.count}</div>
                    ` : ''}
                    ${item.durability !== undefined ? `
                        <div class="durability-bar">
                            <div class="durability-fill" 
                                 style="width: ${(item.durability / item.maxDurability) * 100}%">
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
            slotElement.classList.add('has-item');
            slotElement.title = this.getItemName(item.id);
        } else {
            slotElement.innerHTML = '';
            slotElement.classList.remove('has-item');
            slotElement.title = '';
        }
    }
    
    getItemIcon(itemId) {
        const icons = {
            1: '🌱', 2: '🟫', 3: '🪨', 4: '🪵', 5: '🍃',
            6: '💧', 7: '🟨', 8: '⚫', 9: '⚙️', 10: '💎',
            11: '🔥', 12: '🔷', 13: '⬛', 14: '🟦',
            15: '🪚', 16: '🔥', 17: '📦', 18: '🕯️'
        };
        
        return icons[itemId] || '❓';
    }
    
    getItemName(itemId) {
        const names = {
            1: 'Трава', 2: 'Земля', 3: 'Камень', 4: 'Дерево', 5: 'Листья',
            6: 'Вода', 7: 'Песок', 8: 'Уголь', 9: 'Железо', 10: 'Алмаз',
            11: 'Лава', 12: 'Стекло', 13: 'Бедрок', 14: 'Синий лед',
            15: 'Верстак', 16: 'Печь', 17: 'Сундук', 18: 'Факел'
        };
        
        return names[itemId] || 'Неизвестный предмет';
    }
    
    getMaxStackSize(itemId) {
        // Большинство блоков - 64, инструменты - 1
        const tools = [15, 16, 17, 18];
        return tools.includes(itemId) ? 1 : 64;
    }
    
    useItem(item, type, index) {
        if (type === 'output') {
            this.collectCraftedItem();
            return;
        }
        
        // Проверка на инструменты/оружие
        const tools = [15, 16, 17, 18]; // ID инструментов
        if (tools.includes(item.id)) {
            this.equipItem(item, type, index);
            return;
        }
        
        // Проверка на блоки
        const blocks = [1, 2, 3, 4, 5, 7, 8, 9, 10, 12, 13, 14];
        if (blocks.includes(item.id)) {
            this.selectBlock(item.id);
            this.hide();
            return;
        }
        
        // Проверка на еду/зелья
        const consumables = [19, 20, 21]; // Примеры ID
        if (consumables.includes(item.id)) {
            this.consumeItem(item, type, index);
            return;
        }
    }
    
    equipItem(item, type, index) {
        // Экипировка в руку
        this.game.player.equipment.hand = item;
        EventBus.emit('player:item_equipped', { item, slot: 'hand' });
        
        // Обновление UI
        this.updateSelection();
    }
    
    selectBlock(blockId) {
        this.game.player.selectedBlock = blockId;
        EventBus.emit('player:block_selected', { blockId });
    }
    
    consumeItem(item, type, index) {
        // Применение эффектов
        const effects = {
            19: { health: 5, saturation: 10 }, // Яблоко
            20: { health: 10, saturation: 20 }, // Хлеб
            21: { health: 20, saturation: 30 }  // Стейк
        };
        
        const effect = effects[item.id];
        if (effect) {
            this.game.player.stats.health = Math.min(
                this.game.player.stats.maxHealth,
                this.game.player.stats.health + effect.health
            );
            this.game.player.stats.hunger = Math.min(
                this.game.player.stats.maxHunger,
                this.game.player.stats.hunger + effect.saturation
            );
        }
        
        // Удаление одного предмета
        this.removeItemFromSlot(type, index, 1);
        
        EventBus.emit('player:item_consumed', { item, effect });
    }
    
    craftItem() {
        EventBus.emit('crafting:perform', {
            recipeId: this.currentRecipe,
            inventory: this.inventory
        });
    }
    
    collectCraftedItem() {
        const outputItem = this.inventory.output;
        if (!outputItem) return;
        
        // Попытка добавить в инвентарь
        const added = this.addToInventory(outputItem);
        if (added) {
            this.clearSlot('output', 0);
            EventBus.emit('crafting:collected', { item: outputItem });
        }
    }
    
    addToInventory(item) {
        // Сначала ищем стопки того же предмета
        for (let i = 0; i < this.inventory.main.length; i++) {
            const slot = this.inventory.main[i];
            if (slot && slot.id === item.id && slot.count < this.getMaxStackSize(item.id)) {
                const space = this.getMaxStackSize(item.id) - slot.count;
                const toAdd = Math.min(space, item.count);
                
                slot.count += toAdd;
                item.count -= toAdd;
                
                this.updateSlot('inventory', i, slot);
                
                if (item.count === 0) {
                    return true;
                }
            }
        }
        
        // Ищем пустые слоты
        for (let i = 0; i < this.inventory.main.length; i++) {
            if (!this.inventory.main[i]) {
                this.addItemToSlot('inventory', i, { ...item });
                item.count = 0;
                return true;
            }
        }
        
        return false;
    }
    
    quickMoveToHotbar(inventoryIndex) {
        const item = this.inventory.main[inventoryIndex];
        if (!item) return;
        
        // Ищем пустой слот в горячей панели
        for (let i = 0; i < this.inventory.hotbar.length; i++) {
            if (!this.inventory.hotbar[i]) {
                this.clearSlot('inventory', inventoryIndex);
                this.addItemToSlot('hotbar', i, item);
                return;
            }
        }
    }
    
    quickMoveToInventory(hotbarIndex) {
        const item = this.inventory.hotbar[hotbarIndex];
        if (!item) return;
        
        // Ищем пустой слот в инвентаре
        for (let i = 0; i < this.inventory.main.length; i++) {
            if (!this.inventory.main[i]) {
                this.clearSlot('hotbar', hotbarIndex);
                this.addItemToSlot('inventory', i, item);
                return;
            }
        }
    }
    
    splitStack(type, index) {
        const item = this.getItemFromSlot(type, index);
        if (!item || item.count < 2) return;
        
        const half = Math.floor(item.count / 2);
        const remaining = item.count - half;
        
        // Обновляем исходную стопку
        item.count = remaining;
        this.updateSlot(type, index, item);
        
        // Ищем пустой слот для второй половины
        const newItem = { ...item, count: half };
        
        if (type === 'inventory') {
            for (let i = 0; i < this.inventory.main.length; i++) {
                if (!this.inventory.main[i] && i !== index) {
                    this.addItemToSlot('inventory', i, newItem);
                    break;
                }
            }
        } else if (type === 'hotbar') {
            for (let i = 0; i < this.inventory.hotbar.length; i++) {
                if (!this.inventory.hotbar[i] && i !== index) {
                    this.addItemToSlot('hotbar', i, newItem);
                    break;
                }
            }
        }
    }
    
    showItemInfo(type, index) {
        const item = this.getItemFromSlot(type, index);
        if (!item) return;
        
        const info = document.getElementById('item-info');
        const name = document.getElementById('item-name');
        const desc = document.getElementById('item-description');
        const stats = document.getElementById('item-stats');
        
        name.textContent = this.getItemName(item.id);
        desc.textContent = this.getItemDescription(item.id);
        stats.innerHTML = this.getItemStats(item);
        
        info.classList.remove('hidden');
    }
    
    hideItemInfo() {
        document.getElementById('item-info').classList.add('hidden');
    }
    
    showDetailedInfo(item) {
        // Модальное окно с детальной информацией
        const modal = document.createElement('div');
        modal.className = 'item-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h3>${this.getItemName(item.id)}</h3>
                <div class="modal-body">
                    <div class="item-icon-large">${this.getItemIcon(item.id)}</div>
                    <div class="item-details">
                        <p>${this.getItemDescription(item.id)}</p>
                        <div class="item-meta">
                            <div>Количество: ${item.count}</div>
                            ${item.durability ? `
                                <div>Прочность: ${item.durability}/${item.maxDurability}</div>
                            ` : ''}
                            <div>Макс. стопка: ${this.getMaxStackSize(item.id)}</div>
                        </div>
                    </div>
                </div>
                <button class="close-modal">Закрыть</button>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        modal.querySelector('.close-modal').addEventListener('click', () => {
            modal.remove();
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }
    
    getItemDescription(itemId) {
        const descriptions = {
            1: 'Блок травы. Может быть превращен в землю.',
            2: 'Блок земли. Используется для строительства.',
            3: 'Твердый камень. Требует кирку для добычи.',
            4: 'Древесина. Может быть преобразована в доски.',
            5: 'Листья. Пропускают свет.',
            8: 'Угольная руда. Дает уголь при добыче.',
            10: 'Алмазная руда. Редкая и ценная.',
            15: 'Верстак. Позволяет создавать сложные предметы.',
            18: 'Факел. Источник света.'
        };
        
        return descriptions[itemId] || 'Предмет без описания.';
    }
    
    getItemStats(item) {
        if (!item) return '';
        
        let stats = '';
        
        if (item.durability !== undefined) {
            const percent = Math.round((item.durability / item.maxDurability) * 100);
            stats += `<div>Прочность: ${percent}%</div>`;
        }
        
        if (item.damage) {
            stats += `<div>Урон: ${item.damage}</div>`;
        }
        
        if (item.efficiency) {
            stats += `<div>Эффективность: ${item.efficiency}</div>`;
        }
        
        return stats || '<div>Нет особых характеристик</div>';
    }
    
    updateSelection() {
        // Снимаем выделение со всех слотов
        document.querySelectorAll('.slot.selected').forEach(slot => {
            slot.classList.remove('selected');
        });
        
        // Выделяем выбранный слот
        if (this.selectedSlot) {
            const { type, index } = this.selectedSlot;
            let selector;
            
            switch (type) {
                case 'hotbar':
                    selector = `[data-hotbar="${index}"]`;
                    break;
                case 'inventory':
                    selector = `[data-slot="${index}"]`;
                    break;
            }
            
            if (selector) {
                const slot = document.querySelector(selector);
                if (slot) slot.classList.add('selected');
            }
        }
    }
    
    updatePlayerStats() {
        const player = this.game.player;
        
        document.getElementById('inv-health').textContent = 
            Math.floor(player.stats.health);
        document.getElementById('inv-stamina').textContent = 
            Math.floor(player.stats.stamina);
        document.getElementById('inv-hunger').textContent = 
            Math.floor(player.stats.hunger);
        
        // Расчет веса
        let weight = 0;
        const allItems = [
            ...this.inventory.hotbar,
            ...this.inventory.main
        ].filter(Boolean);
        
        allItems.forEach(item => {
            const itemWeight = this.getItemWeight(item.id) * item.count;
            weight += itemWeight;
        });
        
        document.getElementById('inv-weight').textContent = weight.toFixed(1);
    }
    
    getItemWeight(itemId) {
        // Упрощенная система веса
        const weights = {
            1: 2.5, 2: 2.0, 3: 3.0, 4: 1.5, 5: 0.5,
            8: 2.0, 9: 4.0, 10: 3.5, 15: 10.0, 18: 0.3
        };
        
        return weights[itemId] || 1.0;
    }
    
    toggle() {
        if (this.isOpen) {
            this.hide();
        } else {
            this.show();
        }
    }
    
    show() {
        this.isOpen = true;
        this.container.classList.remove('hidden');
        
        // Обновляем статистику
        this.updatePlayerStats();
        
        // Обновляем слоты
        this.updateAllSlots();
        
        // Блокируем игровое управление
        EventBus.emit('ui:inventory_opened');
    }
    
    hide() {
        this.isOpen = false;
        this.container.classList.add('hidden');
        
        // Сбрасываем перетаскивание
        if (this.draggedItem) {
            this.draggedItem.element.remove();
            this.draggedItem = null;
        }
        
        // Разблокируем игровое управление
        EventBus.emit('ui:inventory_closed');
    }
    
    updateAllSlots() {
        // Обновляем горячую панель
        for (let i = 0; i < this.inventory.hotbar.length; i++) {
            this.updateSlot('hotbar', i, this.inventory.hotbar[i]);
        }
        
        // Обновляем основной инвентарь
        for (let i = 0; i < this.inventory.main.length; i++) {
            this.updateSlot('inventory', i, this.inventory.main[i]);
        }
        
        // Обновляем крафт
        for (let i = 0; i < this.inventory.crafting.length; i++) {
            this.updateSlot('crafting', i, this.inventory.crafting[i]);
        }
        
        // Обновляем выход крафта
        this.updateSlot('output', 0, this.inventory.output);
    }
    
    setupEventListeners() {
        // Горячие клавиши
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.hide();
            } else if (e.key === 'e' || e.key === 'E') {
                e.preventDefault();
                this.toggle();
            } else if (e.key >= '1' && e.key <= '9' && !this.isOpen) {
                const index = parseInt(e.key) - 1;
                this.selectHotbarSlot(index);
            }
        });
        
        // События от игрока
        EventBus.on('player:stats_changed', () => {
            if (this.isOpen) {
                this.updatePlayerStats();
            }
        });
        
        EventBus.on('inventory:updated', () => {
            this.updateAllSlots();
            this.updatePlayerStats();
        });
        
        EventBus.on('crafting:update', (data) => {
            this.currentRecipe = data.recipeId;
            document.getElementById('craft-btn').disabled = !data.canCraft;
        });
    }
    
    selectHotbarSlot(index) {
        const item = this.inventory.hotbar[index];
        if (item) {
            this.game.player.equipment.hand = item;
            EventBus.emit('player:hotbar_selected', { index, item });
        }
        
        // Выделение на горячей панели
        document.querySelectorAll('.hotbar-slot-ui').forEach((slot, i) => {
            if (i === index) {
                slot.classList.add('active');
            } else {
                slot.classList.remove('active');
            }
        });
    }
}