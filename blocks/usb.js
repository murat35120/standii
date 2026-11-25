// blocks/usb.js
// Поддержка USB-RS485 конвертеров Z-397 Guard

const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

let converters, controllers, func_api, ConverterClass;
let fs, path, rootDir;
let usbDevices = {};
const USB_CONFIG_FILE = 'usb_config.json';

function init(conv, ctrl, api, Converter) {
    converters = conv;
    controllers = ctrl;
    func_api = api;
    ConverterClass = Converter;
    console.log('✅ usb.js инициализирован');
}

function setFileSystem(fsModule, pathModule, root) {
    fs = fsModule;
    path = pathModule;
    rootDir = root;
    console.log('✅ usb.js: файловая система установлена');
}

// ============ СКАНИРОВАНИЕ ============
async function scanUsbDevices() {
    const results = [];
    try {
        console.log('\n🔍 ===== СКАНИРОВАНИЕ USB-ПОРТОВ =====');
        const ports = await SerialPort.list();
        
        console.log(`📋 Найдено портов: ${ports.length}`);
        for (const port of ports) {
            console.log(`   📌 ${port.path}: VID=${port.vendorId || 'N/A'}, PID=${port.productId || 'N/A'}`);
        }
        
        for (const port of ports) {
            if (port.path.match(/COM\d+$/i) || port.path.match(/\/dev\/ttyUSB\d+/) || port.path.match(/\/dev\/ttyACM\d+/)) {
                console.log(`\n🔍 Проверяем порт: ${port.path}`);
                const info = await probeDevice(port.path);
                if (info) {
                    console.log(`✅ НАЙДЕН Z-397 Guard на ${port.path}`);
                    console.log(`   S/N: ${info.sn}, Версия: ${info.version}`);
                    results.push({
                        path: port.path,
                        manufacturer: port.manufacturer || 'Z-397 Guard',
                        serialNumber: port.serialNumber || info.sn || '',
                        info: info,
                    });
                } else {
                    console.log(`❌ Не удалось получить информацию от ${port.path}`);
                }
            }
        }
    } catch (err) {
        console.error('❌ Ошибка сканирования USB:', err);
    }
    
    console.log(`\n📊 ИТОГО найдено USB-устройств: ${results.length}`);
    return results;
}

// ============ ПРОВЕРКА УСТРОЙСТВА ============
function probeDevice(comPath) {
    return new Promise((resolve) => {
        let port = null;
        let responseData = '';
        let timeoutId = null;
        let isResolved = false;

        console.log(`\n🔌 ===== ПРОВЕРКА ${comPath} =====`);

        try {
            port = new SerialPort({
                path: comPath,
                baudRate: 230400,
                dataBits: 8,
                parity: 'none',
                stopBits: 1,
                autoOpen: false,
            });

            const parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

            timeoutId = setTimeout(() => {
                if (!isResolved) {
                    isResolved = true;
                    console.log(`⏰ Таймаут ${comPath}`);
                    try { port.close(); } catch(e) {}
                    resolve(null);
                }
            }, 200);

            port.on('open', () => {
                console.log(`✅ Порт ${comPath} открыт на 230400`);
                port.write(Buffer.from([0x49, 0x0D]));
                console.log(`📤 Отправлено: 49 0D`);
            });

            parser.on('data', (line) => {
                responseData += line + '\n';
                console.log(`📥 ${line}`);
                if (responseData.length >= 180) {
                    console.log(`✅ Ответ получен (${responseData.length} байт)`);
                    if (!isResolved) {
                        isResolved = true;
                        clearTimeout(timeoutId);
                        const info = parseInfo(responseData);
                        try { port.close(); } catch(e) {}
                        resolve(info);
                    }
                }
            });

            port.on('close', () => {
                clearTimeout(timeoutId);
                if (!isResolved) {
                    isResolved = true;
                    resolve(responseData.includes('Z397-Guard') ? parseInfo(responseData) : null);
                }
            });

            port.on('error', (err) => {
                console.error(`❌ Ошибка:`, err.message);
                clearTimeout(timeoutId);
                if (!isResolved) {
                    isResolved = true;
                    resolve(null);
                }
            });

            port.open((err) => {
                if (err) {
                    console.error(`❌ Не удалось открыть:`, err.message);
                    clearTimeout(timeoutId);
                    if (!isResolved) {
                        isResolved = true;
                        resolve(null);
                    }
                }
            });
        } catch (err) {
            console.error(`❌ Ошибка:`, err);
            clearTimeout(timeoutId);
            if (!isResolved) {
                isResolved = true;
                resolve(null);
            }
        }
    });
}

// ============ ПАРСИНГ ============
function parseInfo(text) {
    const lines = text.split('\n').map(s => s.trim()).filter(Boolean);
    const info = {};
    for (const line of lines) {
        if (line.includes('Z397-Guard converter')) {
            const match = line.match(/S\/N:(\d+)/);
            if (match) info.sn = match[1];
            info.model = 'Z397-Guard';
        } else if (line.includes('Version')) {
            const match = line.match(/Version\s*([\d.]+)/i);
            info.version = match ? match[1] : line.replace('Version', '').trim();
        } else if (line.includes('IronLogic')) {
            info.manufacturer = 'IronLogic';
        }
    }
    if (!info.sn) info.sn = 'unknown';
    if (!info.version) info.version = 'unknown';
    return info;
}

// ============ ПОДКЛЮЧЕНИЕ ============
function connectUsbDevice(comPath, info) {
    return new Promise((resolve, reject) => {
        console.log(`\n🔌 ===== ПОДКЛЮЧЕНИЕ ${comPath} =====`);

        // 1. ЗАКРЫВАЕМ ПОРТ (если открыт)
        if (usbDevices[comPath] && usbDevices[comPath].port) {
            try {
                usbDevices[comPath].port.close();
                console.log(`🔌 Порт ${comPath} закрыт перед открытием`);
            } catch(e) {
                console.log(`⚠️ Ошибка закрытия порта:`, e.message);
            }
        }

        // 2. ПАУЗА 100мс
        setTimeout(() => {
            const port = new SerialPort({
                path: comPath,
                baudRate: 38400,
                dataBits: 8,
                parity: 'none',
                stopBits: 1,
                autoOpen: false,
            });

            port.open((err) => {
                if (err) {
                    console.error(`❌ Ошибка открытия:`, err);
                    reject(err);
                    return;
                }

                console.log(`✅ Порт ${comPath} открыт на 38400`);

                const msg = {
                    model: info.model || 'Z-397 Guard USB',
                    number: info.sn || 'unknown',
                    version: info.version || 'unknown',
                };
                
                const converter = new ConverterClass(port, msg);
                converter.count = converters.length;
                converter.type = 'usb';
                converter.connected = true;
                converter.usbPath = comPath;

                const index = converters.length;
                converters.push(converter);
                
                usbDevices[comPath] = {
                    port: port,
                    converter: converter,
                    info: info,
                    connected: true,
                    index: index,
                };

                console.log(`✅ Конвертер добавлен в converters[${index}]`);

                port.on('data', function(data) {
                    converter.listener(data);
                });

                port.on('close', function() {
                    converter.connected = false;
                    console.log(`🔌 USB-конвертер отключен: ${comPath}`);
                });

                port.on('error', function(err) {
                    console.error('❌ Ошибка USB-конвертера:', err.message);
                });

                setTimeout(() => {
                    if (func_api && typeof func_api.finding_controllers_start === 'function') {
                        console.log(`🔍 Поиск контроллеров на USB-конвертере ${comPath}`);
                        func_api.finding_controllers_start(converter);
                    }
                }, 700);

                saveUsbConfig();
                resolve({ index, converter });
            });
        }, 100);
    });
}

// ============ СОХРАНЕНИЕ/ЗАГРУЗКА ============
function saveUsbConfig() {
    try {
        const config = {};
        for (const [path, entry] of Object.entries(usbDevices)) {
            if (entry.connected) {
                config[path] = { info: entry.info };
            }
        }
        fs.writeFileSync(path.join(rootDir, USB_CONFIG_FILE), JSON.stringify(config, null, 2));
        console.log('💾 USB-конфигурация сохранена');
    } catch (e) {
        console.error('Ошибка сохранения:', e);
    }
}

function loadUsbConfig() {
    try {
        const filePath = path.join(rootDir, USB_CONFIG_FILE);
        if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
    } catch (e) {}
    return {};
}

async function autoConnectUsb() {
    console.log('🔄 Автоподключение USB...');
    const config = loadUsbConfig();
    for (const [comPath, entry] of Object.entries(config)) {
        console.log(`🔄 Подключение ${comPath}...`);
        try {
            await connectUsbDevice(comPath, entry.info);
            console.log(`✅ Подключен ${comPath}`);
        } catch (err) {
            console.error(`❌ Ошибка ${comPath}:`, err.message);
        }
    }
    console.log('✅ Автоподключение USB завершено');
}

// ============ API ============
const usb_api = {
    usb_scan: async function(req, res, answer) {
        try {
            const devices = await scanUsbDevices();
            answer.api = 'usb_scan';
            answer.devices = devices;
            answer.ok = 1;
            if (typeof res.send === 'function') res.send(JSON.stringify(answer));
            else if (typeof res === 'function') res(answer);
        } catch (e) {
            answer.api = 'usb_scan';
            answer.ok = 0;
            answer.info = e.message;
            if (typeof res.send === 'function') res.send(JSON.stringify(answer));
            else if (typeof res === 'function') res(answer);
        }
    },

    usb_connect: async function(req, res, answer) {
        try {
            const comPath = req.path;
            const info = req.info;
            if (!comPath || !info) {
                answer.api = 'usb_connect';
                answer.ok = 0;
                answer.info = 'Не указан путь или информация';
                if (typeof res.send === 'function') res.send(JSON.stringify(answer));
                else if (typeof res === 'function') res(answer);
                return;
            }
            const result = await connectUsbDevice(comPath, info);
            answer.api = 'usb_connect';
            answer.ok = 1;
            answer.index = result.index;
            if (typeof res.send === 'function') res.send(JSON.stringify(answer));
            else if (typeof res === 'function') res(answer);
        } catch (e) {
            answer.api = 'usb_connect';
            answer.ok = 0;
            answer.info = e.message;
            if (typeof res.send === 'function') res.send(JSON.stringify(answer));
            else if (typeof res === 'function') res(answer);
        }
    },

    usb_disconnect: function(req, res, answer) {
        try {
            const comPath = req.path;
            if (!comPath) {
                answer.api = 'usb_disconnect';
                answer.ok = 0;
                answer.info = 'Не указан путь';
                if (typeof res.send === 'function') res.send(JSON.stringify(answer));
                else if (typeof res === 'function') res(answer);
                return;
            }
            const entry = usbDevices[comPath];
            if (entry) {
                entry.port.close();
                entry.connected = false;
                if (entry.converter) entry.converter.connected = false;
                saveUsbConfig();
            }
            answer.api = 'usb_disconnect';
            answer.ok = 1;
            if (typeof res.send === 'function') res.send(JSON.stringify(answer));
            else if (typeof res === 'function') res(answer);
        } catch (e) {
            answer.api = 'usb_disconnect';
            answer.ok = 0;
            answer.info = e.message;
            if (typeof res.send === 'function') res.send(JSON.stringify(answer));
            else if (typeof res === 'function') res(answer);
        }
    },

    usb_list: function(req, res, answer) {
        try {
            const list = {};
            for (const [path, entry] of Object.entries(usbDevices)) {
                list[path] = {
                    connected: entry.connected,
                    info: entry.info,
                    index: entry.index,
                };
            }
            answer.api = 'usb_list';
            answer.devices = list;
            answer.ok = 1;
            if (typeof res.send === 'function') res.send(JSON.stringify(answer));
            else if (typeof res === 'function') res(answer);
        } catch (e) {
            answer.api = 'usb_list';
            answer.ok = 0;
            answer.info = e.message;
            if (typeof res.send === 'function') res.send(JSON.stringify(answer));
            else if (typeof res === 'function') res(answer);
        }
    }
};

module.exports = {
    init,
    setFileSystem,
    usb_api,
    autoConnectUsb,
    scanUsbDevices,
    connectUsbDevice,
    usbDevices,
};