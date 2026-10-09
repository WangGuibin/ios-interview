/* iOS 题宝库 · data/uikit.js:UIKit */
'use strict';

QB.add({
  key: 'uikit', name: 'UIKit', icon: 'cUikit', tint: '#2D7FF9',
  desc: '生命周期、事件传递与响应链、渲染、列表优化',
}, [
  {
    t: '事件传递与响应链的完整流程?hitTest 和 pointInside 的作用?',
    lv: 2, fq: 3, tags: ['hitTest', '响应链', '事件传递'],
    opt: ['事件先沿响应链向上,再做 hitTest', 'hitTest 自顶向下找到最深命中视图,不处理再沿响应链向上抛', 'alpha 为 0.5 的视图不接收事件', '子视图永远比父视图先被 hitTest 命中'],
    ans: 1,
    key: ['hitTest 自顶向下找最深命中者;响应链自底向上找处理者', '扩大点击区域:重写 pointInside;让子视图响应:重写 hitTest'],
    a: `**阶段一:事件传递(寻找第一响应者)**

从 UIWindow(或 Scene window)开始自顶向下递归:

1. 判断 \`isUserInteractionEnabled && !isHidden && alpha > 0.01\`,否则该视图整支不接收
2. \`point(inside:with:)\` 判断触点是否在自己 bounds 内
3. 在的话,**逆序**(后添加的最上先查)问每个 subview 递归 hitTest,子视图返回非空就直接向上传递
4. 子视图都没命中,返回自己

**阶段二:事件响应(谁处理)**

触摸交给 hit-test 命中的视图;它不处理(\`touches\` 不重写 / gesture 未识别成功)事件沿 **responder chain** 上抛:

\`View → 所属 ViewController → 父 View → ... → window → UIApplication → AppDelegate\`

每个节点都是 UIResponder,统一可以处理 touch / motion(晃动)/ remote(遥控)/ press。

**实战考点**:

- 扩大按钮点击区:重写 \`pointInside\`,扩大判定范围(inset(-20))
- 视图透出区域响应(子视图溢出父 bounds 想响应):父视图重写 \`hitTest\`,对目标子视图做坐标变换再返回
- 事件透传:hitTest 返回下层兄弟而忽略自己`,
  },
  {
    t: 'UIView 和 CALayer 的关系?为什么要拆成两个类?',
    lv: 2, fq: 3, tags: ['UIView', 'CALayer', '职责分离'],
    opt: ['CALayer 负责事件响应,UIView 负责绘制', 'UIView 负责交互与布局,CALayer 负责内容呈现与动画', 'UIView 没有对应的 layer', '修改 view.frame 不会影响 layer'],
    ans: 1,
    key: ['UIView=交互+布局+生命周期管理;CALayer=内容呈现与动画', '同一套 Layer 树可跨 UIKit/AppKit 复用,渲染可交给独立进程'],
    a: `**职责划分**:

- **CALayer**(Core Animation):持有**位图内容**(contents)、几何(frame/bounds/transform)、视觉(圆角/阴影/蒙版),负责**图层合成与动画**,最终交给 Render Server 显示;**不响应事件**
- **UIView**:是 \`UIResponder\` 子类,负责**事件响应 + 布局管理 + 动画 API 封装**,它的背后是**一个 backing CALayer**,view 的 frame/alpha/backgroundColor 等大多是对 layer 同名属性的桥接

**为什么拆分**:

1. **职责分离**:渲染 ≠ 交互,layer 可以脱离 UIKit 在 AppKit 平台复用(一套 Core Animation)
2. **渲染独立进程化**:Layer 树提交给 backboardd 的 Render Server,App 崩溃时画面不会闪退,系统动画(下拉控制中心)流畅
3. **动画不用刷 UI 主循环**:隐式/显式动画在 layer 树上演算,不重走 layoutSubviews

**常见追问**:改 view.layer 的某些属性**不走 UIView 的通知**(如直接改 layer.contentsScale),UIKit 有些逻辑在 UIView 层做;复杂自定义绘制优先 layer 委托绘制,异步绘制则在子线程绘制位图赋 contents。`,
  },
  {
    t: 'frame 和 bounds 的区别?修改 bounds.origin 会发生什么?',
    lv: 1, fq: 2, tags: ['frame', 'bounds', '坐标系'],
    key: ['frame:在父坐标系的位置尺寸;bounds:在自身坐标系的原点尺寸', '改 bounds.origin = 改变子视图内容的"镜头",scrollview 就靠它'],
    a: `**一句话**:\`frame\` 是相对**父视图坐标系**的(x, y, w, h);\`bounds\` 是相对**自身坐标系**的(origin, size),默认 origin 是 (0,0)。

**改 bounds.origin 的效果**:相当于**把"观察内容的窗口"平移**,自己的位置没变,但子视图/内容绘制的参考系移动了 → 视觉上内容**向反方向滚动**。UIScrollView 推动 \`contentOffset\`,本质就是修改自己 bounds.origin。

**关联考点**:

- frame 的 x/y 只有在**父视图的坐标系**里才有意义,transform(旋转缩放)改变后 frame 是"包围盒",不宜再依赖
- \`bounds.size\` 与 \`frame.size\` 在无 transform 时相等;有旋转时 frame.size 是外接矩形
- \`center\` 只是 frame 中点的便捷属性,等价换算

**实例**:实现自绘"放大镜"时,常常改 bounds.origin 做裁剪平移,而不是去移动一堆子视图。`,
  },
  {
    t: 'UI 渲染流水线描述一下?什么是离屏渲染,如何避免?',
    lv: 3, fq: 3, tags: ['渲染', '离屏渲染', 'cornerRadius'],
    opt: ['离屏渲染比正常渲染更快,应尽量使用', 'cornerRadius+masksToBounds、无 shadowPath 的阴影、mask 都可能触发离屏渲染', '离屏渲染只消耗内存不消耗 GPU', '设置 shouldRasterize 一定能提升性能'],
    ans: 1,
    key: ['CPU 布局绘制→CA commit→Render Server→GPU 合成→显示', 'cornerRadius+masksToBounds、shadow 无 shadowPath、mask、光栅化触发离屏'],
    a: `**一帧的旅程**:

1. **App(CPU)**:布局(Auto Layout 求解、layoutSubviews)、文本排版、图像解码、drawRect 绘制、把图层树改动打进 CATransaction
2. **RunLoop 休眠前 commit**:事务提交给 **Render Server**(backboardd 进程)
3. **Render Server**:解析指令、调度 Core Animation 合成
4. **GPU**:顶点/片元渲染到帧缓存(FBO),双缓冲交换
5. **VSync**:垂直同步信号触发上屏,一帧预算 60Hz×16.7ms / 120Hz×8.3ms

**离屏渲染**:GPU 受限于"合成顺序"(比如圆角要裁剪**先渲染再部分混合**),不得不先在**屏幕外的离屏缓冲**渲一份,再拷回主缓冲合成,多一次上下文切换 + 内存拷贝,代价高。

**触发源**:\`cornerRadius + masksToBounds\`(多子层时尤其)、\`shadow\` 未给 \`shadowPath\`、\`mask\`、\`allowsGroupOpacity\`、主动的 \`shouldRasterize\`、毛玻璃。

**优化**:

- 圆角:**预合成**(把图在 CPU 上裁成圆角缓冲区赋值)或直接用 CAShapeLayer 画边框,列表避免每帧新做
- 阴影:**必须同时给 \`shadowPath\`**(用贝塞尔描述形状),GPU 就可以直接画阴影而不用离屏
- 检查:Xcode Debug → Color Offscreen-Rendered,黄色即触发

**追问点**:shouldRasterize 是"有意离屏换后续合成快",适合静止的复杂小图,别在滚动列表 cell 上用。`,
  },
  {
    t: '卡顿的本质是什么?从 CPU 和 GPU 两侧各说什么优化手段?',
    lv: 3, fq: 3, tags: ['卡顿', '掉帧', '16.7ms'],
    opt: ['掉帧只可能由 GPU 导致', 'CPU+GPU 在一帧预算内没交付,屏幕继续显示上一帧', '掉帧是因为 VSync 信号频率太高', '卡顿只在低端机发生'],
    ans: 1,
    key: ['一帧预算 16.7ms(60Hz),CPU+GPU 超时 = 丢帧显示旧帧', 'CPU:布局排版解码;GPU:合成离屏渲染'],
    a: `**本质**:屏幕按 VSync 节奏问你"这一帧呢",CPU(布局绘制)+ GPU(合成)**总得在帧预算内交付**,交不出来,本帧被丢,屏幕继续显示**上一帧内容**,用户就感觉"卡"。

**CPU 侧优化**(App 进程工作):

- 布局:预计算 cell 高度并缓存,减少 AutoLayout 深层约束
- 文本:富文本**异步预排版**(TextKit/CoreText),别在 setNeedsDisplay 里当场算
- 图片:**子线程预解码 + 降采样**,UIImage 解码是渲染时才发生的隐形成本
- 对象:cell 内少创建对象(日期格式化器、NSCache 缓存)
- 绘制:文本/形状用异步绘制(layer.contents 离屏分派)

**GPU 侧优化**(Core Animation 合成):

- 消灭**离屏渲染**(见上题)
- 减少**图层混合**:opaque、少半透叠加、背景色对齐
- 图片尺寸与视图尺寸匹配,避免大纹理缩放采样

**监测**:CADisplayLink 帧率、RunLoop 状态超时、MetricKit hang、Instruments Animation Hitches。`,
  },
  {
    t: 'UITableView 的复用机制?什么时候触发 prepareForReuse?',
    lv: 2, fq: 3, tags: ['UITableView', '复用', 'prepareForReuse'],
    opt: ['cell 每次滚动都新建销毁', '出屏 cell 进复用池,prepareForReuse 在复用出池时调用', 'prepareForReuse 在 cell 创建时调用', '复用机制只存在于 UICollectionView'],
    ans: 1,
    key: ['出屏 cell 进 reuse pool,入屏 dequeue 拿复用', 'prepareForReuse:复用出池时回调,复位全部可变状态'],
    a: `**机制**:\`UITableView\` 的 cell 池按 \`reuseIdentifier\` 分桶,**完全滚出屏幕**的 cell 入池;\`dequeueReusableCell(withIdentifier:for:)\` 入池取旧 cell 或新建。**注册类/ nib**之后该方法保证非空(对比早年的 \`dequeueReusableCell(withIdentifier:)\` 可能空)。

**关键复用坑**:

- **prepareForReuse()**:cell 被**复用出池**时调用,必须复位:图片清空/占位、高亮、选中态、未完成的**异步任务取消**!否则就会出现"滚动时图片串台"(旧任务回来给新 indexPath 写图)
- 高度不平滑:不等高 cell 大量首次滚动,行高计算在主线程卡顿,要么**预计算高度**,要么正确给 \`estimatedRowHeight\` 启用自适高
- **collection 差异**:\`UICollectionView\` 完全同构机制,布局抽象更强

**iOS 14+ 新口径**:\`UICollectionViewListCell + UIListContentConfiguration\` 把"配置 cell"做成值语义,diffable 数据源出现画面错位大幅减少,但老的坑仍年年问。`,
  },
  {
    t: 'Auto Layout 的原理?复杂约束为什么卡,怎么破?',
    lv: 3, fq: 2, tags: ['AutoLayout', 'Cassowary', '布局性能'],
    key: ['Cassowary 线性约束求解,约束复杂度随层级指数级上涨', '优化:扁平层级、减少依赖、frame 布局、文本预排版'],
    a: `**原理**:Auto Layout 基于 **Cassowary 约束求解算法**,把 \`leading = multiplier * trailing + constant @ priority\` 这类约束建成线性方程组,在布局 pass(由 setNeedsLayout 触发、runloop 之后)求出各视图的 frame,可处理冲突(优先级高的先满足)。

**性能问题来自何处**:

- **求解复杂度**:约束图是视图层级 × 依赖关系的联立方程,层级一深,求解时间呈**指数级别**风险(iOS 12 对 engine 做了大优化,但深层级+多优先级仍是常见卡源)
- **布局风暴**:\`layoutSubviews\` 里再 \`setNeedsLayout\` / 改约束,引发嵌套布局 pass
- **Intrinsic size 重复计算**:标签/按钮动态内容反复求尺寸

**优化**:

1. **层级扁平** + 少用 \`updateConstraints\` 反复改(创建约束一次就位,靠 priority/constant 微调)
2. 简单页/列表用 **frame 布局**(当约束超过收益的时候)
3. 文本密集的用**预排版缓存**(TextKit 预先算好),Image 异步解码
4. 分析:Instruments **Layout** 轨、os_signpost 打布局耗时,定位"哪个视图在哪一轮 pass 上耗时"`,
  },
  {
    t: 'UIViewController 的完整生命周期顺序?',
    lv: 1, fq: 3, tags: ['生命周期', 'viewDidLoad'],
    opt: ['viewDidLoad 每次视图出现都会调用', 'loadView → viewDidLoad → viewWillAppear → 布局 → viewDidAppear', 'viewWillAppear 只会调用一次', 'viewDidLoad 中能拿到最终的 frame'],
    ans: 1,
    key: ['loadView → viewDidLoad → willAppear → willLayout → didLayout → didAppear → willDisappear → didDisappear', 'dealloc/Scene 相关是另一轨'],
    a: `**单页面次序**:

\`init/load\` → \`loadView\`(自建 view 用,不重写默认 nib/建 root)→ \`viewDidLoad\`(一次性初始化,数据/子视图) → \`viewWillAppear\`(导航条状态、轻量刷新) → \`viewWillLayoutSubviews\` → \`viewDidLayoutSubviews\` → \`viewDidAppear\`(启动动画、懒任务、埋点) → \`viewWillDisappear\`(存草稿) → \`viewDidDisappear\` → \`deinit\`

**追问入口**:

- **viewDidLoad 与 viewDidAppear 的分工**:首帧数据在 didLoad(拉缓存兜底);曝光埋点/启动渲染损耗大的任务放 didAppear
- **布局后修改 frame 要在 didLayout 之后**,否则被覆盖
- **viewIsAppearing**(iOS 13+):accurate 转场时间点的回调,于 will/did 之间更精准
- Scene 下还有 scene-level 生命周期,别与 VC 混在一起`,
  },
  {
    t: 'App 的生命周期与状态?前后台切换时哪些回调被触发?',
    lv: 1, fq: 2, tags: ['App 生命周期', 'SceneDelegate', '后台'],
    key: ['Inactive → Active → Background → Suspended,前后台切换各自有 Delegate/Scene 回调', '挂起前用 beginBackgroundTask 争取收尾时间'],
    a: `**五个状态**:Not Running(未启/被杀) → Inactive(前台不响应,如转场中) → **Active**(前台正常) → **Background**(可执行代码,默认几秒) → **Suspended**(冻结,随时被 jetsam)

**老 AppDelegate 回调**(\`applicationDidBecomeActive/WillResignActive/DidEnterBackground/WillEnterForeground/WillTerminate\`),**iOS 13+** 多窗口分流到 **UISceneDelegate**(\`sceneDidBecomeActive/sceneWillResignActive/sceneDidEnterBackground...\`),通知中心平行提供 \`didBecomeActiveNotification\` 等。

**后台策略**:

- \`beginBackgroundTask(expirationHandler:)\` 申请延长后台执行(一般 30 秒上下),保存、上传、事务收尾都靠它
- 每类后台能力要 Info.plist 声明(audio、location、fetch、processing)
- **BGTaskScheduler** 处理长耗时低优先任务,系统按窗口调度;**iOS 26** 加入 \`BGContinuedProcessingTask\`

**SwiftUI**:\`@Environment(\\.scenePhase)\` 是 SwiftUI 原生的生命周期观察位。`,
  },
  {
    t: '手势识别器和 touches 方法的优先级?手势冲突怎么处理?',
    lv: 2, fq: 2, tags: ['手势', 'UIGestureRecognizer', '冲突'],
    key: ['手势先识别:期间 touches 发给视图,识别成功后视图收 touchesCancelled', 'delegate / require(toFail:) 化解冲突'],
    a: `**工作机理**:触摸序列先送 **UIGestureRecognizer 链**;识别器**分析中**时,touches 正常派给 hit-test 视图;一旦识别**成功**,系统给视图发 \`touchesCancelled\`,手势的 action 接管后续;识别**失败**,视图恢复 touches。

**冲突解决的三个工具**:

1. **delegate 方法**:\`gestureRecognizer(_:shouldRecognizeSimultaneouslyWith:)\` 允许两个手势**同时**生效;\`shouldRequireFailure(of:)\` / \`shouldBeRequiredToFail(by:)\` 明确前后依赖
2. **require(toFail:)**:双边滑动手势要求失败后才识别单边,典型如三指截图与三指编辑
3. **命中范围与 target-action**:对 UIScrollView 的 \`delaysContentTouches\`/\`canCancelContentTouches\`,控制滚动与子按钮的拉扯

**响应链联动**:命中测试与手势评价叠加,自定义不规则视图(如环形进度条)经常**重写 pointInside 缩小命中** + \`require(toFail:)\` 做出干净的手感。`,
  },
  {
    t: '图像解码发生在什么时候?为什么 decode 是主线程隐藏杀手?',
    lv: 3, fq: 3, tags: ['图片解码', 'decode', 'ImageIO'],
    opt: ['UIImage(data:) 时立即完成解码', '默认懒解码,真正解码发生在首次渲染时且在主线程', '解码总是在后台线程自动进行', '解码耗时与图片文件体积成正比'],
    ans: 1,
    key: ['UIImage 是懒解码:第一次绘制时才解压,默认主线程', '优化:子线程强制解码或 ImageIO 缩略解码,缓存解码后的位图'],
    a: `**解码时机**:\`UIImage(data:)\` 拿到的是**压缩数据包**,**不解码**。真正把 JPEG/PNG 解压成 RGBA 位图发生在**第一次把它画进 context / 贴上 layer.contents 时**,默认就在主线程的帧预算里。一张 4000×3000 的图解码 ≈ 48MB 位图 + 数毫秒解压,**一帧就爆**。

**正确姿势**:

1. **子线程预解码**:用 \`UIGraphicsImageRenderer\` 画进位图 context 强制解压,再回主线程赋值(iOS 15+ 可用 \`UIImage.PreparationConfiguration\` / \`preparingForDisplay\`)
2. **ImageIO 下采样**:\`CGImageSourceCreateThumbnailAtIndex\` 按显示尺寸解码缩略图,一步到位省内存又省时(详见内存管理的降采样题)
3. **缓存解码后的位图**(不是原图),在 cell 复用时终止未完成任务

**纹理层**:\`CATiledLayer\` 用于超大图源分块加载(地图/巨幅海报),不是列表场景。

**坑预警**:\`contentsOfFile\` 的图像 UIImage 不带系统缓存,而 \`UIImage(named:)\` 有共享缓存,列表海量高频用前者+自维护 LRU 更可控。`,
    deep: `**追问:ImageIO 与 Core Graphics 的解码路径有什么区别?**

ImageIO(\`CGImageSource\`)支持**流式/增量解码**、EXIF 处理、色彩管理,系统组件(相册、Safari)标准用法;Core Graphics 的 \`CGImageJPEG/JPEG->CGImage\` 是一次性解码入口。网络图片解码最实用的是 ImageIO 缩略图 API。`,
  },
  {
    t: 'UIView 动画里 setNeedsLayout 与 layoutIfNeeded 怎么配合?',
    lv: 2, fq: 3, tags: ['setNeedsLayout', 'layoutIfNeeded', '动画'],
    opt: ['setNeedsLayout 会立即同步执行布局', 'setNeedsLayout 只打脏标记,layoutIfNeeded 才立即同步布局', '两者完全等价', '动画中应该调用 setNeedsLayout 而非 layoutIfNeeded'],
    ans: 1,
    key: ['setNeedsLayout 打脏下一循环统一布局;layoutIfNeeded 立即同步执行布局', '动画 = 改约束 → animate { layoutIfNeeded() }'],
    a: `**分工**:

- \`setNeedsLayout\`:**打脏标记**,下一个 layout pass(runloop BeforeWaiting 前)统一处理,**异步批量**,返回后视图 frame **还没变**
- \`layoutIfNeeded\`:**立即**检查脏标,有则**同步**执行 layoutSubviews 链,无则什么都不做

**动画的标准姿势**:

\`\`\`swift
widthConstraint.constant = 240          // 1. 修改约束(这会自行 setNeedsLayout)
UIView.animate(withDuration: 0.3) {
    self.view.layoutIfNeeded()          // 2. 在动画闭包里"播出"布局变化
}
\`\`\`

闭包外的 setNeedsLayout 保证"脏",animate 内的 layoutIfNeeded 让 frame **在动画块内一步跳完终点**,UIKit 把这一跳捕捉成动画插值。

**误区**:

- 在动画闭包里写**改约束 + 不 layoutIfNeeded**:过程不可见,直接跳变
- 在 \`layoutSubviews\` 里再 \`setNeedsLayout\`:布局风暴,嵌套无穷轮

**SwiftUI 的对位**:\`withAnimation { state = newValue }\` 同样捕捉"赋值的当口",把新状态绘制成动画。`,
  },
  {
    t: 'draw(_:) (drawRect) 什么时候调用?高性能绘图要注意什么?',
    lv: 3, fq: 2, tags: ['drawRect', 'Core Graphics', '异步绘制'],
    key: ['首次显示/setNeedsDisplay 后下一个循环;禁止手动直接调用', 'drawRect 应极简;重活异步绘制到位图再贴'],
    a: `**触发时机**:视图**首次显示**、\`setNeedsDisplay()\` 后的**下一个 layout pass**、frame 变化且 \`contentMode = redraw\` 时,系统设置好 \`UIGraphicsGetCurrentContext()\` 后回调。**自己直接调 drawRect 不被允许**(没有上下文,行为未定义)。

**性能注意**:

- drawRect 是 CPU 绘制,**逻辑务必极简**(少 for 循环、少对象、复用 CGPath/格式化器),一复杂就是掉帧
- 频繁重绘用**缓存位图**:\`layer.shouldRasterize\`(静态复杂层)或手动画一张存到 contents
- **异步绘制**:在**子线程**自建 \`UIGraphicsImageRenderer\` 渲一张图,主线程 \`layer.contents = image\`,这是 Texture/YYAsyncLayer 等框架核心思想,使滚动列表 CPU 下的压力转移到后台
- 小的精细图形(曲线、箭头)用 \`CAShapeLayer\` 交给 GPU 合成,通常比 drawRect 划算

**趋势**:自定义图形 SwiftUI 用 \`Canvas\` / Shape,记录式 API,引擎自动做更合适 pipeline。`,
  },
  {
    t: '隐式动画与显式动画的区别?CATransaction 是干嘛的?',
    lv: 3, fq: 2, tags: ['隐式动画', 'CATransaction', 'Core Animation'],
    key: ['显式:CAAnimation 加给 layer;隐式:改可动画属性自动按事务参数动画', 'CATransaction 聚合一次提交的所有 layer 变更与动画参数'],
    a: `**隐式动画**:直接改 CALayer 的**可动画属性**(position/opacity/transform...),Core Animation 自动创建一段 CABasicAnimation 按**当前事务**(隐式 \`CATransaction\`)的时长/曲线执行;**UIView 的 root layer 默认关闭隐式动画**(由 \`UIView.animate\` 接管)。

\`\`\`swift
CATransaction.begin()
CATransaction.setAnimationDuration(0.5)
layer.opacity = 0.3          // 隐式动画 0.5s
CATransaction.commit()
\`\`\`

**显式动画**:自己创建 \`CAAnimation\`(CABasicAnimation/CAKeyframeAnimation/CASpringAnimation)\`add(_:forKey:)\`,完全控制。

**CATransaction 的作用**:一次 runloop 内的**所有 layer 改动归并为一个事务**,BeforeWaiting 提交,**保证一致性与原子性**;它还统一管理 duration、timingFunction、completionBlock、以及 \`CATransaction.setDisableActions\` 临时关隐式动画给"无动画即时生效"。

**常踩坑**:\`removedOnCompletion=false + fillMode=forwards\` 让模型层停留在动画终态,逻辑值与展示值分裂,**最好动画完成同步模型值**而不是靠 fillMode。`,
  },
  {
    t: 'UICollectionView 和 UITableView 如何选型?CompositionalLayout 强在哪?',
    lv: 2, fq: 2, tags: ['UICollectionView', 'CompositionalLayout', 'List'],
    key: ['简单纵向列表 TableView 够了;复杂网格/横向/混合布局用 CollectionView + CompositionalLayout', 'DiffableDataSource 解决增删动画与一致性'],
    a: `**选型**:

- **UITableView**:竖排单列、行高固定或自适、分隔线,够用就它,配置门槛低
- **UICollectionView**:网格、瀑布流、横向分页、**多 section 混合布局**(顶部 banner+瀑布+横向滑动同一页面),布局抽象为 UICollectionViewLayout,可插拔

**CompositionalLayout(iOS 13+)的革命**:

- **声明式**:Item → Group → Section 三层嵌套,用分数(\`fractionalWidth/Height\`)表达尺寸,**再也不手算 contentSize 与滚动逻辑**
- 每 section 独立滚动方向/分页(\`orthogonalScrollingBehavior\`)、补充视图(背景/角标)
- 配合 **DiffableDataSource + NSDiffableDataSourceSnapshot**:声明数据源为 snapshot,apply 自动 diff 出动画,**告别 beginUpdates/endUpdates 崩溃**

**典型架构**:Feed 流主页 = \`UICollectionViewCompositionalLayout\` + Diffable + Prefetch;当页有重型 cell(视频)时,布局组上组合 estimated 尺寸,预排版提升滑顺。`,
  },
  {
    t: 'UITableView 性能优化的完整清单?',
    lv: 2, fq: 3, tags: ['列表优化', '性能'],
    opt: ['只要开启 cell 复用就不会卡顿', 'CPU 侧预计算高度与异步排版,GPU 侧消灭离屏渲染与混合,配合预取与降级', '增大 cell 数量能提升滚动流畅度', 'Auto Layout 在任何场景都比 frame 快'],
    ans: 1,
    key: ['高度预计算、复用与复位、图片链路的解码缓存、预取与取消、降级策略', '步骤:先 CPU 后 GPU,先量化再优化'],
    a: `**CPU 侧**:

1. **高度预计算 + 缓存**(不等高时首滑卡顿主要源),配合 correctly 的 \`estimatedRowHeight\`
2. **文本预排版**:富文本/链接布局在子线程做好传模型,\`UILabel.attributedText\` 不再在主线程算
3. **对象复用**:日期/格式化器、NSAttributedString 键等缓存,\`draw(_:)\` 内禁 alloc
4. **复用到位**:\`prepareForReuse\` 复位可变状态 + **取消挂起任务**(异步加载回调必须校验 indexPath)

**GPU 侧**:

5. 消灭**离屏渲染**(圆角预切图、shadowPath)、**减少混合层**(opaque + 背景同色)
6. 图片尺寸匹配显示尺寸,**子线程解码压缩图**

**链路时效**:

7. **prefetch**(UITableViewDataSourcePrefetching):滑动方向提前 N 格**拉数据 + 预解码**
8. 滑动中暂停非必要工作(RunLoop UITracking mode 利用),快速滑动**降级**(低清图/简版 cell)

**衡量**:先 CADisplayLink FPS / Instruments 量化,再动代码,别拍脑袋优化。`,
  },
  {
    t: '子视图超出父视图 bounds 还能响应事件吗?怎么实现?',
    lv: 2, fq: 2, tags: ['hitTest', '事件链', '扩大响应'],
    key: ['默认不能:pointInside 在父层就 false,子树不被遍历', '父视图重写 hitTest 或 pointInside,把响应"让渡"给子视图'],
    a: `**默认不能**。事件传递是**先问父再问子**:父视图 \`pointInside\` 为 false,**整棵子树都不会被遍历**,就算子视图内容溢出 bounds 也摸不到。

**两种实现**:

**方案一:父视图重写 hitTest,把命中指到子视图**

\`\`\`swift
override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
    let p = convert(point, to: popupButton)
    if popupButton.bounds.contains(p) { return popupButton }
    return super.hitTest(point, with: event)
}
\`\`\`

**方案二:扩大父视图 pointInside 判定**(\`bounds.insetBy(dx: -x, dy: -y)\`),让"溢出区"也算父视图内,子视图再走默认链。扩大按钮点击区同理。

**注意**:

- \`clipsToBounds = true\` 截掉显示但**不影响**逻辑响应,响应取决 hitTest,不是裁剪
- SwiftUI 里用 \`.contentShape()\` + \`.hitTesting(false)\`/allowsHitTesting 做等效控制

**响应链思想**:这是"责任链模式"的系统实现,同思想还用来做**全屏错误树/调试悬浮球**的静默转发。`,
  },
  {
    t: 'cell 异步加载图片出现"错位/串台"的原因和解决?',
    lv: 2, fq: 3, tags: ['复用', '异步加载', '图片错位'],
    opt: ['UITableView 的 bug,无法避免', '回调返回时 cell 已被复用给别的行,需校验绑定标识并在 prepareForReuse 取消任务', '只要加大缓存就能解决', '把图片加载放主线程即可解决'],
    ans: 1,
    key: ['回调回来时 cell 已被复用给别行,旧任务把图写给了新行', '回调校验 indexPath/绑定 id + prepareForReuse 取消任务'],
    a: `**根因**:cell 出屏复用时,它挂着的下载/解码任务**还没完成**;任务完成时,这个 cell 已经在给另一行服务,旧任务的回调**把旧 URL 的图贴到了新行上**。

**三件套解决**:

1. **回调前校验**:模型绑定 **url/token**,任务完成时比较回调 url 与当前 cell 绑定的 url 是否一致,不一致直接丢弃
2. **复用时取消**:\`prepareForReuse\` 里取消挂起任务 + 清占位图
3. **缓存命中直填**:命中内存缓存**同步**设置(无闪烁);未命中再异步,失败给占位图

\`\`\`swift
func configure(with model: Model) {
    imageView.image = placeholder
    let token = loader.load(model.url) { [weak imageView, weak self] img in
        // 校验:任务对应模型仍是当前模型
        guard self?.currentToken == token else { return }
        imageView?.image = img
    }
    currentToken = token
}
override func prepareForReuse() {
    super.prepareForReuse()
    currentToken?.cancel(); currentToken = nil
}
\`\`\`

**踩坑变体**:diffable 数据源 snapshot 复用时类似问题,SDWebImage/Kingfisher 都是这套思路,阅读它们的 \`UIImageView+WebCache\` 是超高性价比源码题。`,
  },
]);
