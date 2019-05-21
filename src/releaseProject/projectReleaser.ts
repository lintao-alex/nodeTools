/**
 * Created by lintao_alex on 2019/5/6
 * 要做的事：
 * 1挑出所有变化了的文件
 * 2.在配置文件里所配的路径加上版本号，同时将有min的js文件替换为min.js
 * 3.部分文件里配置的是相对其所在路径的地址，生成的文件里仍要按此路径
 * 处理思路：
 * 1.资源与额外指定的单一文件独立处理（不列入处理流程）
 * 2.配置了索引的文件要待其子文件处理好后再打上版本号, 此类文类对比的是拷贝至目标路径的文件，而非源文件(因为内容已与源文件不一致)
 */
import * as fs from "fs";
import {copyFileWithDirCreation, coverToUnixPath, getErrCallback, getMD5, paving, walkDir} from "../common/FileUtils";
import * as path from "path";
import {walkObj} from "../common/utils";
import {log} from "util";
import {checkMinJs, replaceMinJs} from "../tools/scriptReleaser";

const PREVIEW = 'preview';
const ONLINE = 'online';

let VERSION_MARK = '?v=';
let HTTP_MARK = '://';
let FileCfg: IFileCfg;
let VersionMap: any;

function main() {
    fs.readFile(process.argv[2], { encoding: 'utf8' }, getErrCallback((content: string) => {
        FileCfg = JSON.parse(content);
        checkCfg(FileCfg, () => {
            fs.readFile(FileCfg.versionFullPath, { encoding: 'utf8' }, (err, content) => {
                if (err || !content) {
                    VersionMap = {}
                } else {
                    VersionMap = JSON.parse(content);
                }

                //正规化有检查用途的路径，以规避配置与实际地址的差异
                normalizePathList(FileCfg.noCheckList);
                normalizePathList(FileCfg.relativeCfgList);

                //至此，工具配置，文件前次版本记录已准备完毕
                //deal script and json
                let enterFull = path.join(FileCfg.srcRoot, FileCfg.enterFile);
                fs.readFile(enterFull, { encoding: 'utf8' }, getErrCallback((content) => {
                    let enterObj = JSON.parse(content);
                    let pmsList: Promise<any>[] = []
                    walkObj(enterObj, (orgPath, key, obj) => {
                        pmsList.push(checkProperty(orgPath, key, obj))
                    });
                    Promise.all(pmsList).then(() => {
                        writeConfigJsonFile(FileCfg.enterFile, enterObj, (md5) => {
                            fs.writeFile(FileCfg.versionFullPath, JSON.stringify(VersionMap, null, 2), { encoding: 'utf8' }, getErrCallback(() => {
                                log('[version] new version recorded')
                            }))
                            if(FileCfg.isOnline){
                                let previewFullPath = path.join(FileCfg.destRoot, 'game', PREVIEW);
                                fs.access(previewFullPath, fs.constants.F_OK, err=>{
                                    if(!err){
                                        fs.rename(previewFullPath, path.join(FileCfg.destRoot, 'game', ONLINE), getErrCallback(()=>{
                                            log('preview fold has been changed to online')
                                        }))
                                    }
                                })
                            }
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

function dealRelativeCfg(cfgPath: string, key: string, parentObj: any, resolve: ()=>void, reject: ()=>void, cutDir?: string){
    let fullPath = path.join(FileCfg.srcRoot, cfgPath);
    fs.readFile(fullPath, {encoding: 'utf8'}, getErrCallback((content: string)=>{
        let cfgDir = path.dirname(cfgPath);
        let cfgObj = JSON.parse(content);
        let pmsList: Promise<any>[] = []
        walkObj(cfgObj, (childRelative, key, curObj)=>{
            let normalChildRelative = path.join(cfgDir, childRelative);
            pmsList.push(checkProperty(normalChildRelative, key, curObj, cfgDir))
        })
        Promise.all(pmsList).then(()=>{
            writeConfigJsonFile(cfgPath, cfgObj, (md5) => {
                parentObj[key] = appendVersionMark(cfgPath, md5, cutDir);
                resolve();
            }, reject);
        },reject)
    }))
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

function checkProperty(orgFilePath: string, key: string, orgObj: any, cutDir?: string) {
    return new Promise((resolve, reject) => {
        if (orgFilePath.indexOf(HTTP_MARK) >= 0) {
            resolve()
        } else {
            let relativePath = normalPath(removeVersionMark(orgFilePath));
            orgObj[key] = relativePath;//为配合checkMinJs，这里先做好清理
            let normalPathForCheck = path.normalize(relativePath);
            if (FileCfg.noCheckList.indexOf(normalPathForCheck) >= 0) {
                dealFileWithVersion(relativePath, key, orgObj, resolve, reject, cutDir);
            } else if(FileCfg.relativeCfgList.indexOf(normalPathForCheck) >= 0){
                dealRelativeCfg(relativePath, key, orgObj, resolve, reject, cutDir);
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
                                orgObj[key] = appendVersionMark(relativePath, md5, cutDir);
                                resolve();
                            }, reject);
                        }, reject);
                    }))
                } else if (extName == '.js') {
                    checkMinJs(relativePath, key, orgObj, FileCfg.srcRoot, () => {
                        let minPath = orgObj[key];
                        dealFileWithVersion(minPath, key, orgObj, resolve, reject, cutDir);
                    })
                } else {
                    log('what is this? '+ orgFilePath)
                    reject();
                }
            }
        }
    })
}

function dealFileWithVersion(relativePath: string, key: string, orgObj: any, resolve: () => void, reject: () => void, cutDir?: string) {
    dealFile(relativePath, (md5) => {
        orgObj[key] = appendVersionMark(relativePath, md5, cutDir);
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

function appendVersionMark(value: string, version: string, cutDir?: string) {
    value = coverToUnixPath(value);
    if(cutDir){
        cutDir = coverToUnixPath(cutDir);
        value = value.replace(cutDir, '');
        if(value.charAt(0) === '/') value = value.substring(1);
    }
    return value + VERSION_MARK + version;
}

function normalPath(value: string) {
    if (value.indexOf('./') == 0) return value.substring(2)
    return value;
}

function normalizePathList(list: string[]){
    for (let i = list.length - 1; i >= 0; i--) {
        let orgPath = list[i];
        list[i] = path.normalize(orgPath);
    }
}

main();

interface IFileCfg {
    srcRoot: string;
    destRoot: string;
    versionFullPath: string;
    enterFile: string;
    isOnline?:boolean;//是否将游戏导出目录下的preview改名为online
    noCheckList: string[];//从enterFile索引，不必打开，只管自身的文件
    relativeCfgList: string[];//里面配的路径是相对自身的
    resourceRootList: string[];//资源配置文件
    singleFileList: string[];//额外指定的文件
}
