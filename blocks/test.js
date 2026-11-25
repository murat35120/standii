// blocks/test.js
// Блок тестирования
// ИСПРАВЛЕНО: поддержка дробных интервалов в командах тестов

let converters, controllers, cards, tests, testLog, isTestRunning, testStartTime, list_cl, num, admins, func_api;
let fs, path, rootDir, out_api;

function init(conv, ctrl, card, t, log, running, startTime, list, n, admin, funcApi) {
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
    func_api = funcApi;
    console.log('test.js init вызван');
}

function setFileSystem(fsModule, pathModule, root, outApi) {
    fs = fsModule;
    path = pathModule;
    rootDir = root;
    out_api = outApi;
}

let api_test = {
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
    plus: function(value) {
        return new Uint8Array(new Uint16Array([128 * value]).buffer);
    },
    green: function(thet, interval) {
        let adr = new Uint8Array([thet.address, 0x06, 0x00, 0x01, interval[1], interval[0]]);
        let data = api_test.buff_sum([adr, api_test.getCRC(adr)]);
        thet.converter.add("q_fast", data);
    },
    red: function(thet, interval) {
        let adr = new Uint8Array([thet.address, 0x06, 0x00, 0x02, interval[1], interval[0]]);
        let data = api_test.buff_sum([adr, api_test.getCRC(adr)]);
        thet.converter.add("q_fast", data);
    },
    sound: function(thet, interval) {
        let adr = new Uint8Array([thet.address, 0x06, 0x00, 0x03, interval[1], interval[0]]);
        let data = api_test.buff_sum([adr, api_test.getCRC(adr)]);
        thet.converter.add("q_fast", data);
    },
    d0: function(thet, interval) {
        let adr = new Uint8Array([thet.address, 0x06, 0x00, 0x05, interval[1], interval[0]]);
        let data = api_test.buff_sum([adr, api_test.getCRC(adr)]);
        thet.converter.add("q_fast", data);
    },
    d1: function(thet, interval) {
        let adr = new Uint8Array([thet.address, 0x06, 0x00, 0x06, interval[1], interval[0]]);
        let data = api_test.buff_sum([adr, api_test.getCRC(adr)]);
        thet.converter.add("q_fast", data);
    },
    lock: function(thet, interval) {
        let adr = new Uint8Array([thet.address, 0x06, 0x00, 0x04, interval[1], interval[0]]);
        let data = api_test.buff_sum([adr, api_test.getCRC(adr)]);
        thet.converter.add("q_fast", data);
    },
    new_address: function(thet, new_ard) {
        let adr = new Uint8Array([thet.address, 0x06, 0x00, 0x10, new_ard, new_ard]);
        let data = api_test.buff_sum([adr, api_test.getCRC(adr)]);
        thet.converter.add("q_fast", data);
    },
    get_info: function(thet) {
        let adr = new Uint8Array([thet.address, 0x01, 0x00, 0x00, 0x00, 0x05]);
        let data = api_test.buff_sum([adr, api_test.getCRC(adr)]);
        thet.converter.add("q_fast", data);
    }
};

function executeTest(testObject) {
    if (isTestRunning) {
        console.log('Тест уже выполняется');
        return;
    }

    isTestRunning = true;
    const localStartTime = Date.now();
    testStartTime = localStartTime;
    testLog = [];

    const controllerKey = testObject.controller;
    const controller = controllers[controllerKey];

    if (!controller) {
        console.log('Контроллер не найден:', controllerKey);
        isTestRunning = false;
        return;
    }

    testLog.push([0, { api: 'test_run', name: testObject.name }]);

    let maxDelay = 0;
    for (const cmd of testObject.test) {
        const [delayMs, command, seconds] = cmd;
        if (delayMs > maxDelay) maxDelay = delayMs;

        setTimeout(() => {
            const currentTime = Date.now() - localStartTime;

            if (command === 'stop') {
                testLog.push([currentTime, { api: 'stop', time: seconds }]);
                console.log('Stop команда в', delayMs, 'мс');
            } else {
                const cmdFunc = api_test[command];
                if (cmdFunc) {
                    // ===== ИСПРАВЛЕНИЕ: используем parseFloat для поддержки дробных интервалов =====
                    const interval = parseFloat(seconds) || 2;
                    cmdFunc(controller, api_test.plus(Math.abs(interval)));
                    testLog.push([currentTime, { api: command, interval: interval }]);
                    console.log('Команда', command, 'отправлена в', delayMs, 'мс, интервал:', interval);
                } else {
                    console.log('Неизвестная команда:', command);
                }
            }
        }, delayMs);
    }

    setTimeout(() => {
        isTestRunning = false;

        const logMessage = {
            api: 'test_log',
            log: testLog,
            name: testObject.name,
            completed: true
        };

        for (let i in list_cl) {
            try {
                list_cl[i].send(JSON.stringify(logMessage));
            } catch (e) {
                console.error('Ошибка отправки лога:', e);
            }
        }

        console.log('Тест завершен, лог отправлен');
    }, maxDelay + 100);
}

function compareLogWithStandart(log, standart, difference) {
    console.log('=== СРАВНЕНИЕ ЛОГА С ЭТАЛОНОМ ===');
    console.log('Длина лога:', log ? log.length : 0);
    console.log('Длина эталона:', standart ? standart.length : 0);
    console.log('Допустимая погрешность:', difference, 'мс');
    
    const result = { order: 'ok', time: 'ok', order_diff: [], time_diff: [] };
    
    if (!log || !standart) {
        result.order = 'no ok';
        result.time = 'no ok';
        if (!log) result.order_diff.push('Лог пуст');
        if (!standart) result.time_diff.push('Эталон пуст');
        console.log('Результат: лог или эталон пуст');
        return result;
    }
    
    if (log.length !== standart.length) {
        result.order = 'no ok';
        result.order_diff.push('Количество событий не совпадает: лог=' + log.length + ', эталон=' + standart.length);
        console.log('Количество событий не совпадает');
    } else {
        for (let i = 0; i < log.length; i++) {
            const logName = typeof log[i][1] === 'object' ? JSON.stringify(log[i][1]) : String(log[i][1]);
            const standartName = typeof standart[i][1] === 'object' ? JSON.stringify(standart[i][1]) : String(standart[i][1]);
            if (logName !== standartName) {
                result.order = 'no ok';
                result.order_diff.push('Событие ' + i + ': "' + logName + '" != "' + standartName + '"');
                console.log('Ошибка порядка в событии', i, ':', logName, '!=', standartName);
            }
        }
    }
    
    if (log.length !== standart.length) {
        result.time = 'no ok';
        result.time_diff.push('Количество событий не совпадает');
        console.log('Количество событий не совпадает для времени');
    } else {
        for (let i = 0; i < log.length; i++) {
            const logName = typeof log[i][1] === 'object' ? JSON.stringify(log[i][1]) : String(log[i][1]);
            const standartName = typeof standart[i][1] === 'object' ? JSON.stringify(standart[i][1]) : String(standart[i][1]);
            if (logName !== standartName) {
                result.time = 'no ok';
                result.time_diff.push('Событие ' + i + ': "' + logName + '" != "' + standartName + '"');
                console.log('Ошибка времени (имя) в событии', i, ':', logName, '!=', standartName);
            }
            const timeDiff = Math.abs(log[i][0] - standart[i][0]);
            if (timeDiff > difference) {
                result.time = 'no ok';
                result.time_diff.push('Время события ' + i + ': ' + log[i][0] + ' != ' + standart[i][0] + ' (разница ' + timeDiff + ' > ' + difference + ')');
                console.log('Ошибка времени в событии', i, ':', log[i][0], '!=', standart[i][0], 'разница', timeDiff, '>', difference);
            }
        }
    }
    
    console.log('Результат сравнения:', JSON.stringify(result, null, 2));
    return result;
}

function findControllerByKey(key) {
    return controllers[key] || null;
}

function findControllerByNumber(number) {
    for (const key in controllers) {
        if (controllers[key].number == number) {
            return controllers[key];
        }
    }
    return null;
}

function executeAliasCommand(aliasName, params, aliasMap) {
    if (!aliasMap || !aliasMap[aliasName]) {
        console.log('Алиас не найден:', aliasName);
        return false;
    }
    const alias = aliasMap[aliasName];
    let targetController = null;
    if (alias.controller) {
        targetController = findControllerByKey(alias.controller);
    }
    if (!targetController && alias.controller) {
        const num = parseInt(alias.controller);
        if (!isNaN(num)) {
            targetController = findControllerByNumber(num);
        }
    }
    if (!targetController) {
        console.log('Контроллер не найден для алиаса:', aliasName);
        return false;
    }
    const command = alias.command;
    // ===== ИСПРАВЛЕНИЕ: поддержка дробных параметров =====
    let interval = parseFloat(params) || 2;
    if (alias.inversion === 'yes') {
        interval = -interval;
    }
    if (func_api[command]) {
        func_api[command](targetController, func_api.plus(Math.abs(interval)));
        return true;
    } else if (out_api && out_api[command]) {
        const req = { controller: targetController.type + '_' + targetController.number, interval: Math.abs(interval) };
        const res = { send: function(data) {} };
        const answer = {};
        out_api[command](req, res, answer);
        return true;
    }
    console.log('Команда не найдена:', command);
    return false;
}

function logTriggerEvent(thet, localStartTime) {
    if (isTestRunning) {
        const startTime = localStartTime || testStartTime;
        const currentTime = Date.now() - startTime;
        let eventName = 'trigger';
        if (thet.trigger_info && thet.trigger_info.name) {
            eventName = thet.trigger_info.name;
        }
        const logEntry = [currentTime, eventName, thet.trigger_info];
        testLog.push(logEntry);
        
        const logMessage = {
            api: 'test_log',
            log: testLog,
            is_running: isTestRunning
        };
        for (let i in list_cl) {
            try {
                list_cl[i].send(JSON.stringify(logMessage));
            } catch (e) {
                console.error('Ошибка отправки лога:', e);
            }
        }
    }
}

function executeTestNew(task) {
    if (isTestRunning) {
        return;
    }

    isTestRunning = true;
    const globalStartTime = Date.now();
    testStartTime = globalStartTime;
    testLog = [];

    const standPath = path.join(rootDir, 'stands', task.stand);
    const groupPath = path.join(standPath, task.group);
    
    let standData = {};
    const standFile = path.join(standPath, 'stand.json');
    if (fs.existsSync(standFile)) {
        standData = JSON.parse(fs.readFileSync(standFile, 'utf8'));
    } else {
        isTestRunning = false;
        return;
    }
    
    const aliasMap = standData.alias || {};

    const groupFile = path.join(groupPath, 'group.json');
    if (!fs.existsSync(groupFile)) {
        isTestRunning = false;
        return;
    }
    const groupData = JSON.parse(fs.readFileSync(groupFile, 'utf8'));
    
    // Удаляем все триггеры
    for (const key in controllers) {
        const ctrl = controllers[key];
        if (ctrl.triggers && ctrl.triggers.length > 0) {
            for (let i = ctrl.triggers.length - 1; i >= 0; i--) {
                ctrl.dell_trigger(i);
            }
        }
    }

    // Добавляем триггеры из группы
    const groupTriggers = groupData.triggers || [];

    for (const tr of groupTriggers) {
        const aliasInfo = aliasMap[tr.type];
        if (!aliasInfo) continue;
        
        const controllerKey = tr.controller || aliasInfo.controller;
        const targetController = findControllerByKey(controllerKey);
        if (!targetController) continue;
        
        const triggerConfig = {
            type: tr.trigger || aliasInfo.trigger,
            callback: function(thet) {
                const localStart = currentTestLocalStart || globalStartTime;
                logTriggerEvent(thet, localStart);
            }
        };
        
        if (tr.sost !== undefined) {
            triggerConfig.sost = tr.sost;
        }
        if (tr.min !== undefined) {
            triggerConfig.min = tr.min;
        }
        if (tr.max !== undefined) {
            triggerConfig.max = tr.max;
        }
        if (tr.dev !== undefined) {
            triggerConfig.dev = tr.dev;
        }
        
        try {
            targetController.add_trigger(triggerConfig);
        } catch (e) {
            console.error('Ошибка добавления триггера:', e);
        }
    }

    function addLogEntry(time, eventName, data) {
        let displayName = eventName;
        for (const aliasKey in aliasMap) {
            if (aliasMap[aliasKey].command === eventName) {
                displayName = aliasKey;
                break;
            }
            if (aliasMap[aliasKey].trigger === eventName) {
                displayName = aliasKey;
                break;
            }
        }
        const logEntry = [time, displayName, data];
        testLog.push(logEntry);
        return logEntry;
    }

    function broadcastLog() {
        const logMessage = {
            api: 'test_log',
            log: testLog,
            is_running: isTestRunning
        };
        for (let i in list_cl) {
            try {
                list_cl[i].send(JSON.stringify(logMessage));
            } catch (e) {
                console.error('Ошибка отправки лога:', e);
            }
        }
    }

    function saveTestResult(testPath, result) {
        try {
            if (fs.existsSync(testPath)) {
                const testData = JSON.parse(fs.readFileSync(testPath, 'utf8'));
                testData.log = testLog;
                testData.result = result;
                fs.writeFileSync(testPath, JSON.stringify(testData, null, 2));
            }
        } catch (e) {
            console.error('Ошибка сохранения результата теста:', e);
        }
    }

    function updateGroupResult(standName, groupName, result) {
        try {
            const groupFile = path.join(rootDir, 'stands', standName, groupName, 'group.json');
            if (fs.existsSync(groupFile)) {
                const groupData = JSON.parse(fs.readFileSync(groupFile, 'utf8'));
                const existing = groupData.result || {};
                if (!existing.order || existing.order === 'ok' || result.order === 'no ok') {
                    groupData.result = result;
                } else if (existing.order === 'no ok' && result.order === 'ok') {
                    // Если уже есть ошибка, не перезаписываем на успех
                } else {
                    groupData.result = result;
                }
                fs.writeFileSync(groupFile, JSON.stringify(groupData, null, 2));
            }
        } catch (e) {
            console.error('Ошибка обновления результата группы:', e);
        }
    }

    let currentTestLocalStart = globalStartTime;
    let testQueue = [];
    let isProcessingQueue = false;

    function getTestData(checkName, testName) {
        const testPath = path.join(groupPath, checkName, 'tests', testName + '.json');
        if (!fs.existsSync(testPath)) {
            return null;
        }
        try {
            return JSON.parse(fs.readFileSync(testPath, 'utf8'));
        } catch (e) {
            console.error('Ошибка чтения теста:', e);
            return null;
        }
    }

    function processQueue() {
        if (isProcessingQueue) return;
        if (testQueue.length === 0) {
            isProcessingQueue = false;
            const logMessage = {
                api: 'test_log',
                log: testLog,
                completed: true,
                result: { order: 'ok', time: 'ok' }
            };
            for (let i in list_cl) {
                try {
                    list_cl[i].send(JSON.stringify(logMessage));
                } catch (e) {
                    console.error('Ошибка отправки лога:', e);
                }
            }
            isTestRunning = false;
            return;
        }
        
        isProcessingQueue = true;
        const item = testQueue.shift();
        
        const logMessage = {
            api: 'test_log',
            current_check: item.check || '',
            current_test: item.test || '',
            is_running: true
        };
        for (let i in list_cl) {
            try {
                list_cl[i].send(JSON.stringify(logMessage));
            } catch (e) {
                console.error('Ошибка отправки информации о текущем тесте:', e);
            }
        }
        
        runTestWithPromise(item.check, item.test).then((result) => {
            isProcessingQueue = false;
            
            if (result && (result.order === 'no ok' || result.time === 'no ok')) {
                const testData = getTestData(item.check, item.test);
                if (testData && testData.stopOnError === true) {
                    console.log('⏹️ Остановка выполнения: тест "' + item.test + '" завершился с ошибкой, stopOnError=true');
                    testQueue = [];
                    const stopMessage = {
                        api: 'test_log',
                        log: testLog,
                        is_running: false,
                        stopped: true,
                        completed: true,
                        result: { 
                            order: 'stopped', 
                            time: 'stopped', 
                            order_diff: ['Тест "' + item.test + '" завершился с ошибкой, выполнение остановлено'], 
                            time_diff: [] 
                        }
                    };
                    for (let i in list_cl) {
                        try {
                            list_cl[i].send(JSON.stringify(stopMessage));
                        } catch (e) {
                            console.error('Ошибка отправки лога об остановке:', e);
                        }
                    }
                    isTestRunning = false;
                    return;
                }
            }
            
            setTimeout(processQueue, 100);
        });
    }

    function runTestWithPromise(checkName, testName) {
        return new Promise((resolve) => {
            const testPath = path.join(groupPath, checkName, 'tests', testName + '.json');
            if (!fs.existsSync(testPath)) {
                resolve(null);
                return;
            }
            
            const testData = JSON.parse(fs.readFileSync(testPath, 'utf8'));
            const difference = testData.difference || 100;
            
            const localStartTime = Date.now();
            currentTestLocalStart = localStartTime;
            
            let hasTestEnd = false;
            let testEndTime = 0;
            if (testData.commands && Array.isArray(testData.commands)) {
                for (const cmd of testData.commands) {
                    const cmdName = String(cmd.command || '').trim();
                    if (cmdName === 'test_end') {
                        hasTestEnd = true;
                        testEndTime = cmd.time || 0;
                        console.log('✅ Найдена команда test_end в тесте, время:', testEndTime, 'мс');
                        break;
                    }
                }
            }
            console.log('hasTestEnd:', hasTestEnd, 'testEndTime:', testEndTime);
            
            testLog = [];
            
            addLogEntry(0, 'test_start', { name: testData.name });
            broadcastLog();
            
            let maxDelay = 0;
            const commands = testData.commands || [];
            
            if (commands.length > 0) {
                for (const cmd of commands) {
                    const delayMs = cmd.time || 0;
                    const command = cmd.command;
                    
                    if (command === 'test_end') {
                        console.log('⏭️ Команда test_end пропущена (не выполняется)');
                        continue;
                    }
                    
                    if (delayMs > maxDelay) maxDelay = delayMs;
                }
            }
            
            let totalDelay;
            if (hasTestEnd && testEndTime > 0) {
                totalDelay = testEndTime + 500;
                console.log('⏳ Используем время test_end из теста:', testEndTime, 'мс + 500мс =', totalDelay);
            } else {
                totalDelay = maxDelay + 500;
                console.log('⏳ test_end не найден, используем maxDelay + 500:', maxDelay, '+ 500 =', totalDelay);
            }
            
            if (commands.length > 0) {
                for (const cmd of commands) {
                    const delayMs = cmd.time || 0;
                    const command = cmd.command;
                    const data = cmd.data || 2;
                    
                    if (command === 'test_end') {
                        continue;
                    }
                    
                    setTimeout(() => {
                        const currentTime = Date.now() - localStartTime;
                        if (aliasMap[command]) {
                            // ===== ИСПРАВЛЕНИЕ: поддержка дробных интервалов =====
                            const interval = parseFloat(data) || 2;
                            const success = executeAliasCommand(command, interval, aliasMap);
                            if (success) {
                                addLogEntry(currentTime, command, { action: 'execute', data: interval });
                                broadcastLog();
                                console.log('Алиас', command, 'выполнен в', delayMs, 'мс, интервал:', interval);
                            } else {
                                addLogEntry(currentTime, 'error', { command: command, error: 'Алиас не выполнен' });
                                broadcastLog();
                                console.log('Ошибка выполнения алиаса:', command);
                            }
                        } else if (command === 'stop') {
                            addLogEntry(currentTime, 'stop', { time: data });
                            broadcastLog();
                            console.log('Stop команда в', delayMs, 'мс');
                        } else {
                            let targetController = null;
                            if (standData.controllers && standData.controllers.length > 0) {
                                targetController = findControllerByNumber(standData.controllers[0]);
                            }
                            if (!targetController) {
                                for (const key in controllers) {
                                    targetController = controllers[key];
                                    break;
                                }
                            }
                            if (targetController && func_api[command]) {
                                // ===== ИСПРАВЛЕНИЕ: поддержка дробных интервалов =====
                                const interval = parseFloat(data) || 2;
                                func_api[command](targetController, func_api.plus(Math.abs(interval)));
                                addLogEntry(currentTime, command, { interval: interval });
                                broadcastLog();
                                console.log('Команда', command, 'отправлена в', delayMs, 'мс, интервал:', interval);
                            } else {
                                addLogEntry(currentTime, 'error', { command: command, error: 'Неизвестная команда' });
                                broadcastLog();
                                console.log('Неизвестная команда:', command);
                            }
                        }
                    }, delayMs);
                }
            }
            
            console.log('⏳ Ожидание завершения теста, totalDelay:', totalDelay, 'мс от локального старта');
            
            setTimeout(() => {
                const endTime = Date.now() - localStartTime;
                
                addLogEntry(endTime, 'test_end', { name: testData.name });
                console.log('✅ test_end добавлен в лог (локальное время:', endTime, 'мс)');
                broadcastLog();
                
                let result = { order: 'no ok', time: 'no ok', order_diff: [], time_diff: [] };
                if (testData.standart && testData.standart.length > 0) {
                    result = compareLogWithStandart(testLog, testData.standart, difference);
                } else {
                    result.order_diff.push('Нет эталона для сравнения');
                    result.time_diff.push('Нет эталона для сравнения');
                }
                
                saveTestResult(testPath, result);
                
                const logMessage = {
                    api: 'test_log',
                    log: testLog,
                    name: testData.name,
                    completed: true,
                    result: result,
                    order_diff: result.order_diff,
                    time_diff: result.time_diff
                };
                
                for (let i in list_cl) {
                    try {
                        list_cl[i].send(JSON.stringify(logMessage));
                    } catch (e) {
                        console.error('Ошибка отправки лога:', e);
                    }
                }
                
                console.log('Тест завершен:', testName);
                resolve(result);
            }, totalDelay);
        });
    }

    async function runTests() {
        try {
            let checksToRun = [];
            let testsToRun = [];

            if (task.mode === 'group') {
                const items = fs.readdirSync(groupPath, { withFileTypes: true });
                const checkDirs = [];
                for (const item of items) {
                    if (item.isDirectory() && item.name !== 'group.json') {
                        const checkFile = path.join(groupPath, item.name, 'check.json');
                        if (fs.existsSync(checkFile)) {
                            checkDirs.push(item.name);
                        }
                    }
                }
                
                for (const checkName of checkDirs) {
                    const checkPath = path.join(groupPath, checkName);
                    const checkFile = path.join(checkPath, 'check.json');
                    if (fs.existsSync(checkFile)) {
                        try {
                            const checkData = JSON.parse(fs.readFileSync(checkFile, 'utf8'));
                            
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
                            
                            if (checkData.initial_state && checkData.initial_state.length > 0) {
                                for (const state of checkData.initial_state) {
                                    const alias = state.command;
                                    // ===== ИСПРАВЛЕНИЕ: поддержка дробных интервалов =====
                                    const data = parseFloat(state.data) || 2;
                                    executeAliasCommand(alias, data, aliasMap);
                                    await new Promise(resolve => setTimeout(resolve, 100));
                                }
                                await new Promise(resolve => setTimeout(resolve, 500));
                            }
                            
                            for (const testName of testNames) {
                                const testPath = path.join(checkPath, 'tests', testName + '.json');
                                if (fs.existsSync(testPath)) {
                                    testQueue.push({ check: checkName, test: testName });
                                } else {
                                    console.warn('Тест не найден:', testName);
                                }
                            }
                        } catch (e) {
                            console.error('Ошибка чтения check.json для', checkName, ':', e);
                        }
                    }
                }
                
            } else if (task.mode === 'check') {
                if (task.check) {
                    const checkPath = path.join(groupPath, task.check);
                    const checkFile = path.join(checkPath, 'check.json');
                    if (fs.existsSync(checkFile)) {
                        const checkData = JSON.parse(fs.readFileSync(checkFile, 'utf8'));
                        
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
                        
                        if (checkData.initial_state && checkData.initial_state.length > 0) {
                            for (const state of checkData.initial_state) {
                                const alias = state.command;
                                // ===== ИСПРАВЛЕНИЕ: поддержка дробных интервалов =====
                                const data = parseFloat(state.data) || 2;
                                executeAliasCommand(alias, data, aliasMap);
                                await new Promise(resolve => setTimeout(resolve, 100));
                            }
                            await new Promise(resolve => setTimeout(resolve, 500));
                        }
                        
                        for (const testName of testNames) {
                            const testPath = path.join(checkPath, 'tests', testName + '.json');
                            if (fs.existsSync(testPath)) {
                                testQueue.push({ check: task.check, test: testName });
                            } else {
                                console.warn('Тест не найден:', testName);
                            }
                        }
                    }
                }
            } else if (task.mode === 'test') {
                if (task.check && task.test) {
                    testQueue.push({ check: task.check, test: task.test });
                }
            }

            console.log('📋 Сформирована очередь тестов:', testQueue.length, testQueue.map(t => t.test).join(', '));
            processQueue();

        } catch (e) {
            console.error('Ошибка выполнения теста:', e);
            isTestRunning = false;
        }
    }

    runTests();
}

module.exports = {
    init: init,
    setFileSystem: setFileSystem,
    api_test: api_test,
    executeTest: executeTest,
    executeTestNew: executeTestNew
};