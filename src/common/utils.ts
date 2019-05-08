/**
 * Created by lintao_alex on 2019/3/10
 */
/**
 * @param kvObj with the keys that you care, it will be override by process argv
 */
export function pickCliArgv(processArgv: string[], kvObj: any, cliMark = '-') {
    let keys = Object.keys(kvObj);
    for (let i = keys.length - 1; i >= 0; i--) {
        let key = keys[i];
        let cliKey = cliMark + key;
        let cliIndex = processArgv.indexOf(cliKey)
        if (cliIndex >= 0) {
            kvObj[key] = processArgv[cliIndex + 1]
        }
    }
}

export function isBaseValue(obj: any) {
    return typeof obj !== 'object';
}

export function walkObj(obj: any, dealFuc: (value:any, key:string, obj:any)=>void, callObj?:any){
    let keys = Object.keys(obj);
    for (let i = keys.length - 1; i >= 0; i--) {
        let key = keys[i];
        let value = obj[key];
        if(isBaseValue(value)){
            dealFuc.call(callObj, value, key, obj);
        }else{
            walkObj(value, dealFuc, callObj);
        }
    }
}
