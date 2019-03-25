/**
 * Created by lintao_alex on 2019/3/15
 */
import {walkObj} from "../common/utils";
import {BasePicker} from "../tools/pkgPicker";
import * as fs from "fs";
import {
    paving,
    getErrCallback,
    getMD5,
    convertMathPathList
} from "../common/FileUtils";
import * as path from "path";
import {replaceMinJs} from "../tools/scriptReleaser";
import {log} from "util";

let versionMark = '?v=';
function main(){
    fs.readFile(process.argv[2], {encoding: 'utf8'}, getErrCallback((content: string)=>{
        let fileCfg: IFileCfg = JSON.parse(content);
        fileCfg.srcRoot = path.normalize(fileCfg.srcRoot);
        fileCfg.destRoot = path.normalize(fileCfg.destRoot);
        fileCfg.versionFullPath = path.normalize(fileCfg.versionFullPath);
        checkCfg(fileCfg, ()=>{
            createManifestFile(fileCfg.srcRoot, fileCfg.manifestPath, fileCfg.destRoot, fileCfg.useDebugJs);
            pickFiles(fileCfg);
        })
    }))
}

function checkCfg(fileCfg: IFileCfg, callback: ()=>void){
    let cnt = 3;
    fs.access(fileCfg.srcRoot, fs.constants.F_OK, getErrCallback(checkFinish))
    fs.access(fileCfg.destRoot, fs.constants.F_OK, getErrCallback(checkFinish))
    fs.access(path.dirname(fileCfg.versionFullPath), fs.constants.F_OK, getErrCallback(checkFinish))

    function checkFinish(){
        if(--cnt==0){
            callback();
        }
    }
}

function pickFiles(fileCfg: IFileCfg) {
    fs.readFile(fileCfg.versionFullPath, {encoding:'utf8'}, (err, content)=>{
        if(err || !content){
            var versionMap = {}
        }else{
            versionMap = JSON.parse(content);
        }
        let srcRoot = fileCfg.srcRoot;
        let picker = new BasePicker(srcRoot, fileCfg.destRoot, versionMap)
        let include = fileCfg.include;
        if(include && include.length > 0){
            picker.resetAppointRelativeList(include);
        }
        let exclude = fileCfg.exclude;
        if(exclude && exclude.length > 0){
            let excludeRelativeList: string[] = [];
            convertMathPathList(exclude, srcRoot, excludeRelativeList, ()=>{
                picker.resetExcludeList(excludeRelativeList);
                doPick();
            })
        }else{
            doPick();
        }

        function doPick(){
            picker.start(()=>{
                fs.writeFile(fileCfg.versionFullPath, JSON.stringify(versionMap), {encoding:'utf8'}, getErrCallback(()=>{
                    log('[version] new version recorded')
                }))
            })
        }
    })
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
        let minManifest = JSON.parse(mcStr);//todo object copy
        let assetsParams = orgManifest.assetsParams;
        let versionFullPath = path.join(srcRoot, assetsParams.resourceRoot, assetsParams.configUrl);
        getMD5(versionFullPath, md5=>{
            orgManifest.assetsParams.configVersion = md5;
            minManifest.assetsParams.configVersion = md5;
            writeManifestWithVersion(srcRoot, orgManifest, path.join(destRoot, orgManifestFileName));
            let minScriptObj = minManifest.scripts;
            replaceMinJs(srcRoot, minScriptObj, ()=>{
                writeManifestWithVersion(srcRoot, minManifest, path.join(destRoot, minManifestFileName));
            })
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

main()

interface IFileCfg {
    srcRoot: string;
    destRoot: string;
    manifestPath: string;
    versionFullPath: string;//full path of the file which record the last version map, but the key is relative path in this file
    useDebugJs: boolean;
    include?: string[];
    exclude?: string[];
}

interface IManifest {
    scripts: object;
    assetsParams: {configVersion: string, resourceRoot: string, configUrl: string};
}