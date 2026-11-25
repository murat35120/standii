// blocks/debug.js
// Блок диагностики триггеров с выборочной отправкой пакетов (только на команды)
// ИСПРАВЛЕНО: предотвращено дублирование вызовов callback, поддержка дробных интервалов

let converters, controllers, cards, tests, testLog, isTestRunning, testStartTime, list_cl, num, admins, func_api;
let fs, path, rootDir;
let debugMode = false;
let debugLog = [];

// Ожидания ответов на команды
let debugPending = {};
let originalListener = null;
let isCallbackOverridden = false; // Флаг, чтобы не переопределять callback дважды

function init(conv, ctrl, card, t, log, running, startTime, list, n, admin, api) {
    converters = conv;
    controllers = ctrl;
    cards = card;
    tests = t;
    testLog = log;
    isTestRunning = running;
    testStartTime = startTime;
    list_cl = list;
    num = n;
    admins = admin;
    func_api = api;
}

function setFileSystem(fsModule, pathModule, root) {
    fs = fsModule;
    path = pathModule;
    rootDir = root;
}

// Патч для перехвата только ответов на команды
function patchConverterListener() {
    if (originalListener) return;
    const Converter = global.Converter || require('./converter.js').Converter;
    if (!Converter) {
        console.error('❌ Converter не найден для патча');
        return;
    }
    originalListener = Converter.prototype.listener;
    Converter.prototype.listener = function(data) {
        // Вызываем оригинальный listener
        if (originalListener) {
            originalListener.call(this, data);
        }
        // Проверяем, есть ли ожидание для этого адреса
        const address = data[0];
        if (debugPending[address]) {
            // Если это ответ на запись (0x06) или опрос состояния (0x04)
            if (data[1] === 6 || data[1] === 4) {
                const pending = debugPending[address];
                // Отправляем пакет клиенту
                const packetMsg = {
                    api: 'debug_packet',
                    controller: pending.controllerKey,
                    address: address,
                    data: Array.from(data),
                    hex: Array.from(data).map(b => b.toString(16).padStart(2, '0')).join(' '),
                    timestamp: Date.now(),
                    command: pending.command,
                    type: data[1] === 6 ? 'response' : 'state'
                };
                for (let i in list_cl) {
                    try {
                        if (list_cl[i]._debugMode) {
                            list_cl[i].send(JSON.stringify(packetMsg));
                        }
                    } catch (e) {}
                }
                // Если это 0x04 (состояние), удаляем ожидание
                if (data[1] === 4) {
                    delete debugPending[address];
                    clearTimeout(pending.timeout);
                }
                // Если это 0x06, пока оставляем ожидание для следующего 0x04
            }
        }
    };
    console.log('✅ Патч для выборочного перехвата пакетов установлен');
}

function restoreConverterListener() {
    if (originalListener) {
        const Converter = global.Converter || require('./converter.js').Converter;
        if (Converter) {
            Converter.prototype.listener = originalListener;
            originalListener = null;
            console.log('✅ Патч восстановлен');
        }
    }
}

function startDebug() {
    debugMode = true;
    debugLog = [];
    // Устанавливаем патч, чтобы он всегда был готов перехватывать ответы
    patchConverterListener();

    for (let i in list_cl) {
        list_cl[i]._debugMode = true;
    }

    // ===== ИСПРАВЛЕНИЕ: переопределяем callback только один раз =====
    if (!isCallbackOverridden) {
        // Сохраняем оригинальный callback только если ещё не сохранили
        if (!func_api._originalCallback) {
            func_api._originalCallback = func_api.callback;
        }
        
        // Переопределяем callback
        func_api.callback = function(thet) {
            const logEntry = {
                timestamp: Date.now(),
                controller: thet.type + '_' + thet.number,
                address: thet.address,
                data: thet.data ? Array.from(thet.data) : null,
                trigger_info: thet.trigger_info || null
            };
            debugLog.push(logEntry);
            
            // Отправляем клиентам
            for (let i in list_cl) {
                try {
                    if (list_cl[i]._debugMode) {
                        list_cl[i].send(JSON.stringify({
                            api: 'debug_trigger',
                            event: logEntry
                        }));
                    }
                } catch (e) {}
            }
            
            // Вызываем оригинальный callback ТОЛЬКО ОДИН РАЗ
            if (func_api._originalCallback && func_api._originalCallback !== func_api.callback) {
                func_api._originalCallback(thet);
            }
        };
        isCallbackOverridden = true;
        console.log('🔍 callback переопределён (один раз)');
    } else {
        console.log('🔍 callback уже переопределён, пропускаем');
    }
    
    console.log('🔍 Режим отладки ВКЛЮЧЕН (выборочные пакеты)');
}

function stopDebug() {
    debugMode = false;
    // Очищаем ожидания
    for (let addr in debugPending) {
        clearTimeout(debugPending[addr].timeout);
        delete debugPending[addr];
    }
    for (let i in list_cl) {
        list_cl[i]._debugMode = false;
    }

    // ===== ИСПРАВЛЕНИЕ: восстанавливаем оригинальный callback =====
    if (func_api._originalCallback) {
        func_api.callback = func_api._originalCallback;
        func_api._originalCallback = null;
        isCallbackOverridden = false;
        console.log('🔍 callback восстановлен');
    }
    
    console.log('🔍 Режим отладки ВЫКЛЮЧЕН');
}

function getDebugLog() {
    return debugLog;
}

function clearDebugLog() {
    debugLog = [];
}

function checkTriggers(controllerKey) {
    const result = {
        controller: controllerKey,
        exists: false,
        triggers: [],
        pattern: null,
        type_info: null,
        data: null,
        errors: []
    };
    const ctrl = controllers[controllerKey];
    if (!ctrl) {
        result.errors.push('Контроллер не найден');
        return result;
    }
    result.exists = true;
    result.triggers = ctrl.triggers || [];
    result.pattern = ctrl.pattern || null;
    result.data = ctrl.data ? Array.from(ctrl.data) : null;
    result.type_info = func_api.type_info || null;
    if (!func_api.type_info) {
        result.errors.push('type_info не инициализирован');
    }
    for (let i = 0; i < result.triggers.length; i++) {
        const tr = result.triggers[i];
        const check = {
            index: i,
            type: tr.type,
            byte_num: tr.byte_num,
            bits: tr.bits,
            sost: tr.sost,
            min: tr.min,
            max: tr.max,
            dev: tr.dev,
            valid: true,
            issues: []
        };
        if (func_api.type_info && tr.byte_num !== undefined) {
            const byteInfo = func_api.type_info[tr.byte_num];
            if (!byteInfo) {
                check.valid = false;
                check.issues.push(`byte_num ${tr.byte_num} не найден в type_info`);
            } else if (tr.bits !== undefined) {
                if (tr.bits === 127) {
                    if (!byteInfo[127]) {
                        check.valid = false;
                        check.issues.push(`bits 127 не найден в type_info для byte_num ${tr.byte_num}`);
                    }
                } else if (!byteInfo[tr.bits]) {
                    check.valid = false;
                    check.issues.push(`bits ${tr.bits} не найден в type_info для byte_num ${tr.byte_num}`);
                }
            }
        }
        if (ctrl.pattern) {
            const bytePattern = ctrl.pattern[tr.byte_num];
            if (!bytePattern) {
                check.valid = false;
                check.issues.push(`byte_num ${tr.byte_num} не найден в pattern`);
            }
        }
        result.triggers[i] = { ...tr, debug: check };
    }
    return result;
}

function checkAllTriggers() {
    const results = {};
    for (const key in controllers) {
        results[key] = checkTriggers(key);
    }
    return results;
}

function forcePoll(controllerKey) {
    const ctrl = controllers[controllerKey];
    if (!ctrl) {
        return { ok: 0, info: 'Контроллер не найден' };
    }
    let adr = new Uint8Array([ctrl.address, 0x04, 0x00, 0x00, 0x00, 0x05]);
    let data = func_api.buff_sum([adr, func_api.getCRC(adr)]);
    ctrl.converter.add("q_fast", data);
    return { ok: 1, info: 'Команда опроса отправлена' };
}

function getControllerState(controllerKey) {
    const ctrl = controllers[controllerKey];
    if (!ctrl) {
        return { ok: 0, info: 'Контроллер не найден' };
    }
    return {
        ok: 1,
        controller: controllerKey,
        type: ctrl.type,
        number: ctrl.number,
        address: ctrl.address,
        version: ctrl.version,
        active: ctrl.active,
        data: ctrl.data ? Array.from(ctrl.data) : null,
        triggers: ctrl.triggers ? ctrl.triggers.map((t, i) => ({
            id: i,
            type: t.type,
            byte_num: t.byte_num,
            bits: t.bits,
            sost: t.sost,
            min: t.min,
            max: t.max,
            dev: t.dev
        })) : [],
        pattern: ctrl.pattern || null,
        trigger_count: ctrl.triggers ? ctrl.triggers.length : 0
    };
}

const debug_api = {
    debug_start(req, res, answer) {
        try {
            startDebug();
            answer.api = 'debug_start';
            answer.ok = 1;
            answer.info = 'Режим отладки включен (выборочные пакеты)';
            res.send(JSON.stringify(answer));
        } catch (e) {
            answer.api = 'debug_start';
            answer.ok = 0;
            answer.info = 'Ошибка: ' + e.message;
            res.send(JSON.stringify(answer));
        }
    },
    
    debug_stop(req, res, answer) {
        try {
            stopDebug();
            answer.api = 'debug_stop';
            answer.ok = 1;
            answer.info = 'Режим отладки выключен';
            res.send(JSON.stringify(answer));
        } catch (e) {
            answer.api = 'debug_stop';
            answer.ok = 0;
            answer.info = 'Ошибка: ' + e.message;
            res.send(JSON.stringify(answer));
        }
    },
    
    debug_log(req, res, answer) {
        try {
            answer.api = 'debug_log';
            answer.log = debugLog;
            answer.count = debugLog.length;
            answer.mode = debugMode;
            answer.ok = 1;
            res.send(JSON.stringify(answer));
        } catch (e) {
            answer.api = 'debug_log';
            answer.ok = 0;
            answer.info = 'Ошибка: ' + e.message;
            res.send(JSON.stringify(answer));
        }
    },
    
    debug_clear(req, res, answer) {
        try {
            clearDebugLog();
            answer.api = 'debug_clear';
            answer.ok = 1;
            answer.info = 'Лог очищен';
            res.send(JSON.stringify(answer));
        } catch (e) {
            answer.api = 'debug_clear';
            answer.ok = 0;
            answer.info = 'Ошибка: ' + e.message;
            res.send(JSON.stringify(answer));
        }
    },
    
    debug_check_triggers(req, res, answer) {
        try {
            const controllerKey = req.controller;
            if (!controllerKey) {
                answer.api = 'debug_check_triggers';
                answer.ok = 0;
                answer.info = 'Не указан контроллер';
                res.send(JSON.stringify(answer));
                return;
            }
            const result = checkTriggers(controllerKey);
            answer.api = 'debug_check_triggers';
            answer.result = result;
            answer.ok = 1;
            res.send(JSON.stringify(answer));
        } catch (e) {
            answer.api = 'debug_check_triggers';
            answer.ok = 0;
            answer.info = 'Ошибка: ' + e.message;
            res.send(JSON.stringify(answer));
        }
    },
    
    debug_check_all(req, res, answer) {
        try {
            const results = checkAllTriggers();
            answer.api = 'debug_check_all';
            answer.results = results;
            answer.ok = 1;
            res.send(JSON.stringify(answer));
        } catch (e) {
            answer.api = 'debug_check_all';
            answer.ok = 0;
            answer.info = 'Ошибка: ' + e.message;
            res.send(JSON.stringify(answer));
        }
    },
    
    debug_poll(req, res, answer) {
        try {
            const controllerKey = req.controller;
            if (!controllerKey) {
                answer.api = 'debug_poll';
                answer.ok = 0;
                answer.info = 'Не указан контроллер';
                res.send(JSON.stringify(answer));
                return;
            }
            const result = forcePoll(controllerKey);
            answer.api = 'debug_poll';
            answer.result = result;
            answer.ok = 1;
            res.send(JSON.stringify(answer));
        } catch (e) {
            answer.api = 'debug_poll';
            answer.ok = 0;
            answer.info = 'Ошибка: ' + e.message;
            res.send(JSON.stringify(answer));
        }
    },
    
    debug_state(req, res, answer) {
        try {
            const controllerKey = req.controller;
            if (!controllerKey) {
                answer.api = 'debug_state';
                answer.ok = 0;
                answer.info = 'Не указан контроллер';
                res.send(JSON.stringify(answer));
                return;
            }
            const result = getControllerState(controllerKey);
            answer.api = 'debug_state';
            answer.result = result;
            answer.ok = 1;
            res.send(JSON.stringify(answer));
        } catch (e) {
            answer.api = 'debug_state';
            answer.ok = 0;
            answer.info = 'Ошибка: ' + e.message;
            res.send(JSON.stringify(answer));
        }
    },
    
    debug_client_mode(req, res, answer) {
        try {
            const mode = req.mode === 'on';
            if (res && typeof res === 'object') {
                res._debugMode = mode;
            }
            answer.api = 'debug_client_mode';
            answer.mode = mode;
            answer.ok = 1;
            res.send(JSON.stringify(answer));
        } catch (e) {
            answer.api = 'debug_client_mode';
            answer.ok = 0;
            answer.info = 'Ошибка: ' + e.message;
            res.send(JSON.stringify(answer));
        }
    },

    debug_send_command(req, res, answer) {
        try {
            const controllerKey = req.controller;
            const command = req.command;
            // ===== ИСПРАВЛЕНИЕ: используем parseFloat для поддержки дробных значений =====
            const interval = parseFloat(req.interval) || 2;
            if (!controllerKey || !command) {
                answer.api = 'debug_send_command';
                answer.ok = 0;
                answer.info = 'Не указаны controller или command';
                res.send(JSON.stringify(answer));
                return;
            }
            const ctrl = controllers[controllerKey];
            if (!ctrl) {
                answer.api = 'debug_send_command';
                answer.ok = 0;
                answer.info = 'Контроллер не найден: ' + controllerKey;
                res.send(JSON.stringify(answer));
                return;
            }
            if (typeof func_api[command] === 'function') {
                // Сохраняем ожидание перед отправкой
                const address = ctrl.address;
                debugPending[address] = {
                    controllerKey: controllerKey,
                    command: command,
                    timestamp: Date.now(),
                    timeout: setTimeout(() => {
                        delete debugPending[address];
                        console.log(`⏰ Таймаут для команды ${command} на ${controllerKey}`);
                    }, 5000)
                };
                // Отправляем команду
                func_api[command](ctrl, func_api.plus(Math.abs(interval)));
                answer.api = 'debug_send_command';
                answer.ok = 1;
                answer.info = `Команда ${command} отправлена контроллеру ${controllerKey} с интервалом ${interval}`;
                res.send(JSON.stringify(answer));
            } else {
                answer.api = 'debug_send_command';
                answer.ok = 0;
                answer.info = `Команда ${command} не найдена в func_api`;
                res.send(JSON.stringify(answer));
            }
        } catch (e) {
            answer.api = 'debug_send_command';
            answer.ok = 0;
            answer.info = 'Ошибка: ' + e.message;
            res.send(JSON.stringify(answer));
        }
    }
};

module.exports = {
    init,
    setFileSystem,
    debug_api,
    startDebug,
    stopDebug,
    getDebugLog,
    clearDebugLog,
    checkTriggers,
    checkAllTriggers,
    forcePoll,
    getControllerState
};