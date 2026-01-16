import EventBus from '@/utils/EventBus.js';
import Utilities from '@/utils/Utilities.js';

export default class CraftingUI {
    constructor(game) {
        this.game = game;
        this.container = null;
        this.visible = false;
        this.activeWorkstation = null;
        this.selectedRecipe = null;
        this.craftingQueue = [];
        this.currentCategory = 'all';
        
        this.slots = {
            input: [],
            output: [],
            fuel: null
        };
        
        this.recipes = new Map();
        this.categories = new Set(['all']);
        
        this.craftingTime = 0;
        this.maxCraftingTime = 0;
        
        this.init();
    }
    
    init() {
        this.createContainer();
        this.setupEventListeners();
        this.loadRecipes();
    }
    
    createContainer() {
        // Основной контейнер крафта
        this.container = document.createElement('div');
        this.container.className = 'crafting-ui hidden';
        this.container.innerHTML = `
            <div class="crafting-container">
                <div class="crafting-header">
                    <h2><i class="fas fa-hammer"></i> Крафтинг</h2>
                    <button class="close-btn" id="close-crafting">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div class="crafting-content">
                    <div class="workstation-selector">
                        <div class="workstation-tabs" id="workstation-tabs">
                            <button class="tab-btn active" data-workstation="hand">
                                <i class="fas fa-hand-paper"></i> Рука
                            </button>
                            <button class="tab-btn" data-workstation="crafting_table">
                                <i class="fas fa-tools"></i> Верстак
                            </button>
                            <button class="tab-btn" data-workstation="furnace">
                                <i class="fas fa-fire"></i> Печь
                            </button>
                        </div>
                        
                        <div class="workstation-info" id="workstation-info">
                            <div class="workstation-name">Ручной крафт</div>
                            <div class="workstation-desc">Базовые рецепты доступные в инвентаре</div>
                        </div>
                    </div>
                    
                    <div class="crafting-main">
                        <div class="categories">
                            <div class="category-tabs" id="category-tabs">
                                <button class="category-btn active" data-category="all">Все</button>
                                <button class="category-btn" data-category="tools">Инструменты</button>
                                <button class="category-btn" data-category="weapons">Оружие</button>
                                <button class="category-btn" data-category="building">Строительство</button>
                                <button class="category-btn" data-category="decorative">Декорации</button>
                                <button class="category-btn" data-category="misc">Разное</button>
                            </div>
                            
                            <div class="search-box">
                                <input type="text" id="recipe-search" placeholder="Поиск рецептов...">
                                <i class="fas fa-search"></i>
                            </div>
                        </div>
                        
                        <div class="recipes-container">
                            <div class="recipes-list" id="recipes-list">
                                <!-- Рецепты загружаются динамически -->
                            </div>
                            
                            <div class="recipe-details" id="recipe-details">
                                <div class="no-recipe-selected">
                                    <i class="fas fa-eye"></i>
                                    <p>Выберите рецепт для просмотра деталей</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="crafting-slots">
                        <div class="input-slots" id="input-slots">
                            <h3>Ингредиенты</h3>
                            <div class="slot-grid">
                                <!-- Слоты ингредиентов генерируются динамически -->
                            </div>
                        </div>
                        
                        <div class="crafting-process">
                            <div class="arrow">
                                <i class="fas fa-arrow-right"></i>
                            </div>
                            
                            <div class="output-slot" id="output-slot">
                                <div class="slot-header">Результат</div>
                                <div class="slot" data-slot-type="output"></div>
                            </div>
                            
                            <div class="craft-progress" id="craft-progress">
                                <div class="progress-bar">
                                    <div class="progress-fill"></div>
                                </div>
                                <div class="progress-text">0%</div>
                            </div>
                        </div>
                        
                        <div class="crafting-controls">
                            <button class="craft-btn" id="craft-btn" disabled>
                                <i class="fas fa-hammer"></i> Создать
                            </button>
                            <button class="craft-all-btn" id="craft-all-btn" disabled>
                                <i class="fas fa-redo"></i> Создать всё
                            </button>
                            <button class="clear-btn" id="clear-btn">
                                <i class="fas fa-trash"></i> Очистить
                            </button>
                        </div>
                    </div>
                    
                    <div class="fuel-slot-container" id="fuel-slot-container">
                        <h3><i class="fas fa-fire"></i> Топливо</h3>
                        <div class="fuel-slot" id="fuel-slot"></div>
                        <div class="fuel-info">
                            <div class="fuel-time">Время горения: <span id="fuel-time">0с</span></div>
                            <div class="current-fuel">Текущее: <span id="current-fuel">0с</span></div>
                        </div>
                    </div>
                </div>
                
                <div class="crafting-footer">
                    <div class="hint">
                        <i class="fas fa-info-circle"></i>
                        <span>Перетащите предметы в слоты или кликните на рецепт для автозаполнения</span>
                    </div>
                    <div class="shortcuts">
                        <span class="shortcut"><kbd>E</kbd> - Инвентарь</span>
                        <span class="shortcut"><kbd>C</kbd> - Крафт</span>
                        <span class="shortcut"><kbd>ESC</kbd> - Закрыть</span>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.container);
        
        // Инициализация слотов
        this.initSlots();
        this.setupUIEvents();
    }
    
    initSlots() {
        // Создание слотов для ингредиентов (3x3 сетка для верстака)
        const slotGrid = this.container.querySelector('.slot-grid');
        slotGrid.innerHTML = '';
        
        for (let i = 0; i < 9; i++) {
            const slot = this.createSlot('input', i);
            this.slots.input.push(slot);
            slotGrid.appendChild(slot);
        }
        
        // Слот для вывода
        const outputSlot = this.container.querySelector('[data-slot-type="output"]');
        this.slots.output = this.createSlot('output', 0);
        outputSlot.parentNode.replaceChild(this.slots.output, outputSlot);
        
        // Слот для топлива (для печи)
        const fuelSlot = this.createSlot('fuel', 0);
        this.slots.fuel = fuelSlot;
        this.container.querySelector('#fuel-slot').appendChild(fuelSlot);
        
        // Скрываем слот топлива по умолчанию
        this.container.querySelector('#fuel-slot-container').classList.add('hidden');
    }
    
    createSlot(type, index) {
        const slot = document.createElement('div');
        slot.className = `craft-slot ${type}-slot`;
        slot.dataset.type = type;
        slot.dataset.index = index;
        
        slot.innerHTML = `
            <div class="slot-background"></div>
            <div class="slot-content"></div>
            <div class="slot-count">0</div>
            <div class="slot-hint"></div>
        `;
        
        // Drag & Drop события
        slot.addEventListener('dragover', (e) => {
            e.preventDefault();
            slot.classList.add('drag-over');
        });
        
        slot.addEventListener('dragleave', () => {
            slot.classList.remove('drag-over');
        });
        
        slot.addEventListener('drop', (e) => {
            e.preventDefault();
            slot.classList.remove('drag-over');
            this.handleSlotDrop(slot, e);
        });
        
        slot.addEventListener('click', () => {
            this.handleSlotClick(slot);
        });
        
        return slot;
    }
    
    setupUIEvents() {
        // Кнопка закрытия
        this.container.querySelector('#close-crafting').addEventListener('click', () => {
            this.hide();
        });
        
        // Переключение верстаков
        this.container.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.selectWorkstation(btn.dataset.workstation);
            });
        });
        
        // Переключение категорий
        this.container.querySelectorAll('.category-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.selectCategory(btn.dataset.category);
            });
        });
        
        // Поиск рецептов
        const searchInput = this.container.querySelector('#recipe-search');
        searchInput.addEventListener('input', (e) => {
            this.filterRecipes(e.target.value);
        });
        
        // Кнопки крафта
        this.container.querySelector('#craft-btn').addEventListener('click', () => {
            this.craft();
        });
        
        this.container.querySelector('#craft-all-btn').addEventListener('click', () => {
            this.craftAll();
        });
        
        this.container.querySelector('#clear-btn').addEventListener('click', () => {
            this.clearSlots();
        });
        
        // Горячие клавиши
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.visible) {
                this.hide();
            } else if (e.key === 'c' && !e.ctrlKey) {
                e.preventDefault();
                this.toggle();
            }
        });
        
        // Перетаскивание из инвентаря
        EventBus.on('inventory:item_dragged', (data) => {
            this.currentDraggedItem = data;
        });
    }
    
    setupEventListeners() {
        // События от игровых систем
        EventBus.on('crafting:recipes_loaded', (data) => {
            this.recipes = data.recipes;
            this.categories = new Set(['all', ...data.categories]);
            this.populateCategories();
            this.displayRecipes();
        });
        
        EventBus.on('crafting:recipe_unlocked', (data) => {
            this.unlockRecipe(data.recipeId);
        });
        
        EventBus.on('inventory:updated', () => {
            this.updateCraftButton();
        });
        
        EventBus.on('workstation:activated', (data) => {
            this.activateWorkstation(data.type, data.position);
        });
    }
    
    loadRecipes() {
        // Загрузка рецептов из системы крафта
        setTimeout(() => {
            const mockRecipes = this.getMockRecipes();
            this.recipes = mockRecipes;
            this.populateCategories();
            this.displayRecipes();
        }, 100);
    }
    
    getMockRecipes() {
        // Временные рецепты для демонстрации
        const recipes = new Map();
        
        recipes.set('planks', {
            id: 'planks',
            name: 'Доски',
            category: 'building',
            workstation: 'hand',
            unlocked: true,
            output: { id: 19, count: 4 },
            ingredients: [{ id: 4, count: 1 }],
            shape: null,
            shapeless: true,
            time: 0.5
        });
        
        recipes.set('stick', {
            id: 'stick',
            name: 'Палка',
            category: 'building',
            workstation: 'hand',
            unlocked: true,
            output: { id: 20, count: 4 },
            ingredients: [{ id: 19, count: 2 }],
            shape: [['wood', 'wood']],
            time: 0.5
        });
        
        recipes.set('wooden_pickaxe', {
            id: 'wooden_pickaxe',
            name: 'Деревянная кирка',
            category: 'tools',
            workstation: 'crafting_table',
            unlocked: true,
            output: { id: 21, count: 1 },
            ingredients: [
                { id: 19, count: 3 },
                { id: 20, count: 2 }
            ],
            shape: [
                ['wood', 'wood', 'wood'],
                ['', 'stick', ''],
                ['', 'stick', '']
            ],
            time: 2.0
        });
        
        recipes.set('torch', {
            id: 'torch',
            name: 'Факел',
            category: 'decorative',
            workstation: 'hand',
            unlocked: true,
            output: { id: 18, count: 4 },
            ingredients: [
                { id: 20, count: 1 },
                { id: 25, count: 1 }
            ],
            shape: [['coal'], ['stick']],
            time: 1.0
        });
        
        recipes.set('furnace', {
            id: 'furnace',
            name: 'Печь',
            category: 'building',
            workstation: 'crafting_table',
            unlocked: false,
            unlockRequirement: { type: 'item', item: 8, count: 1 },
            output: { id: 16, count: 1 },
            ingredients: [{ id: 3, count: 8 }],
            shape: [
                ['stone', 'stone', 'stone'],
                ['stone', '', 'stone'],
                ['stone', 'stone', 'stone']
            ],
            time: 5.0
        });
        
        return recipes;
    }
    
    populateCategories() {
        const container = this.container.querySelector('#category-tabs');
        container.innerHTML = '<button class="category-btn active" data-category="all">Все</button>';
        
        this.categories.forEach(category => {
            if (category !== 'all') {
                const btn = document.createElement('button');
                btn.className = 'category-btn';
                btn.dataset.category = category;
                btn.textContent = this.formatCategoryName(category);
                container.appendChild(btn);
                
                btn.addEventListener('click', () => {
                    this.selectCategory(category);
                });
            }
        });
    }
    
    formatCategoryName(category) {
        const names = {
            'tools': 'Инструменты',
            'weapons': 'Оружие',
            'building': 'Строительство',
            'decorative': 'Декорации',
            'misc': 'Разное'
        };
        
        return names[category] || category;
    }
    
    selectWorkstation(workstation) {
        this.activeWorkstation = workstation;
        
        // Обновление активной вкладки
        this.container.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        this.container.querySelector(`[data-workstation="${workstation}"]`).classList.add('active');
        
        // Обновление информации о верстаке
        this.updateWorkstationInfo(workstation);
        
        // Показать/скрыть слот топлива
        const fuelContainer = this.container.querySelector('#fuel-slot-container');
        if (workstation === 'furnace') {
            fuelContainer.classList.remove('hidden');
        } else {
            fuelContainer.classList.add('hidden');
        }
        
        // Обновить список рецептов
        this.displayRecipes();
        
        // Очистить слоты
        this.clearSlots();
    }
    
    updateWorkstationInfo(workstation) {
        const info = this.container.querySelector('#workstation-info');
        const workstationInfo = {
            hand: {
                name: 'Ручной крафт',
                desc: 'Базовые рецепты доступные в инвентаре'
            },
            crafting_table: {
                name: 'Верстак',
                desc: 'Создание инструментов и сложных предметов'
            },
            furnace: {
                name: 'Печь',
                desc: 'Плавка руд и приготовление пищи'
            }
        };
        
        const data = workstationInfo[workstation] || workstationInfo.hand;
        info.querySelector('.workstation-name').textContent = data.name;
        info.querySelector('.workstation-desc').textContent = data.desc;
    }
    
    selectCategory(category) {
        this.currentCategory = category;
        
        // Обновление активной категории
        this.container.querySelectorAll('.category-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        this.container.querySelector(`[data-category="${category}"]`).classList.add('active');
        
        // Обновление списка рецептов
        this.displayRecipes();
    }
    
    displayRecipes() {
        const container = this.container.querySelector('#recipes-list');
        container.innerHTML = '';
        
        const searchTerm = this.container.querySelector('#recipe-search').value.toLowerCase();
        
        let filteredRecipes = Array.from(this.recipes.values()).filter(recipe => {
            // Фильтр по верстаку
            if (this.activeWorkstation && recipe.workstation !== this.activeWorkstation) {
                return false;
            }
            
            // Фильтр по категории
            if (this.currentCategory !== 'all' && recipe.category !== this.currentCategory) {
                return false;
            }
            
            // Фильтр по поиску
            if (searchTerm && !recipe.name.toLowerCase().includes(searchTerm)) {
                return false;
            }
            
            // Фильтр по разблокированности
            return recipe.unlocked;
        });
        
        // Сортировка по имени
        filteredRecipes.sort((a, b) => a.name.localeCompare(b.name));
        
        if (filteredRecipes.length === 0) {
            container.innerHTML = `
                <div class="no-recipes">
                    <i class="fas fa-search"></i>
                    <p>Нет доступных рецептов</p>
                    ${this.activeWorkstation !== 'hand' ? 
                        '<p class="hint">Попробуйте использовать другой верстак</p>' : ''}
                </div>
            `;
            return;
        }
        
        filteredRecipes.forEach(recipe => {
            const recipeElement = this.createRecipeElement(recipe);
            container.appendChild(recipeElement);
        });
    }
    
    createRecipeElement(recipe) {
        const element = document.createElement('div');
        element.className = 'recipe-card';
        element.dataset.recipeId = recipe.id;
        
        // Получаем информацию о результате
        const resultItem = this.game.blockSystem?.getBlock(recipe.output.id) || 
                          this.getItemInfo(recipe.output.id);
        
        element.innerHTML = `
            <div class="recipe-icon">
                ${this.getItemIcon(recipe.output.id)}
            </div>
            <div class="recipe-info">
                <div class="recipe-name">${recipe.name}</div>
                <div class="recipe-meta">
                    <span class="recipe-count">x${recipe.output.count}</span>
                    <span class="recipe-time">
                        <i class="fas fa-clock"></i> ${recipe.time}с
                    </span>
                </div>
                <div class="recipe-ingredients">
                    ${recipe.ingredients.map(ing => 
                        `<span class="ingredient">${this.getItemIcon(ing.id)}x${ing.count}</span>`
                    ).join('')}
                </div>
            </div>
            <div class="recipe-workstation">
                <i class="${this.getWorkstationIcon(recipe.workstation)}"></i>
            </div>
        `;
        
        element.addEventListener('click', () => {
            this.selectRecipe(recipe);
        });
        
        return element;
    }
    
    selectRecipe(recipe) {
        this.selectedRecipe = recipe;
        
        // Обновление деталей рецепта
        this.showRecipeDetails(recipe);
        
        // Автозаполнение слотов (если есть все ингредиенты)
        this.autoFillSlots(recipe);
        
        // Обновление кнопки крафта
        this.updateCraftButton();
    }
    
    showRecipeDetails(recipe) {
        const container = this.container.querySelector('#recipe-details');
        
        // Создаем сетку для рецепта с формой
        let shapeGrid = '';
        if (recipe.shape) {
            shapeGrid = '<div class="recipe-shape">';
            recipe.shape.forEach(row => {
                shapeGrid += '<div class="shape-row">';
                row.forEach(cell => {
                    shapeGrid += `<div class="shape-cell">${cell ? '■' : ''}</div>`;
                });
                shapeGrid += '</div>';
            });
            shapeGrid += '</div>';
        }
        
        container.innerHTML = `
            <div class="recipe-details-content">
                <div class="recipe-header">
                    <div class="recipe-icon-large">
                        ${this.getItemIcon(recipe.output.id)}
                    </div>
                    <div class="recipe-title">
                        <h3>${recipe.name}</h3>
                        <div class="recipe-output">Выход: ${recipe.output.count} шт.</div>
                    </div>
                </div>
                
                <div class="recipe-description">
                    <p>Создает <strong>${recipe.name}</strong> из следующих компонентов:</p>
                </div>
                
                ${shapeGrid}
                
                <div class="recipe-ingredients-list">
                    <h4>Требуемые ингредиенты:</h4>
                    <ul>
                        ${recipe.ingredients.map(ing => {
                            const item = this.getItemInfo(ing.id);
                            return `
                                <li>
                                    <span class="ingredient-icon">${this.getItemIcon(ing.id)}</span>
                                    <span class="ingredient-name">${item?.name || `Предмет ${ing.id}`}</span>
                                    <span class="ingredient-count">x${ing.count}</span>
                                </li>
                            `;
                        }).join('')}
                    </ul>
                </div>
                
                <div class="recipe-requirements">
                    <div class="requirement">
                        <i class="fas fa-hammer"></i>
                        <span>Верстак: ${this.getWorkstationName(recipe.workstation)}</span>
                    </div>
                    <div class="requirement">
                        <i class="fas fa-clock"></i>
                        <span>Время создания: ${recipe.time} секунд</span>
                    </div>
                </div>
                
                <div class="recipe-actions">
                    <button class="btn-fill" id="btn-fill-recipe">
                        <i class="fas fa-fill-drip"></i> Автозаполнить
                    </button>
                    <button class="btn-craft-from" id="btn-craft-from-recipe">
                        <i class="fas fa-hammer"></i> Создать из инвентаря
                    </button>
                </div>
            </div>
        `;
        
        // Добавляем обработчики кнопок
        container.querySelector('#btn-fill-recipe').addEventListener('click', () => {
            this.autoFillSlots(recipe);
        });
        
        container.querySelector('#btn-craft-from-recipe').addEventListener('click', () => {
            this.craftFromInventory(recipe);
        });
    }
    
    autoFillSlots(recipe) {
        if (!recipe) return;
        
        // Очищаем слоты
        this.clearSlots();
        
        // Заполняем слоты в зависимости от формы рецепта
        if (recipe.shape) {
            // Рецепт с формой
            let slotIndex = 0;
            recipe.shape.forEach((row, y) => {
                row.forEach((cell, x) => {
                    if (cell) {
                        const ingredient = recipe.ingredients.find(ing => ing.symbol === cell);
                        if (ingredient) {
                            const slot = this.slots.input[slotIndex];
                            this.setSlotItem(slot, ingredient.id, ingredient.count);
                        }
                    }
                    slotIndex++;
                });
            });
        } else if (recipe.shapeless) {
            // Бесформенный рецепт - заполняем первые слоты
            recipe.ingredients.forEach((ingredient, index) => {
                if (index < this.slots.input.length) {
                    const slot = this.slots.input[index];
                    this.setSlotItem(slot, ingredient.id, ingredient.count);
                }
            });
        }
        
        // Устанавливаем результат
        this.setSlotItem(this.slots.output, recipe.output.id, recipe.output.count);
    }
    
    craftFromInventory(recipe) {
        if (!recipe) return;
        
        // Проверяем, есть ли все ингредиенты в инвентаре
        const canCraft = recipe.ingredients.every(ingredient => {
            return this.hasItemInInventory(ingredient.id, ingredient.count);
        });
        
        if (!canCraft) {
            this.showMessage('Недостаточно ингредиентов в инвентаре!', 'error');
            return;
        }
        
        // Убираем ингредиенты из инвентаря
        recipe.ingredients.forEach(ingredient => {
            this.removeFromInventory(ingredient.id, ingredient.count);
        });
        
        // Добавляем результат в инвентарь
        this.addToInventory(recipe.output.id, recipe.output.count);
        
        this.showMessage(`Создано: ${recipe.name} x${recipe.output.count}`, 'success');
        
        // Обновляем интерфейс
        EventBus.emit('inventory:updated');
    }
    
    filterRecipes(searchTerm) {
        this.displayRecipes();
    }
    
    updateCraftButton() {
        const craftBtn = this.container.querySelector('#craft-btn');
        const craftAllBtn = this.container.querySelector('#craft-all-btn');
        
        const canCraft = this.canCraftCurrentRecipe();
        const ingredientsInInventory = this.countCraftableFromInventory();
        
        craftBtn.disabled = !canCraft;
        craftAllBtn.disabled = !canCraft || ingredientsInInventory <= 1;
        
        if (ingredientsInInventory > 1) {
            craftAllBtn.textContent = `Создать всё (x${ingredientsInInventory})`;
        }
    }
    
    canCraftCurrentRecipe() {
        if (!this.selectedRecipe) return false;
        
        // Проверяем, заполнены ли все нужные слоты
        const recipe = this.selectedRecipe;
        
        if (recipe.shape) {
            // Проверка формы
            let slotIndex = 0;
            for (let y = 0; y < recipe.shape.length; y++) {
                for (let x = 0; x < recipe.shape[y].length; x++) {
                    const cell = recipe.shape[y][x];
                    const slot = this.slots.input[slotIndex];
                    
                    if (cell) {
                        const ingredient = recipe.ingredients.find(ing => ing.symbol === cell);
                        if (!ingredient || !this.isSlotValid(slot, ingredient.id, ingredient.count)) {
                            return false;
                        }
                    } else if (this.getSlotItem(slot)) {
                        // В этом слоте не должно быть предмета
                        return false;
                    }
                    slotIndex++;
                }
            }
        } else {
            // Проверка бесформенного рецепта
            const usedSlots = new Set();
            
            for (const ingredient of recipe.ingredients) {
                let found = false;
                
                for (let i = 0; i < this.slots.input.length; i++) {
                    if (usedSlots.has(i)) continue;
                    
                    const slot = this.slots.input[i];
                    if (this.isSlotValid(slot, ingredient.id, ingredient.count)) {
                        usedSlots.add(i);
                        found = true;
                        break;
                    }
                }
                
                if (!found) return false;
            }
            
            // Проверяем, что остальные слоты пустые
            for (let i = 0; i < this.slots.input.length; i++) {
                if (!usedSlots.has(i) && this.getSlotItem(this.slots.input[i])) {
                    return false;
                }
            }
        }
        
        return true;
    }
    
    countCraftableFromInventory() {
        if (!this.selectedRecipe) return 0;
        
        const recipe = this.selectedRecipe;
        let maxCrafts = Infinity;
        
        // Для каждого ингредиента считаем, сколько можно скрафтить из инвентаря
        for (const ingredient of recipe.ingredients) {
            const inventoryCount = this.getItemCountInInventory(ingredient.id);
            const crafts = Math.floor(inventoryCount / ingredient.count);
            maxCrafts = Math.min(maxCrafts, crafts);
        }
        
        return maxCrafts;
    }
    
    craft() {
        if (!this.canCraftCurrentRecipe()) {
            this.showMessage('Нельзя создать этот предмет!', 'error');
            return;
        }
        
        const recipe = this.selectedRecipe;
        
        // Запускаем процесс крафта
        this.startCrafting(recipe);
        
        // Убираем ингредиенты из слотов
        this.removeIngredientsFromSlots(recipe);
        
        // Обновляем кнопки
        this.updateCraftButton();
        
        this.showMessage(`Создание: ${recipe.name}...`, 'info');
    }
    
    craftAll() {
        const maxCrafts = this.countCraftableFromInventory();
        
        if (maxCrafts <= 0) {
            this.showMessage('Недостаточно ингредиентов!', 'error');
            return;
        }
        
        // Добавляем в очередь крафта
        const recipe = this.selectedRecipe;
        
        for (let i = 0; i < maxCrafts; i++) {
            this.craftingQueue.push({
                recipe: recipe,
                timeLeft: recipe.time
            });
        }
        
        this.showMessage(`Добавлено в очередь: ${recipe.name} x${maxCrafts}`, 'success');
        
        // Запускаем обработку очереди, если не запущена
        if (!this.craftingInterval) {
            this.processCraftingQueue();
        }
    }
    
    startCrafting(recipe) {
        this.craftingTime = 0;
        this.maxCraftingTime = recipe.time;
        
        // Показываем прогресс
        const progress = this.container.querySelector('#craft-progress');
        progress.classList.remove('hidden');
        
        // Запускаем анимацию прогресса
        const progressBar = progress.querySelector('.progress-fill');
        const progressText = progress.querySelector('.progress-text');
        
        const updateProgress = () => {
            if (this.craftingTime >= this.maxCraftingTime) {
                this.finishCrafting(recipe);
                return;
            }
            
            this.craftingTime += 0.1;
            const percent = (this.craftingTime / this.maxCraftingTime) * 100;
            
            progressBar.style.width = `${percent}%`;
            progressText.textContent = `${Math.round(percent)}%`;
            
            setTimeout(updateProgress, 100);
        };
        
        updateProgress();
    }
    
    finishCrafting(recipe) {
        // Добавляем результат в слот вывода
        const currentItem = this.getSlotItem(this.slots.output);
        
        if (currentItem && currentItem.id === recipe.output.id) {
            // Увеличиваем количество
            currentItem.count += recipe.output.count;
        } else {
            // Устанавливаем новый предмет
            this.setSlotItem(this.slots.output, recipe.output.id, recipe.output.count);
        }
        
        // Обновляем отображение слота
        this.updateSlotDisplay(this.slots.output);
        
        // Скрываем прогресс
        const progress = this.container.querySelector('#craft-progress');
        progress.classList.add('hidden');
        
        // Сообщение об успехе
        this.showMessage(`Создано: ${recipe.name} x${recipe.output.count}!`, 'success');
        
        // Звуковой эффект
        EventBus.emit('audio:play', { sound: 'crafting_success', volume: 0.5 });
    }
    
    processCraftingQueue() {
        this.craftingInterval = setInterval(() => {
            if (this.craftingQueue.length === 0) {
                clearInterval(this.craftingInterval);
                this.craftingInterval = null;
                return;
            }
            
            const craftJob = this.craftingQueue[0];
            craftJob.timeLeft -= 0.1;
            
            if (craftJob.timeLeft <= 0) {
                // Крафт завершен
                this.craftingQueue.shift();
                
                // Добавляем предмет в инвентарь
                this.addToInventory(craftJob.recipe.output.id, craftJob.recipe.output.count);
                
                // Обновляем интерфейс
                EventBus.emit('inventory:updated');
                
                this.showMessage(`Создано: ${craftJob.recipe.name}`, 'success');
            }
        }, 100);
    }
    
    removeIngredientsFromSlots(recipe) {
        if (recipe.shape) {
            let slotIndex = 0;
            recipe.shape.forEach((row, y) => {
                row.forEach((cell, x) => {
                    if (cell) {
                        const slot = this.slots.input[slotIndex];
                        this.clearSlot(slot);
                    }
                    slotIndex++;
                });
            });
        } else {
            recipe.ingredients.forEach((ingredient, index) => {
                if (index < this.slots.input.length) {
                    const slot = this.slots.input[index];
                    this.clearSlot(slot);
                }
            });
        }
    }
    
    clearSlots() {
        this.slots.input.forEach(slot => this.clearSlot(slot));
        this.clearSlot(this.slots.output);
        this.clearSlot(this.slots.fuel);
        
        this.selectedRecipe = null;
        
        // Очищаем детали рецепта
        const details = this.container.querySelector('#recipe-details');
        details.innerHTML = `
            <div class="no-recipe-selected">
                <i class="fas fa-eye"></i>
                <p>Выберите рецепт для просмотра деталей</p>
            </div>
        `;
        
        this.updateCraftButton();
    }
    
    // Работа со слотами
    setSlotItem(slot, itemId, count = 1) {
        slot.dataset.itemId = itemId;
        slot.dataset.itemCount = count;
        this.updateSlotDisplay(slot);
    }
    
    getSlotItem(slot) {
        if (!slot.dataset.itemId) return null;
        
        return {
            id: parseInt(slot.dataset.itemId),
            count: parseInt(slot.dataset.itemCount || '1')
        };
    }
    
    clearSlot(slot) {
        delete slot.dataset.itemId;
        delete slot.dataset.itemCount;
        this.updateSlotDisplay(slot);
    }
    
    updateSlotDisplay(slot) {
        const content = slot.querySelector('.slot-content');
        const count = slot.querySelector('.slot-count');
        
        const item = this.getSlotItem(slot);
        
        if (item) {
            content.innerHTML = this.getItemIcon(item.id);
            count.textContent = item.count > 1 ? item.count : '';
            count.style.display = item.count > 1 ? 'block' : 'none';
        } else {
            content.innerHTML = '';
            count.textContent = '';
            count.style.display = 'none';
        }
    }
    
    isSlotValid(slot, expectedItemId, expectedCount = 1) {
        const item = this.getSlotItem(slot);
        return item && item.id === expectedItemId && item.count >= expectedCount;
    }
    
    // Drag & Drop
    handleSlotDrop(slot, event) {
        const draggedItem = this.currentDraggedItem;
        if (!draggedItem) return;
        
        const currentItem = this.getSlotItem(slot);
        
        if (!currentItem) {
            // Слот пустой - кладем предмет
            this.setSlotItem(slot, draggedItem.id, draggedItem.count);
            EventBus.emit('inventory:item_removed', draggedItem);
        } else if (currentItem.id === draggedItem.id) {
            // Тот же предмет - складываем
            currentItem.count += draggedItem.count;
            this.setSlotItem(slot, currentItem.id, currentItem.count);
            EventBus.emit('inventory:item_removed', draggedItem);
        }
        
        this.currentDraggedItem = null;
        this.updateCraftButton();
    }
    
    handleSlotClick(slot) {
        const item = this.getSlotItem(slot);
        if (!item) return;
        
        // Возвращаем предмет в инвентарь
        EventBus.emit('inventory:item_added', item);
        this.clearSlot(slot);
        this.updateCraftButton();
    }
    
    // Вспомогательные методы
    getItemIcon(itemId) {
        const icons = {
            4: '🪵',   // Дерево
            19: '📦',  // Доски
            20: '│',   // Палка
            21: '⛏️',  // Деревянная кирка
            18: '🔥',  // Факел
            3: '🪨',   // Камень
            16: '🏭',  // Печь
            25: '⚫',  // Уголь
            8: '⛓️',   // Угольная руда
            9: '🔗',   // Железная руда
            10: '🟨',  // Золотая руда
            11: '💎',  // Алмазная руда
            12: '✨',  // Алмаз
            13: '🔷',  // Стекло
            7: '🏖️',  // Песок
            1: '🌱',  // Трава
            2: '🟫',  // Земля
            5: '🍃',  // Листья
            6: '💧',  // Вода
            12: '🌋'   // Лава
        };
        
        return icons[itemId] || '❓';
    }
    
    getItemInfo(itemId) {
        // В реальной игре здесь будет запрос к системе блоков/предметов
        const items = {
            4: { name: 'Дерево' },
            19: { name: 'Доски' },
            20: { name: 'Палка' },
            21: { name: 'Деревянная кирка' },
            18: { name: 'Факел' },
            3: { name: 'Камень' },
            16: { name: 'Печь' },
            25: { name: 'Уголь' },
            8: { name: 'Угольная руда' },
            9: { name: 'Железная руда' },
            10: { name: 'Золотая руда' },
            11: { name: 'Алмазная руда' },
            12: { name: 'Алмаз' },
            13: { name: 'Стекло' },
            7: { name: 'Песок' },
            1: { name: 'Трава' },
            2: { name: 'Земля' },
            5: { name: 'Листья' },
            6: { name: 'Вода' },
            12: { name: 'Лава' }
        };
        
        return items[itemId] || { name: `Предмет ${itemId}` };
    }
    
    getWorkstationIcon(workstation) {
        const icons = {
            hand: 'fas fa-hand-paper',
            crafting_table: 'fas fa-tools',
            furnace: 'fas fa-fire'
        };
        
        return icons[workstation] || 'fas fa-question';
    }
    
    getWorkstationName(workstation) {
        const names = {
            hand: 'Рука',
            crafting_table: 'Верстак',
            furnace: 'Печь'
        };
        
        return names[workstation] || workstation;
    }
    
    hasItemInInventory(itemId, count = 1) {
        // В реальной игре здесь будет запрос к инвентарю игрока
        return true; // Заглушка
    }
    
    getItemCountInInventory(itemId) {
        // В реальной игре здесь будет запрос к инвентарю игрока
        return 999; // Заглушка
    }
    
    removeFromInventory(itemId, count = 1) {
        EventBus.emit('inventory:remove_item', { id: itemId, count });
    }
    
    addToInventory(itemId, count = 1) {
        EventBus.emit('inventory:add_item', { id: itemId, count });
    }
    
    // UI методы
    showMessage(text, type = 'info') {
        const message = document.createElement('div');
        message.className = `crafting-message ${type}`;
        message.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : 
                              type === 'error' ? 'exclamation-circle' : 
                              'info-circle'}"></i>
            <span>${text}</span>
        `;
        
        this.container.appendChild(message);
        
        setTimeout(() => {
            message.classList.add('fade-out');
            setTimeout(() => message.remove(), 300);
        }, 3000);
    }
    
    unlockRecipe(recipeId) {
        const recipe = this.recipes.get(recipeId);
        if (recipe) {
            recipe.unlocked = true;
            this.displayRecipes();
            
            // Показываем уведомление
            this.showMessage(`Разблокирован новый рецепт: ${recipe.name}`, 'success');
        }
    }
    
    activateWorkstation(type, position) {
        this.selectWorkstation(type);
        this.show();
        
        // Сохраняем позицию верстака для возможной анимации
        this.activeWorkstationPosition = position;
    }
    
    show() {
        this.container.classList.remove('hidden');
        this.visible = true;
        
        // Обновляем интерфейс
        this.displayRecipes();
        this.updateCraftButton();
        
        // Фокус на поиске
        setTimeout(() => {
            this.container.querySelector('#recipe-search').focus();
        }, 100);
        
        EventBus.emit('ui:crafting_opened');
    }
    
    hide() {
        this.container.classList.add('hidden');
        this.visible = false;
        
        // Очищаем очередь крафта если уходим
        if (this.craftingInterval) {
            clearInterval(this.craftingInterval);
            this.craftingInterval = null;
        }
        
        EventBus.emit('ui:crafting_closed');
    }
    
    toggle() {
        if (this.visible) {
            this.hide();
        } else {
            this.show();
        }
    }
    
    // Методы для интеграции с игрой
    update(deltaTime) {
        // Обновление таймеров крафта
        if (this.craftingTime > 0) {
            this.craftingTime = Math.min(this.craftingTime + deltaTime, this.maxCraftingTime);
            
            const progress = this.container.querySelector('#craft-progress');
            if (!progress.classList.contains('hidden')) {
                const percent = (this.craftingTime / this.maxCraftingTime) * 100;
                const progressBar = progress.querySelector('.progress-fill');
                const progressText = progress.querySelector('.progress-text');
                
                progressBar.style.width = `${percent}%`;
                progressText.textContent = `${Math.round(percent)}%`;
            }
        }
    }
    
    destroy() {
        if (this.craftingInterval) {
            clearInterval(this.craftingInterval);
        }
        
        this.container.remove();
        EventBus.off('crafting:recipes_loaded');
        EventBus.off('crafting:recipe_unlocked');
        EventBus.off('inventory:updated');
        EventBus.off('workstation:activated');
    }
}

// CSS стили для Crafting UI (добавить в style.css)
const craftingStyles = `
.crafting-ui {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
    backdrop-filter: blur(5px);
}

.crafting-ui.hidden {
    display: none;
}

.crafting-container {
    width: 90%;
    max-width: 1200px;
    height: 90%;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    border-radius: 20px;
    border: 2px solid rgba(100, 150, 255, 0.3);
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.crafting-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 30px;
    background: rgba(0, 0, 30, 0.7);
    border-bottom: 2px solid rgba(100, 150, 255, 0.2);
}

.crafting-header h2 {
    margin: 0;
    color: #64b5f6;
    font-size: 1.8rem;
    display: flex;
    align-items: center;
    gap: 10px;
}

.close-btn {
    background: rgba(255, 50, 50, 0.2);
    border: 2px solid #ff5555;
    color: #ff5555;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 1.2rem;
    transition: all 0.3s;
}

.close-btn:hover {
    background: rgba(255, 50, 50, 0.4);
    transform: scale(1.1);
}

.crafting-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 20px;
    overflow: hidden;
}

.workstation-selector {
    display: flex;
    gap: 20px;
    margin-bottom: 20px;
}

.workstation-tabs {
    display: flex;
    gap: 10px;
}

.tab-btn {
    padding: 12px 20px;
    background: rgba(30, 40, 80, 0.6);
    border: 2px solid #446;
    border-radius: 10px;
    color: #aac;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.3s;
}

.tab-btn:hover {
    background: rgba(40, 60, 120, 0.8);
    border-color: #64b5f6;
}

.tab-btn.active {
    background: rgba(100, 150, 255, 0.3);
    border-color: #64b5f6;
    color: #fff;
}

.workstation-info {
    flex: 1;
    padding: 10px 20px;
    background: rgba(0, 0, 30, 0.5);
    border-radius: 10px;
    border: 1px solid rgba(100, 150, 255, 0.2);
}

.workstation-name {
    font-size: 1.2rem;
    color: #64b5f6;
    margin-bottom: 5px;
}

.workstation-desc {
    color: #88a;
    font-size: 0.9rem;
}

.crafting-main {
    flex: 1;
    display: flex;
    gap: 20px;
    overflow: hidden;
}

.categories {
    width: 250px;
    display: flex;
    flex-direction: column;
    gap: 15px;
}

.category-tabs {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.category-btn {
    padding: 12px 15px;
    background: rgba(30, 40, 80, 0.6);
    border: 2px solid #446;
    border-radius: 8px;
    color: #aac;
    text-align: left;
    cursor: pointer;
    transition: all 0.3s;
}

.category-btn:hover {
    background: rgba(40, 60, 120, 0.8);
    transform: translateX(5px);
}

.category-btn.active {
    background: rgba(100, 150, 255, 0.3);
    border-color: #64b5f6;
    color: #fff;
}

.search-box {
    position: relative;
    margin-top: 10px;
}

.search-box input {
    width: 100%;
    padding: 12px 40px 12px 15px;
    background: rgba(0, 0, 20, 0.7);
    border: 2px solid #446;
    border-radius: 8px;
    color: #fff;
    font-size: 0.9rem;
}

.search-box input:focus {
    outline: none;
    border-color: #64b5f6;
}

.search-box i {
    position: absolute;
    right: 15px;
    top: 50%;
    transform: translateY(-50%);
    color: #88a;
}

.recipes-container {
    flex: 1;
    display: flex;
    gap: 20px;
    overflow: hidden;
}

.recipes-list {
    flex: 1;
    background: rgba(0, 0, 20, 0.5);
    border-radius: 10px;
    padding: 15px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.recipe-card {
    display: flex;
    align-items: center;
    gap: 15px;
    padding: 15px;
    background: rgba(30, 40, 80, 0.6);
    border: 2px solid #446;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.3s;
}

.recipe-card:hover {
    background: rgba(40, 60, 120, 0.8);
    border-color: #64b5f6;
    transform: translateY(-2px);
}

.recipe-card.selected {
    background: rgba(100, 150, 255, 0.3);
    border-color: #64b5f6;
}

.recipe-icon {
    font-size: 2rem;
    width: 50px;
    height: 50px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 8px;
}

.recipe-info {
    flex: 1;
}

.recipe-name {
    color: #fff;
    font-weight: bold;
    margin-bottom: 5px;
}

.recipe-meta {
    display: flex;
    gap: 15px;
    color: #88a;
    font-size: 0.9rem;
}

.recipe-ingredients {
    display: flex;
    gap: 5px;
    margin-top: 8px;
}

.ingredient {
    font-size: 1.2rem;
}

.recipe-workstation {
    color: #64b5f6;
    font-size: 1.2rem;
}

.recipe-details {
    width: 400px;
    background: rgba(0, 0, 20, 0.5);
    border-radius: 10px;
    padding: 20px;
    overflow-y: auto;
}

.no-recipe-selected {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #88a;
    text-align: center;
}

.no-recipe-selected i {
    font-size: 3rem;
    margin-bottom: 20px;
    opacity: 0.5;
}

.recipe-details-content {
    color: #fff;
}

.recipe-header {
    display: flex;
    align-items: center;
    gap: 20px;
    margin-bottom: 20px;
    padding-bottom: 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.recipe-icon-large {
    font-size: 3rem;
    width: 80px;
    height: 80px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 10px;
}

.recipe-title h3 {
    margin: 0;
    font-size: 1.5rem;
    color: #64b5f6;
}

.recipe-output {
    color: #88a;
    margin-top: 5px;
}

.recipe-shape {
    display: inline-flex;
    flex-direction: column;
    gap: 5px;
    margin: 20px 0;
    background: rgba(0, 0, 0, 0.3);
    padding: 10px;
    border-radius: 8px;
}

.shape-row {
    display: flex;
    gap: 5px;
}

.shape-cell {
    width: 30px;
    height: 30px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
}

.recipe-ingredients-list ul {
    list-style: none;
    padding: 0;
    margin: 20px 0;
}

.recipe-ingredients-list li {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 6px;
    margin-bottom: 8px;
}

.ingredient-icon {
    font-size: 1.5rem;
}

.ingredient-name {
    flex: 1;
}

.ingredient-count {
    color: #64b5f6;
    font-weight: bold;
}

.recipe-requirements {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 20px 0;
    padding: 15px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 8px;
}

.requirement {
    display: flex;
    align-items: center;
    gap: 10px;
    color: #88a;
}

.recipe-actions {
    display: flex;
    gap: 10px;
    margin-top: 20px;
}

.recipe-actions button {
    flex: 1;
    padding: 12px;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-weight: bold;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: all 0.3s;
}

.btn-fill {
    background: rgba(100, 150, 255, 0.3);
    color: #64b5f6;
    border: 2px solid #64b5f6;
}

.btn-fill:hover {
    background: rgba(100, 150, 255, 0.5);
}

.btn-craft-from {
    background: rgba(100, 255, 100, 0.2);
    color: #7cfc00;
    border: 2px solid #7cfc00;
}

.btn-craft-from:hover {
    background: rgba(100, 255, 100, 0.4);
}

.crafting-slots {
    display: flex;
    align-items: center;
    gap: 30px;
    padding: 20px;
    background: rgba(0, 0, 30, 0.5);
    border-radius: 10px;
    margin-top: 20px;
}

.input-slots {
    flex: 1;
}

.input-slots h3 {
    color: #64b5f6;
    margin-bottom: 15px;
}

.slot-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    width: 210px;
}

.craft-slot {
    position: relative;
    width: 60px;
    height: 60px;
    background: rgba(30, 40, 80, 0.6);
    border: 2px solid #446;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s;
}

.craft-slot:hover {
    border-color: #64b5f6;
    transform: scale(1.05);
}

.craft-slot.drag-over {
    border-color: #ffcc00;
    background: rgba(255, 204, 0, 0.1);
}

.slot-background {
    position: absolute;
    width: 100%;
    height: 100%;
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.3);
}

.slot-content {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 2rem;
    z-index: 1;
}

.slot-count {
    position: absolute;
    bottom: 2px;
    right: 5px;
    color: #ffcc80;
    font-weight: bold;
    font-size: 0.8rem;
    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
    z-index: 2;
}

.slot-hint {
    position: absolute;
    top: -20px;
    left: 0;
    right: 0;
    text-align: center;
    color: #88a;
    font-size: 0.7rem;
    opacity: 0;
    transition: opacity 0.3s;
}

.craft-slot:hover .slot-hint {
    opacity: 1;
}

.crafting-process {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
}

.arrow {
    font-size: 2rem;
    color: #64b5f6;
    animation: pulse 2s infinite;
}

@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
}

.output-slot {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
}

.slot-header {
    color: #64b5f6;
    font-weight: bold;
}

.craft-progress {
    width: 200px;
    text-align: center;
}

.craft-progress.hidden {
    display: none;
}

.progress-bar {
    width: 100%;
    height: 10px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 5px;
    overflow: hidden;
    margin-bottom: 5px;
}

.progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #00dbde, #fc00ff);
    width: 0%;
    transition: width 0.3s;
}

.progress-text {
    color: #88a;
    font-size: 0.9rem;
}

.crafting-controls {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 200px;
}

.crafting-controls button {
    padding: 15px;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    font-weight: bold;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    transition: all 0.3s;
    font-size: 1rem;
}

.craft-btn {
    background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
    color: white;
    border: 2px solid #64b5f6;
}

.craft-btn:hover:not(:disabled) {
    background: linear-gradient(135deg, #2a5298 0%, #3a62a8 100%);
    transform: translateY(-2px);
}

.craft-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.craft-all-btn {
    background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
    color: white;
    border: 2px solid #7cfc00;
}

.craft-all-btn:hover:not(:disabled) {
    background: linear-gradient(135deg, #45a049 0%, #55b055 100%);
    transform: translateY(-2px);
}

.craft-all-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.clear-btn {
    background: rgba(255, 50, 50, 0.2);
    color: #ff5555;
    border: 2px solid #ff5555;
}

.clear-btn:hover {
    background: rgba(255, 50, 50, 0.4);
    transform: translateY(-2px);
}

.fuel-slot-container {
    width: 200px;
    padding: 15px;
    background: rgba(0, 0, 30, 0.5);
    border-radius: 10px;
    border: 1px solid rgba(255, 100, 100, 0.3);
}

.fuel-slot-container h3 {
    color: #ff5555;
    margin-bottom: 15px;
    display: flex;
    align-items: center;
    gap: 10px;
}

.fuel-slot {
    width: 60px;
    height: 60px;
    margin: 0 auto 15px;
}

.fuel-info {
    color: #88a;
    font-size: 0.9rem;
}

.fuel-info div {
    margin-bottom: 5px;
}

.crafting-footer {
    padding: 15px 30px;
    background: rgba(0, 0, 30, 0.7);
    border-top: 2px solid rgba(100, 150, 255, 0.2);
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.hint {
    color: #88a;
    font-size: 0.9rem;
    display: flex;
    align-items: center;
    gap: 10px;
}

.shortcuts {
    display: flex;
    gap: 20px;
}

.shortcut {
    display: flex;
    align-items: center;
    gap: 5px;
    color: #aac;
    font-size: 0.9rem;
}

.shortcut kbd {
    background: rgba(255, 255, 255, 0.1);
    padding: 2px 8px;
    border-radius: 4px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    font-family: monospace;
}

.crafting-message {
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 15px 20px;
    background: rgba(0, 0, 30, 0.9);
    border-radius: 10px;
    border: 2px solid;
    display: flex;
    align-items: center;
    gap: 10px;
    z-index: 1001;
    animation: slideIn 0.3s ease;
}

.crafting-message.success {
    border-color: #7cfc00;
    color: #7cfc00;
}

.crafting-message.error {
    border-color: #ff5555;
    color: #ff5555;
}

.crafting-message.info {
    border-color: #64b5f6;
    color: #64b5f6;
}

.crafting-message.fade-out {
    animation: fadeOut 0.3s ease forwards;
}

@keyframes slideIn {
    from {
        transform: translateX(100%);
        opacity: 0;
    }
    to {
        transform: translateX(0);
        opacity: 1;
    }
}

@keyframes fadeOut {
    from {
        opacity: 1;
    }
    to {
        opacity: 0;
        transform: translateY(-20px);
    }
}

.no-recipes {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #88a;
    text-align: center;
}

.no-recipes i {
    font-size: 3rem;
    margin-bottom: 20px;
    opacity: 0.5;
}

.no-recipes .hint {
    margin-top: 10px;
    font-size: 0.8rem;
    color: #666;
}

/* Адаптивность */
@media (max-width: 1024px) {
    .crafting-container {
        width: 95%;
        height: 95%;
    }
    
    .crafting-main {
        flex-direction: column;
    }
    
    .categories {
        width: 100%;
        flex-direction: row;
        justify-content: space-between;
    }
    
    .category-tabs {
        flex-direction: row;
        flex-wrap: wrap;
    }
    
    .search-box {
        width: 200px;
    }
    
    .recipes-container {
        flex-direction: column;
    }
    
    .recipe-details {
        width: 100%;
        max-height: 300px;
    }
    
    .crafting-slots {
        flex-wrap: wrap;
        justify-content: center;
    }
    
    .input-slots {
        order: 1;
    }
    
    .crafting-process {
        order: 2;
    }
    
    .crafting-controls {
        order: 3;
        width: 100%;
        flex-direction: row;
    }
    
    .fuel-slot-container {
        order: 4;
        width: 100%;
    }
}

@media (max-width: 768px) {
    .crafting-header h2 {
        font-size: 1.4rem;
    }
    
    .workstation-tabs {
        flex-direction: column;
    }
    
    .crafting-footer {
        flex-direction: column;
        gap: 15px;
        text-align: center;
    }
    
    .shortcuts {
        flex-wrap: wrap;
        justify-content: center;
    }
}
`;

// Добавляем стили в документ
const styleElement = document.createElement('style');
styleElement.textContent = craftingStyles;
document.head.appendChild(styleElement);

export { CraftingUI };