class EventBus {
    constructor() {
        this.events = new Map();
        this.onceEvents = new Map();
    }

    on(event, callback) {
        if (!this.events.has(event)) {
            this.events.set(event, []);
        }
        this.events.get(event).push(callback);
    }

    once(event, callback) {
        if (!this.onceEvents.has(event)) {
            this.onceEvents.set(event, []);
        }
        this.onceEvents.get(event).push(callback);
    }

    off(event, callback) {
        if (this.events.has(event)) {
            const callbacks = this.events.get(event);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
        
        if (this.onceEvents.has(event)) {
            const callbacks = this.onceEvents.get(event);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    emit(event, data = null) {
        // Обычные события
        if (this.events.has(event)) {
            const callbacks = this.events.get(event).slice();
            for (const callback of callbacks) {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Ошибка в обработчике события ${event}:`, error);
                }
            }
        }
        
        // Одноразовые события
        if (this.onceEvents.has(event)) {
            const callbacks = this.onceEvents.get(event).slice();
            this.onceEvents.delete(event);
            
            for (const callback of callbacks) {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Ошибка в одноразовом обработчике события ${event}:`, error);
                }
            }
        }
    }

    clear(event = null) {
        if (event) {
            this.events.delete(event);
            this.onceEvents.delete(event);
        } else {
            this.events.clear();
            this.onceEvents.clear();
        }
    }

    has(event) {
        return this.events.has(event) || this.onceEvents.has(event);
    }

    count(event) {
        let count = 0;
        if (this.events.has(event)) {
            count += this.events.get(event).length;
        }
        if (this.onceEvents.has(event)) {
            count += this.onceEvents.get(event).length;
        }
        return count;
    }
}

// Экспортируем синглтон
export default new EventBus();