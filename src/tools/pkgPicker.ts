/**
 * Created by lintao_alex on 2019/3/10
 * make file version
 * pick the new files
 */
import * as path from 'path'
import {copyFileWithDirCreation, getErrCallback, getMD5, walkDir} from "../common/FileUtils";
import {log} from "util";
import * as fs from "fs";

export class BasePicker {
    private _srcRoot: string;
    private _destRoot: string;

    /**
     *
     * @param _srcRoot
     * @param _pickDest
     * @param _map relativePath->md5
     */
    public constructor(srcRoot: string, destRoot: string, private _map: Map<string, string>) {
        this._srcRoot = path.normalize(srcRoot);
        this._destRoot = path.normalize(destRoot);
    }

    public start() {
        fs.stat(this._srcRoot, getErrCallback((stat: fs.Stats) => {
            if (stat.isDirectory()) {
                walkDir(this._srcRoot, this.dealFile, this)
            } else {
                this.dealFile(this._srcRoot)
            }
        }))
    }

    protected dealFile(filePath: string) {
        let fullPath = path.join(this._srcRoot, filePath);
        let map = this._map;
        getMD5(fullPath, md5 => {
            if (md5 != map.get(filePath)) {
                map.set(filePath, md5);
                copyFileWithDirCreation(fullPath, path.join(this._destRoot, filePath), 0, dest => {
                    log(dest + ' has been picked')
                }, this)
            }
        }, this)
    }
}
