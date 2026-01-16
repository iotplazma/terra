import EventBus from '@/utils/EventBus.js';

export default class AssetManager {
    constructor() {
        this.assets = new Map();
        this.loading = new Map();
        this.queues = {
            critical: [],
            high: [],
            normal: [],
            low: []
        };
        
        this.progress = {
            total: 0,
            loaded: 0,
            percent: 0
        };
        
        this.cache = new Map();
        this.maxCacheSize = 100;
        
        this.setupEventListeners();
    }

    async init() {
        console.log('📦 Инициализация менеджера ресурсов...');
        
        // Создание кеша в IndexedDB
        await this.setupCache();
        
        console.log('✅ Менеджер ресурсов готов');
    }

    async setupCache() {
        // Проверка поддержки IndexedDB
        if (!window.indexedDB) {
            console.warn('IndexedDB не поддерживается, используется Memory Cache');
            return;
        }
        
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('GameAssets', 1);
            
            request.onerror = () => {
                console.warn('Не удалось открыть IndexedDB');
                resolve();
            };
            
            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log('✅ IndexedDB кеш подключен');
                resolve();
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('assets')) {
                    const store = db.createObjectStore('assets', { keyPath: 'url' });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                }
            };
        });
    }

    addToQueue(asset, priority = 'normal') {
        if (!this.queues[priority]) {
            priority = 'normal';
        }
        
        this.queues[priority].push(asset);
        this.progress.total++;
    }

    async loadManifest(manifest) {
        console.log(`📋 Загрузка манифеста (${manifest.length} ресурсов)...`);
        
        // Сортировка по приоритету
        manifest.forEach(asset => {
            this.addToQueue(asset, asset.priority);
        });
        
        // Загрузка в порядке приоритета
        const priorities = ['critical', 'high', 'normal', 'low'];
        
        for (const priority of priorities) {
            await this.loadQueue(priority);
        }
        
        EventBus.emit('assets:loaded');
    }

    async loadQueue(priority) {
        const queue = this.queues[priority];
        if (!queue.length) return;
        
        console.log(`🔄 Загрузка ${priority} приоритета (${queue.length} ресурсов)...`);
        
        const promises = queue.map(asset => this.loadSingle(asset));
        await Promise.all(promises);
        
        this.queues[priority] = [];
    }

    async loadSingle(asset) {
        // Проверка кеша
        const cached = await this.getFromCache(asset.url);
        if (cached) {
            this.assets.set(asset.id, cached);
            this.updateProgress();
            return cached;
        }
        
        // Загрузка с сервера
        try {
            let data;
            
            switch (asset.type) {
                case 'image':
                    data = await this.loadImage(asset.url);
                    break;
                    
                case 'json':
                    data = await this.loadJSON(asset.url);
                    break;
                    
                case 'audio':
                    data = await this.loadAudio(asset.url);
                    break;
                    
                case 'font':
                    data = await this.loadFont(asset.url, asset.name);
                    break;
                    
                case 'text':
                    data = await this.loadText(asset.url);
                    break;
                    
                default:
                    console.warn(`Неизвестный тип ресурса: ${asset.type}`);
                    return null;
            }
            
            // Сохранение в кеш (только для JSON и текстовых файлов)
            if (asset.type === 'json' || asset.type === 'text') {
                await this.saveToCache(asset.url, data);
            }
            
            // Сохранение в память
            this.assets.set(asset.id, data);
            
            // Обновление прогресса
            this.updateProgress();
            
            // Отправка события
            EventBus.emit('asset:loaded', {
                id: asset.id,
                type: asset.type,
                data: data
            });
            
            return data;
            
        } catch (error) {
            console.error(`Ошибка загрузки ресурса ${asset.url}:`, error);
            
            // Использование fallback
            const fallback = this.getFallback(asset.type);
            this.assets.set(asset.id, fallback);
            
            EventBus.emit('asset:error', {
                id: asset.id,
                url: asset.url,
                error: error.message
            });
            
            return fallback;
        }
    }

    async loadImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            
            img.onload = () => {
                // Создание текстуры из изображения
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                
                resolve({
                    image: img,
                    canvas: canvas,
                    width: img.width,
                    height: img.height,
                    data: ctx.getImageData(0, 0, img.width, img.height)
                });
            };
            
            img.onerror = reject;
            img.src = url;
        });
    }

    async loadJSON(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return await response.json();
    }

    async loadAudio(url) {
        return new Promise((resolve, reject) => {
            const audio = new Audio();
            audio.preload = 'auto';
            
            audio.oncanplaythrough = () => {
                resolve({
                    audio: audio,
                    duration: audio.duration,
                    canPlay: true
                });
            };
            
            audio.onerror = reject;
            audio.src = url;
            audio.load();
        });
    }

    async loadFont(url, fontName) {
        return new Promise((resolve, reject) => {
            const font = new FontFace(fontName, `url(${url})`);
            
            font.load().then(loadedFont => {
                document.fonts.add(loadedFont);
                resolve({
                    font: loadedFont,
                    name: fontName,
                    loaded: true
                });
            }).catch(reject);
        });
    }

    async loadText(url) {
        const response = await fetch(url);
        return await response.text();
    }

    get(id) {
        return this.assets.get(id);
    }

    has(id) {
        return this.assets.has(id);
    }

    set(id, asset) {
        this.assets.set(id, asset);
    }

    updateProgress() {
        this.progress.loaded++;
        this.progress.percent = this.progress.total > 0 ? 
            (this.progress.loaded / this.progress.total) : 0;
        
        EventBus.emit('assets:progress', { ...this.progress });
    }

    async getFromCache(url) {
        if (!this.db) return null;
        
        return new Promise((resolve) => {
            const transaction = this.db.transaction(['assets'], 'readonly');
            const store = transaction.objectStore('assets');
            const request = store.get(url);
            
            request.onsuccess = (event) => {
                const result = event.target.result;
                if (result && Date.now() - result.timestamp < 7 * 24 * 60 * 60 * 1000) {
                    resolve(result.data);
                } else {
                    resolve(null);
                }
            };
            
            request.onerror = () => resolve(null);
        });
    }

    async saveToCache(url, data) {
        if (!this.db) return;
        
        return new Promise((resolve) => {
            const transaction = this.db.transaction(['assets'], 'readwrite');
            const store = transaction.objectStore('assets');
            
            const cacheItem = {
                url: url,
                data: data,
                timestamp: Date.now()
            };
            
            const request = store.put(cacheItem);
            
            request.onsuccess = () => resolve();
            request.onerror = () => resolve(); // Игнорируем ошибки кеша
        });
    }

    getFallback(type) {
        switch (type) {
            case 'image':
                return this.createFallbackImage();
                
            case 'json':
                return {};
                
            case 'audio':
                return { audio: null, canPlay: false };
                
            case 'font':
                return { font: null, name: 'Arial', loaded: false };
                
            default:
                return null;
        }
    }

    createFallbackImage() {
        const canvas = document.createElement('canvas');
        canvas.width = 16;
        canvas.height = 16;
        
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ff00ff';
        ctx.fillRect(0, 0, 16, 16);
        ctx.fillStyle = '#000000';
        ctx.fillText('?', 4, 12);
        
        const img = new Image();
        img.src = canvas.toDataURL();
        
        return {
            image: img,
            canvas: canvas,
            width: 16,
            height: 16,
            data: ctx.getImageData(0, 0, 16, 16)
        };
    }

    preload(ids) {
        // Предзагрузка ресурсов в фоне
        ids.forEach(id => {
            if (!this.assets.has(id) && !this.loading.has(id)) {
                this.loadInBackground(id);
            }
        });
    }

    async loadInBackground(id) {
        // Фоновая загрузка низкого приоритета
        console.log(`⚡ Фоновая загрузка: ${id}`);
        this.loading.set(id, true);
        
        // Здесь можно реализовать логику фоновой загрузки
        // Например, через Service Worker или lazy loading
        
        this.loading.delete(id);
    }

    clearCache() {
        this.cache.clear();
        this.assets.clear();
        
        if (this.db) {
            const request = indexedDB.deleteDatabase('GameAssets');
            request.onsuccess = () => {
                console.log('🧹 Кеш очищен');
            };
        }
        
        this.progress = { total: 0, loaded: 0, percent: 0 };
    }

    getStats() {
        return {
            total: this.progress.total,
            loaded: this.progress.loaded,
            percent: this.progress.percent,
            cached: this.assets.size,
            memory: this.getMemoryUsage()
        };
    }

    getMemoryUsage() {
        // Примерная оценка использования памяти
        let totalBytes = 0;
        
        for (const asset of this.assets.values()) {
            if (asset.image) {
                totalBytes += asset.width * asset.height * 4; // RGBA
            }
            if (asset.audio) {
                totalBytes += 1024 * 100; // Примерно 100KB на аудио
            }
        }
        
        return {
            bytes: totalBytes,
            mb: (totalBytes / (1024 * 1024)).toFixed(2)
        };
    }

    setupEventListeners() {
        EventBus.on('assets:preload', (ids) => {
            this.preload(ids);
        });
        
        EventBus.on('assets:clear', () => {
            this.clearCache();
        });
        
        EventBus.on('assets:stats', () => {
            const stats = this.getStats();
            EventBus.emit('assets:stats_result', stats);
        });
    }
}