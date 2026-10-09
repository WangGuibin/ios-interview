/* iOS 题宝库 · data/swift-concurrency.js:Swift 并发(async/await、actor、Swift 6) */
'use strict';

QB.add({
  key: 'swift-concurrency', name: 'Swift 并发', icon: 'cConc', tint: '#6E56CF',
  desc: 'async/await、actor 隔离、Sendable 与 Swift 6 严格并发',
}, [
  {
    t: 'async/await 的底层原理是什么?相比 GCD + 回调解决了什么?',
    lv: 2, fq: 3, tags: ['async/await', '协程', 'continuation'],
    opt: ['await 会阻塞当前线程直到结果返回', 'await 处挂起任务并让出线程,结果就绪后恢复续体', 'async 函数各自独占一个系统线程', 'async/await 本质是 GCD 的语法糖'],
    ans: 1,
    key: ['await 处挂起,状态打包为续体,线程立即让出不阻塞', '回调金字塔变顺序代码 + 结构化取消 + 编译期检查'],
    a: `**原理**:带 \`async\` 的函数在 \`await\` 处**挂起(suspend)**:编译器把当前执行状态(局部变量、恢复点)打包成**续体(continuation)** 注册给运行时,**线程立即让出**去执行其他任务;异步操作完成后,续体被恢复执行。一个线程可以"穿梭"成千上万个挂起任务,系统按 CPU 核心数维持协作式线程池,天然避免线程爆炸。

**对比 GCD + completion handler**:

- 写法:回调金字塔/错误透传链变**顺序代码**,错误用 try/catch 而非手写 Result 透传
- 取消:GCD 任务几乎不可取消;Task 取消沿任务树**结构化传播**
- 类型与检查:返回值、throws 有编译器保证;completion 双回调、漏回调这类问题在编译期就被消除
- 资源:不再"一个请求占一个线程干等",等待几乎零成本

> 一句话版:async/await 是"编译器帮你写的状态机 + 运行时的协作式调度",GCD 是"手动堆回调 + 抢占式线程池"。`,
    deep: `**追问:await 之后代码还在原线程执行吗?**

不一定。恢复时的执行上下文由**隔离域**决定:在 actor 隔离上下文里 await,恢复时回到该 actor 的执行器;在非隔离上下文里,恢复在哪个线程是不保证的。所以"await 之后更新 UI"必须确保处于 MainActor 上下文,这正是 Swift 6 把 UI 类型默认隔离到 MainActor 的原因。`,
  },
  {
    t: 'Task 和 Task.detached 的区别?怎么用对?',
    lv: 2, fq: 3, tags: ['Task', 'detached', '上下文继承'],
    opt: ['两者都继承当前 actor 隔离与优先级', 'Task 继承当前上下文,Task.detached 什么都不继承', 'Task.detached 性能一定更好', 'Task 不能在 MainActor 中创建'],
    ans: 1,
    key: ['Task 继承当前 actor 隔离/优先级/task-local;detached 全不继承', '界面上发起的默认用 Task,不沾边的纯后台活才 detached'],
    a: `| | \`Task { }\` | \`Task.detached { }\` |
|---|---|---|
| actor 隔离 | **继承**当前隔离域 | 不继承 |
| 任务优先级 | 继承 | 默认 .medium |
| task-local 值 | 继承 | 丢失 |
| 典型用途 | 默认选择 | 与调用方完全无关的纯后台计算 |

**高频坑**:在 \`@MainActor\` 的 ViewModel 里写 \`Task.detached { await self.load() }\`,闭包不再在 MainActor 上,访问 @MainActor 隔离的属性需要 await,写错就是各种"为什么 UI 更新在主 actor 外"的警告。

**判断口诀**:这段代码**要不要碰到我当前的对象状态**?要,用普通 \`Task\`;不要(比如纯计算、写文件、拉配置),才考虑 detached,并把所需的值在闭包外捕获成局部常量传进去。`,
  },
  {
    t: '什么是结构化并发?async let 与 TaskGroup 怎么选?',
    lv: 2, fq: 3, tags: ['结构化并发', 'async let', 'TaskGroup'],
    opt: ['子任务可以比父任务活得更久', '父任务不会先于子任务完成,取消沿任务树传播', 'async let 与 TaskGroup 完全等价', '结构化并发不支持取消'],
    ans: 1,
    key: ['父任务不能先于子任务结束;取消沿任务树传播', '数量固定用 async let,数量动态用 TaskGroup'],
    a: `**结构化并发**:任务有明确的父子层级,**父任务不会先于子任务完成**。离开作用域时没 await 的子任务会被隐式等待/取消,杜绝 GCD 时代"fire and forget 野任务泄漏"。

\`\`\`swift
// async let:并发数量/形参在编译期可见
async let user = fetchUser()
async let feed = fetchFeed()
let (u, f) = try await (user, feed)

// TaskGroup:数量运行期决定,如并发下载 N 张图
try await withThrowingTaskGroup(of: Data.self) { group in
    for url in urls { group.addTask { try await fetch(url) } }
    for try await data in group { images.append(data) }
}
\`\`\`

**关键行为**:

- 任一子任务 throw 会**取消其余子任务**并向 group 传播,\`withTaskGroup\`(非 throwing)则各自完成
- 取消传播:父任务 cancel,所有子任务收到取消标记(协作式,仍需子任务自己 \`checkCancellation\`)
- TaskGroup 内 addTask 闭包是 \`@Sendable\`,捕获要过 Sendable 检查`,
  },
  {
    t: '任务取消是如何传播的?为什么"只 cancel 不检查"等于没取消?',
    lv: 2, fq: 3, tags: ['取消', 'checkCancellation', '协作式'],
    opt: ['cancel() 会立即强制终止任务', 'cancel() 只打标记,任务内需主动检查 isCancelled 或 checkCancellation', '取消不会传播给子任务', '只要调了 cancel,await 会自动抛错'],
    ans: 1,
    key: ['cancel() 只是打标记,不会强杀线程', '任务内必须 checkCancellation / isCancelled 自查'],
    a: `**协作式取消**:\`task.cancel()\` 只是把任务的 cancelled 标记置位,**不会抢占式杀死**任务,正在跑的代码照样跑完。这是刻意的:强杀线程会把共享状态留在不可知的中间态。

正确姿势:

\`\`\`swift
for chunk in chunks {
    try Task.checkCancellation()      // 已取消则抛 CancellationError
    // 或 if Task.isCancelled { return partialResult }
    try await upload(chunk)
}
\`\`\`

**传统回调的取消**要用 \`withTaskCancellationHandler\` 注册取消动作:

\`\`\`swift
try await withTaskCancellationHandler {
    try await withCheckedThrowingContinuation { cont in
        task = urlSession.dataTask(with: url) { ... cont.resume(...) }
        task.resume()
    }
} onCancel: { task?.cancel() }   // 取消落到 URLSessionTask
\`\`\`

**追问入口**:结构化并发里取消沿任务树自动下发;async let / TaskGroup 的子任务会收到父任务的取消。`,
  },
  {
    t: 'actor 是什么?解决了什么问题?为什么访问成员要 await?',
    lv: 2, fq: 3, tags: ['actor', '数据竞争', '隔离'],
    opt: ['actor 是值类型,拷贝时自动隔离', 'actor 是引用类型,编译器强制其可变状态串行访问', 'actor 内部访问成员也需要 await', 'actor 完全等价于加了锁的 class'],
    ans: 1,
    key: ['引用类型+编译器强制串行访问内部可变状态', '同一时刻只有一个任务执行其隔离代码 → 从类型层面消灭数据竞争'],
    a: `**actor 是带隔离语义的引用类型**:它的**可变状态(隔离成员)** 只能被该 actor 串行执行器上的代码触碰。外部调用必须 \`await\`,因为调用是一次"把闭包投到 actor 信箱排队"的订阅,当前没有任务在跑才可能立即执行,否则要等。

\`\`\`swift
actor Counter {
    private var value = 0
    func increment() { value += 1 }   // actor 内部互斥,无锁
    func get() -> Int { value }
}
// 外部:await counter.increment()  ← 编译器强制 await
\`\`\`

**对比 class + 串行队列**:思路一致,但 actor 把纪律交给编译器。忘了 await、忘了进队列都是编译错误,而不是偶发的线上崩溃。

**actor 不是银弹**:

- 高频微小读写场景,每次 hop 的成本高于一把 \`NSLock\` / \`Mutex\`
- 同步 API 生态(delegate、OC 层)没法天然 await,需要 \`nonisolated\`,此时线程安全要另外保证
- **重入(reentrancy)** 不等于互斥全程,见下一题`,
  },
  {
    t: '什么是 actor 重入(reentrancy)?举个状态竞争的例子并修复。',
    lv: 3, fq: 3, tags: ['actor', 'reentrancy', '重入'],
    opt: ['actor 方法执行期间其他任务完全无法进入', 'await 挂起期间其他任务可进入并修改状态,恢复后此前的判断可能已失效', 'actor 重入会导致死锁', '重入只发生在 detached task 中'],
    ans: 1,
    key: ['await 挂起期间其他任务可进入同一 actor', '口诀:await 前做决策,await 后必须重新校验状态'],
    a: `**重入**:actor 方法在 \`await\` 挂起时让出执行器,**其他任务得以进入同一 actor 并修改状态**,恢复后此前读到的状态可能已失效。

经典 bug:"check-then-act" 缓存:

\`\`\`swift
actor Downloader {
    private var cache: [URL: Data] = [:]
    func data(for url: URL) async throws -> Data {
        if let hit = cache[url] { return hit }
        let data = try await fetch(url)   // 挂起点:另一个任务也在 fetch 同一 url
        cache[url] = data                 // 恢复后覆盖 → 重复下载
        return data
    }
}
\`\`\`

**修法:把"进行中"也变成状态**,让并发调用共享同一个 Task:

\`\`\`swift
actor Downloader {
    private var cache: [URL: Data] = [:]
    private var inflight: [URL: Task<Data, Error>] = [:]
    func data(for url: URL) async throws -> Data {
        if let hit = cache[url] { return hit }
        if let task = inflight[url] { return try await task.value }
        let task = Task { try await fetch(url) }
        inflight[url] = task
        defer { inflight[url] = nil }
        let data = try await task.value
        cache[url] = data
        return data
    }
}
\`\`\`

**面试加分**:说明 actor 的保证边界:它保证**任意时刻只有一段隔离代码在跑**,不保证**跨 await 的不变量**。`,
    deep: `**追问:那 \`nonisolated\` 和 \`isolated\` 参数呢?**

- \`nonisolated\`:成员与内部可变状态无关(如 id、计算属性),免隔离可同步访问;Swift 6.2 起 \`nonisolated\` 异步函数**默认在调用方执行体上运行**(SE-0461),不再无条件跳 global pool,这是大行为变化。
- 函数形参标 \`isolated SomeActor\`:要求调用方必须已在该 actor 上,函数体可按 actor 内部分享方式直接访问。`,
  },
  {
    t: '@MainActor 和 DispatchQueue.main.async 的区别?',
    lv: 2, fq: 3, tags: ['MainActor', '主线程'],
    key: ['编译期静态保证 vs 运行期手动约定', '已经在 MainActor 上下文时零开销,不再切线程'],
    a: `**\`@MainActor\`** 把隔离信息交给类型系统:UI 类、方法、闭包标注后,**所有访问点由编译器强制走 MainActor**(要么已在上下文,要么 await 过去)。忘了切的场景在编译期红灯。

\`DispatchQueue.main.async\`：是运行期约定,写了才对,忘了就崩;还会无条件**真异步派发**(即使已在主线程也要多走一圈 runloop)。

**对应关系**:

| GCD 时代 | 并发时代 |
|---|---|
| \`DispatchQueue.main.async\` | \`await MainActor.run { }\` 或直接 \`await\` MainActor 隔离方法 |
| \`DispatchQueue.main.asyncAfter\` | \`Task.sleep + MainActor\` 上下文 |
| 到处补"主线程包一层" | 类型标注 \`@MainActor\`(UIViewController 已默认) |

**加分点**:Swift 6.2 的 SE-0466 允许把 **default isolation 设成 MainActor**(\`-default-isolation MainActor\`),App 工程默认所有代码都在 MainActor,要离开主 actor 要用 \`@concurrent\` / \`nonisolated(nonsending)\` 标注后台函数。面试官很吃"你知道这个迁移方向"。`,
    opt: ['@MainActor 标注后仍需手动 DispatchQueue.main.async', '已处于 MainActor 上下文时访问其成员没有线程切换', 'DispatchQueue.main.async 是编译期保证的', '@MainActor 不能标注整个类'],
    ans: 1,
  },
  {
    t: 'Sendable 是什么?Swift 6 为什么强制?过不了检查怎么修?',
    lv: 3, fq: 3, tags: ['Sendable', 'Swift 6', '数据竞争'],
    key: ['"可安全跨并发域传递"的标记协议', 'Swift 6:跨域传非 Sendable 直接编译错误'],
    a: `**\`Sendable\`** 是标记协议,语义:"这个类型的值可以安全地从一个隔离域**转移**到另一个隔离域"。满足条件:

- 值类型且所有成员 Sendable(struct/enum 自动合成)
- \`final class\` 且全部存储属性 \`let\` 且 Sendable
- actor 天生 Sendable

**Swift 6 的意义**:开启严格并发检查后,跨 actor / Task 边界传递**非 Sendable** 值从"警告"升级为"编译错误",数据竞争从"运行时偶发崩溃"前移到"编译期拒绝"。这是语言级承诺,不再是 lint。

**修复顺序(按正确性排)**:

1. 改成值类型/让成员 Sendable(根治)
2. 把共享状态**包进 actor**(隔离而非共享)
3. 用 \`@Sendable\` 闭包并只捕获 Sendable 值
4. \`nonisolated\` 把纯读取成员移出隔离
5. \`@unchecked Sendable\`:你**用人格担保**线程安全(内部有锁),只当逃生舱

**区域隔离(SE-0414)**与 **\`sending\` 参数(SE-0430)**:分析值的所有权转移路径,允许"不再被旧域使用"的非 Sendable 值跨域传递,大量减少误报。迁移时先开 \`-strict-concurrency=complete\` 看真实报数。`,
  },
  {
    t: '如何把基于 completion handler 的 API 桥接成 async/await?',
    lv: 2, fq: 3, tags: ['continuation', '桥接', 'Checked vs Unsafe'],
    opt: ['用 DispatchSemaphore 阻塞等待回调', '用 withCheckedThrowingContinuation 包装,且必须恰好 resume 一次', 'continuation 可以安全地 resume 多次', '回调式 API 无法桥接成 async'],
    ans: 1,
    key: ['withChecked(Throwing)Continuation 一次性恢复', '漏 resume 永远挂起,重 resume 直接崩'],
    a: `用 **continuation** 把回调包成挂起点:

\`\`\`swift
func fetchUser() async throws -> User {
    try await withCheckedThrowingContinuation { continuation in
        legacy.fetchUser { user, error in
            if let user { continuation.resume(returning: user) }
            else { continuation.resume(throwing: error ?? URLError(.unknown)) }
        }
    }
}
\`\`\`

**铁律:必须恰好 resume 一次**

- 漏了:任务永久挂起(泄漏,无任何报错)
- 重了:\`CheckedContinuation\` 在调试期直接断言崩,帮你抓 bug

**Checked vs Unsafe**:\`withCheckedContinuation\` 带运行时记账(开发期排查泄漏首选);\`withUnsafeContinuation\` 无记账、性能微优,前提是路径穷尽有把握。

**多值事件源**(delegate 持续回调)用 \`AsyncStream\` / \`AsyncThrowingStream\` 桥接,把 \`yield\` 绑进回调里,消费端 \`for await\`,自动带背压。`,
  },
  {
    t: 'AsyncSequence / AsyncStream 是什么?怎么把 delegate 桥接过去?',
    lv: 2, fq: 2, tags: ['AsyncStream', 'AsyncSequence', '背压'],
    key: ['异步版 Sequence:for await 消费、天然背压', 'AsyncStream 把推送式事件源桥接成拉取式序列'],
    a: `**\`AsyncSequence\`** 是异步世界的 Sequence:\`for await element in seq\` 逐个拉取,**消费者不 next,生产者就挂起**,背压与生俱来。

**\`AsyncStream\`** 负责把**推送式**事件源(通知、delegate、KVO、Socket)翻译成 AsyncSequence:

\`\`\`swift
func locations() -> AsyncStream<CLLocation> {
    AsyncStream { continuation in
        let delegate = LocationDelegate { loc in continuation.yield(loc) }
        manager.delegate = delegate
        manager.startUpdatingLocation()
        continuation.onTermination = { _ in manager.stopUpdatingLocation() }
    }
}
for await loc in locations() { update(loc) }
\`\`\`

要点:\`onTermination\` 里清理资源(消费端 break / 取消时触发);\`AsyncThrowingStream\` 用 \`finish(throwing:)\` 传错误;系统已给了 \`NotificationCenter.notifications(named:)\`、\`publisher.values\` 这些现成桥。

**与 Combine 的对应**:Publisher ≈ 异步事件源,AsyncSequence ≈ 带背压的单个消费循环;两者靠 \`.values\` / \`AsyncPublisher\` 互转。`,
  },
  {
    t: '怎么限制 TaskGroup 的并发数?',
    lv: 3, fq: 2, tags: ['TaskGroup', '限流', '滑动窗口'],
    key: ['维护窗口:先压满 N 个,每完成一个补一个', '或信号量 actor / AsyncSemaphore 三方方案'],
    a: `TaskGroup 自己不提供 maxConcurrency,标准解法是**滑动窗口**:

\`\`\`swift
func downloadAll(_ urls: [URL], limit: Int = 4) async throws -> [Data] {
    try await withThrowingTaskGroup(of: Data.self) { group in
        var iter = urls.makeIterator()
        for _ in 0..<limit {
            guard let url = iter.next() else { break }
            group.addTask { try await fetch(url) }
        }
        var results: [Data] = []
        while let data = try await group.next() {
            results.append(data)
            if let url = iter.next() {
                group.addTask { try await fetch(url) }   // 完成一个补一个
            }
        }
        return results
    }
}
\`\`\`

**要点**:并发数不是越大越好,移动端下载 3:4 是甜点位,过多反而抢带宽、炸内存、触发服务端限流;信号量语义也可以自己封一个 actor(或引 swift-async-algorithms / Semaphore 库)。

**对比记忆**:GCD 时代是 \`DispatchSemaphore\` + \`concurrentPerform\`,并发时代是 TaskGroup 窗口;思路同一个:用完才放行下一个。`,
  },
  {
    t: '把一个 GCD + 回调的网络层迁移到 async/await + actor,分几步走?',
    lv: 3, fq: 2, tags: ['迁移', '架构改造'],
    key: ['自底向上:模型先 Sendable → 接口 async 化 → 状态进 actor → 并发检查开 complete', '每步保持可回滚,双轨期封装而非重写'],
    a: `**推荐路径(每步都能独立上)**:

1. **模型先行**:网络层 DTO 全部改值类型 / 标 \`Sendable\`,这是后面一切的地基
2. **接口 async 化**:用 \`withCheckedThrowingContinuation\` 把旧回调 API 包出 async 接口,**新代码只写 async**,旧接口保留双轨
3. **状态收敛进 actor**:缓存、token 管理、任务去重表这些共享可变状态,从"串行队列 + 手动小心"迁到 actor,类型系统接管纪律
4. **错误统一**:\`throws\` 收敛到统一错误枚举,删除 Result 透传样板
5. **打开 \`-strict-concurrency=complete\`**:分批治理告警,先基础库后业务;\`@preconcurrency import\` 安抚未适配的三方库

**双轨期纪律**:新旧接口**不允许交叉调用**(completion 里再 async 一下又回调回去),边界处用 continuation 单向翻译。

**回滚策略**:每个 PR 都按"可回退"切分,先灰度 module-by-module,出问题只回滚该模块。`,
  },
  {
    t: 'class ImageCache 的 [URL: UIImage] 字典被多线程读写,改造到能通过 Swift 6 检查,怎么写?',
    lv: 3, fq: 3, tags: ['线程安全', 'actor', '实战题'],
    key: ['首选 actor;读写极热且要同步 API 才考虑锁', '把调用点改为 await,编译器全程把门'],
    a: `**首选:actor 封装**

\`\`\`swift
actor ImageCache {
    private var storage: [URL: UIImage] = [:]
    func image(for url: URL) -> UIImage? { storage[url] }
    func insert(_ image: UIImage, for url: URL) { storage[url] = image }
    func removeAll() { storage.removeAll() }
}
let cache = ImageCache()
// 调用:await cache.insert(img, for: url)
\`\`\`

**要同步 API 的替代:\`Mutex\`(Synchronization 框架,iOS 18+)**

- OC 层 delegate、同步回调场景没法 await,可用的做法是 \`Mutex<[URL: UIImage]>\` 的 \`withLock { $0[url] }\`,临界区极小,代价可控
- \`OSAllocatedUnfairLock\` / \`NSLock\` 同样可以,但 Swift 6 下要自己保证 Sendable 包装(通常 \`@unchecked Sendable\` + 内部锁)
- **别再写** \`DispatchQueue.sync\` 读写混排:异步写 + sync 读的平均延迟在压力下会崩,而且跨 await 持锁是未定义行为

**面试加分**:说明评估维度:调用点是否都能 await(全是 Swift 新代码 → actor)、吞吐与延迟敏感度、是否需要 OC/同步 API 兼容。`,
  },
  {
    t: 'SwiftUI 的 .task 修饰符和 onAppear + Task 有什么区别?',
    lv: 2, fq: 3, tags: ['SwiftUI', 'task', '取消'],
    opt: ['两者完全等价', '.task 与视图 identity 绑定,视图消失自动取消;onAppear 里的 Task 不会', 'onAppear + Task 会自动取消', '.task 不能执行异步代码'],
    ans: 1,
    key: ['.task 与视图 identity 绑定:view 消失自动取消,identity 变化重启', 'onAppear+Task 的任务不会被自动取消'],
    a: `**\`.task { }\`** 是结构化并发在 SwiftUI 的落地:

- 任务**与所在视图的 identity 绑定**:视图消失(滚出屏幕、pop)任务**自动取消**;identity(如 \`.id(x)\` / \`.task(id:)\` 的参数)变化则旧任务取消、新任务重建
- 在视图的执行上下文里跑(MainActor),天然能改 @State

**\`onAppear { Task { } }\`** 只是"出现时手动开一个非结构化任务":

- 视图消失**不会自动取消**,网络请求照跑,回来时对已销毁的视图状态写入(轻则无效,重则崩溃)
- onAppear 可能多次触发,要自己防重入

**对应记忆**:UIKit 时代的"VC 销毁时取消请求"手动仪式,被 \`.task\` 内建收编了。**选型**:任何"跟着视图生命周期走"的异步工作,默认 \`.task\` / \`.task(id:)\`。`,
  },
  {
    t: 'Task.sleep 和 Thread.sleep 有什么区别?',
    lv: 1, fq: 2, tags: ['Task.sleep', '挂起'],
    key: ['Task.sleep 挂起续体不占线程,且响应取消', 'Thread.sleep 阻塞整个线程,在主线程会卡 UI'],
    a: `- **\`Task.sleep(nanoseconds)\`**(/ \`Task.sleep(for:)\` Swift 5.10+:挂起当前任务的续体,**线程立即让出**做别的事,语义是"延迟 await 恢复";**响应任务取消**(取消时抛 \`CancellationError\`)
- **\`Thread.sleep\`**:把整个**线程**真睡死,什么都干不了;在主线程调用就是经典的卡 UI / Watchdog 来源

**使用建议**:异步流程里等待一律 \`try await Task.sleep\`;并记得 await 之前检查 \`Task.isCancelled\`。定时需求更系统化的场景(轮询节流)用 \`AsyncStream\` / Timer 桥接。

**细节**:sleep 精度受调度影响,不是硬实时,拿来做"动画精确时间轴"要用 CADisplayLink / TimelineView 而不是 sleep 循环。`,
  },
  {
    t: 'Swift 6 迁移最常见的编译错误有哪些?每种怎么修?',
    lv: 3, fq: 3, tags: ['Swift 6', '迁移', '编译错误'],
    opt: ['所有错误都能靠加 @unchecked Sendable 正确解决', '高频是:跨隔离域传非 Sendable、MainActor 隔离冲突、全局可变状态', 'Swift 6 只报警告不报错误', '迁移后必须放弃 GCD'],
    ans: 1,
    key: ['五类高频:跨域非 Sendable、MainActor 冲突、全局可变状态、协议隔离、delegate 线程不明', '先看错误说的"谁、在哪、跨了哪条线"'],
    a: `**迁移体检单(按出现频率)**:

1. **非 Sendable 跨隔离域**:DTO 改值类型,或 \`sending\` 标注说明所有权转移,或把关联状态收进同一 actor
2. **MainActor 隔离成员在非隔离上下文被访问**:调用点 \`await\`、把方法标 \`@MainActor\`、或重构为传值参数而非直接摸 UI 状态
3. **全局/静态可变状态**(\`static var config = ...\`):改 \`let\`、挪进 actor、或加 \`nonisolated(unsafe)\` 兜底(仅在确实无并发风险时使用)
4. **协议要求与隔离冲突**:协议的成员在 class 上实现时隔离不一致,用 \`nonisolated\` 成员或 \`@MainActor protocol P\`(SE-0470)明确语义
5. **OC delegate 回调线程不明确**:回调入口立刻 \`await MainActor.run\` 或把回调包装成 AsyncStream,边界一次性翻译,业务层不再裸奔

**工具**:\`@preconcurrency import\` 抑制未适配三方库的噪音;分批开 \`-strict-concurrency=complete\`;编译期诊断开 \`-Xfrontend -warn-long-function-bodies\` 找复杂推断点。`,
  },
  {
    t: 'actor 能完全替代锁吗?什么时候锁反而更合适?',
    lv: 3, fq: 2, tags: ['锁', 'actor', 'Mutex', '权衡'],
    key: ['actor 适合"对象级"状态隔离;同代同步 API、高频临界区锁更省', '跨 await 持锁是未定义行为,两者别混用'],
    a: `不能简单替代,分工如下:

**actor 更合适**

- 状态是"一个对象的内部世界":缓存、会话、账号、下载队列
- 代码是 async 生态,调用方都能 await
- 想要**编译期就把纪律钉死**(新团队、新模块默认值)

**锁更合适**

- **同步 API**:OC delegate、Core 层回调、SwiftUI 的 body 内同步读取,等不到 await
- **超短小临界区 + 高频**:每次 hop 到 actor 的开销大于锁本身;\`Mutex\` / \`OSAllocatedUnfairLock\` 临界区纳秒级
- 需要跨多个 actor 的原子事务(此时常重设计成单一 actor 更好)

**禁区**:\`await\` 期间持有 \`NSLock\` 等原始锁(挂起后可能在别的线程释放,未定义行为),要么 actor,要么锁在 await 之前放掉。

**iOS 18+ 的选型**:\`Mutex<T>\`(Synchronization)是 Swift 6 友好的一等公民,语义清晰、跨平台,优先于 \`NSLock\`。`,
  },
]);
