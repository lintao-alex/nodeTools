/**
 * Created by lintao_alex on 2019/3/25
 */
import * as fs from "fs";
import {getErrCallback, getMD5, paving} from "../common/FileUtils";
import * as path from "path";
import {walkObj} from "../common/utils";
import {log} from "util";

let versionMark = '?v=';
function main(){
    fs.readFile(process.argv[2], {encoding: 'utf8'}, getErrCallback((content: string)=>{
        let fileCfg: IFileCfg = JSON.parse(content);
        fileCfg.srcRoot = path.normalize(fileCfg.srcRoot);
        checkCfg(fileCfg, ()=>{
            createManifestFile(fileCfg.srcRoot, fileCfg.manifestPath);
        })
    }))
}

function createManifestFile(srcRoot: string, manifestPath: string){
    let mFPath = path.join(srcRoot, manifestPath);
    fs.readFile(mFPath, {encoding: 'utf8'}, getErrCallback((mcStr: string)=>{
        let orgManifest:IManifest = JSON.parse(mcStr);
        let assetsParams = orgManifest.assetsParams;
        let versionFullPath = path.join(srcRoot, assetsParams.resourceRoot, assetsParams.configUrl);
        getMD5(versionFullPath, md5=>{
            orgManifest.assetsParams.configVersion = md5;
            writeManifestWithVersion(srcRoot, orgManifest, path.join(srcRoot, manifestPath));
        })
    }))
}

function writeManifestWithVersion(scrRoot: string, manifestObj: any, trgPath: string){
    let cnt = 0;
    let scriptObj: IManifest = manifestObj.scripts;
    walkObj(scriptObj, (pureUrl: string, key, obj)=>{
        if(pureUrl.indexOf('http')==0) return;
        ++cnt;
        let oldVIdx = pureUrl.indexOf(versionMark);
        if(oldVIdx>0) pureUrl = pureUrl.slice(0, oldVIdx);
        let fileFullPath = path.join(scrRoot, pureUrl);
        getMD5(fileFullPath, md5=>{
            obj[key] = pureUrl+versionMark+md5;
            if(--cnt==0){
                paving(trgPath, ()=>{
                    fs.writeFile(trgPath, JSON.stringify(manifestObj), {encoding:'utf8'}, getErrCallback(()=>{
                        log('[manifest]'+trgPath + ' maked');
                    }))
                })
            }
        })
    })
}

function checkCfg(fileCfg: IFileCfg, callback: ()=>void){
    let cnt = 1;
    fs.access(fileCfg.srcRoot, fs.constants.F_OK, getErrCallback(checkFinish))

    function checkFinish(){
        if(--cnt==0){
            callback();
        }
    }
}

main();

interface IFileCfg {
    srcRoot: string;
    manifestPath: string;
    include?: string[];
    exclude?: string[];
}

interface IManifest {
    scripts: object;
    assetsParams: {configVersion: string, resourceRoot: string, configUrl: string};
}
