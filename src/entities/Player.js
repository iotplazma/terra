import EventBus from '@/utils/EventBus.js';
import Vector2 from '@/utils/Vector2.js';

export default class Player {
  constructor() {
    this.position = new Vector2(0, 0);
    this.velocity = new Vector2(0, 0);
    this.size = new Vector2(16, 32);
    
    this.stats = {
      health: 100,
      maxHealth: 100,
      stamina: 100,
      maxStamina: 100,
      hunger: 100,
      maxHunger: 100,
      oxygen: 100,
      maxOxygen: 100,
      level: 1,
      experience: 0,
      nextLevelExp: 100
    };
    
    this.inventory = {
      hotbar: new Array(9).fill(null),
      main: new Array(27).fill(null),
      armor: new Array(4).fill(null),
      crafting: new Array(4).fill(null),
      cursor: null
    };
    
    this.equipment = {
      hand: null,
      helmet: null,
      chestplate: null,
      leggings: null,
      boots: null
    };
    
    this.skills = {
      mining: 1,
      combat: 1,
      building: 1,
      crafting: 1
    };
    
    this.state = {
      isOnGround: false,
      isJumping: false,
      isCrouching: false,
      isSprinting: false,
      isSwimming: false,
      isClimbing: false,
      isFlying: false,
      isDead: false
    };
    
    this.animation = {
      current: 'idle',
      frame: 0,
      timer: 0,
      direction: 1 // 1 = right, -1 = left
    };
    
    this.input = {
      move: new Vector2(0, 0),
      jump: false,
      interact: false,
      attack: false,
      build: false
    };
    
    this.physics = {
      speed: 5,
      jumpForce: 12,
      gravity: 0.6,
      friction: 0.8,
      airControl: 0.5,
      maxFallSpeed: 20
    };
    
    this.lastSaveTime = Date.now();
    this.saveInterval = 30000; // 30 секунд
    
    this.setupEventListeners();
  }

  setupEventListeners() {
    EventBus.on('input:move', (data) => {
      this.input.move.set(data.x, data.y);
    });
    
    EventBus.on('input:jump', () => {
      if (this.state.isOnGround && this.stats.stamina > 10) {
        this.velocity.y = -this.physics.jumpForce;
        this.state.isOnGround = false;
        this.state.isJumping = true;
        this.stats.stamina -= 10;
      }
    });
    
    EventBus.on('input:interact', () => {
      this.interactWithBlock();
    });
    
    EventBus.on('input:attack', () => {
      this.attack();
    });
    
    EventBus.on('input:build', (blockId) => {
      this.placeBlock(blockId);
    });
    
    EventBus.on('inventory:changed', () => {
      this.saveToStorage();
    });
    
    // Автосохранение
    setInterval(() => this.saveToStorage(), this.saveInterval);
  }

  update(deltaTime, world) {
    if (this.state.isDead) return;
    
    // Обновление ввода
    this.handleMovement(deltaTime);
    
    // Обновление физики
    this.updatePhysics(deltaTime, world);
    
    // Обновление состояния
    this.updateState(deltaTime);
    
    // Обновление анимации
    this.updateAnimation(deltaTime);
    
    // Проверка смерти
    if (this.stats.health <= 0) {
      this.die();
    }
    
    // Отправка события обновления игрока
    EventBus.emit('player:updated', {
      position: this.position.clone(),
      stats: { ...this.stats },
      state: { ...this.state }
    });
  }

  handleMovement(deltaTime) {
    const moveSpeed = this.state.isSprinting ? 
      this.physics.speed * 1.5 : this.physics.speed;
    
    // Контроль в воздухе
    const control = this.state.isOnGround ? 1 : this.physics.airControl;
    
    // Движение по горизонтали
    this.velocity.x = this.input.move.x * moveSpeed * control;
    
    // Обновление направления
    if (this.input.move.x !== 0) {
      this.animation.direction = Math.sign(this.input.move.x);
    }
    
    // Гравитация
    if (!this.state.isOnGround && !this.state.isFlying) {
      this.velocity.y += this.physics.gravity;
      this.velocity.y = Math.min(this.velocity.y, this.physics.maxFallSpeed);
    }
    
    // Трение при движении по земле
    if (this.state.isOnGround && this.input.move.x === 0) {
      this.velocity.x *= this.physics.friction;
      if (Math.abs(this.velocity.x) < 0.1) {
        this.velocity.x = 0;
      }
    }
  }

  updatePhysics(deltaTime, world) {
    // Предварительная позиция
    const newPos = this.position.clone().add(
      this.velocity.clone().multiplyScalar(deltaTime * 60)
    );
    
    // Проверка коллизий с блоками
    this.checkCollisions(newPos, world);
    
    // Обновление позиции
    this.position.copy(newPos);
  }

  checkCollisions(newPos, world) {
    const corners = [
      new Vector2(newPos.x, newPos.y), // top-left
      new Vector2(newPos.x + this.size.x, newPos.y), // top-right
      new Vector2(newPos.x, newPos.y + this.size.y), // bottom-left
      new Vector2(newPos.x + this.size.x, newPos.y + this.size.y) // bottom-right
    ];
    
    let collision = false;
    this.state.isOnGround = false;
    
    for (const corner of corners) {
      const blockX = Math.floor(corner.x / 16);
      const blockY = Math.floor(corner.y / 16);
      
      const blockId = world.getBlock(blockX, blockY);
      if (blockId > 0) { // Solid block
        collision = true;
        
        // Определение стороны столкновения
        const dx = corner.x - blockX * 16;
        const dy = corner.y - blockY * 16;
        
        if (Math.abs(dx) < Math.abs(dy)) {
          // Горизонтальное столкновение
          if (this.velocity.x > 0) {
            newPos.x = blockX * 16 - this.size.x;
          } else {
            newPos.x = (blockX + 1) * 16;
          }
          this.velocity.x = 0;
        } else {
          // Вертикальное столкновение
          if (this.velocity.y > 0) {
            newPos.y = blockY * 16 - this.size.y;
            this.state.isOnGround = true;
            this.state.isJumping = false;
          } else {
            newPos.y = (blockY + 1) * 16;
          }
          this.velocity.y = 0;
        }
      }
    }
  }

  updateState(deltaTime) {
    // Обновление выносливости
    if (this.state.isOnGround) {
      this.stats.stamina = Math.min(
        this.stats.maxStamina,
        this.stats.stamina + 20 * deltaTime
      );
    }
    
    if (this.state.isSprinting) {
      this.stats.stamina -= 30 * deltaTime;
      if (this.stats.stamina <= 0) {
        this.state.isSprinting = false;
      }
    }
    
    // Обновление голода
    if (this.stats.hunger > 0) {
      this.stats.hunger -= 0.5 * deltaTime;
      if (this.stats.hunger < 20 && this.stats.health < this.stats.maxHealth) {
        this.stats.health += 1 * deltaTime;
      }
    } else {
      this.stats.health -= 1 * deltaTime;
    }
    
    // Обновление здоровья при низком голоде
    if (this.stats.hunger <= 0 && this.stats.health > 0) {
      this.stats.health -= 2 * deltaTime;
    }
    
    // Восстановление здоровья
    if (this.stats.hunger > 80 && this.stats.health < this.stats.maxHealth) {
      this.stats.health += 0.5 * deltaTime;
    }
  }

  updateAnimation(deltaTime) {
    this.animation.timer += deltaTime;
    
    // Определение анимации по состоянию
    let newAnimation = 'idle';
    
    if (!this.state.isOnGround) {
      newAnimation = this.velocity.y < 0 ? 'jump' : 'fall';
    } else if (Math.abs(this.velocity.x) > 0.1) {
      newAnimation = this.state.isSprinting ? 'run' : 'walk';
    } else if (this.state.isCrouching) {
      newAnimation = 'crouch';
    }
    
    // Смена анимации
    if (newAnimation !== this.animation.current) {
      this.animation.current = newAnimation;
      this.animation.frame = 0;
      this.animation.timer = 0;
    }
    
    // Обновление кадра анимации
    const frameTimes = {
      idle: 0.2,
      walk: 0.1,
      run: 0.08,
      jump: 0.15,
      fall: 0.15,
      crouch: 0.3
    };
    
    const frameTime = frameTimes[this.animation.current] || 0.1;
    
    if (this.animation.timer >= frameTime) {
      this.animation.frame = (this.animation.frame + 1) % 4;
      this.animation.timer = 0;
    }
  }

  interactWithBlock() {
    // Взаимодействие с блоками (двери, сундуки и т.д.)
    EventBus.emit('player:interact', {
      position: this.position.clone(),
      direction: this.animation.direction
    });
  }

  attack() {
    EventBus.emit('player:attack', {
      position: this.position.clone(),
      direction: this.animation.direction,
      damage: this.calculateDamage()
    });
  }

  calculateDamage() {
    let damage = 1;
    
    // Модификатор оружия
    if (this.equipment.hand) {
      damage = this.equipment.hand.damage || 1;
    }
    
    // Модификатор навыка
    damage *= (1 + this.skills.combat * 0.1);
    
    return Math.floor(damage);
  }

  placeBlock(blockId) {
    if (!this.hasBlock(blockId)) return;
    
    EventBus.emit('player:place', {
      position: this.position.clone(),
      direction: this.animation.direction,
      blockId
    });
    
    // Удаление блока из инвентаря
    this.removeFromInventory(blockId);
  }

  hasBlock(blockId) {
    // Поиск блока в инвентаре
    for (const slot of this.inventory.hotbar) {
      if (slot && slot.id === blockId && slot.count > 0) {
        return true;
      }
    }
    
    for (const slot of this.inventory.main) {
      if (slot && slot.id === blockId && slot.count > 0) {
        return true;
      }
    }
    
    return false;
  }

  removeFromInventory(blockId) {
    // Удаление одного блока из инвентаря
    for (let i = 0; i < this.inventory.hotbar.length; i++) {
      const slot = this.inventory.hotbar[i];
      if (slot && slot.id === blockId && slot.count > 0) {
        slot.count--;
        if (slot.count <= 0) {
          this.inventory.hotbar[i] = null;
        }
        EventBus.emit('inventory:changed');
        return true;
      }
    }
    
    return false;
  }

  addExperience(amount) {
    this.stats.experience += amount;
    
    // Проверка уровня
    while (this.stats.experience >= this.stats.nextLevelExp) {
      this.stats.experience -= this.stats.nextLevelExp;
      this.levelUp();
    }
    
    EventBus.emit('player:exp', { amount, total: this.stats.experience });
  }

  levelUp() {
    this.stats.level++;
    this.stats.nextLevelExp = Math.floor(100 * Math.pow(1.5, this.stats.level - 1));
    
    // Увеличение характеристик
    this.stats.maxHealth += 5;
    this.stats.health = this.stats.maxHealth;
    
    EventBus.emit('player:levelup', { level: this.stats.level });
  }

  takeDamage(amount, source) {
    if (this.state.isDead) return;
    
    // Расчет брони
    const armorReduction = this.calculateArmorReduction();
    const finalDamage = Math.max(1, amount - armorReduction);
    
    this.stats.health -= finalDamage;
    
    EventBus.emit('player:damage', {
      amount: finalDamage,
      source,
      health: this.stats.health
    });
    
    if (this.stats.health <= 0) {
      this.die();
    }
  }

  calculateArmorReduction() {
    let reduction = 0;
    
    for (const item of Object.values(this.equipment)) {
      if (item && item.armor) {
        reduction += item.armor;
      }
    }
    
    // Ограничение снижения урона
    return Math.min(reduction, 20);
  }

  die() {
    this.state.isDead = true;
    this.velocity.set(0, 0);
    
    EventBus.emit('player:death', {
      position: this.position.clone(),
      level: this.stats.level,
      experience: this.stats.experience
    });
    
    // Дроп предметов
    this.dropInventory();
    
    // Респавн через 5 секунд
    setTimeout(() => this.respawn(), 5000);
  }

  dropInventory() {
    const drops = [];
    
    // Сбор всех предметов из инвентаря
    for (const slot of [...this.inventory.hotbar, ...this.inventory.main]) {
      if (slot) {
        drops.push({ ...slot });
      }
    }
    
    // Дроп снаряжения
    for (const [type, item] of Object.entries(this.equipment)) {
      if (item) {
        drops.push({ ...item });
        this.equipment[type] = null;
      }
    }
    
    EventBus.emit('player:drop', {
      position: this.position.clone(),
      items: drops
    });
    
    // Очистка инвентаря
    this.inventory.hotbar.fill(null);
    this.inventory.main.fill(null);
    EventBus.emit('inventory:changed');
  }

  respawn() {
    // Восстановление характеристик
    this.stats.health = this.stats.maxHealth;
    this.stats.stamina = this.stats.maxStamina;
    this.state.isDead = false;
    
    // Телепортация на спавн
    this.position.set(0, 0);
    this.velocity.set(0, 0);
    
    EventBus.emit('player:respawn');
  }

  saveToStorage() {
    const saveData = {
      position: [this.position.x, this.position.y],
      stats: this.stats,
      inventory: this.inventory,
      equipment: this.equipment,
      skills: this.skills,
      timestamp: Date.now()
    };
    
    try {
      localStorage.setItem('player_save', JSON.stringify(saveData));
      this.lastSaveTime = Date.now();
    } catch (e) {
      console.warn('Не удалось сохранить игрока:', e);
    }
  }

  loadFromStorage() {
    try {
      const saveData = JSON.parse(localStorage.getItem('player_save'));
      if (!saveData) return false;
      
      this.position.set(saveData.position[0], saveData.position[1]);
      this.stats = { ...saveData.stats };
      this.inventory = saveData.inventory;
      this.equipment = saveData.equipment;
      this.skills = saveData.skills;
      
      console.log('✅ Состояние игрока загружено');
      return true;
    } catch (e) {
      console.warn('Не удалось загрузить игрока:', e);
      return false;
    }
  }

  render(renderer) {
    // Отрисовка игрока через рендерер
    // Здесь будет код для отрисовки спрайта игрока
  }

  destroy() {
    // Очистка ресурсов
    EventBus.off('input:move');
    EventBus.off('input:jump');
    EventBus.off('input:interact');
    EventBus.off('input:attack');
    EventBus.off('input:build');
    EventBus.off('inventory:changed');
  }
}