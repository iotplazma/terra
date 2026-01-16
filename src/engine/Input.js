import EventBus from '@/utils/EventBus.js';
import Vector2 from '@/utils/Vector2.js';

export default class Input {
    constructor() {
        this.keys = new Set();
        this.keyStates = new Map();
        this.mouse = {
            position: new Vector2(0, 0),
            delta: new Vector2(0, 0),
            buttons: new Set(),
            buttonStates: new Map(),
            wheel: 0,
            locked: false
        };
        
        this.gamepads = new Map();
        this.touch = {
            active: false,
            touches: new Map(),
            startPos: new Vector2(0, 0),
            currentPos: new Vector2(0, 0)
        };
        
        this.bindings = new Map();
        this.actions = new Map();
        this.deadzone = 0.1;
        this.sensitivity = 1.0;
        
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        
        this.setupDefaultBindings();
        this.setupEventListeners();
    }

    init() {
        console.log('🎮 Инициализация системы ввода...');
        
        // Запрос захвата указателя при клике
        document.addEventListener('click', () => {
            if (!this.mouse.locked) {
                this.requestPointerLock();
            }
        });
        
        // Обновление состояния геймпадов
        window.addEventListener('gamepadconnected', (e) => {
            this.handleGamepadConnected(e);
        });
        
        window.addEventListener('gamepaddisconnected', (e) => {
            this.handleGamepadDisconnected(e);
        });
        
        console.log('✅ Система ввода готова');
    }

    setupDefaultBindings() {
        // Клавиатура
        this.bindings.set('move_forward', ['KeyW', 'ArrowUp']);
        this.bindings.set('move_backward', ['KeyS', 'ArrowDown']);
        this.bindings.set('move_left', ['KeyA', 'ArrowLeft']);
        this.bindings.set('move_right', ['KeyD', 'ArrowRight']);
        this.bindings.set('jump', ['Space']);
        this.bindings.set('sprint', ['ShiftLeft']);
        this.bindings.set('crouch', ['ControlLeft']);
        this.bindings.set('interact', ['KeyE']);
        this.bindings.set('inventory', ['KeyI', 'Tab']);
        this.bindings.set('pause', ['Escape']);
        this.bindings.set('debug', ['F3']);
        
        // Мышь
        this.bindings.set('primary_action', ['Mouse0']);
        this.bindings.set('secondary_action', ['Mouse2']);
        this.bindings.set('middle_action', ['Mouse1']);
        
        // Геймпад
        this.bindings.set('gamepad_move', ['LeftStick']);
        this.bindings.set('gamepad_look', ['RightStick']);
        this.bindings.set('gamepad_jump', ['Button0']); // A
        this.bindings.set('gamepad_interact', ['Button2']); // X
        this.bindings.set('gamepad_menu', ['Button9']); // Start
    }

    setupEventListeners() {
        // Клавиатура
        document.addEventListener('keydown', (e) => {
            this.handleKeyDown(e);
        });
        
        document.addEventListener('keyup', (e) => {
            this.handleKeyUp(e);
        });
        
        // Мышь
        document.addEventListener('mousedown', (e) => {
            this.handleMouseDown(e);
        });
        
        document.addEventListener('mouseup', (e) => {
            this.handleMouseUp(e);
        });
        
        document.addEventListener('mousemove', (e) => {
            this.handleMouseMove(e);
        });
        
        document.addEventListener('wheel', (e) => {
            this.handleMouseWheel(e);
        });
        
        document.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
        
        // Касания (тачскрин)
        document.addEventListener('touchstart', (e) => {
            this.handleTouchStart(e);
        }, { passive: false });
        
        document.addEventListener('touchmove', (e) => {
            this.handleTouchMove(e);
        }, { passive: false });
        
        document.addEventListener('touchend', (e) => {
            this.handleTouchEnd(e);
        });
        
        // Захват указателя
        document.addEventListener('pointerlockchange', () => {
            this.mouse.locked = document.pointerLockElement !== null;
        });
        
        document.addEventListener('pointerlockerror', () => {
            console.warn('Не удалось захватить указатель');
            this.mouse.locked = false;
        });
    }

    handleKeyDown(e) {
        const key = e.code;
        this.keys.add(key);
        this.keyStates.set(key, { pressed: true, timestamp: Date.now() });
        
        // Отмена стандартных действий
        if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
            e.preventDefault();
        }
        
        // Обработка действий
        this.processAction('keydown', key);
        EventBus.emit('input:keydown', { key, code: e.code, repeat: e.repeat });
    }

    handleKeyUp(e) {
        const key = e.code;
        this.keys.delete(key);
        this.keyStates.set(key, { pressed: false, timestamp: Date.now() });
        
        this.processAction('keyup', key);
        EventBus.emit('input:keyup', { key, code: e.code });
    }

    handleMouseDown(e) {
        const button = `Mouse${e.button}`;
        this.mouse.buttons.add(button);
        this.mouse.buttonStates.set(button, { pressed: true, timestamp: Date.now() });
        
        this.processAction('mousedown', button);
        EventBus.emit('input:mousedown', {
            button: e.button,
            x: e.clientX,
            y: e.clientY,
            screenX: e.screenX,
            screenY: e.screenY
        });
    }

    handleMouseUp(e) {
        const button = `Mouse${e.button}`;
        this.mouse.buttons.delete(button);
        this.mouse.buttonStates.set(button, { pressed: false, timestamp: Date.now() });
        
        this.processAction('mouseup', button);
        EventBus.emit('input:mouseup', {
            button: e.button,
            x: e.clientX,
            y: e.clientY
        });
    }

    handleMouseMove(e) {
        // Расчет дельты движения
        if (this.mouse.locked) {
            this.mouse.delta.x += e.movementX * this.sensitivity;
            this.mouse.delta.y += e.movementY * this.sensitivity;
        }
        
        this.mouse.position.set(e.clientX, e.clientY);
        
        // Обновление последней позиции
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        
        EventBus.emit('input:mousemove', {
            x: e.clientX,
            y: e.clientY,
            movementX: e.movementX,
            movementY: e.movementY,
            delta: this.mouse.delta.clone()
        });
    }

    handleMouseWheel(e) {
        this.mouse.wheel = Math.sign(e.deltaY);
        
        EventBus.emit('input:wheel', {
            delta: e.deltaY,
            direction: this.mouse.wheel
        });
        
        // Сброс через кадр
        setTimeout(() => {
            this.mouse.wheel = 0;
        }, 16);
    }

    handleTouchStart(e) {
        e.preventDefault();
        this.touch.active = true;
        
        const touch = e.touches[0];
        this.touch.startPos.set(touch.clientX, touch.clientY);
        this.touch.currentPos.copy(this.touch.startPos);
        
        // Регистрация касаний
        for (let i = 0; i < e.touches.length; i++) {
            const touch = e.touches[i];
            this.touch.touches.set(touch.identifier, {
                x: touch.clientX,
                y: touch.clientY,
                startX: touch.clientX,
                startY: touch.clientY
            });
        }
        
        EventBus.emit('input:touchstart', {
            touches: Array.from(this.touch.touches.values()),
            startPos: this.touch.startPos.clone()
        });
    }

    handleTouchMove(e) {
        e.preventDefault();
        
        if (!this.touch.active) return;
        
        // Обновление позиций касаний
        for (let i = 0; i < e.touches.length; i++) {
            const touch = e.touches[i];
            const touchData = this.touch.touches.get(touch.identifier);
            
            if (touchData) {
                touchData.x = touch.clientX;
                touchData.y = touch.clientY;
            }
        }
        
        // Основное касание для управления
        if (e.touches[0]) {
            const touch = e.touches[0];
            this.touch.currentPos.set(touch.clientX, touch.clientY);
            
            // Расчет свайпа
            const delta = Vector2.subtract(this.touch.currentPos, this.touch.startPos);
            
            EventBus.emit('input:touchmove', {
                currentPos: this.touch.currentPos.clone(),
                delta: delta,
                touches: Array.from(this.touch.touches.values())
            });
        }
    }

    handleTouchEnd(e) {
        e.preventDefault();
        
        // Удаление завершенных касаний
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            this.touch.touches.delete(touch.identifier);
        }
        
        // Если касаний не осталось
        if (this.touch.touches.size === 0) {
            this.touch.active = false;
            
            // Определение типа жеста
            const delta = Vector2.subtract(this.touch.currentPos, this.touch.startPos);
            const distance = delta.length();
            
            if (distance > 10) {
                // Свайп
                EventBus.emit('input:swipe', {
                    direction: delta.normalize(),
                    distance: distance,
                    startPos: this.touch.startPos.clone(),
                    endPos: this.touch.currentPos.clone()
                });
            } else {
                // Тап
                EventBus.emit('input:tap', {
                    position: this.touch.currentPos.clone()
                });
            }
        }
        
        EventBus.emit('input:touchend', {
            remainingTouches: this.touch.touches.size
        });
    }

    handleGamepadConnected(e) {
        const gamepad = e.gamepad;
        console.log(`🎮 Геймпад подключен: ${gamepad.id}`);
        
        this.gamepads.set(gamepad.index, {
            id: gamepad.id,
            index: gamepad.index,
            buttons: new Array(gamepad.buttons.length).fill({ pressed: false, value: 0 }),
            axes: new Array(gamepad.axes.length).fill(0),
            timestamp: Date.now(),
            vibration: gamepad.vibrationActuator ? {
                canVibrate: true,
                type: gamepad.vibrationActuator.type
            } : null
        });
        
        EventBus.emit('input:gamepadconnected', {
            id: gamepad.id,
            index: gamepad.index
        });
    }

    handleGamepadDisconnected(e) {
        const gamepad = e.gamepad;
        console.log(`🎮 Геймпад отключен: ${gamepad.id}`);
        
        this.gamepads.delete(gamepad.index);
        EventBus.emit('input:gamepaddisconnected', {
            id: gamepad.id,
            index: gamepad.index
        });
    }

    update() {
        // Обновление геймпадов
        this.updateGamepads();
        
        // Обработка непрерывных действий
        this.processContinuousActions();
        
        // Сброс дельты мыши
        this.mouse.delta.set(0, 0);
    }

    updateGamepads() {
        const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        
        for (let i = 0; i < gamepads.length; i++) {
            const gamepad = gamepads[i];
            if (!gamepad) continue;
            
            const state = this.gamepads.get(i);
            if (!state) continue;
            
            // Обновление кнопок
            for (let j = 0; j < gamepad.buttons.length; j++) {
                const button = gamepad.buttons[j];
                const prevState = state.buttons[j];
                
                state.buttons[j] = {
                    pressed: button.pressed,
                    value: button.value,
                    timestamp: Date.now()
                };
                
                // Определение нажатия/отпускания
                if (button.pressed && (!prevState || !prevState.pressed)) {
                    this.processAction('gamepaddown', `Button${j}`, i);
                    EventBus.emit('input:gamepaddown', {
                        button: j,
                        gamepad: i,
                        value: button.value
                    });
                } else if (!button.pressed && prevState && prevState.pressed) {
                    this.processAction('gamepadup', `Button${j}`, i);
                    EventBus.emit('input:gamepadup', {
                        button: j,
                        gamepad: i,
                        value: button.value
                    });
                }
            }
            
            // Обновление осей с мертвой зоной
            for (let j = 0; j < gamepad.axes.length; j++) {
                let value = gamepad.axes[j];
                
                // Применение мертвой зоны
                if (Math.abs(value) < this.deadzone) {
                    value = 0;
                }
                
                state.axes[j] = value;
            }
            
            // Отправка состояния геймпада
            EventBus.emit('input:gamepadupdate', {
                index: i,
                buttons: state.buttons,
                axes: state.axes
            });
        }
    }

    processAction(type, input, gamepadIndex = null) {
        // Поиск действия по привязке
        for (const [action, bindings] of this.bindings) {
            if (bindings.includes(input)) {
                const eventData = {
                    action: action,
                    input: input,
                    type: type,
                    gamepad: gamepadIndex,
                    timestamp: Date.now()
                };
                
                // Сохранение состояния действия
                this.actions.set(action, eventData);
                
                // Отправка события
                EventBus.emit(`input:${action}`, eventData);
                EventBus.emit('input:action', eventData);
                
                break;
            }
        }
    }

    processContinuousActions() {
        // Обработка непрерывного движения
        const moveInput = new Vector2(0, 0);
        
        // Клавиатура
        if (this.isPressed('move_forward')) moveInput.y -= 1;
        if (this.isPressed('move_backward')) moveInput.y += 1;
        if (this.isPressed('move_left')) moveInput.x -= 1;
        if (this.isPressed('move_right')) moveInput.x += 1;
        
        // Геймпад
        const gamepad = this.getFirstGamepad();
        if (gamepad) {
            const leftStick = new Vector2(gamepad.axes[0], gamepad.axes[1]);
            
            if (leftStick.length() > this.deadzone) {
                moveInput.add(leftStick);
            }
        }
        
        // Нормализация
        if (moveInput.length() > 1) {
            moveInput.normalize();
        }
        
        // Отправка движения
        if (moveInput.length() > 0) {
            EventBus.emit('input:move', { vector: moveInput.clone() });
        }
        
        // Обработка взгляда (мышь + правый стик)
        const lookInput = new Vector2(0, 0);
        
        // Мышь
        if (this.mouse.locked) {
            lookInput.add(this.mouse.delta);
        }
        
        // Геймпад
        if (gamepad) {
            const rightStick = new Vector2(gamepad.axes[2], gamepad.axes[3]);
            
            if (rightStick.length() > this.deadzone) {
                lookInput.add(Vector2.multiplyScalar(rightStick, 10));
            }
        }
        
        // Отправка взгляда
        if (lookInput.length() > 0) {
            EventBus.emit('input:look', { vector: lookInput.clone() });
        }
    }

    isPressed(action) {
        const bindings = this.bindings.get(action);
        if (!bindings) return false;
        
        for (const binding of bindings) {
            if (binding.startsWith('Mouse')) {
                if (this.mouse.buttons.has(binding)) return true;
            } else if (binding.startsWith('Button')) {
                const gamepad = this.getFirstGamepad();
                if (gamepad) {
                    const buttonIndex = parseInt(binding.replace('Button', ''));
                    if (gamepad.buttons[buttonIndex]?.pressed) return true;
                }
            } else {
                if (this.keys.has(binding)) return true;
            }
        }
        
        return false;
    }

    getFirstGamepad() {
        for (const [index, state] of this.gamepads) {
            return {
                index: index,
                buttons: state.buttons,
                axes: state.axes
            };
        }
        return null;
    }

    requestPointerLock() {
        const element = document.body;
        
        if (element.requestPointerLock) {
            element.requestPointerLock();
        } else if (element.mozRequestPointerLock) {
            element.mozRequestPointerLock();
        } else if (element.webkitRequestPointerLock) {
            element.webkitRequestPointerLock();
        }
    }

    exitPointerLock() {
        if (document.exitPointerLock) {
            document.exitPointerLock();
        } else if (document.mozExitPointerLock) {
            document.mozExitPointerLock();
        } else if (document.webkitExitPointerLock) {
            document.webkitExitPointerLock();
        }
        
        this.mouse.locked = false;
    }

    vibrate(gamepadIndex, duration = 100, intensity = 1.0) {
        const state = this.gamepads.get(gamepadIndex);
        if (!state || !state.vibration || !state.vibration.canVibrate) return;
        
        const gamepad = navigator.getGamepads()[gamepadIndex];
        if (!gamepad || !gamepad.vibrationActuator) return;
        
        gamepad.vibrationActuator.playEffect('dual-rumble', {
            startDelay: 0,
            duration: duration,
            weakMagnitude: intensity * 0.5,
            strongMagnitude: intensity
        }).catch(console.warn);
    }

    bind(action, inputs) {
        this.bindings.set(action, Array.isArray(inputs) ? inputs : [inputs]);
    }

    unbind(action) {
        this.bindings.delete(action);
    }

    getBindings() {
        return new Map(this.bindings);
    }

    getActionState(action) {
        return this.actions.get(action) || { pressed: false };
    }

    reset() {
        this.keys.clear();
        this.keyStates.clear();
        this.mouse.buttons.clear();
        this.mouse.buttonStates.clear();
        this.mouse.delta.set(0, 0);
        this.mouse.wheel = 0;
        this.actions.clear();
    }

    cleanup() {
        this.exitPointerLock();
        this.reset();
        
        // Удаление всех обработчиков
        document.removeEventListener('keydown', this.handleKeyDown);
        document.removeEventListener('keyup', this.handleKeyUp);
        document.removeEventListener('mousedown', this.handleMouseDown);
        document.removeEventListener('mouseup', this.handleMouseUp);
        document.removeEventListener('mousemove', this.handleMouseMove);
        document.removeEventListener('wheel', this.handleMouseWheel);
        document.removeEventListener('touchstart', this.handleTouchStart);
        document.removeEventListener('touchmove', this.handleTouchMove);
        document.removeEventListener('touchend', this.handleTouchEnd);
        
        console.log('🧹 Система ввода очищена');
    }
}