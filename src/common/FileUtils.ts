/**
 * Created by lintao_alex on 2019/3/10.
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto"

export function getErrCallback(dealFuc: (...args: any[]) => void) {
    return function(err: NodeJS.ErrnoException, ...args: any[]) {
        if (err) console.warn(err);
        else dealFuc.apply(null, args);
    }
}

export function walkDir(dirPath: string, dealFuc: (filePath: string) => void) {
    fs.readdir(dirPath, getErrCallback((files) => {
        for (let i = 0, len = files.length; i < len; i++) {
            let child = path.join(dirPath, files[i]);
            fs.stat(child, getErrCallback((stats) => {
                if (stats.isDirectory()) {
                    walkDir(child, dealFuc)
                } else {
                    dealFuc(child);
                }
            }))
        }
    }))
}

export function getMD5(file: string, dealFuc: (md5: string, filePath: string) => void) {
    let hash = crypto.createHash('md5');
    let rs = fs.createReadStream(file);
    rs.on('data', chunk => {
        hash.update(chunk)
    })
    rs.on('end', () => {
        dealFuc(hash.digest('hex'), file);
    })
}

export function copyFileWithDirCreation(src: string, dest: string, flag = 0, callback?: (dest: string, src: string) => void) {
    dest = path.normalize(dest);
    let destPath = dest.split(path.sep);
    let destLen = destPath.length;
    if (destLen > 1) {
        checkDir(destPath, 1)
    } else {
        doCopy();
    }

    function checkDir(destPath: string[], order: number) {
        if (order >= destPath.length){
            doCopy();
        }else{
            let checkPath = destPath.slice(0, order).join(path.sep);
            fs.access(checkPath, fs.constants.F_OK, err => {
                if (err) {
                    fs.mkdir(checkPath, getErrCallback(()=>{
                        checkDir(destPath, order + 1);
                    }))//recursive option doesn't work on Windows
                } else {
                    checkDir(destPath, order + 1);
                }
            })
        }
    }

    function doCopy() {
        fs.copyFile(src, dest, flag, getErrCallback(() => {
            if(callback) callback(dest, src)
        }))
    }
}

