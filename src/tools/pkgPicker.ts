/**
 * Created by lintao_alex on 2019/3/10
 * pick the new files
 */
import * as path from 'path'
import {
    copyFileWithDirCreation,
    getErrCallback,
    getMD5,
    normalizePathList,
    walkDir
} from "../common/FileUtils";
import {log} from "util";
import * as fs from "fs";

export class BasePicker {
    private _srcRoot: string;
    private _excludePathList: string[] = [];
    private _appointRelativePathList: string[] = [];

    private _destRoot: string;
    private _finCall: Function | undefined;
    private _callObj: any;
    private _callArgs: Array<any> | undefined;
    private _cnt = 0;

    /**
     * @param _map relativePath->md5
     */
    public constructor(srcRoot: string, destRoot: string, private _map: any) {
        this._srcRoot = path.normalize(srcRoot);
        this._destRoot = path.normalize(destRoot);
    }

    public resetAppointRelativeList(pathList: string[]) {
        normalizePathList(pathList);
        this._appointRelativePathList = pathList;
    }

    public resetExcludeList(pathList: string[]) {
        normalizePathList(pathList);
        this._excludePathList = pathList;
    }

    public start(finCall?: Function, callObj?: any, args?: any[]) {
        this._finCall = finCall;
        this._callObj = callObj;
        this._callArgs = args;
        this._cnt = 0;
        fs.stat(this._srcRoot, getErrCallback((stat: fs.Stats) => {
            if (this._appointRelativePathList.length > 0) {
                let list = this._appointRelativePathList;
                for (let i = list.length - 1; i >= 0; i--) {
                    this.dealFile(path.join(this._srcRoot, list[i]));
                }
            } else if (stat.isDirectory()) {
                walkDir(this._srcRoot, this.dealFile, this)
            } else {
                // this.dealFile(this._srcRoot)
                throw new Error("this picker doesn't work on file directly")
            }
        }))
    }

    protected dealFile(fullPath: string) {
        let relativePath = path.relative(this._srcRoot, fullPath);
        if (this._excludePathList.indexOf(relativePath) >= 0) return;
        ++this._cnt;
        let map = this._map;
        getMD5(fullPath, md5 => {
            let oldMd5 = map[relativePath];
            if (md5 != oldMd5) {
                map[relativePath] = md5;
                copyFileWithDirCreation(fullPath, path.join(this._destRoot, relativePath), 0, dest => {
                    this.checkFinish();
                }, this)
            } else {
                this.checkFinish();
            }
        }, this)
    }

    private checkFinish() {
        if (--this._cnt <= 0) {
            let callback = this._finCall;
            if (callback) {
                callback.apply(this._callObj, this._callArgs);
            }
        }
    }
}
