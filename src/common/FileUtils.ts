/**
 * Created by lintao_alex on 2019/3/10.
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto"
import {log} from "util";

export function getErrCallback(dealFuc: (...args: any[]) => void) {
    return function(err: NodeJS.ErrnoException, ...args: any[]) {
        if (err) throw err;
        else dealFuc.apply(null, args);
    }
}

export function walkDir(dirPath: string, dealFuc: (fullPath: string) => void, callObj?: any) {
    fs.readdir(dirPath, getErrCallback((files: string[]) => {
        for (let i = 0, len = files.length; i < len; i++) {
            let child = path.join(dirPath, files[i]);
            fs.stat(child, getErrCallback((stats: fs.Stats) => {
                if (stats.isDirectory()) {
                    walkDir(child, dealFuc, callObj)
                } else {
                    dealFuc.call(callObj, child);
                }
            }))
        }
    }))
}

export function getMD5(file: string, dealFuc: (md5: string, filePath: string) => void, callObj?: any) {
    let hash = crypto.createHash('md5');
    let rs = fs.createReadStream(file);
    rs.on('data', chunk => {
        hash.update(chunk)
    })
    rs.on('error', err => {
        log(err)
    })
    rs.on('end', () => {
        dealFuc.call(callObj, hash.digest('hex'), file);
    })
}

let waitingDirMakeCallMap = new Map<string, any[]>();//deal make the same dir at the same time
export function copyFileWithDirCreation(src: string, dest: string, flag = 0, callback?: (dest: string, src: string) => void, callObj?: any) {
    dest = path.normalize(dest);
    let destPath = dest.split(path.sep);
    let destLen = destPath.length;
    if (destLen > 1) {
        checkDir(destPath, 1)
    } else {
        doCopy();
    }

    function checkDir(destPath: string[], order: number) {
        if (order >= destPath.length) {
            doCopy();
        } else {
            let checkPath = destPath.slice(0, order).join(path.sep);
            fs.access(checkPath, fs.constants.F_OK, err => {
                if (err) {
                    let args = [checkDir, destPath, order + 1];//attention!!! every checkDir function is different in action scope
                    let argsList = waitingDirMakeCallMap.get(checkPath);
                    if (argsList) {
                        argsList.push(args);
                    } else {
                        argsList = [args];
                        waitingDirMakeCallMap.set(checkPath, argsList);
                        fs.mkdir(checkPath, getErrCallback(() => {
                            let argsList2 = waitingDirMakeCallMap.get(checkPath);
                            waitingDirMakeCallMap.delete(checkPath);
                            if (argsList2) {
                                for (let i = argsList2.length - 1; i >= 0; i--) {
                                    let args = argsList2[i];
                                    let orgCheckFuc = args[0];
                                    orgCheckFuc(args[1], args[2]);
                                }

                            }
                        }))//recursive option doesn't work on Windows
                    }
                } else {
                    checkDir(destPath, order + 1);
                }
            })
        }
    }

    function doCopy() {
        fs.copyFile(src, dest, flag, getErrCallback(() => {
            if (callback) callback.call(callObj, dest, src)
        }))
    }
}

export function cutRelativePath(fullPath: string, root: string) {
    let out = fullPath.slice(root.length);
    let headIdx = 0;
    while (out.charAt(headIdx) == path.sep) ++headIdx;
    return out.slice(headIdx);
}

