/**
 * Created by lintao_alex on 2019/3/11
 */
//fixme
export function getOrderedJsonStr(obj:any) {
    let out = '{"groups":'
    out += getOrderedGroupStr(obj.groups, 'name')
    out += ',' + "\n" + '"resources":'
    out += getOrderedGroupStr(obj.resources, 'name')
    out += '}'
    return out;
}
function getOrderedGroupStr(list: any[], ordKey:string) {
    list.sort(function (a, b) {
        return a[ordKey].localeCompare(b[ordKey])
    })
    var ele = list[0]
    var out = "[\n" + getOrderedObjStr(ele)
    for (var i = 1, len = list.length; i < len; ++i) {
        ele = list[i]
        out += ",\n" + getOrderedObjStr(ele)
    }
    out += ']'
    return out
}

function getOrderedObjStr(obj:any) {
    var keys = Object.keys(obj);
    keys.sort();
    var key = keys[0];
    var out = "{" + getSimpleJSONStr(key, obj[key]);
    for (var i = 1, len = keys.length; i < len; ++i) {
        key = keys[i]
        out += ",\n" + getSimpleJSONStr(key, obj[key]);
    }
    out += "}";
    return out;
}
function getSimpleJSONStr(key:string, value:string|number) {
    return '"' + key + '":"' + value + '"'
}
