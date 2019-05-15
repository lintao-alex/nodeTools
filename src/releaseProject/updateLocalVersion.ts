/**
 * Created by lintao_alex on 2019/5/15
 */
import {coverToUnixPath, getErrCallback, getMD5, paving} from "../common/FileUtils";
import * as fs from "fs";
import * as path from "path";
import {walkObj} from "../common/utils";
import {log} from "util";

let VERSION_MARK = '?v=';
let HTTP_MARK = '://';
let FileCfg: IFileCfg;

function main(){
    fs.readFile(process.argv[2], { encoding: 'utf8' }, getErrCallback((content: string) => {
        FileCfg = JSON.parse(content);
        //正规化有检查用途的路径，以规避配置与实际地址的差异
        normalizePathList(FileCfg.noCheckList);
        normalizePathList(FileCfg.relativeCfgList);

        let enterFull = path.join(FileCfg.srcRoot, FileCfg.enterFile);
        fs.readFile(enterFull, { encoding: 'utf8' }, getErrCallback((content) => {
            let enterObj = JSON.parse(content);
            let pmsList: Promise<any>[] = []
            walkObj(enterObj, (orgPath, key, obj) => {
                pmsList.push(checkProperty(orgPath, key, obj))
            });
            Promise.all(pmsList).then(()=>{
                writeConfigJsonFile(FileCfg.enterFile, enterObj, ()=>{})
            })
        }))
    }))
}
function checkProperty(orgFilePath: string, key: string, orgObj: any, cutDir?: string) {
    return new Promise((resolve, reject) => {
        if (orgFilePath.indexOf(HTTP_MARK) >= 0) {
            resolve()
        } else {
            let relativePath = normalPath(removeVersionMark(orgFilePath));
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
                    dealFileWithVersion(relativePath, key, orgObj, resolve, reject, cutDir);
                } else {
                    log('what is this? '+ orgFilePath)
                    reject();
                }
            }
        }
    })
}
function writeConfigJsonFile(relativePath: string, contentObj: any, resolve: (md5: string) => void, reject?: () => void) {
    let fullPath = path.join(FileCfg.srcRoot, relativePath);
    fs.writeFile(fullPath, JSON.stringify(contentObj,null,2), { encoding: 'utf8' }, getErrCallback(() => {
        log('configJson has benn written to ' + fullPath);
        getMD5(fullPath, resolve)
    }))
}

function dealFileWithVersion(relativePath: string, key: string, orgObj: any, resolve: () => void, reject: () => void, cutDir?: string) {
    let fullPath = path.join(FileCfg.srcRoot, relativePath);
    getMD5(fullPath, (md5) => {
        orgObj[key] = appendVersionMark(relativePath, md5, cutDir);
        resolve();
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
main();

interface IFileCfg {
    srcRoot: string;
    enterFile: string;
    noCheckList: string[];//从enterFile索引，不必打开，只管自身的文件
    relativeCfgList: string[];//里面配的路径是相对自身的
}
