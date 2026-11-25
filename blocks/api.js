// blocks/api.js
// Блок объектов out_api и func_api

// Глобальные переменные (передаются из index.js)
let converters, controllers, cards, tests, testLog, isTestRunning, testStartTime, list_cl, num, admins, Controller, executeTest, executeTestNew;
let fs, path, rootDir;

function init(conv, ctrl, card, t, log, running, startTime, list, n, admin, ControllerClass, executeTestFunc, executeTestNewFunc) {
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
    Controller = ControllerClass;
    executeTest = executeTestFunc;
    executeTestNew = executeTestNewFunc;
    console.log('✅ api.js инициализирован');
}

function setFileSystem(fsModule, pathModule, root) {
    fs = fsModule;
    path = pathModule;
    rootDir = root;
    console.log('✅ api.js: файловая система установлена');
}

function sendResponse(res, data) {
    try {
        if (res && typeof res.send === 'function') {
            res.send(JSON.stringify(data));
        } else if (res && typeof res.end === 'function') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data));
        } else if (res && typeof res === 'function') {
            res(data);
        } else if (res && typeof res.callback === 'function') {
            res.callback(data);
        }
    } catch (e) {
        console.error('Ошибка отправки ответа:', e);
    }
}

function getSubdirsCount(dirPath) {
    try {
        if (!fs.existsSync(dirPath)) return 0;
        const items = fs.readdirSync(dirPath, { withFileTypes: true });
        let count = 0;
        for (const item of items) {
            if (item.isDirectory() && item.name !== 'stand.json' && item.name !== 'group.json' && item.name !== 'check.json') {
                count++;
            }
        }
        return count;
    } catch (e) {
        return 0;
    }
}

// ============ ФУНКЦИИ ДЛЯ КОПИРОВАНИЯ ============
function copyDirectorySync(src, dest) {
    if (!fs.existsSync(src)) {
        console.error('Исходная папка не существует:', src);
        return false;
    }
    
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
        console.log('Создана папка назначения:', dest);
    }
    
    const items = fs.readdirSync(src, { withFileTypes: true });
    for (const item of items) {
        const srcPath = path.join(src, item.name);
        const destPath = path.join(dest, item.name);
        if (item.isDirectory()) {
            copyDirectorySync(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
            console.log('Скопирован файл:', item.name);
        }
    }
    return true;
}

// ============ out_api ============
let out_api = {
    controllers_list: function(req, res, answer) {
        try {
            let obj = {};
            for (let i in controllers) {
                obj[i] = {
                    type: controllers[i].type,
                    number: controllers[i].number,
                    address: controllers[i].address,
                    triggers: controllers[i].triggers || [],
                    version: controllers[i].version || 'unknown'
                };
            }
            answer.api = 'controllers_list';
            answer.list = obj;
            answer.ok = 1;
            sendResponse(res, answer);
        } catch (e) {
            answer.api = 'controllers_list';
            answer.ok = 0;
            answer.info = 'Ошибка: ' + e.message;
            sendResponse(res, answer);
        }
    },

    triggers_type: function(req, res, answer) {
        try {
            answer.api = 'triggers_type';
            answer.list = func_api.types;
            answer.ok = 1;
            sendResponse(res, answer);
        } catch (e) {
            answer.api = 'triggers_type';
            answer.ok = 0;
            answer.info = 'Ошибка: ' + e.message;
            sendResponse(res, answer);
        }
    },

    converters_list: function(req, res, answer) {
        try {
            let obj = {};
            for (let i = 0; i < converters.length; i++) {
                const c = converters[i];
                obj[i] = {
                    model: c.model || 'unknown',
                    number: c.number || 'N/A',
                    version: c.version || 'unknown',
                    addresses: c.addresses ? Object.keys(c.addresses).length : 0,
                    connected: c.connected || false,
                    type: c.connectionType || c.type || 'ethernet'
                };
            }
            answer.api = 'converters_list';
            answer.list = obj;
            answer.ok = 1;
            sendResponse(res, answer);
        } catch (e) {
            answer.api = 'converters_list';
            answer.ok = 0;
            answer.info = 'Ошибка: ' + e.message;
            sendResponse(res, answer);
        }
    },

    open_for_out: function(req, res, answer) {
        try {
            const ctrl = controllers[req.controller];
            if (!ctrl) {
                answer.api = 'open_for_out';
                answer.ok = 0;
                answer.info = 'Контроллер не найден';
                sendResponse(res, answer);
                return;
            }
            ctrl.open_for_out();
            answer.api = 'open_for_out';
            answer.ok = 1;
            sendResponse(res, answer);
        } catch (e) {
            answer.api = 'open_for_out';
            answer.ok = 0;
            answer.info = 'Ошибка: ' + e.message;
            sendResponse(res, answer);
        }
    },

    open_for_in: function(req, res, answer) {
        try {
            const ctrl = controllers[req.controller];
            if (!ctrl) {
                answer.api = 'open_for_in';
                answer.ok = 0;
                answer.info = 'Контроллер не найден';
                sendResponse(res, answer);
                return;
            }
            ctrl.open_for_in();
            answer.api = 'open_for_in';
            answer.ok = 1;
            sendResponse(res, answer);
        } catch (e) {
            answer.api = 'open_for_in';
            answer.ok = 0;
            answer.info = 'Ошибка: ' + e.message;
            sendResponse(res, answer);
        }
    },

    // ===== ИСПРАВЛЕНИЕ: поддержка дробных интервалов =====
    green: function(req, res, answer) {
        try {
            let thet = controllers[req.controller];
            if (!thet) {
                answer.api = 'green';
                answer.ok = 0;
                answer.info = 'Контроллер не найден';
                sendResponse(res, answer);
                return;
            }
            const interval = parseFloat(req.interval) || 2;
            func_api.green(thet, func_api.plus(Math.abs(interval)));
            answer.api = 'green';
            answer.ok = 1;
            sendResponse(res, answer);
        } catch (e) {
            answer.api = 'green';
            answer.ok = 0;
            answer.info = 'Ошибка: ' + e.message;
            sendResponse(res, answer);
        }
    },

    red: function(req, res, answer) {
        try {
            let thet = controllers[req.controller];
            if (!thet) {
                answer.api = 'red';
                answer.ok = 0;
                answer.info = 'Контроллер не найден';
                sendResponse(res, answer);
                return;
            }
            const interval = parseFloat(req.interval) || 2;
            func_api.red(thet, func_api.plus(Math.abs(interval)));
            answer.api = 'red';
            answer.ok = 1;
            sendResponse(res, answer);
        } catch (e) {
            answer.api = 'red';
            answer.ok = 0;
            answer.info = 'Ошибка: ' + e.message;
            sendResponse(res, answer);
        }
    },

    sound: function(req, res, answer) {
        try {
            let thet = controllers[req.controller];
            if (!thet) {
                answer.api = 'sound';
                answer.ok = 0;
                answer.info = 'Контроллер не найден';
                sendResponse(res, answer);
                return;
            }
            const interval = parseFloat(req.interval) || 2;
            func_api.sound(thet, func_api.plus(Math.abs(interval)));
            answer.api = 'sound';
            answer.ok = 1;
            sendResponse(res, answer);
        } catch (e) {
            answer.api = 'sound';
            answer.ok = 0;
            answer.info = 'Ошибка: ' + e.message;
            sendResponse(res, answer);
        }
    },

    d0: function(req, res, answer) {
        try {
            let thet = controllers[req.controller];
            if (!thet) {
                answer.api = 'd0';
                answer.ok = 0;
                answer.info = 'Контроллер не найден';
                sendResponse(res, answer);
                return;
            }
            const interval = parseFloat(req.interval) || 2;
            func_api.d0(thet, func_api.plus(Math.abs(interval)));
            answer.api = 'd0';
            answer.ok = 1;
            sendResponse(res, answer);
        } catch (e) {
            answer.api = 'd0';
            answer.ok = 0;
            answer.info = 'Ошибка: ' + e.message;
            sendResponse(res, answer);
        }
    },

    d1: function(req, res, answer) {
        try {
            let thet = controllers[req.controller];
            if (!thet) {
                answer.api = 'd1';
                answer.ok = 0;
                answer.info = 'Контроллер не найден';
                sendResponse(res, answer);
                return;
            }
            const interval = parseFloat(req.interval) || 2;
            func_api.d1(thet, func_api.plus(Math.abs(interval)));
            answer.api = 'd1';
            answer.ok = 1;
            sendResponse(res, answer);
        } catch (e) {
            answer.api = 'd1';
            answer.ok = 0;
            answer.info = 'Ошибка: ' + e.message;
            sendResponse(res, answer);
        }
    },

    lock: function(req, res, answer) {
        try {
            let thet = controllers[req.controller];
            if (!thet) {
                answer.api = 'lock';
                answer.ok = 0;
                answer.info = 'Контроллер не найден';
                sendResponse(res, answer);
                return;
            }
            const interval = parseFloat(req.interval) || 2;
            func_api.lock(thet, func_api.plus(Math.abs(interval)));
            answer.api = 'lock';
            answer.ok = 1;
            sendResponse(res, answer);
        } catch (e) {
            answer.api = 'lock';
            answer.ok = 0;
            answer.info = 'Ошибка: ' + e.message;
            sendResponse(res, answer);
        }
    },

    new_address: function(req, res, answer) {
        try {
            let thet = controllers[req.controller];
            if (!thet) {
                answer.api = 'new_address';
                answer.ok = 0;
                answer.info = 'Контроллер не найден';
                sendResponse(res, answer);
                return;
            }
            const newAddr = parseInt(req.new_adr) || 2;
            func_api.new_address(thet, newAddr);
            answer.api = 'new_address';
            answer.ok = 1;
            sendResponse(res, answer);
        } catch (e) {
            answer.api = 'new_address';
            answer.ok = 0;
            answer.info = 'Ошибка: ' + e.message;
            sendResponse(res, answer);
        }
    },

    pattern_list: function(req, res, answer) {
        try {
            let thet = controllers[req.controller];
            if (!thet) {
                answer.api = 'pattern_list';
                answer.ok = 0;
                answer.info = 'Контроллер не найден';
                sendResponse(res, answer);
                return;
            }
            answer.api = 'pattern_list';
            answer.pattern_list = thet.pattern;
            answer.ok = 1;
            sendResponse(res, answer);
        } catch (e) {
            answer.api = 'pattern_list';
            answer.ok = 0;
            answer.info = 'Ошибка: ' + e.message;
            sendResponse(res, answer);
        }
    },

    trigger_add_ind: function(req, res, answer) {
        try {
            let thet = controllers[req.controller];
            if (!thet) {
                answer.api = 'trigger_add_ind';
                answer.ok = 0;
                answer.info = 'Контроллер не найден';
                sendResponse(res, answer);
                return;
            }
            if (req.type && req.type.slice(0, 2) == 'va') {
                thet.add_trigger({ type: req.type, min: req.min, max: req.max, dev: req.dev, callback: res.callback });
            } else if (req.type && (req.type.startsWith('tm_') || req.type.startsWith('exit_'))) {
                thet.add_trigger({ type: req.type, sost: req.sost, callback: res.callback });
            } else {
                thet.add_trigger({ type: req.type, sost: req.sost, callback: res.callback });
            }
            answer.api = 'trigger_add_ind';
            answer.ok = 1;
            answer.controller = req.controller;
            answer.triggers = controllers[req.controller].triggers;
            sendResponse(res, answer);
        } catch (e) {
            answer.api = 'trigger_add_ind';
            answer.ok = 0;
            answer.info = 'Ошибка: ' + e.message;
            sendResponse(res, answer);
        }
    },

    trigger_add: function(req, res, answer) {
        try {
            let thet = controllers[req.controller];
            if (!thet) {
                answer.api = 'trigger_add';
                answer.ok = 0;
                answer.info = 'Контроллер не найден';
                sendResponse(res, answer);
                return;
            }
            if (req.type && req.type.slice(0, 2) == 'va') {
                thet.add_trigger({ type: req.type, min: req.min, max: req.max, dev: req.dev, callback: func_api.callback });
            } else if (req.type && (req.type.startsWith('tm_') || req.type.startsWith('exit_'))) {
                thet.add_trigger({ type: req.type, sost: req.sost, callback: func_api.callback });
            } else {
                thet.add_trigger({ type: req.type, sost: req.sost, callback: func_api.callback });
            }
            answer.api = 'trigger_add';
            answer.ok = 1;
            answer.controller = req.controller;
            answer.triggers = controllers[req.controller].triggers;
            sendResponse(res, answer);
        } catch (e) {
            answer.api = 'trigger_add';
            answer.ok = 0;
            answer.info = 'Ошибка: ' + e.message;
            sendResponse(res, answer);
        }
    },

    trigger_add_sys: function(req, res, answer) {
        try {
            let thet = controllers[req.controller];
            if (!thet) {
                answer.api = 'trigger_add_sys';
                answer.ok = 0;
                answer.info = 'Контроллер не найден';
                sendResponse(res, answer);
                return;
            }
            if (req.obj == 'thet') {
                if (req.type && req.type.slice(0, 2) == 'va') {
                    thet.add_trigger({ type: req.type, min: req.min, max: req.max, dev: req.dev, callback: thet[req.callback] });
                } else if (req.type && (req.type.startsWith('tm_') || req.type.startsWith('exit_'))) {
                    thet.add_trigger({ type: req.type, sost: req.sost, callback: thet[req.callback] });
                } else {
                    thet.add_trigger({ type: req.type, sost: req.sost, callback: thet[req.callback] });
                }
            }
            if (req.obj == 'func_api') {
                if (req.type && req.type.slice(0, 2) == 'va') {
                    thet.add_trigger({ type: req.type, min: req.min, max: req.max, dev: req.dev, callback: func_api[req.callback] });
                } else if (req.type && (req.type.startsWith('tm_') || req.type.startsWith('exit_'))) {
                    thet.add_trigger({ type: req.type, sost: req.sost, callback: func_api[req.callback] });
                } else {
                    thet.add_trigger({ type: req.type, sost: req.sost, callback: func_api[req.callback] });
                }
            }
            answer.api = 'trigger_add_sys';
            answer.ok = 1;
            answer.controller = req.controller;
            answer.triggers = controllers[req.controller].triggers;
            sendResponse(res, answer);
        } catch (e) {
            answer.api = 'trigger_add_sys';
            answer.ok = 0;
            answer.info = 'Ошибка: ' + e.message;
            sendResponse(res, answer);
        }
    },

    trigger_dell: function(req, res, answer) {
        try {
            let thet = controllers[req.controller];
            if (!thet) {
                answer.api = 'trigger_dell';
                answer.ok = 0;
                answer.info = 'Контроллер не найден';
                sendResponse(res, answer);
                return;
            }
            thet.dell_trigger(req.trigger_id);
            answer.api = 'trigger_dell';
            answer.ok = 1;
            answer.controller = req.controller;
            answer.triggers = controllers[req.controller].triggers;
            sendResponse(res, answer);
        } catch (e) {
            answer.api = 'trigger_dell';
            answer.ok = 0;
            answer.info = 'Ошибка: ' + e.message;
            sendResponse(res, answer);
        }
    },

    test_save: function(req, res, answer) {
        try {
            const testData = req.test;
            if (!testData || !testData.name) {
                answer.api = 'test_save';
                answer.ok = 0;
                answer.info = 'Неверные данные теста';
                sendResponse(res, answer);
                return;
            }
            if (!controllers[testData.controller]) {
                answer.api = 'test_save';
                answer.ok = 0;
                answer.info = 'Контроллер не найден: ' + testData.controller;
                answer.available = Object.keys(controllers);
                sendResponse(res, answer);
                return;
            }
            tests.set(testData.name, testData);
            answer.api = 'test_save';
            answer.ok = 1;
            answer.info = 'Тест сохранен';
            answer.tests = Array.from(tests.keys());
            sendResponse(res, answer);
        } catch (e) {
            answer.api = 'test_save';
            answer.ok = 0;
            answer.info = 'Ошибка сохранения: ' + e.message;
            sendResponse(res, answer);
        }
    },

    test_run: function(req, res, answer) {
        try {
            const testName = req.test_name;
            if (!testName) {
                answer.api = 'test_run';
                answer.ok = 0;
                answer.info = 'Не указано имя теста';
                sendResponse(res, answer);
                return;
            }
            const testData = tests.get(testName);
            if (!testData) {
                answer.api = 'test_run';
                answer.ok = 0;
                answer.info = 'Тест не найден: ' + testName;
                sendResponse(res, answer);
                return;
            }
            if (isTestRunning) {
                answer.api = 'test_run';
                answer.ok = 0;
                answer.info = 'Тест уже выполняется';
                sendResponse(res, answer);
                return;
            }
            answer.api = 'test_run';
            answer.ok = 1;
            answer.info = 'Тест запущен: ' + testName;
            sendResponse(res, answer);
            setTimeout(() => {
                executeTest(testData);
            }, 50);
        } catch (e) {
            answer.api = 'test_run';
            answer.ok = 0;
            answer.info = 'Ошибка запуска: ' + e.message;
            sendResponse(res, answer);
        }
    },

    test_list: function(req, res, answer) {
        try {
            const testNames = Array.from(tests.keys());
            const testList = {};
            for (const name of testNames) {
                const test = tests.get(name);
                testList[name] = {
                    name: test.name,
                    description: test.description || '',
                    controller: test.controller,
                    commands: test.test ? test.test.length : 0
                };
            }
            answer.api = 'test_list';
            answer.list = testList;
            answer.ok = 1;
            sendResponse(res, answer);
        } catch (e) {
            answer.api = 'test_list';
            answer.ok = 0;
            answer.info = 'Ошибка получения списка: ' + e.message;
            sendResponse(res, answer);
        }
    },

    test_get: function(req, res, answer) {
        try {
            const testName = req.test_name;
            if (!testName) {
                answer.api = 'test_get';
                answer.ok = 0;
                answer.info = 'Не указано имя теста';
                sendResponse(res, answer);
                return;
            }
            const testData = tests.get(testName);
            if (!testData) {
                answer.api = 'test_get';
                answer.ok = 0;
                answer.info = 'Тест не найден: ' + testName;
                sendResponse(res, answer);
                return;
            }
            answer.api = 'test_get';
            answer.test = testData;
            answer.ok = 1;
            sendResponse(res, answer);
        } catch (e) {
            answer.api = 'test_get';
            answer.ok = 0;
            answer.info = 'Ошибка получения теста: ' + e.message;
            sendResponse(res, answer);
        }
    },

    test_delete: function(req, res, answer) {
        try {
            const testName = req.test_name;
            if (!testName) {
                answer.api = 'test_delete';
                answer.ok = 0;
                answer.info = 'Не указано имя теста';
                sendResponse(res, answer);
                return;
            }
            if (!tests.has(testName)) {
                answer.api = 'test_delete';
                answer.ok = 0;
                answer.info = 'Тест не найден: ' + testName;
                sendResponse(res, answer);
                return;
            }
            tests.delete(testName);
            answer.api = 'test_delete';
            answer.ok = 1;
            answer.info = 'Тест удален: ' + testName;
            answer.tests = Array.from(tests.keys());
            sendResponse(res, answer);
        } catch (e) {
            answer.api = 'test_delete';
            answer.ok = 0;
            answer.info = 'Ошибка удаления: ' + e.message;
            sendResponse(res, answer);
        }
    },

    test_log_get: function(req, res, answer) {
        try {
            answer.api = 'test_log_get';
            answer.log = testLog;
            answer.is_running = isTestRunning;
            answer.ok = 1;
            sendResponse(res, answer);
        } catch (e) {
            answer.api = 'test_log_get';
            answer.ok = 0;
            answer.info = 'Ошибка получения лога: ' + e.message;
            sendResponse(res, answer);
        }
    },

    stands_list: function(req, res, answer) {
        try {
            const standsDir = path.join(rootDir, 'stands');
            if (!fs.existsSync(standsDir)) {
                fs.mkdirSync(standsDir, { recursive: true });
            }
            const items = fs.readdirSync(standsDir, { withFileTypes: true });
            const stands = [];
            for (const item of items) {
                if (item.isDirectory()) {
                    const standFile = path.join(standsDir, item.name, 'stand.json');
                    if (fs.existsSync(standFile)) {
                        try {
                            const data = JSON.parse(fs.readFileSync(standFile, 'utf8'));
                            const groups = getSubdirsCount(path.join(standsDir, item.name));
                            stands.push({
                                name: data.name || item.name,
                                description: data.description || '',
                                path: item.name,
                                groups_count: groups,
                                controllers: data.controllers || [],
                                alias: data.alias || {}
                            });
                        } catch (e) {
                            stands.push({
                                name: item.name,
                                description: 'Ошибка чтения',
                                path: item.name,
                                error: true
                            });
                        }
                    } else {
                        stands.push({
                            name: item.name,
                            description: 'Нет конфигурации',
                            path: item.name
                        });
                    }
                }
            }
            answer.api = 'stands_list';
            answer.stands = stands;
            answer.ok = 1;
            sendResponse(res, answer);
        } catch (e) {
            answer.api = 'stands_list';
            answer.ok = 0;
            answer.info = 'Ошибка получения списка стендов: ' + e.message;
            sendResponse(res, answer);
        }
    },

    stand_get: function(req, res, answer) {
        try {
            const standName = req.stand_name;
            if (!standName) {
                answer.api = 'stand_get';
                answer.ok = 0;
                answer.info = 'Не указано имя стенда';
                sendResponse(res, answer);
                return;
            }
            const standPath = path.join(rootDir, 'stands', standName);
            if (!fs.existsSync(standPath)) {
                answer.api = 'stand_get';
                answer.ok = 0;
                answer.info = 'Стенд не найден';
                sendResponse(res, answer);
                return;
            }
            const standFile = path.join(standPath, 'stand.json');
            let standData = {};
            if (fs.existsSync(standFile)) {
                standData = JSON.parse(fs.readFileSync(standFile, 'utf8'));
            }
            const groups = [];
            const items = fs.readdirSync(standPath, { withFileTypes: true });
            for (const item of items) {
                if (item.isDirectory() && item.name !== 'stand.json') {
                    const groupFile = path.join(standPath, item.name, 'group.json');
                    if (fs.existsSync(groupFile)) {
                        try {
                            const gData = JSON.parse(fs.readFileSync(groupFile, 'utf8'));
                            const checks = getSubdirsCount(path.join(standPath, item.name));
                            groups.push({
                                name: gData.name || item.name,
                                description: gData.description || '',
                                path: item.name,
                                checks: checks,
                                result: gData.result || null
                            });
                        } catch (e) {
                            groups.push({
                                name: item.name,
                                description: 'Ошибка чтения',
                                path: item.name,
                                error: true
                            });
                        }
                    } else {
                        groups.push({
                            name: item.name,
                            description: 'Нет конфигурации',
                            path: item.name
                        });
                    }
                }
            }
            standData.groups = groups;
            answer.api = 'stand_get';
            answer.stand = standData;
            answer.ok = 1;
            sendResponse(res, answer);
        } catch (e) {
            answer.api = 'stand_get';
            answer.ok = 0;
            answer.info = 'Ошибка получения стенда: ' + e.message;
            sendResponse(res, answer);
        }
    },

    stand_save: function(req, res, answer) {
        try {
            const standData = req.stand;
            if (!standData || !standData.name) {
                answer.api = 'stand_save';
                answer.ok = 0;
                answer.info = 'Неверные данные стенда';
                sendResponse(res, answer);
                return;
            }
            const standPath = path.join(rootDir, 'stands', standData.name);
            if (!fs.existsSync(standPath)) {
                fs.mkdirSync(standPath, { recursive: true });
            }
            const standToSave = {
                name: standData.name,
                description: standData.description || '',
                controllers: standData.controllers || [],
                alias: standData.alias || {},
                wiring: standData.wiring || {}
            };
            fs.writeFileSync(
                path.join(standPath, 'stand.json'),
                JSON.stringify(standToSave, null, 2)
            );
            answer.api = 'stand_save';
            answer.ok = 1;
            answer.info = 'Стенд сохранен';
            sendResponse(res, answer);
        } catch (e) {
            answer.api = 'stand_save';
            answer.ok = 0;
            answer.info = 'Ошибка сохранения стенда: ' + e.message;
            sendResponse(res, answer);
        }
    },

    stand_delete: function(req, res, answer) {
        try {
            const standName = req.stand_name;
            if (!standName) {
                answer.api = 'stand_delete';
                answer.ok = 0;
                answer.info = 'Не указано имя стенда';
                sendResponse(res, answer);
                return;
            }
            const standPath = path.join(rootDir, 'stands', standName);
            if (!fs.existsSync(standPath)) {
                answer.api = 'stand_delete';
                answer.ok = 0;
                answer.info = 'Стенд не найден';
                sendResponse(res, answer);
                return;
            }
            fs.rmSync(standPath, { recursive: true, force: true });
            answer.api = 'stand_delete';
            answer.ok = 1;
            answer.info = 'Стенд удален';
            sendResponse(res, answer);
        } catch (e) {
            answer.api = 'stand_delete';
            answer.ok = 0;
            answer.info = 'Ошибка удаления стенда: ' + e.message;
            sendResponse(res, answer);
        }
    },

    // ============ МЕТОДЫ КОПИРОВАНИЯ ============
    copy_stand: function(req, res, answer) {
        try {
            const sourceName = req.source_name;
            const newName = req.new_name;
            
            console.log('copy_stand вызван:', { sourceName, newName });
            
            if (!sourceName || !newName) {
                answer.api = 'copy_stand';
                answer.ok = 0;
                answer.info = 'Не указаны исходное и новое имя';
                sendResponse(res, answer);
                return;
            }
            
            const sourcePath = path.join(rootDir, 'stands', sourceName);
            const destPath = path.join(rootDir, 'stands', newName);
            
            console.log('sourcePath:', sourcePath);
            console.log('destPath:', destPath);
            
            if (!fs.existsSync(sourcePath)) {
                answer.api = 'copy_stand';
                answer.ok = 0;
                answer.info = 'Исходный стенд не найден: ' + sourcePath;
                sendResponse(res, answer);
                return;
            }
            
            if (fs.existsSync(destPath)) {
                answer.api = 'copy_stand';
                answer.ok = 0;
                answer.info = 'Стенд с именем "' + newName + '" уже существует';
                sendResponse(res, answer);
                return;
            }
            
            copyDirectorySync(sourcePath, destPath);
            
            const standFile = path.join(destPath, 'stand.json');
            if (fs.existsSync(standFile)) {
                const standData = JSON.parse(fs.readFileSync(standFile, 'utf8'));
                standData.name = newName;
                fs.writeFileSync(standFile, JSON.stringify(standData, null, 2));
                console.log('stand.json обновлен, новое имя:', newName);
            }
            
            answer.api = 'copy_stand';
            answer.ok = 1;
            answer.info = 'Стенд "' + sourceName + '" скопирован как "' + newName + '"';
            sendResponse(res, answer);
        } catch (e) {
            console.error('Ошибка копирования стенда:', e);
            answer.api = 'copy_stand';
            answer.ok = 0;
            answer.info = 'Ошибка копирования стенда: ' + e.message;
            sendResponse(res, answer);
        }
    },

    copy_group: function(req, res, answer) {
        try {
            const standName = req.stand_name;
            const sourceName = req.source_name;
            const newName = req.new_name;
            
            console.log('copy_group вызван:', { standName, sourceName, newName });
            
            if (!standName || !sourceName || !newName) {
                answer.api = 'copy_group';
                answer.ok = 0;
                answer.info = 'Не указаны все параметры';
                sendResponse(res, answer);
                return;
            }
            
            const standPath = path.join(rootDir, 'stands', standName);
            const sourcePath = path.join(standPath, sourceName);
            const destPath = path.join(standPath, newName);
            
            console.log('sourcePath:', sourcePath);
            console.log('destPath:', destPath);
            
            if (!fs.existsSync(sourcePath)) {
                answer.api = 'copy_group';
                answer.ok = 0;
                answer.info = 'Исходная группа не найдена: ' + sourcePath;
                sendResponse(res, answer);
                return;
            }
            
            if (fs.existsSync(destPath)) {
                answer.api = 'copy_group';
                answer.ok = 0;
                answer.info = 'Группа с именем "' + newName + '" уже существует';
                sendResponse(res, answer);
                return;
            }
            
            copyDirectorySync(sourcePath, destPath);
            
            const groupFile = path.join(destPath, 'group.json');
            if (fs.existsSync(groupFile)) {
                const groupData = JSON.parse(fs.readFileSync(groupFile, 'utf8'));
                groupData.name = newName;
                groupData.result = { order: 'no ok', time: 'no ok' };
                fs.writeFileSync(groupFile, JSON.stringify(groupData, null, 2));
                console.log('group.json обновлен, новое имя:', newName);
            }
            
            answer.api = 'copy_group';
            answer.ok = 1;
            answer.info = 'Группа "' + sourceName + '" скопирована как "' + newName + '"';
            sendResponse(res, answer);
        } catch (e) {
            console.error('Ошибка копирования группы:', e);
            answer.api = 'copy_group';
            answer.ok = 0;
            answer.info = 'Ошибка копирования группы: ' + e.message;
            sendResponse(res, answer);
        }
    },

    copy_check: function(req, res, answer) {
        try {
            const standName = req.stand_name;
            const groupName = req.group_name;
            const sourceName = req.source_name;
            const newName = req.new_name;
            
            console.log('copy_check вызван:', { standName, groupName, sourceName, newName });
            
            if (!standName || !groupName || !sourceName || !newName) {
                answer.api = 'copy_check';
                answer.ok = 0;
                answer.info = 'Не указаны все параметры';
                sendResponse(res, answer);
                return;
            }
            
            const groupPath = path.join(rootDir, 'stands', standName, groupName);
            const sourcePath = path.join(groupPath, sourceName);
            const destPath = path.join(groupPath, newName);
            
            console.log('groupPath:', groupPath);
            console.log('sourcePath:', sourcePath);
            console.log('destPath:', destPath);
            
            if (!fs.existsSync(sourcePath)) {
                answer.api = 'copy_check';
                answer.ok = 0;
                answer.info = 'Исходная проверка не найдена: ' + sourcePath;
                sendResponse(res, answer);
                return;
            }
            
            if (fs.existsSync(destPath)) {
                answer.api = 'copy_check';
                answer.ok = 0;
                answer.info = 'Проверка с именем "' + newName + '" уже существует';
                sendResponse(res, answer);
                return;
            }
            
            copyDirectorySync(sourcePath, destPath);
            
            const checkFile = path.join(destPath, 'check.json');
            if (fs.existsSync(checkFile)) {
                const checkData = JSON.parse(fs.readFileSync(checkFile, 'utf8'));
                checkData.name = newName;
                fs.writeFileSync(checkFile, JSON.stringify(checkData, null, 2));
                console.log('check.json обновлен, новое имя:', newName);
            }
            
            answer.api = 'copy_check';
            answer.ok = 1;
            answer.info = 'Проверка "' + sourceName + '" скопирована как "' + newName + '"';
            sendResponse(res, answer);
        } catch (e) {
            console.error('Ошибка копирования проверки:', e);
            answer.api = 'copy_check';
            answer.ok = 0;
            answer.info = 'Ошибка копирования проверки: ' + e.message;
            sendResponse(res, answer);
        }
    },

    copy_test: function(req, res, answer) {
        try {
            const standName = req.stand_name;
            const groupName = req.group_name;
            const checkName = req.check_name;
            const sourceName = req.source_name;
            const newName = req.new_name;
            
            console.log('copy_test вызван:', { standName, groupName, checkName, sourceName, newName });
            
            if (!standName || !groupName || !checkName || !sourceName || !newName) {
                answer.api = 'copy_test';
                answer.ok = 0;
                answer.info = 'Не указаны все параметры';
                sendResponse(res, answer);
                return;
            }
            
            const checkPath = path.join(rootDir, 'stands', standName, groupName, checkName);
            const testsDir = path.join(checkPath, 'tests');
            const sourcePath = path.join(testsDir, sourceName + '.json');
            const destPath = path.join(testsDir, newName + '.json');
            
            console.log('sourcePath:', sourcePath);
            console.log('destPath:', destPath);
            
            if (!fs.existsSync(sourcePath)) {
                answer.api = 'copy_test';
                answer.ok = 0;
                answer.info = 'Исходный тест не найден: ' + sourcePath;
                sendResponse(res, answer);
                return;
            }
            
            if (fs.existsSync(destPath)) {
                answer.api = 'copy_test';
                answer.ok = 0;
                answer.info = 'Тест с именем "' + newName + '" уже существует';
                sendResponse(res, answer);
                return;
            }
            
            fs.copyFileSync(sourcePath, destPath);
            console.log('Файл скопирован');
            
            const testData = JSON.parse(fs.readFileSync(destPath, 'utf8'));
            testData.name = newName;
            testData.log = [];
            testData.standart = [];
            testData.result = { order: 'no ok', time: 'no ok' };
            fs.writeFileSync(destPath, JSON.stringify(testData, null, 2));
            console.log('test.json обновлен, новое имя:', newName);
            
            const checkFile = path.join(checkPath, 'check.json');
            if (fs.existsSync(checkFile)) {
                const checkData = JSON.parse(fs.readFileSync(checkFile, 'utf8'));
                if (!checkData.tests || !Array.isArray(checkData.tests)) {
                    checkData.tests = [];
                }
                if (!checkData.tests.includes(newName)) {
                    checkData.tests.push(newName);
                    fs.writeFileSync(checkFile, JSON.stringify(checkData, null, 2));
                    console.log('check.json обновлен, добавлен тест:', newName);
                }
            }
            
            answer.api = 'copy_test';
            answer.ok = 1;
            answer.info = 'Тест "' + sourceName + '" скопирован как "' + newName + '"';
            sendResponse(res, answer);
        } catch (e) {
            console.error('Ошибка копирования теста:', e);
            answer.api = 'copy_test';
            answer.ok = 0;
            answer.info = 'Ошибка копирования теста: ' + e.message;
            sendResponse(res, answer);
        }
    },

    group_get: function(req, res, answer) {
        try {
            const standName = req.stand_name;
            const groupName = req.group_name;
            if (!standName || !groupName) {
                answer.api = 'group_get';
                answer.ok = 0;
                answer.info = 'Не указаны стенд или группа';
                sendResponse(res, answer);
                return;
            }
            const groupPath = path.join(rootDir, 'stands', standName, groupName);
            if (!fs.existsSync(groupPath)) {
                answer.api = 'group_get';
                answer.ok = 0;
                answer.info = 'Группа не найдена';
                sendResponse(res, answer);
                return;
            }
            const groupFile = path.join(groupPath, 'group.json');
            let groupData = {};
            if (fs.existsSync(groupFile)) {
                groupData = JSON.parse(fs.readFileSync(groupFile, 'utf8'));
            }
            const checks = [];
            const items = fs.readdirSync(groupPath, { withFileTypes: true });
            for (const item of items) {
                if (item.isDirectory() && item.name !== 'group.json') {
                    const checkFile = path.join(groupPath, item.name, 'check.json');
                    if (fs.existsSync(checkFile)) {
                        try {
                            const cData = JSON.parse(fs.readFileSync(checkFile, 'utf8'));
                            const testsDir = path.join(groupPath, item.name, 'tests');
                            let testCount = 0;
                            if (fs.existsSync(testsDir)) {
                                const testItems = fs.readdirSync(testsDir);
                                testCount = testItems.filter(f => f.endsWith('.json')).length;
                            }
                            checks.push({
                                name: cData.name || item.name,
                                description: cData.description || '',
                                path: item.name,
                                testCount: testCount,
                                initial_state: cData.initial_state || [],
                                tests: cData.tests || []
                            });
                        } catch (e) {
                            checks.push({
                                name: item.name,
                                description: 'Ошибка чтения',
                                path: item.name,
                                error: true
                            });
                        }
                    } else {
                        checks.push({
                            name: item.name,
                            description: 'Нет конфигурации',
                            path: item.name
                        });
                    }
                }
            }
            groupData.checks_list = checks;
            answer.api = 'group_get';
            answer.group = groupData;
            answer.ok = 1;
            sendResponse(res, answer);
        } catch (e) {
            answer.api = 'group_get';
            answer.ok = 0;
            answer.info = 'Ошибка получения группы: ' + e.message;
            sendResponse(res, answer);
        }
    },

    group_save: function(req, res, answer) {
        try {
            const standName = req.stand_name;
            const groupData = req.group;
            if (!standName || !groupData || !groupData.name) {
                answer.api = 'group_save';
                answer.ok = 0;
                answer.info = 'Неверные данные';
                sendResponse(res, answer);
                return;
            }
            const groupPath = path.join(rootDir, 'stands', standName, groupData.name);
            if (!fs.existsSync(groupPath)) {
                fs.mkdirSync(groupPath, { recursive: true });
            }
            const groupToSave = {
                name: groupData.name,
                description: groupData.description || '',
                wiring_group: groupData.wiring_group || {},
                triggers: groupData.triggers || [],
                checks: groupData.checks || [],
                result: groupData.result || { order: 'no ok', time: 'no ok' }
            };
            fs.writeFileSync(
                path.join(groupPath, 'group.json'),
                JSON.stringify(groupToSave, null, 2)
            );
            answer.api = 'group_save';
            answer.ok = 1;
            answer.info = 'Группа сохранена';
            sendResponse(res, answer);
        } catch (e) {
            answer.api = 'group_save';
            answer.ok = 0;
            answer.info = 'Ошибка сохранения группы: ' + e.message;
            sendResponse(res, answer);
        }
    },

    group_delete: function(req, res, answer) {
        try {
            const standName = req.stand_name;
            const groupName = req.group_name;
            if (!standName || !groupName) {
                answer.api = 'group_delete';
                answer.ok = 0;
                answer.info = 'Не указаны стенд или группа';
                sendResponse(res, answer);
                return;
            }
            const groupPath = path.join(rootDir, 'stands', standName, groupName);
            if (!fs.existsSync(groupPath)) {
                answer.api = 'group_delete';
                answer.ok = 0;
                answer.info = 'Группа не найдена';
                sendResponse(res, answer);
                return;
            }
            fs.rmSync(groupPath, { recursive: true, force: true });
            answer.api = 'group_delete';
            answer.ok = 1;
            answer.info = 'Группа удалена';
            sendResponse(res, answer);
        } catch (e) {
            answer.api = 'group_delete';
            answer.ok = 0;
            answer.info = 'Ошибка удаления группы: ' + e.message;
            sendResponse(res, answer);
        }
    },

    check_get: function(req, res, answer) {
        try {
            const standName = req.stand_name;
            const groupName = req.group_name;
            const checkName = req.check_name;
            if (!standName || !groupName || !checkName) {
                answer.api = 'check_get';
                answer.ok = 0;
                answer.info = 'Не указаны стенд, группа или проверка';
                sendResponse(res, answer);
                return;
            }
            const checkPath = path.join(rootDir, 'stands', standName, groupName, checkName);
            if (!fs.existsSync(checkPath)) {
                answer.api = 'check_get';
                answer.ok = 0;
                answer.info = 'Проверка не найдена';
                sendResponse(res, answer);
                return;
            }
            const checkFile = path.join(checkPath, 'check.json');
            let checkData = {};
            if (fs.existsSync(checkFile)) {
                checkData = JSON.parse(fs.readFileSync(checkFile, 'utf8'));
            }
            const testsList = [];
            let testNames = [];
            if (checkData.tests && Array.isArray(checkData.tests) && checkData.tests.length > 0) {
                testNames = checkData.tests;
            } else {
                const testsDir = path.join(checkPath, 'tests');
                if (fs.existsSync(testsDir)) {
                    const testFiles = fs.readdirSync(testsDir).filter(f => f.endsWith('.json'));
                    testNames = testFiles.map(f => f.replace('.json', ''));
                }
            }
            
            for (const testName of testNames) {
                const testPath = path.join(checkPath, 'tests', testName + '.json');
                if (fs.existsSync(testPath)) {
                    try {
                        const tData = JSON.parse(fs.readFileSync(testPath, 'utf8'));
                        testsList.push({
                            name: tData.name || testName,
                            description: tData.description || '',
                            file: testName + '.json',
                            commands: tData.commands ? tData.commands.length : 0,
                            result: tData.result || null,
                            difference: tData.difference || 100,
                            stopOnError: tData.stopOnError || false
                        });
                    } catch (e) {
                        testsList.push({
                            name: testName,
                            description: 'Ошибка чтения',
                            file: testName + '.json',
                            error: true
                        });
                    }
                }
            }
            checkData.tests_list = testsList;
            checkData.tests = testNames;
            answer.api = 'check_get';
            answer.check = checkData;
            answer.ok = 1;
            sendResponse(res, answer);
        } catch (e) {
            answer.api = 'check_get';
            answer.ok = 0;
            answer.info = 'Ошибка получения проверки: ' + e.message;
            sendResponse(res, answer);
        }
    },

    check_save: function(req, res, answer) {
        try {
            const standName = req.stand_name;
            const groupName = req.group_name;
            const checkData = req.check;
            if (!standName || !groupName || !checkData || !checkData.name) {
                answer.api = 'check_save';
                answer.ok = 0;
                answer.info = 'Неверные данные';
                sendResponse(res, answer);
                return;
            }
            const checkPath = path.join(rootDir, 'stands', standName, groupName, checkData.name);
            if (!fs.existsSync(checkPath)) {
                fs.mkdirSync(checkPath, { recursive: true });
            }
            const checkToSave = {
                name: checkData.name,
                description: checkData.description || '',
                initial_state: checkData.initial_state || [],
                tests: checkData.tests || []
            };
            fs.writeFileSync(
                path.join(checkPath, 'check.json'),
                JSON.stringify(checkToSave, null, 2)
            );
            const testsDir = path.join(checkPath, 'tests');
            if (!fs.existsSync(testsDir)) {
                fs.mkdirSync(testsDir, { recursive: true });
            }
            answer.api = 'check_save';
            answer.ok = 1;
            answer.info = 'Проверка сохранена';
            sendResponse(res, answer);
        } catch (e) {
            answer.api = 'check_save';
            answer.ok = 0;
            answer.info = 'Ошибка сохранения проверки: ' + e.message;
            sendResponse(res, answer);
        }
    },

    check_delete: function(req, res, answer) {
        try {
            const standName = req.stand_name;
            const groupName = req.group_name;
            const checkName = req.check_name;
            if (!standName || !groupName || !checkName) {
                answer.api = 'check_delete';
                answer.ok = 0;
                answer.info = 'Не указаны стенд, группа или проверка';
                sendResponse(res, answer);
                return;
            }
            const checkPath = path.join(rootDir, 'stands', standName, groupName, checkName);
            if (!fs.existsSync(checkPath)) {
                answer.api = 'check_delete';
                answer.ok = 0;
                answer.info = 'Проверка не найдена';
                sendResponse(res, answer);
                return;
            }
            fs.rmSync(checkPath, { recursive: true, force: true });
            answer.api = 'check_delete';
            answer.ok = 1;
            answer.info = 'Проверка удалена';
            sendResponse(res, answer);
        } catch (e) {
            answer.api = 'check_delete';
            answer.ok = 0;
            answer.info = 'Ошибка удаления проверки: ' + e.message;
            sendResponse(res, answer);
        }
    },

    test_get_data: function(req, res, answer) {
        try {
            const standName = req.stand_name;
            const groupName = req.group_name;
            const checkName = req.check_name;
            const testName = req.test_name;
            if (!standName || !groupName || !checkName || !testName) {
                answer.api = 'test_get_data';
                answer.ok = 0;
                answer.info = 'Не указаны все параметры';
                sendResponse(res, answer);
                return;
            }
            const testPath = path.join(rootDir, 'stands', standName, groupName, checkName, 'tests', testName + '.json');
            if (!fs.existsSync(testPath)) {
                answer.api = 'test_get_data';
                answer.ok = 0;
                answer.info = 'Тест не найден';
                sendResponse(res, answer);
                return;
            }
            const testData = JSON.parse(fs.readFileSync(testPath, 'utf8'));
            answer.api = 'test_get_data';
            answer.test = testData;
            answer.ok = 1;
            sendResponse(res, answer);
        } catch (e) {
            answer.api = 'test_get_data';
            answer.ok = 0;
            answer.info = 'Ошибка получения теста: ' + e.message;
            sendResponse(res, answer);
        }
    },

    test_save_data: function(req, res, answer) {
        try {
            const standName = req.stand_name;
            const groupName = req.group_name;
            const checkName = req.check_name;
            const testData = req.test;
            if (!standName || !groupName || !checkName || !testData || !testData.name) {
                answer.api = 'test_save_data';
                answer.ok = 0;
                answer.info = 'Неверные данные';
                sendResponse(res, answer);
                return;
            }
            const testDir = path.join(rootDir, 'stands', standName, groupName, checkName, 'tests');
            if (!fs.existsSync(testDir)) {
                fs.mkdirSync(testDir, { recursive: true });
            }
            const testPath = path.join(testDir, testData.name + '.json');
            const testToSave = {
                name: testData.name,
                description: testData.description || '',
                difference: testData.difference || 100,
                stopOnError: testData.stopOnError || false,
                commands: testData.commands || [],
                log: testData.log || [],
                standart: testData.standart || [],
                result: testData.result || { order: 'no ok', time: 'no ok' }
            };
            fs.writeFileSync(testPath, JSON.stringify(testToSave, null, 2));
            
            const checkPath = path.join(rootDir, 'stands', standName, groupName, checkName);
            const checkFile = path.join(checkPath, 'check.json');
            if (fs.existsSync(checkFile)) {
                const checkData = JSON.parse(fs.readFileSync(checkFile, 'utf8'));
                if (!checkData.tests || !Array.isArray(checkData.tests)) {
                    checkData.tests = [];
                }
                if (!checkData.tests.includes(testData.name)) {
                    checkData.tests.push(testData.name);
                    fs.writeFileSync(checkFile, JSON.stringify(checkData, null, 2));
                }
            }
            
            answer.api = 'test_save_data';
            answer.ok = 1;
            answer.info = 'Тест сохранен';
            sendResponse(res, answer);
        } catch (e) {
            answer.api = 'test_save_data';
            answer.ok = 0;
            answer.info = 'Ошибка сохранения теста: ' + e.message;
            sendResponse(res, answer);
        }
    },

    test_delete_data: function(req, res, answer) {
        try {
            const standName = req.stand_name;
            const groupName = req.group_name;
            const checkName = req.check_name;
            const testName = req.test_name;
            if (!standName || !groupName || !checkName || !testName) {
                answer.api = 'test_delete_data';
                answer.ok = 0;
                answer.info = 'Не указаны все параметры';
                sendResponse(res, answer);
                return;
            }
            const testPath = path.join(rootDir, 'stands', standName, groupName, checkName, 'tests', testName + '.json');
            if (!fs.existsSync(testPath)) {
                answer.api = 'test_delete_data';
                answer.ok = 0;
                answer.info = 'Тест не найден';
                sendResponse(res, answer);
                return;
            }
            fs.unlinkSync(testPath);
            
            const checkPath = path.join(rootDir, 'stands', standName, groupName, checkName);
            const checkFile = path.join(checkPath, 'check.json');
            if (fs.existsSync(checkFile)) {
                const checkData = JSON.parse(fs.readFileSync(checkFile, 'utf8'));
                if (checkData.tests && Array.isArray(checkData.tests)) {
                    const index = checkData.tests.indexOf(testName);
                    if (index !== -1) {
                        checkData.tests.splice(index, 1);
                        fs.writeFileSync(checkFile, JSON.stringify(checkData, null, 2));
                    }
                }
            }
            
            answer.api = 'test_delete_data';
            answer.ok = 1;
            answer.info = 'Тест удален';
            sendResponse(res, answer);
        } catch (e) {
            answer.api = 'test_delete_data';
            answer.ok = 0;
            answer.info = 'Ошибка удаления теста: ' + e.message;
            sendResponse(res, answer);
        }
    },

    test_save_standart: function(req, res, answer) {
        try {
            const standName = req.stand_name;
            const groupName = req.group_name;
            const checkName = req.check_name;
            const testName = req.test_name;
            if (!standName || !groupName || !checkName || !testName) {
                answer.api = 'test_save_standart';
                answer.ok = 0;
                answer.info = 'Не указаны все параметры';
                sendResponse(res, answer);
                return;
            }
            const testPath = path.join(rootDir, 'stands', standName, groupName, checkName, 'tests', testName + '.json');
            if (!fs.existsSync(testPath)) {
                answer.api = 'test_save_standart';
                answer.ok = 0;
                answer.info = 'Тест не найден';
                sendResponse(res, answer);
                return;
            }
            const testData = JSON.parse(fs.readFileSync(testPath, 'utf8'));
            testData.standart = JSON.parse(JSON.stringify(testData.log || []));
            testData.result = { order: 'no ok', time: 'no ok' };
            fs.writeFileSync(testPath, JSON.stringify(testData, null, 2));
            answer.api = 'test_save_standart';
            answer.ok = 1;
            answer.info = 'Эталон сохранен';
            sendResponse(res, answer);
        } catch (e) {
            answer.api = 'test_save_standart';
            answer.ok = 0;
            answer.info = 'Ошибка сохранения эталона: ' + e.message;
            sendResponse(res, answer);
        }
    },

    test_run_new: function(req, res, answer) {
        try {
            const standName = req.stand_name;
            const groupName = req.group_name;
            const checkName = req.check_name || null;
            const testName = req.test_name || null;
            const mode = req.mode || 'test';

            if (!standName || !groupName) {
                answer.api = 'test_run_new';
                answer.ok = 0;
                answer.info = 'Не указаны стенд или группа';
                sendResponse(res, answer);
                return;
            }

            if (isTestRunning) {
                answer.api = 'test_run_new';
                answer.ok = 0;
                answer.info = 'Тест уже выполняется';
                sendResponse(res, answer);
                return;
            }

            const task = {
                stand: standName,
                group: groupName,
                check: checkName,
                test: testName,
                mode: mode
            };

            answer.api = 'test_run_new';
            answer.ok = 1;
            answer.info = 'Тест запущен';
            sendResponse(res, answer);

            setTimeout(() => {
                if (typeof executeTestNew === 'function') {
                    executeTestNew(task);
                }
            }, 50);

        } catch (e) {
            console.error('Ошибка в test_run_new:', e);
            answer.api = 'test_run_new';
            answer.ok = 0;
            answer.info = 'Ошибка запуска: ' + e.message;
            sendResponse(res, answer);
        }
    },

    triggers_list: function(req, res, answer) {
        try {
            const triggerList = [];
            for (const key in controllers) {
                const ctrl = controllers[key];
                if (ctrl.triggers && ctrl.triggers.length > 0) {
                    for (let i = 0; i < ctrl.triggers.length; i++) {
                        triggerList.push({
                            id: key + '_' + i,
                            controller: key,
                            type: ctrl.triggers[i].type,
                            description: ctrl.triggers[i].type + ' (' + key + ')'
                        });
                    }
                }
            }
            answer.api = 'triggers_list';
            answer.triggers = triggerList;
            answer.ok = 1;
            sendResponse(res, answer);
        } catch (e) {
            answer.api = 'triggers_list';
            answer.ok = 0;
            answer.info = 'Ошибка получения триггеров: ' + e.message;
            sendResponse(res, answer);
        }
    },

    commands_list: function(req, res, answer) {
        try {
            const commands = [
                'green', 'red', 'sound', 'lock', 'd0', 'd1',
                'open_for_out', 'open_for_in', 'new_address'
            ];
            answer.api = 'commands_list';
            answer.commands = commands;
            answer.ok = 1;
            sendResponse(res, answer);
        } catch (e) {
            answer.api = 'commands_list';
            answer.ok = 0;
            answer.info = 'Ошибка получения команд: ' + e.message;
            sendResponse(res, answer);
        }
    },

    controllers_versions: function(req, res, answer) {
        try {
            const versions = {};
            for (const key in controllers) {
                const ctrl = controllers[key];
                versions[key] = {
                    type: ctrl.type,
                    number: ctrl.number,
                    version: ctrl.version || 'unknown',
                    address: ctrl.address
                };
            }
            answer.api = 'controllers_versions';
            answer.versions = versions;
            answer.ok = 1;
            sendResponse(res, answer);
        } catch (e) {
            answer.api = 'controllers_versions';
            answer.ok = 0;
            answer.info = 'Ошибка получения версий: ' + e.message;
            sendResponse(res, answer);
        }
    },

    get_cont_info: function(req, res, answer) {
        try {
            const controllerKey = req.controller;
            if (!controllerKey) {
                answer.api = 'get_cont_info';
                answer.ok = 0;
                answer.info = 'Не указан контроллер';
                sendResponse(res, answer);
                return;
            }
            
            const ctrl = controllers[controllerKey];
            if (!ctrl) {
                answer.api = 'get_cont_info';
                answer.ok = 0;
                answer.info = 'Контроллер не найден: ' + controllerKey;
                answer.available = Object.keys(controllers);
                sendResponse(res, answer);
                return;
            }
            
            const requestId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
            
            const tempCallback = function(thet) {
                if (thet.number === ctrl.number && thet.type === ctrl.type) {
                    const response = {
                        api: 'get_cont_info_response',
                        ok: 1,
                        request_id: requestId,
                        controller: controllerKey,
                        info: {
                            type: ctrl.type,
                            number: ctrl.number,
                            version: ctrl.version,
                            address: ctrl.address,
                            active: ctrl.active,
                            data: thet.data ? Array.from(thet.data) : null
                        }
                    };
                    
                    if (res && typeof res.send === 'function') {
                        res.send(JSON.stringify(response));
                    } else if (res && typeof res === 'function') {
                        res(response);
                    } else if (res && typeof res.callback === 'function') {
                        res.callback(response);
                    }
                    
                    const index = func_api._tempCallbacks.indexOf(tempCallback);
                    if (index > -1) {
                        func_api._tempCallbacks.splice(index, 1);
                    }
                }
            };
            
            if (!func_api._tempCallbacks) {
                func_api._tempCallbacks = [];
            }
            func_api._tempCallbacks.push(tempCallback);
            
            const originalCallback = func_api.callback;
            
            func_api.callback = function(thet) {
                if (func_api._tempCallbacks) {
                    for (const cb of func_api._tempCallbacks) {
                        try {
                            cb(thet);
                        } catch (e) {
                            console.error('Ошибка в temp callback:', e);
                        }
                    }
                }
                if (originalCallback) {
                    originalCallback(thet);
                }
            };
            
            let adr = new Uint8Array([ctrl.address, 0x01, 0x00, 0x00, 0x00, 0x05]);
            let data = func_api.buff_sum([adr, func_api.getCRC(adr)]);
            ctrl.converter.add("q_fast", data);
            
            answer.api = 'get_cont_info';
            answer.ok = 1;
            answer.request_id = requestId;
            answer.info = 'Запрос информации отправлен контроллеру ' + controllerKey + ', ожидайте ответа';
            answer.controller = controllerKey;
            sendResponse(res, answer);
            
            setTimeout(() => {
                const index = func_api._tempCallbacks.indexOf(tempCallback);
                if (index > -1) {
                    func_api._tempCallbacks.splice(index, 1);
                }
                func_api.callback = originalCallback;
            }, 5000);
            
        } catch (e) {
            answer.api = 'get_cont_info';
            answer.ok = 0;
            answer.info = 'Ошибка: ' + e.message;
            sendResponse(res, answer);
        }
    },

    get_sost: function(req, res, answer) {
        try {
            const controllerKey = req.controller;
            if (!controllerKey) {
                answer.api = 'get_sost';
                answer.ok = 0;
                answer.info = 'Не указан контроллер';
                sendResponse(res, answer);
                return;
            }
            
            const ctrl = controllers[controllerKey];
            if (!ctrl) {
                answer.api = 'get_sost';
                answer.ok = 0;
                answer.info = 'Контроллер не найден: ' + controllerKey;
                answer.available = Object.keys(controllers);
                sendResponse(res, answer);
                return;
            }
            
            const requestId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
            
            const tempCallback = function(thet) {
                if (thet.number === ctrl.number && thet.type === ctrl.type) {
                    const response = {
                        api: 'get_sost_response',
                        ok: 1,
                        request_id: requestId,
                        controller: controllerKey,
                        state: {
                            outputs: thet.data ? thet.data[3] : null,
                            inputs: thet.data ? thet.data[4] : null,
                            door: thet.data ? thet.data[11] : null,
                            led: thet.data ? thet.data[12] : null,
                            zp: thet.data ? thet.data[13] : null,
                            v12: thet.data ? thet.data[14] : null,
                            data: thet.data ? Array.from(thet.data) : null
                        }
                    };
                    
                    if (res && typeof res.send === 'function') {
                        res.send(JSON.stringify(response));
                    } else if (res && typeof res === 'function') {
                        res(response);
                    } else if (res && typeof res.callback === 'function') {
                        res.callback(response);
                    }
                    
                    const index = func_api._tempCallbacks.indexOf(tempCallback);
                    if (index > -1) {
                        func_api._tempCallbacks.splice(index, 1);
                    }
                }
            };
            
            if (!func_api._tempCallbacks) {
                func_api._tempCallbacks = [];
            }
            func_api._tempCallbacks.push(tempCallback);
            
            const originalCallback = func_api.callback;
            
            func_api.callback = function(thet) {
                if (func_api._tempCallbacks) {
                    for (const cb of func_api._tempCallbacks) {
                        try {
                            cb(thet);
                        } catch (e) {
                            console.error('Ошибка в temp callback:', e);
                        }
                    }
                }
                if (originalCallback) {
                    originalCallback(thet);
                }
            };
            
            let adr = new Uint8Array([ctrl.address, 0x04, 0x00, 0x00, 0x00, 0x05]);
            let data = func_api.buff_sum([adr, func_api.getCRC(adr)]);
            ctrl.converter.add("q_fast", data);
            
            answer.api = 'get_sost';
            answer.ok = 1;
            answer.request_id = requestId;
            answer.info = 'Запрос состояния отправлен контроллеру ' + controllerKey + ', ожидайте ответа';
            answer.controller = controllerKey;
            sendResponse(res, answer);
            
            setTimeout(() => {
                const index = func_api._tempCallbacks.indexOf(tempCallback);
                if (index > -1) {
                    func_api._tempCallbacks.splice(index, 1);
                }
                func_api.callback = originalCallback;
            }, 5000);
            
        } catch (e) {
            answer.api = 'get_sost';
            answer.ok = 0;
            answer.info = 'Ошибка: ' + e.message;
            sendResponse(res, answer);
        }
    },

    set_speed: function(req, res, answer) {
        try {
            const speed = req.speed;
            if (speed !== 38400 && speed !== 115200) {
                answer.api = 'set_speed';
                answer.ok = 0;
                answer.info = 'Неверная скорость. Допустимые: 38400, 115200';
                sendResponse(res, answer);
                return;
            }
            if (global.setServerSpeed) {
                global.setServerSpeed(speed);
                answer.api = 'set_speed';
                answer.ok = 1;
                answer.info = 'Скорость изменена на ' + speed;
                sendResponse(res, answer);
            } else {
                answer.api = 'set_speed';
                answer.ok = 0;
                answer.info = 'Функция setSpeed не найдена';
                sendResponse(res, answer);
            }
        } catch (e) {
            answer.api = 'set_speed';
            answer.ok = 0;
            answer.info = 'Ошибка изменения скорости: ' + e.message;
            sendResponse(res, answer);
        }
    },

    test_stop: function(req, res, answer) {
        try {
            if (!isTestRunning) {
                answer.api = 'test_stop';
                answer.ok = 0;
                answer.info = 'Нет выполняемого теста';
                sendResponse(res, answer);
                return;
            }
            isTestRunning = false;
            answer.api = 'test_stop';
            answer.ok = 1;
            answer.info = 'Тест остановлен';
            sendResponse(res, answer);
        } catch (e) {
            answer.api = 'test_stop';
            answer.ok = 0;
            answer.info = 'Ошибка остановки: ' + e.message;
            sendResponse(res, answer);
        }
    },

    get_speed: function(req, res, answer) {
        try {
            if (global.getServerSpeed) {
                const speed = global.getServerSpeed();
                answer.api = 'get_speed';
                answer.ok = 1;
                answer.speed = speed;
                sendResponse(res, answer);
            } else {
                answer.api = 'get_speed';
                answer.ok = 0;
                answer.info = 'Функция getSpeed не найдена';
                sendResponse(res, answer);
            }
        } catch (e) {
            answer.api = 'get_speed';
            answer.ok = 0;
            answer.info = 'Ошибка получения скорости: ' + e.message;
            sendResponse(res, answer);
        }
    }
};

// ==================== func_api ====================

let func_api = {
    types: {
        led: { byte_num: 3, bits: 1 },
        zumm: { byte_num: 3, bits: 2 },
        sound: { byte_num: 3, bits: 4 },
        lock: { byte_num: 3, bits: 8 },
        tm_0: { byte_num: 4, mask: 12, shift: 2 },
        tm_1: { byte_num: 4, mask: 12, shift: 2 },
        tm_2: { byte_num: 4, mask: 12, shift: 2 },
        tm_3: { byte_num: 4, mask: 12, shift: 2 },
        exit_0: { byte_num: 4, mask: 3, shift: 0 },
        exit_1: { byte_num: 4, mask: 3, shift: 0 },
        exit_2: { byte_num: 4, mask: 3, shift: 0 },
        exit_3: { byte_num: 4, mask: 3, shift: 0 },
        reader: { byte_num: 4, bits: 16 },
        door: { byte_num: 4, bits: 32 },
        v_door: { byte_num: 12, bits: 127 },
        v_led: { byte_num: 13, bits: 127 },
        v_zp: { byte_num: 14, bits: 127 },
        v_12: { byte_num: 15, bits: 127 },
        va_door: { byte_num: 12, min: -20, max: 100, dev: 10 },
        va_led: { byte_num: 13, min: -20, max: 100, dev: 10 },
        va_zp: { byte_num: 14, min: -20, max: 100, dev: 10 },
        va_12: { byte_num: 15, min: -20, max: 100, dev: 10 },
		va_diff_12_zp: {
			byte_num: 15,    // 12v
			byte_num2: 14,   // zp
			min: 50,
			max: 250,
			dev: 10,
			isDifference: true
		},
    },

    outputs: {
        led: { byte_num: 3, value: 1 },
        zumm: { byte_num: 3, value: 2 },
        sound: { byte_num: 3, value: 4 },
        lock: { byte_num: 3, value: 8 },
        data0: { byte_num: 3, value: 5 },
        data1: { byte_num: 3, value: 6 },
    },

    _tempCallbacks: [],
    minus: function(value) {
        return new Uint8Array(new Uint16Array([~(128 * (-value)) + 1]).buffer);
    },
    plus: function(value) {
        return new Uint8Array(new Uint16Array([128 * value]).buffer);
    },
    buff_sum: function(arr) {
        let lng_all = 0;
        for (let i = 0; i < arr.length; i++) {
            lng_all = lng_all + arr[i].byteLength;
        }
        let bfull = new Uint8Array(lng_all);
        let offset = 0;
        for (let i = 0; i < arr.length; i++) {
            bfull.set(arr[i], offset);
            offset = offset + arr[i].byteLength;
        }
        return bfull;
    },
    getCRC: function(buffer) {
        let crc = new Uint16Array([0xffff]);
        let n = buffer.byteLength;
        for (let j = 0; j < n; j++) {
            crc = crc ^= Number(buffer[j]);
            for (let i = 0; i < 8; i++) {
                if (crc & 1) {
                    crc >>= 1;
                    crc ^= 0xA001;
                } else {
                    crc >>= 1;
                }
            }
        }
        return new Uint8Array(new Uint16Array([crc]).buffer);
    },
    survey_receiver: function(thet, data, ok) {
        if (ok) {
            if (thet.addresses[thet.current.data[0]].active == false) {
                thet.addresses[thet.current.data[0]].active = true;
            }
            if (thet.addresses[thet.current.data[0]].trigger) {
                thet.addresses[thet.current.data[0]].trigger(data);
            }
        } else {
            let adr = new Uint8Array([data[0], 0x04, 0x00, 0x00, 0x00, 0x05]);
            let data_out = func_api.buff_sum([adr, func_api.getCRC(adr)]);
            thet.add("q_fast", data_out, func_api.no_ansver_0);
        }
    },
    no_ansver_0: function(thet, data, ok) {
        if (ok) {
            if (thet.addresses[thet.current.data[0]].active == false) {
                thet.addresses[thet.current.data[0]].active = true;
            }
        } else {
            let adr = new Uint8Array([data[0], 0x04, 0x00, 0x00, 0x00, 0x05]);
            let data_out = func_api.buff_sum([adr, func_api.getCRC(adr)]);
            thet.add("q_fast", data_out, func_api.no_ansver);
        }
    },
    no_ansver: function(thet, data, ok) {
        if (ok) {
            if (thet.addresses[thet.current.data[0]].active == false) {
                thet.addresses[thet.current.data[0]].active = true;
            }
        } else {
            if (thet.addresses[thet.current.data[0]].active == true) {
                thet.addresses[thet.current.data[0]].active = false;
            }
        }
    },
    new_controller: function(thet, data, ok) {
        if (ok) {
            let number = (+data[10]) * 256 + (+data[9]);
            let type = (+data[3]);
            let version = (+data[4]) + '.' + (+data[5]);

            if (controllers[type + "_" + number]) {
                if (thet.count != controllers[type + "_" + number].converter_count) {
                    controllers[type + "_" + number].converter_count = thet.count;
                    controllers[type + "_" + number].converter = thet;
                    thet.addresses[data[0]] = controllers[type + "_" + number];
                }
                if (controllers[type + "_" + number].address != data[0]) {
                    controllers[type + "_" + number].address = data[0];
                    let adr = new Uint8Array([data[0], 0x04, 0x00, 0x00, 0x00, 0x05]);
                    let data_out = func_api.buff_sum([adr, func_api.getCRC(adr)]);
                    thet.addresses[data[0]].request = data_out;
                }
                if (controllers[type + "_" + number].version !== version) {
                    controllers[type + "_" + number].version = version;
                }
            } else {
                controllers[type + "_" + number] = new Controller(type, number, thet, data[0]);
                controllers[type + "_" + number].version = version;
                console.log(thet.current.data[0] + " New - " + number + " version: " + version);
                let trigger_info = { api: 'trigger_info', controller: type + '_' + number, name: 'new controller', sost: 1 };
                func_api.for_all_user(trigger_info);
                thet.addresses[data[0]] = controllers[type + "_" + number];
                let adr = new Uint8Array([data[0], 0x04, 0x00, 0x00, 0x00, 0x05]);
                let data_out = func_api.buff_sum([adr, func_api.getCRC(adr)]);
                thet.addresses[data[0]].request = data_out;
            }
        }
    },
    finding_controllers_receiver: function(thet, data, ok) {
        if (ok) {
            let adr = new Uint8Array([data[0], 0x01, 0x00, 0x00, 0x00, 0x05]);
            let data_out = func_api.buff_sum([adr, func_api.getCRC(adr)]);
            if (thet.addresses[data[0]]) {
                if (!thet.addresses[data[0]].active) {
                    thet.addresses[data[0]].active = true;
                    thet.add("q_fast", data_out, func_api.new_controller);
                }
            } else {
                thet.addresses[data[0]] = { active: true }
                thet.add("q_fast", data_out, func_api.new_controller);
            }
        } else {
            if (thet.addresses[thet.current.data[0]]) {
                if (thet.addresses[thet.current.data[0]].active) {
                    thet.addresses[thet.current.data[0]].active = false;
                }
            }
        }
    },
    finding_controllers_start: function(converter) {
        for (let i = 0; i < converter.scan_count; i++) {
            func_api.finding_make(converter);
        }
    },
    finding_make: function(converter) {
        for (let i = 0; i < 40; i++) {
            let adr = new Uint8Array([i, 0x04, 0x00, 0x00, 0x00, 0x05]);
            let data = func_api.buff_sum([adr, func_api.getCRC(adr)]);
            converter.add("q_main", data, func_api.finding_controllers_receiver);
        }
    },
    survey_make: function(converter) {
        for (let i in converter.addresses) {
            if (converter.addresses[i].request) {
                converter.add("q_main", converter.addresses[i].request);
            } else {
                let adr = new Uint8Array([i, 0x04, 0x00, 0x00, 0x00, 0x05]);
                let data = func_api.buff_sum([adr, func_api.getCRC(adr)]);
                converter.addresses[i].request = data;
                converter.add("q_main", data, func_api.finding_controllers_receiver);
            }
        }
        if (converter.scan_current < converter.scan_controllers) {
            converter.scan_current++;
        } else {
            converter.scan_current = 0;
        }
        if (!(converter.scan_current in converter.addresses)) {
            let adr = new Uint8Array([converter.scan_current, 0x04, 0x00, 0x00, 0x00, 0x05]);
            let data = func_api.buff_sum([adr, func_api.getCRC(adr)]);
            converter.add("q_main", data, func_api.finding_controllers_receiver);
        }
    },
    answer_send: function(res, msg) {
        res.writeHead(200);
        if (typeof (msg) == "object") {
            res.end(JSON.stringify(msg));
        } else {
            res.end(msg);
        }
    },
    output: function(thet, bit = 0x04, intervals = 0, intervalm = 0xff) {
        let adr = new Uint8Array([thet.address, 0x06, 0x00, bit, intervals, intervalm]);
        let data = func_api.buff_sum([adr, func_api.getCRC(adr)]);
        thet.converter.add("q_fast", data);
    },
    // ===== ИСПРАВЛЕНИЕ: эти методы не используют интервал, они только формируют пакет =====
    // interval приходит уже как Uint8Array от func_api.plus()
    green: function(thet, interval = 2) {
        let adr = new Uint8Array([thet.address, 0x06, 0x00, 0x01, interval[1], interval[0]]);
        let data = func_api.buff_sum([adr, func_api.getCRC(adr)]);
        thet.converter.add("q_fast", data);
    },
    red: function(thet, interval = 2) {
        let adr = new Uint8Array([thet.address, 0x06, 0x00, 0x02, interval[1], interval[0]]);
        let data = func_api.buff_sum([adr, func_api.getCRC(adr)]);
        thet.converter.add("q_fast", data);
    },
    sound: function(thet, interval = 2) {
        let adr = new Uint8Array([thet.address, 0x06, 0x00, 0x03, interval[1], interval[0]]);
        let data = func_api.buff_sum([adr, func_api.getCRC(adr)]);
        thet.converter.add("q_fast", data);
    },
    d0: function(thet, interval = 2) {
        let adr = new Uint8Array([thet.address, 0x06, 0x00, 0x05, interval[1], interval[0]]);
        let data = func_api.buff_sum([adr, func_api.getCRC(adr)]);
        thet.converter.add("q_fast", data);
    },
    d1: function(thet, interval = 2) {
        let adr = new Uint8Array([thet.address, 0x06, 0x00, 0x06, interval[1], interval[0]]);
        let data = func_api.buff_sum([adr, func_api.getCRC(adr)]);
        thet.converter.add("q_fast", data);
    },
    lock: function(thet, interval = 0) {
        let adr = new Uint8Array([thet.address, 0x06, 0x00, 0x04, interval[1], interval[0]]);
        let data = func_api.buff_sum([adr, func_api.getCRC(adr)]);
        thet.converter.add("q_fast", data);
    },
    new_address: function(thet, new_ard = 2) {
        let adr = new Uint8Array([thet.address, 0x06, 0x00, 0x10, new_ard, new_ard]);
        let data = func_api.buff_sum([adr, func_api.getCRC(adr)]);
        thet.converter.add("q_fast", data);
    },
    get_info: function(thet) {
        let adr = new Uint8Array([thet.address, 0x01, 0x00, 0x00, 0x00, 0x05]);
        let data = func_api.buff_sum([adr, func_api.getCRC(adr)]);
        thet.converter.add("q_fast", data);
    },
    for_all_user: function(trigger_info) {
        for (let i in list_cl) {
            console.log(i);
            list_cl[i].send(JSON.stringify(trigger_info));
        }
    },
    callback: function(thet) {
        let answer = {};
        answer.api = 'trigger_info';
        answer.trigger_info = thet.trigger_info;
        if (thet.trigger_info && thet.trigger_info.data) {
            answer.trigger_info.data = thet.trigger_info.data;
        }

        if (isTestRunning) {
            const currentTime = Date.now() - testStartTime;
            testLog.push([currentTime, { api: 'trigger_info', trigger_info: thet.trigger_info }]);
        }

        for (let i in list_cl) {
            console.log(i);
            list_cl[i].send(JSON.stringify(answer));
        }
    },
};

module.exports = {
    init,
    setFileSystem,
    out_api,
    func_api
};