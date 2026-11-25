// index.js
const http = require('http');
const fs = require('fs');
const WebSocket = require('ws');
const path = require('path');
const os = require('os');
const net = require('net');
const dgram = require('dgram');
const { exec } = require("child_process");
const Zip = require("adm-zip");

// Глобальные переменные
let converters = [];
let controllers = {};
let cards = {};
let t_start;
let tests = new Map();
let testLog = [];
let isTestRunning = false;
let testStartTime = 0;
let list_cl = {};
let num = 0;
let admins = new Map();

// Конфигурация
const port = 25000;
const port_client = 1000;
const port_http = 8080;
const port_ws = 9090;
const port_udp = 9000;
const broadcast_adr = "255.255.255.255";
const ip_adresses = os.networkInterfaces();
let folder = "site";

// Загрузка блоков
const blocksPath = path.join(__dirname, 'blocks');
if (!fs.existsSync(blocksPath)) {
    fs.mkdirSync(blocksPath);
}

const blockFiles = [
    'utils.js',
    'converter.js',
    'controller.js',
    'api.js',
    'test.js',
    'server.js',
    'debug.js',
    'usb.js'  // Добавлен новый блок
];

let allBlocksLoaded = true;
const loadedBlocks = {};

for (const file of blockFiles) {
    const filePath = path.join(blocksPath, file);
    if (fs.existsSync(filePath)) {
        try {
            loadedBlocks[file.replace('.js', '')] = require(filePath);
            console.log(`✅ Блок ${file} загружен`);
        } catch (e) {
            console.log(`❌ Ошибка загрузки блока ${file}: ${e.message}`);
            allBlocksLoaded = false;
        }
    } else {
        console.log(`⚠️ Блок ${file} не найден`);
        if (file !== 'debug.js' && file !== 'usb.js') {
            allBlocksLoaded = false;
        }
    }
}

if (!allBlocksLoaded) {
    console.log('❌ Не все блоки загружены. Приложение остановлено.');
    process.exit(1);
}

console.log('📦 Версия 3.0.3 (с поддержкой USB-конвертеров)');

if (fs.existsSync("resources.zip")) {
    const zip = new Zip("resources.zip");
    zip.extractAllTo(__dirname, false);
}

// Найти все IP адреса
let hosts = [];
for (const i in ip_adresses) {
    for (const k in ip_adresses[i]) {
        if (ip_adresses[i][k].family == 'IPv4' && ip_adresses[i][k].address != "127.0.0.1") {
            hosts.push(ip_adresses[i][k].address);
        }
    }
}

console.log("🌐 HTTP Server доступен по адресам:");
for (let h of hosts) {
    console.log("  http://" + h + ':' + port_http);
    console.log("  WS Server: ws://" + h + ':' + port_ws);
}

// Получение ссылок на объекты из блоков
const Converter = loadedBlocks.converter.Converter;
const Controller = loadedBlocks.controller.Controller;
const out_api = loadedBlocks.api.out_api;
const func_api = loadedBlocks.api.func_api;
const executeTest = loadedBlocks.test.executeTest;
const executeTestNew = loadedBlocks.test.executeTestNew;
const setFileSystemApi = loadedBlocks.api.setFileSystem;
const setFileSystemTest = loadedBlocks.test.setFileSystem;

// ============ ИНИЦИАЛИЗАЦИЯ ВСЕХ БЛОКОВ ============

// 1. utils.js
if (loadedBlocks.utils && typeof loadedBlocks.utils.init === 'function') {
    loadedBlocks.utils.init(converters, controllers, cards, tests, testLog, isTestRunning, testStartTime, list_cl, num, admins, func_api);
    console.log('✅ utils.js инициализирован');
}

// 2. converter.js
if (loadedBlocks.converter && typeof loadedBlocks.converter.init === 'function') {
    loadedBlocks.converter.init(converters, controllers, cards, tests, testLog, isTestRunning, testStartTime, list_cl, num, admins, func_api);
    console.log('✅ converter.js инициализирован');
}

// 3. controller.js
if (loadedBlocks.controller && typeof loadedBlocks.controller.init === 'function') {
    loadedBlocks.controller.init(converters, controllers, cards, tests, testLog, isTestRunning, testStartTime, list_cl, num, admins, func_api);
    console.log('✅ controller.js инициализирован');
}

// 4. api.js
if (loadedBlocks.api && typeof loadedBlocks.api.init === 'function') {
    loadedBlocks.api.init(converters, controllers, cards, tests, testLog, isTestRunning, testStartTime, list_cl, num, admins, Controller, executeTest, executeTestNew);
    console.log('✅ api.js инициализирован');
}

// 5. test.js
if (loadedBlocks.test && typeof loadedBlocks.test.init === 'function') {
    loadedBlocks.test.init(converters, controllers, cards, tests, testLog, isTestRunning, testStartTime, list_cl, num, admins, func_api);
    console.log('✅ test.js инициализирован');
}

// 6. server.js
if (loadedBlocks.server && typeof loadedBlocks.server.init === 'function') {
    loadedBlocks.server.init(converters, controllers, cards, tests, testLog, isTestRunning, testStartTime, list_cl, num, admins, out_api, func_api, Controller, Converter, executeTestNew);
    console.log('✅ server.js инициализирован');
}

// ============ ИНИЦИАЛИЗАЦИЯ debug.js ============
if (loadedBlocks.debug) {
    if (typeof loadedBlocks.debug.init === 'function') {
        loadedBlocks.debug.init(converters, controllers, cards, tests, testLog, isTestRunning, testStartTime, list_cl, num, admins, func_api);
        console.log('✅ debug.js инициализирован');
    }
    
    if (loadedBlocks.debug.debug_api) {
        let debugMethodsAdded = 0;
        for (const key in loadedBlocks.debug.debug_api) {
            if (loadedBlocks.debug.debug_api.hasOwnProperty(key)) {
                out_api[key] = loadedBlocks.debug.debug_api[key];
                debugMethodsAdded++;
                console.log(`   ✅ debug_api.${key} добавлен в out_api`);
            }
        }
        console.log(`✅ debug_api полностью добавлен в out_api (${debugMethodsAdded} методов)`);
    }
} else {
    console.log('⚠️ debug.js не загружен');
}

// ============ ИНИЦИАЛИЗАЦИЯ usb.js ============
if (loadedBlocks.usb) {
    if (typeof loadedBlocks.usb.init === 'function') {
        loadedBlocks.usb.init(converters, controllers, func_api, Converter);
        console.log('✅ usb.js инициализирован');
    }
    if (typeof loadedBlocks.usb.setFileSystem === 'function') {
        loadedBlocks.usb.setFileSystem(fs, path, __dirname);
        console.log('✅ usb.js: файловая система установлена');
    }
    
    // Добавляем usb_api в out_api
    if (loadedBlocks.usb.usb_api) {
        let usbMethodsAdded = 0;
        for (const key in loadedBlocks.usb.usb_api) {
            if (loadedBlocks.usb.usb_api.hasOwnProperty(key)) {
                out_api[key] = loadedBlocks.usb.usb_api[key];
                usbMethodsAdded++;
                console.log(`   ✅ usb_api.${key} добавлен в out_api`);
            }
        }
        console.log(`✅ usb_api полностью добавлен в out_api (${usbMethodsAdded} методов)`);
    }
} else {
    console.log('⚠️ usb.js не загружен (USB-функционал недоступен)');
}

// ===== ИНИЦИАЛИЗАЦИЯ type_info ДЛЯ РАБОТЫ ТРИГГЕРОВ =====
console.log('=== Инициализация type_info ===');
if (loadedBlocks.utils && typeof loadedBlocks.utils.type_i === 'function') {
    loadedBlocks.utils.type_i();
    console.log('✅ type_i инициализирован через utils.type_i()');
} else {
    console.log('⚠️ type_i не найден в utils.js, инициализируем вручную...');
    func_api.type_info = {};
    for (let key in func_api.types) {
        const t = func_api.types[key];
        if (!func_api.type_info[t.byte_num]) {
            func_api.type_info[t.byte_num] = {};
        }
        if (t.min !== undefined) {
            func_api.type_info[t.byte_num]['va'] = key;
        } else if (t.bits !== undefined) {
            if (t.bits === 127) {
                func_api.type_info[t.byte_num][127] = key;
            } else {
                func_api.type_info[t.byte_num][t.bits] = key;
            }
        }
    }
    console.log('✅ type_info инициализирован вручную');
}
console.log('📋 type_info:', Object.keys(func_api.type_info));
console.log('=== Инициализация завершена ===');

// Передаем fs, path и rootDir в api.js и test.js
if (setFileSystemApi) {
    setFileSystemApi(fs, path, __dirname);
}
if (setFileSystemTest) {
    setFileSystemTest(fs, path, __dirname, out_api);
}

// ДОБАВЛЯЕМ НОВЫЙ МЕТОД В out_api ДЛЯ УПРАВЛЕНИЯ СКОРОСТЬЮ
out_api.set_speed = function(req, res, answer) {
    try {
        const speed = req.speed;
        if (speed !== 38400 && speed !== 115200) {
            answer.ok = 0;
            answer.info = 'Неверная скорость. Допустимые: 38400, 115200';
            if (typeof res.send === 'function') res.send(JSON.stringify(answer));
            else if (typeof res === 'function') res(answer);
            return;
        }
        const serverModule = loadedBlocks.server;
        if (serverModule && typeof serverModule.setSpeed === 'function') {
            serverModule.setSpeed(speed);
            answer.ok = 1;
            answer.info = 'Скорость изменена на ' + speed;
            if (typeof res.send === 'function') res.send(JSON.stringify(answer));
            else if (typeof res === 'function') res(answer);
        } else {
            answer.ok = 0;
            answer.info = 'Функция setSpeed не найдена';
            if (typeof res.send === 'function') res.send(JSON.stringify(answer));
            else if (typeof res === 'function') res(answer);
        }
    } catch (e) {
        answer.ok = 0;
        answer.info = 'Ошибка изменения скорости: ' + e.message;
        if (typeof res.send === 'function') res.send(JSON.stringify(answer));
        else if (typeof res === 'function') res(answer);
    }
};

out_api.test_stop = function(req, res, answer) {
    try {
        if (!isTestRunning) {
            answer.ok = 0;
            answer.info = 'Нет выполняемого теста';
            if (typeof res.send === 'function') res.send(JSON.stringify(answer));
            else if (typeof res === 'function') res(answer);
            return;
        }
        isTestRunning = false;
        answer.ok = 1;
        answer.info = 'Тест остановлен';
        if (typeof res.send === 'function') res.send(JSON.stringify(answer));
        else if (typeof res === 'function') res(answer);
    } catch (e) {
        answer.ok = 0;
        answer.info = 'Ошибка остановки: ' + e.message;
        if (typeof res.send === 'function') res.send(JSON.stringify(answer));
        else if (typeof res === 'function') res(answer);
    }
};

out_api.get_speed = function(req, res, answer) {
    try {
        const serverModule = loadedBlocks.server;
        if (serverModule && typeof serverModule.getSpeed === 'function') {
            const speed = serverModule.getSpeed();
            answer.ok = 1;
            answer.speed = speed;
            if (typeof res.send === 'function') res.send(JSON.stringify(answer));
            else if (typeof res === 'function') res(answer);
        } else {
            answer.ok = 0;
            answer.info = 'Функция getSpeed не найдена';
            if (typeof res.send === 'function') res.send(JSON.stringify(answer));
            else if (typeof res === 'function') res(answer);
        }
    } catch (e) {
        answer.ok = 0;
        answer.info = 'Ошибка получения скорости: ' + e.message;
        if (typeof res.send === 'function') res.send(JSON.stringify(answer));
        else if (typeof res === 'function') res(answer);
    }
};

// Запуск сервера
loadedBlocks.server.start({
    port,
    port_client,
    port_http,
    port_ws,
    port_udp,
    hosts,
    broadcast_adr,
    folder,
    rootDir: __dirname,
    modules: {
        http: http,
        fs: fs,
        WebSocket: WebSocket,
        path: path,
        net: net,
        dgram: dgram
    }
});

// ============ АВТОПОДКЛЮЧЕНИЕ USB-КОНВЕРТЕРОВ ============
// Запускаем после старта сервера
setTimeout(() => {
    console.log('🔄 Запуск автоподключения USB-конвертеров...');
    if (loadedBlocks.usb && typeof loadedBlocks.usb.autoConnectUsb === 'function') {
        loadedBlocks.usb.autoConnectUsb()
            .then(() => {
                console.log('✅ Автоподключение USB завершено');
            })
            .catch(err => {
                console.error('❌ Ошибка автоподключения USB:', err);
            });
    } else {
        console.log('⚠️ usb.js не загружен, автоподключение пропущено');
    }
}, 3000);

console.log('🚀 Сервер запущен и готов к работе');