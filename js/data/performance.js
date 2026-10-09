/* iOS 题宝库 · data/performance.js:性能与稳定性 */
'use strict';

QB.add({
  key: 'performance', name: '性能与稳定性', icon: 'cPerf', tint: '#E86B1C',
  desc: '启动优化、卡顿监控、崩溃治理、包体积',
}, [
  {
    t: 'App 启动流程分哪几个阶段?每段耗时怎么测?',
    lv: 2, fq: 3, tags: ['启动优化', 'dyld', '启动测量'],
    opt: ['dyld 阶段在 main() 之后执行', 'pre-main 包含 dyld 加载、rebase/bind、ObjC setup、+load', '启动时间只能用日志打点,无法用 Instruments', '冷启动和热启动耗时完全一样'],
    ans: 1,
    key: ['pre-main(dyld)→ main → didFinishLaunching → 首帧', 'pre-main 用 DYLD_PRINT_STATISTICS,业务段用 signpost/MetricKit'],
    a: `**两段式拆解**:

**pre-main(dyld 接管)**:

1. **装载**:解析可执行 Mach-O,加载依赖动态库(共享缓存外更慢)
2. **rebase**:ASLR 导致内部指针按实际加载地址滑动修正
3. **bind**:绑定外部符号(绑别的库函数)
4. **ObjC setup**:注册类/分类、selector 唯一化
5. **initializer**:C++ 静态构造、ObjC \`+load\`、属性段初始化

**main 之后**:

\`main → UIApplicationMain → will/didFinishLaunching → 首帧渲染出屏\`,这阶段是**业务初始化主场**。

**测量**:

- \`DYLD_PRINT_STATISTICS=1\`(环境变量,查 dyld 各阶段毫秒)
- **Instruments App Launch** 模板:整链路时间轴
- **os_signpost** 打点 + Xcode Metric Organizer / **MetricKit launchMetrics**(线上)
- 冷启动定义分歧要会报:**"进程创建 → 首帧" vs "didFinish → 首帧"**,团队内对齐口径

**优化入口**:动态库数量、+load 移除、首屏任务分级(马上要用/首帧后/用时再初始化)、二进制重排(见下题)。`,
  },
  {
    t: 'pre-main 启动优化有哪些手段?什么是二进制重排?',
    lv: 3, fq: 3, tags: ['pre-main', '二进制重排', 'page fault'],
    opt: ['二进制重排是加密代码段', '二进制重排按启动调用顺序排布符号,减少 page fault', 'pre-main 优化只能减少 +load', '动态库越多启动越快'],
    ans: 1,
    key: ['减动态库、合库、去 +load、OC 类瘦身、二进制重排', '重排:按调用顺序排符号,减少启动时 page fault 次数'],
    a: `**逐阶段治理**:

| 阶段 | 手法 |
|------|------|
| 加载 dylib | **减少动态库数量**(合并、内嵌改静态库;Apple 建议个位数);Apple 共享缓存优于自己内嵌 |
| rebase/bind | 减少 ObjC 类/分类的**符号与元数据**,Swift 值类型/函数派发静态化 |
| ObjC setup | 精简 Category、清理不用的类;重组阶段耗时与类数正相关 |
| initializer | \`+load\` 全部治理为 \`+initialize\` 或懒执行;C++ 静态构造挪进函数内 static |

**二进制重排(ogra 原理)**:

- App 的代码段按**虚拟内存页**加载,函数散落在几十页上,启动要执行 A→B→C→D 可能触发**十几次 page fault**(每次毫秒级,冷启动尤其疼)
- **做法**:用 \`-Wl,-order_file\` + 一个记录"启动路径上函数调用顺序"的 order file(用 Clang SanitizerCoverage 或 hook 采集),链接时把**启动会用的函数挤在相邻几页**内 → 冷启动 page fault 大幅下降
- 效果:低端机冷启动可省几十到几百毫秒,字节等大厂发布会公开过收益

**新版变量**:dyld 3/4 的启动闭包缓存、Swift concurrency runtime、Mergeable Libraries(Xcode 15+)都改变收益分布,以实测为准。`,
  },
  {
    t: 'main 之后的启动优化怎么做?首屏任务怎么分级?',
    lv: 2, fq: 3, tags: ['didFinishLaunching', '首屏', '任务编排'],
    opt: ['把所有 SDK 都放在 didFinishLaunching 同步初始化', '按首帧必需 / 首帧后并行 / 用时再初始化三级拆分启动任务', '首屏必须等网络配置返回才能渲染', '启动优化只需关注 pre-main'],
    ans: 1,
    key: ['首屏 = 首帧必需 + 并行异步,其它全懒初始化', 'SDK 三级分类:必需 / 首帧后 / 用时再启'],
    a: `**分级框架**(落地性强,直接抄):

1. **首帧必需**(串行最小集):路由注册表、首屏容器搭建、核心配置读取、必备 SDK(崩溃上报是入口级)
2. **首帧后立即**(并行异步):\`DispatchQueue.global\` / \`Task.detached\`:网络预热、AB 配置拉取、非首屏 SDK(统计、支付、推送),**互不阻塞首帧**
3. **用时初始化**(懒):相机、地图、音视频引擎、分享、电商支付渠道

**常见错误**:

- didFinishLaunching 里同步初始化十几个 SDK
- **同步等待网络配置**(AB 实验)阻塞首帧,应本地缓存兜底 + 后台刷新
- 首屏用到**未解码大图**:首帧前 decode 移到 main 后异步

**配套手段**:

- **首屏兜底**:骨架屏 + 本地缓存先渲染,数据回来再擦亮(信息流秒开的核心)
- **任务编排框架**:轻量的初始化 task DAG(依赖拓扑 + 并行),主流大厂都把启动任务做成了框架(淘宝 BeeHive、Swift 启动任务库)
- **度量闭环**:os_signpost 分段 + MetricKit + A/B 前后对比,先量化再优化`,
  },
  {
    t: '卡顿怎么监控?方案分线上线下各一套?',
    lv: 3, fq: 3, tags: ['卡顿监控', 'APM', 'RunLoop'],
    opt: ['只能靠用户反馈发现卡顿', '线下用 Instruments 与 FPS 探针,线上用 RunLoop 状态超时 + 子线程 dump 堆栈聚合', '卡顿监控必须在主线程写文件', 'MetricKit 无法提供 hang 数据'],
    ans: 1,
    key: ['线下:CADisplayLink FPS + Instruments Hitches;线上:RunLoop 状态超时 + 堆栈聚合', '阈值:hang>250ms(MetricKit 同口径)与连续掉帧'],
    a: `**线下(开发期)**:

1. **CADisplayLink FPS 探针**:每帧回调存时间戳,掉帧直接可见
2. **Instruments Animation Hitches / Hangs**:时间轴里直接指到哪个事务卡
3. **Main Thread Checker**:子线程碰 UI 实时报警

**线上(APM)**:

1. **RunLoop 状态监控**:observer 盯主线程 \`BeforeSources → BeforeWaiting\` 状态切换,超时(如连续 3 帧 50ms,单次 hang > 250ms)未走完→ 判定卡顿
2. **看门狗子线程**:超时后主线程 \`backtrace\` dump 堆栈,聚合归因(同一调用链堆栈聚合做火焰图)
3. **验证对照**:MetricKit \`MXHangDiagnostic\` 系统侧数据可以做基准对照(阈值 250ms 一致)

**落地要点**:

- 堆栈要**符号化**(dSYM)聚合到业务符号,别给 SIGABRT 归错路径
- 采样节流:滑动、视频、游戏场景采 1/N,低功耗状态不采样
- 版本监控:卡顿率按 **App 版本 × 机型 × 系统版本** 三维看,回归版本必填

**话术**:卡顿优化按"现象 → 度量 → 归因(工具) → 手段 → 数据回访"闭环,不是一次性斗法。`,
  },
  {
    t: '包体积优化手段?',
    lv: 2, fq: 3, tags: ['包体积', '瘦身', '资源优化'],
    opt: ['只要压缩图片就够了', '资源清理与压缩、无用代码剔除、泛型膨胀治理、动态库合并、按需资源 ODR', '动态库越多包体积越小', 'App Thinning 需要开发者手动切分'],
    ans: 1,
    key: ['资源压缩与清理、无用代码剔除、泛型膨胀治理、动态库合并、ODR 按需资源', '首重 App Store 瘦身报告,定期巡检设门禁'],
    a: `**资源侧**:

1. **无用资源清理**(LSUnusedResources、FengNiao)、同名多倍图合并(2x/3x 保一)
2. **压缩**:PNG → **HEIF/WebP**(系统原生支持);大资源走 **按需资源 ODR**(App Thinning)
3. Asset Catalog 充分用** slicing**(系统按设备只下发该机型资源)

**代码侧**:

4. **无用代码剔除**:基于 Mach-O 的类引用分析、dead strip、LTO、\`-Osize\`
5. **Swift 泛型膨胀**:热路径泛型**类型擦除**(\`AnyXXX\`)合并重复特化生成本体
6. **三方库审计**:功能重复库合并(多个图片库/多个家具库),重复 vendor C++ 库合并链接

**链接/构建**:

7. **动态库合并**与 **Mergeable Libraries**(包体积与启动的双赢,Xcode 15+)
8. Swift ABI 稳定性内部,**标准库已系统内置**(5.x 起),别复包 \`libswift\`

**运营闭环**:

- App Store **瘦身报告**每月定期巡检,设置大小 PR 门禁(CI 上 linkmap 对比)
- 对于**内部测包**保留全量,App Store 通道瘦身,Benchmark 用真机下载段`
  },
  {
    t: '崩溃捕获的原理?哪些崩溃抓不到?',
    lv: 3, fq: 3, tags: ['Crash 捕获', 'Mach 异常', 'signal'],
    opt: ['注册 NSSetUncaughtExceptionHandler 就能抓到所有崩溃', 'OC 异常与 Mach/signal 两层都要挂 handler;Watchdog、OOM、用户强杀抓不到', 'OOM 崩溃会产生标准崩溃日志', '在 handler 里可以安全地发网络请求'],
    ans: 1,
    key: ['NSException(OC 层未捕获)+ Mach 异常转 UNIX signal 两层 handler 都要挂', '抓不到:Watchdog 强杀、OOM、用户强杀、断电'],
    a: `**两类未捕获异常路径**:

1. **OC 层异常**:\`NSSetUncaughtExceptionHandler\` 收到 \`NSException\`(数组越界、unrecognized selector 类),还能拿到 objc 调用栈
2. **Mach 层异常 → UNIX signal**:\`EXC_BAD_ACCESS\`(野指针/越界)、\`SIGABRT\`(abort/断言)、\`SIGILL\` 等,用 \`sigaction\` 或 Mach exception handler 捕获;KSCrash/PLCrashReporter 的风格是**两层都注册**

**抓崩溃后的动作**:dump 各线程栈 + 寄存器 + 内存信息**写本地文件**(在 handler 内**只做 async-safe 操作**,不 alloc 不跑主线程代码,不网络);**下次启动**检查存在则上报 → 服务端聚合。

**抓不到的崩溃(要点!)**:

- **Watchdog**(\`0x8badf00d\`,启动/前后台超时)
- **OOM jetsam 杀**(EXC_RESOURCE),只有下次启动靠"排除法"归因 + MetricKit exit metrics
- **用户手动强杀**、断电、系统升级中重启
- **信号 handler 嵌套错误**(多个 SDK 覆盖注册),要链式保存上一个 handler 逐一调用

**配套**:符号化见下题;线上还会对冲崩溃率计算口径(启动数 vs DAU),面试要主动提口径。`,
  },
  {
    t: 'dSYM 是什么?怎么把崩溃地址符号化?',
    lv: 2, fq: 3, tags: ['dSYM', '符号化', 'atos'],
    opt: ['dSYM 是崩溃日志本身', 'dSYM 保存地址到函数与行号的映射,符号化必须用 UUID 匹配的那一份', '有 dSYM 就不需要崩溃日志', 'Release 包不需要保留 dSYM'],
    ans: 1,
    key: ['dSYM 里函数/行号与地址的映射,线上必须保留每个版本', 'atos -o dsym -arch arm64 -l 加载基址 地址 → 符号'],
    a: `**dSYM** 是打包时生成的**符号表文件**(DWARF 格式,Debug Information 把"二进制地址 → 函数/文件/行号"映射保存),剥离后的发布包里没有这些名字,**必须有 dSYM 才能读崩溃栈**。

**符号化公式**:\`符号 = 原始地址 - 加载基址 + 链接基址\`(slide),实操一句话:

\`\`\`bash
atos -o App.app.dSYM -arch arm64 -l 0x102a00000 0x0000000102a1b234
# → ClassName.method (File.swift:128)
\`\`\`

**生产链路**:

1. CI 打包**同时归档** dSYM(按 UUID 与 mach-o 匹配),上传 TestFlight/App Store 时同步
2. 崩溃 SDK 上报带**原始地址 + 二进制 UUID**,服务端用该版本的 dSYM 做集中符号化(比设备端准)
3. **bitcode 已废**:Xcode 14+ 不再需要苹果后端重编译,符号表可直接拿自己存的 dSYM

**典型坑**:dSYM 用错版本(UUID 不匹配就还原错位置)、Swift 内联函数栈丢失(可开 DebugSymbolsLevel)、C++ 帧见 ABI 去混淆。`,
  },
  {
    t: 'Watchdog 超时的原理?怎么规避?',
    lv: 2, fq: 2, tags: ['Watchdog', '0x8badf00d', '主线程'],
    key: ['系统监视主线程 RunLoop,启动 ~20s/切换 ~10s 未完成即强杀', '规避:主线程零 wait、重活后台化、SDK 懒加载、锁临界区缩短'],
    a: `**机制**:系统运行一个 "watchdog",盯**主线程 RunLoop 的心跳**:启动场景约 20 秒(前/后台切换约 10 秒)内不能完成一轮 runloop 循环或相应的状态迁移,就 \`SIGKILL\`,崩溃码形如 \`0x8badf00d\`("ate bad food")。

**高发场景**:

- 启动时 \`didFinishLaunching\` **同步**初始化 SDK / 数据库迁移 / 打开巨大的 UserDefaults
- 主线程**等锁/信号量**(尤其又争优先级反转)
- 主线程**大 JSON / 大图解码**、大文件 IO 直接跑
- 后台挂起时长任务没走 \`beginBackgroundTask\`,挂起时还在写

**规避**:

1. **主线程零 \`wait/sleep/sync\`**(拿铁锤三个字:不能有)
2. 重活 \`Task.detached\` / \`DispatchQueue.global\`;SDK **分级懒加载**
3. 锁的**临界区缩小**,重新设计避免"主线程需要后台锁"的反依赖(QoS 提升者)
4. 监控:**MXHangDiagnostic**、子线程 ping 主线程的无响应检测栈

**连接**:卡死和卡顿的根处也是这些习惯处置,只是把"超过阈值"换成了"超过 watchdog 事件窗口"。`,
  },
  {
    t: 'Zombie、ASan、Guard Malloc、MallocStackLogging 的分工?',
    lv: 2, fq: 2, tags: ['Zombie', 'ASan', '调试'],
    key: ['Zombie 抓 ObjC 消息野指针;ASan 抓 C/C++ 越界与 use-after-free', 'MallocStackLogging 记分配栈,malloc_history 反查谁释放'],
    a: `**调试武器库**:

| 工具 | 管什么 | 成本 |
|------|--------|------|
| **Zombie Objects** | dealloc 后改 isa 为 \`_NSZombie_\`,再发消息即抛 instance | 对象不真释放,内存高,只适合 debug |
| **AddressSanitizer** | 编译期插桩:C/C++ 堆越界、use-after-free、栈溢出等 | 运行时 2-3 倍内存,red zone 检查 |
| **Guard Malloc** | 每 malloc 后面加"保护页",写穿立刻崩在 breakpoint | 很慢,只在小规模复现用 |
| **MallocStackLogging** | 记每次分配堆栈,配合 \`malloc_history pid addr\` 反查 | I/O 多,Debug 场景 |
| **MallocScribble** | free 后内存填 0x55,**概率性**野指针变必现 | 内存语义被破坏,debug only |

**实战组合**:偶发 EXC_BAD_ACCESS 排查顺序:先开 **Zombie + MallocScribble**(让问题必现),Not reproducible → **ASan 全量跑** 看报告(allocation/free/access 三段栈),Fix 后 **Main Thread Checker + Thread Sanitizer** 兜线层。

**Swift 时代**:\`EXC_BREAKPOINT\`(可选强解、数组越界的 Swift runtime trap)帮你抓到的就是这些逻辑的显式失败,合理假设 Swift 崩必是**契约被违反**,别再只怪"内存"二字。`,
  },
  {
    t: '内存优化清单?OOM(FOOM)怎么治?',
    lv: 3, fq: 3, tags: ['内存优化', 'OOM 治理'],
    opt: ['内存占用主要来自代码段', '大头通常是解码后的位图与无上限缓存,其次是循环引用与 VC 未释放', 'OOM 会产生常规崩溃日志便于定位', 'NSCache 需要手动响应内存警告'],
    ans: 1,
    key: ['大头是解码后图像与缓存无上限,长罪是循环引用与 VC 不退', '治理:水位打点 + 图片降采样 + 缓存限上限 + 泄漏治理'],
    a: `**内存的组成**:Dirty 页(不可回收:堆对象、图像位图) / Clean 页(可重载:mmap 代码与只读文件) / Compressed。jetsam 主要盯**Dirty + Compressed** 水位。

**Main suspects(按发生频度排)**:

1. **图片解码后位图**:宽×高×4 与文件大小无关 → **降采样**、列表复用、出屏释放
2. **缓存无上限**:图片/JSON/数据模型缓存 → **NSCache + totalCostLimit**,磁盘 LRU + 容量额
3. **循环引用/VC 不释放**:Memory Graph 巡检 + deinit 日志(参见内存管理)
4. **WebView**:渲染在独立进程但计入主进程体验,不用时 \`WKContentRuleListStore\` / 移除容器
5. **大图文件 IO**:\`NSData(contentsOfFile:)\` 读大图 → Mmap 或流式 \`InputStream\`
6. **密集 moment 尖峰**:批量处理 \`autoreleasepool\` 围一圈(见内存管理)

**OOM 治理步骤**:

1. **归因先行**:启动标记排除法确定 FOOM 占比(见内存管理)
2. **水位打点**:\`phys_footprint\` 分场景记录,超过机型阈值 70% 主动释放缓存
3. **大图净化**:全面替换 \`UIImage(contentsOfFile:)\` 为 ImageIO 缩略解码
4. **缓存响应内存警告**:didReceiveMemoryWarning 清 L1,内存水位做比 cache 删除一条边
5. **复盘版本对比**:FOOM 率随版本/机型维度回溯

**干货**:jetsam 阈值没有官方表,以实测你的目标机型为基准(不同机型内存水位差异很大)。`,
  },
  {
    t: 'Instruments 各工具的分工:Time Profiler / Allocations / Leaks / Core Animation?',
    lv: 2, fq: 3, tags: ['Instruments', 'Time Profiler', 'Leaks'],
    opt: ['Leaks 可以发现所有内存问题', 'Time Profiler 找 CPU 热点,Allocations 看内存曲线,Leaks 抓泄漏,Core Animation 看渲染', 'Time Profiler 应在 Debug 构建下测性能', 'Instruments 只能在模拟器运行'],
    ans: 1,
    key: ['Time Profiler 找 CPU 热点;Allocations 看内存曲线;Leaks 抓泄漏;Core Animation 看渲染', '一切性能优化先量化,别拍脑袋'],
    a: `**常规武器**:

| 模板 | 看什么 | 典型动作 |
|------|--------|----------|
| **Time Profiler** | CPU 采样堆栈 | 找热点函数,逆调用树看主因;"Heaviest Stack Trace" |
| **Allocations** | 分配曲线 | 页面进出**只增不减**找泄漏;大对象归因 |
| **Leaks** | 无主内存 | Purple circle 即泄漏;后看引用链 |
| **Core Animation** | 渲染帧率 | 掉帧时刻定位,离屏/大纹理标记 |
| **App Launch** | 启动时间轴 | 从进程创建到首帧全链路 |
| **Energy Log / Power Profiler** | 耗电 | 看定位/网络/高 CPU 常驻 |

**使用心法**:

1. 采样数据要**规模**(信息量过低没信号),Release 构建关优化(-O0 不在此意)
2. **复现曲线与场景匹配**:别在模拟器下网络边录,真机 + 数据
3. 符号化:Debug Symbols 要开,Swift ABI 下板,\`@inline\` 的函数栈可能缩短

**系统工具替代**:os_signpost + Point of Interest(性能打点永久放在产品里)、Xcode MetricKit(线上 Metrics)、Instruments 新模板 2025/2026 有新分辨率,别让自己只用三个老模板。`,
  },
  {
    t: '列表流畅度的方法论?CPU GPU 工程三步?',
    lv: 2, fq: 3, tags: ['列表性能', '流畅度'],
    opt: ['把所有工作都放到主线程保证顺序', 'CPU 侧预计算与异步化,GPU 侧消灭离屏与混合,工程侧预取、缓存与降级', '预加载越多越好', '滚动时应提高图片清晰度'],
    ans: 1,
    key: ['CPU 预计算与异步策略;GPU 灭离屏,减混合;工程预取、缓存、降级', '排障先量化再看曲线,改一点测一点'],
    a: `**CPU 上省时间**:

1. **cell 高度预计算缓存**,不等高的自适高度如此 (estimated + 预排版)
2. **富文本异步预排版**,TextKit 到 NSAttributedString 不 main thread 现场算
3. **异步绘制**:子线程生成位图,主线程 \`layer.contents\`(Texture 框架思想)
4. **少对象 alloc**:格式化器、字体、日期器全部缓存

**GPU 上省压力**:

5. **消灭离屏渲染**(圆角预切图、shadowPath、CAShape),**减少混合层级**(opaque、背景对齐)
6. **图片大小对齐显示尺寸**,避免大纹理缩放采样

**工程侧**:

7. **预取**:Prefetching 向前 N 格拉数据 + **预解码**,滑动方向权重加权
8. **缓存**:图像内存 NSCache + 磁盘 LRU,**同一 URL inflight 合并**
9. **降级**:快速滑动低清图/停视频,RunLoop UITracking 期间暂停非必要任务

**开发方式**:先 \`CADisplayLink\` FPS 与 Instruments 量化,**改一项测一项**,MetricKit 发布后回顾:这是**闭环**不是"一次性优化"。`,
  },
  {
    t: 'A/B 测试与灰度发布怎么做?',
    lv: 3, fq: 2, tags: ['AB', '灰度', 'Feature Flag'],
    key: ['按用户 ID 分桶,互斥层 + 正交层实验,埋点口径统一', '读配置收敛到统一 SDK 接口;服务端动态调比例'],
    a: `**灰度(发布通道)**:

1. **分桶**:user_id hash % 100(稳定,同一用户一直在一桶);另保留白名单(内部账号强制进组)
2. **配置下发**:服务端按版本/机型/地域动态调流量比例,客户端本地缓存配置防止启动阻塞
3. **快速止血**:Feature Flag 远程开关可在分钟级回滚功能,避免热更

**AB 实验**:

1. **分层分流**:互斥层(两个实验不能同用户)+ 正交层(可叠加),用实时分桶或离线分桶
2. **埋点口径统一**:实验组/对照组埋**相同指标 + 相同口径**,显著性(通常 95%)达标再放量
3. **客户端侧**:把"读实验参数"收敛成**统一 SDK 接口**(\`exp.value(.homeStyle)\`),业务代码不感知实验平台

**代码出入注意**:

- 实验分支代码**先合主干**(small PR)再用 flag 打开,避免长生分支
- flag 代码要有**到期清除计划**(dead flag 成为技术债)

**发布**:内部(TestFlight 内测 10k 人限时)→ 外部(公测 10k)→ 分阶段 App Store 放量(1/5/20/50/100),每阶段崩与核心指标守门。`,
  },
  {
    t: '线上日志系统怎么设计?',
    lv: 3, fq: 1, tags: ['日志', 'APM', '落盘'],
    key: ['分级 + 环形文件滚动 + 关键路径实时与批量平衡 + 脱敏 + 启动回捞', '崩溃/大卡顿前 最近 N 条日志是最有用的现场'],
    a: `**设计要点**:

1. **分级**(verbose/debug/info/warn/error)与 **tag**,正式包只开 info+;线上**远程下调**级别开关
2. **存储**:本地**环形文件**(按天滚动,大小上限,如 50MB),写用 append + mmap/写缓冲,异常时**启动收尾**
3. **策略**:关键路径(支付、登录)实时小批量上报,一般日志**WiFi 批量**,崩溃时间**反向捞最近日志**
4. **脱敏**:手机号/身份证/token(格式打码)、经纬度去粗,密钥必须不落盘;线上日志**禁止 print 式**,走 \`os_log\` 隐私级别(
\`%\{private\}\`)
5. **观察**:日志查询系统线上可检索(用户/会话 ID),崩溃报告自动挂最近日志文件句柄

**业务流程**:

- 采集层(打点与日志接口)统一门面,业务埋点是**语义事件**(参数结构化不在 text 中文案拼)
- 上报层网络必败**重试与限流**,防止"上报死循环"
- 循环论证:日志过载本身是一个稳定性因素,**要把日志当性能成本来对待**,入 Perf 预算。

**对题**:让面试官看到"日志是为了让 4 天之后别人能复现问题",而不是为满足打 log 的手感。`,
  },
]);
