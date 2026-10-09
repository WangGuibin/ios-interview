/* iOS 题宝库 · data/memory.js:内存管理(ARC、循环引用、排查) */
'use strict';

QB.add({
  key: 'memory', name: '内存管理', icon: 'cMemory', tint: '#F0A13C',
  desc: 'ARC 原理、循环引用、autoreleasepool 与排查工具链',
}, [
  {
    t: 'ARC 的工作原理?和 GC 相比优劣?',
    lv: 1, fq: 3, tags: ['ARC', 'GC', '引用计数'],
    opt: ['ARC 在运行时扫描对象图回收垃圾', 'ARC 由编译器在编译期插入 retain/release,计数归零即刻释放', 'ARC 能自动解决循环引用', 'ARC 有 STW 停顿'],
    ans: 1,
    key: ['编译期自动插桩 retain/release,计数归零即时释放', '对比 GC:无 STW 停顿、确定性释放;但解不了循环引用'],
    a: `**ARC(自动引用计数)**:编译器在编译期分析对象生命周期,自动插入 \`retain/release/autorelease\`;运行期每个对象带引用计数,**计数归零立即释放**,时机确定。

| 对比 | ARC | 追踪式 GC(Java/JVM) |
|------|-----|---------------------|
| 工作时机 | 编译期插桩,运行期确定性释放 | 运行期扫描,不定期回收 |
| 停顿 | 无 STW(单线程计数原子操作) | 有 STW 停顿,内存水位要求高 |
| 循环引用 | **解决不了**,靠 weak/unowned 手动破环 | 可达性分析,孤立环也能回收 |
| 内存冗余 | 峰值低 | 需要 2-5 倍冗余空间换吞吐 |

**ARC 解决不了的**:

- 循环引用(对象间互相强引用,计数永不为 0)
- CoreFoundation / malloc 出的非 ObjC 内存要自己 \`CFRelease/free\`
- 不告诉你"谁引用了我",排查靠工具(Memory Graph)`,
  },
  {
    t: '循环引用的三种典型场景与解法?',
    lv: 1, fq: 3, tags: ['循环引用', 'retain cycle', 'delegate'],
    opt: ['循环引用只会发生在闭包中', '闭包互持、delegate 用 strong、Timer 持有 target 是三大高发场景', 'ARC 会自动打破循环引用', '用 unowned 一定比 weak 安全'],
    ans: 1,
    key: ['闭包、strong delegate、Timer 持有 target 是三大高发区', '排查:Xcode Memory Graph 紫色感叹号'],
    a: `**1. 闭包环**:self 持有闭包属性,闭包捕获强 self → \`[weak self]\` + \`guard let self\`

**2. delegate 写成 strong**:对象持有 delegate,delegate 又持有对象 → delegate 一律 \`weak var delegate\`(注意 Swift 协议要 \`: AnyObject\` 才能 weak)

**3. Timer / CADisplayLink**:\`Timer.scheduledTimer(target:)\` 会强持 target,target 又持有 timer → 闭包版 API + \`[weak self]\`,或 NSProxy 中间代理阻断强引用链;不用时 \`invalidate()\`

**系统预防手段**:

- NotificationCenter block 观察者要用返回 token 移除(iOS 9+ selector 版已无野指针问题)
- URLSession delegate 强持 session,完成时 \`finishTasksAndInvalidate()\`

**排查工具**:Xcode **Memory Graph Debugger**(紫色 ⚠️ 即泄漏环,可查引用链)、Instruments Leaks / Allocations、开发期 Hook 类工具 MLeaksFinder、Facebook 的 FBRetainCycleDetector。`,
  },
  {
    t: 'Timer 造成的循环引用怎么破?',
    lv: 2, fq: 3, tags: ['Timer', 'NSProxy', '循环引用'],
    opt: ['把 timer 声明为 weak 即可解决', '用闭包版 API + [weak self],或 NSProxy 弱持 target,并记得 invalidate', 'Timer 不会造成循环引用', '只要在 dealloc 里 invalidate 就够了'],
    ans: 1,
    key: ['Target 版 Timer 强持 target → 闭包版或 WeakProxy', 'invalidate 的线程要与创建线程一致(同 runloop)'],
    a: `**方案一(推荐):闭包版 API + weak**

\`\`\`swift
timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
    self?.tick()
}
// 且在 deinit / 离开页面时 invalidate()
\`\`\`

**方案二:中间代理(NSProxy 弱持 target)**

\`\`\`swift
final class WeakProxy: NSObject {
    weak var target: NSObjectProtocol?
    init(_ t: NSObjectProtocol) { target = t }
    override func forwardingTarget(for aSelector: Selector!) -> Any? { target }
}
Timer.scheduledTimer(timeInterval: 1, target: WeakProxy(self), selector: #selector(tick), userInfo: nil, repeats: true)
\`\`\`

Timer 持有 proxy,proxy 弱持 self,环断。

**其他细节**:

- \`CADisplayLink\` 同样的问题,同样的解法
- \`invalidate()\` 必须在创建它的**同一线程**(同一 runloop)调用,否则无效
- 页面 pop 时 timer 还在跑是典型泄漏,放进 deinit 检验`,
  },
  {
    t: 'weak 指针的实现原理?对象释放后为什么会自动变 nil?',
    lv: 3, fq: 3, tags: ['weak 原理', 'SideTable', 'weak 表'],
    opt: ['weak 指针本身带有标志位,访问时检查', 'runtime 维护 weak 表,对象 dealloc 时把登记的 weak 指针逐个置 nil', 'weak 会让引用计数 +1 但不持有', 'weak 变量由编译器每次访问时判空'],
    ans: 1,
    key: ['SideTable 中的 weak 表:对象地址 → weak 指针列表', 'dealloc 时遍历 weak 表逐个置 nil'],
    a: `OC 的 weak 不是"软指针",而是 runtime 维护的一张**全局弱引用表**:

1. 给对象建立 weak 引用时,runtime 把**(对象地址, weak 指针地址)** 注册进该对象所属 **SideTable** 的 \`weak_table\`(按对象地址哈希,回收 weak_entry_t 数组,容量动态扩)
2. 对象 dealloc 过程中(\`clearDeallocating\`),runtime 查 weak 表,把登记在册的**所有 weak 指针逐一写 nil**,然后注销 weak_entry

**Swift 的差异**:Swift 对象的 weak 实现基于 SideTable;Swift 5 之后原生 Swift 对象也可以用 inline refcount(引用计数编码进对象的 \`refcounts\` 字段),只有**创建第一个弱引用或计数溢出时**才分配 Side Table。理解层面话术:引用计数存对象头(nonpointer isa 或 SideTable),weak 表存"哪些指针要在对象死时清零"。

**联动考点**:Tagged Pointer 没有堆对象,\`weak\` 不适用;\`unowned\` 免置零但靠僵尸检查兜底。\`nonpointer isa\` 里的 \`has_sidetable_rc\`、\`weakly_referenced\` 标记位会随之变化。`,
  },
  {
    t: '什么是 Tagged Pointer?解决了什么问题?',
    lv: 3, fq: 2, tags: ['Tagged Pointer', 'NSNumber', '64 位'],
    key: ['小对象把值直接编码进指针,零堆分配、零引用计数', '64 位下 NSNumber/NSDate/短 NSString 命中,iOS 用最低位标记'],
    a: `**Tagged Pointer**:64 位下,对于值足够小的对象(NSNumber、NSDate、较短的 NSString),把**值本身和类型标记直接编码进指针**,不再分配堆内存。

**带来的收益**:

- 创建/销毁零 malloc、零引用计数操作,速度快三倍以上,内存峰值下降
- 传参、消息发送与真对象一样的接口,透明无感

**识别与坑**:

- iOS/ARM64 用**最低位**(macOS x86_64 用最高位)标记是否为 Tagged Pointer;\`isTaggedPointer()\`
- 因为引入了对指针内容的解码,TAG 值会被随机化混淆防信息泄漏,**不能再拿指针值当 hash 用**(比如服务端用对象地址做 key 的场景会翻车)
- Tagged Pointer 没有 isa 指针,不会进 weak 表,不能用 \`weak\`

**考点联动**:nonpointer isa(优化引用计数)→ Tagged Pointer(直接消灭对象)→ 二者都是 Apple 在 64 位做对象模型减负的连贯思路。`,
  },
  {
    t: '什么时候需要手动写 autoreleasepool?',
    lv: 2, fq: 3, tags: ['autoreleasepool', 'RunLoop', '峰值内存'],
    opt: ['任何时候都不需要,ARC 会处理', '循环内大量创建 OC 临时对象时,用它压低内存峰值', '只有主线程需要手动加', '纯 Swift 值类型循环也必须加'],
    ans: 1,
    key: ['循环内大量产生临时 autorelease 对象时压低峰值', 'Swift 纯值类型无此问题,涉 OC 桥接时才需要'],
    a: `**\`@autoreleasepool\`** 的作用域结束时,池内注册的 autorelease 对象统一收到 \`release\`。系统每次 runloop 循环在外层就包了一个池(BeforeWaiting 时 pop + push),所以平时无感。

**需要手动包的场景**:

\`\`\`swift
for imageURL in thousandsOfURLs {
    autoreleasepool {
        let image = process(imageURL)   // NSString/UIImage 等 OC 桥接临时对象
        save(image)
    }   // 本圈临时对象立刻释放,内存峰值不涨
}
\`\`\`

典型触发:大规模遍历里使用 \`NSString\` 格式化、\`UIImage(contentsOfFile:)\`、\`Data\` 桥接、JSONSerialization 中间对象。

**量化记忆**:不包池,峰值 ≈ 单次迭代临时对象 × 迭代直到 runloop 空闲才回落;包了池,峰值 ≈ 单次迭代临时对象。

**Swift 的边界**:纯 Swift 值类型没有 autorelease 概念,这道题只对 OC 桥接 API 和旧 OC 代码有意义,面试要说清楚这个适用域,别万能化。`,
  },
  {
    t: '为什么 OC 中 NSString 属性推荐用 copy 修饰?',
    lv: 1, fq: 3, tags: ['copy', 'NSString', '@property'],
    opt: ['copy 比 strong 性能更好', '防止外部传入 NSMutableString 后在你不知情时修改内容', 'copy 可以避免循环引用', 'NSString 不能用 strong 修饰'],
    ans: 1,
    key: ['防御外部传入 NSMutableString 后续被改', 'copy 对不可变对象是浅拷贝(retain),对可变对象才真拷贝'],
    a: `**防御性拷贝**。属性的语义是"我声明一个不可变 NSString",但调用方完全可以传进来一个 \`NSMutableString\` 实例,之后再 mutate,你的"不可变"属性内容被悄悄改掉:

\`\`\`objc
NSMutableString *m = [NSMutableString stringWithString:@"a"];
obj.name = m;                // strong 只加了引用计数
[m appendString:@"b"];       // obj.name 也变成了 "ab"
\`\`\`

用 \`copy\`,赋值时对传入对象发 \`copy\` 消息:

- 传入不可变对象:返回**同一对象**(优化的浅拷贝,等同 retain)
- 传入可变对象:返回一个新的**不可变浅拷贝**

**对应规则**:集合类同理(\`NSArray\`/\`NSDictionary\` 防御 NSMutable 版本),而 block 属性用 \`copy\` 是为了把栈 block 提升到堆,ARC 下编译器多数场景已自动处理,但**声明处显式 copy 仍是清楚的所有权声明**。`,
  },
  {
    t: '内存泄漏怎么排查?说一套完整流程。',
    lv: 2, fq: 3, tags: ['Leaks', 'Memory Graph', '排查流程'],
    opt: ['只能靠 Instruments Leaks 一个工具', '静态分析 → Memory Graph 找引用环 → Instruments 看增长 → 线上 deinit 巡检', '内存持续增长就一定是泄漏', 'Memory Graph 只能在真机使用'],
    ans: 1,
    key: ['静态分析 → Memory Graph 找环 → Instruments 验增长 → 线上水位监控', '大对象先看图片解码,增长先看 VC 是否 deinit'],
    a: `**线下三板斧**:

1. **静态分析**:Product → Analyze,先扫明显的 retain cycle 与 CF 桥接泄漏
2. **Memory Graph Debugger**:运行中点击调试栏图标,左侧紫色 ⚠️ 标泄漏节点,选中对象右侧看**引用链**,定位"谁不该持有它";配合 \`Malloc Stack Logging\` 看分配堆栈
3. **Instruments**:Allocations 看增长曲线(反复进出页面只涨不降即泄漏),Leaks 模板抓无主内存,VM Tracker 看大页

**结构性定位技巧**:

- 页面类泄漏:在基类 VC 的 \`deinit\` 打日志,退出页面 3 秒未触发必泄漏
- 大对象:99% 是**解码后的位图**(宽×高×4 字节),先查图片链路与缓存上限
- 概率性:打开 MallocScribble / Guard Malloc 把"玄学崩溃"变必现

**线上**:MetricKit \`MXMemoryMetric\`、自研 VC 存活监控(deinit 巡检)、内存水位打点结合机型分桶报警。`,
  },
  {
    t: '什么是野指针?Zombie Objects 和 Address Sanitizer 的区别?',
    lv: 2, fq: 3, tags: ['野指针', 'Zombie', 'ASan'],
    opt: ['Zombie 和 ASan 可以同时开启', 'Zombie 抓 ObjC 消息野指针,ASan 抓 C/C++ 内存越界与 use-after-free', 'Zombie Objects 可以上线使用', 'ASan 只能抓内存泄漏'],
    ans: 1,
    key: ['ObjC 对象消息 → Zombie;C/C++ 内存读写 → ASan', '两个工具互斥,不能同时开'],
    a: `**野指针**:对象已释放,指针还指着旧地址,再次访问轻则崩溃(EXC_BAD_ACCESS)重则读到复用的脏数据。

**两类野指针对应两个工具**:

- **ObjC 侧:Zombie Objects**。开启后 dealloc 的对象**不真正释放**,isa 被替换成 \`_NSZombie_\`,再收到消息立刻抛出"message sent to deallocated instance",配合 MallocStackLogging 可用 \`malloc_history\` 反查谁在释放
- **C/C++ 侧:Address Sanitizer**。编译期插桩,free 后内存标记为 poisoned,任何读写立刻报 use-after-free,报告含 allocation/free/访问三段堆栈;也能抓越界读写

**注意**:两个工具**互斥不能同时开**(对内存布局的假设冲突);Zombie 抓不到 C 层野指针,ASan 对高度优化的 ObjC 消息路径可能误报大。上线前都关掉,生产环境用崩溃 SDK 兜底。`,
  },
  {
    t: 'App 的内存上限由什么决定?OOM(FOOM)怎么监控?',
    lv: 3, fq: 2, tags: ['OOM', 'jetsam', '内存水位'],
    key: ['jetsam 按机型 memorystatus 阈值强杀,无常规崩溃日志', '监控:启动标记比对 + footprint 打点 + 排除法归因'],
    a: `iOS 没有固定"每应用 X MB"的明文上限,实际由 **jetsam(memorystatus)** 机制按**机型与系统压力**动态判定:当整机内存紧张,按优先级从高到低杀进程,**前台 App 优先被保,但超过自身阈值也会被杀**,这就是 FOOM(Foreground Out Of Memory)。

**为什么难定位**:被 jetsam 杀的进程**不产生崩溃报告**,单据像"用户秒退"。

**监控思路(排除法)**:

1. 每次启动写标记,正常退出/崩溃清标记;下次启动标记还在 → 上次是**异常退出**
2. 排除 crash SDK 上报、Watchdog、用户强杀(后台时长/前台状态)后,剩余计为疑似 FOOM
3. 运行期打点 \`phys_footprint\` 水位(接近机型阈值时预警并主动释放缓存)

**治理方向**:大图降采样、缓存带容量上限 + 响应内存警告、分页加载、避免主线程携带大 buffer 跨页面。

**加分**:提一句 MetricKit 的 \`MXAppExitMetric\` 能拿到系统给出的一部分退出原因,比纯排除法更硬。`,
  },
  {
    t: '大图加载为什么容易爆内存?怎么处理?',
    lv: 2, fq: 3, tags: ['图片内存', '降采样', 'decode'],
    opt: ['内存占用等于图片文件大小', '解码后位图内存约等于 宽 × 高 × 4 字节,与文件大小无关', 'UIImage(data:) 会立即解码,所以峰值高', '压缩图片文件体积就能降低运行时内存'],
    ans: 1,
    key: ['内存 ≈ 宽×高×4 字节,与文件大小无关', 'ImageIO 按显示尺寸缩略解码,子线程预解码'],
    a: `**关键公式:解码后位图内存 ≈ 像素宽 × 像素高 × 4 字节(RGBA)**。一张 10000×10000 的图,内存是 **400 MB**,与 JPG 文件只有 2MB 毫无关系。

**配套事实**:\`UIImage(data:)\` 是**懒解码**,真正解码发生在第一次渲染(主线程!),所以大图既占内存又卡帧。

**处理套路**:

1. **降采样(downsample)**:用 ImageIO 按**显示尺寸**解码缩略图,内存从原图尺寸降到显示尺寸:

\`\`\`swift
let src = CGImageSourceCreateWithURL(url as CFURL, nil)!
let opts: [CFString: Any] = [
    kCGImageSourceCreateThumbnailFromImageAlways: true,
    kCGImageSourceThumbnailMaxPixelSize: 640,
    kCGImageSourceCreateThumbnailWithTransform: true,
]
let cg = CGImageSourceCreateThumbnailAtIndex(src, 0, opts as CFDictionary)
\`\`\`

2. **子线程预解码**:\`byPreparingForDisplay\`(iOS 15+ 的 \`UIImage.PreparationConfiguration\`)或自绘位图上下文强制 decode
3. **列表专用**:复用 cell 时取消未完成任务,缓存解码后的位图(不复用原图),滑出屏幕释放`,
  },
  {
    t: 'strong 和 copy 属性的语义差异?NSArray 属性应该用 copy 吗?',
    lv: 1, fq: 2, tags: ['@property', 'copy', 'strong'],
    key: ['strong 共享所有权,copy 赋值时拷贝', 'NSString/NSArray/NSDictionary/block 用 copy(防御可变版本)'],
    a: `- **strong**:赋值时引用计数 +1,与赋值方**共享同一对象**,对方改你也变(对象内部状态层面)
- **copy**:赋值时向对象发 \`copy\` 消息,把**不可变副本**持为己有

**经验法则**:
| 类型 | 修饰 |
|------|------|
| NSString / NSArray / NSDictionary / NSSet | **copy**(防御传入可变子类后被外部 mutate) |
| NSMutableArray / NSMutableString | **strong**(copy 会得到不可变副本,语义直接错) |
| block | **copy**(栈块提升到堆,ARC 下多数已由编译器处理,显式更稳) |
| 普通自定义对象 | strong |
| delegate / 数据源 | weak |

**联动陷阱**:对 NSMutableString 属性用 copy,运行后 \`appendString\` 直接崩(unrecognized selector),因为 copy 给出的是不可变对象,面试现场写这种找错代码经常出。`,
  },
  {
    t: 'Swift 与 OC 引用计数的实现有什么不一样?(SideTable / nonpointer isa)',
    lv: 3, fq: 2, tags: ['引用计数', 'nonpointer isa', 'InlineRefCounts'],
    key: ['64 位 isa 非纯指针:extra_rc 存小计数,溢出进 SideTable', 'Swift 原生类:引用计数独立 refcounts 字段,溢出或首个 weak 才建 Side Table'],
    a: `**ObjC:nonpointer isa**。64 位下 isa 不再是纯类指针,而是位域:

- \`nonpointer\`:是否启用优化 isa
- \`shiftcls\`:真正的类指针
- \`extra_rc\`:引用计数 - 1 的小计数区,计数小时**零额外内存**
- \`has_sidetable_rc\`:计数溢出后,溢出的计数搬到 SideTable
- \`weakly_referenced\`:是否被 weak 过(dealloc 时要清 weak 表)

**Swift:独立 refcounts 字段**。纯 Swift 类的对象头是 \`isa + InlineRefCounts\`,主要计数内联在对象里;只有**创建首个 weak 引用**(Swift 6 前)或计数溢出时才分配 Side Table 统一管理强/弱计数。

**面试怎么讲**:两者都在为"引用计数零额外内存"做设计;从 MRC 的 \`retainCount\` 方法,到 nonpointer isa 的位域,再到 Swift 的 InlineRefCounts,是一条"对象头卡片化"的演进线。

**注意**:已经 deprecated 的 \`retainCount\` 不是精确计数(受 autorelease 语义影响),真实项目里别拿它做判断。`,
  },
  {
    t: '值类型内嵌引用类型,拷贝时会发生什么?',
    lv: 3, fq: 3, tags: ['值语义', 'COW', '深浅拷贝'],
    key: ['浅拷贝:struct 逐位复制,引用成员的指针被复制指向同一对象', '这就是 COW 存在的意义;想要深拷贝需自定义'],
    a: `经典打印题:

\`\`\`swift
class Pet { var name: String; init(_ n: String) { name = n } }
struct Owner { var pet: Pet; var tag: Int }

var a = Owner(pet: Pet("汪"), tag: 1)
var b = a            // struct 拷贝
b.tag = 2            // 只影响 b,值语义 ✓
b.pet.name = "喵"    // a.pet.name 也变成 "喵"!
\`\`\`

**为什么**:struct 拷贝是**逐位(memberwise)复制**,引用类型成员复制的是**指针**,新旧 struct 的成员指向**同一只 Pet**。

**工程意义**:

- 对**模型层的影响**:值语义只保护值成员,引用成员仍是共享状态,跨页面/跨模块改数据时要意识到
- **标准库的做法**:Array/String 同样持有堆存储,靠 **COW + isKnownUniquelyReferenced** 在修改时先复制,这才让值语义成立
- **自定义类型想要"真值语义"**:同样实现 COW,或让引用成员只读(\`let\` 且对象不可变)

**追问入口**:多线程下同时写 a 和 b 的 pet 为什么不安全?答案:两个 struct 虽各自独立,但共享的 Pet 是单个实例,数据竞争照旧。`,
    opt: ['b.pet 和 a.pet 是两只独立的 Pet', 'b.pet.name 修改后 a.pet.name 不变', 'b.pet 与 a.pet 指向同一实例,a 会受影响', '编译错误,struct 不能包含 class 成员'],
    ans: 2,
  },
  {
    t: 'deinit 会在哪个线程执行?在 deinit 里做网络请求收尾合适吗?',
    lv: 3, fq: 2, tags: ['deinit', '线程', '收尾'],
    key: ['在"释放最后一个强引用"的线程同步执行', 'deinit 不能依赖 self 再发起异步工作,合适做的是资源归还'],
    a: `**线程**:deinit 不是"系统统一回收线程"调,而是在**引用计数归零的那次 release 发生的线程**上同步执行。所以假设"deinit 一定在主线程"是错的,在 deinit 里直接碰 UIKit / UserDefaults 某些全局状态前要确认线程语境。

**能/不能做什么**:

- **合适**:释放 C 内存、移除文件句柄、注销观察者、做泄露探测日志、归还池化对象
- **不合适**:发起新的异步网络请求/数据库事务(任务闭包无法持有正在销毁的 self,且对象语义上"已经死了"),也不应该依赖与别的对象的析构先后

**正确收尾模式**:要"销毁前异步落盘/上报"的需求,在对象**销毁前的显式生命周期点**(viewWillDisappear / logout / invalidate)启动收尾任务,deinit 只做最后的资源归还兜底。

**Swift 6 新点**:\`isolated deinit\`(SE-0371)让 deinit 可以隔离到 actor 执行,解决"deinit 要改 MainActor 状态但没机会"的历史痛点。`,
  },
  {
    t: 'NSNotificationCenter / NotificationCenter 的线程与释放注意点?',
    lv: 2, fq: 2, tags: ['NotificationCenter', '观察者', '线程'],
    key: ['通知在发送线程同步投递,iOS 9 后对象观察者不用手动移除', 'block 观察者的 token 记得 remove'],
    a: `**投递语义**:\`post\` 在**发送线程**上**同步**逐个调观察者(等价于一次消息广播),跨线程 UI 更新要自己切主线程;队列版 \`addObserver(forName:object:queue:using:)\` 的 \`queue\` 参数决定 block 回调队列。

**释放与移除**:

- **selector 观察者**(iOS 9 起):观察者是**弱持**的,对象销毁自动注销,不再需要 \`removeObserver\` 防崩,但语义上仍建议 deinit 里移除早收通知
- **block 观察者**:返回一个 token 对象,中心**强持**它,不用时必须 \`removeObserver(token)\`,否则反复注册会重复回调
- 通配 \`addObserver(name: nil)\` 的全局观察尤其容易忘记清,审计 notice 类型模块时优先搜

**架构站位**:通知是"一对多、弱类型、无返回值"的事件总线,跨模块广播可以,链式业务依赖不要滥用(难追踪、难测试),详细选型见架构部分的代理/通知/闭包对比题。`,
  },
  {
    t: '内存区域的堆/栈/全局/常量/代码段是怎么分工的?',
    lv: 1, fq: 1, tags: ['内存分区', '堆栈'],
    key: ['栈:局部值+函数帧,自动回收,快;堆:对象/手动内存,慢但灵活', '大 struct、逃逸捕获、集合缓冲实际都可能落堆'],
    a: `**经典五段**:

1. **栈(Stack)**:函数调用帧、局部值类型、指针本身;LIFO 自动回收,访问最快,每线程默认 512KB 到 1MB(主线程 1MB)
2. **堆(Heap)**:class 实例、闭包捕获、Array/Dictionary/String 的存储缓冲、malloc 内存;管理成本高,共享访问要同步
3. **全局/静态区(BSS + Data)**:全局变量、静态变量、lazy 初始化;生命周期跟进程
4. **常量区**:字符串字面量、只读数据
5. **代码段(Text)**:可执行指令,只读

**Swift 下的纠偏**:"struct 全在栈上"是过度简化。超过 existential container 内联容量、被逃逸闭包捕获、存进集合的值都会堆化;而"小对象在栈"的说法同样只在没有共享引用时成立。

**面试与实战的接点**:解释深/浅拷贝、解释 COW 为什么需要堆存储、解释多线程为什么堆是不安全的源头(共享可变状态都在堆)。`,
  },
]);
