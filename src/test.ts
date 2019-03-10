/**
 * Created by lintao_alex on 2019/3/10.
 */
import {walkDir} from "./common/FileUtils";

walkDir(__dirname, filePath => {console.log(filePath)})
