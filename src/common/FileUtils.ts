/**
 * Created by lintao_alex on 2019/3/10.
 */

import * as fs from "fs";
import * as path from "path";
var warn = console.warn;

export function walkDir(dirPath: string, dealFuc: (filePath: string)=>void){
    fs.readdir(dirPath, (err, files)=>{
        if (err) {
            warn(err);
        } else {
            for (let i = 0, len = files.length; i < len; i++) {
                let child = path.join(dirPath, files[i]);
                fs.stat(child, (err, stats)=>{
                    if (err) {
                        warn(err)
                    } else {
                        if (stats.isDirectory()) {
                            walkDir(child, dealFuc)
                        } else {
                            dealFuc(child);
                        }
                    }
                })
            }
        }
    })
}
