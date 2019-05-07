/**
 * Created by lintao_alex on 2019/5/6
 */
import * as fs from "fs";
import {copyFileWithDirCreation, getErrCallback, getMD5, paving, walkDir} from "../common/FileUtils";
import * as path from "path";
import {walkObj} from "../common/utils";
import {log} from "util";
import {checkMinJs, replaceMinJs} from "../tools/scriptReleaser";

let VERSION_MARK = '?v=';
let HTTP_MARK = '://';
let FileCfg: IFileCfg;
let VersionMap: any;

function main() {
    fs.readFile(process.argv[2], { encoding: 'utf8' }, getErrCallback((content: string) => {
        FileCfg = JSON.parse(content);
        // walkObj(FileCfg, (value, key, obj)=>{
        //     obj[key] = path.normalize(value);
        // })
        checkCfg(FileCfg, () => {
            fs.readFile(FileCfg.versionFullPath, { encoding: 'utf8' }, (err, content) => {
                if (err || !content) {
                    VersionMap = {}
                } else {
                    VersionMap = JSON.parse(content);
                }

                //deal script
                let enterFull = path.join(FileCfg.srcRoot, FileCfg.enterFile);
                fs.readFile(enterFull, { encoding: 'utf8' }, getErrCallback((content) => {
                    let enterObj = JSON.parse(content);
                    let pmsList: Promise<any>[] = []
                    walkObj(enterObj, (orgPath, key, obj) => {
                        pmsList.push(checkProperty(orgPath, key, obj))
                    });
                    Promise.all(pmsList).then(() => {
                        writeConfigJsonFile(FileCfg.enterFile, enterObj, (md5) => {
                            fs.writeFile(FileCfg.versionFullPath, JSON.stringify(VersionMap), { encoding: 'utf8' }, getErrCallback(() => {
                                log('[version] new version recorded')
                            }))
                        });
                    })
                }))

                //deal resource
                for (let resource of FileCfg.resourceRootList) {
                    dealResourceRoot(resource);
                }
                for (let singleFile of FileCfg.singleFileList) {
                    dealFile(singleFile);
                }
            })
        })
    }))
}

function dealResourceRoot(relativeDir: string) {
    let fullDir = path.join(FileCfg.srcRoot, relativeDir);
    walkDir(fullDir, fullPath => {
        if (path.basename(fullPath) != 'resource.json') {
            let relativePath = path.relative(FileCfg.srcRoot, fullPath);
            dealFile(relativePath)
        }
    })
}

function checkCfg(fileCfg: IFileCfg, callback: () => void) {
    let cnt = 3;
    let resultFuc = getErrCallback(checkFinish);
    fs.access(fileCfg.srcRoot, fs.constants.F_OK, resultFuc);
    fs.access(fileCfg.destRoot, fs.constants.F_OK, resultFuc);
    fs.access(path.dirname(fileCfg.versionFullPath), fs.constants.F_OK, resultFuc);

    function checkFinish() {
        if (--cnt == 0) {
            callback();
        }
    }
}

function checkProperty(orgFilePath: string, key: string, orgObj: any) {
    return new Promise((resolve, reject) => {
        if (orgFilePath.indexOf(HTTP_MARK) >= 0) {
            resolve()
        } else {
            let relativePath = normalPath(removeVersionMark(orgFilePath));
            orgObj[key] = relativePath;
            if (FileCfg.noCheckList.indexOf(relativePath) >= 0) {
                dealFileWithVersion(relativePath, key, orgObj, resolve, reject);
            } else {
                let fullPath = path.join(FileCfg.srcRoot, relativePath);
                let extName = path.extname(relativePath)
                if (extName == '.json') {
                    fs.readFile(fullPath, { encoding: 'utf8' }, getErrCallback((content: string) => {
                        let pmsList: Promise<any>[] = [];
                        let childObj = JSON.parse(content);
                        walkObj(childObj, (orgPath, key, obj) => {
                            pmsList.push(checkProperty(orgPath, key, obj))
                        })
                        Promise.all(pmsList).then(() => {
                            writeConfigJsonFile(relativePath, childObj, (md5) => {
                                orgObj[key] = appendVersionMark(relativePath, md5);
                                resolve();
                            }, reject);
                        }, reject);
                    }))
                } else if (extName == '.js') {
                    checkMinJs(relativePath, key, orgObj, FileCfg.srcRoot, () => {
                        let minPath = orgObj[key];
                        dealFileWithVersion(minPath, key, orgObj, resolve, reject);
                    })
                } else {
                    log('what is this?')
                    reject();
                }
            }
        }
    })
}

function dealFileWithVersion(relativePath: string, key: string, orgObj: any, resolve: () => void, reject: () => void) {
    dealFile(relativePath, (md5) => {
        orgObj[key] = appendVersionMark(relativePath, md5);
        resolve();
    }, reject)
}

function dealFile(relativePath: string, resolve?: (md5: string) => void, reject?: () => void) {
    let fullPath = path.join(FileCfg.srcRoot, relativePath);
    getMD5(fullPath, md5 => {
        let oldMd5 = VersionMap[relativePath];
        if (md5 != oldMd5) {
            VersionMap[relativePath] = md5;
            copyFileWithDirCreation(path.join(FileCfg.srcRoot, relativePath), path.join(FileCfg.destRoot, relativePath))
        }
        if (resolve) resolve(md5)
    })
}

//处理那些重新选取过min的配置文件
function dealFileOnDest(relativePath: string, resolve: (md5: string) => void, reject?: () => void) {
    let destFull = path.join(FileCfg.destRoot, relativePath);
    getMD5(destFull, md5 => {
        let oldMd5 = VersionMap[relativePath];
        if (md5 != oldMd5) {
            VersionMap[relativePath] = md5;
        } else {
            fs.unlink(destFull, getErrCallback(() => {
                log('configJson has no change so remove it: ' + destFull);
            }))
        }
        resolve(md5);
    })
}

function writeConfigJsonFile(relativePath: string, contentObj: any, resolve: (md5: string) => void, reject?: () => void) {
    let destFull = path.join(FileCfg.destRoot, relativePath);
    paving(destFull, () => {
        fs.writeFile(destFull, JSON.stringify(contentObj), { encoding: 'utf8' }, getErrCallback(() => {
            log('configJson has benn written to ' + destFull);
            dealFileOnDest(relativePath, resolve, reject)
        }))
    })
}

function removeVersionMark(value: string) {
    if (value.indexOf(HTTP_MARK) >= 0) return value;
    let vIdx = value.indexOf(VERSION_MARK);
    if (vIdx >= 0) return value.slice(0, vIdx);
    return value;
}

function appendVersionMark(value: string, version: string) {
    return value + VERSION_MARK + version;
}

function normalPath(value: string) {
    if (value.indexOf('./') == 0) return value.substring(2)
    return value;
}

main();

interface IFileCfg {
    srcRoot: string;
    destRoot: string;
    versionFullPath: string;
    enterFile: string;
    noCheckList: string[];//从enterFile索引，不必打开，只管自身的文件
    resourceRootList: string[];//资源配置文件
    singleFileList: string[];//额外指定的文件
}
