import EventBus from '@/utils/EventBus.js';

export default class MenuSystem {
    constructor() {
        this.currentMenu = null;
        this.menus = new Map();
        this.history = [];
        this.isVisible = false;
        
        this.setupMenus();
        this.setupEventListeners();
    }
    
    setupMenus() {
        // Главное меню
        this.menus.set('main', this.createMainMenu());
        
        // Меню паузы
        this.menus.set('pause', this.createPauseMenu());
        
        // Меню настроек
        this.menus.set('settings', this.createSettingsMenu());
        
        // Меню инвентаря
        this.menus.set('inventory', this.createInventoryMenu());
        
        // Меню крафта
        this.menus.set('crafting', this.createCraftingMenu());
    }
    
    createMainMenu() {
        return {
            id: 'main',
            title: 'TERRACRAFT',
            subtitle: '2D Песочница',
            background: 'linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)',
            buttons: [
                {
                    id: 'continue',
                    text: 'Продолжить',
                    icon: '▶️',
                    action: () => this.hide()
                },
                {
                    id: 'new_game',
                    text: 'Новая игра',
                    icon: '🆕',
                    action: () => {
                        EventBus.emit('menu:new_game');
                        this.hide();
                    }
                },
                {
                    id: 'load_game',
                    text: 'Загрузить игру',
                    icon: '📂',
                    action: () => {
                        EventBus.emit('menu:load_game');
                        this.showMenu('load');
                    }
                },
                {
                    id: 'settings',
                    text: 'Настройки',
                    icon: '⚙️',
                    action: () => this.showMenu('settings')
                },
                {
                    id: 'credits',
                    text: 'Создатели',
                    icon: '👨‍💻',
                    action: () => this.showMenu('credits')
                },
                {
                    id: 'quit',
                    text: 'Выйти',
                    icon: '🚪',
                    action: () => {
                        if (confirm('Выйти из игры?')) {
                            EventBus.emit('menu:quit');
                        }
                    }
                }
            ],
            footer: 'v1.0.0 | Made with ❤️'
        };
    }
    
    createPauseMenu() {
        return {
            id: 'pause',
            title: 'ПАУЗА',
            background: 'rgba(0, 0, 0, 0.8)',
            buttons: [
                {
                    id: 'resume',
                    text: 'Продолжить',
                    icon: '▶️',
                    action: () => this.hide()
                },
                {
                    id: 'save',
                    text: 'Сохранить игру',
                    icon: '💾',
                    action: () => {
                        EventBus.emit('menu:save_game');
                        this.showNotification('Игра сохранена!');
                    }
                },
                {
                    id: 'inventory',
                    text: 'Инвентарь',
                    icon: '🎒',
                    action: () => this.showMenu('inventory')
                },
                {
                    id: 'settings',
                    text: 'Настройки',
                    icon: '⚙️',
                    action: () => this.showMenu('settings')
                },
                {
                    id: 'main_menu',
                    text: 'В главное меню',
                    icon: '🏠',
                    action: () => {
                        if (confirm('Вернуться в главное меню? Несохранённый прогресс будет потерян.')) {
                            EventBus.emit('menu:to_main');
                            this.showMenu('main');
                        }
                    }
                },
                {
                    id: 'quit',
                    text: 'Выйти',
                    icon: '🚪',
                    action: () => {
                        if (confirm('Выйти из игры?')) {
                            EventBus.emit('menu:quit');
                        }
                    }
                }
            ],
            stats: true // Показывать статистику
        };
    }
    
    createSettingsMenu() {
        return {
            id: 'settings',
            title: 'НАСТРОЙКИ',
            background: 'rgba(0, 0, 30, 0.9)',
            sections: [
                {
                    title: 'Графика',
                    settings: [
                        {
                            id: 'resolution',
                            type: 'select',
                            label: 'Разрешение',
                            value: '1280x720',
                            options: [
                                { value: '1280x720', label: '1280x720 (HD)' },
                                { value: '1920x1080', label: '1920x1080 (Full HD)' },
                                { value: '2560x1440', label: '2560x1440 (2K)' }
                            ],
                            onChange: (value) => EventBus.emit('settings:resolution', { value })
                        },
                        {
                            id: 'render_distance',
                            type: 'slider',
                            label: 'Дальность прорисовки',
                            value: 16,
                            min: 4,
                            max: 32,
                            step: 4,
                            onChange: (value) => EventBus.emit('settings:render_distance', { value })
                        },
                        {
                            id: 'particles',
                            type: 'toggle',
                            label: 'Частицы',
                            value: true,
                            onChange: (value) => EventBus.emit('settings:particles', { value })
                        },
                        {
                            id: 'shadows',
                            type: 'toggle',
                            label: 'Тени',
                            value: true,
                            onChange: (value) => EventBus.emit('settings:shadows', { value })
                        }
                    ]
                },
                {
                    title: 'Звук',
                    settings: [
                        {
                            id: 'master_volume',
                            type: 'slider',
                            label: 'Общая громкость',
                            value: 80,
                            min: 0,
                            max: 100,
                            onChange: (value) => EventBus.emit('settings:master_volume', { value })
                        },
                        {
                            id: 'music_volume',
                            type: 'slider',
                            label: 'Громкость музыки',
                            value: 60,
                            min: 0,
                            max: 100,
                            onChange: (value) => EventBus.emit('settings:music_volume', { value })
                        },
                        {
                            id: 'sfx_volume',
                            type: 'slider',
                            label: 'Громкость эффектов',
                            value: 80,
                            min: 0,
                            max: 100,
                            onChange: (value) => EventBus.emit('settings:sfx_volume', { value })
                        }
                    ]
                },
                {
                    title: 'Управление',
                    settings: [
                        {
                            id: 'mouse_sensitivity',
                            type: 'slider',
                            label: 'Чувствительность мыши',
                            value: 1.0,
                            min: 0.1,
                            max: 3.0,
                            step: 0.1,
                            onChange: (value) => EventBus.emit('settings:mouse_sensitivity', { value })
                        },
                        {
                            id: 'invert_y',
                            type: 'toggle',
                            label: 'Инвертировать ось Y',
                            value: false,
                            onChange: (value) => EventBus.emit('settings:invert_y', { value })
                        }
                    ]
                }
            ],
            buttons: [
                {
                    id: 'apply',
                    text: 'Применить',
                    icon: '✅',
                    action: () => {
                        EventBus.emit('settings:apply');
                        this.showNotification('Настройки применены');
                        this.goBack();
                    }
                },
                {
                    id: 'defaults',
                    text: 'По умолчанию',
                    icon: '🔄',
                    action: () => {
                        EventBus.emit('settings:reset_defaults');
                        this.showNotification('Настройки сброшены');
                    }
                },
                {
                    id: 'back',
                    text: 'Назад',
                    icon: '⬅️',
                    action: () => this.goBack()
                }
            ]
        };
    }
    
    createInventoryMenu() {
        return {
            id: 'inventory',
            title: 'ИНВЕНТАРЬ',
            background: 'rgba(30, 30, 46, 0.95)',
            layout: 'inventory',
            slots: {
                hotbar: 9,
                main: 27,
                armor: 4,
                crafting: 4,
                result: 1
            },
            categories: [
                { id: 'all', name: 'Все', icon: '📦' },
                { id: 'blocks', name: 'Блоки', icon: '🧱' },
                { id: 'tools', name: 'Инструменты', icon: '🛠️' },
                { id: 'weapons', name: 'Оружие', icon: '⚔️' },
                { id: 'consumables', name: 'Расходники', icon: '🍖' }
            ],
            buttons: [
                {
                    id: 'sort',
                    text: 'Сортировать',
                    icon: '🔃',
                    action: () => EventBus.emit('inventory:sort')
                },
                {
                    id: 'craft',
                    text: 'Крафт',
                    icon: '🧪',
                    action: () => this.showMenu('crafting')
                },
                {
                    id: 'back',
                    text: 'Назад',
                    icon: '⬅️',
                    action: () => this.goBack()
                }
            ]
        };
    }
    
    createCraftingMenu() {
        return {
            id: 'crafting',
            title: 'КРАФТ',
            background: 'rgba(46, 46, 62, 0.95)',
            layout: 'crafting',
            categories: [
                { id: 'all', name: 'Все рецепты' },
                { id: 'tools', name: 'Инструменты' },
                { id: 'weapons', name: 'Оружие' },
                { id: 'blocks', name: 'Блоки' },
                { id: 'decorative', name: 'Декорации' }
            ],
            workstations: [
                { id: 'hand', name: 'Ручной крафт' },
                { id: 'crafting_table', name: 'Верстак' },
                { id: 'furnace', name: 'Печь' }
            ],
            buttons: [
                {
                    id: 'back',
                    text: 'Назад',
                    icon: '⬅️',
                    action: () => this.goBack()
                }
            ]
        };
    }
    
    showMenu(menuId) {
        const menu = this.menus.get(menuId);
        if (!menu) {
            console.error(`Меню ${menuId} не найдено`);
            return;
        }
        
        // Сохраняем предыдущее меню в истории
        if (this.currentMenu) {
            this.history.push(this.currentMenu.id);
        }
        
        this.currentMenu = menu;
        this.isVisible = true;
        
        EventBus.emit('menu:show', { 
            menuId,
            menu,
            history: [...this.history]
        });
        
        this.render();
    }
    
    hide() {
        this.isVisible = false;
        this.currentMenu = null;
        this.history = [];
        
        EventBus.emit('menu:hide');
        this.clearRender();
    }
    
    goBack() {
        if (this.history.length === 0) {
            this.hide();
            return;
        }
        
        const prevMenuId = this.history.pop();
        this.showMenu(prevMenuId);
    }
    
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.showMenu('pause');
        }
    }
    
    render() {
        if (!this.currentMenu || !this.isVisible) return;
        
        this.clearRender();
        
        const container = document.createElement('div');
        container.id = 'menu-container';
        container.className = 'menu-container';
        
        // Фон
        const overlay = document.createElement('div');
        overlay.className = 'menu-overlay';
        overlay.style.background = this.currentMenu.background || 'rgba(0, 0, 0, 0.8)';
        
        // Основной контейнер
        const menuElement = document.createElement('div');
        menuElement.className = 'menu';
        
        // Заголовок
        if (this.currentMenu.title) {
            const title = document.createElement('h1');
            title.className = 'menu-title';
            title.textContent = this.currentMenu.title;
            menuElement.appendChild(title);
        }
        
        if (this.currentMenu.subtitle) {
            const subtitle = document.createElement('p');
            subtitle.className = 'menu-subtitle';
            subtitle.textContent = this.currentMenu.subtitle;
            menuElement.appendChild(subtitle);
        }
        
        // Рендер в зависимости от типа меню
        if (this.currentMenu.sections) {
            this.renderSections(menuElement);
        } else if (this.currentMenu.layout === 'inventory') {
            this.renderInventory(menuElement);
        } else if (this.currentMenu.layout === 'crafting') {
            this.renderCrafting(menuElement);
        } else {
            this.renderButtons(menuElement);
        }
        
        // Подвал
        if (this.currentMenu.footer) {
            const footer = document.createElement('div');
            footer.className = 'menu-footer';
            footer.textContent = this.currentMenu.footer;
            menuElement.appendChild(footer);
        }
        
        container.appendChild(overlay);
        container.appendChild(menuElement);
        document.body.appendChild(container);
        
        // Статистика для меню паузы
        if (this.currentMenu.stats) {
            this.renderStats(menuElement);
        }
    }
    
    renderButtons(container) {
        if (!this.currentMenu.buttons) return;
        
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'menu-buttons';
        
        this.currentMenu.buttons.forEach(button => {
            const btn = document.createElement('button');
            btn.className = 'menu-button';
            btn.dataset.id = button.id;
            
            if (button.icon) {
                const icon = document.createElement('span');
                icon.className = 'menu-button-icon';
                icon.textContent = button.icon;
                btn.appendChild(icon);
            }
            
            const text = document.createElement('span');
            text.className = 'menu-button-text';
            text.textContent = button.text;
            btn.appendChild(text);
            
            btn.addEventListener('click', () => {
                if (button.action) button.action();
            });
            
            buttonContainer.appendChild(btn);
        });
        
        container.appendChild(buttonContainer);
    }
    
    renderSections(container) {
        this.currentMenu.sections.forEach(section => {
            const sectionElement = document.createElement('div');
            sectionElement.className = 'menu-section';
            
            const title = document.createElement('h2');
            title.className = 'menu-section-title';
            title.textContent = section.title;
            sectionElement.appendChild(title);
            
            section.settings.forEach(setting => {
                const settingElement = this.createSettingElement(setting);
                sectionElement.appendChild(settingElement);
            });
            
            container.appendChild(sectionElement);
        });
        
        // Кнопки после секций
        if (this.currentMenu.buttons) {
            this.renderButtons(container);
        }
    }
    
    createSettingElement(setting) {
        const element = document.createElement('div');
        element.className = 'menu-setting';
        
        const label = document.createElement('label');
        label.textContent = setting.label;
        element.appendChild(label);
        
        let input;
        
        switch(setting.type) {
            case 'select':
                input = document.createElement('select');
                setting.options.forEach(option => {
                    const opt = document.createElement('option');
                    opt.value = option.value;
                    opt.textContent = option.label;
                    if (option.value === setting.value) opt.selected = true;
                    input.appendChild(opt);
                });
                break;
                
            case 'slider':
                input = document.createElement('input');
                input.type = 'range';
                input.min = setting.min;
                input.max = setting.max;
                input.step = setting.step || 1;
                input.value = setting.value;
                
                const valueDisplay = document.createElement('span');
                valueDisplay.className = 'slider-value';
                valueDisplay.textContent = setting.value;
                
                input.addEventListener('input', () => {
                    valueDisplay.textContent = input.value;
                });
                
                element.appendChild(valueDisplay);
                break;
                
            case 'toggle':
                input = document.createElement('input');
                input.type = 'checkbox';
                input.checked = setting.value;
                break;
                
            default:
                input = document.createElement('input');
                input.type = 'text';
                input.value = setting.value || '';
        }
        
        input.addEventListener('change', () => {
            let value;
            switch(setting.type) {
                case 'select': value = input.value; break;
                case 'slider': value = parseFloat(input.value); break;
                case 'toggle': value = input.checked; break;
                default: value = input.value;
            }
            
            if (setting.onChange) {
                setting.onChange(value);
            }
        });
        
        element.appendChild(input);
        return element;
    }
    
    renderInventory(container) {
        // TODO: Реализовать рендер инвентаря
        const placeholder = document.createElement('div');
        placeholder.className = 'inventory-placeholder';
        placeholder.textContent = 'Инвентарь (в разработке)';
        container.appendChild(placeholder);
        
        if (this.currentMenu.buttons) {
            this.renderButtons(container);
        }
    }
    
    renderCrafting(container) {
        // TODO: Реализовать рендер крафта
        const placeholder = document.createElement('div');
        placeholder.className = 'crafting-placeholder';
        placeholder.textContent = 'Крафт (в разработке)';
        container.appendChild(placeholder);
        
        if (this.currentMenu.buttons) {
            this.renderButtons(container);
        }
    }
    
    renderStats(container) {
        const stats = document.createElement('div');
        stats.className = 'menu-stats';
        
        // TODO: Получить реальную статистику
        const statData = {
            'Время игры': '0:00',
            'Уровень': '1',
            'Здоровье': '100/100',
            'Собрано блоков': '0'
        };
        
        for (const [label, value] of Object.entries(statData)) {
            const stat = document.createElement('div');
            stat.className = 'menu-stat';
            
            const statLabel = document.createElement('span');
            statLabel.className = 'stat-label';
            statLabel.textContent = label + ':';
            
            const statValue = document.createElement('span');
            statValue.className = 'stat-value';
            statValue.textContent = value;
            
            stat.appendChild(statLabel);
            stat.appendChild(statValue);
            stats.appendChild(stat);
        }
        
        container.appendChild(stats);
    }
    
    clearRender() {
        const existing = document.getElementById('menu-container');
        if (existing) {
            existing.remove();
        }
    }
    
    showNotification(message, duration = 3000) {
        const notification = document.createElement('div');
        notification.className = 'menu-notification';
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Анимация появления
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        // Автоудаление
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }, duration);
    }
    
    setupEventListeners() {
        // Глобальные горячие клавиши
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.toggle();
            }
            
            if (e.key === 'i' || e.key === 'e') {
                if (!this.isVisible) {
                    this.showMenu('inventory');
                    e.preventDefault();
                }
            }
        });
        
        // События от игры
        EventBus.on('game:pause', () => {
            this.showMenu('pause');
        });
        
        EventBus.on('game:resume', () => {
            this.hide();
        });
        
        EventBus.on('ui:show_menu', (data) => {
            this.showMenu(data.menuId);
        });
        
        EventBus.on('ui:hide_menu', () => {
            this.hide();
        });
        
        EventBus.on('ui:notification', (data) => {
            this.showNotification(data.message, data.duration);
        });
    }
}