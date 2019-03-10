/**
 * Created by lintao_alex on 2019/3/10
 * make file version
 * pick the new files
 */
import * as path from 'path'
import {copyFileWithDirCreation, cutRelativePath, getErrCallback, getMD5, walkDir} from "../common/FileUtils";
import {log} from "util";
import * as fs from "fs";

export class BasePicker {
    private _srcRoot: string;
    private _destRoot: string;
    private _finCall: Function | undefined;
    private _callObj: any;
    private _callArgs: Array<any> | undefined;
    private _cnt = 0;
    private _excludePathList: string[] = [];

    /**
     * @param _map relativePath->md5
     */
    public constructor(srcRoot: string, destRoot: string, private _map: any) {
        this._srcRoot = path.normalize(srcRoot);
        this._destRoot = path.normalize(destRoot);
    }

    public resetExcludeList(pathList: string[]){
        let list = [];
        for (let i = 0, len = pathList.length; i < len; i++) {
            list[i] = path.normalize(pathList[i])
        }
        this._excludePathList = list;
    }

    public start(finCall?: Function, callObj?:any, args?:any[]) {
        this._finCall = finCall;
        this._callObj = callObj;
        this._callArgs = args;
        this._cnt = 0;
        fs.stat(this._srcRoot, getErrCallback((stat: fs.Stats) => {
            if (stat.isDirectory()) {
                walkDir(this._srcRoot, this.dealFile, this)
            } else {
                this.dealFile(this._srcRoot)
            }
        }))
    }

    protected dealFile(fullPath: string) {
        let relativePath = cutRelativePath(fullPath, this._srcRoot);
        if(this._excludePathList.indexOf(relativePath)>=0) return;
        ++this._cnt;
        let map = this._map;
        getMD5(fullPath, md5 => {
            let oldMd5 = map[relativePath];
            if (md5 != oldMd5) {
                map[relativePath] = md5;
                copyFileWithDirCreation(fullPath, path.join(this._destRoot, relativePath), 0, dest => {
                    log(dest + ' has been picked')
                    this.checkFinish();
                }, this)
            }else{
                this.checkFinish();
            }
        }, this)
    }

    private checkFinish(){
        if(--this._cnt<=0){
            let callback = this._finCall;
            if(callback){
                callback.apply(this._callObj, this._callArgs);
            }
        }
    }
}
