import EventBus from '@/utils/EventBus.js';

export default class CraftingSystem {
  constructor() {
    this.recipes = new Map();
    this.categories = new Set();
    this.workstations = new Map();
    
    this.loaded = false;
    
    this.setupEventListeners();
  }

  async loadRecipes() {
    try {
      console.log('📚 Загрузка рецептов...');
      const response = await fetch('/assets/data/recipes.json');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      
      for (const recipe of (data.recipes || [])) {
        this.addRecipe(recipe);
      }
      
      for (const workstation of (data.workstations || [])) {
        this.addWorkstation(workstation);
      }
      
      this.loaded = true;
      EventBus.emit('crafting:loaded', { count: this.recipes.size });
      
      console.log(`✅ Загружено ${this.recipes.size} рецептов`);
    } catch (error) {
      console.error('❌ Ошибка загрузки рецептов:', error);
      this.loadFallbackRecipes();
    }
  }

  addRecipe(recipe) {
    const recipeId = recipe.id || `${recipe.output.id}_${Date.now()}`;
    
    this.recipes.set(recipeId, {
      id: recipeId,
      name: recipe.name,
      output: recipe.output,
      ingredients: recipe.ingredients,
      category: recipe.category || 'misc',
      workstation: recipe.workstation,
      time: recipe.time || 1.0,
      experience: recipe.experience || 0,
      unlockedByDefault: recipe.unlockedByDefault !== false,
      unlockRequirement: recipe.unlockRequirement
    });
    
    // Добавление категории
    if (recipe.category) {
      this.categories.add(recipe.category);
    }
  }

  addWorkstation(workstation) {
    this.workstations.set(workstation.id, {
      id: workstation.id,
      name: workstation.name,
      tier: workstation.tier || 1,
      recipes: workstation.recipes || [],
      fuelSlots: workstation.fuelSlots || 0,
      inputSlots: workstation.inputSlots || 1,
      outputSlots: workstation.outputSlots || 1
    });
  }

  canCraft(recipeId, inventory, workstationId = null) {
    const recipe = this.recipes.get(recipeId);
    if (!recipe) return false;
    
    // Проверка верстака
    if (recipe.workstation && workstationId !== recipe.workstation) {
      return false;
    }
    
    // Проверка ингредиентов
    for (const ingredient of recipe.ingredients) {
      if (!this.hasIngredient(ingredient, inventory)) {
        return false;
      }
    }
    
    return true;
  }

  hasIngredient(ingredient, inventory) {
    let totalCount = 0;
    
    // Подсчет количества ингредиента в инвентаре
    for (const slot of [...inventory.hotbar, ...inventory.main]) {
      if (slot && slot.id === ingredient.id) {
        totalCount += slot.count;
      }
    }
    
    return totalCount >= ingredient.count;
  }

  craft(recipeId, inventory, workstationId = null) {
    const recipe = this.recipes.get(recipeId);
    if (!recipe) return null;
    
    if (!this.canCraft(recipeId, inventory, workstationId)) {
      EventBus.emit('crafting:failed', { recipeId, reason: 'missing_ingredients' });
      return null;
    }
    
    // Удаление ингредиентов
    for (const ingredient of recipe.ingredients) {
      this.removeIngredients(ingredient, inventory);
    }
    
    // Создание результата
    const result = {
      id: recipe.output.id,
      count: recipe.output.count || 1,
      metadata: recipe.output.metadata || {}
    };
    
    EventBus.emit('crafting:success', {
      recipeId,
      result,
      experience: recipe.experience
    });
    
    return result;
  }

  removeIngredients(ingredient, inventory) {
    let remaining = ingredient.count;
    
    // Удаление из горячей панели
    for (let i = 0; i < inventory.hotbar.length && remaining > 0; i++) {
      const slot = inventory.hotbar[i];
      if (slot && slot.id === ingredient.id) {
        const take = Math.min(slot.count, remaining);
        slot.count -= take;
        remaining -= take;
        
        if (slot.count <= 0) {
          inventory.hotbar[i] = null;
        }
      }
    }
    
    // Удаление из основного инвентаря
    for (let i = 0; i < inventory.main.length && remaining > 0; i++) {
      const slot = inventory.main[i];
      if (slot && slot.id === ingredient.id) {
        const take = Math.min(slot.count, remaining);
        slot.count -= take;
        remaining -= take;
        
        if (slot.count <= 0) {
          inventory.main[i] = null;
        }
      }
    }
    
    EventBus.emit('inventory:changed');
  }

  getRecipesByCategory(category) {
    const recipes = [];
    
    for (const [id, recipe] of this.recipes) {
      if (recipe.category === category) {
        recipes.push({ id, ...recipe });
      }
    }
    
    return recipes;
  }

  getRecipesForWorkstation(workstationId) {
    const recipes = [];
    
    for (const [id, recipe] of this.recipes) {
      if (!recipe.workstation || recipe.workstation === workstationId) {
        recipes.push({ id, ...recipe });
      }
    }
    
    return recipes;
  }

  getRecipeByOutput(itemId) {
    for (const [id, recipe] of this.recipes) {
      if (recipe.output.id === itemId) {
        return { id, ...recipe };
      }
    }
    
    return null;
  }

  setupEventListeners() {
    EventBus.on('crafting:check', (data) => {
      const canCraft = this.canCraft(data.recipeId, data.inventory, data.workstation);
      EventBus.emit('crafting:check_result', {
        recipeId: data.recipeId,
        canCraft,
        required: this.getMissingIngredients(data.recipeId, data.inventory)
      });
    });
    
    EventBus.on('crafting:perform', (data) => {
      const result = this.craft(data.recipeId, data.inventory, data.workstation);
      if (result) {
        EventBus.emit('crafting:complete', { result, recipeId: data.recipeId });
      }
    });
  }

  getMissingIngredients(recipeId, inventory) {
    const recipe = this.recipes.get(recipeId);
    if (!recipe) return [];
    
    const missing = [];
    
    for (const ingredient of recipe.ingredients) {
      const has = this.hasIngredient(ingredient, inventory);
      if (!has) {
        missing.push(ingredient);
      }
    }
    
    return missing;
  }

  loadFallbackRecipes() {
    console.log('⚠️ Использование резервных рецептов');
    
    const fallbackRecipes = [
      {
        id: 'wood_planks',
        name: 'Доски',
        output: { id: 5, count: 4 },
        ingredients: [{ id: 4, count: 1 }],
        category: 'basic',
        unlockedByDefault: true
      },
      {
        id: 'stick',
        name: 'Палка',
        output: { id: 6, count: 4 },
        ingredients: [{ id: 5, count: 2 }],
        category: 'basic',
        unlockedByDefault: true
      },
      {
        id: 'wooden_pickaxe',
        name: 'Деревянная кирка',
        output: { id: 7, count: 1 },
        ingredients: [
          { id: 5, count: 3 },
          { id: 6, count: 2 }
        ],
        category: 'tools',
        unlockedByDefault: true
      },
      {
        id: 'crafting_table',
        name: 'Верстак',
        output: { id: 8, count: 1 },
        ingredients: [{ id: 5, count: 4 }],
        category: 'workstations',
        unlockedByDefault: true
      },
      {
        id: 'furnace',
        name: 'Печь',
        output: { id: 9, count: 1 },
        ingredients: [{ id: 3, count: 8 }],
        category: 'workstations',
        workstation: 'crafting_table',
        unlockedByDefault: false
      }
    ];
    
    for (const recipe of fallbackRecipes) {
      this.addRecipe(recipe);
    }
    
    this.loaded = true;
  }
}