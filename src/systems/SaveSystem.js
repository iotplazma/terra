import EventBus from '@/utils/EventBus.js';

export default class SaveSystem {
    constructor(game) {
        this.game = game;
        this.saveVersion = '1.0.0';
        this.autoSaveInterval = 300000; // 5 минут
        this.maxSaves = 10;
        this.currentSlot = 0;
        
        this.setupEventListeners();
        this.startAutoSave();
    }
    
    setupEventListeners() {
        // Сохранение при закрытии страницы
        window.addEventListener('beforeunload', () => {
            this.quickSave();
        });
        
        // Горячие клавиши для сохранения/загрузки
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                this.quickSave();
                this.showMessage('Игра сохранена');
            } else if (e.ctrlKey && e.key === 'l') {
                e.preventDefault();
                this.quickLoad();
            }
        });
        
        // События для автосохранения
        EventBus.on('player:position_changed', () => {
            this.scheduleAutoSave();
        });
        
        EventBus.on('inventory:changed', () => {
            this.scheduleAutoSave();
        });
    }
    
    startAutoSave() {
        setInterval(() => {
            if (this.shouldAutoSave()) {
                this.autoSave();
            }
        }, this.autoSaveInterval);
    }
    
    shouldAutoSave() {
        // Проверка условий для автосохранения
        const player = this.game.player;
        return player && 
               !player.state.isDead && 
               player.stats.health > 0 &&
               Date.now() - (this.lastSaveTime || 0) > 60000; // Не чаще чем раз в минуту
    }
    
    scheduleAutoSave() {
        if (!this.autoSaveTimeout) {
            this.autoSaveTimeout = setTimeout(() => {
                if (this.shouldAutoSave()) {
                    this.autoSave();
                }
                this.autoSaveTimeout = null;
            }, 10000); // Через 10 секунд после изменений
        }
    }
    
    async quickSave() {
        try {
            const saveData = this.createSaveData();
            const success = await this.saveToSlot(this.currentSlot, saveData);
            
            if (success) {
                this.lastSaveTime = Date.now();
                EventBus.emit('save:complete', { slot: this.currentSlot });
                return true;
            }
        } catch (error) {
            console.error('Ошибка быстрого сохранения:', error);
            EventBus.emit('save:error', { error: error.message });
        }
        
        return false;
    }
    
    async autoSave() {
        try {
            const saveData = this.createSaveData();
            const slot = 'auto_' + Math.floor(Date.now() / this.autoSaveInterval);
            const success = await this.saveToSlot(slot, saveData);
            
            if (success) {
                this.lastSaveTime = Date.now();
                this.cleanupOldSaves();
                EventBus.emit('save:autosave_complete', { slot });
            }
        } catch (error) {
            console.error('Ошибка автосохранения:', error);
        }
    }
    
    createSaveData() {
        const player = this.game.player;
        const world = this.game.world;
        const time = this.game.time;
        
        return {
            metadata: {
                version: this.saveVersion,
                timestamp: Date.now(),
                gameTime: time ? time.currentTime : 0,
                playTime: this.calculatePlayTime()
            },
            
            player: {
                position: [player.position.x, player.position.y],
                stats: { ...player.stats },
                inventory: this.serializeInventory(player.inventory),
                equipment: this.serializeEquipment(player.equipment),
                skills: { ...player.skills },
                state: { ...player.state }
            },
            
            world: {
                seed: world.seed,
                spawn: world.spawnPoint,
                chunks: this.serializeChunks(world.getModifiedChunks())
            },
            
            entities: this.serializeEntities(),
            
            settings: {
                graphics: this.game.settings.graphics,
                audio: this.game.settings.audio,
                controls: this.game.settings.controls
            }
        };
    }
    
    serializeInventory(inventory) {
        return {
            hotbar: inventory.hotbar.map(item => this.serializeItem(item)),
            main: inventory.main.map(item => this.serializeItem(item)),
            crafting: inventory.crafting.map(item => this.serializeItem(item)),
            output: this.serializeItem(inventory.output)
        };
    }
    
    serializeItem(item) {
        if (!item) return null;
        
        return {
            id: item.id,
            count: item.count,
            durability: item.durability,
            maxDurability: item.maxDurability,
            metadata: item.metadata || {}
        };
    }
    
    serializeEquipment(equipment) {
        const result = {};
        for (const [slot, item] of Object.entries(equipment)) {
            result[slot] = this.serializeItem(item);
        }
        return result;
    }
    
    serializeChunks(chunks) {
        return chunks.map(chunk => ({
            x: chunk.x,
            y: chunk.y,
            data: Array.from(chunk.data),
            modified: chunk.modified || false
        }));
    }
    
    serializeEntities() {
        const entities = this.game.entityManager?.getAllEntities() || [];
        return entities.map(entity => ({
            type: entity.type,
            id: entity.id,
            position: [entity.position.x, entity.position.y],
            health: entity.health,
            data: entity.getSaveData ? entity.getSaveData() : {}
        }));
    }
    
    calculatePlayTime() {
        const startTime = this.game.startTime || Date.now();
        return Date.now() - startTime;
    }
    
    async saveToSlot(slot, data) {
        try {
            const key = `save_${slot}`;
            const compressed = this.compressData(data);
            
            localStorage.setItem(key, compressed);
            
            // Сохранение метаданных
            const metadata = {
                slot,
                timestamp: Date.now(),
                playerName: 'Игрок',
                location: `X: ${Math.floor(data.player.position[0])}, Y: ${Math.floor(data.player.position[1])}`,
                playTime: data.metadata.playTime,
                thumbnail: await this.createThumbnail()
            };
            
            localStorage.setItem(`metadata_${slot}`, JSON.stringify(metadata));
            
            return true;
        } catch (error) {
            console.error('Ошибка сохранения в слот:', error);
            return false;
        }
    }
    
    compressData(data) {
        // Простое сжатие через JSON + base64
        const json = JSON.stringify(data);
        return btoa(encodeURIComponent(json));
    }
    
    decompressData(compressed) {
        try {
            const json = decodeURIComponent(atob(compressed));
            return JSON.parse(json);
        } catch (error) {
            console.error('Ошибка распаковки данных:', error);
            return null;
        }
    }
    
    async createThumbnail() {
        // Создание миниатюры сохранения (упрощенно)
        const canvas = document.createElement('canvas');
        canvas.width = 160;
        canvas.height = 90;
        
        const ctx = canvas.getContext('2d');
        
        // Заполнение фона
        ctx.fillStyle = '#1a2980';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Простая графика для миниатюры
        ctx.fillStyle = '#2E7D32';
        ctx.fillRect(0, 60, canvas.width, 30);
        
        // Игрок
        ctx.fillStyle = '#FF0000';
        ctx.beginPath();
        ctx.arc(80, 50, 10, 0, Math.PI * 2);
        ctx.fill();
        
        // Время
        const time = this.game.time?.currentTime || 0;
        const hour = Math.floor((time / 1000) % 24);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '12px Arial';
        ctx.fillText(`${hour}:00`, 10, 20);
        
        return canvas.toDataURL('image/jpeg', 0.5);
    }
    
    async quickLoad() {
        return this.loadFromSlot(this.currentSlot);
    }
    
    async loadFromSlot(slot) {
        try {
            const key = `save_${slot}`;
            const compressed = localStorage.getItem(key);
            
            if (!compressed) {
                throw new Error('Сохранение не найдено');
            }
            
            const saveData = this.decompressData(compressed);
            if (!saveData) {
                throw new Error('Неверный формат сохранения');
            }
            
            // Проверка версии
            if (saveData.metadata.version !== this.saveVersion) {
                console.warn(`Версия сохранения (${saveData.metadata.version}) отличается от текущей (${this.saveVersion})`);
                // Здесь можно добавить миграцию данных
            }
            
            // Загрузка игрока
            await this.loadPlayer(saveData.player);
            
            // Загрузка мира
            await this.loadWorld(saveData.world);
            
            // Загрузка существ
            await this.loadEntities(saveData.entities);
            
            // Восстановление времени
            if (this.game.time && saveData.metadata.gameTime) {
                this.game.time.currentTime = saveData.metadata.gameTime;
            }
            
            this.lastSaveTime = Date.now();
            
            EventBus.emit('save:loaded', { 
                slot, 
                timestamp: saveData.metadata.timestamp,
                playTime: saveData.metadata.playTime 
            });
            
            this.showMessage('Игра загружена');
            return true;
            
        } catch (error) {
            console.error('Ошибка загрузки:', error);
            EventBus.emit('save:load_error', { error: error.message });
            this.showMessage(`Ошибка загрузки: ${error.message}`, 'error');
            return false;
        }
    }
    
    async loadPlayer(playerData) {
        const player = this.game.player;
        
        // Позиция
        player.position.set(playerData.position[0], playerData.position[1]);
        player.previousPosition.copy(player.position);
        
        // Статистика
        Object.assign(player.stats, playerData.stats);
        
        // Инвентарь
        this.loadInventory(player.inventory, playerData.inventory);
        
        // Снаряжение
        this.loadEquipment(player.equipment, playerData.equipment);
        
        // Навыки
        Object.assign(player.skills, playerData.skills);
        
        // Состояние
        Object.assign(player.state, playerData.state);
        
        EventBus.emit('player:loaded', { playerData });
    }
    
    loadInventory(inventory, inventoryData) {
        inventory.hotbar = inventoryData.hotbar.map(item => this.deserializeItem(item));
        inventory.main = inventoryData.main.map(item => this.deserializeItem(item));
        inventory.crafting = inventoryData.crafting.map(item => this.deserializeItem(item));
        inventory.output = this.deserializeItem(inventoryData.output);
        
        EventBus.emit('inventory:loaded');
    }
    
    deserializeItem(itemData) {
        if (!itemData) return null;
        
        return {
            id: itemData.id,
            count: itemData.count || 1,
            durability: itemData.durability,
            maxDurability: itemData.maxDurability,
            metadata: itemData.metadata || {}
        };
    }
    
    loadEquipment(equipment, equipmentData) {
        for (const [slot, itemData] of Object.entries(equipmentData)) {
            equipment[slot] = this.deserializeItem(itemData);
        }
        
        EventBus.emit('equipment:loaded');
    }
    
    async loadWorld(worldData) {
        const world = this.game.world;
        
        // Установка сида
        if (worldData.seed) {
            world.seed = worldData.seed;
        }
        
        // Точка спавна
        if (worldData.spawn) {
            world.spawnPoint = worldData.spawn;
        }
        
        // Загрузка чанков
        if (worldData.chunks && worldData.chunks.length > 0) {
            await this.loadChunks(worldData.chunks);
        }
        
        EventBus.emit('world:loaded', { worldData });
    }
    
    async loadChunks(chunksData) {
        const world = this.game.world;
        
        for (const chunkData of chunksData) {
            const chunk = world.getChunk(chunkData.x, chunkData.y, true);
            
            if (chunk) {
                chunk.data = new Uint8Array(chunkData.data);
                chunk.modified = chunkData.modified || false;
                chunk.needsMeshUpdate = true;
            }
        }
        
        // Обновление видимых чанков
        world.updateVisibleChunks();
    }
    
    async loadEntities(entitiesData) {
        const entityManager = this.game.entityManager;
        if (!entityManager) return;
        
        // Очистка текущих существ
        entityManager.clearAll();
        
        // Загрузка сохраненных существ
        for (const entityData of entitiesData) {
            try {
                const entity = entityManager.createEntity(entityData.type, entityData.id);
                if (entity) {
                    entity.position.set(entityData.position[0], entityData.position[1]);
                    entity.health = entityData.health || entity.maxHealth;
                    
                    if (entity.loadSaveData && entityData.data) {
                        entity.loadSaveData(entityData.data);
                    }
                }
            } catch (error) {
                console.error('Ошибка загрузки существа:', error);
            }
        }
        
        EventBus.emit('entities:loaded', { count: entitiesData.length });
    }
    
    getSaveSlots() {
        const slots = [];
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('metadata_')) {
                const slot = key.replace('metadata_', '');
                try {
                    const metadata = JSON.parse(localStorage.getItem(key));
                    slots.push({
                        slot,
                        ...metadata
                    });
                } catch (error) {
                    console.error('Ошибка чтения метаданных:', error);
                }
            }
        }
        
        // Сортировка по времени
        slots.sort((a, b) => b.timestamp - a.timestamp);
        
        return slots;
    }
    
    deleteSave(slot) {
        try {
            localStorage.removeItem(`save_${slot}`);
            localStorage.removeItem(`metadata_${slot}`);
            
            EventBus.emit('save:deleted', { slot });
            return true;
        } catch (error) {
            console.error('Ошибка удаления сохранения:', error);
            return false;
        }
    }
    
    cleanupOldSaves() {
        const slots = this.getSaveSlots();
        
        // Удаляем старые автосохранения сверх лимита
        const autoSaves = slots.filter(s => s.slot.startsWith('auto_'));
        if (autoSaves.length > this.maxSaves) {
            const toDelete = autoSaves.slice(this.maxSaves);
            toDelete.forEach(save => {
                this.deleteSave(save.slot);
            });
        }
    }
    
    exportSave(slot) {
        try {
            const key = `save_${slot}`;
            const saveData = localStorage.getItem(key);
            const metadata = localStorage.getItem(`metadata_${slot}`);
            
            if (!saveData) {
                throw new Error('Сохранение не найдено');
            }
            
            const exportData = {
                save: saveData,
                metadata: metadata ? JSON.parse(metadata) : null,
                version: this.saveVersion,
                exportDate: Date.now()
            };
            
            const blob = new Blob([JSON.stringify(exportData, null, 2)], {
                type: 'application/json'
            });
            
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `terraria_save_${slot}_${Date.now()}.json`;
            a.click();
            
            URL.revokeObjectURL(url);
            
            return true;
        } catch (error) {
            console.error('Ошибка экспорта:', error);
            return false;
        }
    }
    
    importSave(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = async (e) => {
                try {
                    const importData = JSON.parse(e.target.result);
                    
                    // Проверка версии
                    if (importData.version !== this.saveVersion) {
                        console.warn(`Версия импорта (${importData.version}) отличается от текущей (${this.saveVersion})`);
                    }
                    
                    // Сохранение в localStorage
                    const slot = `import_${Date.now()}`;
                    localStorage.setItem(`save_${slot}`, importData.save);
                    
                    if (importData.metadata) {
                        localStorage.setItem(`metadata_${slot}`, JSON.stringify(importData.metadata));
                    }
                    
                    EventBus.emit('save:imported', { slot });
                    resolve(slot);
                    
                } catch (error) {
                    reject(new Error('Неверный формат файла сохранения'));
                }
            };
            
            reader.onerror = () => {
                reject(new Error('Ошибка чтения файла'));
            };
            
            reader.readAsText(file);
        });
    }
    
    showMessage(text, type = 'info') {
        EventBus.emit('hud:message', { text, type });
    }
    
    getSaveInfo(slot) {
        try {
            const metadata = localStorage.getItem(`metadata_${slot}`);
            if (!metadata) return null;
            
            return JSON.parse(metadata);
        } catch (error) {
            return null;
        }
    }
    
    backupSaves() {
        try {
            const backup = {};
            
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key.startsWith('save_') || key.startsWith('metadata_')) {
                    backup[key] = localStorage.getItem(key);
                }
            }
            
            const blob = new Blob([JSON.stringify(backup, null, 2)], {
                type: 'application/json'
            });
            
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `terraria_backup_${Date.now()}.json`;
            a.click();
            
            URL.revokeObjectURL(url);
            
            return true;
        } catch (error) {
            console.error('Ошибка создания бэкапа:', error);
            return false;
        }
    }
    
    restoreBackup(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = async (e) => {
                try {
                    const backup = JSON.parse(e.target.result);
                    
                    // Восстановление из бэкапа
                    for (const [key, value] of Object.entries(backup)) {
                        localStorage.setItem(key, value);
                    }
                    
                    EventBus.emit('save:backup_restored');
                    resolve(true);
                    
                } catch (error) {
                    reject(new Error('Неверный формат бэкапа'));
                }
            };
            
            reader.onerror = () => {
                reject(new Error('Ошибка чтения файла'));
            };
            
            reader.readAsText(file);
        });
    }
}