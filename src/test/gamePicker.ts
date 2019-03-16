/**
 * Created by lintao_alex on 2019/3/15
 */
import {pickCliArgv, walkObj} from "../common/utils";
import {BasePicker} from "../tools/pkgPicker";
import * as fs from "fs";
import {copyFileWithDirCreation, paving, getErrCallback, getMD5} from "../common/FileUtils";
import * as path from "path";
import {replaceMinJs} from "../tools/scriptReleaser";
import {log} from "util";

let versionMark = '?v='
let fileRelativeList: string[];
let versionMap: any;
function main(){
    fs.readFile(process.argv[2], {encoding: 'utf8'}, getErrCallback((content: string)=>{
        let fileCfg: IFileCfg = JSON.parse(content);
        createManifestFile(fileCfg.srcRoot, fileCfg.manifestPath, fileCfg.destRoot, fileCfg.useDebugJs);
    }))
}

function createManifestFile(srcRoot: string, manifestPath: string, destRoot: string, useDebugJS: boolean){
    let mFPath = path.join(srcRoot, manifestPath);
    fs.readFile(mFPath, {encoding: 'utf8'}, getErrCallback((mcStr: string)=>{
        let orgManifestFileName = 'manifestOrg.json';
        let minManifestFileName = 'manifest.json';
        if(useDebugJS){
            orgManifestFileName = minManifestFileName;
            minManifestFileName = 'manifestMin.json';
        }
        let orgManifest:IManifest = JSON.parse(mcStr);
        writeManifestWithVersion(srcRoot, orgManifest, path.join(destRoot, orgManifestFileName));
        let minManifest = JSON.parse(mcStr);//todo object copy
        let minScriptObj = minManifest.scripts;
        replaceMinJs(srcRoot, minScriptObj, ()=>{
            writeManifestWithVersion(srcRoot, minManifest, path.join(destRoot, minManifestFileName));
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
                        log(trgPath + 'maked');
                    }))
                })
            }
        })
    })
}

main()

interface IFileCfg {
    srcRoot: string;
    destRoot: string;
    manifestPath: string;
    versionFullPath: string;
    useDebugJs: boolean;
    include?: string[];
    exclude?: string[];
}

interface IManifest {
    scripts: object;
}