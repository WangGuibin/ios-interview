/* iOS 题宝库 · data/combine.js:Combine 与响应式 */
'use strict';

QB.add({
  key: 'combine', name: 'Combine 与响应式', icon: 'cCombine', tint: '#3D9A50',
  desc: 'Publisher/Subscriber、背压、操作符与选型',
}, [
  {
    t: 'Combine 的五角色与订阅流程?',
    lv: 2, fq: 3, tags: ['Publisher', 'Subscriber', 'Cancellable'],
    key: ['Publisher 生产、Subscriber 消费、Subscription 连接、Cancellable 句柄、Scheduler 调度', '铁律:Output 与 Input 类型匹配,Failure 一致'],
    a: `**五个角色**:

- **\`Publisher\`**:生产者,发出值序列 + 一次完成(完成或失败)
- **\`Subscriber\`**:消费者,声明能处理什么类型
- **\`Subscription\`**:单条订阅的**连接**,承载**背压需求(Demand)**
- **\`Cancellable\` / \`AnyCancellable\`**:取消句柄,**deinit 自动取消**,所以必须存起来
- **\`Scheduler\`**:决定事件在哪个上下文中流转(\`DispatchQueue\` / \`RunLoop\` / \`OperationQueue\`)

**六步握手**:

1. Subscriber 订阅 Publisher
2. Publisher 创建 Subscription,调 \`subscriber.receive(subscription:)\`
3. Subscriber 声明需求 \`request(.max(n))\`
4. Publisher 按需求发值(\`receive(_:)\` 返回新 Demand 增量)
5. 发 \`completion\`(完成或 \`failure\`)终止
6. AnyCancellable 释放 → 取消

**类型铁律**:\`Publisher.Output == Subscriber.Input\`,\`Failure == Failure\`,不匹配编译不过,\`mapError\` 用来对齐。`,
  },
  {
    t: '什么是背压(backpressure)?Combine 是怎么体现的?',
    lv: 3, fq: 2, tags: ['背压', 'Demand'],
    key: ['生产者快于消费者时怎么办:缓冲/丢弃/阻塞/报错', 'Combine 是拉模型 Subscriber 声明 Demand,Publisher 按量发货'],
    a: `**背压**是"消费赶不上生产"时的处置策略,四种范式:缓冲(内存风险)、丢弃采样、阻塞上游(真背压)、报错。不处理就是队列耳朵膨胀崩溃。

**Combine 的拉模型**:Subscriber 用 \`Subscription.request(demand)\` **声明**还能要多少,Publisher **只能按量发货**:

- \`sink\` 内部直接 \`request(.unlimited)\` → **等于放弃背压**,事件全速灌
- 自定义 Subscriber:\`receive(_:) -> Subscribers.Demand\` 的**返回值**是"这单后又多吃多少",可以做精确续杯

**对比 RxSwift**:Rx 没有原生背压,要靠 \`throttle/buffer/sample\` 等操作符泄洪。Combine 把"你要多少我给多少"做进协议,**协议级更安全**。

**现实规划**:一般使用层(sink/assign)你感知不到 Demand;自定义 Subscriber、写驱动图片加载这类大流量管道,Demand 一定要过脑。`,
  },
  {
    t: 'PassthroughSubject 和 CurrentValueSubject 的区别?',
    lv: 2, fq: 3, tags: ['Subject', 'PassthroughSubject', 'CurrentValueSubject'],
    key: ['Passthrough=纯管道,无状态,新订阅者收不到历史;CurrentValue=存当前值,新订阅即回放', 'Subject 是热信号,先订阅再接,丢值是常态'],
    a: `| | PassthroughSubject | CurrentValueSubject |
|---|---|---|
| 状态 | **无**当前值 | **持有**当前值(构造需初始值) |
| 新订阅者 | 从此刻起的值 | **立刻收到当前最新值**,以后增量 |
| 完成语义 | send(completion) 后永久终止 | 同上 |
| 典型用途 | 事件广播(按钮点击) | 状态容器(登录态、配置) |

**注意事项**:

- Subject 是**热信号**:没有订阅者也发,先订阅后的值是接不到的(所以要"快照+增量"用 CurrentValueSubject 或先存历史性 buffer)
- \`eraseToAnyPublisher()\` 包出 publisher,避免把 subject 的 send 接口暴露给下游
- **谁更常用**:业务状态用 CurrentValueSubject 起步最顺;事件流(埋点点击)用 Passthrough,但 SwiftUI 时代 \`@Published\` 已是更舒服的出处`,
  },
  {
    t: 'combineLatest / zip / merge 的区别?',
    lv: 2, fq: 3, tags: ['操作符', 'combineLatest', 'zip', 'merge'],
    key: ['combineLatest:任一新值出组合;zip:按序配对,快的等慢的;merge:合流', '表单校验 = combineLatest;两请求齐回 = zip;多事件源统一 = merge'],
    a: `**三种合并语义**:

\`\`\`
A:   a1    a2       a3
B:      b1    b2
combineLatest:      (a1,b1) (a2,b1) (a2,b2) (a3,b2)   要求每流至少发过一次
zip:                (a1,b1)         (a2,b2)           按序 1:1 配对,快等慢
merge:        a1   b1 a2 b2    a3                     谁发算谁,保持事件流
\`\`\`

**场景映射**:

- **表单校验**(账号+密码都合法才允许登录):\`combineLatest\`
- **两个请求都回来才继续**:\`zip\`(或 async let 更直观)
- **多个事件源同一处理**(三个埋点通道汇到一个上报器):\`merge\`

**易混点**:\`combineLatest\` 会按**每路最新**组合,某个流不发,组合就停;故障即整个链 \`failure\`(Subject 除外),错误要 \`catch\` 降级。`,
    opt: ['zip 任一新值都会触发输出', 'combineLatest 要求各流按序配对', 'zip 快的流会等慢的流', 'merge 要求类型必须完全不同'],
    ans: 2,
  },
  {
    t: 'debounce 和 throttle 的区别?搜索框防抖怎么写?',
    lv: 2, fq: 3, tags: ['debounce', 'throttle', '搜索'],
    key: ['debounce:静默 N 秒才发(连续输入只发最后一次);throttle:固定窗口至少发一次', '搜索防抖:*.debounce + removeDuplicates'],
    a: `**语义**:

- **debounce(防抖)**:事件静默满 N 秒才放最近一次。连续输入中不发,停下来了才发一次。**适合搜索联想**
- **throttle(节流)**:固定时间窗口内至多放一(可选 latest first/last),**适合埋点/高频按钮防连点**

**搜索框标准管道**:

\`\`\`swift
$text
    .debounce(for: .milliseconds(300), scheduler: RunLoop.main)
    .removeDuplicates()
    .sink { [weak self] q in self?.search(q) }
    .store(in: &cancellables)
\`\`\`

**追问入口**:异步版怎么写?答:\`.task\` 里 \`try await Task.sleep\` + \`checkCancellation\`,或 Combine 接 \`.switchToLatest()\` 取消旧请求。**switchToLatest 与 debounce 的区别**:前者换最新 publisher(旧 publisher 取消),后者等静默期,搜索页一般两个都用。`,
  },
  {
    t: 'Combine 和 RxSwift 的关键差异?新项目怎么选?',
    lv: 2, fq: 2, tags: ['RxSwift', '选型'],
    key: ['Combine:类型化错误、内置背压、零三方依赖;RxSwift:生态老跨平台', '新项目:Combine 打底 + async/await 主通道'],
    a: `| | Combine | RxSwift |
|---|---|---|
| 错误 | **类型化 Failure**(可 Never) | 无类型 Error |
| 背压 | **协议内置 Demand** | 无原生,靠操作符泄洪 |
| 依赖 | 系统框架,零安装 | 三方库,体积与学习成本 |
| 系统要求 | iOS 13+ | 无系统门槛,跨平台 |

**2026 的选型语境**:

- **新写网络请求/一次性异步**:async/await 是主通道,Combine 只做剩余的事件流
- **持续事件流**(IM、股价、传感器、表单联动):Combine 仍是系统级首选,与 SwiftUI 绑定(\`@Published\`、ObservableObject)最密
- **老项目**:Rx 改造成本大,渐进用 \`publisher.values / .asObservable()\` 边界翻译,不强迁

**面试话术**:说清楚"Combine ≈ Apple 给响应式的一等公民,RAC 思路的类型安全版;而 async/await 抢走了它'单次异步'的场景,剩下的场景是**多值、可组合、可取消**的事件流"。`,
  },
  {
    t: 'Future 为什么说是"热"的?share() 解决什么问题?',
    lv: 3, fq: 1, tags: ['Future', 'share()', '冷热信号'],
    key: ['Future 创建就执行工作,不管有没有订阅;普通 publisher 是冷的,订阅才开工', 'share() 把冷变热,防止一份网络请求被每个订阅者各发一次'],
    a: `**冷/热的区别**:

- **冷信号**:每个订阅者到来都**重新执行**工作(URLSession 的 DataTaskPublisher 每订阅一次就真发一次请求)
- **热信号**:工作在所有订阅者**之外**独立进行,订阅只接结果

**\`Future\` 是热的**:初始化时就索取 promise,工作立即启动,**不在乎**有没有人订。

\`\`\`swift
let future = Future<Int, Never> { promise in
    expensiveWork { promise(.success($0)) }   // 这里现在就启动
}
\`\`\`

**问题**:同一个冷 publisher 被 \`map\` 出两条订阅链,工作会跑两遍。解法 **\`share()\`**:

\`\`\`swift
let shared = urlSession.dataTaskPublisher(for: url)
    .map(\\.data)
    .share()            // 第一个订阅启动工作,后续订阅接同一结果(可配 replay)
\`\`\`

**更精细的**:\`multicast { PassthroughSubject() }.autoconnect()\` 自己控制何时重放/断开;只回放要 \`share(replay:)\`。

**应用**:网络请求层、日志通道、多页面共享同一数据源,这几个概念的掌握能省掉大量"为什么发了两次请求"的排查时间。`,
  },
  {
    t: 'Combine 与 async/await 怎么互转?各自的场景怎么选?',
    lv: 2, fq: 2, tags: ['互转', 'values', 'AsyncPublisher'],
    opt: ['Combine 已被 async/await 完全取代', 'publisher.values 把 Publisher 转成 AsyncSequence', 'async 函数不能转成 Publisher', 'AsyncSequence 自带 debounce 等全套操作符'],
    ans: 1,
    key: ['Publisher → async:.values 或 .value 取单值;async → Publisher:Future/asyncPublisher', '一次性 async;持续事件流 Combine'],
    a: `**Publisher → async**:

\`\`\`swift
// 多值:for await 消费 AsyncSequence
for await value in publisher.values { apply(value) }

// 只拿第一个/下一个值:
let x = try await publisher.first().value
\`\`\`

(\`.values\` 是 AsyncSequence;\`.value\` 是 Swift 5.10 以后的 future 化取单值)

**async → Publisher**:

\`\`\`swift
let publisher = Future<T, Error> { promise in
    Task { do { promise(.success(try await work())) } catch { promise(.failure(error)) } }
}
// 或更为直接的 .asyncPublisher / Deferred + Task
\`\`\`

**场景决策树**:

- 一个函数、一次完成(async 一次网络请求)→ **async/await**
- 一串多值,会不断来(IM、位置、socket)→ **Combine** 或 \`AsyncSequence\`
- 需要操作符组合(防抖/合流/重试)→ **Combine**(AsyncSequence 生态里 swift-async-algorithms 在追但还远)

**面试加分**:说清 "Combine 是**多值+可组合事件流**的标准件,async/await 是**单值结构化**的新基座,未来两者边界将被 \`Observations\`(Swift 6.2 / iOS 26,AsyncSequence 形式的属性级观察)进一步收敛"。`,
  },
  {
    t: 'receive(on:) 和 subscribe(on:) 有什么区别?放错位置会怎样?',
    lv: 3, fq: 3, tags: ['Scheduler', 'receive(on:)', 'subscribe(on:)'],
    opt: ['两者等价,只是命名不同', 'subscribe(on:) 决定订阅与上游工作所在队列,receive(on:) 决定下游接收所在队列', 'receive(on:) 影响上游', '两者都必须在管道最末尾调用'],
    ans: 1,
    key: ['subscribe(on:) 管"上游在哪干活";receive(on:) 管"下游在哪收货"', 'UI 更新前必须 receive(on: DispatchQueue.main)'],
    a: `**分工(方向相反,这是最容易记混的点)**:

- **\`subscribe(on:)\`**:影响**上游**。订阅动作本身(以及 Publisher 创建值的工作)被派发到指定 Scheduler,**位置无关**(写在哪都作用于整条上游链)
- **\`receive(on:)\`**:影响**下游**。从它往后的所有操作符与 \`sink\` 都在指定 Scheduler 上执行,**位置敏感**(只影响它之后的部分)

\`\`\`swift
URLSession.shared.dataTaskPublisher(for: url)
    .subscribe(on: DispatchQueue.global())   // 上游在后台发起
    .map(\\.data)
    .decode(type: Feed.self, decoder: JSONDecoder())  // 仍在后台解码 ✓
    .receive(on: DispatchQueue.main)         // 从这里开始回主线程
    .sink { ... }                            // UI 更新安全 ✓
\`\`\`

**放错的后果**:

- \`receive(on: .main)\` 放太前面 → **解码在主线程跑**,大 JSON 直接卡帧(最常见的性能事故)
- 忘了 \`receive(on: .main)\` → 在后台线程改 UI,Main Thread Checker 报警甚至崩溃
- 以为 \`subscribe(on:)\` 能把 sink 放到后台 → 不会,下游仍在上游发值的线程

**记忆口诀**:**subscribe 管上游开工,receive 管下游收货;要改 UI,收货口必须在主线程。**`,
  },
  {
    t: 'AnyCancellable 忘记持有会怎样?store(in:) 做了什么?',
    lv: 2, fq: 3, tags: ['AnyCancellable', '内存管理', 'store'],
    opt: ['订阅会一直存在,造成内存泄漏', 'AnyCancellable 释放时自动取消订阅,管道立即失效', '不影响,Combine 内部会保留订阅', '会导致编译错误'],
    ans: 1,
    key: ['AnyCancellable deinit 时自动 cancel;不持有 = 订阅立刻死', 'store(in: &cancellables) 把它存进集合延长生命'],
    a: `**核心机制**:\`AnyCancellable\` 在 **deinit 时自动调用 \`cancel()\`**。这是刻意设计:订阅的生命周期绑定在持有者身上,持有者没了订阅自动断,不需要手动管理。

**忘记持有的后果**:

\`\`\`swift
// ❌ 返回的 AnyCancellable 没人持有 → 语句结束即 deinit → 订阅当场取消
publisher.sink { print($0) }        // 什么都不会打印

// ✓ 存起来,生命周期跟着 self
publisher.sink { print($0) }
    .store(in: &cancellables)       // cancellables: Set<AnyCancellable>
\`\`\`

症状很有迷惑性:**不报错、不崩溃,就是回调一次都不执行**,排查时容易怀疑 Publisher 有问题。

**\`store(in:)\`** 只是语法糖:把自己插进一个 \`Set<AnyCancellable>\`(或 Array)。宿主对象(通常是 VM)销毁时集合一起销毁,所有订阅批量取消 —— 这就是 Combine 版的"自动 removeObserver"。

**反向陷阱**:把 cancellables 声明成全局/静态,订阅永不释放,等于泄漏。它应该是**实例属性**,与宿主同生共死。

**\`assign(to: &$published)\`** 是个例外:它直接把管道绑到 \`@Published\` 上,由属性自己管理生命周期,**不需要** store。`,
  },
  {
    t: 'Combine 里怎么做错误重试与降级?retry / catch / replaceError 怎么配合?',
    lv: 3, fq: 2, tags: ['错误处理', 'retry', 'catch'],
    key: ['retry(n) 重新订阅上游;catch 换一条 Publisher 兜底;replaceError 给默认值并把 Failure 变 Never', 'retry 对冷 Publisher 才有意义'],
    a: `**三件套各司其职**:

| 操作符 | 作用 | 之后的 Failure 类型 |
|---|---|---|
| \`retry(n)\` | 失败后**重新订阅上游** n 次 | 不变 |
| \`catch { _ in other }\` | 出错后**整条换成另一个 Publisher** | 变成 other 的 Failure |
| \`replaceError(with:)\` | 出错换成默认值 | **Never**(下游不用再处理错误) |
| \`mapError\` | 只做错误类型转换,对齐链路 | 变成目标类型 |

**典型的降级链**:

\`\`\`swift
api.fetchFeed()
    .retry(2)                                   // 网络抖动重试两次
    .catch { _ in cache.loadFeed() }            // 还失败就读本地缓存
    .replaceError(with: [])                     // 缓存也没有就给空数组
    .receive(on: DispatchQueue.main)
    .assign(to: &$items)                        // Failure 已是 Never,可以 assign
\`\`\`

**关键细节**:

- \`retry\` 是**重新订阅**,所以只对**冷 Publisher**(如 dataTaskPublisher)有意义;对 Subject 这种热信号重订阅拿不到旧值
- \`retry\` **没有延迟**,是立即重试。要指数退避得自己组合 \`delay\` + \`flatMap\`,或用 \`Publishers.Retry\` 的自定义封装
- 别用 \`retry\` 兜 4xx:客户端错误重试多少次都一样,只重试网络类错误`,
  },
  {
    t: 'flatMap 和 switchToLatest 有什么区别?搜索场景该用哪个?',
    lv: 3, fq: 2, tags: ['flatMap', 'switchToLatest', '搜索'],
    opt: ['两者完全等价', 'flatMap 并发保留所有内层结果,switchToLatest 只保留最新的并取消旧的', 'switchToLatest 会等所有请求完成', 'flatMap 不能用于网络请求'],
    ans: 1,
    key: ['flatMap:内层 Publisher 并存,结果可能乱序到达', 'switchToLatest:新值到来即取消上一个,天然防竞态'],
    a: `**差别在"旧的怎么办"**:

- **\`flatMap\`**:每个上游值都开一个内层 Publisher,**全部并存**。三次搜索请求并发飞出,谁先回来谁先到 —— **结果可能乱序**,慢的旧请求可能覆盖快的新请求
- **\`switchToLatest\`**:新的内层 Publisher 一出现,**立即取消上一个**。永远只有最新那条在跑

**搜索场景必须用 switchToLatest**(这是经典竞态 bug):

\`\`\`swift
$query
    .debounce(for: .milliseconds(300), scheduler: RunLoop.main)
    .removeDuplicates()
    .map { api.search($0) }      // 得到 Publisher<Publisher<...>>
    .switchToLatest()            // 只保留最新一条,旧请求自动取消
    .receive(on: DispatchQueue.main)
    .sink { ... }
\`\`\`

用 flatMap 的话:输入"swift"过程中发出的 "s"/"sw"/"swi" 请求都还在飞,如果 "sw" 的响应最后到达,**界面会显示 "sw" 的结果**,而输入框里是 "swift"。

**并发控制**:\`flatMap(maxPublishers: .max(3))\` 可以限制同时存在的内层数量,适合批量下载这种"都要,但别一次太多"的场景。

**对位 async/await**:switchToLatest ≈ 新 Task 启动前 \`cancel\` 旧 Task;flatMap ≈ TaskGroup 全都要。`,
  },
  {
    t: '@Published 的底层原理?为什么在 willSet 时机发送?',
    lv: 3, fq: 2, tags: ['@Published', 'objectWillChange', 'SwiftUI'],
    key: ['SwiftUI 契约是"先通知再变化":标脏 → 下一帧重绘时读到的已是新值', 'sink 里回头读属性会拿到旧值,要用事件参数'],
    a: `**发送时机是 willSet 语义**:值"即将改变"时就发出通知,而不是改完才发。

\`\`\`swift
class VM: ObservableObject {
    @Published var count = 0
}
vm.$count.sink { newValue in
    print(newValue)      // 2 —— 事件带的是**新值**
    print(vm.count)      // 1 —— ⚠️ 直接读属性拿到的是**旧值**
}
vm.count = 2
\`\`\`

**为什么这样设计**:SwiftUI 的 \`objectWillChange\` 契约要求"**先通知、后变化**"。SwiftUI 收到通知只是**标脏**,并不立刻读值;等到下一帧真正重绘 body 时,属性早已写入新值,读到的是正确的。这样既能批量合并同一帧内的多次变更,又不会重复渲染。

**经典坑**:在 \`sink\` 里不用闭包参数而是回头读 \`self.property\`,拿到的是**旧值**。正确做法永远是用事件携带的参数。

**实现层面**:\`@Published\` 是属性包装器,通过 \`static subscript(_enclosingInstance:...)\` 拦截写入,顺序是 \`objectWillChange.send()\` → \`publisher.send(newValue)\` → 真正写入存储。

**与 @Observable 的差异**:\`@Observable\`(iOS 17)改成了**属性级依赖追踪**,不再有"整个对象一变全刷"的问题,也不需要 \`@Published\` 标注(见 SwiftUI 分类)。`,
  },
  {
    t: '怎么把 delegate 或 NotificationCenter 桥接成 Publisher?',
    lv: 2, fq: 2, tags: ['桥接', 'Subject', 'NotificationCenter'],
    key: ['通知:NotificationCenter.default.publisher(for:) 现成的', 'delegate:内部持 PassthroughSubject,回调里 send,对外 eraseToAnyPublisher'],
    a: `**通知有现成的**:

\`\`\`swift
NotificationCenter.default.publisher(for: UIApplication.didBecomeActiveNotification)
    .sink { _ in refresh() }
    .store(in: &cancellables)
\`\`\`

**delegate 靠 Subject 中转**(标准模式):

\`\`\`swift
final class LocationService: NSObject, CLLocationManagerDelegate {
    private let subject = PassthroughSubject<CLLocation, Never>()
    // 对外只暴露只读 Publisher,不泄漏 send 能力
    var locations: AnyPublisher<CLLocation, Never> { subject.eraseToAnyPublisher() }

    func locationManager(_ m: CLLocationManager, didUpdateLocations locs: [CLLocation]) {
        locs.forEach { subject.send($0) }
    }
}
\`\`\`

**三个设计要点**:

1. **\`eraseToAnyPublisher()\`** 让外部只能订阅、不能 \`send\`,封装不破
2. **热信号语义**:没订阅时发的值直接丢失。需要"新订阅者拿到最新值"就换 \`CurrentValueSubject\`
3. **资源清理**:订阅者归零时该停掉底层服务(定位、socket),可以用 \`handleEvents(receiveCancel:)\` 挂钩

**并发时代的对照**:同样的桥接用 \`AsyncStream\` 写更短,且带背压(见并发分类的 AsyncStream 题)。新代码若只有一个消费者,优先 AsyncStream;需要多播或操作符组合,才用 Subject。`,
  },
]);
