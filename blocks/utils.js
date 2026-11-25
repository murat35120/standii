// blocks/utils.js
// Блок утилит - вспомогательные функции

// Глобальные переменные (передаются из index.js)
let converters, controllers, cards, tests, testLog, isTestRunning, testStartTime, list_cl, num, admins, func_api;
let fs, path, rootDir;

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
    console.log('✅ utils.js инициализирован');
}

function setFileSystem(fsModule, pathModule, root) {
    fs = fsModule;
    path = pathModule;
    rootDir = root;
    console.log('✅ utils.js: файловая система установлена');
}

function os_func() {
    this.execCommand = function(cmd, callback) {
        exec(cmd, (error, stdout, stderr) => {
            if (error) {
                console.error(`exec error: ${error}`);
                return;
            }
            callback(stdout);
        });
    }
}

function type_i() {
    console.log('=== type_i() вызван ===');
    let temp = {};
    for (let i in func_api.types) {
        const type = func_api.types[i];
        const byteNum = type.byte_num;
        
        if (!temp[byteNum]) {
            temp[byteNum] = {};
        }
        
        if (type.min !== undefined) {
            // Аналоговые триггеры (va_*)
            temp[byteNum]['va'] = i;
        } else if (type.bits !== undefined) {
            // Дискретные триггеры
            if (type.bits === 127) {
                // Для v_* триггеров (v_door, v_led, v_zp, v_12)
                temp[byteNum][127] = i;
            } else {
                temp[byteNum][type.bits] = i;
            }
        } else {
            temp[byteNum] = i;
        }
    }
    func_api.type_info = temp;
    console.log('✅ type_info инициализирован, байтовые номера:', Object.keys(func_api.type_info));
}

// ============ ДОПОЛНИТЕЛЬНЫЕ УТИЛИТЫ ============

function readJsonFile(filePath, defaultData = null) {
    try {
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(content);
        }
        return defaultData;
    } catch (e) {
        console.error('Ошибка чтения JSON файла:', filePath, e.message);
        return defaultData;
    }
}

function writeJsonFile(filePath, data) {
    try {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (e) {
        console.error('Ошибка записи JSON файла:', filePath, e.message);
        return false;
    }
}

function removeDir(dirPath) {
    try {
        if (fs.existsSync(dirPath)) {
            fs.rmSync(dirPath, { recursive: true, force: true });
            return true;
        }
        return false;
    } catch (e) {
        console.error('Ошибка удаления папки:', dirPath, e.message);
        return false;
    }
}

function getSubdirs(dirPath) {
    try {
        if (!fs.existsSync(dirPath)) {
            return [];
        }
        const items = fs.readdirSync(dirPath, { withFileTypes: true });
        const dirs = [];
        for (const item of items) {
            if (item.isDirectory()) {
                dirs.push(item.name);
            }
        }
        return dirs;
    } catch (e) {
        console.error('Ошибка получения списка папок:', dirPath, e.message);
        return [];
    }
}

function getFilesByExt(dirPath, ext) {
    try {
        if (!fs.existsSync(dirPath)) {
            return [];
        }
        const items = fs.readdirSync(dirPath, { withFileTypes: true });
        const files = [];
        for (const item of items) {
            if (item.isFile() && item.name.endsWith(ext)) {
                files.push(item.name);
            }
        }
        return files;
    } catch (e) {
        console.error('Ошибка получения списка файлов:', dirPath, e.message);
        return [];
    }
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

function formatTime(ms) {
    if (ms < 1000) {
        return ms + 'мс';
    }
    const seconds = Math.floor(ms / 1000);
    const milliseconds = ms % 1000;
    if (seconds < 60) {
        return seconds + 'с ' + milliseconds + 'мс';
    }
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return minutes + 'м ' + secs + 'с ' + milliseconds + 'мс';
}

function findInArray(arr, key, value) {
    for (let i = 0; i < arr.length; i++) {
        if (arr[i][key] === value) {
            return i;
        }
    }
    return -1;
}

function cloneObject(obj) {
    return JSON.parse(JSON.stringify(obj));
}

function getNestedValue(obj, path, defaultValue = undefined) {
    const keys = path.split('.');
    let result = obj;
    for (const key of keys) {
        if (result === undefined || result === null) {
            return defaultValue;
        }
        result = result[key];
    }
    return result === undefined ? defaultValue : result;
}

function deepEqual(obj1, obj2) {
    return JSON.stringify(obj1) === JSON.stringify(obj2);
}

function getTimestamp() {
    return Date.now();
}

function findAliasByCommand(aliasMap, command) {
    if (!aliasMap) return null;
    for (const [key, value] of Object.entries(aliasMap)) {
        if (value.command === command) {
            return key;
        }
    }
    return null;
}

function findControllerByNumber(number) {
    for (const key in controllers) {
        if (controllers[key].number == number || controllers[key].number === number) {
            return controllers[key];
        }
    }
    return null;
}

function findControllerByKey(key) {
    return controllers[key] || null;
}

function getAllTriggers() {
    const result = [];
    for (const key in controllers) {
        const ctrl = controllers[key];
        if (ctrl.triggers && ctrl.triggers.length > 0) {
            for (let i = 0; i < ctrl.triggers.length; i++) {
                result.push({
                    id: key + '_' + i,
                    controller: key,
                    type: ctrl.triggers[i].type,
                    description: ctrl.triggers[i].type + ' (' + key + ')'
                });
            }
        }
    }
    return result;
}

function getAvailableCommands() {
    const commands = [
        { name: 'green', description: 'Включить зеленый свет' },
        { name: 'red', description: 'Включить красный свет' },
        { name: 'sound', description: 'Включить звук' },
        { name: 'lock', description: 'Управление замком' },
        { name: 'd0', description: 'Выдача 0 на DATA0' },
        { name: 'd1', description: 'Выдача 0 на DATA1' },
        { name: 'open_for_out', description: 'Открыть выход' },
        { name: 'open_for_in', description: 'Открыть вход' },
        { name: 'new_address', description: 'Смена адреса' }
    ];
    return commands;
}

// ============ НОВЫЕ УТИЛИТЫ ДЛЯ USB ============

function getUsbConverters() {
    const result = [];
    for (let i = 0; i < converters.length; i++) {
        const conv = converters[i];
        if (conv.connectionType === 'usb' || conv.type === 'usb') {
            result.push({
                index: i,
                converter: conv,
                path: conv.usbPath || 'unknown',
                number: conv.number,
                version: conv.version,
                connected: conv.connected,
                addresses: Object.keys(conv.addresses || {}).length
            });
        }
    }
    return result;
}

function getEthernetConverters() {
    const result = [];
    for (let i = 0; i < converters.length; i++) {
        const conv = converters[i];
        if (conv.connectionType === 'ethernet' || conv.type === 'ethernet') {
            result.push({
                index: i,
                converter: conv,
                address: conv.socket ? conv.socket.remoteAddress : 'unknown',
                number: conv.number,
                version: conv.version,
                connected: conv.connected,
                addresses: Object.keys(conv.addresses || {}).length
            });
        }
    }
    return result;
}

function getConverterByIndex(index) {
    if (index >= 0 && index < converters.length) {
        return converters[index];
    }
    return null;
}

function getConverterByNumber(number) {
    for (let i = 0; i < converters.length; i++) {
        if (converters[i].number == number) {
            return converters[i];
        }
    }
    return null;
}

const utils = {
    readJsonFile,
    writeJsonFile,
    removeDir,
    getSubdirs,
    getFilesByExt,
    generateId,
    formatTime,
    findInArray,
    cloneObject,
    getNestedValue,
    deepEqual,
    getTimestamp,
    findAliasByCommand,
    findControllerByNumber,
    findControllerByKey,
    getAllTriggers,
    getAvailableCommands,
    getUsbConverters,
    getEthernetConverters,
    getConverterByIndex,
    getConverterByNumber
};

module.exports = {
    init,
    setFileSystem,
    os_func,
    type_i,
    utils
};