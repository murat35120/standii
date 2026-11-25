// blocks/server.js
// Блок серверной части - TCP, UDP, HTTP, WS серверы

// Глобальные переменные
let converters, controllers, cards, tests, testLog, isTestRunning, testStartTime, list_cl, num, admins, out_api, func_api, Controller, Converter, executeTestNew;
let http, fs, WebSocket, path, net, dgram;
let rootDir;
let currentSpeed = 38400;

function init(conv, ctrl, card, t, log, running, startTime, list, n, admin, api_out, api_func, ControllerClass, ConverterClass, executeTestNewFunc) {
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
    out_api = api_out;
    func_api = api_func;
    Controller = ControllerClass;
    Converter = ConverterClass;
    executeTestNew = executeTestNewFunc;
    console.log('✅ server.js инициализирован');
}

function setSpeed(speed) {
    if (speed === 115200 || speed === 38400) {
        currentSpeed = speed;
        console.log('⚡ Скорость изменена на:', speed);
        for (let i = 0; i < converters.length; i++) {
            if (converters[i]) {
                if (speed === 38400) {
                    converters[i].pause = 3;
                    converters[i].wait = 25;
                } else {
                    converters[i].pause = 1;
                    converters[i].wait = 12;
                }
            }
        }
    }
}

function getSpeed() {
    return currentSpeed;
}

function start(config) {
    const { port, port_client, port_http, port_ws, port_udp, hosts, broadcast_adr, folder, modules, rootDir: root } = config;
    
    rootDir = root;
    http = modules.http;
    fs = modules.fs;
    WebSocket = modules.WebSocket;
    path = modules.path;
    net = modules.net;
    dgram = modules.dgram;

    // Создаем необходимые папки
    const standsDir = path.join(rootDir, 'stands');
    if (!fs.existsSync(standsDir)) {
        fs.mkdirSync(standsDir, { recursive: true });
        console.log('📁 Создана папка stands');
    }
    const wiringsDir = path.join(rootDir, 'wirings');
    if (!fs.existsSync(wiringsDir)) {
        fs.mkdirSync(wiringsDir, { recursive: true });
        console.log('📁 Создана папка wirings');
    }

    if (out_api && typeof out_api.setFileSystem === 'function') {
        out_api.setFileSystem(fs, path, rootDir);
    }
    if (executeTestNew && typeof executeTestNew.setFileSystem === 'function') {
        executeTestNew.setFileSystem(fs, path, rootDir, out_api);
    }

    // UDP сервер
    const server_udp = dgram.createSocket("udp4");
    server_udp.bind(port_udp, function() {
        server_udp.setBroadcast(true);
        console.log('📡 UDP сервер запущен на порту ' + port_udp);
        broadcastAll();
        setInterval(broadcastAll, 3000);
    });

    function broadcastAll() {
        for (let h of hosts) {
            let broadcast = h.replace(/\d+$/, '255');
            var message = Buffer.from("SEEK Z397IP");
            server_udp.send(message, 0, message.length, port_udp, broadcast, function(err) {
                if (err) console.log('⚠️ UDP ошибка на ' + broadcast + ': ' + err);
            });
        }
    }

    server_udp.on('message', function(message, rinfo) {
        let msg = {};
        msg.from = rinfo.address;
        let str = String(message);
        arr = str.split(' ');
        for (let i in arr) {
            let k = arr[i].split(':');
            if (i == 0) {
                msg.model = k[0].slice(0, -3);
            }
            if (k.length > 1) {
                msg[k[0]] = k[1];
                if (k[0].includes('SW')) {
                    msg.version = k[1];
                }
            } else {
                let ind = k[0].indexOf('SN');
                if (k[0].includes('SN')) {
                    msg.number = k[0].slice(ind + 2);
                }
            }
        }
        if ((msg.L1_Port == port_client) || (msg.L2_Port == port_client)) {
            if ((msg.L1_Conn == '0.0.0.0') && (msg.L2_Conn == '0.0.0.0')) {
                new_client(msg);
            }
        }
    });

    function new_client(msg) {
        let client = new net.Socket();
        let converter;
        client.connect(port_client, msg.from, function() {
            let number = converters.length;
            if (!(client.remoteAddress in converters)) {
                console.log('🔌 CONNECTED: ' + number + '  ' + client.remoteAddress + ':' + client.remotePort);
                let initBuffer = Buffer.from([0xFF, 0xFA, 0x2C, 0x01, 0x00, 0x00, 0x96, 0x00, 0xFF, 0xF0]);
                client.write(initBuffer);
                converters[number] = new Converter(client, msg);
                converter = converters[number];
                converter.count = number;
                converter.type = 'ethernet';
                if (currentSpeed === 38400) {
                    converter.pause = 3;
                    converter.wait = 25;
                } else {
                    converter.pause = 1;
                    converter.wait = 12;
                }
                setTimeout(() => func_api.finding_controllers_start(converters[number]), 700);
            }
        });
        client.on('data', function(data) {
            converter.listener(data);
            converter.last_answer = +(new Date());
        });
        client.on('close', function() {
            converter.connected = false;
            converter.q_fast = [];
            converter.i_fast = -1;
            converter.q_main = [];
            converter.i_main = -1;
            console.log('🔌 Ethernet-конвертер отключен:', converter.count);
        });
        client.on('error', function(err) {
            console.error('❌ Ошибка Ethernet-конвертера:', err.message);
        });
    }

    // TCP сервер
    const server = net.createServer();
    server.listen(port, '0.0.0.0', () => {
        console.log('🔌 TCP Server running on port ' + port);
    });

    server.on('connection', function(sock) {
        let msg = { model: "z-397 web", number: "123", version: "567" };
        let converter;
        let number = converters.length;
        if (!(sock.remoteAddress in converters)) {
            console.log('🔌 CONNECTED: ' + number + '  ' + sock.remoteAddress + ':' + sock.remotePort);
            converters[number] = new Converter(sock, msg);
            converter = converters[number];
            converter.count = number;
            converter.type = 'ethernet';
            if (currentSpeed === 38400) {
                converter.pause = 3;
                converter.wait = 25;
            } else {
                converter.pause = 1;
                converter.wait = 12;
            }
            setTimeout(() => func_api.finding_controllers_start(converters[number]), 700);
        }
        sock.on('data', function(data) {
            converter.listener(data);
            converter.last_answer = +(new Date());
        });
        sock.on('error', function(err) {
            console.error('❌ Ошибка TCP-соединения:', err.message);
        });
        sock.on('close', function(data) {
            converter.connected = false;
            converter.q_fast = [];
            converter.i_fast = -1;
            converter.q_main = [];
            converter.i_main = -1;
            console.log('🔌 TCP-конвертер отключен:', converter.count);
        });
    });

    // HTTP сервер
    const server_http = http.createServer((req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }

        let first_url = req.url;
        
        if (req.method === 'GET' && (first_url.startsWith('/stands/') || first_url.startsWith('/wirings/'))) {
            let filePath = path.join(rootDir, first_url);
            if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
                const ext = path.extname(filePath);
                const mimeTypes = {
                    '.json': 'application/json',
                    '.png': 'image/png',
                    '.jpg': 'image/jpeg',
                    '.jpeg': 'image/jpeg',
                    '.gif': 'image/gif',
                    '.pdf': 'application/pdf',
                    '.svg': 'image/svg+xml',
                    '.webp': 'image/webp',
                    '.bmp': 'image/bmp'
                };
                res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
                res.end(fs.readFileSync(filePath));
                return;
            }
        }
        
        if (req.method === 'GET') {
            send_file(res, first_url, folder);
            return;
        }
        
        if (req.method === 'POST') {
            send_post(req, res);
            return;
        }

        res.writeHead(404);
        res.end('Not Found');
    });

    function send_file(res, first_url, folder) {
        let new_url;
        try {
            new_url = decodeURIComponent(first_url);
        } catch (e) {
            res.statusCode = 400;
            res.end("Bad request");
            return;
        }
        if (~new_url.indexOf('\0')) {
            res.statusCode = 400;
            res.end("Really Bad request");
            return;
        }
        
        if (new_url === '/' || new_url === '') {
            new_url = '/index.html';
        }
        
        let mimeType = path.extname(new_url);
        let all_url;
        
        if (new_url.startsWith('/' + folder) || new_url.startsWith(folder)) {
            all_url = path.join(rootDir, new_url);
        } else {
            const cleanUrl = new_url.startsWith('/') ? new_url.substring(1) : new_url;
            all_url = path.join(rootDir, folder, cleanUrl);
        }
        
        if (!mimeType) {
            mimeType = '.html';
            all_url = path.join(all_url, 'index.html');
        }
        
        all_url = path.normalize(all_url);
        
        if (!fs.existsSync(all_url)) {
            console.log('⚠️ Файл не найден:', all_url);
            res.writeHead(404);
            res.end('File not found');
            return;
        }
        
        const mimeTypes = {
            '.html': 'text/html',
            '.css': 'text/css',
            '.js': 'application/javascript',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.ico': 'image/x-icon',
            '.txt': 'text/plain',
            '.pdf': 'application/pdf'
        };
        
        const contentType = mimeTypes[mimeType] || 'application/octet-stream';
        
        try {
            const content = fs.readFileSync(all_url);
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        } catch (err) {
            console.error('❌ Ошибка чтения файла:', err);
            res.writeHead(500);
            res.end('Internal Server Error');
        }
    }

    function send_post(req, res) {
        let body = [];
        req.on('error', function(err) {
            console.error('❌ POST ошибка:', err);
            res.writeHead(500);
            res.end('Internal Server Error');
        }).on('data', function(chunk) {
            body.push(chunk);
        }).on('end', function() {
            try {
                body = Buffer.concat(body).toString();
                let data = JSON.parse(body);
                
                if (!data.command) {
                    res.writeHead(400);
                    res.end(JSON.stringify({ error: 'No command specified' }));
                    return;
                }
                
                if (data.command in out_api) {
                    const answer = {};
                    out_api[data.command](data, res, answer);
                } else {
                    res.writeHead(404);
                    res.end(JSON.stringify({ error: 'Command not found: ' + data.command }));
                }
            } catch (e) {
                console.error('❌ POST обработка ошибка:', e);
                res.writeHead(400);
                res.end(JSON.stringify({ error: 'Invalid JSON: ' + e.message }));
            }
        });
    }

    server_http.listen(port_http, '0.0.0.0', () => {
        console.log('🌐 HTTP Server running on port ' + port_http);
    });

    // WS сервер
    const wsServer = new WebSocket.Server({ port: port_ws });
    wsServer.on('connection', onConnect);

    function onConnect(wsClient) {
        let api_key = '1356_api';
        let id = num++;
        list_cl[id] = wsClient;

        function fnk(thet) {
            let answer = {};
            answer.api = 'trigger_info';
            answer.trigger_info = thet.trigger_info;
            wsClient.send(JSON.stringify(answer));
        };
        list_cl[id].callback = fnk;
        console.log('👤 Новый пользователь ' + id);

        list_cl[id].on('close', function() {
            console.log('👤 Пользователь отключился ' + id);
            delete list_cl[id];
            admins.delete(id);
        });

        list_cl[id].on('message', function(message) {
            let answer = {};
            try {
                let jsonObj = JSON.parse(message);
                answer.check_admin = 0;
                
                if ('api_key' in jsonObj) {
                    if (jsonObj.api_key == api_key) {
                        answer.check_admin = 1;
                        let methodName = jsonObj.api || jsonObj.command;
                        
                        if (methodName && methodName in out_api) {
                            out_api[methodName](jsonObj, list_cl[id], answer);
                        } else {
                            answer.info = 'wrong api: ' + methodName;
                            list_cl[id].send(JSON.stringify(answer));
                        }
                    } else {
                        answer.info = 'wrong api_key';
                        list_cl[id].send(JSON.stringify(answer));
                    }
                } else {
                    answer.info = 'wrong message - no api_key';
                    list_cl[id].send(JSON.stringify(answer));
                }
            } catch (error) {
                console.log('❌ Ошибка обработки сообщения:', error);
                answer.info = 'error: ' + error.message;
                list_cl[id].send(JSON.stringify(answer));
            }
        });
    }

    // Создание главной страницы
    function createMainPage() {
        const siteDir = path.join(rootDir, folder);
        if (!fs.existsSync(siteDir)) {
            fs.mkdirSync(siteDir, { recursive: true });
        }
        
        const indexFile = path.join(siteDir, 'index.html');
        let pages = [];
        
        try {
            const items = fs.readdirSync(siteDir, { withFileTypes: true });
            for (const item of items) {
                if (item.isFile() && item.name.endsWith('.html') && item.name !== 'index.html') {
                    const filePath = path.join(siteDir, item.name);
                    let title = item.name.replace('.html', '');
                    try {
                        const content = fs.readFileSync(filePath, 'utf8');
                        const titleMatch = content.match(/<title>([^<]*)<\/title>/i);
                        if (titleMatch && titleMatch[1]) {
                            title = titleMatch[1];
                        }
                    } catch (e) {}
                    pages.push({
                        file: item.name,
                        title: title,
                        link: '/' + item.name
                    });
                }
            }
        } catch (e) {
            console.error('❌ Ошибка сканирования site:', e);
        }
        
        let html = `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>СКУД Тестирование - Главная</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #333; border-bottom: 2px solid #4CAF50; padding-bottom: 10px; }
        .pages { list-style: none; padding: 0; }
        .pages li { margin: 10px 0; }
        .pages a { display: block; padding: 15px 20px; background: #f8f9fa; border-radius: 5px; text-decoration: none; color: #333; border-left: 4px solid #4CAF50; transition: all 0.3s; }
        .pages a:hover { background: #e9ecef; transform: translateX(5px); }
        .pages .desc { font-size: 14px; color: #666; margin-top: 5px; }
        .footer { margin-top: 30px; color: #999; font-size: 14px; text-align: center; }
        .version { color: #4CAF50; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <h1>СКУД Тестирование</h1>
        <p>Управление и тестирование контроллеров Z-5R Net с прошивкой Modbus</p>
        <h2>Страницы</h2>
        <ul class="pages">`;
        
        for (const page of pages) {
            html += `
            <li>
                <a href="${page.link}" target="_blank">
                    <strong>${page.title}</strong>
                    <div class="desc">${page.file}</div>
                </a>
            </li>`;
        }
        
        if (pages.length === 0) {
            html += `
            <li style="color: #999; padding: 20px; text-align: center;">
                Нет доступных страниц. Создайте HTML файлы в папке site/
            </li>`;
        }
        
        html += `
        </ul>
        <div class="footer">
            <span class="version">Версия 3.0.3</span> | Сервер работает на порту ${port_http}
        </div>
    </body>
</html>`;
        
        try {
            fs.writeFileSync(indexFile, html, 'utf8');
            console.log('📄 Главная страница создана:', indexFile);
        } catch (e) {
            console.error('❌ Ошибка создания главной страницы:', e);
        }
    }

    setTimeout(createMainPage, 1000);
}

module.exports = {
    init,
    start,
    setSpeed,
    getSpeed
};