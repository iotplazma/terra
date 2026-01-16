import EventBus from '@/utils/EventBus.js';
import Vector2 from '@/utils/Vector2.js';

export default class LightingSystem {
    constructor(world) {
        this.world = world;
        this.lightMap = new Map();
        this.lightSources = new Map();
        this.ambientLight = 0.3;
        this.dayCycle = {
            time: 0,
            length: 24000, // 20 минут в тиках
            dayTime: 6000,
            nightTime: 18000,
            isDay: true,
            sunIntensity: 1.0,
            moonIntensity: 0.2
        };
        
        this.colors = {
            daySky: [135, 206, 235],
            nightSky: [10, 10, 30],
            sunrise: [255, 165, 0],
            sunset: [255, 69, 0],
            dayAmbient: [255, 255, 255],
            nightAmbient: [100, 100, 150]
        };
        
        this.dynamicLights = new Set();
        this.cachedLight = new Map();
        this.maxLightLevel = 15;
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        EventBus.on('world:block_changed', (data) => {
            this.updateLightAt(data.x, data.y);
        });
        
        EventBus.on('time:update', (data) => {
            this.updateDayCycle(data.deltaTime);
        });
    }
    
    update(deltaTime) {
        // Обновление динамических источников света
        for (const light of this.dynamicLights) {
            if (light.update) {
                light.update(deltaTime);
                this.updateLightSource(light);
            }
        }
    }
    
    updateDayCycle(deltaTime) {
        this.dayCycle.time += deltaTime * 1000; // Конвертация в тики
        
        // Сброс времени
        if (this.dayCycle.time >= this.dayCycle.length) {
            this.dayCycle.time -= this.dayCycle.length;
        }
        
        // Определение дня/ночи
        this.dayCycle.isDay = 
            this.dayCycle.time >= this.dayCycle.dayTime && 
            this.dayCycle.time < this.dayCycle.nightTime;
        
        // Расчет интенсивности солнца/луны
        const progress = this.dayCycle.time / this.dayCycle.length;
        const angle = progress * Math.PI * 2;
        
        this.dayCycle.sunIntensity = Math.max(0, Math.sin(angle));
        this.dayCycle.moonIntensity = Math.max(0, -Math.sin(angle));
        
        // Обновление цвета неба
        this.updateSkyColor();
        
        // Генерация событий
        if (Math.abs(this.dayCycle.time - 0) < deltaTime * 1000) {
            EventBus.emit('time:midnight');
        } else if (Math.abs(this.dayCycle.time - 6000) < deltaTime * 1000) {
            EventBus.emit('time:dawn');
        } else if (Math.abs(this.dayCycle.time - 12000) < deltaTime * 1000) {
            EventBus.emit('time:noon');
        } else if (Math.abs(this.dayCycle.time - 18000) < deltaTime * 1000) {
            EventBus.emit('time:dusk');
        }
    }
    
    updateSkyColor() {
        const time = this.dayCycle.time;
        let skyColor = [0, 0, 0];
        
        if (time < 6000) { // Рассвет
            const t = time / 6000;
            skyColor = this.lerpColor(this.colors.nightSky, this.colors.sunrise, t);
        } else if (time < 12000) { // Утро -> День
            const t = (time - 6000) / 6000;
            skyColor = this.lerpColor(this.colors.sunrise, this.colors.daySky, t);
        } else if (time < 18000) { // День -> Закат
            const t = (time - 12000) / 6000;
            skyColor = this.lerpColor(this.colors.daySky, this.colors.sunset, t);
        } else { // Ночь
            const t = (time - 18000) / 6000;
            skyColor = this.lerpColor(this.colors.sunset, this.colors.nightSky, t);
        }
        
        this.skyColor = skyColor;
        EventBus.emit('lighting:sky_color', { color: skyColor });
    }
    
    lerpColor(color1, color2, t) {
        return [
            Math.round(color1[0] + (color2[0] - color1[0]) * t),
            Math.round(color1[1] + (color2[1] - color1[1]) * t),
            Math.round(color1[2] + (color2[2] - color1[2]) * t)
        ];
    }
    
    addLightSource(id, x, y, options = {}) {
        const light = {
            id,
            x,
            y,
            radius: options.radius || 8,
            intensity: options.intensity || 1.0,
            color: options.color || [255, 255, 255],
            flicker: options.flicker || false,
            flickerAmount: options.flickerAmount || 0.1,
            dynamic: options.dynamic || false,
            enabled: true
        };
        
        this.lightSources.set(id, light);
        
        if (light.dynamic) {
            this.dynamicLights.add(light);
        }
        
        this.updateLightSource(light);
        return light;
    }
    
    removeLightSource(id) {
        const light = this.lightSources.get(id);
        if (!light) return;
        
        this.lightSources.delete(id);
        this.dynamicLights.delete(light);
        this.removeLight(light.x, light.y, light.radius);
    }
    
    updateLightSource(light) {
        if (!light.enabled) return;
        
        // Эффект мерцания
        if (light.flicker) {
            const flicker = Math.sin(Date.now() * 0.01) * light.flickerAmount;
            light.currentIntensity = light.intensity * (1 + flicker);
        } else {
            light.currentIntensity = light.intensity;
        }
        
        this.calculateLight(light.x, light.y, light.radius, light.currentIntensity, light.color);
    }
    
    calculateLight(x, y, radius, intensity, color = [255, 255, 255]) {
        const centerX = Math.floor(x);
        const centerY = Math.floor(y);
        const radiusSquared = radius * radius;
        
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const distanceSquared = dx * dx + dy * dy;
                if (distanceSquared > radiusSquared) continue;
                
                const worldX = centerX + dx;
                const worldY = centerY + dy;
                
                // Проверка препятствий
                if (this.isBlockTransparent(worldX, worldY)) {
                    const distance = Math.sqrt(distanceSquared);
                    const attenuation = 1.0 - (distance / radius);
                    const lightValue = Math.max(0, intensity * attenuation);
                    
                    this.addLightToCell(worldX, worldY, lightValue, color);
                }
            }
        }
    }
    
    isBlockTransparent(x, y) {
        const block = this.world.getBlock(x, y);
        if (!block) return true;
        
        // Проверка прозрачности блока
        return block.transparent === true || block.type === 0; // Воздух или прозрачный блок
    }
    
    addLightToCell(x, y, intensity, color) {
        const key = `${x},${y}`;
        let currentLight = this.lightMap.get(key) || {
            total: 0,
            color: [0, 0, 0]
        };
        
        // Добавление света
        currentLight.total = Math.min(this.maxLightLevel, currentLight.total + intensity);
        
        // Смешивание цветов
        const weight = intensity / currentLight.total;
        currentLight.color = [
            Math.round(currentLight.color[0] * (1 - weight) + color[0] * weight),
            Math.round(currentLight.color[1] * (1 - weight) + color[1] * weight),
            Math.round(currentLight.color[2] * (1 - weight) + color[2] * weight)
        ];
        
        this.lightMap.set(key, currentLight);
    }
    
    removeLight(x, y, radius) {
        const centerX = Math.floor(x);
        const centerY = Math.floor(y);
        
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const worldX = centerX + dx;
                const worldY = centerY + dy;
                const key = `${worldX},${worldY}`;
                
                this.lightMap.delete(key);
            }
        }
        
        // Пересчет оставшихся источников света
        this.recalculateAllLights();
    }
    
    recalculateAllLights() {
        // Очистка карты света
        this.lightMap.clear();
        
        // Пересчет всех источников
        for (const light of this.lightSources.values()) {
            if (light.enabled) {
                this.calculateLight(
                    light.x, 
                    light.y, 
                    light.radius, 
                    light.intensity, 
                    light.color
                );
            }
        }
        
        // Добавление солнечного/лунного света
        this.calculateSkyLight();
    }
    
    calculateSkyLight() {
        const sunIntensity = this.dayCycle.sunIntensity * 0.8;
        const moonIntensity = this.dayCycle.moonIntensity * 0.4;
        const skyLight = Math.max(sunIntensity, moonIntensity);
        
        // Для каждого видимого блока добавляем небесный свет
        const visibleChunks = this.world.getVisibleChunks();
        
        for (const chunk of visibleChunks) {
            for (let y = 0; y < chunk.height; y++) {
                for (let x = 0; x < chunk.width; x++) {
                    const worldX = chunk.x * chunk.width + x;
                    const worldY = chunk.y * chunk.height + y;
                    
                    // Только для блоков под открытым небом
                    if (this.isUnderOpenSky(worldX, worldY)) {
                        const key = `${worldX},${worldY}`;
                        let cellLight = this.lightMap.get(key) || {
                            total: 0,
                            color: [255, 255, 255]
                        };
                        
                        cellLight.total = Math.min(
                            this.maxLightLevel,
                            cellLight.total + skyLight
                        );
                        
                        this.lightMap.set(key, cellLight);
                    }
                }
            }
        }
    }
    
    isUnderOpenSky(x, y) {
        // Проверяем, есть ли над блоком только прозрачные блоки
        for (let checkY = y - 1; checkY >= 0; checkY--) {
            const block = this.world.getBlock(x, checkY);
            if (!block || !block.transparent) {
                return false;
            }
        }
        return true;
    }
    
    getLightAt(x, y) {
        const key = `${Math.floor(x)},${Math.floor(y)}`;
        const light = this.lightMap.get(key);
        
        if (!light) {
            return {
                level: this.ambientLight,
                color: this.dayCycle.isDay ? 
                    this.colors.dayAmbient : this.colors.nightAmbient
            };
        }
        
        // Нормализация уровня света
        const normalizedLevel = Math.min(1, light.total / this.maxLightLevel);
        const finalLevel = Math.max(this.ambientLight, normalizedLevel);
        
        return {
            level: finalLevel,
            color: light.color || [255, 255, 255]
        };
    }
    
    updateLightAt(x, y) {
        // Удаляем старый свет в этой позиции
        const keysToRemove = [];
        for (const [key, _] of this.lightMap) {
            const [lx, ly] = key.split(',').map(Number);
            if (Math.abs(lx - x) <= 16 && Math.abs(ly - y) <= 16) {
                keysToRemove.push(key);
            }
        }
        
        keysToRemove.forEach(key => this.lightMap.delete(key));
        
        // Пересчитываем ближайшие источники
        for (const light of this.lightSources.values()) {
            if (Math.abs(light.x - x) <= light.radius + 5 && 
                Math.abs(light.y - y) <= light.radius + 5) {
                this.updateLightSource(light);
            }
        }
    }
    
    getTimeOfDay() {
        const hour = (this.dayCycle.time / 1000) % 24;
        return {
            hour: Math.floor(hour),
            minute: Math.floor((hour % 1) * 60),
            isDay: this.dayCycle.isDay,
            sunIntensity: this.dayCycle.sunIntensity,
            moonIntensity: this.dayCycle.moonIntensity
        };
    }
    
    setTime(time) {
        this.dayCycle.time = time % this.dayCycle.length;
        this.updateDayCycle(0);
        this.recalculateAllLights();
    }
    
    getSkyColor() {
        return this.skyColor || this.colors.daySky;
    }
    
    createTorch(x, y) {
        return this.addLightSource(`torch_${x}_${y}`, x, y, {
            radius: 10,
            intensity: 0.8,
            color: [255, 200, 100],
            flicker: true,
            flickerAmount: 0.2
        });
    }
    
    createCampfire(x, y) {
        return this.addLightSource(`campfire_${x}_${y}`, x, y, {
            radius: 15,
            intensity: 1.0,
            color: [255, 150, 50],
            flicker: true,
            flickerAmount: 0.3,
            dynamic: true
        });
    }
    
    createGlowstone(x, y) {
        return this.addLightSource(`glowstone_${x}_${y}`, x, y, {
            radius: 12,
            intensity: 0.9,
            color: [255, 255, 200],
            flicker: false
        });
    }
    
    renderDebug(ctx, camera) {
        // Рендер карты света для отладки
        ctx.save();
        ctx.globalAlpha = 0.3;
        
        for (const [key, light] of this.lightMap) {
            const [x, y] = key.split(',').map(Number);
            const screenX = x * 16 - camera.x;
            const screenY = y * 16 - camera.y;
            
            const intensity = light.total / this.maxLightLevel;
            ctx.fillStyle = `rgba(255, 255, 100, ${intensity * 0.5})`;
            ctx.fillRect(screenX, screenY, 16, 16);
        }
        
        // Рендер источников света
        ctx.globalAlpha = 1.0;
        for (const light of this.lightSources.values()) {
            const screenX = light.x * 16 - camera.x;
            const screenY = light.y * 16 - camera.y;
            
            ctx.fillStyle = `rgb(${light.color.join(',')})`;
            ctx.beginPath();
            ctx.arc(screenX + 8, screenY + 8, 4, 0, Math.PI * 2);
            ctx.fill();
            
            // Радиус света
            ctx.strokeStyle = `rgba(${light.color.join(',')}, 0.3)`;
            ctx.beginPath();
            ctx.arc(screenX + 8, screenY + 8, light.radius * 16, 0, Math.PI * 2);
            ctx.stroke();
        }
        
        ctx.restore();
    }
}