import EventBus from '@/utils/EventBus.js';

export default class HUD {
    constructor(game) {
        this.game = game;
        this.elements = {};
        this.indicators = new Map();
        this.notifications = [];
        this.maxNotifications = 5;
        
        this.setupDOM();
        this.setupEventListeners();
        this.setupIndicators();
    }
    
    setupDOM() {
        // Основной контейнер HUD
        this.container = document.createElement('div');
        this.container.id = 'game-hud';
        this.container.innerHTML = `
            <!-- Верхняя панель -->
            <div class="hud-top">
                <!-- Здоровье -->
                <div class="hud-health">
                    <div class="health-bar">
                        <div class="bar-fill" id="health-fill"></div>
                        <div class="bar-text" id="health-text">100</div>
                    </div>
                    <div class="health-icon">❤️</div>
                </div>
                
                <!-- Выносливость -->
                <div class="hud-stamina">
                    <div class="stamina-bar">
                        <div class="bar-fill" id="stamina-fill"></div>
                        <div class="bar-text" id="stamina-text">100</div>
                    </div>
                    <div class="stamina-icon">⚡</div>
                </div>
                
                <!-- Голод -->
                <div class="hud-hunger">
                    <div class="hunger-bar">
                        <div class="bar-fill" id="hunger-fill"></div>
                        <div class="bar-text" id="hunger-text">100</div>
                    </div>
                    <div class="hunger-icon">🍖</div>
                </div>
                
                <!-- Опыт -->
                <div class="hud-experience">
                    <div class="exp-bar">
                        <div class="bar-fill" id="exp-fill"></div>
                        <div class="bar-text" id="exp-text">0/100</div>
                    </div>
                    <div class="level-badge" id="level-badge">1</div>
                </div>
            </div>
            
            <!-- Центральная часть -->
            <div class="hud-center">
                <!-- Прицел -->
                <div class="crosshair" id="crosshair"></div>
                
                <!-- Подсказка взаимодействия -->
                <div class="interaction-hint" id="interaction-hint"></div>
                
                <!-- Индикатор цели -->
                <div class="target-indicator" id="target-indicator"></div>
            </div>
            
            <!-- Нижняя панель -->
            <div class="hud-bottom">
                <!-- Горячая панель -->
                <div class="hotbar" id="hotbar">
                    ${Array(9).fill(0).map((_, i) => `
                        <div class="hotbar-slot" data-slot="${i}">
                            <div class="slot-number">${i + 1}</div>
                            <div class="slot-content"></div>
                            <div class="slot-count"></div>
                        </div>
                    `).join('')}
                </div>
                
                <!-- Быстрые показатели -->
                <div class="quick-stats">
                    <div class="stat time">
                        <span class="stat-icon">🕐</span>
                        <span class="stat-value" id="game-time">12:00</span>
                    </div>
                    <div class="stat position">
                        <span class="stat-icon">📍</span>
                        <span class="stat-value" id="player-position">0, 0</span>
                    </div>
                    <div class="stat fps">
                        <span class="stat-icon">📊</span>
                        <span class="stat-value" id="fps-counter">60</span>
                    </div>
                </div>
                
                <!-- Индикаторы эффектов -->
                <div class="effect-indicators" id="effect-indicators"></div>
            </div>
            
            <!-- Панель уведомлений -->
            <div class="notification-container" id="notification-container"></div>
            
            <!-- Панель быстрых сообщений -->
            <div class="quick-message" id="quick-message"></div>
            
            <!-- Мини-карта -->
            <div class="minimap-container" id="minimap-container">
                <canvas id="minimap" width="200" height="200"></canvas>
                <div class="minimap-controls">
                    <button class="minimap-zoom-in" title="Увеличить">+</button>
                    <button class="minimap-zoom-out" title="Уменьшить">-</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.container);
        
        // Сохранение ссылок на элементы
        this.elements = {
            healthFill: document.getElementById('health-fill'),
            healthText: document.getElementById('health-text'),
            staminaFill: document.getElementById('stamina-fill'),
            staminaText: document.getElementById('stamina-text'),
            hungerFill: document.getElementById('hunger-fill'),
            hungerText: document.getElementById('hunger-text'),
            expFill: document.getElementById('exp-fill'),
            expText: document.getElementById('exp-text'),
            levelBadge: document.getElementById('level-badge'),
            crosshair: document.getElementById('crosshair'),
            interactionHint: document.getElementById('interaction-hint'),
            targetIndicator: document.getElementById('target-indicator'),
            gameTime: document.getElementById('game-time'),
            playerPosition: document.getElementById('player-position'),
            fpsCounter: document.getElementById('fps-counter'),
            hotbar: document.getElementById('hotbar'),
            effectIndicators: document.getElementById('effect-indicators'),
            notificationContainer: document.getElementById('notification-container'),
            quickMessage: document.getElementById('quick-message'),
            minimap: document.getElementById('minimap'),
            minimapContainer: document.getElementById('minimap-container')
        };
        
        // Инициализация горячей панели
        this.initializeHotbar();
        
        // Инициализация мини-карты
        this.initializeMinimap();
    }
    
    initializeHotbar() {
        const hotbar = this.elements.hotbar;
        
        // Слоты горячей панели
        this.hotbarSlots = Array.from(hotbar.querySelectorAll('.hotbar-slot'));
        
        // Выделение первого слота
        this.selectHotbarSlot(0);
        
        // Обработчики событий для слотов
        this.hotbarSlots.forEach((slot, index) => {
            // Клик для выбора
            slot.addEventListener('click', () => {
                this.selectHotbarSlot(index);
            });
            
            // Наведение для подсказки
            slot.addEventListener('mouseenter', () => {
                this.showHotbarTooltip(slot, index);
            });
            
            slot.addEventListener('mouseleave', () => {
                this.hideHotbarTooltip();
            });
        });
    }
    
    selectHotbarSlot(index) {
        // Снимаем выделение со всех слотов
        this.hotbarSlots.forEach(slot => {
            slot.classList.remove('selected');
        });
        
        // Выделяем выбранный слот
        this.hotbarSlots[index].classList.add('selected');
        
        // Обновляем выбранный блок у игрока
        const item = this.game.player.inventory.hotbar[index];
        if (item) {
            this.game.player.selectedBlock = item.id;
            this.game.player.equipment.hand = item;
            
            EventBus.emit('player:hotbar_selected', {
                index,
                item,
                blockId: item.id
            });
        }
    }
    
    showHotbarTooltip(slot, index) {
        const item = this.game.player.inventory.hotbar[index];
        if (!item) return;
        
        const tooltip = document.createElement('div');
        tooltip.className = 'hotbar-tooltip';
        tooltip.innerHTML = `
            <div class="tooltip-name">${this.getItemName(item.id)}</div>
            ${item.count > 1 ? `<div class="tooltip-count">Количество: ${item.count}</div>` : ''}
            ${item.durability !== undefined ? `
                <div class="tooltip-durability">
                    Прочность: ${Math.round((item.durability / item.maxDurability) * 100)}%
                </div>
            ` : ''}
        `;
        
        const rect = slot.getBoundingClientRect();
        tooltip.style.position = 'fixed';
        tooltip.style.left = `${rect.left + rect.width / 2}px`;
        tooltip.style.top = `${rect.top - 10}px`;
        tooltip.style.transform = 'translate(-50%, -100%)';
        
        document.body.appendChild(tooltip);
        slot.tooltip = tooltip;
    }
    
    hideHotbarTooltip() {
        const tooltip = document.querySelector('.hotbar-tooltip');
        if (tooltip) {
            tooltip.remove();
        }
    }
    
    getItemName(itemId) {
        const names = {
            1: 'Трава', 2: 'Земля', 3: 'Камень', 4: 'Дерево',
            5: 'Листья', 6: 'Вода', 7: 'Песок', 8: 'Уголь',
            9: 'Железо', 10: 'Алмаз', 11: 'Лава', 12: 'Стекло',
            13: 'Бедрок', 14: 'Лед', 15: 'Верстак', 16: 'Печь',
            17: 'Сундук', 18: 'Факел'
        };
        
        return names[itemId] || 'Предмет';
    }
    
    updateHotbar() {
        const inventory = this.game.player.inventory;
        
        this.hotbarSlots.forEach((slot, index) => {
            const item = inventory.hotbar[index];
            const content = slot.querySelector('.slot-content');
            const count = slot.querySelector('.slot-count');
            
            if (item) {
                // Обновление иконки
                content.innerHTML = `<div class="item-icon">${this.getItemIcon(item.id)}</div>`;
                
                // Обновление счетчика
                if (item.count > 1) {
                    count.textContent = item.count;
                    count.style.display = 'block';
                } else {
                    count.style.display = 'none';
                }
                
                // Обновление прочности для инструментов
                if (item.durability !== undefined) {
                    const durabilityBar = content.querySelector('.durability-bar') || 
                                         document.createElement('div');
                    durabilityBar.className = 'durability-bar';
                    durabilityBar.innerHTML = `
                        <div class="durability-fill" 
                             style="width: ${(item.durability / item.maxDurability) * 100}%">
                        </div>
                    `;
                    
                    if (!content.querySelector('.durability-bar')) {
                        content.appendChild(durabilityBar);
                    }
                }
                
                slot.classList.add('has-item');
            } else {
                content.innerHTML = '';
                count.textContent = '';
                slot.classList.remove('has-item');
            }
        });
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
    
    setupIndicators() {
        // Индикаторы эффектов
        this.effectIndicators = {
            speed: { icon: '⚡', name: 'Скорость', active: false },
            strength: { icon: '💪', name: 'Сила', active: false },
            regeneration: { icon: '❤️', name: 'Регенерация', active: false },
            waterBreathing: { icon: '🌊', name: 'Подводное дыхание', active: false },
            nightVision: { icon: '👁️', name: 'Ночное зрение', active: false },
            miningFatigue: { icon: '⏳', name: 'Усталость', active: false },
            poison: { icon: '☠️', name: 'Яд', active: false }
        };
    }
    
    updatePlayerStats() {
        const player = this.game.player;
        const stats = player.stats;
        
        // Здоровье
        const healthPercent = stats.health / stats.maxHealth;
        this.elements.healthFill.style.width = `${healthPercent * 100}%`;
        this.elements.healthText.textContent = Math.floor(stats.health);
        
        // Цвет здоровья в зависимости от уровня
        if (healthPercent > 0.5) {
            this.elements.healthFill.style.backgroundColor = '#4CAF50';
        } else if (healthPercent > 0.25) {
            this.elements.healthFill.style.backgroundColor = '#FF9800';
        } else {
            this.elements.healthFill.style.backgroundColor = '#F44336';
        }
        
        // Выносливость
        const staminaPercent = stats.stamina / stats.maxStamina;
        this.elements.staminaFill.style.width = `${staminaPercent * 100}%`;
        this.elements.staminaText.textContent = Math.floor(stats.stamina);
        
        // Голод
        const hungerPercent = stats.hunger / stats.maxHunger;
        this.elements.hungerFill.style.width = `${hungerPercent * 100}%`;
        this.elements.hungerText.textContent = Math.floor(stats.hunger);
        
        // Опыт
        const expPercent = stats.experience / stats.nextLevelExp;
        this.elements.expFill.style.width = `${expPercent * 100}%`;
        this.elements.expText.textContent = 
            `${Math.floor(stats.experience)}/${stats.nextLevelExp}`;
        
        // Уровень
        this.elements.levelBadge.textContent = stats.level;
        
        // Позиция
        const x = Math.floor(player.position.x / 16);
        const y = Math.floor(player.position.y / 16);
        this.elements.playerPosition.textContent = `${x}, ${y}`;
    }
    
    updateTime() {
        const lighting = this.game.world.lighting;
        if (!lighting) return;
        
        const time = lighting.getTimeOfDay();
        const hour = time.hour.toString().padStart(2, '0');
        const minute = time.minute.toString().padStart(2, '0');
        
        this.elements.gameTime.textContent = `${hour}:${minute}`;
        
        // Изменение цвета в зависимости от времени
        if (time.isDay) {
            this.elements.gameTime.style.color = '#FFD700';
        } else {
            this.elements.gameTime.style.color = '#87CEEB';
        }
    }
    
    updateCrosshair(target) {
        if (target) {
            this.elements.crosshair.classList.add('active');
            
            // Обновление подсказки взаимодействия
            if (target.type === 'block') {
                const block = this.game.world.getBlock(target.x, target.y);
                if (block && block.type !== 0) {
                    this.elements.interactionHint.textContent = `ЛКМ: Разрушить ${this.getBlockName(block.type)}`;
                    this.elements.interactionHint.classList.add('visible');
                }
            } else if (target.type === 'entity') {
                this.elements.interactionHint.textContent = `ЛКМ: Атаковать`;
                this.elements.interactionHint.classList.add('visible');
            }
        } else {
            this.elements.crosshair.classList.remove('active');
            this.elements.interactionHint.classList.remove('visible');
        }
    }
    
    getBlockName(blockType) {
        const names = {
            1: 'Трава', 2: 'Земля', 3: 'Камень', 4: 'Дерево',
            5: 'Листья', 7: 'Песок', 8: 'Уголь', 9: 'Железо',
            10: 'Алмаз', 12: 'Стекло', 15: 'Верстак', 16: 'Печь',
            17: 'Сундук', 18: 'Факел'
        };
        
        return names[blockType] || 'Блок';
    }
    
    showNotification(message, type = 'info', duration = 3000) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-icon">${this.getNotificationIcon(type)}</div>
            <div class="notification-text">${message}</div>
            <div class="notification-progress"></div>
        `;
        
        this.elements.notificationContainer.appendChild(notification);
        
        // Анимация появления
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        // Автоматическое скрытие
        const progress = notification.querySelector('.notification-progress');
        progress.style.transition = `width ${duration}ms linear`;
        
        setTimeout(() => {
            progress.style.width = '100%';
        }, 100);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }, duration);
        
        // Ограничение количества уведомлений
        const notifications = this.elements.notificationContainer.querySelectorAll('.notification');
        if (notifications.length > this.maxNotifications) {
            notifications[0].remove();
        }
        
        // Запись в историю
        this.notifications.push({
            message,
            type,
            timestamp: Date.now()
        });
    }
    
    getNotificationIcon(type) {
        const icons = {
            info: 'ℹ️',
            success: '✅',
            warning: '⚠️',
            error: '❌',
            achievement: '🏆',
            item: '📦'
        };
        
        return icons[type] || icons.info;
    }
    
    showQuickMessage(message, duration = 2000) {
        this.elements.quickMessage.textContent = message;
        this.elements.quickMessage.classList.add('visible');
        
        setTimeout(() => {
            this.elements.quickMessage.classList.remove('visible');
        }, duration);
    }
    
    updateEffectIndicators(effects) {
        this.elements.effectIndicators.innerHTML = '';
        
        Object.entries(effects).forEach(([key, effect]) => {
            if (effect.active && effect.duration > 0) {
                const indicator = document.createElement('div');
                indicator.className = `effect-indicator ${key}`;
                indicator.title = `${effect.name}\nОсталось: ${Math.ceil(effect.duration)}с`;
                indicator.innerHTML = `
                    <div class="effect-icon">${effect.icon}</div>
                    <div class="effect-timer">${Math.ceil(effect.duration)}</div>
                `;
                
                this.elements.effectIndicators.appendChild(indicator);
            }
        });
    }
    
    initializeMinimap() {
        this.minimapCtx = this.elements.minimap.getContext('2d');
        this.minimapZoom = 2;
        this.minimapCenter = { x: 0, y: 0 };
        
        // Обработчики кнопок зума
        document.querySelector('.minimap-zoom-in').addEventListener('click', () => {
            this.minimapZoom = Math.min(8, this.minimapZoom * 1.5);
            this.renderMinimap();
        });
        
        document.querySelector('.minimap-zoom-out').addEventListener('click', () => {
            this.minimapZoom = Math.max(0.5, this.minimapZoom / 1.5);
            this.renderMinimap();
        });
    }
    
    renderMinimap() {
        const ctx = this.minimapCtx;
        const canvas = this.elements.minimap;
        const player = this.game.player;
        
        // Очистка
        ctx.fillStyle = '#1a2980';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Центр на игроке
        this.minimapCenter.x = player.position.x / 16;
        this.minimapCenter.y = player.position.y / 16;
        
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const scale = 2 / this.minimapZoom;
        
        // Отрисовка чанков
        const visibleChunks = this.game.world.getVisibleChunks();
        const chunkSize = 16;
        
        ctx.fillStyle = '#2E7D32'; // Зеленый для земли
        
        visibleChunks.forEach(chunk => {
            for (let y = 0; y < chunkSize; y++) {
                for (let x = 0; x < chunkSize; x++) {
                    const worldX = chunk.x * chunkSize + x;
                    const worldY = chunk.y * chunkSize + y;
                    
                    const block = this.game.world.getBlock(worldX, worldY);
                    if (block && block.type !== 0) {
                        // Преобразование координат
                        const screenX = centerX + (worldX - this.minimapCenter.x) * scale;
                        const screenY = centerY + (worldY - this.minimapCenter.y) * scale;
                        
                        // Проверка видимости на мини-карте
                        if (screenX >= 0 && screenX < canvas.width && 
                            screenY >= 0 && screenY < canvas.height) {
                            
                            // Цвет в зависимости от типа блока
                            let color = '#2E7D32'; // По умолчанию зелень
                            
                            switch(block.type) {
                                case 3: // Камень
                                    color = '#808080';
                                    break;
                                case 6: // Вода
                                    color = '#1E90FF';
                                    break;
                                case 7: // Песок
                                    color = '#F4E04D';
                                    break;
                                case 12: // Лава
                                    color = '#FF4500';
                                    break;
                            }
                            
                            ctx.fillStyle = color;
                            ctx.fillRect(screenX, screenY, scale, scale);
                        }
                    }
                }
            }
        });
        
        // Отрисовка игрока
        ctx.fillStyle = '#FF0000';
        ctx.beginPath();
        ctx.arc(centerX, centerY, 3, 0, Math.PI * 2);
        ctx.fill();
        
        // Отрисовка направления
        const directionLength = 10;
        const angle = Math.atan2(
            player.velocity.y || 0.1, 
            player.velocity.x || 0.1
        );
        
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(
            centerX + Math.cos(angle) * directionLength,
            centerY + Math.sin(angle) * directionLength
        );
        ctx.stroke();
        
        // Отрисовка сетки
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 0.5;
        
        // Вертикальные линии
        for (let x = -5; x <= 5; x++) {
            const lineX = centerX + x * chunkSize * scale;
            ctx.beginPath();
            ctx.moveTo(lineX, 0);
            ctx.lineTo(lineX, canvas.height);
            ctx.stroke();
        }
        
        // Горизонтальные линии
        for (let y = -5; y <= 5; y++) {
            const lineY = centerY + y * chunkSize * scale;
            ctx.beginPath();
            ctx.moveTo(0, lineY);
            ctx.lineTo(canvas.width, lineY);
            ctx.stroke();
        }
    }
    
    updateFPS(fps) {
        this.elements.fpsCounter.textContent = Math.round(fps);
        
        // Цвет в зависимости от FPS
        if (fps >= 55) {
            this.elements.fpsCounter.style.color = '#4CAF50';
        } else if (fps >= 30) {
            this.elements.fpsCounter.style.color = '#FF9800';
        } else {
            this.elements.fpsCounter.style.color = '#F44336';
        }
    }
    
    showDamageIndicator(damage, x, y, isCritical = false) {
        const indicator = document.createElement('div');
        indicator.className = `damage-indicator ${isCritical ? 'critical' : ''}`;
        indicator.textContent = Math.floor(damage);
        indicator.style.position = 'fixed';
        indicator.style.left = `${x}px`;
        indicator.style.top = `${y}px`;
        indicator.style.zIndex = '1000';
        
        document.body.appendChild(indicator);
        
        // Анимация
        const animation = indicator.animate([
            { transform: 'translateY(0) scale(1)', opacity: 1 },
            { transform: 'translateY(-50px) scale(1.5)', opacity: 0 }
        ], {
            duration: 1000,
            easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
        });
        
        animation.onfinish = () => {
            indicator.remove();
        };
    }
    
    updateTargetIndicator(target) {
        if (target && target.type === 'entity') {
            const indicator = this.elements.targetIndicator;
            const entity = target.entity;
            
            // Расчет позиции на экране
            const screenX = entity.position.x - this.game.camera.x;
            const screenY = entity.position.y - this.game.camera.y;
            
            indicator.style.left = `${screenX}px`;
            indicator.style.top = `${screenY - 40}px`;
            indicator.textContent = `${entity.health}/${entity.maxHealth}`;
            indicator.classList.add('visible');
            
            // Полоска здоровья
            const healthPercent = entity.health / entity.maxHealth;
            indicator.style.setProperty('--health-percent', `${healthPercent * 100}%`);
        } else {
            this.elements.targetIndicator.classList.remove('visible');
        }
    }
    
    toggleMinimap() {
        this.elements.minimapContainer.classList.toggle('hidden');
    }
    
    update(deltaTime) {
        // Обновление статистики игрока
        this.updatePlayerStats();
        
        // Обновление времени
        this.updateTime();
        
        // Обновление горячей панели
        this.updateHotbar();
        
        // Обновление мини-карты (реже, для производительности)
        this.minimapFrameCount = (this.minimapFrameCount || 0) + 1;
        if (this.minimapFrameCount >= 10) { // Каждые 10 кадров
            this.renderMinimap();
            this.minimapFrameCount = 0;
        }
        
        // Обновление уведомлений
        this.updateNotifications(deltaTime);
    }
    
    updateNotifications(deltaTime) {
        // Обновление прогресса уведомлений
        const notifications = this.elements.notificationContainer.querySelectorAll('.notification');
        notifications.forEach(notification => {
            const progress = notification.querySelector('.notification-progress');
            if (progress) {
                const currentWidth = parseFloat(progress.style.width) || 0;
                progress.style.width = `${Math.max(0, currentWidth - (100 * deltaTime / 3))}%`;
            }
        });
    }
    
    setupEventListeners() {
        // События от игрока
        EventBus.on('player:damaged', (data) => {
            this.showDamageIndicator(data.amount, data.x, data.y, data.critical);
        });
        
        EventBus.on('player:healed', (data) => {
            this.showQuickMessage(`+${data.amount} здоровья`, 1500);
        });
        
        EventBus.on('player:level_up', (data) => {
            this.showNotification(`Новый уровень: ${data.level}!`, 'achievement', 5000);
        });
        
        EventBus.on('player:exp_gained', (data) => {
            if (data.amount >= 10) {
                this.showQuickMessage(`+${data.amount} опыта`, 1000);
            }
        });
        
        EventBus.on('inventory:item_added', (data) => {
            this.showQuickMessage(`Получено: ${data.item.name} x${data.count}`, 1500);
        });
        
        EventBus.on('crafting:success', (data) => {
            this.showNotification(`Создано: ${data.item.name}`, 'success', 3000);
        });
        
        EventBus.on('mining:block_broken', (data) => {
            this.showQuickMessage(`Добыто: ${data.blockName}`, 1000);
        });
        
        EventBus.on('world:time_changed', (data) => {
            if (data.isDay) {
                this.showQuickMessage('Наступил день', 2000);
            } else {
                this.showQuickMessage('Наступила ночь', 2000);
            }
        });
        
        // Горячие клавиши
        document.addEventListener('keydown', (e) => {
            if (e.key === 'm' || e.key === 'M') {
                e.preventDefault();
                this.toggleMinimap();
            } else if (e.key >= '1' && e.key <= '9') {
                this.selectHotbarSlot(parseInt(e.key) - 1);
            }
        });
        
        // Обновление FPS
        let lastTime = performance.now();
        let frameCount = 0;
        
        const updateFPS = () => {
            const currentTime = performance.now();
            frameCount++;
            
            if (currentTime - lastTime >= 1000) {
                this.updateFPS(frameCount);
                frameCount = 0;
                lastTime = currentTime;
            }
            
            requestAnimationFrame(updateFPS);
        };
        
        updateFPS();
    }
}