/* iOS 题宝库 · data/custom.js:把用户自建题注册进题库
   必须在全部内置数据文件之后、store.js 之前加载。
   放在这里(而不是 app.js 启动时)的理由:所有消费者(store/views)都在
   此之后加载,能看到一个已经成形的 QB,不依赖"没人在加载期读 QB"这种隐性约定。 */
'use strict';

QB.defineCustomCat();
QB.syncCustom(LS.get('custom', []));
