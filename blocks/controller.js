// blocks/controller.js
// Блок класса Controller

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
    console.log('✅ controller.js инициализирован');
}

class Controller {
    constructor(type, number, converter, address) {
        this.converter = converter;
        this.converter_count = converter.count;
        this.address = address;
        this.type = type;
        this.number = number;
        this.version = 'unknown';
        this.active = true;
        this.request = '';
        this.triggers = [];
        this.pattern = {};
        this.data;
        this.bit_for_out = 4;
        this.bit_for_in = 2;
        this.time_open_s = 3;
        this.time_open_m = 5;
        this.connectionType = converter.connectionType || 'ethernet';
        console.log(`🔄 Создан контроллер: тип=${type}, номер=${number}, адрес=${address}, тип соединения=${this.connectionType}`);
    }

    add_trigger(trigger_set) {
        let trigger_id;
        let obj_trg = {};
        if (trigger_set.type in func_api.types) {
            for (let item in func_api.types[trigger_set.type]) {
                obj_trg[item] = func_api.types[trigger_set.type][item];
            }
            for (let j in trigger_set) {
                obj_trg[j] = trigger_set[j];
            }
            obj_trg.temp = false;
            trigger_id = this.triggers.push(obj_trg) - 1;
        }
        this.make_patern();
        return trigger_id;
    }

    make_patern() {
        this.pattern = {};
        for (let i = 0; i < this.triggers.length; i++) {
            const tr = this.triggers[i];
            const byte_num = tr.byte_num;
            
            if (tr.bits !== undefined) {
                // ===== Дискретный триггер (биты) =====
                if (!this.pattern[byte_num]) {
                    this.pattern[byte_num] = { bits: {} };
                }
                if (!this.pattern[byte_num].bits) {
                    this.pattern[byte_num].bits = {};
                }
                if (!this.pattern[byte_num].bits[tr.bits]) {
                    this.pattern[byte_num].bits[tr.bits] = { type: tr.type, sost: {} };
                }
                if (!this.pattern[byte_num].bits[tr.bits].sost[tr.sost]) {
                    this.pattern[byte_num].bits[tr.bits].sost[tr.sost] = [];
                }
                this.pattern[byte_num].bits[tr.bits].sost[tr.sost].push(tr.callback);
                
            } else if (tr.min !== undefined) {
                // ===== Аналоговый триггер (min/max), включая разницу =====
                if (!this.pattern[byte_num]) {
                    this.pattern[byte_num] = { a: [] };
                }
                if (!this.pattern[byte_num].a) {
                    this.pattern[byte_num].a = [];
                }
                this.pattern[byte_num].a.push(tr);
                
            } else if (tr.mask !== undefined && tr.shift !== undefined) {
                // ===== Точный триггер состояния (mask/shift + sost) =====
                if (!this.pattern[byte_num]) {
                    this.pattern[byte_num] = { states: [] };
                }
                if (!this.pattern[byte_num].states) {
                    this.pattern[byte_num].states = [];
                }
                this.pattern[byte_num].states.push(tr);
            }
        }
        
        // Для дискретных триггеров вычисляем for_all
        for (let byte_num in this.pattern) {
            if (this.pattern[byte_num].bits) {
                let for_all = 0;
                for (let bits in this.pattern[byte_num].bits) {
                    for_all |= (+bits);
                }
                this.pattern[byte_num].for_all = for_all;
                if (this.pattern[byte_num].temp === undefined) {
                    this.pattern[byte_num].temp = 0;
                }
            }
        }
    }

    dell_trigger(trigger_id) {
        this.triggers.splice(trigger_id, 1);
        this.make_patern();
    }

    trigger(data) {
        if (!func_api.type_info) {
            console.warn('⚠️ func_api.type_info не инициализирован, инициализируем на лету...');
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
        }

        if (data[1] == 4) {
            this.data = data;

            // ===== 1. Обработка ДИСКРЕТНЫХ, АНАЛОГОВЫХ и ТОЧНЫХ триггеров для каждого байта =====
            for (let byte_num in this.pattern) {
                const rawVal = (+data[byte_num]);

                // ===== 1.1 Дискретные триггеры (bits) =====
                if (this.pattern[byte_num].bits) {
                    let temp_data = rawVal & (+this.pattern[byte_num].for_all);
                    if (temp_data != this.pattern[byte_num].temp) {
                        for (let bits in this.pattern[byte_num].bits) {
                            if ((temp_data & bits) != (this.pattern[byte_num].temp & bits)) {
                                for (let sost in this.pattern[byte_num].bits[bits].sost) {
                                    if ((temp_data & bits) == (+sost)) {
                                        let name = 'unknown';
                                        if (func_api.type_info && func_api.type_info[byte_num]) {
                                            if (typeof func_api.type_info[byte_num] === 'object') {
                                                name = func_api.type_info[byte_num][bits] || func_api.type_info[byte_num][127] || 'unknown';
                                            } else {
                                                name = func_api.type_info[byte_num];
                                            }
                                        }
                                        for (let cb = 0; cb < this.pattern[byte_num].bits[bits].sost[sost].length; cb++) {
                                            this.trigger_info = {
                                                api: 'trigger_info',
                                                controller: this.type + '_' + this.number,
                                                name: name,
                                                sost: parseInt(sost),
                                                data: data.slice()
                                            };
                                            this.pattern[byte_num].bits[bits].sost[sost][cb](this);
                                        }
                                    }
                                }
                            }
                        }
                        this.pattern[byte_num].temp = temp_data;
                    }
                }

                // ===== 1.2 Аналоговые триггеры (min/max), включая разницу =====
                if (this.pattern[byte_num].a) {
                    for (let k = 0; k < this.pattern[byte_num].a.length; k++) {
                        const tr = this.pattern[byte_num].a[k];
                        let val = rawVal;
                        // Если триггер разницы – вычисляем разницу между byte_num и byte_num2
                        if (tr.byte_num2 !== undefined) {
                            val = rawVal - (+data[tr.byte_num2]);
                        }
                        const min = tr.min;
                        const max = tr.max;
                        const dev = tr.dev || 0;
                        if ((val < min - dev) || (val > max + dev)) {
                            if (tr.temp) {
                                tr.temp = false;
                            }
                        }
                        if ((val > min + dev) && (val < max - dev)) {
                            if (!tr.temp) {
                                tr.temp = true;
                                this.trigger_info = {
                                    api: 'trigger_info',
                                    controller: this.type + '_' + this.number,
                                    name: tr.type,
                                    a: tr,
                                    data: data.slice(),
                                    diff: tr.byte_num2 !== undefined ? val : undefined
                                };
                                tr.callback(this);
                            }
                        }
                    }
                }

                // ===== 1.3 Точные триггеры состояния (mask/shift + sost) =====
                if (this.pattern[byte_num].states) {
                    for (let k = 0; k < this.pattern[byte_num].states.length; k++) {
                        const tr = this.pattern[byte_num].states[k];
                        const val = (rawVal & tr.mask) >> tr.shift;
                        if (val === tr.sost) {
                            if (!tr.temp) {
                                tr.temp = true;
                                let name = 'unknown';
                                if (func_api.type_info && func_api.type_info[byte_num]) {
                                    if (typeof func_api.type_info[byte_num] === 'object') {
                                        name = func_api.type_info[byte_num]['va'] || func_api.type_info[byte_num][127] || 'unknown';
                                    } else {
                                        name = func_api.type_info[byte_num];
                                    }
                                }
                                this.trigger_info = {
                                    api: 'trigger_info',
                                    controller: this.type + '_' + this.number,
                                    name: name || tr.type,
                                    sost: tr.sost,
                                    data: data.slice()
                                };
                                tr.callback(this);
                            }
                        } else {
                            tr.temp = false;
                        }
                    }
                }
            }
        }
    }

    open_for_out(thet = this) {
        func_api.output(thet, thet.bit_for_out, thet.time_open_s, thet.time_open_m);
        func_api.output(thet, 3, 0, 125);
    }

    closed_for_out(thet = this) {
        func_api.output(thet, thet.bit_for_out, 0, 1);
        func_api.output(thet, 3, 0, 1);
    }

    open_for_in(thet = this) {
        func_api.output(thet, thet.bit_for_in, thet.time_open_s, thet.time_open_m);
        func_api.output(thet, 3, thet.time_open_s, thet.time_open_m);
    }

    closed_for_in(thet = this) {
        func_api.output(thet, thet.bit_for_in, 0, 1);
        func_api.output(thet, 3, 0, 1);
    }
}

module.exports = {
    init,
    Controller
};