"use strict";
//加载所需要的模块
var http = require('http');
var url = require('url');
var fs = require('fs');
var path = require('path');
var cp = require('child_process');
var os = require('os');

var CONFIG_OBJ;
var mime = {
    "css": "text/css",
    "gif": "image/gif",
    "html": "text/html",
    "ico": "image/x-icon",
    "jpeg": "image/jpeg",
    "jpg": "image/jpeg",
    "js": "text/javascript",
    "json": "application/json",
    "pdf": "application/pdf",
    "png": "image/png",
    "svg": "image/svg+xml",
    "swf": "application/x-shockwave-flash",
    "tiff": "image/tiff",
    "txt": "text/plain",
    "wav": "audio/x-wav",
    "wma": "audio/x-ms-wma",
    "wmv": "video/x-ms-wmv",
    "xml": "text/xml"
};

function prepareConfig(){
    var cfgFile = path.join(__dirname,'config.json');
    fs.readFile(cfgFile, 'utf8', (err,cfgStr)=>{
        if(!err){
            CONFIG_OBJ = JSON.parse(cfgStr);
        }
        supplyDefaultValue(CONFIG_OBJ, 'root', __dirname);
        supplyDefaultValue(CONFIG_OBJ, 'port', 8080);
        supplyDefaultValue(CONFIG_OBJ, 'browser', 'explorer');
        CONFIG_OBJ.root = path.normalize(CONFIG_OBJ.root);
        CONFIG_OBJ.browser = path.normalize(CONFIG_OBJ.browser);
        main();
    })
}

function supplyDefaultValue(obj, key, defaultValue, ){
    if(!obj[key]){
        obj[key] = defaultValue;
    }
}


function main() {
    var httpServer = http.createServer(processRequest);
    var port = CONFIG_OBJ.port
    httpServer.listen(port, ()=>{
        var host = getIPAdress();
        var url = `http://${host}:${port}`
        console.log('url: ' + url);
        cp.exec(CONFIG_OBJ.browser+' '+url,function(){})
    });
}

function getIPAdress(){
    var interfaces = os.networkInterfaces();
    for(var devName in interfaces){
        var iface = interfaces[devName];
        for(var i=0;i<iface.length;i++){
            var alias = iface[i];
            if(alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal){
                return alias.address;
            }
        }
    }
    return 'localhost'
}

function processRequest (request, response) {
    var requestUrl = request.url;
    var pathName = url.parse(requestUrl).pathname;

    //对路径解码，防止中文乱码
    var pathName = decodeURI(pathName);

    //解决301重定向问题，如果pathname没以/结尾，并且没有扩展名
    if (!pathName.endsWith('/') && path.extname(pathName) === '') {
        pathName += '/';
        var redirect = "http://" + request.headers.host + pathName;
        response.writeHead(301, {
            location: redirect
        });
        //response.end方法用来回应完成后关闭本次对话，也可以写入HTTP回应的具体内容。
        response.end();
        return;
    }

    var filePath = path.join(CONFIG_OBJ.root, pathName);
    console.log(filePath);
    var ext = path.extname(pathName);
    ext = ext ? ext.slice(1) : 'unknown';

    var contentType = mime[ext] || "text/plain";

    fs.stat(filePath, (err, stats) => {
        if (err) {
            response.writeHead(404, { "content-type": "text/html" });
            response.end("<h1>404 Not Found</h1>");
        }else {
            if (stats.isFile()) {//没出错 并且文件存在
                readFile(filePath, contentType);
            }else if (stats.isDirectory()) {//如果路径是目录
                var html = "<head><meta charset = 'utf-8'/></head><body><ul>";
                fs.readdir(filePath, (err, files) => {
                    if (err) {
                        console.log("读取路径失败！");
                    } else {
                        var flag = false;
                        for (var file of files) {
                            //如果在目录下找到index.html，直接读取这个文件
                            if (file === "index.html") {
                                readFile(filePath + (filePath[filePath.length - 1] == '/' ? '' : '/') + 'index.html', "text/html");
                                flag = true;
                                break;
                            }
                            html += `<li><a href='${file}'>${file}</a></li>`;
                        }
                        if (!flag) {
                            html += '</ul></body>';
                            response.writeHead(200, {"content-type": "text/html"});
                            response.end(html);
                        }
                    }
                });
            }
        }

        //读取文件的函数
        function readFile(filePath, contentType){
            response.writeHead(200, { "content-type": contentType });
            //建立流对象，读文件
            var stream = fs.createReadStream(filePath);
            //错误处理
            stream.on('error', function() {
                response.writeHead(500, { "content-type": contentType });
                response.end("<h1>500 Server Error</h1>");
            });
            //读取文件
            stream.pipe(response);
        }
    });
}

prepareConfig();