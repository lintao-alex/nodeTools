/**
 * Created by lintao_alex on 2019/3/10
 */
import * as fs from "fs";
import * as path from "path";
import {walkObj} from "../common/utils";

export function replaceMinJs(root: string, mapObj: any, finCall: (...args: any[]) => void, args?: any[], callObj?: any,) {
    let cnt = 0;
    walkObj(mapObj, (value, key, obj) => {
        ++cnt;
        checkMinJs(value, key, obj, root, fileFin);
    })

    function fileFin() {
        if (--cnt <= 0) {
            finCall.apply(callObj, args);
        }
    }
}

function checkMinJs(orgPath: string, key: string, obj: any, root: string, finCall: (...args: any[]) => void) {
    let minMark = '.min.js';
    if (orgPath.lastIndexOf(minMark) + minMark.length !== orgPath.length) {
        let minPath = orgPath.slice(0, -2) + 'min.' + orgPath.slice(-2);
        let realPath = path.join(path.normalize(root), path.normalize(minPath));
        fs.access(realPath, fs.constants.F_OK, err => {
            if (!err) obj[key] = minPath;
            finCall()
        })
    } else {
        finCall()
    }
}
