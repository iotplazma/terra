import EventBus from '@/utils/EventBus.js';
import Vector2 from '@/utils/Vector2.js';

export default class Physics {
    constructor() {
        this.gravity = new Vector2(0, 0.6);
        this.airResistance = 0.98;
        this.friction = 0.8;
        this.worldBounds = {
            minX: -Infinity,
            maxX: Infinity,
            minY: -Infinity,
            maxY: Infinity
        };
        
        this.colliders = new Map();
        this.staticBodies = new Set();
        this.dynamicBodies = new Set();
        this.triggers = new Set();
        
        this.spatialGrid = new Map();
        this.cellSize = 64;
        
        this.raycastCache = new Map();
        this.maxRaycastCache = 100;
        
        this.setupEventListeners();
    }

    update(deltaTime) {
        // Обновление динамических тел
        for (const body of this.dynamicBodies) {
            this.updateBody(body, deltaTime);
        }
        
        // Проверка коллизий
        this.checkCollisions();
        
        // Очистка кеша рейкастов
        if (this.raycastCache.size > this.maxRaycastCache) {
            this.raycastCache.clear();
        }
    }

    updateBody(body, deltaTime) {
        if (body.isStatic || !body.enabled) return;
        
        // Сохранение предыдущей позиции
        body.previousPosition = body.position.clone();
        
        // Применение гравитации
        if (body.useGravity && !body.isOnGround) {
            body.velocity.add(Vector2.multiplyScalar(this.gravity, deltaTime * 60));
        }
        
        // Ограничение скорости
        if (body.maxSpeed) {
            const speed = body.velocity.length();
            if (speed > body.maxSpeed) {
                body.velocity.normalize().multiplyScalar(body.maxSpeed);
            }
        }
        
        // Сопротивление воздуха
        if (!body.isOnGround) {
            body.velocity.multiplyScalar(this.airResistance);
        }
        
        // Трение при движении по земле
        if (body.isOnGround && body.velocity.length() > 0) {
            body.velocity.multiplyScalar(this.friction);
            if (body.velocity.length() < 0.1) {
                body.velocity.set(0, 0);
            }
        }
        
        // Интеграция позиции
        body.position.add(Vector2.multiplyScalar(body.velocity, deltaTime * 60));
        
        // Проверка границ мира
        this.checkWorldBounds(body);
        
        // Обновление AABB
        this.updateAABB(body);
        
        // Обновление в spatial grid
        this.updateSpatialGrid(body);
    }

    createBody(options = {}) {
        const body = {
            id: options.id || `body_${Date.now()}_${Math.random()}`,
            position: options.position ? options.position.clone() : new Vector2(0, 0),
            previousPosition: options.position ? options.position.clone() : new Vector2(0, 0),
            velocity: options.velocity ? options.velocity.clone() : new Vector2(0, 0),
            size: options.size ? options.size.clone() : new Vector2(32, 32),
            isStatic: options.isStatic || false,
            useGravity: options.useGravity !== false,
            isOnGround: false,
            enabled: options.enabled !== false,
            maxSpeed: options.maxSpeed || null,
            friction: options.friction || this.friction,
            restitution: options.restitution || 0.2, // Упругость
            mass: options.mass || 1,
            layer: options.layer || 'default',
            mask: options.mask || ['default'],
            isTrigger: options.isTrigger || false,
            userData: options.userData || {},
            
            // AABB
            aabb: {
                min: new Vector2(0, 0),
                max: new Vector2(0, 0)
            },
            
            // Spatial grid cells
            cells: new Set(),
            
            // Методы
            applyForce: (force) => {
                if (!body.isStatic && body.enabled) {
                    body.velocity.add(Vector2.multiplyScalar(force, 1 / body.mass));
                }
            },
            
            setPosition: (x, y) => {
                body.position.set(x, y);
                body.previousPosition.copy(body.position);
                this.updateAABB(body);
                this.updateSpatialGrid(body);
            },
            
            teleport: (x, y) => {
                body.position.set(x, y);
                this.updateAABB(body);
                this.updateSpatialGrid(body);
            }
        };
        
        // Инициализация AABB
        this.updateAABB(body);
        
        // Добавление в соответствующий набор
        this.colliders.set(body.id, body);
        
        if (body.isStatic) {
            this.staticBodies.add(body);
        } else if (body.isTrigger) {
            this.triggers.add(body);
        } else {
            this.dynamicBodies.add(body);
        }
        
        // Добавление в spatial grid
        this.addToSpatialGrid(body);
        
        EventBus.emit('physics:body_created', { id: body.id, body });
        
        return body;
    }

    removeBody(id) {
        const body = this.colliders.get(id);
        if (!body) return false;
        
        // Удаление из spatial grid
        this.removeFromSpatialGrid(body);
        
        // Удаление из наборов
        this.colliders.delete(id);
        this.staticBodies.delete(body);
        this.dynamicBodies.delete(body);
        this.triggers.delete(body);
        
        EventBus.emit('physics:body_removed', { id });
        
        return true;
    }

    updateAABB(body) {
        const halfWidth = body.size.x / 2;
        const halfHeight = body.size.y / 2;
        
        body.aabb.min.set(
            body.position.x - halfWidth,
            body.position.y - halfHeight
        );
        
        body.aabb.max.set(
            body.position.x + halfWidth,
            body.position.y + halfHeight
        );
    }

    checkCollisions() {
        // Проверка динамических тел со статическими и триггерами
        for (const dynamicBody of this.dynamicBodies) {
            if (!dynamicBody.enabled) continue;
            
            // Сброс состояния земли
            dynamicBody.isOnGround = false;
            
            // Получение потенциальных коллайдеров из spatial grid
            const potentialColliders = this.getNearbyBodies(dynamicBody);
            
            for (const otherBody of potentialColliders) {
                if (dynamicBody === otherBody || !otherBody.enabled) continue;
                
                // Проверка слоев
                if (!this.canCollide(dynamicBody, otherBody)) continue;
                
                // Проверка пересечения AABB
                if (!this.aabbIntersect(dynamicBody.aabb, otherBody.aabb)) {
                    continue;
                }
                
                // Точная проверка коллизии
                const collision = this.checkCollision(dynamicBody, otherBody);
                
                if (collision) {
                    if (otherBody.isTrigger) {
                        // Обработка триггера
                        this.handleTrigger(dynamicBody, otherBody, collision);
                    } else {
                        // Разрешение коллизии
                        this.resolveCollision(dynamicBody, otherBody, collision);
                    }
                }
            }
        }
    }

    checkCollision(bodyA, bodyB) {
        // Простая AABB коллизия
        const a = bodyA.aabb;
        const b = bodyB.aabb;
        
        if (a.max.x <= b.min.x || a.min.x >= b.max.x ||
            a.max.y <= b.min.y || a.min.y >= b.max.y) {
            return null;
        }
        
        // Вычисление глубины проникновения
        const overlapX = Math.min(a.max.x - b.min.x, b.max.x - a.min.x);
        const overlapY = Math.min(a.max.y - b.min.y, b.max.y - a.min.y);
        
        // Определение стороны коллизии
        let normal, depth;
        
        if (overlapX < overlapY) {
            depth = overlapX;
            normal = a.max.x - b.min.x < b.max.x - a.min.x ? 
                new Vector2(1, 0) : new Vector2(-1, 0);
        } else {
            depth = overlapY;
            normal = a.max.y - b.min.y < b.max.y - a.min.y ? 
                new Vector2(0, 1) : new Vector2(0, -1);
            
            // Проверка земли
            if (normal.y === 1) {
                bodyA.isOnGround = true;
            }
        }
        
        return {
            bodyA: bodyA,
            bodyB: bodyB,
            normal: normal,
            depth: depth,
            contact: this.getContactPoint(bodyA, bodyB, normal)
        };
    }

    resolveCollision(bodyA, bodyB, collision) {
        // Если одно из тел статическое
        if (bodyB.isStatic) {
            // Сдвиг динамического тела
            bodyA.position.subtract(
                Vector2.multiplyScalar(collision.normal, collision.depth)
            );
            
            // Обновление AABB
            this.updateAABB(bodyA);
            
            // Отражение скорости
            const velocityAlongNormal = bodyA.velocity.dot(collision.normal);
            if (velocityAlongNormal < 0) {
                bodyA.velocity.subtract(
                    Vector2.multiplyScalar(collision.normal, 
                        velocityAlongNormal * (1 + bodyA.restitution))
                );
            }
        } else {
            // Оба тела динамические (упрощенное разрешение)
            const totalMass = bodyA.mass + bodyB.mass;
            const ratioA = bodyB.mass / totalMass;
            const ratioB = bodyA.mass / totalMass;
            
            // Сдвиг тел
            bodyA.position.subtract(
                Vector2.multiplyScalar(collision.normal, collision.depth * ratioA)
            );
            
            bodyB.position.add(
                Vector2.multiplyScalar(collision.normal, collision.depth * ratioB)
            );
            
            // Обновление AABB
            this.updateAABB(bodyA);
            this.updateAABB(bodyB);
            
            // Обмен импульсами (упрощенно)
            const tempVelocity = bodyA.velocity.clone();
            bodyA.velocity = bodyB.velocity.clone();
            bodyB.velocity = tempVelocity;
        }
        
        // Отправка события коллизии
        EventBus.emit('physics:collision', {
            bodyA: bodyA.id,
            bodyB: bodyB.id,
            normal: collision.normal.clone(),
            depth: collision.depth,
            contact: collision.contact.clone()
        });
    }

    handleTrigger(body, trigger, collision) {
        // Проверка входа/выхода из триггера
        const key = `${body.id}_${trigger.id}`;
        const wasInside = this.raycastCache.get(key) || false;
        
        if (!wasInside) {
            // Вход в триггер
            this.raycastCache.set(key, true);
            
            EventBus.emit('physics:trigger_enter', {
                body: body.id,
                trigger: trigger.id,
                position: body.position.clone()
            });
            
            // Вызов callback если есть
            if (trigger.userData.onEnter) {
                trigger.userData.onEnter(body);
            }
        } else {
            // Обновление пребывания в триггере
            EventBus.emit('physics:trigger_stay', {
                body: body.id,
                trigger: trigger.id,
                position: body.position.clone()
            });
            
            if (trigger.userData.onStay) {
                trigger.userData.onStay(body);
            }
        }
        
        // Проверка выхода будет в отдельном проходе
    }

    checkTriggerExits() {
        // Проверка выхода из триггеров
        const toRemove = [];
        
        for (const [key, _] of this.raycastCache) {
            const [bodyId, triggerId] = key.split('_');
            const body = this.colliders.get(bodyId);
            const trigger = this.colliders.get(triggerId);
            
            if (!body || !trigger || 
                !this.aabbIntersect(body.aabb, trigger.aabb)) {
                
                // Выход из триггера
                toRemove.push(key);
                
                EventBus.emit('physics:trigger_exit', {
                    body: bodyId,
                    trigger: triggerId
                });
                
                if (trigger?.userData.onExit) {
                    trigger.userData.onExit(body);
                }
            }
        }
        
        // Удаление из кеша
        toRemove.forEach(key => this.raycastCache.delete(key));
    }

    aabbIntersect(a, b) {
        return !(a.max.x <= b.min.x || a.min.x >= b.max.x ||
                a.max.y <= b.min.y || a.min.y >= b.max.y);
    }

    getContactPoint(bodyA, bodyB, normal) {
        // Упрощенное определение точки контакта
        const centerA = bodyA.position;
        const centerB = bodyB.position;
        
        if (normal.x !== 0) {
            // Горизонтальная коллизия
            const x = normal.x > 0 ? 
                Math.min(bodyA.aabb.max.x, bodyB.aabb.max.x) :
                Math.max(bodyA.aabb.min.x, bodyB.aabb.min.x);
            const y = (centerA.y + centerB.y) / 2;
            return new Vector2(x, y);
        } else {
            // Вертикальная коллизия
            const y = normal.y > 0 ? 
                Math.min(bodyA.aabb.max.y, bodyB.aabb.max.y) :
                Math.max(bodyA.aabb.min.y, bodyB.aabb.min.y);
            const x = (centerA.x + centerB.x) / 2;
            return new Vector2(x, y);
        }
    }

    canCollide(bodyA, bodyB) {
        // Проверка масок слоев
        return bodyA.mask.includes(bodyB.layer) || 
               bodyB.mask.includes(bodyA.layer);
    }

    // Spatial Grid для оптимизации
    getCellKey(x, y) {
        const cellX = Math.floor(x / this.cellSize);
        const cellY = Math.floor(y / this.cellSize);
        return `${cellX},${cellY}`;
    }

    addToSpatialGrid(body) {
        const minCell = this.getCellKey(body.aabb.min.x, body.aabb.min.y);
        const maxCell = this.getCellKey(body.aabb.max.x, body.aabb.max.y);
        
        const [minX, minY] = minCell.split(',').map(Number);
        const [maxX, maxY] = maxCell.split(',').map(Number);
        
        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                const key = `${x},${y}`;
                
                if (!this.spatialGrid.has(key)) {
                    this.spatialGrid.set(key, new Set());
                }
                
                this.spatialGrid.get(key).add(body);
                body.cells.add(key);
            }
        }
    }

    removeFromSpatialGrid(body) {
        for (const cellKey of body.cells) {
            const cell = this.spatialGrid.get(cellKey);
            if (cell) {
                cell.delete(body);
                if (cell.size === 0) {
                    this.spatialGrid.delete(cellKey);
                }
            }
        }
        body.cells.clear();
    }

    updateSpatialGrid(body) {
        this.removeFromSpatialGrid(body);
        this.addToSpatialGrid(body);
    }

    getNearbyBodies(body) {
        const nearby = new Set();
        const checkedCells = new Set();
        
        // Проверяем все клетки, которые занимает тело
        for (const cellKey of body.cells) {
            if (checkedCells.has(cellKey)) continue;
            checkedCells.add(cellKey);
            
            const cell = this.spatialGrid.get(cellKey);
            if (cell) {
                for (const otherBody of cell) {
                    if (otherBody !== body) {
                        nearby.add(otherBody);
                    }
                }
            }
            
            // Также проверяем соседние клетки для больших тел
            const [x, y] = cellKey.split(',').map(Number);
            
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    if (dx === 0 && dy === 0) continue;
                    
                    const neighborKey = `${x + dx},${y + dy}`;
                    if (checkedCells.has(neighborKey)) continue;
                    checkedCells.add(neighborKey);
                    
                    const neighborCell = this.spatialGrid.get(neighborKey);
                    if (neighborCell) {
                        for (const otherBody of neighborCell) {
                            if (otherBody !== body) {
                                nearby.add(otherBody);
                            }
                        }
                    }
                }
            }
        }
        
        return Array.from(nearby);
    }

    // Raycasting
    raycast(start, end, layer = 'default', maxDistance = 1000) {
        const cacheKey = `${start.x},${start.y}-${end.x},${end.y}-${layer}`;
        
        // Проверка кеша
        if (this.raycastCache.has(cacheKey)) {
            return this.raycastCache.get(cacheKey);
        }
        
        const direction = Vector2.subtract(end, start).normalize();
        const length = Math.min(Vector2.distance(start, end), maxDistance);
        
        let closestHit = null;
        let closestDistance = Infinity;
        
        // Простой raycast против AABB
        for (const body of this.colliders.values()) {
            if (!body.enabled || body.isTrigger) continue;
            if (layer && body.layer !== layer) continue;
            
            const hit = this.rayAABBIntersect(start, direction, body.aabb, length);
            if (hit && hit.distance < closestDistance) {
                closestHit = {
                    body: body,
                    point: hit.point,
                    normal: hit.normal,
                    distance: hit.distance
                };
                closestDistance = hit.distance;
            }
        }
        
        // Кеширование результата
        if (closestHit) {
            this.raycastCache.set(cacheKey, closestHit);
            setTimeout(() => {
                this.raycastCache.delete(cacheKey);
            }, 100); // Кеш на 100мс
        }
        
        return closestHit;
    }

    rayAABBIntersect(origin, direction, aabb, maxDistance) {
        // Ray-AABB пересечение (упрощенное)
        let tmin = -Infinity;
        let tmax = Infinity;
        
        const invDir = new Vector2(
            direction.x !== 0 ? 1 / direction.x : Infinity,
            direction.y !== 0 ? 1 / direction.y : Infinity
        );
        
        const bounds = [aabb.min, aabb.max];
        
        for (let i = 0; i < 2; i++) {
            let t1 = (bounds[i].x - origin.x) * invDir.x;
            let t2 = (bounds[1 - i].x - origin.x) * invDir.x;
            
            tmin = Math.max(tmin, Math.min(t1, t2));
            tmax = Math.min(tmax, Math.max(t1, t2));
            
            t1 = (bounds[i].y - origin.y) * invDir.y;
            t2 = (bounds[1 - i].y - origin.y) * invDir.y;
            
            tmin = Math.max(tmin, Math.min(t1, t2));
            tmax = Math.min(tmax, Math.max(t1, t2));
        }
        
        if (tmax < Math.max(0, tmin) || tmin > maxDistance) {
            return null;
        }
        
        const distance = tmin > 0 ? tmin : tmax;
        const point = Vector2.add(origin, Vector2.multiplyScalar(direction, distance));
        
        // Определение нормали (упрощенно)
        const center = Vector2.multiplyScalar(Vector2.add(aabb.min, aabb.max), 0.5);
        const delta = Vector2.subtract(point, center);
        
        const normal = new Vector2(0, 0);
        if (Math.abs(delta.x) > Math.abs(delta.y)) {
            normal.x = Math.sign(delta.x);
        } else {
            normal.y = Math.sign(delta.y);
        }
        
        return { point, normal, distance };
    }

    checkWorldBounds(body) {
        // Проверка границ мира
        if (body.position.x - body.size.x / 2 < this.worldBounds.minX) {
            body.position.x = this.worldBounds.minX + body.size.x / 2;
            body.velocity.x = 0;
        }
        
        if (body.position.x + body.size.x / 2 > this.worldBounds.maxX) {
            body.position.x = this.worldBounds.maxX - body.size.x / 2;
            body.velocity.x = 0;
        }
        
        if (body.position.y - body.size.y / 2 < this.worldBounds.minY) {
            body.position.y = this.worldBounds.minY + body.size.y / 2;
            body.velocity.y = 0;
        }
        
        if (body.position.y + body.size.y / 2 > this.worldBounds.maxY) {
            body.position.y = this.worldBounds.maxY - body.size.y / 2;
            body.velocity.y = 0;
            body.isOnGround = true;
        }
    }

    setWorldBounds(minX, maxX, minY, maxY) {
        this.worldBounds = { minX, maxX, minY, maxY };
    }

    getBody(id) {
        return this.colliders.get(id);
    }

    queryArea(minX, minY, maxX, maxY, layer = null) {
        const results = [];
        const queryAABB = {
            min: new Vector2(minX, minY),
            max: new Vector2(maxX, maxY)
        };
        
        for (const body of this.colliders.values()) {
            if (!body.enabled) continue;
            if (layer && body.layer !== layer) continue;
            
            if (this.aabbIntersect(queryAABB, body.aabb)) {
                results.push(body);
            }
        }
        
        return results;
    }

    setGravity(x, y) {
        this.gravity.set(x, y);
    }

    cleanup() {
        this.colliders.clear();
        this.staticBodies.clear();
        this.dynamicBodies.clear();
        this.triggers.clear();
        this.spatialGrid.clear();
        this.raycastCache.clear();
        
        console.log('🧹 Физический движок очищен');
    }

    setupEventListeners() {
        EventBus.on('physics:create_body', (data) => {
            this.createBody(data);
        });
        
        EventBus.on('physics:remove_body', (data) => {
            this.removeBody(data.id);
        });
        
        EventBus.on('physics:raycast', (data) => {
            const start = new Vector2(data.start.x, data.start.y);
            const end = new Vector2(data.end.x, data.end.y);
            const result = this.raycast(start, end, data.layer, data.maxDistance);
            EventBus.emit('physics:raycast_result', { 
                requestId: data.requestId,
                result 
            });
        });
        
        EventBus.on('physics:query_area', (data) => {
            const results = this.queryArea(
                data.minX, data.minY, 
                data.maxX, data.maxY, 
                data.layer
            );
            EventBus.emit('physics:query_result', {
                requestId: data.requestId,
                results: results.map(b => b.id)
            });
        });
    }
}