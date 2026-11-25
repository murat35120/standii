// blocks/converter.js
// Блок класса Converter
// Поддерживает как Ethernet, так и USB-конвертеры

// Глобальные переменные (передаются из index.js)
let converters, controllers, cards, tests, testLog, isTestRunning, testStartTime, list_cl, num, admins, func_api;

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
    console.log('✅ converter.js инициализирован');
}

class Converter {
    constructor(socket, msg) {
        this.socket = socket;
        this.q_fast = [];
        this.i_fast = -1;
        this.q_main = [];
        this.i_main = -1;
        this.survey = '';
        this.finding = '';
        this.scan_count = 1;
        this.scan_controllers = 10;
        this.scan_current = 0;
        this.pause = 3;
        this.wait = 25;
        this.timer = null;
        this.count = 0;
        this.number = msg.number || 'unknown';
        this.version = msg.version || 'unknown';
        this.model = msg.model || 'Z-397';
        this.type = "fast";
        this.current = null;
        this.addresses = {};
        this.connected = true;
        this.test = +new Date();
        this.pk = 0;
        this.answer_length = [0, 13, 0, 0, 17, 0, 8];
        this.count_out = 0;
        this.count_in = 0;
        this.last_answer = +(new Date());
        this.usbPath = null; // Для USB-конвертеров
        this.connectionType = socket.remoteAddress ? 'ethernet' : 'usb';
        
        console.log(`🔄 Создан конвертер #${this.count}, тип: ${this.connectionType}, модель: ${this.model}`);
    }

    add(q_type, data, receiver = func_api.survey_receiver, callback = '', maxRetry = 0) {
        let obj = { data: data, receiver: receiver, callback: callback, retry: 0, maxRetry: maxRetry };
        let start = 0;
        if (this.i_fast == -1 && this.i_main == -1) {
            start = 1;
        }
        this[q_type].push(obj);
        if (start) {
            this.next();
        }
    }

    next() {
        if (this.i_fast < this.q_fast.length - 1) {
            step("fast", this);
        } else {
            this.i_fast = -1;
            this.q_fast = [];
            if (this.i_main < this.q_main.length - 1) {
                step("main", this);
            } else {
                this.i_main = -1;
                this.q_main = [];
                if (this.connected) {
                    func_api.survey_make(this);
                }
            }
        }

        function step(type, thet) {
            let i = "i_" + type;
            let q = "q_" + type;
            thet[i]++;
            thet.type = type;
            thet.current = thet[q][thet[i]];
            if (thet.current) {
                try {
                    thet.socket.write(thet.current.data);
                    thet.timer = setTimeout(() => {
                        clearTimeout(thet.timer);
                        if (thet.current.retry < thet.current.maxRetry) {
                            thet.current.retry++;
                            console.log(`🔄 Повтор команды для конвертера #${thet.count}, попытка ${thet.current.retry}`);
                            try {
                                thet.socket.write(thet.current.data);
                                thet.timer = setTimeout(() => {
                                    clearTimeout(thet.timer);
                                    thet.current.receiver(thet, thet.current.data, false);
                                    thet.next();
                                }, thet.wait);
                            } catch (err) {
                                console.error(`❌ Ошибка записи при повторе:`, err);
                                thet.current.receiver(thet, thet.current.data, false);
                                thet.next();
                            }
                        } else {
                            thet.current.receiver(thet, thet.current.data, false);
                            thet.next();
                        }
                    }, thet.wait);
                } catch (err) {
                    console.error(`❌ Ошибка записи в конвертер #${thet.count}:`, err);
                    clearTimeout(thet.timer);
                    thet.current.receiver(thet, thet.current.data, false);
                    thet.next();
                }
            }
        }
    }

    listener(data) {
        try {
            let msg = data.subarray(0, data.length - 2);
            let dd = func_api.getCRC(msg);
            if (data.length >= this.answer_length[data[1]]) {
                let check = 1;
                for (let j = 0; j < 1; j++) {
                    if (this.current && +this.current.data[j] != +data[j]) {
                        check = 0;
                        break;
                    }
                }
                if (check) {
                    clearTimeout(this.timer);
                    this.current.receiver(this, data, true);
                    setTimeout(() => this.next(), this.pause);
                }
            }
        } catch (err) {
            console.error(`❌ Ошибка в listener конвертера #${this.count}:`, err);
            // Пытаемся восстановиться
            try {
                if (this.timer) {
                    clearTimeout(this.timer);
                }
                this.next();
            } catch (e) {
                console.error('❌ Критическая ошибка восстановления:', e);
            }
        }
    }

    // Метод для проверки активности конвертера
    isAlive() {
        return this.connected && (this.last_answer + 30000 > Date.now());
    }

    // Метод для переподключения USB-конвертера
    reconnect() {
        if (this.connectionType === 'usb' && this.usbPath) {
            console.log(`🔄 Запрос переподключения USB-конвертера #${this.count} на ${this.usbPath}`);
            // Импортируем функцию переподключения из usb.js
            try {
                const usbModule = require('./usb.js');
                if (usbModule && typeof usbModule.connectUsbDevice === 'function') {
                    // Находим информацию о устройстве
                    const usbDevices = usbModule.usbDevices || {};
                    const entry = usbDevices[this.usbPath];
                    if (entry && entry.info) {
                        usbModule.connectUsbDevice(this.usbPath, entry.info)
                            .then(() => console.log(`✅ USB-конвертер #${this.count} переподключен`))
                            .catch(err => console.error(`❌ Ошибка переподключения USB:`, err));
                    }
                }
            } catch (err) {
                console.error('❌ Ошибка при переподключении USB:', err);
            }
        }
    }
}

module.exports = {
    init,
    Converter
};