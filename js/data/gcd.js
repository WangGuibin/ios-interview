/* iOS 题宝库 · data/gcd.js:GCD 与锁 */
'use strict';

QB.add({
  key: 'gcd', name: 'GCD 与锁', icon: 'cGcd', tint: '#D33F49',
  desc: '队列与死锁、group/semaphore/barrier、锁全家桶与 QoS',
}, [
  {
    t: '串行队列和并发队列,同步和异步,四种组合分别在哪个线程执行?',
    lv: 1, fq: 3, tags: ['GCD', '串行', '并发'],
    key: ['同步:阻塞当前线程直到完成;异步:立刻返回', 'async+并发=新线程;async+串行=复用一条子线程;sync 都在当前线程'],
    a: `**两把尺子**:

- **串行 / 并发队列**:决定**队列内的任务**是一条条执行还是可以同时开多个
- **同步 / 异步派发**:决定**当前线程**是否等这个任务完成

**四种组合**:

| | 串行队列 | 并发队列 |
|---|---|---|
| **sync** | 当前线程顺序执行(若在目的队列上 → **死锁**) | 当前线程执行,任务按序但同线程所以不并发 |
| **async** | 开**一条**子线程,任务串行 | 开**多条**子线程,任务真并发 |

**注意**:\`sync\` 派到**并发队列**也不会真并发,因为 sync 要"等这一个完成",提交者只能一个一个来,所以 GCD 源码和经验都把它当串行对待。

**特殊点**:\`DispatchQueue.main\` 是绑定主线程的串行队列,主线程上 \`sync\` 主队列**必死锁**(见下题)。`,
    opt: ['sync 到并发队列上的任务在多个线程并发执行', 'async 到串行队列会开启多个子线程', 'sync 在当前线程执行,async 才可能跨线程', '主队列上 sync 是安全的'],
    ans: 2,
  },
  {
    t: '什么情况下 GCD 会死锁?给两个必背例子。',
    lv: 2, fq: 3, tags: ['死锁', 'dispatch_sync', '主队列'],
    opt: ['任何 sync 调用都会死锁', '在串行队列内 sync 派发到同一串行队列(含主线程 sync 主队列)', 'async 派发到当前串行队列会死锁', '并发队列上 sync 嵌套一定死锁'],
    ans: 1,
    key: ['公式:在串行队列 Q 内 sync 到 Q 本身(含主队列)', '避免:换成 async、或 sync 到别的并发队列'],
    a: `**死锁公式:M 任务在串行队列 Q 上运行,M 内又 sync 到 Q**。sync 要等新任务完成,而新任务排在 M 后面等 M 完成,互相等待,永不醒来。

**必背例 1:主线程 sync 主队列**

\`\`\`swift
DispatchQueue.main.sync { print("永远不会执行") }   // 主线程死锁
\`\`\`

**必背例 2:自定义串行队列嵌套**

\`\`\`swift
let q = DispatchQueue(label: "serial")
q.sync {
    q.sync { print("inner") }   // 外层等内层,内层排在外层后 → 死锁
}
\`\`\`

**不死锁的反例**:

- sync 到**并发队列**就算嵌套也不会死(新任务可立刻并行执行)
- 在**别的线程** sync 到主队列(只在主队列自己上死),只是阻塞等待,不叫死锁但可能卡 UI

**追问**:Swift 并发里 \`await MainActor.run { }\` 会不会死锁?**不会**:你已经 MainActor 上时属于重入就绪,系统让任务按执行器语义排队而不阻塞线程;这也是"阻塞式 sync"与"挂起式 await"的本质差。`,
  },
  {
    t: 'DispatchGroup、DispatchSemaphore、DispatchBarrier 各解决什么问题?',
    lv: 2, fq: 3, tags: ['DispatchGroup', 'Semaphore', 'Barrier'],
    opt: ['barrier 对全局并发队列也生效', 'semaphore.wait 可以在主线程随意调用', 'barrier 只在自定义并发队列上才独占生效', 'DispatchGroup 不能跨队列'],
    ans: 2,
    key: ['Group=任务汇合;Semaphore=并发限流;Barrier=并发队列上的读写锁', 'semaphore.wait 禁止出现在主线程'],
    a: `**DispatchGroup(任务汇合)**:批量任务"全部干完再一起做下一步"。\`group.enter()\` / \`group.leave()\` 计数,\`group.notify(queue:) { }\` 归零时回调。典型:N 个接口全部回来后刷新页面。

**DispatchSemaphore(信号量限流)**:配额制并发门。\`wait\` 过闸,\`signal\` 放行。初值 = 最大并发数,达成"最多 N 个任务同时跑"。**铁律:不要在主线程 \`wait()\`**,主线程堵死就是卡死。

**DispatchBarrier(屏障)**:让**自己创建的并发队列**获得读写锁语义:

\`\`\`swift
let q = DispatchQueue(label: "rw", attributes: .concurrent)
// 读:并发
func read() -> Value { q.sync { storage } }
// 写:barrier 独占,期间不允许其它任务穿插
func write(_ v: Value) { q.async(flags: .barrier) { storage = v } }
\`\`\`

**易踩点**:barrier **只对自定义并发队列生效**,对 \`global()\` 队列无效(会和别人的任务漏风);同样,notify 回调没注意指定队列,默认在主线程跑可能造成 UI 卡。`,
  },
  {
    t: 'dispatch_once 的原理?Swift 里为什么没有它?',
    lv: 2, fq: 2, tags: ['dispatch_once', '单例', 'static let'],
    key: ['一次性 token 原子标记,保证任意线程只执行一次', 'Swift:static let 全局/类型属性天然懒加载+线程安全'],
    a: `**原理**:\`dispatch_once\` 依赖一个 \`dispatch_once_t\`(long 型)原子标记:初始 0,首个执行者通过原子比较并交换把标记翻转为进行中/完成,**后来的调用要么直接跳过要么在锁上等首个完成**,从而保证 block 在整个进程生命周期**只执行一次且结果对所有线程可见**(内存屏障)。

\`\`\`objc
+ (instancetype)shared {
    static id instance;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{ instance = [self new]; });
    return instance;
}
\`\`\`

**Swift 没有的原因**:Swift 的**全局变量 / \`static let\`** 由语言保证**懒加载且线程安全**(底层同样走一次性初始化机制),写法反而更短:

\`\`\`swift
final class Service {
    static let shared = Service()   // 线程安全 + 仅一次 + 惰性
}
\`\`\`

**追问**:Swift 里想表达"像 dispatch_once 一样的任意动作只跑一次"怎么办?答:用 \`static let token: Void = { action() }()\` 或 actor 一次性初始化,别手写布尔检查,存在竞态。`,
  },
  {
    t: 'iOS 里有哪些锁?性能怎么排序?',
    lv: 2, fq: 3, tags: ['锁', 'os_unfair_lock', 'pthread_mutex'],
    opt: ['OSSpinLock 性能最好应优先使用', 'os_unfair_lock 性能最好,@synchronized 最慢,OSSpinLock 因优先级反转已废弃', '@synchronized 性能最好', '所有锁的性能基本一致'],
    ans: 1,
    key: ['os_unfair_lock > pthread_mutex > NSLock > 条件锁 > 递归锁 > @synchronized', 'OSSpinLock 因优先级反转被废弃'],
    a: `**常用锁,按大致性能(快到慢)**:

1. **os_unfair_lock**(C API,栈上 4 字节):优先级反转感知的二值锁,首选;包装对象是 Swift 的 \`OSAllocatedUnfairLock\`
2. **Mutex**(Synchronization 框架,iOS 18+):Swift 原生的值语义封装,推荐新代码用
3. **pthread_mutex**:POSIX 互斥锁,功能全,可配递归/优先级继承
4. **NSLock**:ObjC 封装互斥锁,接口简单,内部走 pthread
5. **NSCondition**:条件变量(等待/唤醒),适合生产者消费者
6. **NSRecursiveLock**:递归锁,允许同线程重入
7. **NSConditionLock**:带状态值的条件锁
8. **@synchronized**:最慢,基于全局递归互斥表,但写法最简洁

**OSSpinLock 的教训**:真自旋忙等,其**不会让等待线程让出 CPU**,优先级反转下低优先级持锁者永远拿不到 CPU,高优先级忙等饿死它,iOS 10 起 deprecated,os_unfair_lock 就是其替代。

**选型速记**:要快且不递归 → os_unfair_lock;要递归 → pthread_mutex(recursive)/NSRecursiveLock;要写起来快懂 → NSLock(临界区不太热的话);**能 actor 就别锁**(见并发分类)。`,
  },
  {
    t: '什么是优先级反转?GCD 是怎么缓解它的?',
    lv: 2, fq: 2, tags: ['优先级反转', 'QoS'],
    key: ['高级任务等低级任务→低级又被中级抢占→高级的等死', 'GCD 通过 QoS 传播做"持锁者临时升级"'],
    a: `**定义**:高优先级任务 H 等待低优先级任务 L 持有的资源,而 L 又不断被中优先级任务 M 抢占,结果 H 迟迟无法运行。**OSSpinLock 被废、大家都在抛弃自旋**,就是为这个+这个问题。

**缓解机制**:

1. **QoS 传播(priority inheritance/aware)**:GCD 在**等待方是高 QoS**时,会**临时提升持有者的执行优先级**,直到临界区结束;os_unfair_lock、pthread 的 priority inheritance、actor 执行器都有类似语义
2. **缩短临界区**:拿锁只做最必要的事,IO/计算都挪出临界区,再加锁放结果
3. **主线程所依赖的后台任务显式高 QoS**:避免后台网络处理持有某单例锁时拖死 UI
4. **从架构上少用共享可变状态**:值语义传值、actor 隔离,从源头减少锁

**QoS 全档**:\`userInteractive(主线程级) > userInitiated > default > utility > background\`,Swift 并发里对应 \`TaskPriority\` 并有同样的 priority escalation。`,
  },
  {
    t: 'GCD、Operation、Thread、Swift Concurrency 怎么选型?',
    lv: 2, fq: 3, tags: ['并发选型'],
    opt: ['任何场景都应优先使用 Thread', '简单派活用 GCD,要依赖/取消用 Operation,新代码优先 Swift Concurrency', 'Operation 比 GCD 更轻量', 'Swift Concurrency 不支持取消'],
    ans: 1,
    key: ['简单派活 GCD;要取消/依赖/优先级 Operation;结构化新项目 Swift Concurrency', 'Thread 只用于需要常驻或实时调度的细活'],
    a: `**一张选型表**:

| 需求 | 推荐 |
|---|---|
| 一次性异步派活、并发读写控制 | **GCD**(轻、直接) |
| 任务间依赖、需要随时取消、KVO 状态、最大并发数控制 | **OperationQueue**(eg. 分片上传队列) |
| 新代码、有需要结构性取消/错误/actor 隔离 | **Swift Concurrency**(async/await + Task + actor,首选) |
| 需要常驻线程、极低延迟定制调度 | **Thread / RunLoop**(慎入,见 RunLoop 分类) |

**补充关键**:

- Operation 可以描述为"面向对象的 GCD 任务":依赖、cancel、isReady/isExecuting/isFinished KVO;**异步 Operation 要自己管理 KVO 状态**
- \`maxConcurrentOperationCount = 1\` 的队列**不等于**串行队列(调度顺序是就绪优先级,不严格 FIFO,任务若非 ready 会跳)
- Swift 并发是**协作式线程池**,不存在"线程爆炸"隐患;而 global concurrent queue 在高倾并发+sync 下可能产生大量 thread ballooning

**面试话术**:给一个案例。分片上传:Operation + maxCount;批量接口聚合刷新:DispatchGroup/notify;新模块网络层:async/await。可见选型是"需求驱动",不是技术粉刷。`,
  },
  {
    t: '如何取消一个 GCD 任务?为什么 sync/async 的块取消不了?',
    lv: 2, fq: 2, tags: ['取消', 'DispatchWorkItem'],
    key: ['DispatchWorkItem.cancel(),只能取消"未开始执行"的块', 'run 中的块要自行检查 isCancelled'],
    a: `**正确对象**:\`DispatchWorkItem\` 是"GCD 里可取消的任务体",必须用 async 派发:

\`\`\`swift
let item = DispatchWorkItem { print("do") }
queue.async(execute: item)
item.cancel()                 // 若 item 尚未开始执行,则不会再执行
item.notify(queue: .main) { print("完成或被取消后都做清理") }
\`\`\`

**取消的边界**:

- **只对"还在队列里没轮到执行"的任务有效**;一旦开始执行,cancel 只是设置 \`isCancelled\` 标记,块内要自己查:

\`\`\`swift
let item = DispatchWorkItem {
    for chunk in chunks {
        if taskItem.isCancelled { return }
        process(chunk)
    }
}
\`\`\`

- \`asyncAfter\` 也可以包成 WorkItem 来取消,这是老项目取消延迟任务的常用模式
- **sync 派发的块取消没有意义**:sync 已经阻塞提交线程,块要么"立刻执行要么进不来",取消要先 occur before block 被调度,窗口极窄,**别依赖**

**Swift Concurrency 对照**:Task.cancel + checkCancellation 是结构化一等公民,迁移时把 WorkItem 语义映射过去。`,
  },
  {
    t: 'asyncAfter 的延迟精度高吗?适合做精准定时吗?',
    lv: 2, fq: 1, tags: ['asyncAfter', '定时精度'],
    key: ['几毫秒到几十毫秒漂移,受 runloop/system 负载影响', '精准场景用 Timer(tolerance 小)、CADisplayLink、或调度器专用'],
    a: `**\`asyncAfter\`** 的语义是"在 deadline **之后**尽快执行",不是"准时执行"。GCD 会按系统负载和节能策略调度,普通场景漂移几毫秒到几十毫秒,App 压力大/休眠后甚至秒级。

**不要用于**:

- 音视频同步、动画帧对齐(请 \`CADisplayLink\` / Core Animation 时间轴)
- 精确倒计时读秒(应记录截止 wall time,再 UI 层按 DisplayLink 刷新,而不是每次 sleep 后 +1)
- 硬实时的工业时序

**可以用**:防抖(debounce)、节流(throttle)、"稍后刷新 UI"这种**软延迟**。

**替代方案**:\`Timer\` 可设 \`tolerance\` 帮助省电;\`DispatchSourceTimer\` 可控 leeway,精度高于 asyncAfter;\`Task.sleep\` 同样只是"不少于"。精准时序请依赖系统时钟而非调度器节拍。`,
  },
  {
    t: '全局并发队列 global 会把线程开到多少?什么情况会"线程爆炸"?',
    lv: 3, fq: 2, tags: ['线程爆炸', 'global queue', 'thread pool'],
    key: ['并发会持续派活就要持续给线程,上限约 64;用 sync 占着不放是爆炸源', '根治:真并发需求收拢到受并发数管理的队列或 Swift 并发'],
    a: `**机制**:GCD 的 \`global()\` 是系统共享的并发队列,其下是**全局工作队列线程池**,iOS 上一个 App 可创建的 GCD 服务线程**上限大约 64**(到达上限后新任务排队等既有线程释放)。

**爆炸温床**:在 global 队列跑的任务**再 sync 等待另一个任务**,等待期间该线程**被占死无法归还**。short 窗口不可怕,**持续**的"并发请求 × 每次再 sync 依赖"就能同时占满 64 线程,进而:

- 主线程等 \`sync { global { } }\`(即使 protected)被饿死 → 卡死-app
- Thread explosion 诊断:内存 + 调度抖动 + 级联延迟

**防护**:

1. 热路径**别在并发任务里 sync 同团队的其他并发任务**,改用 group/notify 或 continuation
2. I/O  multiplexed 使用 GCD 已提供的 QoS 队列合理处理,**读多写少的业务读写集**用专用 concurrent queue + barrier
3. Swift Concurrency 的协作式线程池大小约等于 CPU 核数,挂起不占线程,这类结构化迁移更稳`,
  },
  {
    t: '单例在多线程下怎么保证线程安全?(两种实现)',
    lv: 1, fq: 3, tags: ['单例', '线程安全'],
    opt: ['用一个全局布尔变量判断是否已创建', 'OC 用 dispatch_once,Swift 用 static let(语言保证懒加载且线程安全)', 'Swift 需要手动加锁才能保证单例安全', 'lazy var 天然线程安全'],
    ans: 1,
    key: ['OC:static + dispatch_once;Swift:static let 语言保证', '别双边加锁,也别 lazy 裸写'],
    a: `**Objective-C**:

\`\`\`objc
+ (instancetype)shared {
    static id instance;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        instance = [[super allocWithZone:NULL] init];
    });
    return instance;
}
\`\`\`

**Swift**:

\`\`\`swift
final class Locator {
    static let shared = Locator()   // static let:懒加载 + 一次性 + 线程安全,语言保证
    private init() {}
}
\`\`\`

**避坑**:

- 避免"double-checked locking + bool"自写,极易 在内存模型上踩坑
- 拷贝防护:OC 里把 \`allocWithZone:\`/\`copy\` 一并兜底,避免 \`[self new]\` 绕过单例
- **可测化**:调用方依赖**协议**,单例作为生产默认实现,注入参数化(\`init(api: APIClient = .shared)\`);有状态的单例提供 \`reset()\`
- 架构的反面教材:把单例当"全局垃圾桶"(又放状态又放大对象),面试时主动说"单例只配做**无业务状态的入口**"会加分`,
  },
  {
    t: '如何实现一个读写锁?适用什么场景?',
    lv: 3, fq: 2, tags: ['读写锁', 'pthread_rwlock', 'barrier'],
    key: ['读并发+写独占,读多写少场景最优解', 'pthread_rwlock_t 或 并发队列+barrier'],
    a: `**两种实现**:

**1. pthread 读写锁**(C 层):

\`\`\`objc
pthread_rwlock_t lock = PTHREAD_RWLOCK_INITIALIZER;
pthread_rwlock_rdlock(&lock);   // 读共享
pthread_rwlock_wrlock(&lock);   // 写独占
pthread_rwlock_unlock(&lock);
\`\`\`

**2. 并发队列 + barrier**(GCD 风格,更常用):

\`\`\`swift
let q = DispatchQueue(label: "rw", attributes: .concurrent)
func read() -> Value { q.sync { storage } }
func write(_ v: Value) { q.async(flags: .barrier) { storage = v } }
\`\`\`

**适用**:**读远多于写**的共享数据(配置、缓存索引、路由表),读并发把吞吐拉满,写独占保证一致

**注意**:写操作里别触发"依赖同一把锁"的读(同线程 barrier 里再 sync 读 = 死锁);写者排的队很长时要考虑写饥饿;**Swift 6 时代新代码优先 actor**,锁留给必须要同步 API 的角落。`,
  },
  {
    t: 'Task 的优先级是怎么继承和传播的?什么是优先级提升?',
    lv: 3, fq: 2, tags: ['TaskPriority', '优先级提升'],
    key: ['Task 继承父任务优先级;高优先级等待低优先级 Task 会"抬轿"', '显式可用 Task(priority:) 变更'],
    a: `**规则**:

- \`Task { }\` 继承当前异步上下文的 \`TaskPriority\`(userInitiated 等);在 MainActor 创建默认是高优先级
- \`Task.detached\` 不继承,默认 medium,要显式 \`Task.detached(priority: .userInitiated)\`
- \`Task.currentPriority\` 运行期可查

**优先级提升(escalation)**:高优先级任务 await 一个低优先级任务时,运行时会**临时把低优先级任务的执行者提升**,直到结果返回,避免"高卡低的队"的优先级反转(与 QoS 提升思想一致)

**运维指导**:

- UI 响应相关的数准备/解码:\`userInitiated\`
- 用户无感的批量整理/索引:\`utility\` / \`background\`
- **不要**做"高优先级任务长时间持有低优先级任务依赖的资源却不开 escalation 意识",出现的症状是"卡但 CPU 不忙",Debug 时 \`Task.isCancelled\` 和 \`currentPriority\` 打点是第一盏灯`,
  },
  {
    t: '为什么说"UI 必须在主线程更新"?子线程更新会怎样?',
    lv: 1, fq: 3, tags: ['主线程', 'UIKit', '线程安全'],
    opt: ['这只是性能建议,子线程更新也安全', 'UIKit 非线程安全,且 UI 刷新绑定主线程 RunLoop 的提交节拍', '子线程更新 UI 一定立即崩溃', '加锁后就可以在子线程更新 UI'],
    ans: 1,
    key: ['UIKit/AppKit 设计非线程安全,渲染依赖主线程 runloop 节拍', '子线程改动轻则延迟刷新乱序,重则崩溃/渲染异常'],
    a: `**根本原因**:

1. **UIKit 不是线程安全的**:UIView/UIViewController 的状态、CATransaction 的合并提交、Auto Layout 求解,都假设单线程访问
2. **UI 刷新绑定主线程 RunLoop**:UI 变更攒在事务里,等主 runloop **BeforeWaiting** 统一 commit(见 RunLoop 题)。子线程的改动根本接不上这条节拍,要么没注册到正确 runloop,要么与主线程的中间态竞争

**后果**:

- 不崩但"改动延迟生效/丢失"(改动了 UI 但没触发预期的 commit)
- 真崩溃:EXC_BAD_ACCESS、断言触发(Main Thread Checker 能认出)
- 渲染错乱:闪烁、错位、动画中途断

**怎么自查**:Xcode 开 **Main Thread Checker**;SwiftUI 里 body 以外的隔离碰 UI 状态,Swift 6 下直接被 MainActor 隔离拦掉。

**正确姿势**:业务线程只做**数据变换**,最后一跳 \`await MainActor.run\` / \`DispatchQueue.main.async\` / \`Task { @MainActor in }\` 回主线程提交。`,
  },
]);
