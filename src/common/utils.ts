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

export function walkObj(obj: any, dealFuc: (value:any, key:string, obj:any)=>void, callObj?:any){
    if (typeof obj !== 'object') throw new Error("this function only deal Object type")
    innerWalk(obj, dealFuc, callObj);
    function innerWalk(obj: any, dealFuc: (value:any, key:string, obj:any)=>void, callObj:any){
        let keys = Object.keys(obj);
        for (let i = keys.length - 1; i >= 0; i--) {
            let key = keys[i];
            let value = obj[key];
            if(typeof value === 'object'){
                innerWalk(value, dealFuc, callObj);
            }else if(Array.isArray(value)){
                for (let j = value.length - 1; j >= 0; j--) {
                    innerWalk(value[j], dealFuc, callObj);
                }
            }else{
                dealFuc.call(callObj, value, key, obj);
            }
        }
    }
}

export interface ICountObj{
    value: number;
}

