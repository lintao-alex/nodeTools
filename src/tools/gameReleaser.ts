/**
 * Created by lintao_alex on 2019/3/11
 */
import * as fs from "fs";
import {BasePicker} from "./pkgPicker";
import {getOrderedJsonStr} from "../common/JSONOrderedStringify";
import {walkObj} from "../common/utils";
import * as path from "path";
import {replaceMinJs} from "./scriptReleaser";
import {log} from "util";
import {copyFileWithDirCreation, cutRelativePath, getMD5} from "../common/FileUtils";

let rootPath = 'D:\\WORK\\prj-yjqz\\client_AWY\\yjqz';
let resourceRootPath = path.join(rootPath, 'resource');
let resourceFilePath = path.join(resourceRootPath, 'resource.json');
let destRoot = 'G:\\todo\\lala';
let resVerPick = new Promise((resolve, reject) => {

    let content = fs.readFileSync(resourceFilePath, { encoding: 'utf8' })
    let jsObj = JSON.parse(content);
    let resList = jsObj.resources;

    let pureMap: any = {};
    for (let i = resList.length - 1; i >= 0; i--) {
        let res = resList[i];
        let resUrl: string = res.url;
        let vv = resUrl.split('?v=');
        let pureUrl = vv[0]
        res.url = pureUrl;
        pureMap[path.normalize(pureUrl)] = vv[1];
    }

    let release = new BasePicker(resourceRootPath, destRoot, pureMap);
    release.resetExcludeList(['resource.json', 'fightDemo.json'])
    release.start(() => {
        for (let i = resList.length - 1; i >= 0; i--) {
            let res = resList[i];
            let pureUrl = res.url
            res.url += '?v=' + pureMap[path.normalize(pureUrl)];
        }
        fs.writeFile(resourceFilePath, getOrderedJsonStr(jsObj), 'utf8', err => {
            if (err) throw err;
            console.log('resource finish')
            resolve('hehe');
        })
    })
})
resVerPick.then((...args: any[]) => {
    let manifestFilePath = path.join(rootPath, 'manifest.json');

    let content = fs.readFileSync(manifestFilePath, { encoding: 'utf8' })
    let jsObj = JSON.parse(content);
    let scriptList = jsObj.scripts;

    replaceMinJs(rootPath, scriptList, () => {
        let pickCnt = 0;
        walkObj(scriptList, (value: string, key, obj) => {
            let vv = value.split('?v=');
            let pureUrl = vv[0];
            let relativeUrl = path.normalize(pureUrl)
            let map: any = {}
            map[relativeUrl] = vv[1];
            let picker = new BasePicker(rootPath, destRoot, map)
            ++pickCnt;
            picker.start(() => {
                obj[key] = pureUrl + '?v=' + map[relativeUrl];
                if (--pickCnt == 0) {
                    log('script finish')
                    //todo Main.min.js
                    let assetsParams = jsObj.assetsParams;
                    getMD5(resourceFilePath, md5 => {
                        if (md5 != assetsParams.configVersion) {
                            assetsParams.configVersion = md5;
                            let resDest = cutRelativePath(resourceFilePath, rootPath)
                            copyFileWithDirCreation(resourceFilePath, path.join(destRoot, resDest), 0, () => {
                                log('resource.json has benn copy')
                                releaseManifest();
                            })
                        } else {
                            releaseManifest();
                        }

                        function releaseManifest() {
                            let maniDest = cutRelativePath(manifestFilePath, rootPath);
                            fs.writeFile(path.join(destRoot,maniDest),JSON.stringify(jsObj),{encoding:'utf8'},err => {
                                if(err) throw err;
                                log('Manifest finish')
                            })
                        }
                    })
                }
            })
        })
    })
})


